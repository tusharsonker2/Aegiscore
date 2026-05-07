"""AegisCore — SQLAlchemy Models (Enterprise Edition)"""
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timedelta
import re

db = SQLAlchemy()


# ──────────────────────────────────────────────
# UTILITY
# ──────────────────────────────────────────────

def validate_password_policy(password: str) -> tuple[bool, str]:
    """Enforce enterprise password policy."""
    if len(password) < 12:
        return False, "Password must be at least 12 characters long."
    if not re.search(r'[A-Z]', password):
        return False, "Password must contain at least one uppercase letter."
    if not re.search(r'[0-9]', password):
        return False, "Password must contain at least one number."
    if not re.search(r'[!@#$%^&*(),.?\":{}|<>_\-]', password):
        return False, "Password must contain at least one special character."
    return True, "OK"


# ──────────────────────────────────────────────
# BASELINE (Anomaly Detection)
# ──────────────────────────────────────────────

class Baseline(db.Model):
    __tablename__ = 'baselines'
    id              = db.Column(db.Integer, primary_key=True)
    entity_type     = db.Column(db.String(20), nullable=False) # 'ip' or 'user'
    entity_id       = db.Column(db.String(100), nullable=False)
    features        = db.Column(db.Text, nullable=False) # JSON string of computed averages
    created_at      = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at      = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        import json
        return {
            'id': self.id,
            'entity_type': self.entity_type,
            'entity_id': self.entity_id,
            'features': json.loads(self.features),
            'updated_at': self.updated_at.isoformat()
        }


# ──────────────────────────────────────────────
# USER
# ──────────────────────────────────────────────

class User(db.Model):
    __tablename__ = 'users'
    id                  = db.Column(db.Integer, primary_key=True)
    username            = db.Column(db.String(80),  unique=True, nullable=False)
    email               = db.Column(db.String(120), unique=True, nullable=True)
    password_hash       = db.Column(db.String(255), nullable=False)
    role                = db.Column(db.String(20),  nullable=False, default='viewer')
    created_at          = db.Column(db.DateTime, default=datetime.utcnow)
    is_active           = db.Column(db.Boolean, default=True)
    # MFA
    mfa_enabled         = db.Column(db.Boolean, default=False)
    mfa_secret          = db.Column(db.String(64), nullable=True)
    # Password policy
    password_changed_at = db.Column(db.DateTime, default=datetime.utcnow)
    # Dashboard layout
    dashboard_layout    = db.Column(db.Text, nullable=True)
    # Email digest preferences
    email_digest        = db.Column(db.Boolean, default=True)
    digest_frequency    = db.Column(db.String(20), default='daily')

    sessions   = db.relationship('Session',       backref='user', lazy=True, cascade='all, delete-orphan')
    notes      = db.relationship('AlertNote',     backref='author', lazy=True)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
        self.password_changed_at = datetime.utcnow()

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def is_password_expired(self, days=90):
        if not self.password_changed_at:
            return True
        return (datetime.utcnow() - self.password_changed_at) > timedelta(days=days)

    def to_dict(self):
        return {
            'id':           self.id,
            'username':     self.username,
            'email':        self.email,
            'role':         self.role,
            'created_at':   self.created_at.isoformat(),
            'is_active':    self.is_active,
            'mfa_enabled':  self.mfa_enabled,
            'email_digest': self.email_digest,
            'digest_frequency': self.digest_frequency,
        }


# ──────────────────────────────────────────────
# SESSION TRACKING
# ──────────────────────────────────────────────

class Session(db.Model):
    __tablename__ = 'sessions'
    id          = db.Column(db.Integer, primary_key=True)
    user_id     = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    jti         = db.Column(db.String(255), unique=True, nullable=False)
    ip_address  = db.Column(db.String(50),  nullable=True)
    user_agent  = db.Column(db.String(255), nullable=True)
    created_at  = db.Column(db.DateTime, default=datetime.utcnow)
    expires_at  = db.Column(db.DateTime, nullable=True)
    is_active   = db.Column(db.Boolean, default=True)

    def to_dict(self):
        return {
            'id':         self.id,
            'jti':        self.jti,
            'ip_address': self.ip_address,
            'user_agent': self.user_agent,
            'created_at': self.created_at.isoformat(),
            'expires_at': self.expires_at.isoformat() if self.expires_at else None,
            'is_active':  self.is_active,
        }


# ──────────────────────────────────────────────
# ALERT
# ──────────────────────────────────────────────

