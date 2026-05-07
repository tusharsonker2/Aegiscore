"""AegisCore — MITRE ATT&CK Mapping Module"""

# Maps AegisCore LSTM Categories to MITRE ATT&CK Techniques & Tactics
MITRE_MAPPING = {
    'Reconnaissance': {
        'technique_id': 'T1595',
        'tactic': 'Reconnaissance'
    },
    'DoS': {
        'technique_id': 'T1498',
        'tactic': 'Impact'
    },
    'Backdoor': {
        'technique_id': 'T1543',
        'tactic': 'Persistence'
    },
    'Exploits': {
        'technique_id': 'T1190',
        'tactic': 'Initial Access'
    },
    'Fuzzers': {
        'technique_id': 'T1592',
        'tactic': 'Reconnaissance'
    },
    'Shellcode': {
        'technique_id': 'T1055',
        'tactic': 'Defense Evasion'
    },
    'Worms': {
        'technique_id': 'T1090',
        'tactic': 'Command and Control'
    },
    'Analysis': {
        'technique_id': 'T1589',
        'tactic': 'Reconnaissance'
    },
    'Generic': {
        'technique_id': 'T1000',
        'tactic': 'Execution'
    },
    'Prompt Injection': {
        'technique_id': 'T1059',
        'tactic': 'Execution'
    },
    'Social Engineering': {
        'technique_id': 'T1566',
        'tactic': 'Initial Access'
    },
    'System Prompt Reconnaissance': {
        'technique_id': 'T1592',
        'tactic': 'Reconnaissance'
    }
}

def get_mitre_mapping(category: str) -> dict:
    """Returns the MITRE technique ID and tactic for a given category."""
    return MITRE_MAPPING.get(category, {
        'technique_id': None,
        'tactic': None
    })
