import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../api';

export default function Settings() {
  const { user } = useAuth();
  
  // MFA State
  const [mfaSetup, setMfaSetup] = useState(null);
  const [mfaOtp, setMfaOtp] = useState('');
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaError, setMfaError] = useState('');
  const [mfaSuccess, setMfaSuccess] = useState('');
  
  // Sessions State
  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);

  // System Settings State
  const [webhooks, setWebhooks] = useState([]);
  const [playbooks, setPlaybooks] = useState([]);
  const [newWebhook, setNewWebhook] = useState({ name: '', url: '', event_filter: 'critical' });

  useEffect(() => {
    fetchSessions();
    if (user?.role === 'admin' || user?.role === 'analyst') {
      fetchPlaybooks();
    }
    if (user?.role === 'admin') {
      fetchWebhooks();
    }
  }, []);

  const fetchWebhooks = async () => {
    try {
      const { data } = await api.get('/api/settings/webhooks');
      setWebhooks(data);
    } catch (err) { console.error('Failed to fetch webhooks', err); }
  };

  const fetchPlaybooks = async () => {
    try {
      const { data } = await api.get('/api/settings/playbooks');
      setPlaybooks(data);
    } catch (err) { console.error('Failed to fetch playbooks', err); }
  };

  const addWebhook = async (e) => {
    e.preventDefault();
    try {
      await api.post('/api/settings/webhooks', newWebhook);
      setNewWebhook({ name: '', url: '', event_filter: 'critical' });
      fetchWebhooks();
    } catch (err) { alert('Failed to add webhook'); }
  };

  const deleteWebhook = async (id) => {
    try {
      await api.delete(`/api/settings/webhooks/${id}`);
      fetchWebhooks();
    } catch (err) { alert('Failed to delete webhook'); }
  };

  const fetchSessions = async () => {
    try {
      const { data } = await api.get('/api/auth/sessions');
      setSessions(data);
    } catch (err) {
      console.error('Failed to fetch sessions', err);
    } finally {
      setSessionsLoading(false);
    }
  };

  const startMfaSetup = async () => {
    setMfaLoading(true);
    setMfaError('');
    try {
      const { data } = await api.post('/api/auth/mfa/setup');
      setMfaSetup(data);
    } catch (err) {
      setMfaError('Failed to generate MFA setup. Please try again.');
    } finally {
      setMfaLoading(false);
    }
  };

  const verifyMfa = async (e) => {
    e.preventDefault();
    setMfaLoading(true);
    setMfaError('');
    try {
      await api.post('/api/auth/mfa/verify', { otp: mfaOtp });
      setMfaSuccess('MFA has been successfully enabled!');
      setMfaSetup(null);
      setMfaOtp('');
      user.mfa_enabled = true; // Optimistic update
    } catch (err) {
      setMfaError('Invalid verification code. Please try again.');
    } finally {
      setMfaLoading(false);
    }
  };

  const revokeSession = async (sessionId) => {
    try {
      await api.delete(`/api/auth/sessions/${sessionId}`);
      setSessions(sessions.filter(s => s.id !== sessionId));
    } catch (err) {
      console.error('Failed to revoke session', err);
    }
  };

  return (
    <div className="page-container" style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: 'white' }}>User Settings</h1>
        <p style={{ color: '#94a3b8' }}>Manage your account security and active sessions.</p>
      </header>

      <div style={{ display: 'grid', gap: '2rem' }}>
        
        {/* MFA SECTION */}
        <section style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '1.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', color: 'white', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00f0ff" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
            Multi-Factor Authentication (MFA)
          </h2>
          
          {user?.mfa_enabled ? (
            <div style={{ background: 'rgba(16, 185, 129, 0.1)', borderLeft: '4px solid #10b981', padding: '1rem', borderRadius: '4px' }}>
              <p style={{ color: '#10b981', margin: 0, fontWeight: '500' }}>✓ MFA is enabled on your account.</p>
              <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginTop: '0.5rem' }}>Your account is protected by an additional layer of security.</p>
            </div>
          ) : (
            <div>
              <p style={{ color: '#94a3b8', marginBottom: '1rem' }}>Enhance your account security by requiring a 6-digit code from your authenticator app when logging in.</p>
              
              {!mfaSetup && !mfaSuccess && (
                <button 
                  onClick={startMfaSetup} 
                  disabled={mfaLoading}
                  style={{ background: 'linear-gradient(90deg, #00f0ff 0%, #7b2ff7 100%)', color: 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  {mfaLoading ? 'Generating...' : 'Set Up MFA'}
                </button>
              )}

              {mfaSetup && (
                <div style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '8px', marginTop: '1rem' }}>
                  <h3 style={{ color: 'white', marginBottom: '1rem', fontSize: '1.1rem' }}>1. Scan this QR Code</h3>
                  <p style={{ color: '#94a3b8', marginBottom: '1rem', fontSize: '0.9rem' }}>Open Google Authenticator or Authy and scan the image below.</p>
                  <div style={{ background: 'white', padding: '1rem', display: 'inline-block', borderRadius: '8px', marginBottom: '1.5rem' }}>
                    <img src={mfaSetup.qr_code} alt="MFA QR Code" style={{ width: '200px', height: '200px' }} />
                  </div>
                  <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Or enter this code manually: <strong style={{ color: 'white', letterSpacing: '2px' }}>{mfaSetup.secret}</strong></p>
                  
                  <h3 style={{ color: 'white', marginBottom: '1rem', fontSize: '1.1rem' }}>2. Enter Verification Code</h3>
                  <form onSubmit={verifyMfa} style={{ display: 'flex', gap: '1rem' }}>
                    <input 
                      type="text" 
                      value={mfaOtp} 
                      onChange={e => setMfaOtp(e.target.value)}
                      placeholder="000000" 
                      maxLength="6"
                      required
                      style={{ background: '#0f172a', border: '1px solid #334155', color: 'white', padding: '0.75rem', borderRadius: '6px', fontSize: '1.1rem', letterSpacing: '2px', width: '150px', textAlign: 'center' }}
                    />
                    <button 
                      type="submit" 
                      disabled={mfaLoading || mfaOtp.length !== 6}
                      style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '0 1.5rem', borderRadius: '6px', fontWeight: 'bold', cursor: mfaOtp.length === 6 ? 'pointer' : 'not-allowed', opacity: mfaOtp.length === 6 ? 1 : 0.5 }}
                    >
                      Verify & Enable
                    </button>
                  </form>
                  {mfaError && <p style={{ color: '#ef4444', marginTop: '1rem' }}>{mfaError}</p>}
                </div>
              )}
              
              {mfaSuccess && (
                <div style={{ background: 'rgba(16, 185, 129, 0.1)', borderLeft: '4px solid #10b981', padding: '1rem', borderRadius: '4px', marginTop: '1rem' }}>
                  <p style={{ color: '#10b981', margin: 0 }}>{mfaSuccess}</p>
                </div>
              )}
            </div>
          )}
        </section>

        {/* SESSIONS SECTION */}
        <section style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '1.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', color: 'white', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7b2ff7" strokeWidth="2"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path></svg>
            Active Sessions
          </h2>
          <p style={{ color: '#94a3b8', marginBottom: '1.5rem' }}>These are the devices that have logged into your account. Revoke any sessions that you do not recognize.</p>
          
          {sessionsLoading ? (
            <p style={{ color: '#64748b' }}>Loading sessions...</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {sessions.map(session => (
                <div key={session.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1e293b', padding: '1rem', borderRadius: '8px' }}>
                  <div>
                    <p style={{ color: 'white', margin: '0 0 0.25rem 0', fontWeight: '500' }}>{session.ip_address || 'Unknown IP'}</p>
                    <p style={{ color: '#94a3b8', margin: 0, fontSize: '0.85rem' }}>{session.user_agent || 'Unknown Device'}</p>
                    <p style={{ color: '#64748b', margin: '0.25rem 0 0 0', fontSize: '0.8rem' }}>Started: {new Date(session.created_at).toLocaleString()}</p>
                  </div>
                  <button 
                    onClick={() => revokeSession(session.id)}
                    style={{ background: 'transparent', color: '#ef4444', border: '1px solid #ef4444', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s' }}
                    onMouseOver={e => { e.target.style.background = '#ef4444'; e.target.style.color = 'white'; }}
                    onMouseOut={e => { e.target.style.background = 'transparent'; e.target.style.color = '#ef4444'; }}
                  >
                    Force Logout
                  </button>
                </div>
              ))}
              {sessions.length === 0 && <p style={{ color: '#64748b' }}>No active sessions found.</p>}
            </div>
          )}
        </section>

        {/* WEBHOOKS SECTION (Admin Only) */}
        {user?.role === 'admin' && (
          <section style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.25rem', color: 'white', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--aegis-accent)" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
              Webhooks Integration
            </h2>
            <p style={{ color: '#94a3b8', marginBottom: '1.5rem' }}>Configure webhooks to receive real-time notifications for critical system events in Slack, Discord, or other services.</p>
            
            <form onSubmit={addWebhook} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr auto', gap: '1rem', marginBottom: '1.5rem', alignItems: 'center' }}>
              <input type="text" placeholder="Webhook Name (e.g., Slack SecOps)" value={newWebhook.name} onChange={e => setNewWebhook({...newWebhook, name: e.target.value})} required style={{ background: '#1e293b', border: '1px solid #334155', color: 'white', padding: '0.75rem', borderRadius: '6px' }} />
              <input type="url" placeholder="https://hooks.slack.com/services/..." value={newWebhook.url} onChange={e => setNewWebhook({...newWebhook, url: e.target.value})} required style={{ background: '#1e293b', border: '1px solid #334155', color: 'white', padding: '0.75rem', borderRadius: '6px' }} />
              <select value={newWebhook.event_filter} onChange={e => setNewWebhook({...newWebhook, event_filter: e.target.value})} style={{ background: '#1e293b', border: '1px solid #334155', color: 'white', padding: '0.75rem', borderRadius: '6px' }}>
                <option value="critical">Critical Only</option>
                <option value="high">High & Critical</option>
                <option value="all">All Alerts</option>
              </select>
              <button type="submit" style={{ background: 'var(--aegis-accent)', color: 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Add</button>
            </form>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {webhooks.length === 0 && <p style={{ color: '#64748b' }}>No webhooks configured.</p>}
              {webhooks.map(wh => (
                <div key={wh.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1e293b', padding: '1rem', borderRadius: '8px' }}>
                  <div>
                    <h4 style={{ margin: '0 0 0.25rem 0', color: 'white' }}>{wh.name}</h4>
                    <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem' }}>{wh.url}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span style={{ fontSize: '0.75rem', background: '#0f172a', padding: '0.25rem 0.5rem', borderRadius: '4px', color: '#cbd5e1' }}>Trigger: {wh.event_filter.toUpperCase()}</span>
                    <button onClick={() => deleteWebhook(wh.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1.25rem' }}>×</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* PLAYBOOKS SECTION (Admin & Analyst) */}
        {(user?.role === 'admin' || user?.role === 'analyst') && (
          <section style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.25rem', color: 'white', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--aegis-success)" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
              Active Playbooks
            </h2>
            <p style={{ color: '#94a3b8', marginBottom: '1.5rem' }}>SOAR-lite automation rules currently active in the AegisCore pipeline.</p>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
              {playbooks.map(pb => (
                <div key={pb.id} style={{ background: '#1e293b', padding: '1.25rem', borderRadius: '8px', borderLeft: pb.enabled ? '4px solid var(--aegis-success)' : '4px solid #475569' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <h4 style={{ margin: 0, color: 'white', fontSize: '1.05rem' }}>{pb.name}</h4>
                    <span style={{ fontSize: '0.75rem', color: pb.enabled ? 'var(--aegis-success)' : '#94a3b8', fontWeight: 'bold' }}>
                      {pb.enabled ? 'ACTIVE' : 'DISABLED'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                    <strong>Trigger:</strong> <pre style={{ display: 'inline', background: '#0f172a', padding: '2px 4px', borderRadius: '4px' }}>{JSON.stringify(pb.trigger)}</pre>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.5rem' }}>
                    <strong>Actions:</strong> {pb.actions.join(', ')}
                  </div>
                </div>
              ))}
              {playbooks.length === 0 && <p style={{ color: '#64748b' }}>No playbooks available.</p>}
            </div>
          </section>
        )}

      </div>
    </div>
  );
}
