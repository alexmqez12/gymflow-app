'use client';

import { useEffect, useState } from 'react';

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

  if (loading) return <div className="p-8">Cargando gimnasios...</div>;
  if (error) return <div className="p-8 text-red-500">Error: {error}</div>;

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <h1 className="text-4xl font-bold mb-8 text-center">🏋️ GymFlow</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
        {gyms.map(gym => (
          <div key={gym.id} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition">
            <h2 className="text-xl font-bold mb-2">{gym.name}</h2>
            <p className="text-gray-600 text-sm mb-4">📍 {gym.address}</p>
            
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="font-semibold">Aforo:</span>
                <span className="text-lg font-bold">{gym.currentCapacity}/{gym.maxCapacity}</span>
              </div>
              
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div 
                  className={`h-3 rounded-full ${
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
    </main>
  );
}
