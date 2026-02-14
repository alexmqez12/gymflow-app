'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useRealtimeCapacity } from '@/hooks/useRealtimeCapacity';
import OwnerDashboard from '@/components/OwnerDashboard';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';

// ─── Types ───────────────────────────────────────────────
interface ActiveUser {
  id: string;
  name: string;
  rut: string;
  membershipType: string;
  checkedInAt: string;
  minutesInside: number;
  checkinId: string;
}

interface ActivityItem {
  id: string;
  userName: string;
  type: 'entry' | 'exit';
  time: string;
  membershipType: string;
  timestamp: number;
}

interface HourlyData {
  hour: number;
  label: string;
  count: number;
  percentage: number;
}

interface Alert {
  type: 'warning' | 'critical' | 'info';
  message: string;
}

interface StaffDashboard {
  gym: {
    id: string;
    name: string;
    maxCapacity: number;
    currentCapacity: number;
    occupancyPercentage: number;
  };
  activeUsers: ActiveUser[];
  todayActivity: ActivityItem[];
  stats: {
    totalVisitsToday: number;
    currentInside: number;
    peakToday: number;
    peakHour: string;
    avgTimeInside: number;
  };
  hourlyToday: HourlyData[];
  alerts: Alert[];
}

interface User {
  id: string;
  name: string;
  role: string;
}

interface Gym {
  id: string;
  name: string;
  chain?: string;
}

// ─── Helpers ─────────────────────────────────────────────
const formatMinutes = (min: number) => {
  if (min < 60) return `${min}m`;
  return `${Math.floor(min / 60)}h ${min % 60}m`;
};

