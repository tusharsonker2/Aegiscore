import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import ForceGraph2D from 'react-force-graph-2d';
import api from '../api';

const SEVERITY_COLORS = {
  critical: '#ff4444',
  high: '#ff8c42',
  medium: '#ffd166',
  low: '#00ff88'
};

export default function NetworkGraph() {
  const navigate = useNavigate();
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState(null);
  const fgRef = useRef();
  const containerRef = useRef();
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  useEffect(() => {
    if (!containerRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height
        });
      }
    });
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    api.get('/api/threat/network')
      .then(r => {
        setGraphData(r.data);
        setLoading(false);
        
        // Wait for engine to start, then apply custom forces to reduce clumping
        setTimeout(() => {
          if (fgRef.current) {
            fgRef.current.d3Force('charge').strength(-400); // Stronger repulsion
            fgRef.current.d3Force('link').distance(150);   // Longer links
            fgRef.current.zoomToFit(400, 150);
          }
        }, 500);
      })
      .catch(e => {
        console.error("Failed to load network graph", e);
        setLoading(false);
      });
  }, []);

  const handleNodeClick = useCallback(node => {
    setSelectedNode(node);
    fgRef.current.centerAt(node.x, node.y, 800);
    fgRef.current.zoom(3, 800);
  }, [fgRef]);

  if (loading) {
    return <div className="loading-screen"><div className="spinner" /> Loading Network Graph...</div>;
  }

  return (
    <div className="soc-page" style={{ height: 'calc(100vh - 80px)', overflow: 'hidden', display: 'flex', background: '#080C10', flexDirection: 'row' }}>
      
      {/* Network Graph Container (Main Content - Left) */}
      <div ref={containerRef} style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <div className="soc-header" style={{ position: 'absolute', top: 0, left: 0, zIndex: 10, padding: '2rem', pointerEvents: 'none' }}>
          <h1 style={{ fontFamily: 'JetBrains Mono', fontSize: '24px', color: '#00D4FF', textShadow: '0 0 10px rgba(0,212,255,0.5)' }}>🕸️ NETWORK TOPOLOGY</h1>
          <p style={{ color: '#7D8590', fontFamily: 'JetBrains Mono', fontSize: '12px' }}>Interactive Threat Relationships • {graphData.nodes.length} Nodes</p>
        </div>

        <div style={{ position: 'absolute', bottom: '2rem', left: '2rem', zIndex: 10, display: 'flex', gap: '0.5rem' }}>
          <button 
            onClick={() => fgRef.current?.zoomToFit(400, 100)}
            style={{ background: '#1C2333', color: '#00D4FF', border: '1px solid #00D4FF', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', fontFamily: 'JetBrains Mono', fontSize: '10px' }}
          >
            ZOOM TO FIT
          </button>
          <button 
            onClick={() => { setSelectedNode(null); fgRef.current?.zoomToFit(400, 100); }}
            style={{ background: '#1C2333', color: '#7D8590', border: '1px solid #3D444D', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', fontFamily: 'JetBrains Mono', fontSize: '10px' }}
          >
            RESET
          </button>
        </div>
        
        <ForceGraph2D
          ref={fgRef}
          width={dimensions.width}
          height={dimensions.height}
          graphData={graphData}
          nodeLabel=""
          nodeRelSize={6}
          linkColor={() => 'rgba(0, 212, 255, 0.2)'} // More neon blue
          linkWidth={1.5}
          linkCurvature={0.25} // Adds curve to distinguish overlapping lines
          linkDirectionalArrowLength={4}
          linkDirectionalArrowRelPos={1}
          linkDirectionalParticles={2}
          linkDirectionalParticleWidth={2.5}
          linkDirectionalParticleSpeed={0.006}
          onNodeClick={handleNodeClick}
          backgroundColor="transparent"
          cooldownTicks={100}
          d3AlphaDecay={0.02} // Slower stabilization for smoother layout
          d3VelocityDecay={0.3} // Damping
          onEngineStop={() => fgRef.current?.zoomToFit(400, 150)}
          nodeCanvasObject={(node, ctx, globalScale) => {
            const label = node.name || node.id;
            const fontSize = 12/globalScale;
            const size = Math.sqrt(node.val || 5) * 2.5;
            
            const color = node.group === 'system' ? '#00D4FF' : (node.group === 'ip' ? '#7D8590' : (SEVERITY_COLORS[node.severity] || '#ff8c42'));
            ctx.shadowColor = color;
            ctx.shadowBlur = 15 / globalScale;
            
            ctx.beginPath();
            ctx.arc(node.x, node.y, size, 0, 2 * Math.PI, false);
            ctx.fillStyle = color;
            ctx.fill();
            
            ctx.shadowBlur = 0;

            if (selectedNode && selectedNode.id === node.id) {
               ctx.beginPath();
               ctx.arc(node.x, node.y, size + 2, 0, 2 * Math.PI, false);
               ctx.strokeStyle = '#fff';
               ctx.lineWidth = 2 / globalScale;
               ctx.stroke();
            }

            if (globalScale > 1.2) {
                ctx.font = `${fontSize}px JetBrains Mono`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = '#E6EDF3';
                ctx.fillText(label, node.x, node.y + size + fontSize + 2);
            }
          }}
        />
      </div>

      {/* Sidebar Details (On the Right) */}
      {selectedNode && (
        <div style={{
          width: '320px', 
          background: '#0D1117', 
          borderLeft: '1px solid #1C2333', 
          padding: '2rem', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '1rem',
          fontFamily: 'JetBrains Mono',
          boxShadow: '-10px 0 30px rgba(0,0,0,0.5)',
          zIndex: 20
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1C2333', paddingBottom: '0.5rem' }}>
            <h2 style={{ fontSize: '18px', color: '#00D4FF', margin: 0 }}>
                NODE DETAILS
            </h2>
            <button onClick={() => setSelectedNode(null)} style={{ background: 'transparent', border: 'none', color: '#7D8590', cursor: 'pointer', fontSize: '18px' }}>✕</button>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1rem' }}>
            <div className="detail-item">
                <div style={{ color: '#7D8590', fontSize: '10px', marginBottom: '4px' }}>IDENTIFIER</div>
                <div style={{ color: '#E6EDF3', fontSize: '14px', wordBreak: 'break-all' }}>{selectedNode.id}</div>
            </div>
            
            <div className="detail-item">
                <div style={{ color: '#7D8590', fontSize: '10px', marginBottom: '4px' }}>ENTITY TYPE</div>
                <div style={{ color: '#00D4FF', fontSize: '12px', fontWeight: 'bold' }}>{selectedNode.group.toUpperCase()}</div>
            </div>
            
            {selectedNode.group === 'threat' && (
                <div className="detail-item">
                    <div style={{ color: '#7D8590', fontSize: '10px', marginBottom: '4px' }}>SEVERITY LEVEL</div>
                    <div style={{ 
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        background: `${SEVERITY_COLORS[selectedNode.severity]}22`,
                        color: SEVERITY_COLORS[selectedNode.severity],
                        fontSize: '11px',
                        fontWeight: 'bold',
                        border: `1px solid ${SEVERITY_COLORS[selectedNode.severity]}44`
                    }}>
                    {selectedNode.severity?.toUpperCase()}
                    </div>
                </div>
            )}

            <div style={{ background: '#1C233344', padding: '1rem', borderRadius: '8px', border: '1px solid #1C2333' }}>
                {selectedNode.group === 'threat' && (
                    <div style={{ fontSize: '13px', color: '#E6EDF3' }}>
                        <span style={{ color: '#7D8590' }}>INCIDENTS:</span> {selectedNode.incidents}
                    </div>
                )}

                {selectedNode.group === 'ip' && (
                    <div style={{ fontSize: '13px', color: '#E6EDF3' }}>
                        <span style={{ color: '#7D8590' }}>LINKED THREATS:</span> {selectedNode.threat_count}
                    </div>
                )}

                {selectedNode.last_seen && (
                    <div style={{ fontSize: '12px', color: '#E6EDF3', marginTop: '0.5rem' }}>
                        <span style={{ color: '#7D8590' }}>TELEMETRY TS:</span> <br/>
                        {new Date(selectedNode.last_seen).toLocaleString()}
                    </div>
                )}
            </div>
          </div>

          <button 
             onClick={() => navigate('/incidents')}
             style={{
                marginTop: 'auto',
                background: 'var(--aegis-primary)',
                color: '#fff',
                border: 'none',
                padding: '0.8rem',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '12px'
             }}
          >
             INVESTIGATE INCIDENTS
          </button>
        </div>
      )}
    </div>
  );
}
