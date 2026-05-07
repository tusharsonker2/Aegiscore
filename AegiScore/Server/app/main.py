"""AegisCore — Application Factory"""
import os
from flask import Flask, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from app.models.db import db, seed_default_users
from extensions import socketio, jwt, limiter
from apscheduler.schedulers.background import BackgroundScheduler
from app.services.baseline_service import BaselineService
import logging
from logging.handlers import RotatingFileHandler

def setup_logging():
    log_formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    
    os.makedirs('data', exist_ok=True)
    file_handler = RotatingFileHandler('data/aegiscore.log', maxBytes=10*1024*1024, backupCount=5)
    file_handler.setFormatter(log_formatter)
    file_handler.setLevel(logging.INFO)
    
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(log_formatter)
    console_handler.setLevel(logging.INFO)
    
    logger = logging.getLogger()
    logger.setLevel(logging.INFO)
    logger.addHandler(file_handler)
    logger.addHandler(console_handler)

def create_app():
    load_dotenv(dotenv_path='.env')
    setup_logging()
    app = Flask(__name__)

    # ── Config ──────────────────────────────────────────────────────────────
    app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'aegiscore-dev-secret-key')
    app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY', 'aegiscore-jwt-secret-key')
    app.config['JWT_ACCESS_TOKEN_EXPIRES'] = 900
    app.config['JWT_REFRESH_TOKEN_EXPIRES'] = 604800
    app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'sqlite:///aegiscore.db')
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    # ── Extensions ───────────────────────────────────────────────────────────
    CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=True)
    db.init_app(app)
    jwt.init_app(app)
    socketio.init_app(app, cors_allowed_origins="*", async_mode='threading')
    limiter.init_app(app)

    # ── Blueprints ───────────────────────────────────────────────────────────
    from app.blueprints.auth import auth_bp
    from app.blueprints.logs import logs_bp
    from app.blueprints.threat import threat_bp
    from app.blueprints.audit import audit_bp
    from app.blueprints.chat import chat_bp
    from app.blueprints.incidents import incidents_bp
    from app.blueprints.settings import settings_bp

    app.register_blueprint(auth_bp,      url_prefix='/api/auth')
    app.register_blueprint(logs_bp,      url_prefix='/api/logs')
    app.register_blueprint(threat_bp,    url_prefix='/api/threat')
    app.register_blueprint(audit_bp,     url_prefix='/api/audit')
    app.register_blueprint(chat_bp,      url_prefix='/api/chat')
    app.register_blueprint(incidents_bp, url_prefix='/api/incidents')
    app.register_blueprint(settings_bp,  url_prefix='/api/settings')

    # ── Health ───────────────────────────────────────────────────────────────
    @app.route('/health')
    def health():
        return jsonify({'status': 'ok', 'service': 'AegisCore API', 'version': '2.0.0'})

    # ── DB Init & Seed ────────────────────────────────────────────────────────
    with app.app_context():
        db.create_all()
        seed_default_users()
        
    # ── Scheduled Jobs ────────────────────────────────────────────────────────
    scheduler = BackgroundScheduler()
    # Run every night at 2:00 AM
    scheduler.add_job(func=BaselineService.recompute_baselines, trigger="cron", hour=2, minute=0)
    
    # Check for unacknowledged critical alerts every 5 minutes
    def run_escalation_check():
        with app.app_context():
            from app.blueprints.incidents import perform_escalation_check
            perform_escalation_check()
            
    scheduler.add_job(func=run_escalation_check, trigger="interval", minutes=5)
    scheduler.start()

    return app


if __name__ == '__main__':
    app = create_app()
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)
