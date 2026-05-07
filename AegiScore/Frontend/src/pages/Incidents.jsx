import { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import api from '../api';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';

const COLUMNS = [
  { id: 'open', title: 'Open', color: 'var(--aegis-threat-red)' },
  { id: 'in_progress', title: 'In Progress', color: 'var(--aegis-warn-orange)' },
  { id: 'resolved', title: 'Resolved', color: 'var(--aegis-accent)' }
];

export default function Incidents() {
  const { user } = useAuth();
  const { events } = useSocket();
  const [incidents, setIncidents] = useState({ open: [], in_progress: [], resolved: [] });
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newIncident, setNewIncident] = useState({ title: '', description: '', severity: 'medium' });

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/api/incidents', newIncident);
      setShowAddModal(false);
      setNewIncident({ title: '', description: '', severity: 'medium' });
      fetchIncidents();
    } catch (err) {
      console.error('Failed to create incident', err);
    }
  };

  const fetchIncidents = async () => {
    try {
      const { data } = await api.get('/api/incidents');
      const grouped = { open: [], in_progress: [], resolved: [] };
      data.forEach(inc => {
        if (grouped[inc.status]) {
          grouped[inc.status].push(inc);
        } else {
          // Fallback if status is weird
          grouped.open.push(inc);
        }
      });
      setIncidents(grouped);
      setLoading(false);
    } catch (e) {
      console.error('Failed to load incidents', e);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
  }, []);

  // Listen for new incidents or updates via websocket
  useEffect(() => {
    fetchIncidents();
  }, [events]);

  const onDragEnd = async (result) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const sourceStatus = source.droppableId;
    const destStatus = destination.droppableId;
    
    // Find the incident
    const incidentToMove = incidents[sourceStatus].find(i => i.id.toString() === draggableId);
    if (!incidentToMove) return;

    // Optimistically update UI
    const newIncidents = { ...incidents };
    newIncidents[sourceStatus] = newIncidents[sourceStatus].filter(i => i.id.toString() !== draggableId);
    newIncidents[destStatus].splice(destination.index, 0, { ...incidentToMove, status: destStatus });
    setIncidents(newIncidents);

    // Call API
    try {
      await api.patch(`/api/incidents/${draggableId}`, { status: destStatus });
    } catch (e) {
      console.error('Failed to update incident status', e);
      // Revert on failure
      fetchIncidents();
    }
  };

  if (loading) {
    return <div className="loading-screen"><div className="spinner" /> Loading Case Management...</div>;
  }

  return (
    <div className="soc-page">
      <div className="soc-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>📋 Incident Response & Case Management</h1>
          <p>Track, assign, and resolve security incidents.</p>
        </div>
        <button onClick={() => setShowAddModal(true)} style={{ background: 'linear-gradient(135deg, var(--aegis-primary), #5a1fd0)', color: 'white', border: 'none', padding: '0.6rem 1.5rem', borderRadius: '10px', fontWeight: '600', cursor: 'pointer' }}>
          + New Incident
        </button>
      </div>

      {showAddModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--aegis-surface)', padding: '2rem', borderRadius: '16px', border: '1px solid var(--aegis-border)', width: '100%', maxWidth: '400px' }}>
            <h2 style={{ marginTop: 0, color: 'var(--aegis-text)' }}>Create Incident</h2>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <input required placeholder="Incident Title" value={newIncident.title} onChange={e => setNewIncident({...newIncident, title: e.target.value})} style={{ background: 'var(--aegis-bg)', border: '1px solid var(--aegis-border)', padding: '0.8rem', color: 'var(--aegis-text)', borderRadius: '8px' }} />
              <textarea placeholder="Description" value={newIncident.description} onChange={e => setNewIncident({...newIncident, description: e.target.value})} style={{ background: 'var(--aegis-bg)', border: '1px solid var(--aegis-border)', padding: '0.8rem', color: 'var(--aegis-text)', borderRadius: '8px', minHeight: '100px' }} />
              <select value={newIncident.severity} onChange={e => setNewIncident({...newIncident, severity: e.target.value})} style={{ background: 'var(--aegis-bg)', border: '1px solid var(--aegis-border)', padding: '0.8rem', color: 'var(--aegis-text)', borderRadius: '8px' }}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button type="submit" style={{ flex: 1, background: 'var(--aegis-primary)', color: 'white', border: 'none', padding: '0.8rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Create</button>
                <button type="button" onClick={() => setShowAddModal(false)} style={{ flex: 1, background: 'transparent', color: 'var(--aegis-text)', border: '1px solid var(--aegis-border)', padding: '0.8rem', borderRadius: '8px', cursor: 'pointer' }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <DragDropContext onDragEnd={onDragEnd}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', marginTop: '2rem' }}>
          {COLUMNS.map(column => (
            <div key={column.id} className="kanban-column" style={{ background: 'var(--aegis-surface-2)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--aegis-border)', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 250px)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--aegis-border)', paddingBottom: '0.5rem' }}>
                <h3 style={{ margin: 0, color: 'var(--aegis-text)', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: column.color }}></span>
                  {column.title}
                </h3>
                <span className="soc-badge" style={{ background: 'var(--aegis-surface)', color: 'var(--aegis-text-dim)' }}>
                  {incidents[column.id].length}
                </span>
              </div>

              <Droppable droppableId={column.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    style={{ flexGrow: 1, minHeight: '100px', overflowY: 'auto', padding: '0.5rem', transition: 'background-color 0.2s ease', backgroundColor: snapshot.isDraggingOver ? 'rgba(255,255,255,0.02)' : 'transparent', borderRadius: '8px' }}
                  >
                    {incidents[column.id].map((incident, index) => (
                      <Draggable key={incident.id.toString()} draggableId={incident.id.toString()} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            style={{
                              userSelect: 'none',
                              padding: '1rem',
                              margin: '0 0 1rem 0',
                              backgroundColor: 'var(--aegis-surface)',
                              color: 'var(--aegis-text)',
                              borderRadius: '8px',
                              border: `1px solid ${snapshot.isDragging ? 'var(--aegis-accent)' : 'var(--aegis-border)'}`,
                              boxShadow: snapshot.isDragging ? '0 8px 16px rgba(0,0,0,0.4)' : '0 2px 4px rgba(0,0,0,0.1)',
                              ...provided.draggableProps.style
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                              <span className="soc-badge" style={{ 
                                background: incident.severity === 'critical' ? 'rgba(255,59,92,0.2)' : 'rgba(255,140,66,0.2)', 
                                color: incident.severity === 'critical' ? 'var(--aegis-threat-red)' : 'var(--aegis-warn-orange)' 
                              }}>
                                {incident.severity.toUpperCase()}
                              </span>
                              <span style={{ fontSize: '0.75rem', color: 'var(--aegis-text-dim)' }}>
                                #{incident.id}
                              </span>
                            </div>
                            <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', fontWeight: '600' }}>{incident.title}</h4>
                            <p style={{ fontSize: '0.85rem', color: 'var(--aegis-text-dim)', marginBottom: '1rem', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                              {incident.description}
                            </p>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--aegis-text-dim)' }}>
                                <span>{new Date(incident.created_at).toLocaleDateString()}</span>
                                <span>{incident.alert_count} Alerts</span>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>
      </DragDropContext>
    </div>
  );
}
