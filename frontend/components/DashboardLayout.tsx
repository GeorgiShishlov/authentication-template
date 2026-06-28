'use client';

import React from 'react';
import ThemeToggle from '@/components/ThemeToggle';

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
}

interface Props {
  navItems: NavItem[];
  activeItem: string;
  onNavChange: (id: string) => void;
  userLabel: string;
  onLogout: () => void;
  children: React.ReactNode;
}

const IconLogout = () => (
  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
    <polyline points="16 17 21 12 16 7"/>
    <line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);

export default function DashboardLayout({ navItems, activeItem, onNavChange, userLabel, onLogout, children }: Props) {
  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* Sidebar */}
      <aside
        className="fixed top-0 left-0 h-full flex flex-col"
        style={{ width: 240, background: 'var(--surface-2)', borderRight: '1px solid var(--border)' }}
      >
        {/* Logo */}
        <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--brand)' }}>
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="font-semibold text-sm" style={{ color: 'var(--text)' }}>App</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onNavChange(item.id)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
              style={
                activeItem === item.id
                  ? { background: 'var(--surface)', color: 'var(--brand)', boxShadow: '0 1px 3px rgba(0,0,0,0.12)' }
                  : { color: 'var(--text-muted)' }
              }
              onMouseEnter={(e) => {
                if (activeItem !== item.id) (e.currentTarget as HTMLElement).style.background = 'var(--surface-3)';
              }}
              onMouseLeave={(e) => {
                if (activeItem !== item.id) (e.currentTarget as HTMLElement).style.background = 'transparent';
              }}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-3" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between px-3 py-1 mb-1">
            <span className="text-xs truncate" style={{ color: 'var(--text-faint)' }}>{userLabel}</span>
            <ThemeToggle />
          </div>
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-3)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <IconLogout />
            Выйти
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-h-screen" style={{ marginLeft: 240, background: 'var(--bg)' }}>
        {children}
      </main>
    </div>
  );
}
