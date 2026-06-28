'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authAPI } from '@/lib/api';
import AppLayout from '@/components/AppLayout';

interface User {
  id: string;
  username: string;
  email: string;
  created_at: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');

  useEffect(() => {
    authAPI.getProfile()
      .then((data: { user: User }) => setUser(data.user))
      .catch(() => router.push('/'))
      .finally(() => setLoading(false));
  }, [router]);

  const handleLogout = async () => {
    await authAPI.logout();
    router.push('/');
  };

  const handleEdit = () => {
    setUsernameInput(user?.username ?? '');
    setSaveError('');
    setSaveSuccess('');
    setEditing(true);
  };

  const handleSave = async () => {
    setSaveError('');
    setSaveSuccess('');
    setSaveLoading(true);
    try {
      const data = await authAPI.updateProfile({ username: usernameInput });
      setUser(data.user);
      setSaveSuccess('Имя обновлено');
      setEditing(false);
    } catch (err: any) {
      setSaveError(err.message);
    } finally {
      setSaveLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div className="text-sm" style={{ color: 'var(--text-faint)' }}>Загрузка...</div>
      </div>
    );
  }

  const initials = user?.username
    ? user.username.split('@')[0][0].toUpperCase()
    : '?';

  return (
    <AppLayout userEmail={user?.email ?? ''} userName={user?.username} onLogout={handleLogout}>
      <div className="p-8 max-w-2xl">
        <h1 className="text-xl font-semibold mb-6" style={{ color: 'var(--text)' }}>Профиль</h1>

        <div className="rounded-2xl p-6 space-y-6" style={{ border: '1px solid var(--border)' }}>
          {/* Avatar + name */}
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-white font-semibold text-lg shrink-0"
              style={{ background: 'var(--brand)' }}
            >
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              {editing ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    autoFocus
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
                    className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
                    style={{
                      background: 'var(--surface-2)',
                      border: '1px solid var(--border)',
                      color: 'var(--text)',
                    }}
                  />
                  <button
                    onClick={handleSave}
                    disabled={saveLoading}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 transition-opacity hover:opacity-90"
                    style={{ background: 'var(--brand)' }}
                  >
                    Сохранить
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    style={{ color: 'var(--text-muted)', background: 'var(--surface-2)' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-3)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; }}
                  >
                    Отмена
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate" style={{ color: 'var(--text)' }}>{user?.username?.split('@')[0]}</span>
                  <button
                    onClick={handleEdit}
                    className="text-xs font-medium transition-opacity hover:opacity-70 shrink-0"
                    style={{ color: 'var(--brand)' }}
                  >
                    Изменить
                  </button>
                </div>
              )}
              {saveError   && <p className="text-red-500 text-xs mt-1">{saveError}</p>}
              {saveSuccess && <p className="text-xs mt-1" style={{ color: 'var(--brand)' }}>{saveSuccess}</p>}
            </div>
          </div>

          {/* Fields */}
          <div className="space-y-4 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
            <Field label="Email" value={user?.email ?? ''} />
            <Field
              label="Зарегистрирован"
              value={user?.created_at ? new Date(user.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}
            />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center gap-4">
      <span className="text-sm w-36 shrink-0" style={{ color: 'var(--text-faint)' }}>{label}</span>
      <span className={`text-sm ${mono ? 'font-mono text-xs' : ''}`} style={{ color: 'var(--text-2)' }}>{value}</span>
    </div>
  );
}
