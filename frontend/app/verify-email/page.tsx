'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { authAPI } from '@/lib/api';

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      setMessage('Токен не найден в ссылке.');
      return;
    }

    authAPI.verifyEmail(token)
      .then((res: { message: string }) => {
        setStatus('success');
        setMessage(res.message);
        setTimeout(() => {
          sessionStorage.setItem('openLoginModal', 'true');
          router.push('/');
        }, 2500);
      })
      .catch((err: Error) => {
        setStatus('error');
        setMessage(err.message);
      });
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-subtle)' }}>
      <div className="p-8 rounded-2xl shadow-sm w-96 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        {status === 'loading' && (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Подтверждение...</p>
        )}
        {status === 'success' && (
          <>
            <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: '#D1FAE5' }}>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="#059669" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="font-semibold mb-2" style={{ color: 'var(--text)' }}>Email подтверждён!</p>
            <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>Переходим на страницу входа...</p>
            <button
              onClick={() => { sessionStorage.setItem('openLoginModal', 'true'); router.push('/'); }}
              className="w-full py-2.5 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90"
              style={{ background: 'var(--brand)' }}
            >
              Войти
            </button>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: '#FEE2E2' }}>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="#DC2626" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="font-semibold mb-2" style={{ color: 'var(--text)' }}>Ошибка подтверждения</p>
            <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>{message}</p>
            <button
              onClick={() => router.push('/')}
              className="w-full py-2.5 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90"
              style={{ background: 'var(--brand)' }}
            >
              На главную
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailContent />
    </Suspense>
  );
}
