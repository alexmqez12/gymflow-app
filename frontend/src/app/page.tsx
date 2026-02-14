'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRealtimeCapacity } from '@/hooks/useRealtimeCapacity';
import { motion, AnimatePresence } from 'framer-motion';

interface Gym {
  id: string;
  name: string;
  address: string;
  currentCapacity: number;
  maxCapacity: number;
  occupancyPercentage: number;
  rating: number;
  features: string[];
  chain?: string;
  description?: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface Membership {
  type: string;
  status: string;
  endDate: string;
  gyms: { gym: { id: string; chain?: string } }[];
}

export default function Home() {
  const router = useRouter();
  const [allGyms, setAllGyms] = useState<Gym[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'available' | 'mine'>('all');
  const { capacity } = useRealtimeCapacity();

  // ── Auth ──────────────────────────────────────────────
  useEffect(() => {
    const savedUser = localStorage.getItem('gymflow_user');
    const savedToken = localStorage.getItem('gymflow_token');

    if (savedUser && savedToken) {
      const parsed = JSON.parse(savedUser);
      setUser(parsed);
      loadMembership(parsed.id);
    }

    const handleAuth = () => {
      const u = localStorage.getItem('gymflow_user');
      if (u) {
        const parsed = JSON.parse(u);
        setUser(parsed);
        loadMembership(parsed.id);
      } else {
        setUser(null);
        setMembership(null);
      }
    };

    window.addEventListener('gymflow-auth', handleAuth);
    return () => window.removeEventListener('gymflow-auth', handleAuth);
  }, []);

  const loadMembership = async (userId: string) => {
    try {
      const res = await fetch(`http://localhost:3001/api/memberships/user/${userId}`);
      if (res.ok) setMembership(await res.json());
      else setMembership(null);
    } catch {
      setMembership(null);
    }
  };

  // ── Carga de gyms ─────────────────────────────────────
  useEffect(() => {
    const savedUser = localStorage.getItem('gymflow_user');

    if (!savedUser) {
      setAllGyms([]);
      setLoading(false);
      return;
    }

    const parsed = JSON.parse(savedUser);

    fetch(`http://localhost:3001/api/gyms/for-user/${parsed.id}`)
      .then(r => r.json())
      .then(data => {
        if (!Array.isArray(data)) { setAllGyms([]); return; }
        setAllGyms(data.map((gym: any) => ({
          ...gym,
          currentCapacity: Number(gym.currentCapacity) || 0,
          maxCapacity: Number(gym.maxCapacity) || 0,
          occupancyPercentage: Number(gym.occupancyPercentage) || 0,
          rating: Number(gym.rating) || 0,
          features: Array.isArray(gym.features) ? gym.features : [],
        })));
      })
      .catch(() => setAllGyms([]))
      .finally(() => setLoading(false));
  }, []);

  // ── Realtime ──────────────────────────────────────────
  useEffect(() => {
    if (capacity) {
      setAllGyms(prev =>
        prev.map(gym =>
          gym.id === capacity.gymId
            ? { ...gym, currentCapacity: Number(capacity.current) || 0, occupancyPercentage: Number(capacity.percentage) || 0 }
            : gym
        )
      );
    }
  }, [capacity]);

  // ── Helpers ───────────────────────────────────────────
  const hasGymAccess = (gym: Gym): boolean => {
    if (!user) return false;
    if (user.role === 'ADMIN' || user.role === 'GYM_STAFF') return true;
    if (!membership) return false;
    const direct = membership.gyms.some(mg => mg.gym.id === gym.id);
    if (direct) return true;
    if (gym.chain) return membership.gyms.some(mg => mg.gym.chain === gym.chain);
    return false;
  };

  const getOccupancyStyle = (pct: number) => {
    if (pct < 50)  return { bar: 'bg-green-500',  text: 'text-green-400',  label: 'Disponible', badge: 'bg-green-500/20 text-green-400 border-green-500/30',  dot: 'bg-green-400' };
    if (pct < 75)  return { bar: 'bg-yellow-500', text: 'text-yellow-400', label: 'Moderado',   badge: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', dot: 'bg-yellow-400' };
    if (pct < 90)  return { bar: 'bg-orange-500', text: 'text-orange-400', label: 'Lleno',      badge: 'bg-orange-500/20 text-orange-400 border-orange-500/30', dot: 'bg-orange-400' };
    return           { bar: 'bg-red-500',    text: 'text-red-400',    label: 'Completo',   badge: 'bg-red-500/20 text-red-400 border-red-500/30',          dot: 'bg-red-400' };
  };

  const membershipColors: Record<string, string> = {
    PREMIUM:  'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    SMARTFIT: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    POWERFIT: 'bg-red-500/20 text-red-400 border-red-500/30',
    BASIC:    'bg-gray-500/20 text-gray-400 border-gray-500/30',
    CUSTOM:   'bg-purple-500/20 text-purple-400 border-purple-500/30',
  };

  const filteredGyms = allGyms.filter(gym => {
    if (filter === 'available') return gym.occupancyPercentage < 90;
    if (filter === 'mine') return hasGymAccess(gym);
    return true;
  });

  const totalInside   = allGyms.reduce((sum, g) => sum + g.currentCapacity, 0);
  const availableGyms = allGyms.filter(g => g.occupancyPercentage < 90).length;

  // ── Loading ───────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-t-2 border-blue-500 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Cargando gimnasios...</p>
        </div>
      </div>
    );
  }

  // ── Sin login ─────────────────────────────────────────
  if (!user) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-blue-950 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-md"
        >
          <div className="text-7xl mb-6">🏋️</div>
          <h2 className="text-3xl font-bold text-white mb-3">Bienvenido a GymFlow</h2>
          <p className="text-gray-400 mb-2">Aforo en tiempo real de tu gimnasio</p>
          <p className="text-gray-500 text-sm mb-8">Inicia sesión para ver los gimnasios de tu membresía</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => router.push('/perfil')}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-8 py-3 rounded-xl transition shadow-lg shadow-blue-500/25"
            >
              Iniciar sesión
            </button>
            <button
              onClick={() => router.push('/registro')}
              className="bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold px-8 py-3 rounded-xl transition"
            >
              Registrarse
            </button>
          </div>
        </motion.div>
      </main>
    );
  }

  // ── Render ────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-blue-950 pb-24">
      <div className="max-w-6xl mx-auto px-4 pt-8">

        {/* ── Bienvenida ── */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <h1 className="text-2xl font-bold text-white">
            Hola, {user.name.split(' ')[0]} 👋
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            {membership
              ? `Membresía ${membership.type} · ${membership.status === 'ACTIVE' ? '✅ Activa' : '⚠️ Inactiva'}`
              : 'Sin membresía activa'
            }
          </p>
        </motion.div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Gimnasios',     value: allGyms.length,  color: 'text-blue-400'  },
            { label: 'Personas ahora', value: totalInside,    color: 'text-green-400', animate: true },
            { label: 'Con espacio',   value: availableGyms,  color: 'text-yellow-400' },
          ].map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center"
            >
              {stat.animate ? (
                <motion.p key={stat.value} initial={{ scale: 1.2 }} animate={{ scale: 1 }} className={`text-3xl font-bold ${stat.color}`}>
                  {stat.value}
                </motion.p>
              ) : (
                <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
              )}
              <p className="text-gray-400 text-xs mt-1">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        {/* ── Filtros ── */}
        <div className="flex gap-2 mb-5 flex-wrap">
          {[
            { key: 'all',       label: '🏋️ Todos'      },
            { key: 'available', label: '✅ Con espacio' },
            { key: 'mine',      label: '⭐ Mi membresía' },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key as typeof filter)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
                filter === f.key
                  ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/20'
                  : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10 hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
          {filteredGyms.length !== allGyms.length && (
            <span className="text-gray-500 text-xs self-center ml-1">
              {filteredGyms.length} de {allGyms.length}
            </span>
          )}
        </div>

        {/* ── Sin resultados ── */}
        {filteredGyms.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <p className="text-5xl mb-4">🏋️</p>
            <p className="text-white font-bold text-lg mb-1">Sin gimnasios disponibles</p>
            <p className="text-gray-500 text-sm">
              {filter === 'mine'
                ? 'No tienes gimnasios en tu membresía activa'
                : 'Intenta con otro filtro'}
            </p>
          </motion.div>
        )}

        {/* ── Grid de gyms ── */}
        <div className="grid md:grid-cols-2 gap-5">
          <AnimatePresence mode="popLayout">
            {filteredGyms.map((gym, idx) => {
              const pct = gym.occupancyPercentage;
              const c   = getOccupancyStyle(pct);
              const access = hasGymAccess(gym);

              return (
                <motion.div
                  key={gym.id}
                  layout
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: idx * 0.06 }}
                  className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:bg-white/8 hover:border-white/20 transition-all group"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h2 className="text-white font-bold text-lg leading-tight">{gym.name}</h2>
                        {gym.chain && (
                          <span className="text-xs bg-white/10 text-gray-400 px-2 py-0.5 rounded-full flex-shrink-0">
                            {gym.chain}
                          </span>
                        )}
                      </div>
                      <p className="text-gray-400 text-sm truncate">📍 {gym.address}</p>
                    </div>

                    {/* Badge membresía */}
                    {membership && access && (
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full border flex-shrink-0 ml-2 ${
                        membershipColors[membership.type] || 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                      }`}>
                        {membership.type}
                      </span>
                    )}
                  </div>

                  {/* Aforo */}
                  <div className="mb-3">
                    <div className="flex justify-between items-center mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${c.dot} animate-pulse`} />
                        <span className={`text-sm font-medium ${c.text}`}>{c.label}</span>
                      </div>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${c.badge}`}>
                        {pct}%
                      </span>
                    </div>

                    <div className="flex items-end gap-1 mb-2">
                      <motion.span
                        key={gym.currentCapacity}
                        initial={{ scale: 1.15 }}
                        animate={{ scale: 1 }}
                        className={`text-3xl font-bold ${c.text}`}
                      >
                        {gym.currentCapacity}
                      </motion.span>
                      <span className="text-gray-500 text-lg mb-0.5">/{gym.maxCapacity}</span>
                      <span className="text-gray-500 text-xs mb-1 ml-1">personas</span>
                    </div>

                    <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                      <motion.div
                        className={`h-2 rounded-full ${c.bar}`}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                      />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-gray-600 text-xs">{pct}% ocupado</span>
                      <span className="text-gray-600 text-xs">{gym.maxCapacity - gym.currentCapacity} libres</span>
                    </div>
                  </div>

                  {/* Features */}
                  {gym.features.length > 0 && (
                    <div className="flex gap-1.5 flex-wrap mb-4">
                      {gym.features.slice(0, 3).map((f, i) => (
                        <span key={i} className="text-xs bg-white/5 text-gray-400 px-2 py-0.5 rounded-lg border border-white/5">
                          {f}
                        </span>
                      ))}
                      {gym.features.length > 3 && (
                        <span className="text-xs text-gray-500">+{gym.features.length - 3}</span>
                      )}
                    </div>
                  )}

                  {/* Footer */}
                  <div className="flex items-center justify-between">
                    <span className="text-yellow-400 text-sm font-medium">
                      ⭐ {gym.rating.toFixed(1)}
                    </span>

                    <button
                      onClick={() => router.push(`/gym/${gym.id}`)}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 shadow-lg shadow-blue-500/20 group-hover:shadow-blue-500/30"
                    >
                      Ver detalles
                      <svg className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

      </div>
    </main>
  );
}
