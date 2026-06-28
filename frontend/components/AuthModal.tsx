// frontend/components/AuthModal.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authAPI } from '@/lib/api';

function validateEmail(email: string): string | null {
  if (!email) return 'Email обязателен';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Некорректный email';
  return null;
}

function validatePassword(password: string): string[] {
  const errors: string[] = [];
  if (!password)                       { errors.push('Пароль обязателен'); return errors; }
  if (password.length > 30)            errors.push('Не более 30 символов');
  if (password.length < 6)             errors.push('Не менее 6 символов');
  if (!/[A-Z]/.test(password))         errors.push('Хотя бы одна прописная буква');
  if (!/[a-z]/.test(password))         errors.push('Хотя бы одна строчная буква');
  if (!/[0-9]/.test(password))         errors.push('Хотя бы одна цифра');
  if (!/[^A-Za-z0-9]/.test(password))  errors.push('Хотя бы один специальный символ');
  return errors;
}

function getPasswordStrength(password: string) {
  if (!password) return null;
  let score = 0;
  if (password.length >= 8)           score++;
  if (password.length >= 14)          score++;
  if (/[A-Z]/.test(password))         score++;
  if (/[a-z]/.test(password))         score++;
  if (/[0-9]/.test(password))         score++;
  if (/[^A-Za-z0-9]/.test(password))  score++;
  if (score <= 2) return { score, label: 'Слабый',   color: 'bg-red-400',    textColor: 'text-red-500' };
  if (score <= 4) return { score, label: 'Средний',  color: 'bg-yellow-400', textColor: 'text-yellow-500' };
  return               { score, label: 'Надёжный', color: 'bg-green-500',  textColor: 'text-green-500' };
}

type Mode = 'login' | 'register' | 'forgot';

interface Props {
  onClose: () => void;
  initialError?: string;
  initialMode?: Mode;
}

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') ?? 'http://localhost:3001';

