import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../api';

export default function AgentChat() {
  const location = useLocation();
  const [messages, setMessages] = useState([
    { role: 'agent', text: 'AegisCore Multi-Agent Interface initialized. Ready to analyze threats, query logs, and provide expert security insights.' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef(null);

  // If redirected from Logs page with a specific file to analyze
  useEffect(() => {
    if (location.state?.analyzeFile && messages.length === 1) {
      const initialPrompt = `Analyze the file '${location.state.analyzeFile}' and tell me what threats are present.`;
      setInput(initialPrompt);
    }
  }, [location.state]);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userQuery = input.trim();
    setMessages(prev => [...prev, { role: 'user', text: userQuery }]);
    setInput('');
    setLoading(true);

    try {
      const { data } = await api.post('/api/audit/agent/chat', { query: userQuery });
      setMessages(prev => [...prev, { role: 'agent', text: data.response }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'agent', text: `[ERROR]: Failed to reach agent. ${err.response?.data?.error || err.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="soc-page" style={{ height: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column' }}>
      <div className="soc-header" style={{ marginBottom: '1rem' }}>
        <h1 style={{ fontFamily: 'JetBrains Mono', fontSize: '1.75rem', color: '#00D4FF' }}>🧠 MULTI-AGENT CHAT</h1>
        <p style={{ color: '#7D8590' }}>Interact directly with the AegisCore security intelligence</p>
      </div>

      <div className="soc-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {messages.map((msg, i) => (
            <div key={i} style={{
              display: 'flex',
              flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
              gap: '1rem'
            }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '50%',
                background: msg.role === 'user' ? '#1C2333' : 'rgba(0, 212, 255, 0.1)',
                border: msg.role === 'user' ? '1px solid #3D444D' : '1px solid #00D4FF',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, fontSize: '0.8rem'
              }}>
                {msg.role === 'user' ? '👤' : '🤖'}
              </div>
              <div style={{
                background: msg.role === 'user' ? '#1C2333' : '#0D1117',
                border: msg.role === 'user' ? '1px solid #3D444D' : '1px solid #1C2333',
                padding: '1rem',
                borderRadius: '8px',
                maxWidth: '80%',
                color: '#E6EDF3',
                fontFamily: 'Inter',
                fontSize: '0.9rem',
                lineHeight: '1.5',
                whiteSpace: 'pre-wrap'
              }}>
                {msg.text}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ display: 'flex', gap: '1rem' }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '50%',
                background: 'rgba(0, 212, 255, 0.1)', border: '1px solid #00D4FF',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, fontSize: '0.8rem'
              }}>🤖</div>
              <div style={{ color: '#00D4FF', padding: '0.5rem', fontFamily: 'JetBrains Mono', fontSize: '0.85rem' }}>
                <span className="blink-dot" style={{ display: 'inline-block', marginRight: '8px' }}></span>
                Agent is thinking...
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <form onSubmit={handleSend} style={{ display: 'flex', gap: '1rem', padding: '1rem', borderTop: '1px solid #1C2333', background: '#080C10' }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask the agent to analyze a threat, summarize logs, or query specific IP details..."
            disabled={loading}
            style={{
              flex: 1,
              background: '#0D1117',
              border: '1px solid #3D444D',
              color: '#E6EDF3',
              padding: '0.8rem 1rem',
              borderRadius: '8px',
              fontFamily: 'JetBrains Mono',
              fontSize: '0.9rem'
            }}
          />
          <button type="submit" disabled={loading} style={{
            background: 'transparent',
            color: '#00D4FF',
            border: '1px solid #00D4FF',
            padding: '0 1.5rem',
            borderRadius: '8px',
            fontFamily: 'JetBrains Mono',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.5 : 1
          }}>
            SEND
          </button>
        </form>
      </div>
    </div>
  );
}
