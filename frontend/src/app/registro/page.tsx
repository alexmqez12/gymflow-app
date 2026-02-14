'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

interface Gym {
  id: string;
  name: string;
  address: string;
  chain?: string;
}

interface RutValidation {
  exists: boolean;
  hasAccount: boolean;
  gymFound?: boolean;
  gymName?: string;
  message: string;
}

type Step = 1 | 2 | 3;

export default function RegistroPage() {
  const router = useRouter();

  // Step 1: Gym + RUT
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [selectedGym, setSelectedGym] = useState('');
  const [rut, setRut] = useState('');
  const [rutValidation, setRutValidation] = useState<RutValidation | null>(null);
  const [validatingRut, setValidatingRut] = useState(false);

  // Step 2: Datos personales
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // General
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('http://localhost:3001/api/gyms')
      .then(r => r.json())
      .then(setGyms)
      .catch(console.error);
  }, []);

  // Formatear RUT automáticamente
  const formatRut = (value: string) => {
    const clean = value.replace(/[^0-9kK]/g, '');
    if (clean.length <= 1) return clean;
    const body = clean.slice(0, -1);
    const dv = clean.slice(-1);
    return `${body}-${dv}`;
  };

  const handleRutChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatRut(e.target.value);
    setRut(formatted);
    setRutValidation(null);
  };

  const validateRut = async () => {
    if (!rut || !selectedGym) {
      setError('Selecciona un gimnasio e ingresa tu RUT');
      return;
    }

    setValidatingRut(true);
    setError('');

    try {
      const res = await fetch('http://localhost:3001/api/memberships/validate-rut', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rut, gymId: selectedGym }),
      });

      const data = await res.json();
      setRutValidation(data);

      if (data.hasAccount) {
        setError('Este RUT ya tiene una cuenta. Inicia sesión.');
      } else if (data.gymFound) {
        setStep(2);
      } else {
        setError(data.message || 'Error al validar RUT');
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setValidatingRut(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('http://localhost:3001/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, rut, gymId: selectedGym }),
      });

      const data = await res.json();

      if (res.ok && data.user) {
        localStorage.setItem('gymflow_user', JSON.stringify(data.user));
        localStorage.setItem('gymflow_token', data.token);
        setStep(3);
      } else {
        setError(data.message || 'Error al registrarse');
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const selectedGymData = gyms.find(g => g.id === selectedGym);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">

        {/* Logo */}
        <div
          className="text-center mb-8 cursor-pointer"
          onClick={() => router.push('/')}
        >
          <h1 className="text-3xl font-bold text-white">🏋️ GymFlow</h1>
          <p className="text-gray-400 text-sm mt-1">Crea tu cuenta</p>
        </div>

        {/* Indicador de pasos */}
        {step !== 3 && (
          <div className="flex items-center justify-center gap-3 mb-8">
            {[1, 2].map((s) => (
              <div key={s} className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  step >= s
                    ? 'bg-blue-600 text-white'
                    : 'bg-white/10 text-gray-400'
                }`}>
                  {step > s ? '✓' : s}
                </div>
                {s < 2 && (
                  <div className={`w-16 h-0.5 transition-all ${step > s ? 'bg-blue-600' : 'bg-white/10'}`} />
                )}
              </div>
            ))}
          </div>
        )}

        <AnimatePresence mode="wait">

          {/* ===== PASO 1: Gym + RUT ===== */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20"
            >
              <h2 className="text-xl font-bold text-white mb-2">Verificar membresía</h2>
              <p className="text-gray-400 text-sm mb-6">
                Selecciona tu gimnasio e ingresa tu RUT para verificar tu membresía
              </p>

              <div className="space-y-4">
                {/* Selector de gimnasio */}
                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-2">
                    Selecciona tu gimnasio
                  </label>
                  <div className="grid grid-cols-1 gap-2">
                    {gyms.map(gym => (
                      <button
                        key={gym.id}
                        type="button"
                        onClick={() => setSelectedGym(gym.id)}
                        className={`w-full p-3 rounded-xl border text-left transition flex items-center justify-between ${
                          selectedGym === gym.id
                            ? 'bg-blue-600/30 border-blue-500 text-white'
                            : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                        }`}
                      >
                        <div>
                          <p className="font-medium text-sm">{gym.name}</p>
                          <p className="text-xs text-gray-400">{gym.address}</p>
                        </div>
                        {gym.chain && (
                          <span className="text-xs bg-white/10 px-2 py-1 rounded-full text-gray-300">
                            {gym.chain}
                          </span>
                        )}
                        {selectedGym === gym.id && (
                          <span className="text-blue-400 ml-2">✓</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Input RUT */}
                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-2">
                    Tu RUT
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={rut}
                      onChange={handleRutChange}
                      placeholder="12345678-9"
                      maxLength={10}
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/30 transition font-mono tracking-widest text-lg"
                    />
                    {rutValidation?.gymFound && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-400">✓</div>
                    )}
                  </div>
                  <p className="text-gray-500 text-xs mt-1">Formato: 12345678-9</p>
                </div>

                {error && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="bg-red-500/20 border border-red-500/40 rounded-xl p-3 text-red-300 text-sm"
                  >
                    ❌ {error}
                  </motion.div>
                )}

                <button
                  onClick={validateRut}
                  disabled={validatingRut || !rut || !selectedGym}
                  className="w-full bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-all transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  {validatingRut ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Verificando...
                    </span>
                  ) : 'Verificar RUT →'}
                </button>
              </div>

              <p className="text-center text-gray-400 text-sm mt-6">
                ¿Ya tienes cuenta?{' '}
                <a href="/perfil" className="text-blue-400 hover:text-blue-300 font-medium">
                  Iniciar sesión
                </a>
              </p>
            </motion.div>
          )}

          {/* ===== PASO 2: Datos personales ===== */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20"
            >
              {/* Gym confirmado */}
              {selectedGymData && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 mb-6 flex items-center gap-3">
                  <span className="text-green-400 text-xl">✓</span>
                  <div>
                    <p className="text-green-300 text-sm font-medium">Gimnasio verificado</p>
                    <p className="text-gray-400 text-xs">{selectedGymData.name}</p>
                  </div>
                </div>
              )}

              <h2 className="text-xl font-bold text-white mb-2">Tus datos</h2>
              <p className="text-gray-400 text-sm mb-6">Completa tu información para crear la cuenta</p>

              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-2">
                    Nombre completo
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Juan Pérez"
                    required
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/30 transition"
                  />
                </div>

                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-2">
                    Email
                  </label>
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
                  <label className="block text-gray-300 text-sm font-medium mb-2">
                    Contraseña
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      required
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/30 transition pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition"
                    >
                      {showPassword ? '🙈' : '👁️'}
                    </button>
                  </div>

                  {/* Indicador de fortaleza */}
                  {password && (
                    <div className="mt-2">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4].map(i => (
                          <div
                            key={i}
                            className={`h-1 flex-1 rounded-full transition-all ${
                              password.length >= i * 3
                                ? i <= 1 ? 'bg-red-500'
                                  : i <= 2 ? 'bg-yellow-500'
                                  : i <= 3 ? 'bg-blue-500'
                                  : 'bg-green-500'
                                : 'bg-white/10'
                            }`}
                          />
                        ))}
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        {password.length < 6 ? 'Muy corta' :
                         password.length < 8 ? 'Débil' :
                         password.length < 10 ? 'Moderada' : 'Fuerte'}
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-2">
                    Confirmar contraseña
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repite tu contraseña"
                      required
                      className={`w-full px-4 py-3 bg-white/10 border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition pr-12 ${
                        confirmPassword && password !== confirmPassword
                          ? 'border-red-500 focus:border-red-500 focus:ring-red-500/30'
                          : confirmPassword && password === confirmPassword
                          ? 'border-green-500 focus:border-green-500 focus:ring-green-500/30'
                          : 'border-white/20 focus:border-blue-400 focus:ring-blue-400/30'
                      }`}
                    />
                    {confirmPassword && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {password === confirmPassword
                          ? <span className="text-green-400">✓</span>
                          : <span className="text-red-400">✗</span>
                        }
                      </div>
                    )}
                  </div>
                </div>

                {error && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="bg-red-500/20 border border-red-500/40 rounded-xl p-3 text-red-300 text-sm"
                  >
                    ❌ {error}
                  </motion.div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => { setStep(1); setError(''); }}
                    className="flex-1 bg-white/10 hover:bg-white/20 text-gray-300 font-bold py-4 rounded-xl transition"
                  >
                    ← Atrás
                  </button>
                  <button
                    type="submit"
                    disabled={loading || password !== confirmPassword}
                    className="flex-2 w-full bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 disabled:opacity-40 text-white font-bold py-4 rounded-xl transition-all transform hover:scale-[1.02]"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Creando cuenta...
                      </span>
                    ) : 'Crear Cuenta ✓'}
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          {/* ===== PASO 3: Éxito ===== */}
          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
                className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6"
              >
                <svg className="w-14 h-14 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </motion.div>

              <h2 className="text-3xl font-bold text-white mb-2">¡Bienvenido!</h2>
              <p className="text-gray-300 mb-2">Tu cuenta fue creada exitosamente</p>
              {selectedGymData && (
                <p className="text-blue-400 text-sm mb-8">
                  Membresía activada en <strong>{selectedGymData.name}</strong>
                </p>
              )}

              <div className="space-y-3">
                <button
                  onClick={() => router.push('/perfil')}
                  className="w-full bg-gradient-to-r from-blue-500 to-blue-700 text-white font-bold py-4 rounded-xl transition hover:scale-[1.02]"
                >
                  👤 Ver mi perfil y QR
                </button>
                <button
                  onClick={() => router.push('/')}
                  className="w-full bg-white/10 hover:bg-white/20 text-gray-300 py-4 rounded-xl transition"
                >
                  🏠 Ir al inicio
                </button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}