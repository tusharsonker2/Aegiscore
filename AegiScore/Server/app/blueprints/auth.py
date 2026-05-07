"""AegisCore — Auth Blueprint (JWT, MFA, RBAC, Sessions)"""
import io
import base64
import pyotp
import qrcode
from functools import wraps
from datetime import datetime, timedelta

from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    create_access_token, create_refresh_token,
    jwt_required, get_jwt_identity,
    verify_jwt_in_request, decode_token, get_jwt
)
from app.models.db import db, User, Session, validate_password_policy

auth_bp = Blueprint('auth', __name__)

# ── RBAC decorator ────────────────────────────────────────────────────────────
def require_roles(*roles):
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            username = get_jwt_identity()
            user = User.query.filter_by(username=username, is_active=True).first()
            if not user or user.role not in roles:
                return jsonify({'error': 'Insufficient permissions'}), 403
            return f(*args, **kwargs)
        return wrapper
    return decorator

# ── Helper: Create Session ───────────────────────────────────────────────────
def create_user_session(user, access_token):
    jti = decode_token(access_token)['jti']
    exp = datetime.fromtimestamp(decode_token(access_token)['exp'])
    ip = request.headers.get('X-Forwarded-For', request.remote_addr)
    user_agent = request.headers.get('User-Agent', '')[:255]
    
    new_session = Session(
        user_id=user.id,
        jti=jti,
        ip_address=ip,
        user_agent=user_agent,
        expires_at=exp
    )
    db.session.add(new_session)
    db.session.commit()

# ── Standard Auth Routes ──────────────────────────────────────────────────────
@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({'error': 'Username and password required'}), 400

    user = User.query.filter_by(username=username, is_active=True).first()
    if not user or not user.check_password(password):
        return jsonify({'error': 'Invalid credentials'}), 401

    if user.is_password_expired():
        return jsonify({'status': 'forced_reset_required', 'username': username}), 403

    if user.mfa_enabled:
        # Create a short-lived temp token just for the MFA step
        temp_token = create_access_token(identity=user.username, expires_delta=timedelta(minutes=5))
        return jsonify({
            'status': 'mfa_required',
            'mfa_token': temp_token
        })

    # Normal login
    access_token  = create_access_token(identity=user.username)
    refresh_token = create_refresh_token(identity=user.username)
    create_user_session(user, access_token)

    return jsonify({
        'status': 'success',
        'access_token':  access_token,
        'refresh_token': refresh_token,
        'user': user.to_dict(),
    })

@auth_bp.route('/login/mfa', methods=['POST'])
@jwt_required()
def login_mfa():
    """Step 2 of MFA login"""
    data = request.get_json() or {}
    otp = data.get('otp')
    username = get_jwt_identity()

    user = User.query.filter_by(username=username, is_active=True).first()
    if not user or not user.mfa_enabled:
        return jsonify({'error': 'Invalid request'}), 400

    totp = pyotp.TOTP(user.mfa_secret)
    if not totp.verify(otp):
        return jsonify({'error': 'Invalid OTP'}), 401

    access_token  = create_access_token(identity=user.username)
    refresh_token = create_refresh_token(identity=user.username)
    create_user_session(user, access_token)

    return jsonify({
        'status': 'success',
        'access_token':  access_token,
        'refresh_token': refresh_token,
        'user': user.to_dict(),
    })

@auth_bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    username = get_jwt_identity()
    user = User.query.filter_by(username=username, is_active=True).first()
    if not user:
        return jsonify({'error': 'User disabled'}), 401
    
    access_token = create_access_token(identity=username)
    create_user_session(user, access_token)
    return jsonify({'access_token': access_token})

@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def me():
    username = get_jwt_identity()
    user = User.query.filter_by(username=username).first()
    if not user:
        return jsonify({'error': 'User not found'}), 404
    return jsonify(user.to_dict())

# ── Password Management ───────────────────────────────────────────────────────
@auth_bp.route('/password/force-reset', methods=['POST'])
def force_password_reset():
    """Endpoint for users forced to reset password on login"""
    data = request.get_json() or {}
    username = data.get('username')
    old_password = data.get('old_password')
    new_password = data.get('new_password')

    user = User.query.filter_by(username=username, is_active=True).first()
    if not user or not user.check_password(old_password):
        return jsonify({'error': 'Invalid credentials'}), 401

    valid, msg = validate_password_policy(new_password)
    if not valid:
        return jsonify({'error': msg}), 400

    user.set_password(new_password)
    db.session.commit()
    return jsonify({'message': 'Password updated successfully. Please log in.'})


