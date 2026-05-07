"""
AegisCore NLP Chat Monitor
Dual-mode classifier:
 1. ML Model (TF-IDF + MLP) - if trained model exists
 2. Rule-based regex fallback - always available
Categories: prompt_injection, social_engineering, reconnaissance, impersonation, normal
"""
import os
import re
import joblib
import logging

logger = logging.getLogger(__name__)

# ── Model Path (in resources alongside weights) ───────────────────────────────
MODEL_PATH = os.path.join(os.path.dirname(__file__), '..', '..', 'resources', 'chat_model.pkl')

try:
    if os.path.exists(MODEL_PATH):
        chat_model = joblib.load(MODEL_PATH)
        logger.info("Loaded chat_model.pkl successfully.")
    else:
        chat_model = None
        logger.warning("chat_model.pkl not found. Using regex fallback classifier.")
except Exception as e:
    chat_model = None
    logger.error(f"Error loading chat model: {e}")


# ── Rule-based regex patterns ─────────────────────────────────────────────────
THREAT_RULES = {
    'prompt_injection': {
        'score': 0.92,
        'patterns': [
            r'ignore\s+(previous|all|prior|above)\s+(instructions?|prompts?|rules?)',
            r'you\s+are\s+now\s+(a|an|acting\s+as)',
            r'pretend\s+(you\s+are|to\s+be)',
            r'disregard\s+(your|all)\s+(training|guidelines|restrictions)',
            r'system\s*:\s*you\s+(are|must|will)',
            r'act\s+as\s+(if|though)\s+(you\s+are|you\'re)',
            r'jailbreak',
            r'bypass\s+(filter|restriction|safety|guard)',
            r'do\s+anything\s+now',
            r'developer\s+mode',
            r'override\s+(safety|policy|rules)',
        ]
    },
    'social_engineering': {
        'score': 0.85,
        'patterns': [
            r'give\s+me\s+(the\s+)?(admin|root|database|db|user)?\s*(password|credentials|token|secret|key)',
            r'what\s+is\s+(the\s+)?(admin|root|database)\s*(password|key|secret)',
            r'share\s+(your\s+)?(credentials|password|access\s+keys?)',
            r'reveal\s+(the\s+)?(configuration|secrets?|api\s*keys?)',
            r'export\s+(all\s+)?(users?|database|data)',
            r'i\s+(am|\'m)\s+(your|the)\s+(developer|admin|superuser|owner)',
            r'urgent(ly)?\s+(need|require|want)\s+access',
            r'send\s+me\s+(all|every|the)\s+(users?|records?|data|logs?)',
        ]
    },
    'reconnaissance': {
        'score': 0.78,
        'patterns': [
            r'list\s+(all\s+)?(users?|admin|accounts?|roles?)',
            r'show\s+(me\s+)?(all\s+)?(users?|table|schema|database|logs?)',
            r'how\s+many\s+(users?|records?|accounts?|entries?)',
            r'what\s+(tables?|columns?|schema|database|version)\s+(do\s+you|are)',
            r'enumerate\s+(users?|roles?|permissions?)',
            r'get\s+all\s+(users?|records?|data)',
            r'select\s+\*\s+from',
            r'union\s+select',
            r'drop\s+table',
            r'(sleep|benchmark|waitfor\s+delay)',
            r'\bor\s+1\s*=\s*1\b',
        ]
    },
    'impersonation': {
        'score': 0.80,
        'patterns': [
            r'i\s+am\s+(an?\s+)?(administrator|admin|manager|supervisor|executive|ceo|cto|ciso)',
            r'this\s+is\s+(the\s+)?(ceo|cto|ciso|director|manager)',
            r'on\s+behalf\s+of\s+(management|leadership|the\s+board)',
            r'calling\s+from\s+(it|security|headquarters|corporate)',
            r'authorized\s+(by|from)\s+(management|the\s+board|leadership)',
            r'official\s+(request|order|directive)\s+from',
        ]
    }
}


def _regex_classify(message: str) -> dict:
    """Rule-based fallback classifier using regex patterns."""
    text = message.lower().strip()
    
    best_intent = 'normal'
    best_score = 0.02  # Low baseline for normal messages

    for intent, rule in THREAT_RULES.items():
        for pattern in rule['patterns']:
            if re.search(pattern, text):
                if rule['score'] > best_score:
                    best_score = rule['score']
                    best_intent = intent
                break  # One match per intent category is enough

    is_flagged = best_intent != 'normal'
    return {
        'intent': best_intent,
        'threat_score': round(best_score, 4),
        'is_flagged': is_flagged,
        'matched_patterns': ['regex_rule_engine'] if is_flagged else ['clean']
    }


def classify_message(message: str) -> dict:
    """
    Classify a chat message for malicious intent.
    Uses ML model if available, falls back to regex engine.
    Returns: { intent, threat_score, is_flagged, matched_patterns }
    """
    if not message or not message.strip():
        return {'intent': 'normal', 'threat_score': 0.0, 'is_flagged': False, 'matched_patterns': []}

    # ── Try ML Model first ────────────────────────────────────────────────────
    if chat_model:
        try:
            preds = chat_model.predict([message])
            probs = chat_model.predict_proba([message])
            intent = preds[0]
            class_index = list(chat_model.classes_).index(intent)
            threat_score = round(float(probs[0][class_index]), 4)
            is_flagged = intent != 'normal'
            if is_flagged and threat_score < 0.7:
                threat_score = 0.75
            if not is_flagged:
                threat_score = min(threat_score, 0.05)
            return {
                'intent': intent,
                'threat_score': threat_score,
                'is_flagged': is_flagged,
                'matched_patterns': ['ml_model']
            }
        except Exception as e:
            logger.error(f"ML prediction failed, using regex fallback: {e}")

    # ── Regex fallback ────────────────────────────────────────────────────────
    return _regex_classify(message)
