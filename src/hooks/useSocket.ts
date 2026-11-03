import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { SIGNALING_SERVER, SOCKET_OPTIONS } from '../config';
import type { ConnectionStatus } from '../components/ConnectionBanner';

interface UseSocketReturn {
  socket: Socket | null;
  connectionStatus: ConnectionStatus;
}

/**
 * Manages a single socket.io connection with built-in reconnection,
 * status tracking, and cleanup.
 */
export function useSocket(): UseSocketReturn {
  const socketRef = useRef<Socket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');

  useEffect(() => {
    const socket = io(SIGNALING_SERVER, SOCKET_OPTIONS);
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[useSocket] Connected:', socket.id);
      setConnectionStatus('connected');
    });

    socket.on('disconnect', (reason) => {
      console.log('[useSocket] Disconnected:', reason);
      setConnectionStatus('disconnected');
    });

    socket.on('reconnect_attempt', (attempt) => {
      console.log('[useSocket] Reconnection attempt:', attempt);
      setConnectionStatus('reconnecting');
    });

    socket.on('reconnect', () => {
      console.log('[useSocket] Reconnected');
      setConnectionStatus('connected');
    });

    socket.on('reconnect_failed', () => {
      console.log('[useSocket] Reconnection failed');
      setConnectionStatus('error');
    });

    socket.on('connect_error', (err) => {
      console.log('[useSocket] Connection error:', err.message);
      setConnectionStatus('error');
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  return { socket: socketRef.current, connectionStatus };
}
