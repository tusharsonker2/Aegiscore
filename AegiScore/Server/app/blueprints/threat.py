"""AegisCore — Threat Detection Service Blueprint"""
import os
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.blueprints.auth import require_roles
from app.models.db import db, Alert, User, Feedback
from extensions import socketio
from app.utils.mitre_mapper import get_mitre_mapping
from app.services.baseline_service import BaselineService
from app.services.correlation_engine import CorrelationEngine
from app.services.playbook_engine import PlaybookEngine
import requests
import json
from datetime import datetime, timedelta

threat_bp = Blueprint('threat', __name__)

_model_cache = {}
_geo_cache = {}

def get_geo_info(ip):
    """Fetch and cache GeoIP data from ip-api.com (free tier)"""
    if ip in _geo_cache:
        return _geo_cache[ip]
    if ip.startswith('192.168.') or ip.startswith('10.') or ip == '127.0.0.1':
        # Local/Synthetic IPs
        data = {'lat': 37.7749, 'lon': -122.4194, 'country': 'United States', 'isp': 'Local Network'}
        _geo_cache[ip] = data
        return data
    try:
        r = requests.get(f'http://ip-api.com/json/{ip}?fields=status,country,isp,lat,lon', timeout=3)
        if r.status_code == 200 and r.json().get('status') == 'success':
            data = r.json()
            _geo_cache[ip] = data
            return data
    except Exception:
        pass
    _geo_cache[ip] = None
    return None


def _get_models():
    """Lazy-load Keras models once."""
    if 'label' in _model_cache:
        return _model_cache['label'], _model_cache['cat']

    os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'
    import keras
    from sklearn.preprocessing import LabelEncoder, MinMaxScaler

    input_layer = keras.layers.Input(shape=(1, 43))
    x = keras.layers.LSTM(128, return_sequences=True, activation='relu')(input_layer)
    x = keras.layers.Dropout(0.2)(x)
    x = keras.layers.LSTM(64, return_sequences=True)(x)
    x = keras.layers.Dropout(0.2)(x)
    x = keras.layers.LSTM(32)(x)
    x = keras.layers.Dropout(0.2)(x)
    x = keras.layers.Dense(32, activation='relu')(x)

    label_output = keras.layers.Dense(1, activation='sigmoid', name='label_output')(x)
    attack_cat_output = keras.layers.Dense(10, activation='softmax', name='attack_cat_output')(x)

    model_label = keras.Model(inputs=input_layer, outputs=[label_output])
    model_cat = keras.Model(inputs=input_layer, outputs=[attack_cat_output])

    model_label.compile(optimizer='adam', loss='binary_crossentropy', metrics=['accuracy'])
    model_cat.compile(optimizer='adam', loss='sparse_categorical_crossentropy', metrics=['accuracy'])

    weights_dir = os.path.join(os.path.dirname(__file__), '..', '..', 'resources', 'weights')
    label_path = os.path.join(weights_dir, 'cyber_sec_label.weights.h5')
    cat_path = os.path.join(weights_dir, 'cyber_sec_category.weights.h5')

    if os.path.exists(label_path):
        model_label.load_weights(label_path)
    if os.path.exists(cat_path):
        model_cat.load_weights(cat_path)

    _model_cache['label'] = model_label
    _model_cache['cat'] = model_cat
    return model_label, model_cat


ENCODING = {
    'Analysis': 0, 'Backdoor': 1, 'DoS': 2, 'Exploits': 3,
    'Fuzzers': 4, 'Generic': 5, 'Normal': 6, 'Reconnaissance': 7,
    'Shellcode': 8, 'Worms': 9,
}
REVERSE_ENCODING = {v: k for k, v in ENCODING.items()}


