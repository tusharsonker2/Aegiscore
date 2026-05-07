/*
 * AEGISCORE - TERMINAL GRID LANDING PAGE
 * Component Tree Structure:
 * 
 * <Landing>
 *  ├── <Header> (Global Navbar, Terminal styled)
 *  ├── <section .hero-section>
 *  │    ├── <div .hero-left> (Title, CTAs, Stats)
 *  │    └── <div .hero-right> (<div .live-terminal> Live Feed Widget)
 *  ├── <section .metrics-strip> (4 Animated Stat Cards)
 *  ├── <section .capabilities-section>
 *  │    ├── <div .tall-card> (LSTM Engine with fake chart)
 *  │    └── <div .small-cards-wrapper> (4 Feature Cards)
 *  ├── <section .threat-map-section> (SVG World Map + Glowing Dots)
 *  ├── <section .timeline-section> (5-Step How It Works Process)
 *  ├── <section .tech-marquee-section> (Infinite Scroll Tech Stack)
 *  ├── <section .cta-banner> (Final Call to Action)
 *  └── <footer .terminal-footer-section> (Minimal 3-column + copyright)
 */
import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './Landing.css';

const Landing = () => {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState({ threats: 0, uptime: 0, avgTime: 0, falsePos: 100 });
  const metricsRef = useRef(null);
  const [metricsVisible, setMetricsVisible] = useState(false);

  // Fake terminal lines
  const initialLines = [
    "[14:32:01] THREAT DETECTED — src: 192.168.4.22 [CRITICAL]",
    "[14:32:03] LSTM model confidence: 97.4% — DoS Pattern",
    "[14:32:07] Incident #4471 created — assigned: analyst_01",
    "[14:32:09] IP 45.33.32.156 → AbuseIPDB score: 94/100",
    "[14:32:14] NLP flagged chat — intent: PROMPT_INJECTION",
    "[14:32:18] Playbook triggered: auto-block + notify",
    "[14:32:22] ALERT ESCALATED — unacknowledged 15min",
    "[14:32:29] Gemini audit report generated ✓"
  ];
  const [terminalLines, setTerminalLines] = useState([initialLines[0]]);
  const [lineIndex, setLineIndex] = useState(1);

  useEffect(() => {
    const interval = setInterval(() => {
      setTerminalLines(prev => {
        const nextLines = [...prev, initialLines[lineIndex % initialLines.length]];
        if (nextLines.length > 8) nextLines.shift();
        return nextLines;
      });
      setLineIndex(prev => prev + 1);
    }, 1500);
    return () => clearInterval(interval);
  }, [lineIndex]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setMetricsVisible(true);
        }
      },
      { threshold: 0.1 }
    );
    if (metricsRef.current) observer.observe(metricsRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (metricsVisible) {
      const duration = 2000;
      const steps = 60;
      const interval = duration / steps;
      let step = 0;

      const timer = setInterval(() => {
        step++;
        const progress = step / steps;
        // Easing function for smoother counting
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);

        setMetrics({
          threats: Math.floor(easeOutQuart * 1247839),
          uptime: (easeOutQuart * 99.71).toFixed(2),
          avgTime: (easeOutQuart * 1.8).toFixed(1),
          falsePos: (100 - (easeOutQuart * 97.7)).toFixed(1) // 100 down to 2.3
        });

        if (step >= steps) {
          clearInterval(timer);
          setMetrics({ threats: 1247839, uptime: "99.71", avgTime: "1.8", falsePos: "2.3" });
        }
      }, interval);
      return () => clearInterval(timer);
    }
  }, [metricsVisible]);

  return (
    <div className="terminal-landing">
      {/* SECTION 2 - HERO SECTION */}
      <section className="hero-section">
        <div className="hero-grid">
          <div className="hero-left">
            <div className="system-status">
              <span className="blink-dot"></span> [ SYSTEM STATUS: ACTIVE ]
            </div>
            <h1 className="hero-title">
              THREAT <span className="text-cyan">INTELLIGENCE</span><br />PLATFORM
            </h1>
            <p className="hero-subtitle">
              Real-time detection. AI-powered analysis.<br />
              Zero-compromise security operations.
            </p>
            <div className="hero-ctas">
              <button className="btn-primary" onClick={() => navigate('/login')}>ENTER DASHBOARD</button>
              <button className="btn-secondary" onClick={() => {
                document.getElementById('capabilities').scrollIntoView({ behavior: 'smooth' });
              }}>VIEW CAPABILITIES ↓</button>
            </div>
            <div className="trust-stats">
              <span>99.7% UPTIME</span>
              <div className="divider-v"></div>
              <span>&lt; 2ms DETECTION</span>
              <div className="divider-v"></div>
              <span>SOC2 READY</span>
            </div>
          </div>
          <div className="hero-right">
            <div className="live-terminal">
              <div className="terminal-header">
                <div className="mac-dots">
                  <div className="dot red"></div>
                  <div className="dot yellow"></div>
                  <div className="dot green"></div>
                </div>
                <div className="terminal-title">AEGISCORE // LIVE FEED</div>
              </div>
              <div className="terminal-body">
                {terminalLines.map((line, i) => (
                  <div key={i} className="terminal-line slide-in">
                    {line.includes('CRITICAL') || line.includes('ESCALATED') ? (
                      <span className="text-red">{line}</span>
                    ) : line.includes('confidence') ? (
                      <span className="text-cyan">{line}</span>
                    ) : line.includes('✓') ? (
                      <span className="text-green">{line}</span>
                    ) : (
                      <span>{line}</span>
                    )}
                  </div>
                ))}
              </div>
              <div className="terminal-footer">
                <div className="scan-label">SCANNING NETWORK // 847 EVENTS/MIN</div>
                <div className="scan-bar-container">
                  <div className="scan-bar"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3 - LIVE METRICS STRIP */}
      <section className="metrics-strip" ref={metricsRef}>
        <div className="metric-card">
          <div className="metric-value">{metrics.threats.toLocaleString()}</div>
          <div className="metric-label">THREATS BLOCKED</div>
          <div className="metric-trend positive">↑ 4.2% this week</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">{metrics.uptime}%</div>
          <div className="metric-label">UPTIME</div>
          <div className="metric-trend neutral">Last 90 days</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">{metrics.avgTime}ms</div>
          <div className="metric-label">AVG DETECT TIME</div>
          <div className="metric-trend neutral">LSTM v3.2</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">{metrics.falsePos}%</div>
          <div className="metric-label">FALSE POSITIVES</div>
          <div className="metric-trend positive">↓ 0.8% improved</div>
        </div>
      </section>

      {/* SECTION 4 - CAPABILITIES GRID */}
      <section id="capabilities" className="capabilities-section">
        <h2 className="section-heading">CORE CAPABILITIES</h2>
        <div className="capabilities-grid">
          <div className="cap-card tall-card">
            <div className="fake-chart">
              <div className="bar b1"></div>
              <div className="bar b2"></div>
              <div className="bar b3"></div>
              <div className="bar b4"></div>
              <div className="bar b5"></div>
              <div className="bar b6"></div>
              <div className="bar b7"></div>
              <div className="bar b8"></div>
              <div className="bar b9"></div>
              <div className="bar b10"></div>
            </div>
            <div className="tall-card-content">
              <h3>LSTM Threat Engine</h3>
              <p>Deep learning models trained on millions of attack vectors to detect zero-day anomalies instantly.</p>
              <a href="#" className="learn-more">LEARN MORE →</a>
            </div>
          </div>
          <div className="small-cards-wrapper">
            <div className="cap-card small-card">
              <div className="card-top">
                <div className="icon-wrapper">
                  <div className="live-dot"></div> LIVE
                </div>
                <div className="tag green">ACTIVE</div>
              </div>
              <h3>Real-time SOC</h3>
            </div>
            <div className="cap-card small-card">
              <div className="card-top">
                <div className="icon-wrapper terminal-icon">&gt;_</div>
                <div className="tag cyan">NEW</div>
              </div>
              <h3>NLP Chat Monitor</h3>
            </div>
            <div className="cap-card small-card">
              <div className="card-top">
                <div className="icon-wrapper doc-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                  </svg>
                </div>
                <div className="tag green">ACTIVE</div>
              </div>
              <h3>AI Audit Reports</h3>
            </div>
            <div className="cap-card small-card">
              <div className="card-top">
                <div className="icon-wrapper lock-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                  </svg>
                </div>
                <div className="tag green">ACTIVE</div>
              </div>
              <h3>RBAC & Auth</h3>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 5 - THREAT MAP TEASER */}
      <section className="threat-map-section">
        <h2 className="section-heading map-heading">GLOBAL THREAT VISIBILITY</h2>
        <div className="map-container">
          <div className="map-stats-panel">
            <div className="map-stat text-red">ACTIVE THREATS: 14</div>
            <div className="map-stat text-green">BLOCKED LAST HOUR: 847</div>
            <div className="map-stat text-muted">TOP ORIGIN: CN, RU, KP</div>
          </div>
          <svg className="world-map" viewBox="0 0 800 400" preserveAspectRatio="xMidYMid meet">
            {/* Simplified World Map Paths */}
            <path d="M150,100 Q200,80 250,50 T300,100 T250,200 Z" fill="#1C2333" />
            <path d="M350,150 Q400,100 450,120 T500,200 T400,250 Z" fill="#1C2333" />
            <path d="M550,80 Q600,50 650,80 T700,150 T600,200 Z" fill="#1C2333" />
            <path d="M200,250 Q250,230 300,280 T250,350 T180,300 Z" fill="#1C2333" />
            
            {/* Defended Server */}
            <circle cx="400" cy="200" r="6" fill="#00D4FF" className="pulse-cyan" />
            
            {/* Threat Origins & Connecting Lines */}
            <line x1="250" y1="100" x2="400" y2="200" stroke="#FF4444" strokeWidth="1" strokeDasharray="4 4" className="attack-line" />
            <circle cx="250" cy="100" r="4" fill="#FF4444" className="pulse-red" />
            
            <line x1="600" y1="120" x2="400" y2="200" stroke="#FF4444" strokeWidth="1" strokeDasharray="4 4" className="attack-line delay-1" />
            <circle cx="600" cy="120" r="4" fill="#FF4444" className="pulse-red delay-1" />
            
            <line x1="450" y1="150" x2="400" y2="200" stroke="#FF4444" strokeWidth="1" strokeDasharray="4 4" className="attack-line delay-2" />
            <circle cx="450" cy="150" r="4" fill="#FF4444" className="pulse-red delay-2" />
            
            <line x1="280" y1="300" x2="400" y2="200" stroke="#FF4444" strokeWidth="1" strokeDasharray="4 4" className="attack-line delay-3" />
            <circle cx="280" cy="300" r="4" fill="#FF4444" className="pulse-red delay-3" />
          </svg>
        </div>
      </section>

      {/* SECTION 6 - HOW IT WORKS */}
      <section className="timeline-section">
        <div className="timeline-container">
          <div className="timeline-line">
            <div className="timeline-dot-anim"></div>
          </div>
          <div className="timeline-steps">
            {[
              { num: '01', title: 'INGEST', desc: 'Continuous log aggregation' },
              { num: '02', title: 'ANALYZE', desc: 'AI-driven contextual parsing' },
              { num: '03', title: 'DETECT', desc: 'LSTM anomaly recognition' },
              { num: '04', title: 'RESPOND', desc: 'Automated playbook execution' },
              { num: '05', title: 'AUDIT', desc: 'Immutable PDF report generation' }
            ].map((step, idx) => (
              <div key={idx} className="timeline-step">
                <div className="step-num">{step.num}</div>
                <div className="step-title">{step.title}</div>
                <div className="step-desc">{step.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 7 - TECH STACK STRIP */}
      <section className="tech-marquee-section">
        <div className="marquee-label">BUILT ON</div>
        <div className="marquee-container">
          <div className="marquee-content">
            <span>LSTM Neural Network</span><span className="marquee-divider">//</span>
            <span>Google Gemini AI</span><span className="marquee-divider">//</span>
            <span>Flask + SocketIO</span><span className="marquee-divider">//</span>
            <span>PostgreSQL</span><span className="marquee-divider">//</span>
            <span>Redis</span><span className="marquee-divider">//</span>
            <span>Elasticsearch</span><span className="marquee-divider">//</span>
            <span>JWT + RBAC</span><span className="marquee-divider">//</span>
            <span>React + Vite</span><span className="marquee-divider">//</span>
            <span>Docker</span><span className="marquee-divider">//</span>
            <span>MITRE ATT&CK</span><span className="marquee-divider">//</span>
          </div>
          <div className="marquee-content" aria-hidden="true">
            <span>LSTM Neural Network</span><span className="marquee-divider">//</span>
            <span>Google Gemini AI</span><span className="marquee-divider">//</span>
            <span>Flask + SocketIO</span><span className="marquee-divider">//</span>
            <span>PostgreSQL</span><span className="marquee-divider">//</span>
            <span>Redis</span><span className="marquee-divider">//</span>
            <span>Elasticsearch</span><span className="marquee-divider">//</span>
            <span>JWT + RBAC</span><span className="marquee-divider">//</span>
            <span>React + Vite</span><span className="marquee-divider">//</span>
            <span>Docker</span><span className="marquee-divider">//</span>
            <span>MITRE ATT&CK</span><span className="marquee-divider">//</span>
          </div>
        </div>
      </section>

      {/* SECTION 8 - CTA BANNER */}
      <section className="cta-banner">
        <div className="cta-content">
          <div className="cta-left">
            <h2>READY TO SECURE YOUR INFRASTRUCTURE?</h2>
            <p>Deploy AegisCore in your environment in under 10 minutes.</p>
          </div>
          <div className="cta-right">
            <button className="btn-primary" onClick={() => navigate('/login')}>ACCESS DASHBOARD →</button>
          </div>
        </div>
      </section>

      {/* SECTION 9 - FOOTER */}
      <footer className="terminal-footer-section">
        <div className="footer-grid">
          <div className="footer-col">
            <div className="footer-logo">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00D4FF" strokeWidth="1.5">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <span>AEGISCORE</span>
            </div>
            <p className="footer-tagline">Enterprise cybersecurity intelligence.</p>
          </div>
          <div className="footer-col footer-links">
            <a href="#">Platform</a>
            <a href="#">SOC</a>
            <a href="#">Logs</a>
            <a href="#">Audit</a>
            <a href="#">Status</a>
          </div>
          <div className="footer-col system-status-footer">
            <div className="status-indicator">
              <span className="blink-dot"></span> ALL SYSTEMS OPERATIONAL
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <div className="copyright">© 2026 AegisCore. All rights reserved.</div>
          <div className="built-with">Built with LSTM</div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
