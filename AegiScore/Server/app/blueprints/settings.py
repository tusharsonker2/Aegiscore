"""AegisCore — Settings & Configuration Blueprint"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models.db import db, Webhook, User
from app.blueprints.auth import require_roles
from app.services.playbook_engine import DEFAULT_PLAYBOOKS

settings_bp = Blueprint('settings', __name__)

# ── Webhooks ──────────────────────────────────────────────────────────────────

@settings_bp.route('/webhooks', methods=['GET'])
@jwt_required()
@require_roles('admin')
def get_webhooks():
    webhooks = Webhook.query.all()
    return jsonify([wh.to_dict() for wh in webhooks])

@settings_bp.route('/webhooks', methods=['POST'])
@jwt_required()
@require_roles('admin')
def create_webhook():
    data = request.get_json() or {}
    
    if not data.get('name') or not data.get('url'):
        return jsonify({'error': 'Name and URL are required'}), 400
        
    wh = Webhook(
        name=data['name'],
        url=data['url'],
        secret=data.get('secret', ''),
        event_filter=data.get('event_filter', 'critical')
    )
    db.session.add(wh)
    db.session.commit()
    return jsonify(wh.to_dict()), 201

@settings_bp.route('/webhooks/<int:webhook_id>', methods=['DELETE'])
@jwt_required()
@require_roles('admin')
def delete_webhook(webhook_id):
    wh = Webhook.query.get_or_404(webhook_id)
    db.session.delete(wh)
    db.session.commit()
    return jsonify({'message': 'Webhook deleted successfully'})

# ── Playbooks ─────────────────────────────────────────────────────────────────

@settings_bp.route('/playbooks', methods=['GET'])
@jwt_required()
@require_roles('admin', 'analyst')
def get_playbooks():
    # Return the static definitions for now. In a full production system, 
    # these might be stored in a Playbook table in the database.
    return jsonify(DEFAULT_PLAYBOOKS)
