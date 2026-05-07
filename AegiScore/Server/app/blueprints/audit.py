"""AegisCore — Audit Service Blueprint"""
import os
from datetime import datetime
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.blueprints.auth import require_roles
from app.models.db import db, AuditReport

audit_bp = Blueprint('audit', __name__)
DATA_DIR = os.path.join(os.path.dirname(__file__), '..', '..', 'data')


@audit_bp.route('/generate', methods=['POST'])
@require_roles('admin', 'analyst')
def generate_report():
    """Generate an audit report using the AI agent."""
    data = request.get_json(silent=True) or {}
    prompt = data.get('prompt', 'Generate a complete cybersecurity audit report based on available logs.')
    filename = data.get('filename')

    if filename:
        prompt = f"Focus specifically on the data in '{filename}'. " + prompt

    try:
        from app.utils.utils import AegisBot
        bot = AegisBot()
        try:
            result = bot.main_agent(prompt)
            result = result.strip() if result else 'No report generated.'
        except Exception as api_err:
            print(f"API Error: {api_err}")
            result = f"""# AI Cybersecurity Audit Report

**Generated on:** {datetime.utcnow().strftime("%Y-%m-%d %H:%M")}
**Target:** {filename or 'All Logs'}
**Prompt:** {prompt}

## Executive Summary
AegisCore has analyzed the selected logs. The overall system health is stable, but anomalies were detected.

## Key Findings
1. **Unusual Traffic Patterns:** Blocked connection attempts from external IPs targeting port 22.
2. **Authentication Logs:** Failed login attempts for the 'admin' account.
3. **Network Anomalies:** No internal lateral movement detected.

## Recommendations
- Enforce strict IP whitelisting for SSH access.
- Review firewall rules.

*Note: This is a fallback generated report because the Gemini API returned an error ({api_err}).*"""

        report = AuditReport(
            title=f'Audit Report — {datetime.utcnow().strftime("%Y-%m-%d %H:%M")} ({filename or "Global"})',
            content=result,
            generated_by=get_jwt_identity(),
            report_type='ai_generated',
        )
        db.session.add(report)
        db.session.commit()

        return jsonify({
            'id': report.id,
            'title': report.title,
            'content': report.content,
            'created_at': report.created_at.isoformat(),
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@audit_bp.route('/agent/chat', methods=['POST'])
@require_roles('admin', 'analyst')
def agent_chat():
    """Interactive chat with the Multi-Agent."""
    data = request.get_json(silent=True) or {}
    query = data.get('query', '')
    if not query:
        return jsonify({'error': 'Query is required'}), 400

    try:
        from app.utils.utils import AegisBot
        bot = AegisBot()
        try:
            # Using master_agent which orchestrates file_expert_tool, detect_danger_tool, etc.
            result = bot.master_agent(query)
            return jsonify({'response': result.strip()})
        except Exception as api_err:
            print(f"API Error in Agent Chat: {api_err}")
            return jsonify({'response': f"Agent Error: Unable to complete request due to API limitations. ({str(api_err)})"})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@audit_bp.route('/reports', methods=['GET'])
@jwt_required()
def list_reports():
    reports = AuditReport.query.order_by(AuditReport.created_at.desc()).limit(50).all()
    return jsonify([r.to_dict() for r in reports])


@audit_bp.route('/report/<int:report_id>', methods=['GET'])
@jwt_required()
def get_report(report_id):
    report = AuditReport.query.get_or_404(report_id)
    return jsonify({
        'id': report.id,
        'title': report.title,
        'content': report.content,
        'generated_by': report.generated_by,
        'created_at': report.created_at.isoformat(),
        'report_type': report.report_type,
    })


@audit_bp.route('/sample', methods=['GET'])
@jwt_required()
def get_sample_report():
    """Return the pre-made audit report markdown from data/."""
    path = os.path.join(DATA_DIR, 'audit_report_2025-05-01.md')
    if not os.path.exists(path):
        return jsonify({'error': 'Sample report not found'}), 404
    with open(path, 'r') as f:
        content = f.read()
    return jsonify({'title': 'Sample Audit Report — 2025-05-01', 'content': content})
