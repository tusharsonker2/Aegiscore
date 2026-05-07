import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../api';
import MarkdownView from 'react-showdown';
import html2pdf from 'html2pdf.js';

export default function Audit() {
  const { hasRole } = useAuth();
  const [reports, setReports] = useState([]);
  const [activeReport, setActiveReport] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [msg, setMsg] = useState('');
  const [logFiles, setLogFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState('');

  const fetchReports = () => {
    api.get('/api/audit/reports').then(r => setReports(r.data)).catch(() => {});
  };

  useEffect(() => { 
    fetchReports(); 
    api.get('/api/logs/list').then(r => setLogFiles(r.data.files || [])).catch(() => {});
  }, []);

  const generateReport = async () => {
    setGenerating(true);
    setMsg('');
    try {
      const { data } = await api.post('/api/audit/generate', {
        prompt: 'Generate a comprehensive cybersecurity audit report from available system logs.',
        filename: selectedFile || null
      });
      setActiveReport(data);
      setMsg('✅ Report generated successfully');
      fetchReports();
    } catch (err) {
      setMsg(`❌ ${err.response?.data?.error || err.message}`);
    } finally { setGenerating(false); }
  };

  const loadSample = async () => {
    try {
      const { data } = await api.get('/api/audit/sample');
      setActiveReport(data);
    } catch { setMsg('❌ Sample report not found'); }
  };

  const loadReport = async (id) => {
    try {
      const { data } = await api.get(`/api/audit/report/${id}`);
      setActiveReport(data);
    } catch { setMsg('❌ Failed to load report'); }
  };

  const exportToPDF = () => {
    if (!activeReport) return;
    const element = document.getElementById('audit-report-content');
    const opt = {
      margin:       1,
      filename:     `${activeReport.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true },
      jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
  };

  return (
    <div className="audit-page">
      <div className="soc-header">
        <h1>📊 Audit Reports</h1>
        <p>Generate AI-powered cybersecurity audit reports</p>
      </div>

      <div className="audit-actions" style={{ alignItems: 'center' }}>
        {hasRole('admin', 'analyst') && (
          <>
            <select 
              value={selectedFile} 
              onChange={(e) => setSelectedFile(e.target.value)}
              style={{
                background: 'var(--aegis-bg)', border: '1px solid var(--aegis-border)',
                color: 'var(--aegis-text)', padding: '0.6rem 1rem', borderRadius: '10px',
                fontSize: '0.9rem', outline: 'none', fontFamily: 'JetBrains Mono'
              }}
            >
              <option value="">Global Audit (All Logs)</option>
              {logFiles.map((f, i) => (
                <option key={i} value={f.name}>Focus: {f.name}</option>
              ))}
            </select>
            <button className="gen-btn" onClick={generateReport} disabled={generating}>
              {generating ? '🔄 Generating with AI...' : '🤖 Generate AI Report'}
            </button>
          </>
        )}
        <button className="gen-btn sample-btn" onClick={loadSample}>
          📄 View Sample Report
        </button>
      </div>

      {msg && <div className="logs-msg">{msg}</div>}

      <div className="audit-grid">
        {/* Report List */}
        <div className="soc-panel audit-list">
          <h3>📋 Generated Reports ({reports.length})</h3>
          <div className="report-list">
            {reports.length === 0 && <p className="chart-empty">No reports generated yet.</p>}
            {reports.map((r, i) => (
              <div key={i} className="report-item" onClick={() => loadReport(r.id)}>
                <div className="report-title">{r.title}</div>
                <div className="report-meta">
                  {new Date(r.created_at).toLocaleDateString()} · {r.generated_by} · {r.report_type}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Report Viewer */}
        <div className="soc-panel audit-viewer">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0 }}>{activeReport ? activeReport.title : 'Select a report'}</h3>
            {activeReport && (
              <button onClick={exportToPDF} style={{ background: 'var(--aegis-surface-2)', color: 'var(--aegis-text)', border: '1px solid var(--aegis-border)', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                Export PDF
              </button>
            )}
          </div>
          <div className="audit-content" id="audit-report-content" style={{ background: 'var(--aegis-surface-1)', color: 'var(--aegis-text)', padding: '2rem', borderRadius: '8px', minHeight: '500px', border: '1px solid var(--aegis-border)' }}>
            {activeReport ? (
              <MarkdownView markdown={activeReport.content} options={{ tables: true, emoji: true }}
                className="audit-md" />
            ) : (
              <p className="chart-empty">Select a report from the list or generate a new one.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
