import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../api';

export default function Login() {
  const { login, completeLogin } = useAuth();
  const navigate = useNavigate();
  
  const [step, setStep] = useState('password'); // 'password' | 'mfa' | 'reset'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [mfaToken, setMfaToken] = useState(null);
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // Password strength logic
  const getPasswordStrength = (pwd) => {
    let strength = 0;
    if (pwd.length >= 12) strength += 25;
    if (/[A-Z]/.test(pwd)) strength += 25;
    if (/[0-9]/.test(pwd)) strength += 25;
    if (/[!@#$%^&*(),.?":{}|<>_\-]/.test(pwd)) strength += 25;
    return strength;
  };
  const strength = getPasswordStrength(newPassword);
  const strengthColor = strength < 50 ? '#ef4444' : strength < 100 ? '#f59e0b' : '#10b981';

  const handleInitialLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await login(username, password);
      if (data.status === 'success') {
        navigate('/dashboard');
      } else if (data.status === 'mfa_required') {
        setMfaToken(data.mfa_token);
        setStep('mfa');
      }
    } catch (err) {
      if (err.response?.status === 403 && err.response?.data?.status === 'forced_reset_required') {
        setStep('reset');
        setError('Password expired. Please update your password to continue.');
      } else {
        setError(err.response?.data?.error || 'Login failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleMfaSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await completeLogin(mfaToken, otp);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const { data } = await api.post('/api/auth/password/force-reset', {
        username,
        old_password: password,
        new_password: newPassword
      });
      setSuccess(data.message);
      setStep('password');
      setPassword('');
      setNewPassword('');
    } catch (err) {
      setError(err.response?.data?.error || 'Password reset failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSSO = async () => {
    setError('');
    setLoading(true);
    try {
      await api.get('/api/auth/oauth/login');
    } catch (err) {
      setError(err.response?.data?.error || 'SSO configuration error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-particles">
        {[...Array(20)].map((_, i) => (
          <div key={i} className="particle" style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 5}s`,
            animationDuration: `${3 + Math.random() * 4}s`,
          }} />
        ))}
      </div>

      <div className="login-card">
        <div className="login-logo">
          <div className="logo-shield">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="url(#grad)" strokeWidth="1.5">
              <defs>
                <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#00f0ff" />
                  <stop offset="100%" stopColor="#7b2ff7" />
                </linearGradient>
              </defs>
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <h1 className="login-title">AegisCore</h1>
          <p className="login-subtitle">Cybersecurity Intelligence Platform</p>
        </div>

        {error && (
          <div className="login-error">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
            {error}
          </div>
        )}
        
        {success && (
          <div className="login-error" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderLeftColor: '#10b981' }}>
            {success}
          </div>
        )}

        {step === 'password' && (
          <form onSubmit={handleInitialLogin} className="login-form">
            <div className="form-group">
              <label>Username</label>
              <input type="text" value={username} onChange={e => setUsername(e.target.value)}
                placeholder="Enter username" required autoFocus />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Enter password" required />
            </div>
            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? <span className="spinner" /> : 'Sign In'}
            </button>
            
            <div className="sso-divider">
              <span>OR</span>
            </div>
            <button type="button" className="sso-btn" onClick={handleSSO} disabled={loading}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              Sign in with SSO
            </button>
          </form>
        )}

        {step === 'mfa' && (
          <form onSubmit={handleMfaSubmit} className="login-form">
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1.5rem', textAlign: 'center' }}>
              Please enter the 6-digit code from your authenticator app.
            </p>
            <div className="form-group">
              <label>Authentication Code</label>
              <input type="text" value={otp} onChange={e => setOtp(e.target.value)}
                placeholder="000000" required autoFocus maxLength="6" style={{ letterSpacing: '4px', textAlign: 'center', fontSize: '1.2rem' }} />
            </div>
            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? <span className="spinner" /> : 'Verify'}
            </button>
            <button type="button" className="sso-btn" onClick={() => setStep('password')} style={{ marginTop: '1rem' }}>
              Back to Login
            </button>
          </form>
        )}

        {step === 'reset' && (
          <form onSubmit={handlePasswordReset} className="login-form">
            <div className="form-group">
              <label>New Password</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                placeholder="Minimum 12 chars, 1 uppercase, 1 number, 1 special" required autoFocus />
              {newPassword && (
                <div style={{ marginTop: '0.5rem', background: '#1e293b', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${strength}%`, background: strengthColor, transition: 'all 0.3s' }} />
                </div>
              )}
            </div>
            <button type="submit" className="login-btn" disabled={loading || strength < 100}>
              {loading ? <span className="spinner" /> : 'Update Password'}
            </button>
          </form>
        )}

      </div>
    </div>
  );
}
