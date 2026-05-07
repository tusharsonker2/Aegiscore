"""AegisCore — Shared extensions (avoids circular imports)"""
from flask_socketio import SocketIO
from flask_jwt_extended import JWTManager
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

import os

socketio = SocketIO()
jwt = JWTManager()
redis_url = os.getenv('REDIS_URL', 'memory://')
limiter = Limiter(key_func=get_remote_address, storage_uri=redis_url)

@jwt.token_in_blocklist_loader
def check_if_token_revoked(jwt_header, jwt_payload: dict) -> bool:
    """Check if a JWT is in our active sessions table."""
    jti = jwt_payload["jti"]
    from app.models.db import Session
    session = Session.query.filter_by(jti=jti).first()
    if session and session.is_active:
        return False
    return True
