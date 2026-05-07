"""AegisCore — Incidents & Case Management Blueprint"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime, timedelta
from app.models.db import db, Incident, Alert, User, Notification
from extensions import socketio

incidents_bp = Blueprint('incidents', __name__)


def _notify_users(title, message, ntype='incident'):
    """Emit a notification to all active analyst/admin users."""
    admins = User.query.filter(User.role.in_(['admin', 'analyst'])).all()
    for u in admins:
        notif = Notification(user_id=u.id, title=title, message=message, ntype=ntype)
        db.session.add(notif)
    db.session.flush()
    socketio.emit('new_notification', {'title': title, 'message': message, 'ntype': ntype})


# ── List / Create ─────────────────────────────────────────────────────────────
@incidents_bp.route('', methods=['GET'])
@jwt_required()
def list_incidents():
    status = request.args.get('status')
    q = Incident.query.order_by(Incident.created_at.desc())
    if status:
        q = q.filter_by(status=status)
    return jsonify([i.to_dict() for i in q.limit(200).all()])


@incidents_bp.route('', methods=['POST'])
@jwt_required()
def create_incident():
    data = request.get_json() or {}
    username = get_jwt_identity()
    user = User.query.filter_by(username=username).first()

    if not data.get('title'):
        return jsonify({'error': 'Title is required'}), 400

    incident = Incident(
        title=data['title'],
        description=data.get('description'),
        severity=data.get('severity', 'medium'),
        status='open',
        assigned_to=data.get('assigned_to'),
    )
    db.session.add(incident)
    db.session.flush()

    # Link alerts if provided
    for alert_id in data.get('alert_ids', []):
        alert = Alert.query.get(alert_id)
        if alert:
            alert.incident_id = incident.id

    _notify_users(
        f'New Incident: {incident.title}',
        f'Severity: {incident.severity} | Created by: {username}',
        ntype='incident'
    )
    db.session.commit()
    return jsonify(incident.to_dict()), 201


# ── Get / Update / Delete ─────────────────────────────────────────────────────
@incidents_bp.route('/<int:incident_id>', methods=['GET'])
@jwt_required()
def get_incident(incident_id):
    inc = Incident.query.get_or_404(incident_id)
    d = inc.to_dict()
    d['alerts'] = [a.to_dict() for a in inc.alerts]
    return jsonify(d)


@incidents_bp.route('/<int:incident_id>', methods=['PATCH'])
@jwt_required()
def update_incident(incident_id):
    inc = Incident.query.get_or_404(incident_id)
    data = request.get_json() or {}

    old_status = inc.status

    if 'title'            in data: inc.title            = data['title']
    if 'description'      in data: inc.description      = data['description']
    if 'severity'         in data: inc.severity         = data['severity']
    if 'status'           in data: inc.status           = data['status']
    if 'assigned_to'      in data: inc.assigned_to      = data['assigned_to']
    if 'resolution_notes' in data: inc.resolution_notes = data['resolution_notes']

    inc.updated_at = datetime.utcnow()

    if data.get('status') == 'resolved' and old_status != 'resolved':
        _notify_users(
            f'Incident Resolved: {inc.title}',
            f'Incident #{inc.id} has been marked as resolved.',
            ntype='incident'
        )

    db.session.commit()
    socketio.emit('incident_updated', inc.to_dict())
    return jsonify(inc.to_dict())


@incidents_bp.route('/<int:incident_id>', methods=['DELETE'])
@jwt_required()
def delete_incident(incident_id):
    inc = Incident.query.get_or_404(incident_id)
    # Unlink alerts before deleting
    for a in inc.alerts:
        a.incident_id = None
    db.session.delete(inc)
    db.session.commit()
    return jsonify({'message': 'Incident deleted'})


def perform_escalation_check():
    """Core logic for finding and escalating critical unacknowledged alerts."""
    threshold = datetime.utcnow() - timedelta(minutes=15)
    unacked = Alert.query.filter(
        Alert.severity == 'critical',
        Alert.acknowledged_at == None,
        Alert.timestamp <= threshold
    ).all()

    escalated = []
    for alert in unacked:
        alert.severity = 'critical'
        alert.description = f'[ESCALATED] {alert.description}'
        alert.acknowledged_at = datetime.utcnow()

        _notify_users(
            f'🚨 ESCALATED: {alert.category}',
            f'Alert #{alert.id} from {alert.source_ip} was unacknowledged for 15+ minutes.',
            ntype='critical'
        )
        escalated.append(alert.id)

    db.session.commit()
    return escalated

@incidents_bp.route('/check-escalations', methods=['POST'])
@jwt_required()
def check_escalations_route():
    """API route to trigger escalation check."""
    escalated = perform_escalation_check()
    return jsonify({'escalated_count': len(escalated), 'escalated_ids': escalated})
