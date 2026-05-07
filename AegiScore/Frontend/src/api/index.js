import axios from 'axios';

const API_BASE = 'http://localhost:5000';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('aegis_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 — attempt refresh or redirect to login
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refresh = localStorage.getItem('aegis_refresh');
      if (refresh) {
        try {
          const { data } = await axios.post(`${API_BASE}/api/auth/refresh`, {}, {
            headers: { Authorization: `Bearer ${refresh}` },
          });
          localStorage.setItem('aegis_token', data.access_token);
          original.headers.Authorization = `Bearer ${data.access_token}`;
          return api(original);
        } catch {
          localStorage.removeItem('aegis_token');
          localStorage.removeItem('aegis_refresh');
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