export default function AuthModal({ onClose, initialError, initialMode }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode ?? 'login');
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string[] }>({});
  const [serverError, setServerError] = useState(initialError ?? '');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  function resetState(nextMode: Mode) {
    setMode(nextMode);
    setServerError('');
    setSuccess('');
    setFieldErrors({});
    setFormData({ email: '', password: '' });
    setShowPassword(false);
  }

  function validateForm(): boolean {
    const emailError = validateEmail(formData.email);
    const passwordErrors = validatePassword(formData.password);
    setFieldErrors({
      email: emailError ?? undefined,
      password: passwordErrors.length ? passwordErrors : undefined,
    });
    return !emailError && !passwordErrors.length;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setServerError('');
    setSuccess('');

    if (mode === 'forgot') {
      const emailError = validateEmail(formData.email);
      if (emailError) { setFieldErrors({ email: emailError }); return; }
      setLoading(true);
      try {
        const res = await authAPI.forgotPassword(formData.email);
        setSuccess(res.message);
        setFormData({ email: '', password: '' });
      } catch (err: any) {
        setServerError(err.message);
      } finally {
        setLoading(false);
      }
      return;
    }

    if (mode === 'register' && !validateForm()) return;

    setLoading(true);
    try {
      if (mode === 'login') {
        await authAPI.login(formData);
        router.push('/profile');
      } else {
        const res = await authAPI.register(formData);
        setSuccess(res.message);
        setFormData({ email: '', password: '' });
        setFieldErrors({});
      }
    } catch (err: any) {
      setServerError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const strength = mode === 'register' && formData.password
    ? getPasswordStrength(formData.password)
    : null;

  const titles: Record<Mode, string> = {
    login:    'Войти в аккаунт',
    register: 'Создать аккаунт',
    forgot:   'Восстановление пароля',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative rounded-2xl shadow-2xl flex flex-col"
        style={{
          width: '100%',
          maxWidth: '448px',
          minHeight: '518px',
          padding: '40px',
          margin: '0 16px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 transition-colors"
          style={{ color: 'var(--text-faint)' }}
          aria-label="Закрыть"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>

        {/* Logo */}
        <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-5" style={{ background: 'var(--surface-3)' }}>
          <svg className="w-5 h-5" style={{ color: 'var(--brand)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>

        {/* Title */}
        <h2 className="text-2xl font-semibold mb-1" style={{ color: 'var(--text)' }}>{titles[mode]}</h2>
        <p className="text-sm mb-7" style={{ color: 'var(--text-muted)' }}>
          {mode === 'login'    && 'Рады видеть вас снова.'}
          {mode === 'register' && 'Создайте аккаунт, чтобы начать.'}
          {mode === 'forgot'   && 'Укажите email и мы пришлём инструкции.'}
        </p>

        {/* Google */}
        {mode !== 'forgot' && (
          <>
            <a
              href={`${BACKEND_URL}/api/auth/google`}
              className="flex items-center justify-center gap-3 w-full rounded-xl py-3 text-sm font-medium transition-colors mb-4"
              style={{ border: '1px solid var(--border)', color: 'var(--text-2)', background: 'transparent' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Продолжить с Google
            </a>

            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
              <span className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-faint)' }}>или</span>
              <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
            </div>
          </>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 flex-1 flex flex-col" noValidate>
          {/* Email */}
          <div>
            <input
              type="email"
              placeholder="Электронная почта"
              className={`w-full px-4 py-3 text-base rounded-xl outline-none transition ${fieldErrors.email ? 'border-red-400' : ''}`}
              style={{
                background: 'var(--surface-2)',
                border: `1px solid ${fieldErrors.email ? '#F87171' : 'var(--border)'}`,
                color: 'var(--text)',
              }}
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
            {fieldErrors.email && <p className="text-red-500 text-xs mt-1.5 ml-1">{fieldErrors.email}</p>}
          </div>

          {/* Password */}
          {mode !== 'forgot' && (
            <div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Пароль"
                  className={`w-full px-4 py-3 pr-11 text-base rounded-xl outline-none transition ${fieldErrors.password ? 'border-red-400' : ''}`}
                  style={{
                    background: 'var(--surface-2)',
                    border: `1px solid ${fieldErrors.password ? '#F87171' : 'var(--border)'}`,
                    color: 'var(--text)',
                  }}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-3 flex items-center transition-colors"
                  style={{ color: 'var(--text-faint)' }}
                  tabIndex={-1}
                  aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>

              {strength && (
                <div className="mt-2 space-y-1">
                  <div className="flex gap-1">
                    {[1, 2, 3].map((seg) => (
                      <div
                        key={seg}
                        className={`h-1 flex-1 rounded-full transition-colors ${strength.score >= seg * 2 ? strength.color : ''}`}
                        style={strength.score < seg * 2 ? { background: 'var(--surface-3)' } : {}}
                      />
                    ))}
                  </div>
                  <p className={`text-xs ${strength.textColor}`}>{strength.label}</p>
                </div>
              )}

              {fieldErrors.password && (
                <ul className="mt-1.5 space-y-0.5">
                  {fieldErrors.password.map((err) => (
                    <li key={err} className="text-red-500 text-xs ml-1">{err}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {serverError && <p className="text-red-500 text-sm">{serverError}</p>}
          {success     && <p className="text-green-500 text-sm">{success}</p>}

          <div className="flex-1" />

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-base font-medium disabled:opacity-50 transition-opacity hover:opacity-90"
            style={{ background: 'var(--brand)', color: '#ffffff' }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            {loading ? 'Загрузка...' : { login: 'Войти', register: 'Зарегистрироваться', forgot: 'Отправить инструкции' }[mode]}
          </button>
        </form>

        {/* Navigation */}
        <div className="mt-5 flex flex-col gap-1.5 text-center">
          {mode === 'login' && (
            <>
              <button onClick={() => resetState('forgot')} className="text-sm transition-colors" style={{ color: 'var(--text-faint)' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-faint)'; }}
              >
                Забыли пароль?
              </button>
              <button onClick={() => resetState('register')} className="text-sm transition-colors" style={{ color: 'var(--text-muted)' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
              >
                Нет аккаунта? <span className="font-medium">Зарегистрируйтесь</span>
              </button>
            </>
          )}
          {mode === 'register' && (
            <button onClick={() => resetState('login')} className="text-sm transition-colors" style={{ color: 'var(--text-muted)' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
            >
              Уже есть аккаунт? <span className="font-medium">Войдите</span>
            </button>
          )}
          {mode === 'forgot' && (
            <button onClick={() => resetState('login')} className="text-sm transition-colors" style={{ color: 'var(--text-muted)' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
            >
              <span className="font-medium">← Вернуться ко входу</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
