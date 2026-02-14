'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { motion } from 'framer-motion';

// ─── Types ───────────────────────────────────────────────
interface OwnerDashboard {
  gym: { id: string; name: string; maxCapacity: number; currentCapacity: number };
  period: { days: number; startDate: string; endDate: string };
  kpis: {
    totalMembers: number;
    activeMembers: number;
    inactiveMembers: number;
    newMembersInPeriod: number;
    retentionRate: number;
    churnRate: number;
    loyalUsers: number;
    avgVisitsPerUser: number;
    totalVisitsInPeriod: number;
    avgDailyVisits: number;
  };
  revenue: {
    estimatedMonthly: number;
    projectedNextMonth: number;
    avgPerMember: number;
    distribution: Record<string, number>;
  };
  charts: {
    daily: { date: string; visits: number; percentage: number }[];
    monthly: { month: string; visits: number; uniqueUsers: number }[];
    hourlyRanking: { hour: number; label: string; visits: number; avgPerDay: number; revenueIndex: number }[];
    membershipTypes: { type: string; count: number; percentage: number; estimatedRevenue: number }[];
  };
  topDays: { date: string; visits: number; percentage: number }[];
}

interface Props {
  gymId: string;
  gymName: string;
}

// ─── Helpers ─────────────────────────────────────────────
const formatCLP = (n: number) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n);

const MEMBERSHIP_COLORS: Record<string, string> = {
  PREMIUM: '#f59e0b',
  SMARTFIT: '#3b82f6',
  POWERFIT: '#ef4444',
  BASIC: '#6b7280',
  CUSTOM: '#a855f7',
};

const PIE_COLORS = ['#3b82f6', '#f59e0b', '#ef4444', '#a855f7', '#6b7280', '#10b981'];

const CustomBarTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-800/98 border border-white/15 rounded-xl p-3 shadow-xl">
      <p className="text-gray-300 text-xs font-bold mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-gray-400 text-xs">{p.name}:</span>
          <span className="text-white text-xs font-bold">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────
