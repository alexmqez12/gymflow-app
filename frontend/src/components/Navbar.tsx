'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface Membership {
  type: string;
  status: string;
}

const membershipColors: Record<string, string> = {
  PREMIUM: 'from-yellow-500 to-orange-500',
  SMARTFIT: 'from-blue-500 to-cyan-500',
  POWERFIT: 'from-red-500 to-orange-500',
  BASIC: 'from-gray-400 to-gray-500',
  CUSTOM: 'from-purple-500 to-pink-500',
};

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('gymflow_user');
    const token = localStorage.getItem('gymflow_token');
    if (saved && token) {
      const parsed = JSON.parse(saved);
      setUser(parsed);
      loadMembership(parsed.id);
    }

    const handleStorage = () => {
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

    window.addEventListener('storage', handleStorage);
    window.addEventListener('gymflow-auth', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('gymflow-auth', handleStorage);
    };
  }, [pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Cerrar menú al cambiar de ruta
  useEffect(() => {
    setShowMenu(false);
  }, [pathname]);

  const loadMembership = async (userId: string) => {
    try {
      const res = await fetch(`http://localhost:3001/api/memberships/user/${userId}`);
      if (res.ok) setMembership(await res.json());
    } catch {}
  };

  const handleLogout = () => {
    localStorage.removeItem('gymflow_user');
    localStorage.removeItem('gymflow_token');
    setUser(null);
    setMembership(null);
    setShowMenu(false);
    window.dispatchEvent(new Event('gymflow-auth'));
    router.push('/');
  };

  // Ocultar navbar en torniquete
  if (pathname?.startsWith('/torniquete')) return null;

  const navLinks = [
    { href: '/', label: 'Inicio', icon: '🏠' },
    { href: '/perfil', label: 'Perfil', icon: '👤' },
    ...(['ADMIN', 'GYM_STAFF'].includes(user?.role ?? '')
        ? [{ href: '/dashboard', label: 'Dashboard', icon: '📊' }]
        : []),
    ];

  return (
    <>
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-gray-900/95 backdrop-blur-xl shadow-2xl border-b border-white/10'
          : 'bg-gray-900/80 backdrop-blur-lg border-b border-white/5'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">

            {/* Logo */}
            <button
              onClick={() => router.push('/')}
              className="flex items-center gap-2 group"
            >
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex items-center justify-center text-sm font-bold shadow-lg group-hover:scale-110 transition-transform">
                G
              </div>
              <span className="text-white font-bold text-lg tracking-tight">
                Gym<span className="text-blue-400">Flow</span>
              </span>
            </button>

            {/* Links centrales */}
            <div className="hidden md:flex items-center gap-1">
              {navLinks.map(link => (
                <button
                  key={link.href}
                  onClick={() => router.push(link.href)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    pathname === link.href
                      ? 'bg-blue-600/30 text-blue-300 border border-blue-500/30'
                      : 'text-gray-400 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <span>{link.icon}</span>
                  <span>{link.label}</span>
                </button>
              ))}
            </div>

            {/* Usuario */}
            <div className="flex items-center gap-3">
              {user ? (
                <div className="relative">
                  <button
                    onClick={() => setShowMenu(!showMenu)}
                    className="flex items-center gap-2 bg-white/10 hover:bg-white/15 border border-white/10 hover:border-white/20 px-3 py-2 rounded-xl transition-all group"
                  >
                    {/* Avatar */}
                    <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${membershipColors[membership?.type || ''] || 'from-blue-500 to-blue-700'} flex items-center justify-center text-xs font-bold text-white`}>
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-white text-sm font-medium hidden sm:block">
                      {user.name.split(' ')[0]}
                    </span>
                    {membership && (
                      <span className={`hidden sm:block text-xs px-2 py-0.5 rounded-full font-bold bg-gradient-to-r ${membershipColors[membership.type] || 'from-gray-500 to-gray-600'} text-white`}>
                        {membership.type}
                      </span>
                    )}
                    <svg
                      className={`w-4 h-4 text-gray-400 transition-transform ${showMenu ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Dropdown */}
                  <AnimatePresence>
                    {showMenu && (
                      <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.96 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 mt-2 w-60 bg-gray-800/95 backdrop-blur-xl border border-white/15 rounded-2xl shadow-2xl overflow-hidden"
                      >
                        {/* Header usuario */}
                        <div className="p-4 border-b border-white/10">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${membershipColors[membership?.type || ''] || 'from-blue-500 to-blue-700'} flex items-center justify-center text-sm font-bold text-white`}>
                              {user.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-white font-semibold text-sm">{user.name}</p>
                              <p className="text-gray-400 text-xs">{user.email}</p>
                            </div>
                          </div>
                          {membership && (
                            <div className={`mt-3 px-3 py-2 rounded-xl bg-gradient-to-r ${membershipColors[membership.type] || 'from-gray-500 to-gray-600'} flex items-center justify-between`}>
                              <span className="text-white text-xs font-bold">{membership.type}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                membership.status === 'ACTIVE'
                                  ? 'bg-green-500/30 text-green-200'
                                  : 'bg-red-500/30 text-red-200'
                              }`}>
                                {membership.status === 'ACTIVE' ? 'Activa' : 'Inactiva'}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Opciones */}
                        <div className="p-2">
                          <button
                            onClick={() => { router.push('/'); setShowMenu(false); }}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
                              pathname === '/'
                                ? 'bg-blue-600/20 text-blue-300'
                                : 'text-gray-300 hover:bg-white/10 hover:text-white'
                            }`}
                          >
                            <span className="w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center">🏠</span>
                            <span>Inicio</span>
                          </button>

                          <button
                            onClick={() => { router.push('/perfil'); setShowMenu(false); }}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
                              pathname === '/perfil'
                                ? 'bg-blue-600/20 text-blue-300'
                                : 'text-gray-300 hover:bg-white/10 hover:text-white'
                            }`}
                          >
                            <span className="w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center">👤</span>
                            <span>Mi Perfil</span>
                          </button>

                         {['ADMIN', 'GYM_STAFF'].includes(user?.role ?? '') && (
                            <button
                                onClick={() => { router.push('/dashboard'); setShowMenu(false); }}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
                                pathname === '/dashboard'
                                    ? 'bg-blue-600/20 text-blue-300'
                                    : 'text-gray-300 hover:bg-white/10 hover:text-white'
                                }`}
                            >
                                <span className="w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center">📊</span>
                                <span>Dashboard</span>
                            </button>
                            )}

                          {user.role === 'ADMIN' && (
                            <button
                              onClick={() => { router.push('/admin'); setShowMenu(false); }}
                              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-300 hover:bg-white/10 hover:text-white transition-all"
                            >
                              <span className="w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center">⚙️</span>
                              <span>Administración</span>
                            </button>
                          )}
                        </div>

                        {/* Logout */}
                        <div className="p-2 border-t border-white/10">
                          <button
                            onClick={handleLogout}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all"
                          >
                            <span className="w-8 h-8 bg-red-500/10 rounded-lg flex items-center justify-center">🚪</span>
                            <span>Cerrar Sesión</span>
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => router.push('/perfil')}
                    className="text-gray-300 hover:text-white px-3 py-2 rounded-xl text-sm transition hover:bg-white/10"
                  >
                    Iniciar sesión
                  </button>
                  <button
                    onClick={() => router.push('/registro')}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition shadow-lg shadow-blue-500/20"
                  >
                    Registrarse
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile bottom nav */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-gray-900/95 backdrop-blur-xl border-t border-white/10 px-4 py-2 z-50">
          <div className="flex items-center justify-around">
            <button
              onClick={() => router.push('/')}
              className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all ${
                pathname === '/' ? 'text-blue-400' : 'text-gray-400'
              }`}
            >
              <span className="text-xl">🏠</span>
              <span className="text-xs font-medium">Inicio</span>
            </button>

            <button
              onClick={() => router.push('/perfil')}
              className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all ${
                pathname === '/perfil' ? 'text-blue-400' : 'text-gray-400'
              }`}
            >
              <span className="text-xl">👤</span>
              <span className="text-xs font-medium">Perfil</span>
            </button>

            {user ? (
              <button
                onClick={handleLogout}
                className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl text-red-400"
              >
                <span className="text-xl">🚪</span>
                <span className="text-xs font-medium">Salir</span>
              </button>
            ) : (
              <button
                onClick={() => router.push('/registro')}
                className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all ${
                  pathname === '/registro' ? 'text-blue-400' : 'text-gray-400'
                }`}
              >
                <span className="text-xl">✍️</span>
                <span className="text-xs font-medium">Registro</span>
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Spacer para el contenido no quede bajo el navbar */}
      <div className="h-16" />

      {/* Overlay para cerrar el menú */}
      {showMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowMenu(false)}
        />
      )}
    </>
  );
}