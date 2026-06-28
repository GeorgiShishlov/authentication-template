// frontend/app/reset-password/page.tsx
'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { authAPI } from '@/lib/api';

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
  if (score <= 2) return { score, label: 'Слабый',   message: 'Такой пароль легко взломать. Лучше придумать надёжнее, но выбор за вами.', color: 'bg-red-500',    textColor: 'text-red-600' };
  if (score <= 4) return { score, label: 'Средний',  message: 'Неплохой пароль, но можно сделать лучше.',                                 color: 'bg-yellow-400', textColor: 'text-yellow-600' };
  return               { score, label: 'Надёжный', message: 'Отличный пароль!',                                                          color: 'bg-green-500',  textColor: 'text-green-600' };
}

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword]       = useState('');
  const [confirm, setConfirm]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ password?: string[]; confirm?: string }>({});
  const [serverError, setServerError] = useState('');
  const [success, setSuccess]         = useState('');
  const [loading, setLoading]         = useState(false);

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow-md w-96 text-center">
          <p className="text-red-500 font-semibold mb-4">Недействительная ссылка для сброса пароля.</p>
          <button onClick={() => router.push('/')} className="text-blue-500 hover:underline text-sm">
            На страницу входа
          </button>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setServerError('');

    const passwordErrors = validatePassword(password);
    const confirmError   = password !== confirm ? 'Пароли не совпадают' : undefined;
    setFieldErrors({ password: passwordErrors.length ? passwordErrors : undefined, confirm: confirmError });
    if (passwordErrors.length || confirmError) return;

    setLoading(true);
    try {
      const res = await authAPI.resetPassword(token!, password);
      setSuccess(res.message);
    } catch (err: any) {
      setServerError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const strength = password ? getPasswordStrength(password) : null;

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow-md w-96 text-center">
          <p className="text-green-600 font-semibold mb-4">{success}</p>
          <button
            onClick={() => router.push('/')}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Войти
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-lg shadow-md w-96">
        <h1 className="text-2xl font-bold text-center mb-6">Новый пароль</h1>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {/* Новый пароль */}
          <div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Новый пароль"
                className={`w-full p-2 pr-10 border rounded ${fieldErrors.password ? 'border-red-400' : ''}`}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-2 flex items-center text-gray-400 hover:text-gray-600"
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
                      className={`h-1.5 flex-1 rounded-full transition-colors ${strength.score >= seg * 2 ? strength.color : 'bg-gray-200'}`}
                    />
                  ))}
                </div>
                <p className={`text-xs ${strength.textColor}`}>
                  <span className="font-medium">{strength.label}:</span> {strength.message}
                </p>
              </div>
            )}

            {fieldErrors.password && (
              <ul className="mt-1 space-y-0.5">
                {fieldErrors.password.map((err) => (
                  <li key={err} className="text-red-500 text-xs">{err}</li>
                ))}
              </ul>
            )}
          </div>

          {/* Подтверждение пароля */}
          <div>
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Повторите пароль"
              className={`w-full p-2 border rounded ${fieldErrors.confirm ? 'border-red-400' : ''}`}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            {fieldErrors.confirm && (
              <p className="text-red-500 text-xs mt-1">{fieldErrors.confirm}</p>
            )}
          </div>

          {serverError && <p className="text-red-500 text-sm">{serverError}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? 'Сохранение...' : 'Сохранить новый пароль'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordContent />
    </Suspense>
  );
}