export default function OwnerDashboard({ gymId, gymName }: Props) {
  const [data, setData] = useState<OwnerDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [lastUpdated, setLastUpdated] = useState('');
  const [activeChart, setActiveChart] = useState<'daily' | 'monthly'>('daily');

  const load = useCallback(async () => {
    if (!gymId) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('gymflow_token');
      const res = await fetch(
        `http://localhost:3001/api/checkins/dashboard/owner/${gymId}?days=${days}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        setData(await res.json());
        setLastUpdated(new Date().toLocaleTimeString('es-CL'));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [gymId, days]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-10 h-10 border-t-2 border-purple-500 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Calculando métricas...</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { kpis, revenue, charts, topDays } = data;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5"
    >
      {/* ── Header con selector de período ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-white font-bold text-lg">Métricas de negocio</h2>
          <p className="text-gray-500 text-xs mt-0.5">
            {gymName} · Actualizado: {lastUpdated}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-400 text-sm">Período:</span>
          <div className="flex bg-gray-800 rounded-xl p-1 gap-1">
            {[
              { label: '7d', value: 7 },
              { label: '30d', value: 30 },
              { label: '90d', value: 90 },
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => setDays(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  days === opt.value
                    ? 'bg-purple-600 text-white shadow'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button
            onClick={load}
            className="bg-white/8 hover:bg-white/15 text-gray-400 hover:text-white p-2 rounded-xl transition"
          >
            🔄
          </button>
        </div>
      </div>

      {/* ── KPIs Financieros ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: 'Ingresos estimados',
            value: formatCLP(revenue.estimatedMonthly),
            sub: 'este mes',
            icon: '💰',
            color: 'text-green-400',
            bg: 'from-green-500/10 to-green-600/5 border-green-500/20',
          },
          {
            label: 'Proyección próx. mes',
            value: formatCLP(revenue.projectedNextMonth),
            sub: `${100 - kpis.churnRate}% renovación estimada`,
            icon: '📈',
            color: 'text-blue-400',
            bg: 'from-blue-500/10 to-blue-600/5 border-blue-500/20',
          },
          {
            label: 'Ingreso por miembro',
            value: formatCLP(revenue.avgPerMember),
            sub: 'promedio mensual',
            icon: '👤',
            color: 'text-purple-400',
            bg: 'from-purple-500/10 to-purple-600/5 border-purple-500/20',
          },
          {
            label: 'Tasa de retención',
            value: `${kpis.retentionRate}%`,
            sub: `${kpis.loyalUsers} usuarios frecuentes`,
            icon: '🔄',
            color: kpis.retentionRate > 70 ? 'text-green-400' : kpis.retentionRate > 50 ? 'text-yellow-400' : 'text-red-400',
            bg: kpis.retentionRate > 70 ? 'from-green-500/10 to-green-600/5 border-green-500/20' : 'from-yellow-500/10 to-yellow-600/5 border-yellow-500/20',
          },
        ].map((kpi, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className={`bg-gradient-to-br ${kpi.bg} border rounded-2xl p-5`}
          >
            <div className="flex justify-between items-start mb-2">
              <p className="text-gray-400 text-xs">{kpi.label}</p>
              <span className="text-xl">{kpi.icon}</span>
            </div>
            <p className={`text-2xl font-bold ${kpi.color} mb-1`}>{kpi.value}</p>
            <p className="text-gray-500 text-xs">{kpi.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* ── KPIs de Membresías ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total miembros', value: kpis.totalMembers, icon: '👥', color: 'text-white' },
          { label: 'Activos', value: kpis.activeMembers, icon: '✅', color: 'text-green-400' },
          { label: 'Inactivos', value: kpis.inactiveMembers, icon: '⏸️', color: 'text-gray-400' },
          { label: 'Nuevos', value: `+${kpis.newMembersInPeriod}`, icon: '🆕', color: 'text-blue-400', sub: `en ${days} días` },
          { label: 'Churn rate', value: `${kpis.churnRate}%`, icon: '📉', color: kpis.churnRate < 10 ? 'text-green-400' : kpis.churnRate < 20 ? 'text-yellow-400' : 'text-red-400', sub: 'membresías vencidas' },
        ].map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.05 }}
            className="bg-white/5 border border-white/10 rounded-2xl p-4"
          >
            <div className="flex justify-between items-start mb-1">
              <p className="text-gray-400 text-xs">{item.label}</p>
              <span className="text-lg">{item.icon}</span>
            </div>
            <p className={`text-3xl font-bold ${item.color}`}>{item.value}</p>
            {item.sub && <p className="text-gray-500 text-xs mt-1">{item.sub}</p>}
          </motion.div>
        ))}
      </div>

      {/* ── Visitas + Distribución ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Gráfico de visitas */}
        <div className="lg:col-span-2 bg-white/5 border border-white/10 rounded-2xl p-5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-white font-bold">Visitas en el período</h3>
            <div className="flex bg-gray-800 rounded-xl p-1 gap-1">
              <button
                onClick={() => setActiveChart('daily')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeChart === 'daily' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                Diario
              </button>
              <button
                onClick={() => setActiveChart('monthly')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeChart === 'monthly' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                Mensual
              </button>
            </div>
          </div>

          {activeChart === 'daily' ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={charts.daily} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="ownerGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a855f7" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} tickLine={false} stroke="rgba(255,255,255,0.1)" interval={Math.floor(charts.daily.length / 6)} />
                <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} tickLine={false} stroke="rgba(255,255,255,0.1)" />
                <Tooltip content={<CustomBarTooltip />} />
                <Area type="monotone" dataKey="visits" name="Visitas" stroke="#a855f7" strokeWidth={2.5} fill="url(#ownerGrad)" dot={false} activeDot={{ r: 5, fill: '#c084fc' }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={charts.monthly} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="month" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} tickLine={false} stroke="rgba(255,255,255,0.1)" />
                <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} tickLine={false} stroke="rgba(255,255,255,0.1)" />
                <Tooltip content={<CustomBarTooltip />} />
                <Bar dataKey="visits" name="Visitas" fill="#a855f7" radius={[4, 4, 0, 0]} />
                <Bar dataKey="uniqueUsers" name="Usuarios únicos" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}

          {/* Stats resumen */}
          <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-white/5">
            {[
              { label: 'Total visitas', value: kpis.totalVisitsInPeriod },
              { label: 'Promedio diario', value: kpis.avgDailyVisits },
              { label: 'Visitas por miembro', value: `${kpis.avgVisitsPerUser}x` },
            ].map((s, i) => (
              <div key={i} className="text-center">
                <p className="text-white font-bold text-xl">{s.value}</p>
                <p className="text-gray-500 text-xs">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Distribución de membresías (Pie) */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <h3 className="text-white font-bold mb-4">Distribución membresías</h3>
          {charts.membershipTypes.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p className="text-3xl mb-2">📊</p>
              <p className="text-sm">Sin datos</p>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={charts.membershipTypes}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    dataKey="count"
                    nameKey="type"
                  >
                    {charts.membershipTypes.map((entry, index) => (
                      <Cell
                        key={entry.type}
                        fill={MEMBERSHIP_COLORS[entry.type] || PIE_COLORS[index % PIE_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any, name: any) => [value, name]}
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                    labelStyle={{ color: 'white' }}
                  />
                </PieChart>
              </ResponsiveContainer>

              <div className="space-y-2 mt-2">
                {charts.membershipTypes.map((m, i) => (
                  <div key={m.type} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: MEMBERSHIP_COLORS[m.type] || PIE_COLORS[i % PIE_COLORS.length] }}
                      />
                      <span className="text-gray-300 text-xs">{m.type}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-white text-xs font-bold">{m.count}</span>
                      <span className="text-gray-500 text-xs ml-1">({m.percentage}%)</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Ranking horas + Top días ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

        {/* Ranking horas rentables */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <h3 className="text-white font-bold mb-4">🏆 Horas más rentables</h3>
          {charts.hourlyRanking.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-6">Sin datos en este período</p>
          ) : (
            <div className="space-y-2">
              {charts.hourlyRanking.map((h, i) => (
                <div key={h.hour} className="flex items-center gap-3">
                  <span className={`text-xs font-bold w-5 text-center ${
                    i === 0 ? 'text-yellow-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-orange-400' : 'text-gray-500'
                  }`}>
                    {i + 1}
                  </span>
                  <span className="text-white text-sm font-mono w-14 flex-shrink-0">{h.label}</span>
                  <div className="flex-1 bg-gray-800 rounded-full h-2 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${h.revenueIndex}%` }}
                      transition={{ delay: i * 0.05, duration: 0.6 }}
                      className={`h-2 rounded-full ${
                        i === 0 ? 'bg-yellow-500' : i === 1 ? 'bg-blue-500' : 'bg-purple-500'
                      }`}
                    />
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-white text-xs font-bold">{h.visits}</p>
                    <p className="text-gray-500 text-xs">~{h.avgPerDay}/día</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Métricas de retención */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <h3 className="text-white font-bold mb-4">🔄 Análisis de retención</h3>

          {/* Gauge retención */}
          <div className="text-center mb-4">
            <div className="relative w-32 h-32 mx-auto">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="12" />
                <circle
                  cx="50" cy="50" r="40"
                  fill="none"
                  stroke={kpis.retentionRate > 70 ? '#22c55e' : kpis.retentionRate > 50 ? '#eab308' : '#ef4444'}
                  strokeWidth="12"
                  strokeDasharray={`${(kpis.retentionRate / 100) * 251.2} 251.2`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <p className={`text-3xl font-bold ${
                  kpis.retentionRate > 70 ? 'text-green-400' : kpis.retentionRate > 50 ? 'text-yellow-400' : 'text-red-400'
                }`}>
                  {kpis.retentionRate}%
                </p>
                <p className="text-gray-500 text-xs">retención</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Usuarios frecuentes', value: kpis.loyalUsers, sub: '5+ visitas', color: 'text-green-400' },
              { label: 'Visitas promedio', value: `${kpis.avgVisitsPerUser}x`, sub: 'por miembro', color: 'text-blue-400' },
              { label: 'Churn rate', value: `${kpis.churnRate}%`, sub: 'membresías vencidas', color: kpis.churnRate < 10 ? 'text-green-400' : 'text-red-400' },
              { label: 'Nuevos miembros', value: `+${kpis.newMembersInPeriod}`, sub: `en ${days} días`, color: 'text-purple-400' },
            ].map((item, i) => (
              <div key={i} className="bg-white/5 rounded-xl p-3">
                <p className={`text-xl font-bold ${item.color}`}>{item.value}</p>
                <p className="text-gray-300 text-xs font-medium">{item.label}</p>
                <p className="text-gray-500 text-xs">{item.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Top días + Ingresos por tipo ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

        {/* Top días */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <h3 className="text-white font-bold mb-4">📅 Días con más actividad</h3>
          {topDays.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-6">Sin datos</p>
          ) : (
            <div className="space-y-3">
              {topDays.map((day, i) => (
                <div key={day.date} className="flex items-center gap-3">
                  <span className={`text-xl ${i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}`} />
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <span className="text-white text-sm font-medium">{day.date}</span>
                      <span className="text-gray-300 text-sm">{day.visits} visitas</span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-2">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${day.percentage}%` }}
                        transition={{ delay: i * 0.1, duration: 0.6 }}
                        className={`h-2 rounded-full ${i === 0 ? 'bg-yellow-500' : i === 1 ? 'bg-gray-400' : 'bg-orange-500'}`}
                      />
                    </div>
                  </div>
                  <span className="text-gray-400 text-xs w-10 text-right">{day.percentage}%</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Ingresos estimados por tipo */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <h3 className="text-white font-bold mb-4">💵 Ingresos estimados por tipo</h3>
          {charts.membershipTypes.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-6">Sin membresías activas</p>
          ) : (
            <div className="space-y-3">
              {charts.membershipTypes
                .sort((a, b) => b.estimatedRevenue - a.estimatedRevenue)
                .map((m, i) => (
                  <div key={m.type} className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1">
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: MEMBERSHIP_COLORS[m.type] || PIE_COLORS[i] }}
                      />
                      <div className="flex-1">
                        <div className="flex justify-between mb-1">
                          <span className="text-white text-xs font-medium">{m.type}</span>
                          <span className="text-gray-300 text-xs">{m.count} miembros</span>
                        </div>
                        <div className="w-full bg-gray-800 rounded-full h-1.5">
                          <div
                            className="h-1.5 rounded-full transition-all"
                            style={{
                              width: `${m.percentage}%`,
                              backgroundColor: MEMBERSHIP_COLORS[m.type] || PIE_COLORS[i],
                            }}
                          />
                        </div>
                      </div>
                    </div>
                    <span className="text-green-400 text-xs font-bold ml-3 flex-shrink-0">
                      {formatCLP(m.estimatedRevenue)}
                    </span>
                  </div>
                ))}

              {/* Total */}
              <div className="pt-3 border-t border-white/10 flex justify-between items-center">
                <span className="text-gray-300 text-sm font-medium">Total estimado</span>
                <span className="text-green-400 font-bold text-lg">
                  {formatCLP(revenue.estimatedMonthly)}
                </span>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 flex justify-between items-center">
                <div>
                  <p className="text-blue-300 text-xs font-medium">Proyección próximo mes</p>
                  <p className="text-gray-500 text-xs">{100 - kpis.churnRate}% tasa de renovación</p>
                </div>
                <span className="text-blue-400 font-bold">{formatCLP(revenue.projectedNextMonth)}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}