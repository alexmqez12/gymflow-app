'use client';

import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import QRCode from 'qrcode';
import { useRouter } from 'next/navigation';

interface UserProfile {
  id: string;
  email: string;
  name: string;
  rut: string;
  qrCode: string;
  role: string;
}

interface MembershipGym {
  gym: {
    id: string;
    name: string;
    address: string;
    chain?: string;
  };
}

interface Membership {
  id: string;
  type: string;
  status: string;
  startDate: string;
  endDate: string;
  gyms: MembershipGym[];
}

const membershipColors: Record<string, { gradient: string; border: string; badge: string }> = {
  PREMIUM: {
    gradient: 'from-yellow-500 to-orange-500',
    border: 'border-yellow-500/30',
    badge: 'bg-yellow-500/20 text-yellow-400',
  },
  SMARTFIT: {
    gradient: 'from-blue-500 to-cyan-500',
    border: 'border-blue-500/30',
    badge: 'bg-blue-500/20 text-blue-400',
  },
  POWERFIT: {
    gradient: 'from-red-500 to-orange-500',
    border: 'border-red-500/30',
    badge: 'bg-red-500/20 text-red-400',
  },
  BASIC: {
    gradient: 'from-gray-500 to-gray-600',
    border: 'border-gray-500/30',
    badge: 'bg-gray-500/20 text-gray-400',
  },
  CUSTOM: {
    gradient: 'from-purple-500 to-pink-500',
    border: 'border-purple-500/30',
    badge: 'bg-purple-500/20 text-purple-400',
  },
};

