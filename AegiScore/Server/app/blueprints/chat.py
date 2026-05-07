"""AegisCore — Chat Monitoring Service Blueprint"""
import os
import uuid
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.blueprints.auth import require_roles
from app.models.db import db, ChatLog
from app.utils.chat_monitor import classify_message
from extensions import socketio

chat_bp = Blueprint('chat', __name__)


@chat_bp.route('/query', methods=['POST'])
@require_roles('admin', 'analyst')
def agent_query():
    """Standard AI chat query with NLP monitoring."""
    data = request.get_json(silent=True) or {}
    prompt = data.get('prompt', '')
    if not prompt:
        return jsonify({'error': 'No prompt provided'}), 400

    username = get_jwt_identity()

    # ── NLP Threat Classification ─────────────────────────────────────────
    classification = classify_message(prompt)
    chat_entry = ChatLog(
        session_id=data.get('session_id', str(uuid.uuid4())[:8]),
        username=username,
        message=prompt,
        intent=classification['intent'],
        threat_score=classification['threat_score'],
        is_flagged=classification['is_flagged'],
    )
    db.session.add(chat_entry)
    db.session.commit()

    if classification['is_flagged']:
        socketio.emit('chat_threat', chat_entry.to_dict())

    # ── AI Response ──────────────────────────────────────────────────────
    try:
        import sys
        sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
        from utils import AegisBot
        bot = AegisBot()
        result = bot.main_agent(prompt)
        result = result.strip() if result else 'No response generated.'
    except Exception as e:
        result = f'AI processing error: {str(e)}'

    return jsonify({
        'response': result,
        'classification': classification,
    })


@chat_bp.route('/master', methods=['POST'])
@require_roles('admin', 'analyst')
def master_agent():
    """Master multi-agent query with NLP monitoring."""
    data = request.get_json(silent=True) or {}
    query = data.get('query', '')
    if not query:
        return jsonify({'error': 'No query provided'}), 400

    username = get_jwt_identity()
    classification = classify_message(query)

    chat_entry = ChatLog(
        session_id=data.get('session_id', str(uuid.uuid4())[:8]),
        username=username,
        message=query,
        intent=classification['intent'],
        threat_score=classification['threat_score'],
        is_flagged=classification['is_flagged'],
    )
    db.session.add(chat_entry)
    db.session.commit()

    if classification['is_flagged']:
        socketio.emit('chat_threat', chat_entry.to_dict())

    try:
        from app.utils.utils import AegisBot
        bot = AegisBot()
        result = bot.master_agent(query)
        result = result.strip() if result else 'No response generated.'
    except Exception as e:
        result = f'AI processing error: {str(e)}'

    return jsonify({
        'master_response': result,
        'classification': classification,
    })


@chat_bp.route('/flagged', methods=['GET'])
@jwt_required()
def flagged_chats():
    chats = ChatLog.query.filter_by(is_flagged=True)\
        .order_by(ChatLog.timestamp.desc()).limit(100).all()
    return jsonify([c.to_dict() for c in chats])


@chat_bp.route('/analyze', methods=['POST'])
@jwt_required()
def analyze_message():
    """Quick classification without saving — for UI previews."""
    data = request.get_json(silent=True) or {}
    msg = data.get('message', '')
    if not msg:
        return jsonify({'error': 'No message provided'}), 400
    return jsonify(classify_message(msg))
