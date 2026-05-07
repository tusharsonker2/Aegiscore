import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext(null);

export const useSocket = () => useContext(SocketContext);

export function SocketProvider({ children }) {
  const [socket, setSocket] = useState(null);
  const [events, setEvents] = useState([]);

  useEffect(() => {
    const s = io('http://localhost:5000', {
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });

    s.on('connect', () => {
      console.log('[AegisCore] WebSocket connected:', s.id);
    });

    s.on('threat_detected', (data) => {
      setEvents(prev => [{ type: 'threat', ...data, time: new Date().toISOString() }, ...prev].slice(0, 200));
    });

    s.on('chat_threat', (data) => {
      setEvents(prev => [{ type: 'chat_threat', ...data, time: new Date().toISOString() }, ...prev].slice(0, 200));
    });

    s.on('log_uploaded', (data) => {
      setEvents(prev => [{ type: 'log_upload', ...data, time: new Date().toISOString() }, ...prev].slice(0, 200));
    });

    s.on('logs_created', (data) => {
      setEvents(prev => [{ type: 'logs_created', ...data, time: new Date().toISOString() }, ...prev].slice(0, 200));
    });

    setSocket(s);
    return () => s.disconnect();
  }, []);

  return (
    <SocketContext.Provider value={{ socket, events }}>
      {children}
    </SocketContext.Provider>
  );
}