const roleLabels: Record<string, { label: string; color: string }> = {
  ADMIN:     { label: 'Administrador', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40' },
  GYM_STAFF: { label: 'Staff',         color: 'bg-purple-500/20 text-purple-400 border-purple-500/40' },
  USER:      { label: 'Miembro',       color: 'bg-blue-500/20 text-blue-400 border-blue-500/40' },
};

export default function PerfilPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [user, setUser] = useState<UserProfile | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // ── Verificar sesión guardada ──────────────────────────
  useEffect(() => {
    const savedUser = localStorage.getItem('gymflow_user');
    const savedToken = localStorage.getItem('gymflow_token');
    if (savedUser && savedToken) {
      const parsedUser = JSON.parse(savedUser);
      setUser(parsedUser);
      loadMembership(parsedUser.id);
    }
    setPageLoading(false);
  }, []);

  // ── Generar QR ────────────────────────────────────────
  useEffect(() => {
    if (user?.qrCode && canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, user.qrCode, {
        width: 200,
        margin: 2,
        color: { dark: '#1a1a2e', light: '#ffffff' },
      });
    }
  }, [user]);

  const loadMembership = async (userId: string) => {
    try {
      const res = await fetch(`http://localhost:3001/api/memberships/user/${userId}`);
      if (res.ok) setMembership(await res.json());
    } catch {}
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('http://localhost:3001/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (res.ok && data.user) {
        localStorage.setItem('gymflow_user', JSON.stringify(data.user));
        localStorage.setItem('gymflow_token', data.token);
        setUser(data.user);
        loadMembership(data.user.id);

        // ✅ Fix 1: Disparar evento para que el Navbar se actualice inmediatamente
        window.dispatchEvent(new Event('gymflow-auth'));
      } else {
        setError(data.message || 'Credenciales incorrectas');
      }
    } catch {
      setError('Error de conexión con el servidor');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('gymflow_user');
    localStorage.removeItem('gymflow_token');
    setUser(null);
    setMembership(null);
    // Notificar al Navbar del logout
    window.dispatchEvent(new Event('gymflow-auth'));
    router.push('/');
  };

  const downloadQR = () => {
    if (!canvasRef.current || !user) return;
    const link = document.createElement('a');
    link.download = `QR-GymFlow-${user.name.replace(' ', '-')}.png`;
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
  };

  const getMembershipDaysLeft = () => {
    if (!membership) return 0;
    const end = new Date(membership.endDate);
    const now = new Date();
    const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
  };

  const isStaffOrAdmin = user?.role === 'ADMIN' || user?.role === 'GYM_STAFF';

  if (pageLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="w-8 h-8 border-t-2 border-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 p-4 pb-24">

      {/* ✅ Fix 2: Header sin logo (ya está en el Navbar global) */}
      <div className="max-w-4xl mx-auto mb-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition group"
          >
            <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Volver al inicio
          </button>
          {user && (
            <button
              onClick={handleLogout}
              className="text-red-400 hover:text-red-300 text-sm flex items-center gap-2 transition"
            >
              <span>🚪</span>
              <span>Cerrar sesión</span>
            </button>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto">

        {/* ── LOGIN ── */}
        {!user && (
          <>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-md mx-auto bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20"
            >
              <div className="text-center mb-8">
                <div className="text-5xl mb-3">🔐</div>
                <h2 className="text-2xl font-bold text-white">Iniciar Sesión</h2>
                <p className="text-gray-400 mt-2 text-sm">Accede a tu perfil y membresía</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-2">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@email.com"
                    required
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/30 transition"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-2">Contraseña</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/30 transition"
                  />
                </div>

                {error && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="bg-red-500/20 border border-red-500/40 rounded-xl p-3 text-red-300 text-sm text-center"
                  >
                    ❌ {error}
                  </motion.div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 disabled:opacity-50 text-white font-bold py-4 rounded-xl transition-all transform hover:scale-[1.02]"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Verificando...
                    </span>
                  ) : 'Iniciar Sesión'}
                </button>
              </form>

              <p className="text-center text-gray-500 text-xs mt-6">
                ¿No tienes cuenta?{' '}
                <a href="/registro" className="text-blue-400 hover:text-blue-300 font-medium">
                  Regístrate aquí
                </a>
              </p>
            </motion.div>
          </>
        )}

        {/* ── PERFIL ── */}
        {user && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Columna izquierda */}
            <div className="space-y-6">

              {/* Card datos usuario */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20"
              >
                <div className="flex flex-col items-center text-center mb-6">
                  <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-3xl font-bold text-white mb-3">
                    {user.name.charAt(0)}
                  </div>
                  <h2 className="text-xl font-bold text-white">{user.name}</h2>
                  <p className="text-gray-400 text-sm">{user.email}</p>
                  {/* ✅ Fix 3: Badge de rol con nombre legible */}
                  <span className={`mt-2 text-xs px-3 py-1 rounded-full font-bold border ${
                    roleLabels[user.role]?.color || 'bg-gray-500/20 text-gray-400 border-gray-500/40'
                  }`}>
                    {roleLabels[user.role]?.label || user.role}
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="bg-white/5 rounded-xl p-3">
                    <p className="text-gray-500 text-xs mb-1">RUT</p>
                    <p className="text-white font-mono font-bold">{user.rut || 'No registrado'}</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3">
                    <p className="text-gray-500 text-xs mb-1">Código QR</p>
                    <p className="text-blue-400 font-mono font-bold text-sm">{user.qrCode || 'No asignado'}</p>
                  </div>
                </div>
              </motion.div>

              {/* Card QR */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 text-center"
              >
                <h3 className="text-white font-bold mb-4">🎫 Tu código de acceso</h3>
                <div className="bg-white rounded-2xl p-4 inline-block mb-4 shadow-xl">
                  <canvas ref={canvasRef} />
                </div>
                <p className="text-gray-400 text-xs mb-4">
                  Muestra este código en el lector del torniquete
                </p>
                <button
                  onClick={downloadQR}
                  className="w-full bg-gradient-to-r from-green-500 to-green-700 hover:from-green-600 hover:to-green-800 text-white font-bold py-3 rounded-xl transition"
                >
                  ⬇️ Descargar QR
                </button>
              </motion.div>
            </div>

            {/* Columna derecha */}
            <div className="lg:col-span-2 space-y-6">

              {/* Card membresía */}
              {membership ? (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`rounded-2xl border ${membershipColors[membership.type]?.border || 'border-white/20'} overflow-hidden`}
                >
                  <div className={`bg-gradient-to-r ${membershipColors[membership.type]?.gradient || 'from-gray-500 to-gray-600'} p-6`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-white/80 text-sm font-medium uppercase tracking-wider">Membresía</p>
                        <h3 className="text-3xl font-bold text-white mt-1">{membership.type}</h3>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                        membership.status === 'ACTIVE'
                          ? 'bg-green-500/30 text-green-200'
                          : 'bg-red-500/30 text-red-200'
                      }`}>
                        {membership.status === 'ACTIVE' ? '✓ Activa' : '✗ Inactiva'}
                      </span>
                    </div>
                    <div className="mt-4">
                      <div className="flex justify-between text-white/80 text-sm mb-1">
                        <span>Días restantes</span>
                        <span className="font-bold text-white">{getMembershipDaysLeft()} días</span>
                      </div>
                      <div className="w-full bg-white/20 rounded-full h-2">
                        <div
                          className="bg-white rounded-full h-2 transition-all"
                          style={{ width: `${Math.min(100, (getMembershipDaysLeft() / 30) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-white/10 backdrop-blur-lg p-6">
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="bg-white/5 rounded-xl p-4">
                        <p className="text-gray-400 text-xs mb-1">Inicio</p>
                        <p className="text-white font-bold">
                          {new Date(membership.startDate).toLocaleDateString('es-CL')}
                        </p>
                      </div>
                      <div className="bg-white/5 rounded-xl p-4">
                        <p className="text-gray-400 text-xs mb-1">Vencimiento</p>
                        <p className="text-white font-bold">
                          {new Date(membership.endDate).toLocaleDateString('es-CL')}
                        </p>
                      </div>
                    </div>

                    <div>
                      <p className="text-gray-400 text-sm font-medium mb-3">
                        🏋️ Gimnasios incluidos ({membership.gyms.length})
                      </p>
                      <div className="space-y-2">
                        {membership.gyms.map((mg, idx) => (
                          <motion.div
                            key={mg.gym.id}
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            className="bg-white/5 rounded-xl p-3 flex items-center justify-between hover:bg-white/10 transition cursor-pointer"
                            onClick={() => router.push(`/gym/${mg.gym.id}`)}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
                                <span className="text-sm">🏋️</span>
                              </div>
                              <div>
                                <p className="text-white font-medium text-sm">{mg.gym.name}</p>
                                <p className="text-gray-400 text-xs">{mg.gym.address}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {mg.gym.chain && (
                                <span className="text-xs text-gray-400 bg-white/5 px-2 py-1 rounded-full">
                                  {mg.gym.chain}
                                </span>
                              )}
                              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ) : (
                /* Sin membresía - solo para USER */
                !isStaffOrAdmin && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 text-center"
                  >
                    <div className="text-5xl mb-4">🎫</div>
                    <h3 className="text-white font-bold text-xl mb-2">Sin membresía activa</h3>
                    <p className="text-gray-400 text-sm">
                      Contacta al administrador de tu gimnasio para activar tu membresía
                    </p>
                  </motion.div>
                )
              )}

              {/* ✅ Fix 4: Acciones rápidas diferenciadas por rol */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20"
              >
                <h3 className="text-white font-bold mb-4">⚡ Acciones Rápidas</h3>

                {/* Usuario normal */}
                {!isStaffOrAdmin && (
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => router.push('/')}
                      className="bg-blue-600/30 hover:bg-blue-600/50 border border-blue-500/30 text-white py-3 px-4 rounded-xl transition flex items-center gap-2 justify-center"
                    >
                      <span>🏠</span>
                      <span className="text-sm font-medium">Ver Gimnasios</span>
                    </button>
                    {membership?.gyms[0] && (
                      <button
                        onClick={() => router.push(`/gym/${membership.gyms[0].gym.id}`)}
                        className="bg-green-600/30 hover:bg-green-600/50 border border-green-500/30 text-white py-3 px-4 rounded-xl transition flex items-center gap-2 justify-center"
                      >
                        <span>📊</span>
                        <span className="text-sm font-medium">Ver Aforo</span>
                      </button>
                    )}
                  </div>
                )}

                {/* Staff y Admin */}
                {isStaffOrAdmin && (
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => router.push('/')}
                      className="bg-blue-600/30 hover:bg-blue-600/50 border border-blue-500/30 text-white py-3 px-4 rounded-xl transition flex items-center gap-2 justify-center"
                    >
                      <span>🏠</span>
                      <span className="text-sm font-medium">Inicio</span>
                    </button>
                    <button
                      onClick={() => router.push('/dashboard')}
                      className="bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/30 text-white py-3 px-4 rounded-xl transition flex items-center gap-2 justify-center"
                    >
                      <span>📊</span>
                      <span className="text-sm font-medium">Dashboard</span>
                    </button>
                    {user.role === 'ADMIN' && (
                      <button
                        onClick={() => router.push('/torniquete/' + (membership?.gyms[0]?.gym.id || ''))}
                        className="bg-gray-600/30 hover:bg-gray-600/50 border border-gray-500/30 text-white py-3 px-4 rounded-xl transition flex items-center gap-2 justify-center col-span-2"
                      >
                        <span>🚪</span>
                        <span className="text-sm font-medium">Panel Torniquete</span>
                      </button>
                    )}
                  </div>
                )}
              </motion.div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}