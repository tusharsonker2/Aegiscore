import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import Header from './components/Header';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import SOC from './pages/SOC';
import Logs from './pages/Logs';
import Audit from './pages/Audit';
import Settings from './pages/Settings';
import NetworkGraph from './pages/NetworkGraph';
import Incidents from './pages/Incidents';
import AgentChat from './pages/AgentChat';
import ButtonGradient from './assets/svg/ButtonGradient';

import Landing from './pages/Landing';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-screen"><div className="spinner" /><p>Loading AegisCore...</p></div>;
  return user ? children : <Navigate to="/login" />;
}

function AppLayout({ children }) {
  return (
    <div className="app-layout">
      <Header />
      <main className="app-main">{children}</main>
    </div>
  );
}

const App = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
          <Routes>
            {/* Public */}
            <Route path="/" element={<><Header /><Landing /></>} />
            <Route path="/login" element={<Login />} />

            {/* Protected */}
            <Route path="/dashboard" element={
              <ProtectedRoute><AppLayout><Dashboard /></AppLayout></ProtectedRoute>
            } />
            <Route path="/soc" element={
              <ProtectedRoute><AppLayout><SOC /></AppLayout></ProtectedRoute>
            } />
            <Route path="/logs" element={
              <ProtectedRoute><AppLayout><Logs /></AppLayout></ProtectedRoute>
            } />
            <Route path="/audit" element={
              <ProtectedRoute><AppLayout><Audit /></AppLayout></ProtectedRoute>
            } />
            <Route path="/agent-chat" element={
              <ProtectedRoute><AppLayout><AgentChat /></AppLayout></ProtectedRoute>
            } />
            <Route path="/incidents" element={
              <ProtectedRoute><AppLayout><Incidents /></AppLayout></ProtectedRoute>
            } />
            <Route path="/settings" element={
              <ProtectedRoute><AppLayout><Settings /></AppLayout></ProtectedRoute>
            } />
            <Route path="/network-graph" element={
              <ProtectedRoute><AppLayout><NetworkGraph /></AppLayout></ProtectedRoute>
            } />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
