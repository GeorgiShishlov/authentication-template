'use client';

import { useEffect, useState } from 'react';
import { adminAPI } from '@/lib/adminApi';
import DashboardLayout from '@/components/DashboardLayout';

interface User {
  id: string;
  username: string;
  email: string;
  password: string;
  email_verified: number;
  created_at: string;
}

const EMPTY_FORM = { username: '', email: '', password: '' };

const IconUsers = () => (
  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);

const IconStats = () => (
  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="20" x2="18" y2="10"/>
    <line x1="12" y1="20" x2="12" y2="4"/>
    <line x1="6" y1="20" x2="6" y2="14"/>
  </svg>
);

const NAV_ITEMS = [
  { id: 'users', label: 'Пользователи', icon: <IconUsers /> },
  { id: 'stats', label: 'Посещения', icon: <IconStats /> },
];

interface Stats {
  total: number;
  today: number;
  week: number;
  byPage: { path: string; count: number }[];
  byDay: { day: string; count: number }[];
}

export default function AdminPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [loginForm, setLoginForm] = useState({ login: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  const [activeTab, setActiveTab] = useState<'users' | 'stats'>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [loadError, setLoadError] = useState('');
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; user?: User } | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    adminAPI.check()
      .then(() => setAuthed(true))
      .catch(() => setAuthed(false));
  }, []);

  useEffect(() => {
    if (authed) loadUsers();
  }, [authed]);

  useEffect(() => {
    if (authed && activeTab === 'stats' && !stats) loadStats();
  }, [authed, activeTab]);

  async function loadStats() {
    setStatsLoading(true);
    try {
      const data = await adminAPI.getStats();
      setStats(data);
    } finally {
      setStatsLoading(false);
    }
  }

  async function loadUsers() {
    try {
      const data = await adminAPI.getUsers();
      setUsers(data.users);
    } catch (err: any) {
      setLoadError(err.message);
    }
  }

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    try {
      await adminAPI.login(loginForm.login, loginForm.password);
      setAuthed(true);
    } catch (err: any) {
      setLoginError(err.message);
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleLogout() {
    await adminAPI.logout().catch(() => {});
    setAuthed(false);
    setUsers([]);
  }

  function openCreate() {
    setForm(EMPTY_FORM);
    setFormError('');
    setModal({ mode: 'create' });
  }

  function openEdit(user: User) {
    setForm({ username: user.username, email: user.email, password: '' });
    setFormError('');
    setModal({ mode: 'edit', user });
  }

  async function handleFormSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError('');
    setFormLoading(true);
    try {
      if (modal?.mode === 'create') {
        if (!form.password) { setFormError('Пароль обязателен'); setFormLoading(false); return; }
        await adminAPI.createUser(form);
      } else if (modal?.user) {
        await adminAPI.updateUser(modal.user.id, form);
      }
      setModal(null);
      await loadUsers();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  }

  async function handleDelete(user: User) {
    if (!confirm(`Удалить пользователя «${user.username}»?`)) return;
    try {
      await adminAPI.deleteUser(user.id);
      await loadUsers();
    } catch (err: any) {
      alert(err.message);
    }
  }

  if (authed === null) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div className="text-sm" style={{ color: 'var(--text-faint)' }}>Загрузка...</div>
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-subtle)' }}>
        <div className="rounded-2xl shadow-sm p-10 w-full max-w-sm" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-5" style={{ background: 'var(--brand)' }}>
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold mb-1" style={{ color: 'var(--text)' }}>Панель администратора</h1>
          <p className="text-sm mb-6" style={{ color: 'var(--text-faint)' }}>Войдите с учётными данными администратора.</p>
          <form onSubmit={handleLogin} className="space-y-3" noValidate>
            <input
              type="text"
              placeholder="Логин"
              className="w-full px-4 py-3 text-sm rounded-xl outline-none transition"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
              onFocus={(e) => { e.target.style.borderColor = 'var(--brand)'; }}
              onBlur={(e) => { e.target.style.borderColor = 'var(--border)'; }}
              value={loginForm.login}
              onChange={(e) => setLoginForm({ ...loginForm, login: e.target.value })}
              required
            />
            <div className="relative">
              <input
                type={showLoginPassword ? 'text' : 'password'}
                placeholder="Пароль"
                className="w-full px-4 py-3 pr-11 text-sm rounded-xl outline-none transition"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
                onFocus={(e) => { e.target.style.borderColor = 'var(--brand)'; }}
                onBlur={(e) => { e.target.style.borderColor = 'var(--border)'; }}
                value={loginForm.password}
                onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                required
              />
              <button
                type="button"
                onClick={() => setShowLoginPassword((v) => !v)}
                className="absolute inset-y-0 right-3 flex items-center transition-colors"
                style={{ color: 'var(--text-faint)' }}
                tabIndex={-1}
                aria-label={showLoginPassword ? 'Скрыть пароль' : 'Показать пароль'}
              >
                {showLoginPassword ? (
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
            {loginError && <p className="text-red-500 text-xs">{loginError}</p>}
            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-3 rounded-xl text-sm font-medium text-white disabled:opacity-50 transition-opacity hover:opacity-90"
              style={{ background: 'var(--brand)' }}
            >
              {loginLoading ? 'Загрузка...' : 'Войти'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout
      navItems={NAV_ITEMS}
      activeItem={activeTab}
      onNavChange={(id) => setActiveTab(id as 'users' | 'stats')}
      userLabel="Администратор"
      onLogout={handleLogout}
    >
      <div className="p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>
            {activeTab === 'users' ? 'Пользователи' : 'Посещения'}
          </h1>
          {activeTab === 'users' && (
            <button
              onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90"
              style={{ background: 'var(--brand)' }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Создать пользователя
            </button>
          )}
        </div>

        {/* Stats tab */}
        {activeTab === 'stats' && (
          statsLoading || !stats ? (
            <div className="text-sm" style={{ color: 'var(--text-faint)' }}>Загрузка...</div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <StatCard label="Всего посещений" value={stats.total} color="var(--brand)" />
                <StatCard label="Сегодня" value={stats.today} color="#3FB27F" />
                <StatCard label="За 7 дней" value={stats.week} color="#A78BFA" />
              </div>

              {/* Top pages */}
              <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--text-2)' }}>Топ страниц</h3>
                </div>
                <table className="w-full text-sm">
                  <thead style={{ background: 'var(--surface-2)' }}>
                    <tr>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-faint)' }}>Страница</th>
                      <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-faint)' }}>Визиты</th>
                      <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-faint)' }}>Доля</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.byPage.length === 0 ? (
                      <tr><td colSpan={3} className="px-5 py-10 text-center text-sm" style={{ color: 'var(--text-faint)' }}>Нет данных</td></tr>
                    ) : stats.byPage.map((row) => (
                      <tr key={row.path}
                        style={{ borderTop: '1px solid var(--border)' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-subtle)'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                      >
                        <td className="px-5 py-3 font-mono text-xs" style={{ color: 'var(--text-muted)' }}>{row.path}</td>
                        <td className="px-5 py-3 text-right font-semibold" style={{ color: 'var(--text)' }}>{row.count}</td>
                        <td className="px-5 py-3 text-right text-xs" style={{ color: 'var(--text-faint)' }}>
                          {stats.total > 0 ? Math.round((row.count / stats.total) * 100) : 0}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {stats.byDay.length > 0 && (
                <div className="rounded-2xl p-5" style={{ border: '1px solid var(--border)' }}>
                  <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-2)' }}>Посещения за 30 дней</h3>
                  <DayChart data={stats.byDay} />
                </div>
              )}
            </div>
          )
        )}

        {activeTab === 'users' && <>
        {loadError && <p className="text-red-500 text-sm mb-4">{loadError}</p>}

        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          <table className="w-full text-sm">
            <thead style={{ background: 'var(--surface-2)' }}>
              <tr>
                {['ID', 'Имя', 'Email', 'Пароль (хэш)', 'Подтверждён', 'Зарегистрирован', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-faint)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}
                  style={{ borderTop: '1px solid var(--border)' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-subtle)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--text-faint)' }}>{user.id}</td>
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--text)' }}>{user.username}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-muted)' }}>{user.email}</td>
                  <td className="px-4 py-3 font-mono text-xs max-w-xs truncate" style={{ color: 'var(--text-faint)' }} title={user.password}>{user.password}</td>
                  <td className="px-4 py-3">
                    <span
                      className="px-2.5 py-0.5 rounded-full text-xs font-medium"
                      style={user.email_verified
                        ? { background: '#14261E', color: '#3FB27F' }
                        : { background: '#2D1A00', color: '#F59E0B' }}
                    >
                      {user.email_verified ? 'Да' : 'Нет'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-faint)' }}>
                    {new Date(user.created_at).toLocaleDateString('ru-RU')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-3">
                      <button onClick={() => openEdit(user)} className="text-xs font-medium transition-opacity hover:opacity-70" style={{ color: 'var(--brand)' }}>
                        Изменить
                      </button>
                      <button onClick={() => handleDelete(user)} className="text-xs font-medium text-red-400 hover:text-red-300 transition-colors">
                        Удалить
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm" style={{ color: 'var(--text-faint)' }}>
                    Пользователей нет
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        </>}
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="rounded-2xl shadow-xl p-8 w-full max-w-sm mx-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <h2 className="text-lg font-semibold mb-5" style={{ color: 'var(--text)' }}>
              {modal.mode === 'create' ? 'Создать пользователя' : 'Редактировать пользователя'}
            </h2>
            <form onSubmit={handleFormSubmit} className="space-y-4" noValidate>
              <FormField label="Имя">
                <input
                  type="text"
                  className="w-full px-4 py-2.5 text-sm rounded-xl outline-none"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
                  onFocus={(e) => { e.target.style.borderColor = 'var(--brand)'; }}
                  onBlur={(e) => { e.target.style.borderColor = 'var(--border)'; }}
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  required
                />
              </FormField>
              <FormField label="Email">
                <input
                  type="email"
                  className="w-full px-4 py-2.5 text-sm rounded-xl outline-none"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
                  onFocus={(e) => { e.target.style.borderColor = 'var(--brand)'; }}
                  onBlur={(e) => { e.target.style.borderColor = 'var(--border)'; }}
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
              </FormField>
              <FormField label={modal.mode === 'edit' ? 'Пароль (оставьте пустым)' : 'Пароль'}>
                <input
                  type="password"
                  className="w-full px-4 py-2.5 text-sm rounded-xl outline-none"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
                  onFocus={(e) => { e.target.style.borderColor = 'var(--brand)'; }}
                  onBlur={(e) => { e.target.style.borderColor = 'var(--border)'; }}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder={modal.mode === 'edit' ? 'Новый пароль' : ''}
                />
              </FormField>
              {formError && <p className="text-red-500 text-xs">{formError}</p>}
              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-50 transition-opacity hover:opacity-90"
                  style={{ background: 'var(--brand)' }}
                >
                  {formLoading ? '...' : 'Сохранить'}
                </button>
                <button
                  type="button"
                  onClick={() => setModal(null)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors"
                  style={{ color: 'var(--text-muted)', background: 'var(--surface-2)' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-3)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; }}
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>{label}</label>
      {children}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-2xl p-5" style={{ border: '1px solid var(--border)' }}>
      <p className="text-xs mb-1" style={{ color: 'var(--text-faint)' }}>{label}</p>
      <p className="text-3xl font-bold" style={{ color }}>{value.toLocaleString('ru-RU')}</p>
    </div>
  );
}

function DayChart({ data }: { data: { day: string; count: number }[] }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="flex items-end gap-1 h-24">
      {data.map((d) => {
        const heightPct = Math.max((d.count / max) * 100, 4);
        return (
          <div key={d.day} className="flex-1 flex flex-col items-center gap-1 group relative">
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-white text-xs px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none"
              style={{ background: 'var(--surface-3)', color: 'var(--text)' }}
            >
              {d.count}
            </div>
            <div
              className="w-full rounded-sm transition-all"
              style={{ height: `${heightPct}%`, background: 'var(--brand)', opacity: 0.7 }}
            />
          </div>
        );
      })}
    </div>
  );
}
