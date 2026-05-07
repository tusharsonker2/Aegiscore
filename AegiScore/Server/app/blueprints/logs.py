"""AegisCore — Log Ingestion Service Blueprint"""
import os, re
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.blueprints.auth import require_roles
from extensions import socketio
from app.utils import getlogs

logs_bp = Blueprint('logs', __name__)
DATA_DIR = os.path.join(os.path.dirname(__file__), '..', '..', 'data')

# UNSW-NB15 required categorical columns
UNSW_REQUIRED_COLS = {'proto', 'service', 'state', 'label', 'attack_cat'}
REVERSE_ENCODING = {
    0: 'Analysis', 1: 'Backdoor', 2: 'DoS', 3: 'Exploits',
    4: 'Fuzzers', 5: 'Generic', 6: 'Normal', 7: 'Reconnaissance',
    8: 'Shellcode', 9: 'Worms'
}


@logs_bp.route('/upload', methods=['POST'])
@require_roles('admin', 'analyst')
def upload_log():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    os.makedirs(DATA_DIR, exist_ok=True)
    files = request.files.getlist('file')
    saved = []
    for f in files:
        filename = os.path.basename(f.filename)
        ext = filename.rsplit('.', 1)[-1].lower()
        if ext in ('docx', 'pptx', 'xlsx'):
            return jsonify({'error': f'Unsupported file type: {ext}'}), 415
        dest = os.path.join(DATA_DIR, filename)
        f.save(dest)
        saved.append(filename)
        # Emit real-time event to connected clients
        socketio.emit('log_uploaded', {'filename': filename, 'status': 'uploaded'})
    return jsonify({'status': 'Files uploaded', 'files': saved})


@logs_bp.route('/list', methods=['GET'])
@jwt_required()
def list_logs():
    try:
        os.makedirs(DATA_DIR, exist_ok=True)
        files = [
            {'name': f, 'size': os.path.getsize(os.path.join(DATA_DIR, f))}
            for f in os.listdir(DATA_DIR)
            if os.path.isfile(os.path.join(DATA_DIR, f))
        ]
        return jsonify({'files': files, 'count': len(files)})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@logs_bp.route('/create', methods=['POST'])