class Alert(db.Model):
    __tablename__ = 'alerts'
    id               = db.Column(db.Integer, primary_key=True)
    timestamp        = db.Column(db.DateTime, default=datetime.utcnow)
    severity         = db.Column(db.String(20), nullable=False)
    category         = db.Column(db.String(50), nullable=False)
    description      = db.Column(db.Text, nullable=False)
    source_ip        = db.Column(db.String(50), nullable=True)
    status           = db.Column(db.String(20), default='open')
    occurrence_count = db.Column(db.Integer, default=1)
    # MITRE ATT&CK
    mitre_technique  = db.Column(db.String(20), nullable=True)
    mitre_tactic     = db.Column(db.String(80), nullable=True)
    # Enrichment
    abuse_score      = db.Column(db.Integer, nullable=True)
    geo_country      = db.Column(db.String(80), nullable=True)
    geo_isp          = db.Column(db.String(120), nullable=True)
    geo_lat          = db.Column(db.Float, nullable=True)
    geo_lon          = db.Column(db.Float, nullable=True)
    # Incident link
    incident_id      = db.Column(db.Integer, db.ForeignKey('incidents.id'), nullable=True)
    # Escalation
    acknowledged_at  = db.Column(db.DateTime, nullable=True)

    feedback = db.relationship('Feedback',   backref='alert', lazy=True, cascade='all, delete-orphan')
    notes    = db.relationship('AlertNote',  backref='alert', lazy=True, cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id':              self.id,
            'timestamp':       self.timestamp.isoformat(),
            'severity':        self.severity,
            'category':        self.category,
            'description':     self.description,
            'source_ip':       self.source_ip,
            'status':          self.status,
            'occurrence_count': self.occurrence_count,
            'mitre_technique': self.mitre_technique,
            'mitre_tactic':    self.mitre_tactic,
            'abuse_score':     self.abuse_score,
            'geo_country':     self.geo_country,
            'geo_lat':         self.geo_lat,
            'geo_lon':         self.geo_lon,
            'incident_id':     self.incident_id,
        }


# ──────────────────────────────────────────────
# FEEDBACK (False-Positive tracking)
# ──────────────────────────────────────────────

class Feedback(db.Model):
    __tablename__ = 'feedback'
    id          = db.Column(db.Integer, primary_key=True)
    alert_id    = db.Column(db.Integer, db.ForeignKey('alerts.id'), nullable=False)
    analyst_id  = db.Column(db.Integer, db.ForeignKey('users.id'),  nullable=False)
    verdict     = db.Column(db.String(10), nullable=False)   # 'TP' or 'FP'
    notes       = db.Column(db.Text, nullable=True)
    created_at  = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id':        self.id,
            'alert_id':  self.alert_id,
            'analyst_id': self.analyst_id,
            'verdict':   self.verdict,
            'notes':     self.notes,
            'created_at': self.created_at.isoformat(),
        }


# ──────────────────────────────────────────────
# ALERT NOTES
# ──────────────────────────────────────────────

class AlertNote(db.Model):
    __tablename__ = 'alert_notes'
    id         = db.Column(db.Integer, primary_key=True)
    alert_id   = db.Column(db.Integer, db.ForeignKey('alerts.id'),  nullable=False)
    author_id  = db.Column(db.Integer, db.ForeignKey('users.id'),   nullable=False)
    content    = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id':        self.id,
            'alert_id':  self.alert_id,
            'author':    self.author.username if self.author else 'Unknown',
            'content':   self.content,
            'created_at': self.created_at.isoformat(),
        }


# ──────────────────────────────────────────────
# INCIDENT
# ──────────────────────────────────────────────

class Incident(db.Model):
    __tablename__ = 'incidents'
    id               = db.Column(db.Integer, primary_key=True)
    title            = db.Column(db.String(200), nullable=False)
    description      = db.Column(db.Text, nullable=True)
    severity         = db.Column(db.String(20), nullable=False, default='medium')
    status           = db.Column(db.String(20), nullable=False, default='open')
    assigned_to      = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    resolution_notes = db.Column(db.Text, nullable=True)
    created_at       = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at       = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    alerts = db.relationship('Alert', backref='incident', lazy=True)

    def to_dict(self):
        return {
            'id':               self.id,
            'title':            self.title,
            'description':      self.description,
            'severity':         self.severity,
            'status':           self.status,
            'assigned_to':      self.assigned_to,
            'resolution_notes': self.resolution_notes,
            'created_at':       self.created_at.isoformat(),
            'updated_at':       self.updated_at.isoformat(),
            'alert_count':      len(self.alerts),
        }


# ──────────────────────────────────────────────
# NOTIFICATION
# ──────────────────────────────────────────────

