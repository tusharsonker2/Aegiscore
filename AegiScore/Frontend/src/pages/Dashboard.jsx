import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import api from '../api';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import {
  ComposableMap, Geographies, Geography, Marker, ZoomableGroup
} from 'react-simple-maps';
import CalendarHeatmap from 'react-calendar-heatmap';
import 'react-calendar-heatmap/dist/styles.css';

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

const SEVERITY_COLORS = {
  critical: '#ff3b5c',
  high: '#ff8c42',
  medium: '#ffd166',
  low: '#06d6a0'
};

export default function Dashboard() {
  const { user } = useAuth();
  const { events } = useSocket();
  const [stats, setStats] = useState({ total: 0, critical: 0, high: 0, medium: 0, low: 0 });
  const [logCount, setLogCount] = useState(0);
  const [chatFlagged, setChatFlagged] = useState(0);
  const [geoData, setGeoData] = useState([]);
  const [heatmapData, setHeatmapData] = useState([]);
  const [tooltip, setTooltip] = useState(null);
  const [layoutSaved, setLayoutSaved] = useState(false);

  useEffect(() => {
    api.get('/api/threat/stats').then(r => setStats(r.data)).catch(() => {});
    api.get('/api/logs/list').then(r => setLogCount(r.data.count)).catch(() => {});
    api.get('/api/chat/flagged').then(r => setChatFlagged(r.data.length)).catch(() => {});
    api.get('/api/threat/geomap').then(r => setGeoData(r.data)).catch(() => {});
    api.get('/api/threat/heatmap').then(r => setHeatmapData(r.data)).catch(() => {});
  }, []);

  const pieData = [
    { name: 'Critical', value: stats.critical, color: SEVERITY_COLORS.critical },
    { name: 'High',     value: stats.high,     color: SEVERITY_COLORS.high },
    { name: 'Medium',   value: stats.medium,   color: SEVERITY_COLORS.medium },
    { name: 'Low',      value: stats.low,       color: SEVERITY_COLORS.low },
  ].filter(d => d.value > 0);

  const timelineData = events.slice(0, 20).map(e => ({
    time:    new Date(e.time).toLocaleTimeString(),
    threats: e.type === 'threat' ? 1 : 0,
    chats:   e.type === 'chat_threat' ? 1 : 0,
  })).reverse();

  const today = new Date();
  const startDate = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());

  const heatValues = heatmapData.map(d => ({ date: d.date, count: d.count }));

  return (
    <div className="dashboard-page">

      {/* ─── Header ─────────────────────────────────────────────────────────── */}
      <div className="dash-header">
        <div>
          <h1>Welcome back, <span className="text-gradient">{user?.username}</span></h1>
          <p className="dash-subtitle">AegisCore Security Overview — {new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <div className="dash-role-badge">{user?.role?.toUpperCase()}</div>
      </div>

      {/* ─── Stat Cards ─────────────────────────────────────────────────────── */}
      <div className="stats-grid">
        <div className="stat-card stat-total">
          <div className="stat-icon">🛡️</div>
          <div className="stat-info">
            <span className="stat-value">{stats.total}</span>
            <span className="stat-label">Total Alerts</span>
          </div>
        </div>
        <div className="stat-card stat-critical">
          <div className="stat-icon">🔴</div>
          <div className="stat-info">
            <span className="stat-value">{stats.critical}</span>
            <span className="stat-label">Critical</span>
          </div>
        </div>
        <div className="stat-card stat-logs">
          <div className="stat-icon">📄</div>
          <div className="stat-info">
            <span className="stat-value">{logCount}</span>
            <span className="stat-label">Log Files</span>
          </div>
        </div>
        <div className="stat-card stat-chat">
          <div className="stat-icon">⚠️</div>
          <div className="stat-info">
            <span className="stat-value">{chatFlagged}</span>
            <span className="stat-label">Flagged Chats</span>
          </div>
        </div>
      </div>

      {/* ─── Charts Row ─────────────────────────────────────────────────────── */}
      <div className="charts-grid">
        <div className="chart-card">
          <h3>Threat Severity Distribution</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90}
                  paddingAngle={4} dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}>
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: '#12122a', border: '1px solid #2a2a4e' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="chart-empty">No alerts yet. Run threat detection to populate.</div>
          )}
        </div>

        <div className="chart-card">
          <h3>Live Event Timeline</h3>
          {timelineData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={timelineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3e" />
                <XAxis dataKey="time" stroke="#8884d8" fontSize={10} />
                <YAxis stroke="#8884d8" />
                <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333' }} />
                <Area type="monotone" dataKey="threats" stackId="1" stroke="#ff3b5c" fill="#ff3b5c40" />
                <Area type="monotone" dataKey="chats"   stackId="1" stroke="#ffd166" fill="#ffd16640" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="chart-empty">Waiting for live events via WebSocket...</div>
          )}
        </div>
      </div>

      {/* ─── Geo Map + Heatmap Row ───────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>

        {/* World Map */}
        <div className="chart-card" style={{ position: 'relative', minHeight: '380px' }}>
          <h3>🌍 Global Threat Origins</h3>
          {tooltip && (
            <div style={{
              position: 'absolute', top: '3.5rem', left: '1rem', zIndex: 50,
              background: 'var(--aegis-surface-2)', border: '1px solid var(--aegis-border)',
              borderRadius: '10px', padding: '0.6rem 0.9rem', fontSize: '0.8rem', color: 'var(--aegis-text)',
              pointerEvents: 'none', backdropFilter: 'blur(8px)'
            }}>
              <div style={{ fontWeight: 700, color: 'var(--aegis-accent)' }}>{tooltip.ip}</div>
              <div>📍 {tooltip.country || 'Unknown'}</div>
              <div>🎯 {tooltip.category} × {tooltip.count}</div>
            </div>
          )}
          <div style={{ width: '100%', height: '100%', minHeight: '320px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <ComposableMap
              projectionConfig={{ scale: 120, center: [0, 0] }}
              width={800}
              height={400}
              style={{ width: '100%', height: 'auto', maxHeight: '100%' }}
            >
              <ZoomableGroup>
                <Geographies geography={GEO_URL}>
                  {({ geographies }) =>
                    geographies.map(geo => (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        fill="#1a1a3e"
                        stroke="#2a2a4e"
                        strokeWidth={0.5}
                        style={{ default: { outline: 'none' }, hover: { fill: '#2a2a5e', outline: 'none' }, pressed: { outline: 'none' } }}
                      />
                    ))
                  }
                </Geographies>
                {geoData.filter(p => p.lat && p.lon).map((point, i) => (
                  <Marker key={i} coordinates={[point.lon, point.lat]}>
                    <circle
                      r={Math.max(4, Math.min(4 + point.count * 2, 14))}
                      fill="#ff3b5c"
                      fillOpacity={0.75}
                      stroke="#ff3b5c"
                      strokeWidth={2}
                      strokeOpacity={0.3}
                      className="geo-pulse"
                      onMouseEnter={() => setTooltip(point)}
                      onMouseLeave={() => setTooltip(null)}
                      style={{ cursor: 'pointer' }}
                    />
                  </Marker>
                ))}
              </ZoomableGroup>
            </ComposableMap>
          </div>
          {geoData.length === 0 && (
            <div className="chart-empty">No geo data yet. Run threat detection first.</div>
          )}
        </div>

        {/* Heatmap */}
        <div className="chart-card" style={{ minHeight: '380px' }}>
          <h3>📅 Threat Activity Calendar</h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--aegis-text-dim)', marginBottom: '1.25rem' }}>
            Daily threat volume — last 30 days
          </p>
          <CalendarHeatmap
            startDate={startDate}
            endDate={today}
            values={heatValues}
            classForValue={value => {
              if (!value || value.count === 0) return 'color-empty';
              if (value.count < 5)  return 'color-scale-1';
              if (value.count < 20) return 'color-scale-2';
              if (value.count < 50) return 'color-scale-3';
              return 'color-scale-4';
            }}
            showMonthLabels
            gutterSize={2}
          />
          <div style={{
            display: 'flex', gap: '0.4rem', marginTop: '1.25rem',
            alignItems: 'center', fontSize: '0.7rem', color: 'var(--aegis-text-dim)'
          }}>
            <span>Less</span>
            {['#1a1a3e','#4a1d6e','#6b2fa0','#8b2fc9','#ff3b5c'].map((c,i) => (
              <div key={i} style={{ width: '12px', height: '12px', borderRadius: '2px', background: c }} />
            ))}
            <span>More</span>
          </div>

          {/* Mini Stats */}
          <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--aegis-text-dim)' }}>
              <span>Busiest day</span>
              <span style={{ color: 'var(--aegis-text)', fontWeight: 600 }}>
                {heatValues.length > 0
                  ? heatValues.reduce((a,b) => a.count > b.count ? a : b).date
                  : '—'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--aegis-text-dim)' }}>
              <span>Active days</span>
              <span style={{ color: 'var(--aegis-text)', fontWeight: 600 }}>
                {heatValues.filter(v => v.count > 0).length} / 30
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--aegis-text-dim)' }}>
              <span>Total events</span>
              <span style={{ color: 'var(--aegis-accent)', fontWeight: 700 }}>
                {heatValues.reduce((sum, v) => sum + v.count, 0)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Recent Activity Feed ────────────────────────────────────────────── */}
      <div className="recent-events">
        <h3>Recent Activity Feed</h3>
        <div className="event-list">
          {events.length === 0 && <p className="chart-empty">No events yet. Activity will appear here in real-time.</p>}
          {events.slice(0, 10).map((evt, i) => (
            <div key={i} className={`event-item event-${evt.type}`}>
              <span className="event-dot" />
              <span className="event-time">{new Date(evt.time).toLocaleTimeString()}</span>
              <span className="event-type">{evt.type.replace('_', ' ').toUpperCase()}</span>
              <span className="event-detail">
                {evt.category || evt.intent || evt.filename || 'System event'}
                {evt.mitre_technique && (
                  <span className="soc-badge" style={{
                    marginLeft: '0.5rem',
                    background: 'var(--aegis-surface-2)',
                    border: '1px solid var(--aegis-border)',
                    color: 'var(--aegis-text)'
                  }}>
                    {evt.mitre_technique}
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