@threat_bp.route('/detect', methods=['POST'])
@require_roles('admin', 'analyst')
def detect_threats():
    import numpy as np
    import pandas as pd
    
    data = request.get_json(silent=True) or {}
    limit = int(data.get('limit', 200))

    csv_path = os.path.join(os.path.dirname(__file__), '..', '..', 'resources', 'datasets', 'UNSW_NB15_training-set.csv')
    if not os.path.exists(csv_path):
        return jsonify({'error': 'Training dataset not found'}), 404

    try:
        from sklearn.preprocessing import LabelEncoder, MinMaxScaler

        df = pd.read_csv(csv_path)
        for col in ['proto', 'service', 'state', 'attack_cat']:
            le = LabelEncoder()
            df[col] = le.fit_transform(df[col])

        scaler = MinMaxScaler()
        df[df.columns] = scaler.fit_transform(df[df.columns])
        X = df.drop(columns=['label', 'attack_cat']).values
        X = X.reshape((X.shape[0], 1, X.shape[1]))

        model_label, model_cat = _get_models()
        preds = model_label.predict(X[:limit])
        cats = model_cat.predict(X[:limit])

        threats = []
        for i in range(len(preds)):
            is_threat = bool(preds[i] > 0.5)
            category = REVERSE_ENCODING.get(int(np.argmax(cats[i])), 'Unknown')
            if is_threat:
                severity = 'critical' if category in ('Backdoor', 'Worms', 'Shellcode') else 'high'
                source_ip = f'192.168.1.{10 + (i % 5)}' # Synthetic IP for correlation testing
                
                # 1. Baseline Comparison (Elevate severity if anomalous)
                # Mocking a feature dict based on this event
                features = {'event_count': 5} 
                if BaselineService.check_anomaly(source_ip, features) and severity != 'critical':
                    severity = 'critical'
                
                # 2. MITRE ATT&CK Mapping
                mitre_info = get_mitre_mapping(category)
                
                # 3. Geo-IP Lookup
                geo_info = get_geo_info(source_ip) or {}
                
                alert = Alert(
                    severity=severity,
                    category=category,
                    description=f'Log #{i} flagged as {category}',
                    source_ip=source_ip,
                    mitre_technique=mitre_info['technique_id'],
                    mitre_tactic=mitre_info['tactic'],
                    geo_country=geo_info.get('country'),
                    geo_isp=geo_info.get('isp'),
                    geo_lat=geo_info.get('lat'),
                    geo_lon=geo_info.get('lon')
                )
                db.session.add(alert)
                threats.append({
                    'log_index': i, 'category': category, 'severity': severity,
                    'mitre_technique': mitre_info['technique_id']
                })
                socketio.emit('threat_detected', {
                    'log_index': i, 'category': category, 'severity': severity
                })

        db.session.commit()

        # 4. Run Playbook Engine on each new alert
        pb_engine = PlaybookEngine()
        new_alerts = Alert.query.filter(
            Alert.timestamp >= datetime.utcnow() - timedelta(minutes=2)
        ).all()
        for alert in new_alerts:
            pb_engine.run(alert)
        db.session.commit()
        
        # 3. Correlation Engine (Evaluate sliding window)
        engine = CorrelationEngine()
        engine.evaluate_recent_alerts()

        return jsonify({
            'total_scanned': limit,
            'threats_found': len(threats),
            'threats': threats[:50],
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@threat_bp.route('/alerts', methods=['GET'])
@jwt_required()
def get_alerts():
    status = request.args.get('status', None)
    query = Alert.query.order_by(Alert.timestamp.desc())
    if status:
        query = query.filter_by(status=status)
    alerts = query.limit(100).all()
    return jsonify([a.to_dict() for a in alerts])


@threat_bp.route('/stats', methods=['GET'])
@jwt_required()
def threat_stats():
    total = Alert.query.count()
    critical = Alert.query.filter_by(severity='critical').count()
    high = Alert.query.filter_by(severity='high').count()
    medium = Alert.query.filter_by(severity='medium').count()
    low = Alert.query.filter_by(severity='low').count()
    return jsonify({
        'total': total, 'critical': critical,
        'high': high, 'medium': medium, 'low': low,
    })


@threat_bp.route('/feedback', methods=['POST'])
@jwt_required()
def submit_feedback():
    data = request.get_json() or {}
    alert_id = data.get('alert_id')
    verdict = data.get('verdict') # 'TP' or 'FP'
    
    username = get_jwt_identity()
    user = User.query.filter_by(username=username).first()
    
    if not alert_id or not verdict:
        return jsonify({'error': 'Missing parameters'}), 400
        
    feedback = Feedback(
        alert_id=alert_id,
        analyst_id=user.id,
        verdict=verdict
    )
    db.session.add(feedback)
    db.session.commit()
    return jsonify({'message': 'Feedback recorded successfully'})


@threat_bp.route('/feedback/summary', methods=['GET'])
@jwt_required()
def feedback_summary():
    """Returns False Positive rate per threat category"""
    from sqlalchemy import func
    
    # Get all feedback joined with alerts to get category
    results = db.session.query(
        Alert.category,
        Feedback.verdict,
        func.count(Feedback.id)
    ).join(Alert).group_by(Alert.category, Feedback.verdict).all()
    
    stats = {}
    for category, verdict, count in results:
        if category not in stats:
            stats[category] = {'TP': 0, 'FP': 0}
        stats[category][verdict] = count
        
    summary = []
    for cat, data in stats.items():
        total = data['TP'] + data['FP']
        fp_rate = (data['FP'] / total * 100) if total > 0 else 0
        summary.append({
            'category': cat,
            'total_feedback': total,
            'fp_rate': fp_rate
        })
        
    return jsonify(summary)


@threat_bp.route('/geomap', methods=['GET'])
@jwt_required()
def get_geomap():
    """Aggregates threats by source IP for the Geo Map"""
    from sqlalchemy import func
    
    # Query for distinct IPs that have coordinates
    results = db.session.query(
        Alert.source_ip,
        Alert.geo_lat,
        Alert.geo_lon,
        Alert.geo_country,
        Alert.category,
        func.count(Alert.id).label('count')
    ).filter(Alert.geo_lat != None).group_by(
        Alert.source_ip, Alert.geo_lat, Alert.geo_lon, Alert.geo_country, Alert.category
    ).all()
    
    data = []
    for ip, lat, lon, country, cat, count in results:
        data.append({
            'ip': ip,
            'lat': lat,
            'lon': lon,
            'country': country,
            'category': cat,
            'count': count
        })
    return jsonify(data)


@threat_bp.route('/network', methods=['GET'])
@jwt_required()
def get_network_graph():
    """Returns nodes and links for the Network Graph view"""
    alerts = Alert.query.order_by(Alert.timestamp.desc()).limit(100).all()
    
    nodes_dict = {}
    links = []
    
    # Add central "AegisCore" node
    nodes_dict['AegisCore'] = {'id': 'AegisCore', 'name': 'AegisCore Master Node', 'group': 'system', 'val': 15, 'desc': 'Central Defense System'}
    
    for a in alerts:
        if not a.source_ip: continue
        
        # IP Node
        if a.source_ip not in nodes_dict:
            nodes_dict[a.source_ip] = {
                'id': a.source_ip, 
                'name': f"IP: {a.source_ip}",
                'group': 'ip', 
                'val': 6,
                'threat_count': 1,
                'last_seen': a.timestamp.isoformat() if a.timestamp else None
            }
        else:
            nodes_dict[a.source_ip]['val'] = min(20, nodes_dict[a.source_ip]['val'] + 1)
            nodes_dict[a.source_ip]['threat_count'] += 1
            if a.timestamp and (not nodes_dict[a.source_ip]['last_seen'] or a.timestamp.isoformat() > nodes_dict[a.source_ip]['last_seen']):
                nodes_dict[a.source_ip]['last_seen'] = a.timestamp.isoformat()
            
        # Category Node
        cat_id = f"Threat: {a.category}"
        if cat_id not in nodes_dict:
            nodes_dict[cat_id] = {
                'id': cat_id, 
                'name': a.category,
                'group': 'threat', 
                'val': 8, 
                'severity': a.severity,
                'incidents': 1
            }
        else:
            nodes_dict[cat_id]['incidents'] += 1
            nodes_dict[cat_id]['val'] = min(25, nodes_dict[cat_id]['val'] + 0.5)
            # Update severity to the highest seen if applicable (simple string fallback)
            if a.severity == 'critical': nodes_dict[cat_id]['severity'] = 'critical'
            
        # IP -> Category Link
        if not any(l['source'] == a.source_ip and l['target'] == cat_id for l in links):
            links.append({'source': a.source_ip, 'target': cat_id, 'value': 1})
            
        # Category -> System Link
        if not any(l['source'] == cat_id and l['target'] == 'AegisCore' for l in links):
            links.append({'source': cat_id, 'target': 'AegisCore', 'value': 2})
            
    return jsonify({
        'nodes': list(nodes_dict.values()),
        'links': links
    })


@threat_bp.route('/heatmap', methods=['GET'])
@jwt_required()
def get_heatmap():
    """Returns daily threat counts for the calendar heatmap"""
    from sqlalchemy import func
    from datetime import datetime, timedelta
    
    # SQLite friendly date truncation
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    
    # This works reliably in SQLite and Postgres
    alerts = Alert.query.filter(Alert.timestamp >= thirty_days_ago).all()
    
    daily_counts = {}
    for a in alerts:
        date_str = a.timestamp.strftime('%Y-%m-%d')
        daily_counts[date_str] = daily_counts.get(date_str, 0) + 1
        
    data = [{'date': date, 'count': count} for date, count in daily_counts.items()]
    return jsonify(data)