class Notification(db.Model):
    __tablename__ = 'notifications'
    id          = db.Column(db.Integer, primary_key=True)
    user_id     = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    title       = db.Column(db.String(200), nullable=False)
    message     = db.Column(db.Text, nullable=False)
    ntype       = db.Column(db.String(50), default='info')  # critical, incident, report, playbook
    is_read     = db.Column(db.Boolean, default=False)
    created_at  = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id':         self.id,
            'user_id':    self.user_id,
            'title':      self.title,
            'message':    self.message,
            'ntype':      self.ntype,
            'is_read':    self.is_read,
            'created_at': self.created_at.isoformat(),
        }


# ──────────────────────────────────────────────
# AUDIT REPORT
# ──────────────────────────────────────────────

class AuditReport(db.Model):
    __tablename__ = 'audit_reports'
    id           = db.Column(db.Integer, primary_key=True)
    title        = db.Column(db.String(200), nullable=False)
    content      = db.Column(db.Text, nullable=False)
    generated_by = db.Column(db.String(80), nullable=True)
    created_at   = db.Column(db.DateTime, default=datetime.utcnow)
    report_type  = db.Column(db.String(50), default='general')

    def to_dict(self):
        return {
            'id':           self.id,
            'title':        self.title,
            'generated_by': self.generated_by,
            'created_at':   self.created_at.isoformat(),
            'report_type':  self.report_type,
        }


# ──────────────────────────────────────────────
# CHAT LOG
# ──────────────────────────────────────────────

class ChatLog(db.Model):
    __tablename__ = 'chat_logs'
    id           = db.Column(db.Integer, primary_key=True)
    session_id   = db.Column(db.String(50), nullable=False)
    timestamp    = db.Column(db.DateTime,   default=datetime.utcnow)
    username     = db.Column(db.String(80), nullable=False)
    message      = db.Column(db.Text, nullable=False)
    intent       = db.Column(db.String(50), nullable=True)
    threat_score = db.Column(db.Float, nullable=True)
    is_flagged   = db.Column(db.Boolean, default=False)

    def to_dict(self):
        return {
            'id':           self.id,
            'session_id':   self.session_id,
            'timestamp':    self.timestamp.isoformat(),
            'username':     self.username,
            'message':      self.message,
            'intent':       self.intent,
            'threat_score': self.threat_score,
            'is_flagged':   self.is_flagged,
        }


# ──────────────────────────────────────────────
# INTERNAL AUDIT LOG
# ──────────────────────────────────────────────

class InternalAuditLog(db.Model):
    __tablename__ = 'internal_audit_log'
    id              = db.Column(db.Integer, primary_key=True)
    user_id         = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    username        = db.Column(db.String(80), nullable=True)
    action          = db.Column(db.String(100), nullable=False)
    target_resource = db.Column(db.String(200), nullable=True)
    ip_address      = db.Column(db.String(50), nullable=True)
    timestamp       = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id':              self.id,
            'user_id':         self.user_id,
            'username':        self.username,
            'action':          self.action,
            'target_resource': self.target_resource,
            'ip_address':      self.ip_address,
            'timestamp':       self.timestamp.isoformat(),
        }


# ──────────────────────────────────────────────
# WEBHOOK
# ──────────────────────────────────────────────

class Webhook(db.Model):
    __tablename__ = 'webhooks'
    id           = db.Column(db.Integer, primary_key=True)
    name         = db.Column(db.String(100), nullable=False)
    url          = db.Column(db.String(500), nullable=False)
    secret       = db.Column(db.String(255), nullable=True)
    event_filter = db.Column(db.String(50), default='critical')  # 'all', 'critical', 'high'
    is_active    = db.Column(db.Boolean, default=True)
    created_at   = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id':           self.id,
            'name':         self.name,
            'url':          self.url,
            'event_filter': self.event_filter,
            'is_active':    self.is_active,
            'created_at':   self.created_at.isoformat(),
        }


# ──────────────────────────────────────────────
# SEED DATA
# ──────────────────────────────────────────────

def seed_default_users():
    """Seed default accounts on first startup."""
    defaults = [
        ('admin',   'admin@aegiscore.io',   'AegisCore@2025!', 'admin'),
        ('analyst', 'analyst@aegiscore.io', 'Analyst@2025!',   'analyst'),
        ('viewer',  'viewer@aegiscore.io',  'Viewer@2025!A',   'viewer'),
    ]
    for username, email, password, role in defaults:
        if not User.query.filter_by(username=username).first():
            u = User(username=username, email=email, role=role)
            u.set_password(password)
            db.session.add(u)
    db.session.commit()
