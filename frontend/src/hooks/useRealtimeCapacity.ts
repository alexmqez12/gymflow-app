'use client';

import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface CapacityUpdate {
  gymId: string;
  gymName: string;
  current: number;
  max: number;
  available: number;
  percentage: number;
}

export function useRealtimeCapacity(gymId?: string) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [capacity, setCapacity] = useState<CapacityUpdate | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Conectar al servidor WebSocket
    const newSocket = io(process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001', {
      transports: ['websocket'],
    });

    newSocket.on('connect', () => {
      console.log('✅ WebSocket connected');
      setIsConnected(true);

      // Si hay un gymId específico, suscribirse
      if (gymId) {
        newSocket.emit('subscribe:gym', gymId);
      }
    });

    newSocket.on('disconnect', () => {
      console.log('❌ WebSocket disconnected');
      setIsConnected(false);
    });

    // Escuchar actualizaciones de capacidad
    newSocket.on('capacity:update', (data: CapacityUpdate) => {
      console.log('📊 Capacity update received:', data);
      setCapacity(data);
    });

    // Escuchar actualizaciones globales
    newSocket.on('capacity:update:all', (data: CapacityUpdate) => {
      console.log('📊 Global capacity update:', data);
      setCapacity(data);
    });

    setSocket(newSocket);

    // Cleanup al desmontar
    return () => {
      if (gymId) {
        newSocket.emit('unsubscribe:gym', gymId);
      }
      newSocket.disconnect();
    };
  }, [gymId]);

  return { socket, capacity, isConnected };
}