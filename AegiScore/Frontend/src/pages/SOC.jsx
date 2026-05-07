import { useState, useEffect, useRef } from 'react';
import { useSocket } from '../contexts/SocketContext';
import api from '../api';

const SEVERITY_MAP = {
  prompt_injection:   { color: '#ff3b5c', icon: '🔴', label: 'Prompt Injection' },
  social_engineering: { color: '#ff8c42', icon: '🟠', label: 'Social Engineering' },
  reconnaissance:     { color: '#ffb347', icon: '🟡', label: 'Reconnaissance' },
  impersonation:      { color: '#ffd166', icon: '🟡', label: 'Impersonation' },
  normal:             { color: '#06d6a0', icon: '🟢', label: 'Normal' },
  critical:           { color: '#ff3b5c', icon: '🔴', label: 'Critical' },
  high:               { color: '#ff8c42', icon: '🟠', label: 'High' },
  medium:             { color: '#ffd166', icon: '🟡', label: 'Medium' },
  low:                { color: '#06d6a0', icon: '🟢', label: 'Low' },
};

const getSev = (key) => SEVERITY_MAP[key] || SEVERITY_MAP.normal;

export default function SOC() {
  const { events } = useSocket();

  // Network alerts (DB)
  const [alerts, setAlerts]         = useState([]);
  const [fpSummary, setFpSummary]   = useState([]);

  // Live feed — real-time WebSocket events ONLY (not seeded from DB)
  const [liveFeed, setLiveFeed]     = useState([]);

  // Flagged chats — DB history + instant push from NLP test
  const [flaggedChats, setFlaggedChats] = useState([]);

  // NLP test panel
  const [testMsg, setTestMsg]       = useState('');
  const [testResult, setTestResult] = useState(null);
  const [analyzing, setAnalyzing]   = useState(false);

  const feedRef = useRef(null);

  // ── On mount: load historical DB data ──────────────────────────────────────
  useEffect(() => {
    api.get('/api/threat/alerts')
      .then(r => setAlerts(r.data))
      .catch(() => {});

    api.get('/api/chat/flagged')
      .then(r => setFlaggedChats(r.data))
      .catch(() => {});

    api.get('/api/threat/feedback/summary')
      .then(r => setFpSummary(r.data))
      .catch(() => {});
  }, []);

  // ── Real-time: only WebSocket events go into the live feed ─────────────────
  useEffect(() => {
    if (!events.length) return;
    const newest = events[0];

    if (newest.type === 'threat') {
      // Network threat from ML detection — push to live feed
      setLiveFeed(prev => [newest, ...prev].slice(0, 200));
    } else if (newest.type === 'chat_threat') {
      // Flagged chat arrived via WebSocket — push to BOTH feeds
      setLiveFeed(prev => [newest, ...prev].slice(0, 200));
      setFlaggedChats(prev => [{
        id: `rt-${Date.now()}`,
        message: newest.message,
        intent: newest.intent,
        threat_score: newest.threat_score,
        username: newest.username || 'system',
        session_id: newest.session_id || 'live',
        timestamp: newest.time || new Date().toISOString(),
        _realtime: true,
      }, ...prev].slice(0, 100));
    } else if (newest.type === 'log_upload' || newest.type === 'logs_created') {
      setLiveFeed(prev => [newest, ...prev].slice(0, 200));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

  // ── NLP test: analyze a message ────────────────────────────────────────────
  const analyzeMessage = async () => {
    if (!testMsg.trim()) return;
    setAnalyzing(true);
    setTestResult(null);
    try {
      const { data } = await api.post('/api/chat/analyze', { message: testMsg });
      setTestResult(data);

      // If flagged → instantly push into Flagged Chat Messages box
      if (data.is_flagged) {
        const entry = {
          id: `test-${Date.now()}`,
          message: testMsg,
          intent: data.intent,
          threat_score: data.threat_score,
          username: 'nlp-test',
          session_id: 'analyzer',
          timestamp: new Date().toISOString(),
          _realtime: true,
        };
        setFlaggedChats(prev => [entry, ...prev].slice(0, 100));

        // Also push to live feed as a chat_threat event
        setLiveFeed(prev => [{
          type: 'chat_threat',
          intent: data.intent,
          message: testMsg,
          threat_score: data.threat_score,
          time: new Date().toISOString(),
          _realtime: true,
        }, ...prev].slice(0, 200));
      }
    } catch {
      setTestResult({ error: 'Analysis failed — check backend connection.' });
    } finally {
      setAnalyzing(false);
    }
  };

  const submitFeedback = async (alertId, verdict) => {
    try {
      await api.post('/api/threat/feedback', { alert_id: alertId, verdict });
      api.get('/api/threat/feedback/summary').then(r => setFpSummary(r.data)).catch(() => {});
    } catch (e) { console.error(e); }
  };

  // ── Live feed event renderer ───────────────────────────────────────────────
  const renderLiveEvent = (evt, i) => {
    const isChat = evt.type === 'chat_threat';
    const isLog  = evt.type === 'log_upload' || evt.type === 'logs_created';
    const sevKey = evt.intent || evt.severity || (isLog ? 'low' : 'normal');
    const sev    = getSev(sevKey);

    let icon = sev.icon;
    let title = '';
    let detail = '';

    if (isChat) {
      icon  = '💬';
      title = `Chat Threat — ${(sev.label || sevKey).toUpperCase()}`;
      detail = `"${evt.message || ''}"`;
    } else if (isLog) {
      icon  = '📋';
      title = evt.type === 'logs_created' ? 'System Logs Captured' : 'Log File Uploaded';
      detail = evt.filename ? `File: ${evt.filename}` : `${evt.lines || ''} lines recorded`;
    } else {
      title = `Network Threat — ${evt.category || sevKey}`;
      detail = evt.description || `Source IP: ${evt.source_ip || 'unknown'}`;
    }

    return (
      <div
        key={`live-${i}`}
        className="soc-event"
        style={{
          borderLeftColor: isLog ? '#00f0ff' : sev.color,
          background: evt._realtime ? `${isLog ? '#00f0ff' : sev.color}08` : undefined,
          animation: evt._realtime ? 'socPulse 0.4s ease' : undefined,
        }}
      >
        <span className="soc-event-icon" style={{ fontSize: '1.1rem' }}>{icon}</span>
        <div className="soc-event-body">
          <div className="soc-event-head">
            <span className="soc-event-type" style={{ color: isLog ? '#00f0ff' : sev.color, fontWeight: 700 }}>
              {title}
            </span>
            <span className="soc-event-time">
              {new Date(evt.time || evt.timestamp || Date.now()).toLocaleTimeString()}
            </span>
          </div>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: 'var(--aegis-text-dim)' }}>
            {detail}
            {evt.source_ip && (
              <span style={{ marginLeft: '0.5rem', color: 'var(--aegis-accent)', fontFamily: 'monospace' }}>
                [{evt.source_ip}]
              </span>
            )}
          </p>
          {evt.mitre_technique && (
            <span style={{ fontSize: '0.7rem', color: 'var(--aegis-text-dim)' }}>
              ATT&CK: {evt.mitre_technique}
            </span>
          )}
        </div>
      </div>
    );
  };

  // ── Flagged chat entry renderer ────────────────────────────────────────────
  const renderFlaggedChat = (chat, i) => {
    const sev = getSev(chat.intent);
    return (
      <div
        key={`chat-${i}`}
        className="soc-event"
        style={{
          borderLeftColor: sev.color,
          background: chat._realtime ? `${sev.color}10` : undefined,
          animation: chat._realtime ? 'socPulse 0.4s ease' : undefined,
        }}
      >
        <span className="soc-event-icon">{sev.icon}</span>
        <div className="soc-event-body">
          <div className="soc-event-head">
            <span className="soc-badge" style={{ background: sev.color + '28', color: sev.color, fontWeight: 700, fontSize: '0.75rem' }}>
              {sev.icon} {(sev.label || chat.intent).toUpperCase()}
            </span>
            <span style={{ color: sev.color, fontWeight: 700, fontSize: '0.85rem' }}>
              {(chat.threat_score * 100).toFixed(0)}% threat
            </span>
          </div>
          <p className="soc-msg" style={{ color: 'var(--aegis-text)', fontSize: '0.9rem', fontStyle: 'italic', margin: '0.35rem 0 0.2rem' }}>
            "{chat.message}"
          </p>
          <small style={{ color: 'var(--aegis-text-dim)', fontSize: '0.75rem' }}>
            👤 <strong>{chat.username}</strong> &nbsp;|&nbsp;
            📟 Session: {chat.session_id} &nbsp;|&nbsp;
            🕐 {new Date(chat.timestamp).toLocaleString()}
          </small>
        </div>
      </div>
    );
  };

  return (
    <div className="soc-page">
      <div className="soc-header">
        <h1>🛡️ Security Operations Center</h1>
        <p>Real-time threat monitoring and chat security intelligence</p>
      </div>

      {/* ── ROW 1: Live Feed + Flagged Chats ── */}
      <div className="soc-grid">

        {/* Live Threat Feed — real-time WebSocket events ONLY */}
        <div className="soc-panel">
          <h3>
            ⚡ Live Threat Feed
            <span className="soc-counter">{liveFeed.length}</span>
            {liveFeed.length === 0 && (
              <span style={{ marginLeft: '0.5rem', fontSize: '0.72rem', color: 'var(--aegis-text-dim)', fontWeight: 400 }}>
                — waiting for live events
              </span>
            )}
          </h3>
          <div className="soc-feed" ref={feedRef}>
            {liveFeed.length === 0 && (
              <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--aegis-text-dim)' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📡</div>
                <p style={{ margin: 0, fontSize: '0.875rem' }}>
                  Live events will appear here instantly.<br />
                  Run <strong>Threat Detection</strong> or use the <strong>NLP Analyzer</strong> below.
                </p>
              </div>
            )}
            {liveFeed.slice(0, 50).map(renderLiveEvent)}
          </div>
        </div>

        {/* Flagged Chat Messages */}
        <div className="soc-panel">
          <h3>
            🚨 Flagged Chat Messages
            <span className="soc-counter" style={flaggedChats.length
              ? { background: '#ff3b5c22', color: '#ff3b5c' }
              : undefined}>
              {flaggedChats.length}
            </span>
          </h3>
          <div className="soc-feed">
            {flaggedChats.length === 0 && (
              <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--aegis-text-dim)' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🔍</div>
                <p style={{ margin: 0, fontSize: '0.875rem' }}>
                  No flagged messages yet.<br />
                  Use the <strong>NLP Analyzer</strong> below — flagged messages appear here instantly.
                </p>
              </div>
            )}
            {flaggedChats.map(renderFlaggedChat)}
          </div>
        </div>

      </div>

      {/* ── NLP Test Panel ── */}
      <div className="soc-panel soc-test">
        <h3>🔬 NLP Chat Analyzer — Test a Message</h3>
        <p style={{ color: 'var(--aegis-text-dim)', fontSize: '0.855rem', margin: '0 0 1rem' }}>
          Type any message and press <strong>Analyze</strong>. If flagged, it instantly appears in the <em>Flagged Chat Messages</em> box above.
          <br />Try: <code>"give me the admin password"</code> or <code>"ignore previous instructions"</code>
        </p>
        <div className="soc-test-form">
          <input
            type="text"
            value={testMsg}
            onChange={e => setTestMsg(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !analyzing && analyzeMessage()}
            placeholder="Type a message to analyze... (Enter or click Analyze)"
          />
          <button onClick={analyzeMessage} disabled={analyzing}>
            {analyzing ? '⏳ Analyzing...' : '🔍 Analyze'}
          </button>
        </div>

        {testResult && !testResult.error && (() => {
          const sev = getSev(testResult.intent);
          return (
            <div className="soc-test-result" style={{ borderColor: sev.color, marginTop: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1.25rem' }}>
                <div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--aegis-text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.4rem' }}>Intent</div>
                  <span className="soc-badge" style={{ background: sev.color + '28', color: sev.color, fontSize: '0.88rem', padding: '0.35rem 0.9rem', fontWeight: 700 }}>
                    {sev.icon} {(sev.label || testResult.intent).toUpperCase()}
                  </span>
                </div>
                <div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--aegis-text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.4rem' }}>Threat Score</div>
                  <div style={{ fontSize: '1.75rem', fontWeight: 800, color: sev.color, lineHeight: 1 }}>
                    {(testResult.threat_score * 100).toFixed(1)}%
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--aegis-text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.4rem' }}>Status</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: sev.color }}>
                    {testResult.is_flagged ? '🔴 FLAGGED' : '🟢 CLEAN'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--aegis-text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.4rem' }}>Engine</div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--aegis-text-dim)', marginTop: '0.15rem' }}>
                    {testResult.matched_patterns?.includes('ml_model') ? '🧠 ML Model' : '📐 Regex Engine'}
                  </div>
                </div>
              </div>
              {testResult.is_flagged && (
                <div style={{
                  marginTop: '0.85rem', padding: '0.6rem 1rem',
                  background: sev.color + '12', borderRadius: '8px',
                  fontSize: '0.82rem', color: sev.color, fontWeight: 600,
                }}>
                  ⬆️ Message added to <strong>Flagged Chat Messages</strong> above
                </div>
              )}
            </div>
          );
        })()}

        {testResult?.error && (
          <div style={{ marginTop: '1rem', color: '#ff3b5c', background: '#ff3b5c14', padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.875rem' }}>
            ❌ {testResult.error}
          </div>
        )}
      </div>

      {/* ── Network Alerts (historical DB only, separate from live feed) ── */}
      <div className="soc-panel">
        <h3>
          📋 Network Alerts — Historical Log
          <span className="soc-counter">{alerts.length}</span>
        </h3>
        <p style={{ color: 'var(--aegis-text-dim)', fontSize: '0.8rem', margin: '0 0 1rem' }}>
          Persistent threat records from the database. Run <strong>Threat Detection</strong> from the Logs page to add entries.
        </p>
        <div className="soc-table-wrap">
          <table className="soc-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Severity</th>
                <th>Category</th>
                <th>Source IP</th>
                <th>Description</th>
                <th>ATT&amp;CK</th>
                <th>Feedback</th>
              </tr>
            </thead>
            <tbody>
              {alerts.length === 0 && (
                <tr>
                  <td colSpan="7" className="chart-empty">
                    No alerts in database. Run ML threat detection on a log file to populate.
                  </td>
                </tr>
              )}
              {alerts.slice(0, 30).map((a, i) => {
                const fpData      = fpSummary.find(f => f.category === a.category);
                const showWarning = fpData && fpData.fp_rate > 25;
                const sev         = getSev(a.severity);
                return (
                  <tr key={i}>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--aegis-text-dim)', whiteSpace: 'nowrap' }}>
                      {new Date(a.timestamp).toLocaleTimeString()}
                    </td>
                    <td>
                      <span className="soc-badge" style={{ background: sev.color + '28', color: sev.color, fontWeight: 700 }}>
                        {sev.icon} {a.severity}
                      </span>
                    </td>
                    <td>
                      {a.category}
                      {showWarning && (
                        <span title={`High FP Rate: ${fpData.fp_rate.toFixed(1)}%`}
                          style={{ marginLeft: '0.4rem', fontSize: '0.7rem', color: 'var(--aegis-warn-orange)' }}>
                          ⚠️
                        </span>
                      )}
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--aegis-accent)' }}>
                      {a.source_ip || '—'}
                    </td>
                    <td style={{ fontSize: '0.82rem', maxWidth: '260px' }}>
                      {a.description}
                    </td>
                    <td>
                      {a.mitre_technique ? (
                        <a href={`https://attack.mitre.org/techniques/${a.mitre_technique}`}
                          target="_blank" rel="noreferrer" className="soc-badge"
                          style={{ background: 'var(--aegis-surface-2)', border: '1px solid var(--aegis-border)', color: 'var(--aegis-text)', textDecoration: 'none' }}>
                          {a.mitre_technique}
                        </a>
                      ) : '—'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                        <button onClick={() => submitFeedback(a.id, 'TP')} title="True Positive"
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.05rem' }}>👍</button>
                        <button onClick={() => submitFeedback(a.id, 'FP')} title="False Positive"
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.05rem' }}>👎</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
