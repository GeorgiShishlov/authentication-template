// frontend/lib/api.ts
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

async function apiCall(endpoint: string, options: RequestInit = {}, retry = true): Promise<any> {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    credentials: 'include',
  });

  // Пробуем обновить access токен и повторить запрос
  if (response.status === 401 && retry && endpoint !== '/auth/refresh' && endpoint !== '/auth/login') {
    const refreshed = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });

    if (refreshed.ok) {
      return apiCall(endpoint, options, false);
    }

    throw new Error('Сессия истекла. Войдите снова.');
  }

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Ошибка запроса');
  }

  return response.json();
}

export function trackPage(path: string) {
  fetch(`${API_URL}/track`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  }).catch(() => {});
}

export const authAPI = {
  register: (data: { email: string; password: string }) =>
    apiCall('/auth/register', { method: 'POST', body: JSON.stringify(data) }),

  verifyEmail: (token: string) =>
    apiCall(`/auth/verify-email?token=${encodeURIComponent(token)}`),

  login: (data: { email: string; password: string }) =>
    apiCall('/auth/login', { method: 'POST', body: JSON.stringify(data) }),

  logout: () => apiCall('/auth/logout', { method: 'POST' }),

  forgotPassword: (email: string) =>
    apiCall('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),

  resetPassword: (token: string, password: string) =>
    apiCall('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) }),

  getProfile: () => apiCall('/profile/me'),

  updateProfile: (data: { username: string }) =>
    apiCall('/profile/me', { method: 'PUT', body: JSON.stringify(data) }),
};
