'use client';

import { useEffect, useState } from 'react';
import { useRealtimeCapacity } from '../hooks/useRealtimeCapacity';

interface Gym {
  id: string;
  name: string;
  address: string;
  currentCapacity: number;
  maxCapacity: number;
  occupancyPercentage: number;
  rating: number;
  features: string[];
}

export default function Home() {
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Conectar WebSocket para actualizaciones globales
  const { capacity, isConnected } = useRealtimeCapacity();

  // Cargar gimnasios inicialmente
  useEffect(() => {
    fetch('http://localhost:3001/api/gyms')
      .then(res => res.json())
      .then(data => {
        setGyms(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // Actualizar capacidad cuando llega un evento WebSocket
  useEffect(() => {
    if (capacity) {
      setGyms(prevGyms =>
        prevGyms.map(gym =>
          gym.id === capacity.gymId
            ? {
                ...gym,
                currentCapacity: capacity.current,
                occupancyPercentage: capacity.percentage,
              }
            : gym
        )
      );
    }
  }, [capacity]);

  if (loading) return <div className="p-8">Cargando gimnasios...</div>;
  if (error) return <div className="p-8 text-red-500">Error: {error}</div>;

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold">🏋️ GymFlow</h1>
          
          {/* Indicador de conexión */}
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            <span className="text-sm text-gray-600">
              {isConnected ? 'Conectado' : 'Desconectado'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {gyms.map(gym => (
            <div key={gym.id} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition">
              <h2 className="text-xl font-bold mb-2">{gym.name}</h2>
              <p className="text-gray-600 text-sm mb-4">📍 {gym.address}</p>
              
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className={`text-sm font-semibold ${
                    gym.occupancyPercentage < 50 ? 'text-green-600' :
                    gym.occupancyPercentage < 75 ? 'text-yellow-600' :
                    'text-red-600'
                  }`}>
                    {gym.occupancyPercentage < 50 ? 'Disponible' :
                     gym.occupancyPercentage < 75 ? 'Moderado' :
                     gym.occupancyPercentage < 90 ? 'Lleno' : 'Completo'}
                  </span>
                  <span className="text-2xl font-bold text-gray-800">
                    {gym.currentCapacity}/{gym.maxCapacity}
                  </span>
                </div>
                
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div 
                    className={`h-3 rounded-full transition-all duration-500 ${
                      gym.occupancyPercentage < 50 ? 'bg-green-500' :
                      gym.occupancyPercentage < 75 ? 'bg-yellow-500' :
                      'bg-red-500'
                    }`}
                    style={{ width: `${gym.occupancyPercentage}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">{gym.occupancyPercentage}% ocupado</p>
              </div>

              <div className="flex flex-wrap gap-2 mb-3">
                {gym.features.map((feature, idx) => (
                  <span key={idx} className="px-2 py-1 bg-blue-50 text-blue-600 text-xs rounded-full">
                    {feature}
                  </span>
                ))}
              </div>

              <div className="flex items-center">
                <span className="text-yellow-500">⭐</span>
                <span className="ml-1 font-semibold">{gym.rating}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