@require_roles('admin', 'analyst')
def create_system_logs():
    data = request.get_json(silent=True) or {}
    max_count     = int(data.get('max_count', 1))
    time_interval = int(data.get('time_interval', 10))
    try:
        filename = getlogs.main(max_count=max_count, time_interval=time_interval)
        log_path = os.path.join(DATA_DIR, filename)
        if os.path.exists(log_path):
            with open(log_path, 'r') as fh:
                content = fh.read()
            socketio.emit('logs_created', {'lines': content.count('\n'), 'filename': filename})
            return jsonify({'status': 'Logs created', 'filename': filename})
        return jsonify({'status': 'No logs generated'}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@logs_bp.route('/data/<filename>', methods=['GET'])
@jwt_required()
def get_log_data(filename):
    safe = os.path.basename(filename)
    path = os.path.join(DATA_DIR, safe)
    if not os.path.exists(path):
        return jsonify({'error': 'File not found'}), 404
    with open(path, 'r', errors='replace') as fh:
        content = fh.read()
    return jsonify({'filename': safe, 'data': content})


@logs_bp.route('/analyze/<filename>', methods=['POST'])
@require_roles('admin', 'analyst')
def analyze_log_ml(filename):
    """
    Run the pretrained LSTM threat detection models on an uploaded CSV.
    - If the file is UNSW-NB15 format: runs full LSTM binary + category prediction,
      creates DB alerts with MITRE mapping, Playbook engine, and Correlation engine.
    - If the file is psutil telemetry: performs heuristic port/process analysis and
      creates low-severity alerts for suspicious connections.
    """
    import numpy as np
    import pandas as pd
    from collections import Counter
    from app.models.db import db, Alert
    from app.utils.mitre_mapper import get_mitre_mapping
    from app.services.playbook_engine import PlaybookEngine
    from app.services.correlation_engine import CorrelationEngine
    from datetime import datetime, timedelta

    safe = os.path.basename(filename)
    path = os.path.join(DATA_DIR, safe)

    if not os.path.exists(path):
        return jsonify({'error': 'File not found'}), 404
    if not safe.lower().endswith('.csv'):
        return jsonify({'error': 'Only CSV files can be analyzed by the ML model.'}), 400

    try:
        df = pd.read_csv(path, low_memory=False)
        df.columns = [c.strip().lower() for c in df.columns]

        # ── UNSW-NB15 ML path ─────────────────────────────────────────────────
        if UNSW_REQUIRED_COLS.issubset(set(df.columns)):
            from sklearn.preprocessing import LabelEncoder, MinMaxScaler
            import keras

            # Encode categoricals
            for col in ['proto', 'service', 'state', 'attack_cat']:
                le = LabelEncoder()
                df[col] = le.fit_transform(df[col].astype(str))

            # Drop target columns to get feature matrix
            feature_df = df.drop(columns=['label', 'attack_cat'], errors='ignore')
            X = feature_df.values.astype(float)

            if X.shape[1] != 43:
                return jsonify({
                    'error': f'UNSW-NB15 format detected but expected 43 features, got {X.shape[1]}.',
                    'hint': 'File may be missing or have extra columns.'
                }), 422

            scaler = MinMaxScaler()
            X_scaled = scaler.fit_transform(X)
            X_shaped = X_scaled.reshape((X_scaled.shape[0], 1, X_scaled.shape[1]))

            # Build and load models
            os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'
            inp = keras.layers.Input(shape=(1, 43))
            x = keras.layers.LSTM(128, return_sequences=True, activation='relu')(inp)
            x = keras.layers.Dropout(0.2)(x)
            x = keras.layers.LSTM(64, return_sequences=True)(x)
            x = keras.layers.Dropout(0.2)(x)
            x = keras.layers.LSTM(32)(x)
            x = keras.layers.Dropout(0.2)(x)
            x = keras.layers.Dense(32, activation='relu')(x)

            label_out = keras.layers.Dense(1, activation='sigmoid', name='label_output')(x)
            cat_out   = keras.layers.Dense(10, activation='softmax', name='attack_cat_output')(x)

            model_label = keras.Model(inputs=inp, outputs=[label_out])
            model_cat   = keras.Model(inputs=inp, outputs=[cat_out])

            weights_dir = os.path.join(os.path.dirname(__file__), '..', '..', 'resources', 'weights')
            model_label.load_weights(os.path.join(weights_dir, 'cyber_sec_label.weights.h5'))
            model_cat.load_weights(os.path.join(weights_dir, 'cyber_sec_category.weights.h5'))

            label_preds = model_label.predict(X_shaped, verbose=0)
            cat_preds   = model_cat.predict(X_shaped, verbose=0)

            threats_found = []
            alerts_created = 0

            for i in range(len(label_preds)):
                is_threat  = bool(label_preds[i][0] > 0.5)
                category   = REVERSE_ENCODING.get(int(np.argmax(cat_preds[i])), 'Unknown')
                confidence = float(label_preds[i][0])

                if is_threat and category != 'Normal':
                    severity = (
                        'critical' if category in ('Backdoor', 'Worms', 'Shellcode') else
                        'high'     if category in ('Exploits', 'DoS') else
                        'medium'
                    )
                    mitre_info = get_mitre_mapping(category)
                    source_ip  = f'192.168.scan.{i % 254 + 1}'

                    alert = Alert(
                        severity=severity,
                        category=category,
                        description=f'[ML Scan: {safe}] Row #{i} → {category} (confidence {confidence:.1%})',
                        source_ip=source_ip,
                        mitre_technique=mitre_info['technique_id'],
                        mitre_tactic=mitre_info['tactic'],
                    )
                    db.session.add(alert)
                    alerts_created += 1
                    threats_found.append({
                        'row': i, 'category': category,
                        'severity': severity, 'confidence': round(confidence * 100, 1)
                    })

            db.session.commit()

            # Fire Playbook Engine on all newly created alerts
            pb_engine = PlaybookEngine()
            new_alerts = Alert.query.filter(
                Alert.timestamp >= datetime.utcnow() - timedelta(minutes=2)
            ).all()
            for alert in new_alerts:
                pb_engine.run(alert)
            db.session.commit()

            # Correlation Engine
            CorrelationEngine().evaluate_recent_alerts()

            cat_summary = dict(Counter(t['category'] for t in threats_found))
            socketio.emit('log_analyzed', {'filename': safe, 'threats': len(threats_found)})

            return jsonify({
                'mode': 'LSTM (UNSW-NB15)',
                'filename': safe,
                'total_rows': len(label_preds),
                'threats_found': len(threats_found),
                'clean_rows': len(label_preds) - len(threats_found),
                'alerts_created': alerts_created,
                'category_breakdown': cat_summary,
                'top_threats': threats_found[:30],
            })

        # ── Psutil telemetry heuristic path ───────────────────────────────────
        elif 'remote ip' in df.columns or 'remote_ip' in df.columns:
            # Normalize column names
            df.columns = [c.replace(' ', '_').lower() for c in df.columns]
            SUSPICIOUS_PORTS = {22, 23, 3389, 4444, 5900, 6666, 8080, 8443, 31337}
            HIGH_CPU_THRESH  = 90.0
            alerts_created   = 0
            heuristic_threats = []

            for _, row in df.iterrows():
                reasons = []
                severity = 'low'

                try:
                    remote_ip   = str(row.get('remote_ip', ''))
                    remote_port = int(row.get('remote_port', 0))
                    cpu_usage   = float(row.get('cpu_usage_(%)', 0))
                    proc_name   = str(row.get('process_name', ''))

                    if remote_port in SUSPICIOUS_PORTS:
                        reasons.append(f'Suspicious remote port {remote_port}')
                        severity = 'high'
                    if cpu_usage > HIGH_CPU_THRESH:
                        reasons.append(f'High CPU ({cpu_usage}%)')
                        severity = 'medium' if severity == 'low' else severity
                    if remote_ip and not remote_ip.startswith(('192.168.', '10.', '127.')):
                        reasons.append(f'External IP connection: {remote_ip}')
                        severity = 'medium' if severity == 'low' else severity

                    if reasons:
                        mitre_info = get_mitre_mapping('Reconnaissance')
                        alert = Alert(
                            severity=severity,
                            category='Telemetry Anomaly',
                            description=f'[Telemetry Scan: {safe}] Process "{proc_name}" — ' + '; '.join(reasons),
                            source_ip=remote_ip or 'localhost',
                            mitre_technique=mitre_info['technique_id'],
                            mitre_tactic=mitre_info['tactic'],
                        )
                        db.session.add(alert)
                        alerts_created += 1
                        heuristic_threats.append({'process': proc_name, 'reasons': reasons, 'severity': severity})
                except Exception:
                    continue

            db.session.commit()
            socketio.emit('log_analyzed', {'filename': safe, 'threats': alerts_created})

            return jsonify({
                'mode': 'Heuristic (Telemetry)',
                'filename': safe,
                'total_rows': len(df),
                'threats_found': len(heuristic_threats),
                'clean_rows': len(df) - len(heuristic_threats),
                'alerts_created': alerts_created,
                'top_threats': heuristic_threats[:30],
            })

        else:
            return jsonify({
                'error': 'Unrecognized file format.',
                'hint': 'Upload a UNSW-NB15 network traffic CSV or a system telemetry CSV captured by AegisCore.'
            }), 422

    except Exception as e:
        return jsonify({'error': str(e)}), 500

