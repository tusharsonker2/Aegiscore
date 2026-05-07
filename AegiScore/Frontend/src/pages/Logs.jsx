import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../api';

const SEVERITY_COLORS = {
  critical: '#ff4444', high: '#ff8c42', medium: '#ffd166', low: '#00ff88',
};

export default function Logs() {
  const { hasRole } = useAuth();
  const navigate = useNavigate();
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [viewData, setViewData] = useState(null);
  const [msg, setMsg] = useState('');
  const [scanResults, setScanResults] = useState(null);   // { filename, ...results }
  const [scanning, setScanning] = useState(null);         // filename currently being scanned

  const fetchFiles = () => {
    api.get('/api/logs/list').then(r => setFiles(r.data.files || [])).catch(() => {});
  };

  useEffect(() => { fetchFiles(); }, []);

  const handleUpload = async (e) => {
    e.preventDefault();
    const fileInput = e.target.querySelector('input[type=file]');
    if (!fileInput.files.length) return;
    setUploading(true);
    const form = new FormData();
    for (const f of fileInput.files) form.append('file', f);
    try {
      const { data } = await api.post('/api/logs/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setMsg(`✅ ${data.status}: ${data.files?.join(', ')}`);
      fetchFiles();
    } catch (err) {
      setMsg(`❌ Upload failed: ${err.response?.data?.error || err.message}`);
    } finally { setUploading(false); }
  };

  const createLogs = async () => {
    setCreating(true);
    setMsg('');
    try {
      const { data } = await api.post('/api/logs/create', { max_count: 1, time_interval: 10 });
      setMsg(`✅ ${data.status}`);
      fetchFiles();
      // Auto-open the captured log file
      if (data.filename) {
        setTimeout(async () => {
          try {
            const { data: fileData } = await api.get(`/api/logs/data/${data.filename}`);
            setViewData(fileData);
            setScanResults(null);
          } catch {}
        }, 300);
      }
    } catch (err) {
      setMsg(`❌ ${err.response?.data?.error || err.message}`);
    } finally { setCreating(false); }
  };

  const viewFile = async (filename) => {
    setScanResults(null);
    try {
      const { data } = await api.get(`/api/logs/data/${filename}`);
      setViewData(data);
    } catch { setMsg('❌ Failed to load file'); }
  };

  const runMLScan = async (filename) => {
    setScanning(filename);
    setViewData(null);
    setScanResults(null);
    setMsg('');
    try {
      const { data } = await api.post(`/api/logs/analyze/${filename}`);
      setScanResults({ filename, ...data });
      setMsg(`✅ ML Scan complete on "${filename}" — ${data.threats_found} threat(s) found.`);
      fetchFiles();
    } catch (err) {
      const errData = err.response?.data;
      setMsg(`❌ Scan failed: ${errData?.error || err.message}${errData?.hint ? ' | Hint: ' + errData.hint : ''}`);
    } finally { setScanning(null); }
  };

  return (
    <div className="logs-page">
      <div className="soc-header">
        <h1>📄 Log Management</h1>
        <p>Upload, generate, and run ML-powered threat analysis on system logs</p>
      </div>

      <div className="logs-grid">
        {/* Upload */}
        {hasRole('admin', 'analyst') && (
          <div className="soc-panel">
            <h3>📤 Upload Log Files</h3>
            <form onSubmit={handleUpload} className="upload-form">
              <input type="file" multiple accept=".csv,.txt,.log,.json,.md" />
              <button type="submit" disabled={uploading}>{uploading ? 'Uploading...' : 'Upload'}</button>
            </form>
          </div>
        )}

        {/* Generate */}
        {hasRole('admin', 'analyst') && (
          <div className="soc-panel">
            <h3>⚙️ Capture Local Host Telemetry</h3>
            <p>Capture live system metrics (CPU, memory, network connections) into a CSV.</p>
            <button className="gen-btn" onClick={createLogs} disabled={creating}>
              {creating ? 'Capturing...' : '🔄 Capture Now'}
            </button>
          </div>
        )}
      </div>

      {msg && <div className="logs-msg">{msg}</div>}

      {/* File List */}
      <div className="soc-panel">
        <h3>📁 Available Log Files ({files.length})</h3>
        <div className="soc-table-wrap">
          <table className="soc-table">
            <thead><tr><th>Filename</th><th>Size</th><th>Actions</th></tr></thead>
            <tbody>
              {files.length === 0 && <tr><td colSpan="3" className="chart-empty">No log files found</td></tr>}
              {files.map((f, i) => (
                <tr key={i}>
                  <td>{f.name}</td>
                  <td>{(f.size / 1024).toFixed(1)} KB</td>
                  <td style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button className="view-btn" onClick={() => viewFile(f.name)}>View</button>

                    {/* ML Scan button — only for CSV files */}
                    {f.name.endsWith('.csv') && (
                      <button
                        className="view-btn"
                        disabled={scanning === f.name}
                        onClick={() => runMLScan(f.name)}
                        style={{ borderColor: '#7b2ff7', color: '#7b2ff7' }}
                      >
                        {scanning === f.name ? '⏳ Scanning...' : '🧠 ML Scan'}
                      </button>
                    )}

                    <button
                      className="view-btn"
                      style={{ borderColor: '#00f0ff', color: '#00f0ff' }}
                      onClick={() => navigate('/agent-chat', { state: { analyzeFile: f.name } })}
                    >
                      ✨ Ask AI
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ML Scan Results Panel */}
      {scanResults && (
        <div className="soc-panel" style={{ borderLeft: '3px solid #7b2ff7' }}>
          <div className="viewer-head" style={{ marginBottom: '1.5rem' }}>
            <h3>🧠 ML Scan Results — <span style={{ color: 'var(--aegis-accent)' }}>{scanResults.filename}</span></h3>
            <button onClick={() => setScanResults(null)}>✕ Close</button>
          </div>

          {/* Mode badge */}
          <div style={{ marginBottom: '1rem' }}>
            <span style={{
              background: scanResults.mode?.includes('LSTM') ? 'rgba(123,47,247,0.2)' : 'rgba(0,240,255,0.15)',
              color: scanResults.mode?.includes('LSTM') ? '#7b2ff7' : '#00f0ff',
              padding: '0.2rem 0.8rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700
            }}>
              {scanResults.mode}
            </span>
          </div>

          {/* Stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            {[
              { label: 'Total Rows', value: scanResults.total_rows, color: 'var(--aegis-text)' },
              { label: 'Threats Found', value: scanResults.threats_found, color: 'var(--aegis-threat-red)' },
              { label: 'Clean Rows', value: scanResults.clean_rows, color: 'var(--aegis-safe-green)' },
              { label: 'Alerts Created', value: scanResults.alerts_created, color: 'var(--aegis-warn-orange)' },
            ].map(stat => (
              <div key={stat.label} style={{ background: 'var(--aegis-bg)', borderRadius: '10px', padding: '1rem', border: '1px solid var(--aegis-border)', textAlign: 'center' }}>
                <div style={{ fontSize: '1.8rem', fontWeight: 700, color: stat.color }}>{stat.value}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--aegis-text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Category breakdown */}
          {scanResults.category_breakdown && Object.keys(scanResults.category_breakdown).length > 0 && (
            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ color: 'var(--aegis-text-dim)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>Attack Category Breakdown</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {Object.entries(scanResults.category_breakdown).map(([cat, count]) => (
                  <span key={cat} style={{
                    background: 'var(--aegis-surface-2)', color: 'var(--aegis-text)',
                    padding: '0.3rem 0.8rem', borderRadius: '20px', fontSize: '0.8rem',
                    border: '1px solid var(--aegis-border)'
                  }}>
                    {cat}: <strong style={{ color: 'var(--aegis-warn-orange)' }}>{count}</strong>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Top threats table */}
          {scanResults.top_threats?.length > 0 && (
            <div>
              <h4 style={{ color: 'var(--aegis-text-dim)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                Top Detected Threats (showing first {scanResults.top_threats.length})
              </h4>
              <div className="soc-table-wrap">
                <table className="soc-table">
                  <thead>
                    <tr>
                      <th>Row</th>
                      <th>Category</th>
                      <th>Severity</th>
                      {scanResults.mode?.includes('LSTM') && <th>Confidence</th>}
                      {scanResults.mode?.includes('Heuristic') && <th>Reasons</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {scanResults.top_threats.map((t, i) => (
                      <tr key={i}>
                        <td style={{ fontFamily: 'JetBrains Mono', fontSize: '0.8rem', color: 'var(--aegis-text-dim)' }}>
                          {t.row !== undefined ? `#${t.row}` : t.process}
                        </td>
                        <td>{t.category || 'Anomaly'}</td>
                        <td>
                          <span style={{
                            background: `${SEVERITY_COLORS[t.severity] || '#ff8c42'}22`,
                            color: SEVERITY_COLORS[t.severity] || '#ff8c42',
                            padding: '0.15rem 0.6rem', borderRadius: '20px',
                            fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase'
                          }}>
                            {t.severity}
                          </span>
                        </td>
                        {scanResults.mode?.includes('LSTM') && (
                          <td style={{ color: 'var(--aegis-safe-green)', fontFamily: 'JetBrains Mono', fontSize: '0.8rem' }}>
                            {t.confidence}%
                          </td>
                        )}
                        {scanResults.mode?.includes('Heuristic') && (
                          <td style={{ fontSize: '0.8rem', color: 'var(--aegis-text-dim)' }}>
                            {Array.isArray(t.reasons) ? t.reasons.join(', ') : '—'}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {scanResults.threats_found > 0 && (
                <button
                  onClick={() => navigate('/threats')}
                  style={{ marginTop: '1rem', background: 'var(--aegis-primary)', color: '#fff', border: 'none', padding: '0.6rem 1.5rem', borderRadius: '10px', cursor: 'pointer', fontWeight: 600 }}
                >
                  View Alerts in Threat Dashboard →
                </button>
              )}
            </div>
          )}

          {scanResults.threats_found === 0 && (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--aegis-safe-green)', fontSize: '1.1rem' }}>
              ✅ No threats detected. File appears clean.
            </div>
          )}
        </div>
      )}

      {/* File Viewer */}
      {viewData && (
        <div className="soc-panel">
          <div className="viewer-head">
            <h3>📖 {viewData.filename}</h3>
            <button onClick={() => setViewData(null)}>✕ Close</button>
          </div>
          <pre className="log-viewer">{viewData.data}</pre>
        </div>
      )}
    </div>
  );
}
