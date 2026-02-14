'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useRealtimeCapacity } from '@/hooks/useRealtimeCapacity';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface Gym {
  id: string;
  name: string;
  address: string;
  maxCapacity: number;
  currentCapacity: number;
  occupancyPercentage: number;
}

interface AccessResult {
  success: boolean;
  message: string;
  isCheckout?: boolean;
  user?: {
    id: string;
    name: string;
    rut: string;
    membership?: { type: string };
  };
}

interface RecentAccess {
  name: string;
  type: 'entrada' | 'salida';
  time: string;
  membership?: string;
}

type Status = 'waiting' | 'processing' | 'success' | 'error' | 'denied';
type AuthStatus = 'checking' | 'login' | 'authorized';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
const playTone = (freq1: number, freq2: number, duration: number) => {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(freq1, ctx.currentTime);
    osc.frequency.setValueAtTime(freq2, ctx.currentTime + duration * 0.5);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch {}
};

// ─────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────
export default function TorniquetePage() {
  const params = useParams();
  const router = useRouter();
  const gymId = params.gymId as string;

  // Auth del operador
  const [authStatus, setAuthStatus] = useState<AuthStatus>('checking');
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [operatorEmail, setOperatorEmail] = useState('');
  const [operatorPassword, setOperatorPassword] = useState('');

  // Estado del gym
  const [gym, setGym] = useState<Gym | null>(null);
  const [status, setStatus] = useState<Status>('waiting');
  const [accessResult, setAccessResult] = useState<AccessResult | null>(null);
  const [recentAccess, setRecentAccess] = useState<RecentAccess[]>([]);
  const [buffer, setBuffer] = useState('');
  const [lastKeyTime, setLastKeyTime] = useState(0);

  // Refs
  const hiddenInputRef = useRef<HTMLInputElement>(null);
  const resetTimerRef = useRef<NodeJS.Timeout | null>(null);

  const { capacity, isConnected } = useRealtimeCapacity(gymId);

  // ── Verificar auth al cargar ──────────────────
  useEffect(() => {
    // El torniquete tiene su propia sesión de operador separada
    const operatorSession = localStorage.getItem('gymflow_operator');
    if (operatorSession) {
      setAuthStatus('authorized');
      return;
    }

    // También acepta si el usuario logueado es ADMIN o GYM_STAFF
    const savedUser = localStorage.getItem('gymflow_user');
    if (savedUser) {
      const user = JSON.parse(savedUser);
      if (user.role === 'ADMIN' || user.role === 'GYM_STAFF') {
        // Guardar como operador para no perder sesión al cambiar de página
        localStorage.setItem('gymflow_operator', JSON.stringify(user));
        setAuthStatus('authorized');
        return;
      }
    }

    setAuthStatus('login');
  }, []);

  // ── Cargar datos del gym ──────────────────────
  useEffect(() => {
    if (authStatus !== 'authorized') return;
    fetch(`http://localhost:3001/api/gyms/${gymId}`)
      .then(r => r.json())
      .then(setGym)
      .catch(console.error);
  }, [gymId, authStatus]);

  // ── Actualizar aforo en tiempo real ──────────
  useEffect(() => {
    if (capacity?.gymId === gymId) {
      setGym(prev => prev ? {
        ...prev,
        currentCapacity: capacity.current,
        occupancyPercentage: capacity.percentage,
      } : null);
    }
  }, [capacity, gymId]);

  // ── Mantener focus en input oculto ───────────
  useEffect(() => {
    if (authStatus !== 'authorized' || status !== 'waiting') return;
    const timer = setTimeout(() => hiddenInputRef.current?.focus(), 100);
    return () => clearTimeout(timer);
  }, [authStatus, status]);

  // ── Auto-reset después de resultado ──────────
  const scheduleReset = useCallback(() => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(() => {
      setStatus('waiting');
      setAccessResult(null);
      setBuffer('');
      setTimeout(() => hiddenInputRef.current?.focus(), 100);
    }, 4000);
  }, []);

  // ── Procesar acceso ───────────────────────────
  const processAccess = useCallback(async (value: string) => {
    if (!value.trim() || status !== 'waiting') return;
    setStatus('processing');

    try {
      // Detectar si es RUT (contiene guión) o QR (sin guión o formato diferente)
      const isRut = /^\d{7,8}-[\dkK]$/.test(value.trim());
      const body = isRut
        ? { gymId, rut: value.trim() }
        : { gymId, qrCode: value.trim() };

      const res = await fetch('http://localhost:3001/api/auth/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setAccessResult(data);
        setStatus('success');
        playTone(880, 1100, 0.4);

        setRecentAccess(prev => [{
          name: data.user?.name || 'Usuario',
          type: data.isCheckout ? 'salida' : 'entrada',
          time: new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }),
          membership: data.user?.membership?.type,
        }, ...prev.slice(0, 4)]);

      } else {
        setAccessResult({
          success: false,
          message: data.message || 'Acceso denegado',
        });
        setStatus(data.message?.includes('membresía') ? 'denied' : 'error');
        playTone(300, 180, 0.5);
      }
    } catch {
      setAccessResult({ success: false, message: 'Error de conexión' });
      setStatus('error');
      playTone(300, 180, 0.5);
    }

    scheduleReset();
  }, [gymId, status, scheduleReset]);

  // ── Capturar input del lector físico ─────────
  // Los lectores USB envían datos rápidamente seguido de Enter
  // Detectamos ráfagas de teclas y las procesamos como un scan
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (authStatus !== 'authorized' || status !== 'waiting') return;

    const now = Date.now();
    const timeSinceLast = now - lastKeyTime;
    setLastKeyTime(now);

    // Ignorar teclas modificadoras y especiales
    const ignoredKeys = [
      'Shift', 'Control', 'Alt', 'Meta', 'CapsLock',
      'Tab', 'Escape', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
      'F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11','F12',
    ];
    if (ignoredKeys.includes(e.key)) return;

    // Enter = procesar buffer
    if (e.key === 'Enter') {
      if (buffer.trim()) {
        processAccess(buffer.trim());
        setBuffer('');
      }
      return;
    }

    // Backspace = borrar último carácter
    if (e.key === 'Backspace') {
      setBuffer(prev => prev.slice(0, -1));
      return;
    }

    // Solo aceptar caracteres imprimibles (1 carácter de largo)
    if (e.key.length > 1) return;

    // Reset buffer si hay mucha pausa (escritura manual lenta)
    if (timeSinceLast > 500 && buffer.length > 0) {
      setBuffer(e.key);
    } else {
      setBuffer(prev => prev + e.key);
    }
  }, [authStatus, status, buffer, lastKeyTime, processAccess]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // ── Login del operador ────────────────────────
  const handleOperatorLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError('');

    try {
      const res = await fetch('http://localhost:3001/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: operatorEmail, password: operatorPassword }),
      });

      const data = await res.json();

      if (res.ok && data.user) {
        if (data.user.role === 'ADMIN' || data.user.role === 'GYM_STAFF') {
          // Guardar sesión del operador separada del usuario normal
          localStorage.setItem('gymflow_operator', JSON.stringify(data.user));
          localStorage.setItem('gymflow_token', data.token);
          setAuthStatus('authorized');
        } else {
          setPinError('No tienes permisos para acceder al torniquete');
        }
      } else {
        setPinError('Credenciales incorrectas');
      }
    } catch {
      setPinError('Error de conexión');
    }
  };

  // ── Aforo colores ─────────────────────────────
  const getAforo = () => {
    if (!gym) return { color: 'text-gray-400', bar: 'bg-gray-500', label: '...' };
    const p = gym.occupancyPercentage;
    if (p < 50) return { color: 'text-green-400', bar: 'bg-green-500', label: 'Disponible' };
    if (p < 75) return { color: 'text-yellow-400', bar: 'bg-yellow-500', label: 'Moderado' };
    if (p < 90) return { color: 'text-orange-400', bar: 'bg-orange-500', label: 'Lleno' };
    return { color: 'text-red-400', bar: 'bg-red-500', label: 'Completo' };
  };

  const aforo = getAforo();

  // ─────────────────────────────────────────────
  // RENDER: Checking
  // ─────────────────────────────────────────────
  if (authStatus === 'checking') {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-10 h-10 border-t-2 border-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  // ─────────────────────────────────────────────
  // RENDER: Login del operador
  // ─────────────────────────────────────────────
  if (authStatus === 'login') {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm"
        >
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/30">
              <span className="text-3xl">🏋️</span>
            </div>
            <h1 className="text-2xl font-bold text-white">Acceso Operador</h1>
            <p className="text-gray-400 text-sm mt-1">Solo personal autorizado</p>
          </div>

          <div className="bg-gray-900 border border-white/10 rounded-2xl p-6">
            <form onSubmit={handleOperatorLogin} className="space-y-4">
              <div>
                <label className="block text-gray-400 text-sm mb-2">Email</label>
                <input
                  type="email"
                  value={operatorEmail}
                  onChange={e => setOperatorEmail(e.target.value)}
                  placeholder="operador@gymflow.com"
                  required
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition"
                />
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-2">Contraseña</label>
                <input
                  type="password"
                  value={operatorPassword}
                  onChange={e => setOperatorPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition"
                />
              </div>

              {pinError && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-red-400 text-sm text-center bg-red-500/10 border border-red-500/20 rounded-xl p-3"
                >
                  {pinError}
                </motion.p>
              )}

              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition"
              >
                Ingresar al torniquete
              </button>
            </form>

            <button
              onClick={() => router.push('/')}
              className="w-full mt-3 text-gray-500 hover:text-gray-300 text-sm py-2 transition"
            >
              ← Volver al inicio
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ─────────────────────────────────────────────
  // RENDER: Kiosko del torniquete
  // ─────────────────────────────────────────────
  return (
    <div
      className="min-h-screen bg-gray-950 select-none overflow-hidden"
      onClick={() => hiddenInputRef.current?.focus()}
    >
      {/* Input oculto que captura el lector físico */}
      <input
        ref={hiddenInputRef}
        className="sr-only"
        readOnly
        aria-hidden="true"
      />

      {/* Header */}
      <div className="bg-gray-900 border-b border-white/5 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white text-sm">G</div>
          <div>
            <p className="text-white font-bold text-sm">{gym?.name || 'Cargando...'}</p>
            <p className="text-gray-500 text-xs">{gym?.address}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Aforo compacto */}
          {gym && (
            <div className="flex items-center gap-2">
              <span className={`text-sm font-bold ${aforo.color}`}>
                {gym.currentCapacity}/{gym.maxCapacity}
              </span>
              <div className="w-16 bg-gray-800 rounded-full h-1.5">
                <motion.div
                  className={`h-1.5 rounded-full ${aforo.bar}`}
                  animate={{ width: `${gym.occupancyPercentage}%` }}
                  transition={{ duration: 0.8 }}
                />
              </div>
            </div>
          )}

          {/* Estado conexión */}
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
            <span className="text-gray-500 text-xs">{isConnected ? 'En línea' : 'Sin conexión'}</span>
          </div>

          <button
            onClick={() => {
              // Solo cerrar sesión del operador, no del usuario normal
              localStorage.removeItem('gymflow_operator');
              router.push('/');
            }}
            className="text-gray-600 hover:text-gray-400 text-xs transition"
          >
            Salir
          </button>
        </div>
      </div>

      <div className="flex h-[calc(100vh-52px)]">

        {/* Panel central principal */}
        <div className="flex-1 flex items-center justify-center p-8">
          <AnimatePresence mode="wait">

            {/* ── ESPERANDO ── */}
            {status === 'waiting' && (
              <motion.div
                key="waiting"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="text-center max-w-md"
              >
                {/* Icono pulsante */}
                <div className="relative w-48 h-48 mx-auto mb-8">
                  <div className="absolute inset-0 bg-blue-500/10 rounded-full animate-ping" />
                  <div className="absolute inset-4 bg-blue-500/15 rounded-full animate-pulse" />
                  <div className="relative w-full h-full bg-gray-900 border-2 border-blue-500/40 rounded-full flex items-center justify-center">
                    <span className="text-7xl">📲</span>
                  </div>
                </div>

                <h2 className="text-4xl font-bold text-white mb-3">
                  Listo para acceso
                </h2>
                <p className="text-gray-400 text-lg mb-2">
                  Presenta tu código QR o RUT
                </p>
                <p className="text-gray-600 text-sm">
                  en el lector del torniquete
                </p>

                {/* Indicador de buffer - solo en desarrollo */}
                {buffer && process.env.NODE_ENV === 'development' && (
                  <div className="mt-6 bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-2">
                    <p className="text-blue-400 text-sm font-mono">Leyendo: {buffer}</p>
                  </div>
                )}
              </motion.div>
            )}

            {/* ── PROCESANDO ── */}
            {status === 'processing' && (
              <motion.div
                key="processing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center"
              >
                <div className="w-32 h-32 border-t-4 border-blue-500 rounded-full animate-spin mx-auto mb-6" />
                <p className="text-white text-2xl font-bold">Verificando...</p>
                <p className="text-gray-400 mt-2">Validando credenciales</p>
              </motion.div>
            )}

            {/* ── ÉXITO ── */}
            {status === 'success' && accessResult && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                className="text-center"
              >
                {/* Círculo de resultado */}
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 250, damping: 18, delay: 0.1 }}
                  className={`w-48 h-48 rounded-full mx-auto flex items-center justify-center mb-8 shadow-2xl ${
                    accessResult.isCheckout
                      ? 'bg-blue-500 shadow-blue-500/40'
                      : 'bg-green-500 shadow-green-500/40'
                  }`}
                >
                  {accessResult.isCheckout ? (
                    <svg className="w-24 h-24 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                  ) : (
                    <svg className="w-24 h-24 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </motion.div>

                {/* Tipo de movimiento */}
                <div className={`inline-flex items-center gap-2 px-5 py-2 rounded-full text-sm font-bold mb-6 ${
                  accessResult.isCheckout
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                    : 'bg-green-500/20 text-green-300 border border-green-500/40'
                }`}>
                  <span>{accessResult.isCheckout ? '← SALIDA' : '→ ENTRADA'}</span>
                </div>

                {/* Nombre usuario */}
                <h2 className={`text-5xl font-bold mb-3 ${
                  accessResult.isCheckout ? 'text-blue-300' : 'text-green-300'
                }`}>
                  {accessResult.isCheckout ? 'Hasta luego' : 'Bienvenido'}
                </h2>
                <p className="text-4xl font-bold text-white mb-3">
                  {accessResult.user?.name}
                </p>

                {/* Membresía */}
                {accessResult.user?.membership?.type && (
                  <span className="inline-block bg-white/10 text-gray-300 text-sm px-4 py-1.5 rounded-full">
                    🎫 {accessResult.user.membership.type}
                  </span>
                )}
              </motion.div>
            )}

            {/* ── ERROR / DENEGADO ── */}
            {(status === 'error' || status === 'denied') && accessResult && (
              <motion.div
                key="error"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1, x: [0, -12, 12, -12, 12, 0] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
                className="text-center"
              >
                <div className="w-48 h-48 bg-red-500 shadow-2xl shadow-red-500/40 rounded-full mx-auto flex items-center justify-center mb-8">
                  <svg className="w-24 h-24 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>

                <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full text-sm font-bold mb-6 bg-red-500/20 text-red-300 border border-red-500/40">
                  ✗ ACCESO DENEGADO
                </div>

                <h2 className="text-4xl font-bold text-red-400 mb-3">Acceso Denegado</h2>
                <p className="text-gray-300 text-xl">{accessResult.message}</p>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* Panel lateral derecho */}
        <div className="w-72 bg-gray-900 border-l border-white/5 flex flex-col p-4 gap-4">

          {/* Aforo detallado */}
          <div className="bg-gray-800/50 rounded-2xl p-4 border border-white/5">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-white font-bold text-sm">Aforo</h3>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                (gym?.occupancyPercentage || 0) < 50 ? 'bg-green-500/20 text-green-400' :
                (gym?.occupancyPercentage || 0) < 75 ? 'bg-yellow-500/20 text-yellow-400' :
                (gym?.occupancyPercentage || 0) < 90 ? 'bg-orange-500/20 text-orange-400' :
                'bg-red-500/20 text-red-400'
              }`}>
                {aforo.label}
              </span>
            </div>

            <div className="text-center mb-3">
              <motion.span
                key={gym?.currentCapacity}
                initial={{ scale: 1.3 }}
                animate={{ scale: 1 }}
                className={`text-5xl font-bold ${aforo.color}`}
              >
                {gym?.currentCapacity ?? '—'}
              </motion.span>
              <span className="text-gray-500 text-2xl">/{gym?.maxCapacity ?? '—'}</span>
              <p className="text-gray-500 text-xs mt-1">personas dentro</p>
            </div>

            <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden mb-1">
              <motion.div
                className={`h-2 rounded-full ${aforo.bar}`}
                animate={{ width: `${gym?.occupancyPercentage ?? 0}%` }}
                transition={{ duration: 0.8 }}
              />
            </div>
            <p className="text-gray-500 text-xs text-center">{gym?.occupancyPercentage ?? 0}% ocupado</p>

            <div className="grid grid-cols-2 gap-2 mt-3">
              <div className="bg-white/5 rounded-xl p-2 text-center">
                <p className="text-green-400 font-bold">{(gym?.maxCapacity ?? 0) - (gym?.currentCapacity ?? 0)}</p>
                <p className="text-gray-500 text-xs">libres</p>
              </div>
              <div className="bg-white/5 rounded-xl p-2 text-center">
                <p className="text-blue-400 font-bold">{gym?.maxCapacity ?? '—'}</p>
                <p className="text-gray-500 text-xs">máximo</p>
              </div>
            </div>
          </div>

          {/* Actividad reciente */}
          <div className="flex-1 bg-gray-800/50 rounded-2xl p-4 border border-white/5">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-white font-bold text-sm">Actividad</h3>
              <div className="flex gap-2 text-xs">
                <span className="text-green-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                  Entrada
                </span>
                <span className="text-blue-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />
                  Salida
                </span>
              </div>
            </div>

            {recentAccess.length === 0 ? (
              <p className="text-gray-600 text-xs text-center py-6">Sin actividad</p>
            ) : (
              <div className="space-y-2">
                <AnimatePresence>
                  {recentAccess.map((a, i) => (
                    <motion.div
                      key={`${a.name}-${a.time}-${i}`}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0 }}
                      className={`rounded-xl p-2.5 border flex items-center gap-2 ${
                        a.type === 'entrada'
                          ? 'bg-green-500/10 border-green-500/20'
                          : 'bg-blue-500/10 border-blue-500/20'
                      }`}
                    >
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0 ${
                        a.type === 'entrada' ? 'bg-green-500' : 'bg-blue-500'
                      }`}>
                        {a.type === 'entrada' ? '→' : '←'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-xs font-medium truncate">{a.name}</p>
                        {a.membership && (
                          <p className="text-gray-500 text-xs">{a.membership}</p>
                        )}
                      </div>
                      <p className="text-gray-500 text-xs flex-shrink-0">{a.time}</p>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* Hora actual */}
          <LiveClock />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Componente reloj en vivo
// ─────────────────────────────────────────────
function LiveClock() {
  const [time, setTime] = useState('');
  const [date, setDate] = useState('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setDate(now.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' }));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-gray-800/50 rounded-2xl p-3 border border-white/5 text-center">
      <p className="text-white font-mono font-bold text-2xl">{time}</p>
      <p className="text-gray-500 text-xs mt-0.5 capitalize">{date}</p>
    </div>
  );
}