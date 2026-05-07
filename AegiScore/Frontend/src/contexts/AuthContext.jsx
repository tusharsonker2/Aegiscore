import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('aegis_token');
    if (token) {
      api.get('/api/auth/me')
        .then(res => setUser(res.data))
        .catch(() => {
          localStorage.removeItem('aegis_token');
          localStorage.removeItem('aegis_refresh');
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (username, password) => {
    // We catch 403s (like forced reset) in the caller component
    const { data } = await api.post('/api/auth/login', { username, password });
    if (data.status === 'success') {
      localStorage.setItem('aegis_token', data.access_token);
      localStorage.setItem('aegis_refresh', data.refresh_token);
      setUser(data.user);
    }
    return data;
  };

  const completeLogin = async (mfa_token, otp) => {
    // Need to pass the mfa_token as auth header for this specific request
    const { data } = await api.post('/api/auth/login/mfa', { otp }, {
      headers: { Authorization: `Bearer ${mfa_token}` }
    });
    if (data.status === 'success') {
      localStorage.setItem('aegis_token', data.access_token);
      localStorage.setItem('aegis_refresh', data.refresh_token);
      setUser(data.user);
    }
    return data;
  };

  const logout = () => {
    localStorage.removeItem('aegis_token');
    localStorage.removeItem('aegis_refresh');
    setUser(null);
  };

  const hasRole = (...roles) => user && roles.includes(user.role);

  return (
    <AuthContext.Provider value={{ user, loading, login, completeLogin, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}
