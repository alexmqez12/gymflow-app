'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useRealtimeCapacity } from '@/hooks/useRealtimeCapacity';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, ComposedChart, Line,
} from 'recharts';

// ─── Types ───────────────────────────────────────────────
interface HourData {
  hour: number;
  label: string;
  today: number | null;
  yesterday: number;
  weekAvg: number;
  prediction: number | null;
  isPrediction: boolean;
  isCurrentHour: boolean;
}

interface NextHour {
  hour: number;
  label: string;
  value: number;
  percentage: number;
  offset: number;
}

interface PredictiveStats {
  gymId: string;
  gymName: string;
  maxCapacity: number;
  currentCapacity: number;
  hasRealData: boolean;
  fullDay: HourData[];
  nextThreeHours: NextHour[];
  insights: {
    bestHour: string;
    bestHourValue: number;
    bestHourPercentage: number;
    trend: 'rising' | 'falling' | 'stable';
    trendValue: number;
    vsYesterday: number;
    vsYesterdayPct: number;
    nextHourPrediction: number;
    nextHourPercentage: number;
  };
}

interface Gym {
  id: string;
  name: string;
  address: string;
  description?: string;
  maxCapacity: number;
  currentCapacity: number;
  occupancyPercentage: number;
  rating: number;
  features: string[];
  chain?: string;
  latitude: number;
  longitude: number;
}

interface User { id: string; name: string; role: string; }
interface Membership { gyms: { gym: { id: string; chain?: string } }[]; }

// ─── Tooltip ─────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload as HourData;
  return (
    <div className="bg-gray-800/98 border border-white/15 rounded-xl p-3 shadow-xl min-w-[160px]">
      <p className="text-gray-300 text-xs font-bold mb-2">{label}</p>
      {payload.map((p: any, i: number) => (
        p.value !== null && p.value !== undefined && (
          <div key={i} className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
            <span className="text-gray-400 text-xs">{p.name}:</span>
            <span className="text-white text-xs font-bold">{p.value}</span>
          </div>
        )
      ))}
      {d?.isPrediction && (
        <p className="text-purple-400 text-xs mt-1 border-t border-white/10 pt-1">✦ Predicción</p>
      )}
      {d?.isCurrentHour && (
        <p className="text-green-400 text-xs mt-1 border-t border-white/10 pt-1">● Hora actual</p>
      )}
    </div>
  );
};

