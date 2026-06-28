'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import ThemeToggle from '@/components/ThemeToggle';

interface Props {
  userEmail: string;
  userName?: string;
  onLogout: () => void;
  children: React.ReactNode;
}

const NAV = [
  { href: '/profile', label: 'Профиль' },
];

function isNavActive(pathname: string, href: string) {
  return pathname === href;
}

export default function AppLayout({ userEmail, userName, onLogout, children }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const displayName = (userName ?? userEmail).split('@')[0];
  const initial = displayName ? displayName[0].toUpperCase() : '?';

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      <header
        className="sticky top-0 z-40"
        style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}
      >
        <div className="max-w-5xl mx-auto px-6 flex items-center justify-between h-14">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2"
          >
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'var(--brand)' }}
            >
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
                <rect x="9" y="3" width="6" height="4" rx="1"/>
                <line x1="9" y1="12" x2="15" y2="12"/>
                <line x1="9" y1="16" x2="13" y2="16"/>
              </svg>
            </div>
            <span className="font-semibold text-sm tracking-tight" style={{ color: 'var(--text)' }}>App</span>
          </button>

          <div className="flex items-center gap-2">
            <ThemeToggle />

            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setOpen((v) => !v)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold transition-opacity hover:opacity-80"
                style={{ background: 'var(--brand)' }}
                aria-label="Меню профиля"
              >
                {initial}
              </button>

              {open && (
                <div
                  className="absolute right-0 top-11 w-52 rounded-2xl shadow-lg z-50 overflow-hidden"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                >
                  <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
                    <p className="text-xs truncate" style={{ color: 'var(--text-faint)' }}>{displayName}</p>
                  </div>

                  <div className="p-1.5">
                    {NAV.map(({ href, label }) => {
                      const active = isNavActive(pathname, href);
                      return (
                        <button
                          key={href}
                          onClick={() => { router.push(href); setOpen(false); }}
                          className="w-full flex items-center px-3 py-2 rounded-xl text-sm text-left transition-colors"
                          style={active
                            ? { background: 'var(--brand-subtle)', color: 'var(--brand)', fontWeight: 500 }
                            : { color: 'var(--text-muted)' }
                          }
                          onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; }}
                          onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="p-1.5" style={{ borderTop: '1px solid var(--border)' }}>
                    <button
                      onClick={() => { setOpen(false); onLogout(); }}
                      className="w-full flex items-center px-3 py-2 rounded-xl text-sm transition-colors"
                      style={{ color: 'var(--text-muted)' }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)';
                        (e.currentTarget as HTMLElement).style.color = '#F87171';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.background = 'transparent';
                        (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
                      }}
                    >
                      Выйти
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="max-w-5xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