const AlertBadge = ({ type, message }: Alert) => {
  const styles = {
    critical: 'bg-red-500/15 border-red-500/40 text-red-300',
    warning: 'bg-yellow-500/15 border-yellow-500/40 text-yellow-300',
    info: 'bg-blue-500/15 border-blue-500/40 text-blue-300',
  };
  const icons = { critical: '🚨', warning: '⚠️', info: 'ℹ️' };
  return (
    <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm ${styles[type]}`}>
      <span>{icons[type]}</span>
      <span>{message}</span>
    </div>
  );
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-800 border border-white/15 rounded-xl p-3 shadow-xl">
      <p className="text-gray-300 text-xs font-bold mb-1">{label}</p>
      <p className="text-blue-300 font-bold">{payload[0]?.value} personas</p>
      <p className="text-gray-500 text-xs">{payload[0]?.payload?.percentage}% del aforo</p>
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [selectedGymId, setSelectedGymId] = useState('');
  const [activeTab, setActiveTab] = useState<'staff' | 'owner'>('staff');
  const [dashboard, setDashboard] = useState<StaffDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState('');
  const [authError, setAuthError] = useState(false);
  const [newActivity, setNewActivity] = useState<string[]>([]);
  const prevActivityRef = useRef<string[]>([]);

  const { capacity } = useRealtimeCapacity(selectedGymId);

  // ── Auth check ────────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem('gymflow_user');
    if (!saved) { router.push('/perfil'); return; }
    const parsed = JSON.parse(saved);
    if (!['ADMIN', 'GYM_STAFF'].includes(parsed.role)) {
      setAuthError(true);
      return;
    }
    setUser(parsed);
    // STAFF solo puede ver su gym, OWNER/ADMIN pueden ver todos
    loadGyms();
  }, []);

  const loadGyms = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/gyms');
      if (res.ok) {
        const data = await res.json();
        setGyms(data);
        if (data.length > 0) setSelectedGymId(data[0].id);
      }
    } catch {}
  };

  // ── Load dashboard ────────────────────────────────────
  const loadDashboard = useCallback(async () => {
    if (!selectedGymId) return;
    try {
      const token = localStorage.getItem('gymflow_token');
      const res = await fetch(
        `http://localhost:3001/api/checkins/dashboard/staff/${selectedGymId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setDashboard(data);
        setLastUpdated(new Date().toLocaleTimeString('es-CL'));

        // Detectar nueva actividad para animación
        const newIds = data.todayActivity.map((a: ActivityItem) => a.id);
        const added = newIds.filter((id: string) => !prevActivityRef.current.includes(id));
        if (added.length > 0 && prevActivityRef.current.length > 0) {
          setNewActivity(added);
          setTimeout(() => setNewActivity([]), 2000);
        }
        prevActivityRef.current = newIds;
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [selectedGymId]);

  useEffect(() => {
    loadDashboard();
    const iv = setInterval(loadDashboard, 15000); // Refresh cada 15s
    return () => clearInterval(iv);
  }, [loadDashboard]);

  // ── WebSocket updates ─────────────────────────────────
  useEffect(() => {
    if (capacity?.gymId === selectedGymId && dashboard) {
      setDashboard(prev => prev ? {
        ...prev,
        gym: {
          ...prev.gym,
          currentCapacity: capacity.current,
          occupancyPercentage: capacity.percentage,
        },
        stats: { ...prev.stats, currentInside: capacity.current },
      } : null);
      loadDashboard(); // Recargar para tener lista actualizada
    }
  }, [capacity]);

  if (authError) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="text-center bg-white/5 border border-white/10 rounded-2xl p-8 max-w-sm">
          <div className="text-5xl mb-4">🔒</div>
          <h2 className="text-white font-bold text-xl mb-2">Acceso restringido</h2>
          <p className="text-gray-400 text-sm mb-6">
            Esta sección es solo para Staff, Owner o Admin.
          </p>
          <button
            onClick={() => router.push('/')}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-xl transition w-full"
          >
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-t-2 border-blue-500 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Cargando dashboard...</p>
        </div>
      </div>
    );
  }

  const gym = dashboard?.gym;
  const stats = dashboard?.stats;
  const pct = gym?.occupancyPercentage ?? 0;

  const oc = pct < 50
    ? { bar: 'bg-green-500', text: 'text-green-400', badge: 'bg-green-500/20 text-green-400 border-green-500/30', label: 'Disponible' }
    : pct < 75
    ? { bar: 'bg-yellow-500', text: 'text-yellow-400', badge: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', label: 'Moderado' }
    : pct < 90
    ? { bar: 'bg-orange-500', text: 'text-orange-400', badge: 'bg-orange-500/20 text-orange-400 border-orange-500/30', label: 'Lleno' }
    : { bar: 'bg-red-500', text: 'text-red-400', badge: 'bg-red-500/20 text-red-400 border-red-500/30', label: 'Completo' };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-blue-950 pb-24">
      <div className="max-w-7xl mx-auto px-4 py-6">

        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6"
        >
          <div>
            <h1 className="text-2xl font-bold text-white">Dashboard Operativo</h1>
            <p className="text-gray-400 text-sm mt-0.5">
              {lastUpdated ? `Actualizado: ${lastUpdated}` : 'Cargando...'}
              <span className="ml-2 text-xs text-gray-600">· Auto-refresh 15s</span>
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Selector de gym */}
            <select
              value={selectedGymId}
              onChange={e => setSelectedGymId(e.target.value)}
              className="bg-white/8 border border-white/10 text-white text-sm px-4 py-2.5 rounded-xl focus:outline-none focus:border-blue-500 transition"
            >
              {gyms.map(g => (
                <option key={g.id} value={g.id} className="bg-gray-800">
                  {g.name}
                </option>
              ))}
            </select>

            {/* Tabs Staff / Owner */}
            <div className="flex bg-gray-800 rounded-xl p-1 gap-1">
              <button
                onClick={() => setActiveTab('staff')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === 'staff'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                🧑‍💼 Staff
              </button>
              {user?.role === 'ADMIN' && (
                <button onClick={() => setActiveTab('owner')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeTab === 'owner'
                      ? 'bg-purple-600 text-white shadow'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  🏢 Owner
                </button>
              )}
            </div>

            <button
              onClick={loadDashboard}
              className="bg-white/8 hover:bg-white/15 text-gray-400 hover:text-white p-2.5 rounded-xl transition"
              title="Actualizar"
            >
              🔄
            </button>
          </div>
        </motion.div>

        {/* ── Alertas ── */}
        <AnimatePresence>
          {dashboard?.alerts && dashboard.alerts.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex flex-col gap-2 mb-5"
            >
              {dashboard.alerts.map((a, i) => (
                <AlertBadge key={i} {...a} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ═══════════════════════════════════════════ */}
        {/* TAB: STAFF                                  */}
        {/* ═══════════════════════════════════════════ */}
        <AnimatePresence mode="wait">
          {activeTab === 'staff' && (
            <motion.div
              key="staff"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {/* Stats row */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-5">
                {/* Aforo actual - ocupa 2 columnas */}
                <div className="col-span-2 bg-white/5 border border-white/10 rounded-2xl p-5">
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="text-gray-400 text-sm">Aforo Actual</h3>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${oc.badge}`}>
                      {oc.label}
                    </span>
                  </div>
                  <div className="flex items-end gap-2 mb-3">
                    <motion.span
                      key={gym?.currentCapacity}
                      initial={{ scale: 1.15 }}
                      animate={{ scale: 1 }}
                      className={`text-5xl font-bold ${oc.text}`}
                    >
                      {gym?.currentCapacity ?? 0}
                    </motion.span>
                    <span className="text-gray-500 text-2xl mb-1">/{gym?.maxCapacity ?? 0}</span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-2.5 overflow-hidden">
                    <motion.div
                      className={`h-2.5 rounded-full ${oc.bar}`}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.8 }}
                    />
                  </div>
                  <div className="flex justify-between mt-1.5">
                    <span className="text-gray-500 text-xs">{pct}% ocupado</span>
                    <span className="text-gray-500 text-xs">
                      {(gym?.maxCapacity ?? 0) - (gym?.currentCapacity ?? 0)} libres
                    </span>
                  </div>
                </div>

                {[
                  { label: 'Visitas hoy', value: stats?.totalVisitsToday ?? 0, icon: '🎫', color: 'text-blue-400' },
                  { label: 'Hora punta', value: stats?.peakHour ?? '--', icon: '🔥', color: 'text-orange-400', sub: `${stats?.peakToday ?? 0} personas` },
                  { label: 'Tiempo prom.', value: formatMinutes(stats?.avgTimeInside ?? 0), icon: '⏱️', color: 'text-purple-400', sub: 'por visita' },
                ].map((s, i) => (
                  <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-5">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-gray-400 text-xs">{s.label}</h3>
                      <span className="text-xl">{s.icon}</span>
                    </div>
                    <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
                    {s.sub && <p className="text-gray-500 text-xs mt-1">{s.sub}</p>}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

                {/* Gráfico de hoy */}
                <div className="lg:col-span-2 bg-white/5 border border-white/10 rounded-2xl p-5">
                  <h3 className="text-white font-bold mb-4">📊 Ocupación de hoy por hora</h3>
                  {(dashboard?.hourlyToday?.length ?? 0) === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <p className="text-3xl mb-2">📊</p>
                      <p className="text-sm">Sin actividad aún hoy</p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <AreaChart data={dashboard?.hourlyToday} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                        <defs>
                          <linearGradient id="staffGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} />
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                        <XAxis dataKey="label" tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 10 }} tickLine={false} stroke="rgba(255,255,255,0.1)" />
                        <YAxis tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 10 }} tickLine={false} stroke="rgba(255,255,255,0.1)" domain={[0, gym?.maxCapacity ?? 100]} />
                        <Tooltip content={<CustomTooltip />} />
                        <ReferenceLine y={gym?.maxCapacity} stroke="rgba(239,68,68,0.4)" strokeDasharray="4 4" />
                        <Area type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2.5} fill="url(#staffGrad)" dot={false} activeDot={{ r: 5, fill: '#60a5fa' }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>

                {/* Actividad en tiempo real */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-white font-bold">⚡ Actividad</h3>
                    <div className="flex gap-2 text-xs">
                      <span className="text-green-400 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" /> Entrada
                      </span>
                      <span className="text-blue-400 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" /> Salida
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-1.5 max-h-48 pr-1">
                    <AnimatePresence>
                      {(dashboard?.todayActivity ?? []).length === 0 ? (
                        <p className="text-gray-500 text-xs text-center py-8">Sin actividad hoy</p>
                      ) : (
                        dashboard?.todayActivity.map((a) => (
                          <motion.div
                            key={a.id}
                            initial={newActivity.includes(a.id) ? { opacity: 0, x: -10, backgroundColor: 'rgba(59,130,246,0.2)' } : { opacity: 1 }}
                            animate={{ opacity: 1, x: 0, backgroundColor: 'transparent' }}
                            transition={{ duration: 0.3 }}
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border ${
                              a.type === 'entry'
                                ? 'bg-green-500/8 border-green-500/15'
                                : 'bg-blue-500/8 border-blue-500/15'
                            }`}
                          >
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0 font-bold ${
                              a.type === 'entry' ? 'bg-green-500' : 'bg-blue-500'
                            } text-white`}>
                              {a.type === 'entry' ? '→' : '←'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-white text-xs font-medium truncate">{a.userName}</p>
                              <p className="text-gray-500 text-xs">{a.membershipType}</p>
                            </div>
                            <p className="text-gray-500 text-xs flex-shrink-0">{a.time}</p>
                          </motion.div>
                        ))
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>

              {/* Usuarios activos */}
              <div className="mt-5 bg-white/5 border border-white/10 rounded-2xl p-5">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-white font-bold">
                    👥 Dentro ahora
                    <span className={`ml-2 text-sm px-2.5 py-0.5 rounded-full ${oc.badge} border`}>
                      {stats?.currentInside ?? 0}
                    </span>
                  </h3>
                </div>

                {(dashboard?.activeUsers ?? []).length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p className="text-3xl mb-2">🏋️</p>
                    <p className="text-sm">No hay nadie dentro ahora</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="text-gray-500 text-xs border-b border-white/5">
                          <th className="text-left pb-3 font-medium">Usuario</th>
                          <th className="text-left pb-3 font-medium">RUT</th>
                          <th className="text-left pb-3 font-medium">Membresía</th>
                          <th className="text-left pb-3 font-medium">Ingresó</th>
                          <th className="text-left pb-3 font-medium">Tiempo dentro</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        <AnimatePresence>
                          {dashboard?.activeUsers.map((u) => (
                            <motion.tr
                              key={u.id}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="hover:bg-white/3 transition"
                            >
                              <td className="py-3 pr-4">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                                    {u.name.charAt(0)}
                                  </div>
                                  <span className="text-white text-sm font-medium">{u.name}</span>
                                </div>
                              </td>
                              <td className="py-3 pr-4">
                                <span className="text-gray-400 text-sm font-mono">{u.rut}</span>
                              </td>
                              <td className="py-3 pr-4">
                                <span className="text-xs px-2 py-1 bg-blue-500/15 border border-blue-500/25 text-blue-300 rounded-lg">
                                  {u.membershipType}
                                </span>
                              </td>
                              <td className="py-3 pr-4">
                                <span className="text-gray-300 text-sm">{u.checkedInAt}</span>
                              </td>
                              <td className="py-3">
                                <span className={`text-sm font-medium ${
                                  u.minutesInside > 120 ? 'text-orange-400' : 'text-green-400'
                                }`}>
                                  {formatMinutes(u.minutesInside)}
                                </span>
                              </td>
                            </motion.tr>
                          ))}
                        </AnimatePresence>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ═══════════════════════════════════════════ */}
          {/* TAB: OWNER (placeholder para siguiente fase) */}
          {/* ═══════════════════════════════════════════ */}
          {activeTab === 'owner' && (
            <motion.div
                key="owner"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
            >
                <OwnerDashboard
                gymId={selectedGymId}
                gymName={gyms.find(g => g.id === selectedGymId)?.name ?? ''}
                />
            </motion.div>
            )}
        </AnimatePresence>
      </div>
    </div>
  );
}