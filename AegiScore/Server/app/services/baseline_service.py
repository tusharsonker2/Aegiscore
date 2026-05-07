"""AegisCore — Baseline & Anomaly Detection Service"""
import json
import logging
from datetime import datetime, timedelta
from app.models.db import db, Baseline, Alert

logger = logging.getLogger(__name__)

class BaselineService:
    @staticmethod
    def recompute_baselines():
        """
        Scheduled job to recalculate historical baselines from logs.
        In a real prod system, this would query Elasticsearch or raw logs.
        Here we will mock baseline features for known IPs based on past Alerts.
        """
        logger.info("Starting nightly baseline recomputation...")
        
        # Get all unique IPs from recent alerts
        last_month = datetime.utcnow() - timedelta(days=30)
        recent_alerts = Alert.query.filter(Alert.timestamp >= last_month).all()
        
        ip_stats = {}
        for alert in recent_alerts:
            ip = alert.source_ip
            if not ip: continue
            if ip not in ip_stats:
                ip_stats[ip] = {'count': 0, 'severity_sum': 0}
            ip_stats[ip]['count'] += alert.occurrence_count
            
            # Rough severity score for baseline
            sev_score = {'low': 1, 'medium': 2, 'high': 3, 'critical': 5}.get(alert.severity, 1)
            ip_stats[ip]['severity_sum'] += sev_score
        
        for ip, stats in ip_stats.items():
            avg_daily_events = stats['count'] / 30.0
            avg_severity = stats['severity_sum'] / float(stats['count'])
            
            features = {
                'avg_daily_events': avg_daily_events,
                'avg_severity': avg_severity
            }
            
            baseline = Baseline.query.filter_by(entity_type='ip', entity_id=ip).first()
            if not baseline:
                baseline = Baseline(entity_type='ip', entity_id=ip)
                db.session.add(baseline)
            
            baseline.features = json.dumps(features)
        
        db.session.commit()
        logger.info(f"Recomputed baselines for {len(ip_stats)} entities.")

    @staticmethod
    def check_anomaly(ip: str, current_features: dict) -> bool:
        """
        Compares current features against baseline to flag huge deviations.
        Returns True if anomaly is detected (e.g. deviation > 2 standard devs).
        """
        baseline = Baseline.query.filter_by(entity_type='ip', entity_id=ip).first()
        if not baseline:
            return False # No baseline to compare against
            
        try:
            hist_features = json.loads(baseline.features)
            avg_daily = hist_features.get('avg_daily_events', 0)
            
            # If current traffic (simulated via features) is drastically higher than average daily traffic
            current_count = current_features.get('event_count', 0)
            if avg_daily > 0 and current_count > (avg_daily * 3): # Arbitrary threshold simulating 2 std devs
                return True
        except Exception as e:
            logger.error(f"Error checking anomaly for {ip}: {e}")
            
        return False
