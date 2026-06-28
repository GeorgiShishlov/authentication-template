// frontend/lib/adminApi.ts
const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api') + '/admin';

async function call(path: string, options: RequestInit = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
    credentials: 'include',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Ошибка запроса');
  return data;
}

export const adminAPI = {
  login:   (login: string, password: string) =>
    call('/login', { method: 'POST', body: JSON.stringify({ login, password }) }),
  logout:  () => call('/logout', { method: 'POST' }),
  check:   () => call('/me'),
  getUsers: () => call('/users'),
  createUser: (data: { username: string; email: string; password: string }) =>
    call('/users', { method: 'POST', body: JSON.stringify(data) }),
  updateUser: (id: string, data: { username: string; email: string; password?: string }) =>
    call(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteUser: (id: string) =>
    call(`/users/${id}`, { method: 'DELETE' }),
  getStats: () => call('/stats'),
};