@auth_bp.route('/users', methods=['POST'])
@require_roles('admin')
def create_user():
    data = request.get_json()
    if User.query.filter_by(username=data['username']).first():
        return jsonify({'error': 'Username already exists'}), 409
        
    valid, msg = validate_password_policy(data['password'])
    if not valid:
        return jsonify({'error': msg}), 400

    user = User(
        username=data['username'],
        email=data.get('email'),
        role=data.get('role', 'viewer'),
    )
    user.set_password(data['password'])
    db.session.add(user)
    db.session.commit()
    return jsonify(user.to_dict()), 201

# ── MFA Management ────────────────────────────────────────────────────────────
@auth_bp.route('/mfa/setup', methods=['POST'])
@jwt_required()
def mfa_setup():
    """Generates a new TOTP secret and returns QR code for the user"""
    username = get_jwt_identity()
    user = User.query.filter_by(username=username).first()
    
    # Generate new secret
    secret = pyotp.random_base32()
    user.mfa_secret = secret
    db.session.commit()

    # Generate QR Code
    totp_uri = pyotp.totp.TOTP(secret).provisioning_uri(name=user.email or user.username, issuer_name="AegisCore")
    img = qrcode.make(totp_uri)
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    qr_b64 = base64.b64encode(buf.getvalue()).decode('utf-8')

    return jsonify({'qr_code': f'data:image/png;base64,{qr_b64}', 'secret': secret})

@auth_bp.route('/mfa/verify', methods=['POST'])
@jwt_required()
def mfa_verify():
    """Verifies TOTP to enable MFA"""
    username = get_jwt_identity()
    user = User.query.filter_by(username=username).first()
    
    otp = request.json.get('otp')
    if not otp or not user.mfa_secret:
        return jsonify({'error': 'Invalid request'}), 400

    totp = pyotp.TOTP(user.mfa_secret)
    if totp.verify(otp):
        user.mfa_enabled = True
        db.session.commit()
        return jsonify({'message': 'MFA successfully enabled'})
    return jsonify({'error': 'Invalid OTP'}), 400

# ── Session Management ────────────────────────────────────────────────────────
@auth_bp.route('/sessions', methods=['GET'])
@jwt_required()
def list_sessions():
    username = get_jwt_identity()
    user = User.query.filter_by(username=username).first()
    sessions = Session.query.filter_by(user_id=user.id, is_active=True).order_by(Session.created_at.desc()).all()
    return jsonify([s.to_dict() for s in sessions])

@auth_bp.route('/sessions/<int:session_id>', methods=['DELETE'])
@jwt_required()
def revoke_session(session_id):
    username = get_jwt_identity()
    user = User.query.filter_by(username=username).first()
    
    # Optional: ensure user is admin OR the owner of the session
    session = Session.query.filter_by(id=session_id).first()
    if not session:
        return jsonify({'error': 'Not found'}), 404
        
    if session.user_id != user.id and user.role != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403

    session.is_active = False
    db.session.commit()
    return jsonify({'message': 'Session revoked'})

# ── SSO Stub ──────────────────────────────────────────────────────────────────
@auth_bp.route('/oauth/login', methods=['GET'])
def oauth_login():
    """Stub endpoint for OAuth initiation"""
    return jsonify({'error': 'SSO is not fully configured. Contact Administrator.'}), 501

@auth_bp.route('/oauth/callback', methods=['GET'])
def oauth_callback():
    """Stub endpoint for OAuth callback"""
    return jsonify({'error': 'SSO is not fully configured.'}), 501


@auth_bp.route('/profile/layout', methods=['PATCH'])
@jwt_required()
def save_layout():
    import json
    username = get_jwt_identity()
    user = User.query.filter_by(username=username).first()
    data = request.get_json()
    if 'layout' in data:
        user.dashboard_layout = json.dumps(data['layout'])
        db.session.commit()
        return jsonify({'message': 'Layout saved successfully'})
    return jsonify({'error': 'No layout provided'}), 400
