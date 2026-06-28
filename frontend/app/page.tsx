'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import AuthModal from '@/components/AuthModal';
import ThemeToggle from '@/components/ThemeToggle';
import { trackPage } from '@/lib/api';

function HomeContent() {
  const searchParams = useSearchParams();
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'login' | 'register'>('login');
  const [oauthError, setOauthError] = useState('');

  useEffect(() => { trackPage('/'); }, []);

  useEffect(() => {
    if (searchParams.get('error') === 'oauth_failed') {
      setOauthError('Не удалось войти через Google. Попробуйте ещё раз.');
      setModalMode('login');
      setModalOpen(true);
    }
  }, [searchParams]);

  useEffect(() => {
    if (sessionStorage.getItem('openLoginModal') === 'true') {
      sessionStorage.removeItem('openLoginModal');
      setModalMode('login');
      setModalOpen(true);
    }
  }, []);

  const openModal = (mode: 'login' | 'register' = 'login') => { setModalMode(mode); setModalOpen(true); };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>

      {/* ── Header ── */}
      <header className="sticky top-0 z-40" style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
        <div className="max-w-5xl mx-auto px-6 flex items-center justify-between h-14">
          <Logo />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={() => openModal()}
              className="px-4 py-2 text-sm font-medium text-white rounded-xl transition-opacity hover:opacity-90"
              style={{ background: 'var(--brand)' }}
            >
              Войти
            </button>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="flex-1 flex items-center" style={{ background: 'var(--bg)' }}>
        <div className="max-w-5xl mx-auto px-6 py-24 text-center">
          <h1 className="text-4xl font-bold leading-tight mb-4" style={{ color: 'var(--text)' }}>
            Добро пожаловать
          </h1>
          <p className="text-lg mb-8 leading-relaxed max-w-md mx-auto" style={{ color: 'var(--text-muted)' }}>
            Войдите в свой аккаунт или создайте новый, чтобы продолжить.
          </p>
          <div className="flex items-center gap-3 justify-center">
            <button
              onClick={() => openModal('login')}
              className="px-6 py-3 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: 'var(--brand)' }}
            >
              Войти
            </button>
            <button
              onClick={() => openModal('register')}
              className="px-6 py-3 rounded-xl text-sm font-semibold transition-colors"
              style={{ color: 'var(--text-muted)', background: 'var(--surface-2)' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-3)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; }}
            >
              Зарегистрироваться
            </button>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ background: 'var(--bg-subtle)', borderTop: '1px solid var(--border)' }}>
        <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Logo />
          <p className="text-xs" style={{ color: 'var(--text-faint)' }}>© {new Date().getFullYear()} App</p>
        </div>
      </footer>

      {/* ── Auth modal ── */}
      {modalOpen && (
        <AuthModal
          onClose={() => { setModalOpen(false); setOauthError(''); }}
          initialError={oauthError}
          initialMode={modalMode}
        />
      )}
    </div>
  );
}

export default function Home() {
  return (
    <Suspense>
      <HomeContent />
    </Suspense>
  );
}

function Logo() {
  return (
    <div className="flex items-center gap-2">
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center"
        style={{ background: 'var(--brand)' }}
      >
        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      </div>
      <span className="font-semibold text-sm tracking-tight" style={{ color: 'var(--text)' }}>App</span>
    </div>
  );
}
