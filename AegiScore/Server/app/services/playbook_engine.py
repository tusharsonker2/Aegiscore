"""AegisCore — Playbook Automation Engine (SOAR-lite)"""
import logging
import requests
from datetime import datetime
from app.models.db import db, Alert, Incident, Notification, User
from extensions import socketio

logger = logging.getLogger(__name__)

# ── Built-in Playbook Definitions ─────────────────────────────────────────────
DEFAULT_PLAYBOOKS = [
    {
        "id": "pb_critical_incident",
        "name": "Auto-Create Incident for Critical Alerts",
        "enabled": True,
        "trigger": {"severity": "critical"},
        "actions": ["create_incident", "send_notification"]
    },
    {
        "id": "pb_dos_block",
        "name": "Flag DoS Campaign for Review",
        "enabled": True,
        "trigger": {"threat_type": "DoS"},
        "actions": ["send_notification"]
    },
]


class PlaybookEngine:
    def __init__(self, playbooks=None):
        self.playbooks = playbooks or DEFAULT_PLAYBOOKS

    def run(self, alert: Alert):
        """Evaluate all active playbooks against the incoming alert."""
        for pb in self.playbooks:
            if not pb.get('enabled', True):
                continue
            if self._matches(alert, pb['trigger']):
                logger.info(f"Playbook '{pb['name']}' triggered for alert #{alert.id}")
                self._execute(alert, pb)

    def _matches(self, alert: Alert, trigger: dict) -> bool:
        if 'severity' in trigger and alert.severity != trigger['severity']:
            return False
        if 'threat_type' in trigger and alert.category != trigger['threat_type']:
            return False
        return True

    def _execute(self, alert: Alert, playbook: dict):
        for action in playbook.get('actions', []):
            try:
                if action == 'create_incident':
                    self._action_create_incident(alert, playbook)
                elif action == 'send_notification':
                    self._action_send_notification(alert, playbook)
                elif action == 'send_webhook':
                    self._action_send_webhook(alert, playbook)
            except Exception as e:
                logger.error(f"Playbook action '{action}' failed: {e}")

    def _action_create_incident(self, alert: Alert, playbook: dict):
        if alert.incident_id:
            return  # Already linked

        existing = Incident.query.filter_by(
            title=f"[Auto] {alert.category} from {alert.source_ip}"
        ).filter(Incident.status.in_(['open', 'in_progress'])).first()

        if not existing:
            incident = Incident(
                title=f"[Auto] {alert.category} from {alert.source_ip}",
                description=f"Automatically created by playbook '{playbook['name']}'.\n\nTriggered by Alert #{alert.id}: {alert.description}",
                severity=alert.severity,
                status='open'
            )
            db.session.add(incident)
            db.session.flush()
            alert.incident_id = incident.id
            socketio.emit('new_incident', incident.to_dict())
        else:
            alert.incident_id = existing.id

    def _action_send_notification(self, alert: Alert, playbook: dict):
        admins = User.query.filter(User.role.in_(['admin', 'analyst'])).all()
        for u in admins:
            notif = Notification(
                user_id=u.id,
                title=f"🎯 Playbook: {playbook['name']}",
                message=f"Alert #{alert.id} ({alert.severity.upper()} {alert.category}) triggered playbook '{playbook['name']}'.",
                ntype='playbook'
            )
            db.session.add(notif)
        socketio.emit('new_notification', {
            'title': f"Playbook: {playbook['name']}",
            'message': f"Triggered by Alert #{alert.id}",
            'ntype': 'playbook'
        })

    def _action_send_webhook(self, alert: Alert, playbook: dict):
        from models.db import Webhook
        import hmac, hashlib, json
        webhooks = Webhook.query.filter_by(is_active=True).all()
        payload = {
            'event': 'alert',
            'playbook': playbook['name'],
            'alert': alert.to_dict(),
            'timestamp': datetime.utcnow().isoformat()
        }
        for wh in webhooks:
            if wh.event_filter not in ('all', alert.severity):
                continue
            try:
                body = json.dumps(payload)
                sig = hmac.new(
                    (wh.secret or '').encode(),
                    body.encode(),
                    hashlib.sha256
                ).hexdigest()
                requests.post(
                    wh.url,
                    data=body,
                    headers={
                        'Content-Type': 'application/json',
                        'X-AegisCore-Signature': sig
                    },
                    timeout=5
                )
            except Exception as e:
                logger.warning(f"Webhook to {wh.url} failed: {e}")