// ─── Main ─────────────────────────────────────────────────
export default function GymDetailPage() {
  const params = useParams();
  const router = useRouter();
  const gymId = params.gymId as string;

  const [gym, setGym] = useState<Gym | null>(null);
  const [predictive, setPredictive] = useState<PredictiveStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [lastUpdated, setLastUpdated] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [hasAccess, setHasAccess] = useState<boolean | null>(null); // null = aún calculando
  const [activeTab, setActiveTab] = useState<'today' | 'predict' | 'week'>('today');

  const { capacity, isConnected } = useRealtimeCapacity(gymId);

  // ── Auth & membership ──────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem('gymflow_user');

    // Sin login → redirigir al perfil
    if (!saved) {
      router.push('/perfil');
      return;
    }

    const parsed = JSON.parse(saved);
    setUser(parsed);

    fetch(`http://localhost:3001/api/memberships/user/${parsed.id}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) setMembership(data);
        setAuthChecked(true);
      })
      .catch(() => setAuthChecked(true));
  }, []);

  // ── Calcular acceso ────────────────────────────────────
  useEffect(() => {
    if (!authChecked || !gym) return;

    // Sin usuario → sin acceso
    if (!user) {
      setHasAccess(false);
      return;
    }

    // ADMIN y GYM_STAFF ven todo
    if (user.role === 'ADMIN' || user.role === 'GYM_STAFF') {
      setHasAccess(true);
      return;
    }

    // Sin membresía → sin acceso
    if (!membership) {
      setHasAccess(false);
      return;
    }

    // Acceso directo por gymId
    const direct = membership.gyms.some(mg => mg.gym.id === gymId);
    if (direct) { setHasAccess(true); return; }

    // Acceso por cadena
    if (gym.chain) {
      const chainAccess = membership.gyms.some(mg => mg.gym.chain === gym.chain);
      setHasAccess(chainAccess);
      return;
    }

    setHasAccess(false);
  }, [authChecked, user, gym, membership, gymId]);

  // ── Redirigir si no tiene acceso ───────────────────────
  useEffect(() => {
    if (hasAccess === false && authChecked && gym) {
      // Pequeño delay para evitar flash
      const timer = setTimeout(() => router.push('/'), 100);
      return () => clearTimeout(timer);
    }
  }, [hasAccess, authChecked, gym]);

  // ── Load data ──────────────────────────────────────────
  const loadData = useCallback(async () => {
    try {
      const [gymRes, predRes] = await Promise.all([
        fetch(`http://localhost:3001/api/gyms/${gymId}`),
        fetch(`http://localhost:3001/api/gyms/${gymId}/predictive`),
      ]);
      if (gymRes.ok) setGym(await gymRes.json());
      if (predRes.ok) {
        setPredictive(await predRes.json());
        setLastUpdated(new Date().toLocaleTimeString('es-CL'));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [gymId]);

  useEffect(() => {
    loadData();
    const iv = setInterval(loadData, 5 * 60 * 1000);
    return () => clearInterval(iv);
  }, [loadData]);

  useEffect(() => {
    if (capacity?.gymId === gymId) {
      setGym(prev => prev ? {
        ...prev,
        currentCapacity: capacity.current,
        occupancyPercentage: capacity.percentage,
      } : null);
      setLastUpdated(new Date().toLocaleTimeString('es-CL'));
    }
  }, [capacity, gymId]);

  // ── Loading states ─────────────────────────────────────
  if (loading || !authChecked || hasAccess === null) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-t-2 border-blue-500 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Verificando acceso...</p>
        </div>
      </div>
    );
  }

  if (!gym) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-white text-xl mb-4">Gimnasio no encontrado</p>
          <button onClick={() => router.push('/')} className="text-blue-400">← Volver</button>
        </div>
      </div>
    );
  }

  const pct = gym.occupancyPercentage;
  const oc = pct < 50
    ? { bar: 'bg-green-500', text: 'text-green-400', label: 'Disponible', badge: 'bg-green-500/20 text-green-400 border-green-500/30' }
    : pct < 75
    ? { bar: 'bg-yellow-500', text: 'text-yellow-400', label: 'Moderado', badge: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' }
    : pct < 90
    ? { bar: 'bg-orange-500', text: 'text-orange-400', label: 'Lleno', badge: 'bg-orange-500/20 text-orange-400 border-orange-500/30' }
    : { bar: 'bg-red-500', text: 'text-red-400', label: 'Completo', badge: 'bg-red-500/20 text-red-400 border-red-500/30' };

  const ins = predictive?.insights;
  const currentHour = new Date().getHours();

  const trendIcon = ins?.trend === 'rising' ? '↑' : ins?.trend === 'falling' ? '↓' : '→';
  const trendColor = ins?.trend === 'rising' ? 'text-red-400' : ins?.trend === 'falling' ? 'text-green-400' : 'text-gray-400';
  const trendBg = ins?.trend === 'rising' ? 'bg-red-500/10 border-red-500/20' : ins?.trend === 'falling' ? 'bg-green-500/10 border-green-500/20' : 'bg-gray-500/10 border-gray-500/20';

  const vsYest = ins?.vsYesterday ?? 0;
  const vsYestColor = vsYest < 0 ? 'text-green-400' : vsYest > 0 ? 'text-red-400' : 'text-gray-400';
  const vsYestIcon = vsYest < 0 ? '↓' : vsYest > 0 ? '↑' : '→';
  const vsYestBg = vsYest < 0 ? 'bg-green-500/10 border-green-500/20' : vsYest > 0 ? 'bg-red-500/10 border-red-500/20' : 'bg-gray-500/10 border-gray-500/20';

  const chartData = predictive?.fullDay ?? [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-blue-950 pb-24">
      <div className="max-w-6xl mx-auto px-4 py-6">

        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-5"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1.5 flex-wrap">
                <h1 className="text-2xl font-bold text-white">{gym.name}</h1>
                {gym.chain && (
                  <span className="bg-white/10 text-gray-300 text-xs px-3 py-1 rounded-full">{gym.chain}</span>
                )}
                <span className="bg-green-500/15 text-green-400 border border-green-500/30 text-xs px-3 py-1 rounded-full font-medium">
                  ✓ Tienes acceso
                </span>
              </div>
              <p className="text-gray-400 text-sm">📍 {gym.address}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className={`flex items-center gap-2 ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
                <span className="text-xs">{isConnected ? 'En línea' : 'Desconectado'}</span>
              </div>
              {lastUpdated && <span className="text-gray-600 text-xs">Act. {lastUpdated}</span>}
            </div>
          </div>
        </motion.div>

        {/* ── Stats fila superior ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">

          {/* Aforo actual */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="col-span-2 bg-white/5 border border-white/10 rounded-2xl p-5"
          >
            <div className="flex justify-between items-start mb-3">
              <h3 className="text-gray-400 text-sm">Aforo Actual</h3>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${oc.badge}`}>{oc.label}</span>
            </div>
            <div className="flex items-end gap-2 mb-3">
              <motion.span
                key={gym.currentCapacity}
                initial={{ scale: 1.2 }}
                animate={{ scale: 1 }}
                className={`text-5xl font-bold ${oc.text}`}
              >
                {gym.currentCapacity}
              </motion.span>
              <span className="text-gray-500 text-2xl mb-1">/{gym.maxCapacity}</span>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-2.5 overflow-hidden">
              <motion.div className={`h-2.5 rounded-full ${oc.bar}`} animate={{ width: `${pct}%` }} transition={{ duration: 0.8 }} />
            </div>
            <div className="flex justify-between mt-2">
              <span className="text-gray-500 text-xs">{pct}% ocupado</span>
              <span className="text-gray-500 text-xs">{gym.maxCapacity - gym.currentCapacity} libres</span>
            </div>
          </motion.div>

          {/* Tendencia */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className={`bg-white/5 border rounded-2xl p-5 ${trendBg}`}
          >
            <h3 className="text-gray-400 text-sm mb-3">Tendencia</h3>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-4xl font-bold ${trendColor}`}>{trendIcon}</span>
              <div>
                <p className={`font-bold ${trendColor}`}>
                  {ins?.trend === 'rising' ? 'Subiendo' : ins?.trend === 'falling' ? 'Bajando' : 'Estable'}
                </p>
                <p className="text-gray-500 text-xs">{ins?.trendValue ?? 0} pers/hora</p>
              </div>
            </div>
          </motion.div>

          {/* Vs Ayer */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className={`bg-white/5 border rounded-2xl p-5 ${vsYestBg}`}
          >
            <h3 className="text-gray-400 text-sm mb-3">vs Ayer</h3>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-4xl font-bold ${vsYestColor}`}>{vsYestIcon}</span>
              <div>
                <p className={`font-bold ${vsYestColor}`}>
                  {Math.abs(vsYest)} pers.
                </p>
                <p className="text-gray-500 text-xs">
                  {vsYest < 0 ? 'Menos gente' : vsYest > 0 ? 'Más gente' : 'Igual'} que ayer
                </p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* ── Insights ── */}
        {predictive && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5"
          >
            {/* Mejor hora */}
            <div className="bg-gradient-to-br from-green-500/10 to-emerald-600/5 border border-green-500/20 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">🎯</span>
                <div>
                  <h3 className="text-green-300 font-bold text-sm">Mejor hora para ir hoy</h3>
                  <p className="text-gray-500 text-xs">Menor ocupación esperada</p>
                </div>
              </div>
              <div className="flex items-end gap-3">
                <p className="text-5xl font-bold text-green-400">{ins?.bestHour}</p>
                <div className="mb-1">
                  <p className="text-green-300 font-medium">~{ins?.bestHourValue} personas</p>
                  <p className="text-gray-500 text-xs">{ins?.bestHourPercentage}% del aforo</p>
                </div>
              </div>
            </div>

            {/* Próximas 3 horas */}
            <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border border-purple-500/20 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">🔮</span>
                <div>
                  <h3 className="text-purple-300 font-bold text-sm">Próximas 3 horas</h3>
                  <p className="text-gray-500 text-xs">
                    {predictive.hasRealData ? 'Basado en historial' : 'Patrón estimado'}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {predictive.nextThreeHours.map((nh, index) => {
                  const nhPct = nh.percentage;
                  const nhColor = nhPct < 50 ? 'text-green-400' : nhPct < 75 ? 'text-yellow-400' : nhPct < 90 ? 'text-orange-400' : 'text-red-400';
                  const nhBar = nhPct < 50 ? 'bg-green-500' : nhPct < 75 ? 'bg-yellow-500' : nhPct < 90 ? 'bg-orange-500' : 'bg-red-500';
                  return (
                    <div key={`${index}-${nh.hour}`} className="bg-white/5 rounded-xl p-3 text-center">
                      <p className="text-gray-400 text-xs mb-1">{nh.label}</p>
                      <p className={`font-bold text-lg ${nhColor}`}>{nh.value}</p>
                      <div className="w-full bg-gray-700 rounded-full h-1 mt-1.5">
                        <div className={`h-1 rounded-full ${nhBar}`} style={{ width: `${nhPct}%` }} />
                      </div>
                      <p className="text-gray-500 text-xs mt-1">{nhPct}%</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Gráfico principal ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-5"
        >
          <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
            <div>
              <h3 className="text-white font-bold text-lg">Ocupación del día</h3>
              <p className="text-gray-500 text-xs mt-0.5 capitalize">
                {new Date().toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })}
                {!predictive?.hasRealData && (
                  <span className="ml-2 text-purple-400">· Usando patrón base</span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex bg-gray-800 rounded-xl p-1 gap-1">
                {[
                  { key: 'today', label: 'Hoy', color: 'bg-blue-600' },
                  { key: 'predict', label: '✦ Predicción', color: 'bg-purple-600' },
                  { key: 'week', label: 'Semana', color: 'bg-orange-600' },
                ].map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key as typeof activeTab)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      activeTab === tab.key
                        ? `${tab.color} text-white shadow`
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <button
                onClick={loadData}
                className="bg-white/8 hover:bg-white/15 text-gray-400 hover:text-white p-2 rounded-xl transition"
                title="Actualizar"
              >
                🔄
              </button>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {chartData.length === 0 ? (
              <div className="text-center py-16 text-gray-500">
                <p className="text-4xl mb-3">📊</p>
                <p>Sin datos disponibles</p>
              </div>
            ) : (
              <motion.div
                key={activeTab}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="todayGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="predictGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="weekGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                      </linearGradient>
                    </defs>

                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis
                      dataKey="label"
                      stroke="rgba(255,255,255,0.1)"
                      tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 11 }}
                      tickLine={false}
                      interval={2}
                    />
                    <YAxis
                      stroke="rgba(255,255,255,0.1)"
                      tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 11 }}
                      tickLine={false}
                      domain={[0, gym.maxCapacity]}
                    />
                    <Tooltip content={<CustomTooltip />} />

                    <ReferenceLine
                      y={gym.maxCapacity}
                      stroke="rgba(239,68,68,0.35)"
                      strokeDasharray="4 4"
                      label={{ value: 'Máx', fill: 'rgba(239,68,68,0.5)', fontSize: 10 }}
                    />
                    <ReferenceLine
                      x={`${currentHour.toString().padStart(2, '0')}:00`}
                      stroke="rgba(255,255,255,0.2)"
                      strokeDasharray="3 3"
                      label={{ value: 'Ahora', fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
                    />

                    {activeTab === 'today' && (
                      <Area
                        type="monotone"
                        dataKey="today"
                        name="Hoy"
                        stroke="#3b82f6"
                        strokeWidth={2.5}
                        fill="url(#todayGrad)"
                        connectNulls={false}
                        dot={(props: any) => {
                          if (!props.payload?.isCurrentHour) return <g key={props.key} />;
                          return (
                            <circle key={props.key} cx={props.cx} cy={props.cy} r={6}
                              fill="#3b82f6" stroke="#93c5fd" strokeWidth={2} />
                          );
                        }}
                        activeDot={{ r: 5, fill: '#60a5fa' }}
                      />
                    )}

                    {activeTab === 'predict' && (
                      <>
                        <Area
                          type="monotone"
                          dataKey="today"
                          name="Hoy"
                          stroke="#3b82f6"
                          strokeWidth={2}
                          fill="url(#todayGrad)"
                          connectNulls={false}
                          dot={false}
                          activeDot={{ r: 4 }}
                        />
                        <Area
                          type="monotone"
                          dataKey="prediction"
                          name="Predicción"
                          stroke="#a855f7"
                          strokeWidth={2}
                          strokeDasharray="5 3"
                          fill="url(#predictGrad)"
                          connectNulls={false}
                          dot={false}
                          activeDot={{ r: 4, fill: '#c084fc' }}
                        />
                      </>
                    )}

                    {activeTab === 'week' && (
                      <>
                        <Area
                          type="monotone"
                          dataKey="today"
                          name="Hoy"
                          stroke="#3b82f6"
                          strokeWidth={2.5}
                          fill="url(#todayGrad)"
                          connectNulls={false}
                          dot={false}
                          activeDot={{ r: 4 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="yesterday"
                          name="Ayer"
                          stroke="#6b7280"
                          strokeWidth={1.5}
                          strokeDasharray="4 2"
                          dot={false}
                          activeDot={{ r: 3 }}
                        />
                        <Area
                          type="monotone"
                          dataKey="weekAvg"
                          name="Prom. semana"
                          stroke="#f97316"
                          strokeWidth={1.5}
                          fill="url(#weekGrad)"
                          dot={false}
                          activeDot={{ r: 3, fill: '#fb923c' }}
                        />
                      </>
                    )}
                  </ComposedChart>
                </ResponsiveContainer>

                <div className="flex items-center gap-5 mt-3 justify-center flex-wrap">
                  {activeTab === 'today' && (
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-0.5 bg-blue-500 rounded" />
                      <span className="text-gray-500 text-xs">Hoy</span>
                    </div>
                  )}
                  {activeTab === 'predict' && (<>
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-0.5 bg-blue-500 rounded" />
                      <span className="text-gray-500 text-xs">Real</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-5 border-t-2 border-dashed border-purple-500" />
                      <span className="text-gray-500 text-xs">✦ Predicción</span>
                    </div>
                  </>)}
                  {activeTab === 'week' && (<>
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-0.5 bg-blue-500 rounded" />
                      <span className="text-gray-500 text-xs">Hoy</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-5 border-t-2 border-dashed border-gray-500" />
                      <span className="text-gray-500 text-xs">Ayer</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-0.5 bg-orange-500 rounded" />
                      <span className="text-gray-500 text-xs">Prom. semana</span>
                    </div>
                  </>)}
                  <div className="flex items-center gap-2">
                    <div className="w-0.5 h-4 bg-white/25 rounded" />
                    <span className="text-gray-500 text-xs">Ahora</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* ── Info + Ubicación ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white/5 border border-white/10 rounded-2xl p-5"
          >
            <h3 className="text-white font-bold mb-4">ℹ️ Sobre este gimnasio</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-gray-400 text-sm">Capacidad máxima</span>
                <span className="text-white font-bold">{gym.maxCapacity} personas</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-gray-400 text-sm">Calificación</span>
                <span className="text-yellow-400 font-bold">⭐ {gym.rating} / 5.0</span>
              </div>
              {gym.chain && (
                <div className="flex justify-between items-center py-2 border-b border-white/5">
                  <span className="text-gray-400 text-sm">Cadena</span>
                  <span className="text-white font-bold">{gym.chain}</span>
                </div>
              )}
              <div className="pt-1">
                <p className="text-gray-400 text-sm mb-2">Servicios</p>
                <div className="flex flex-wrap gap-2">
                  {gym.features.map((f, i) => (
                    <span key={i} className="px-2.5 py-1 bg-blue-500/15 border border-blue-500/25 text-blue-300 text-xs rounded-lg">{f}</span>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="bg-white/5 border border-white/10 rounded-2xl p-5"
          >
            <h3 className="text-white font-bold mb-4">📍 Ubicación</h3>
            <p className="text-gray-300 text-sm mb-4">{gym.address}</p>
            <a
              href={`https://maps.google.com/?q=${gym.latitude},${gym.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 bg-white/8 hover:bg-white/15 border border-white/10 text-gray-300 hover:text-white text-sm font-medium px-4 py-3 rounded-xl transition w-full"
            >
              <span>📍</span>
              <span>Ver en Google Maps</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </motion.div>
        </div>

      </div>
    </div>
  );
}