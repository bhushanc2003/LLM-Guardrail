import React, { useState } from 'react';
import {
  C,
  GuardianLogo,
  IconShield,
  IconOverview,
  IconActivity,
  IconTrust,
  IconUsers,
  IconTest,
  IconSun,
  IconMoon,
  IconChevronLeft,
  IconChevronRight,
} from './ui.jsx';

const navIcons = {
  overview: IconOverview,
  activity: IconActivity,
  trust: IconTrust,
  users: IconUsers,
  test: IconTest,
};

export default function Shell({ items, active, onNav, title, subtitle, userButton, children }) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('sidebar_collapsed') === 'true';
    } catch (_) {
      return false;
    }
  });

  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('app_theme') || 'dark';
    } catch (_) {
      return 'dark';
    }
  });

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    try {
      localStorage.setItem('app_theme', next);
    } catch (_) {}
    document.documentElement.setAttribute('data-theme', next);
    if (next === 'light') {
      document.body.style.backgroundColor = '#f1f5f9';
      document.body.style.color = '#0f172a';
    } else {
      document.body.style.backgroundColor = '#060913';
      document.body.style.color = '#f8fafc';
    }
  };

  const toggle = () => {
    setCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('sidebar_collapsed', String(next));
      } catch (_) { }
      return next;
    });
  };

  const PageIcon = navIcons[active] || IconOverview;

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at 20% 0%, #0d1733 0%, #050814 65%)',
      color: C.text,
      fontFamily: "'Outfit', system-ui, -apple-system, sans-serif",
    }}>
      {/* Cyber Glassmorphic Sidebar (Collapsable) */}
      <aside style={{
        width: collapsed ? '56px' : '192px',
        flex: 'none',
        background: theme === 'dark'
          ? 'linear-gradient(180deg, rgba(9, 14, 33, 0.88) 0%, rgba(5, 8, 20, 0.95) 100%)'
          : 'linear-gradient(180deg, rgba(255, 255, 255, 0.9) 0%, rgba(248, 250, 252, 0.95) 100%)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRight: `1px solid ${C.border}`,
        display: 'flex',
        flexDirection: 'column',
        position: 'sticky',
        top: 0,
        height: '100vh',
        zIndex: 20,
        transition: 'width 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
        overflow: 'visible',
      }}>
        {/* Toggle Arrow Button Mounted Directly on Sidebar Right Vertical Border Line */}
        <button
          onClick={toggle}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={{
            position: 'absolute',
            top: '20px',
            right: '-10px',
            zIndex: 50,
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            background: theme === 'dark' ? '#090e21' : '#ffffff',
            border: theme === 'dark' ? '1px solid rgba(0, 242, 254, 0.45)' : '1px solid rgba(0, 180, 216, 0.45)',
            color: theme === 'dark' ? '#00f2fe' : '#0284c7',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: theme === 'dark'
              ? '0 2px 8px rgba(0, 0, 0, 0.6), 0 0 8px rgba(0, 242, 254, 0.25)'
              : '0 2px 8px rgba(0, 0, 0, 0.12), 0 0 8px rgba(2, 132, 199, 0.18)',
            transition: 'all 0.18s ease',
            padding: 0,
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'scale(1.12)';
            e.currentTarget.style.borderColor = theme === 'dark' ? '#00f2fe' : '#0284c7';
            e.currentTarget.style.boxShadow = theme === 'dark'
              ? '0 2px 10px rgba(0, 0, 0, 0.7), 0 0 12px rgba(0, 242, 254, 0.6)'
              : '0 2px 10px rgba(0, 0, 0, 0.2), 0 0 12px rgba(2, 132, 199, 0.4)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.borderColor = theme === 'dark' ? 'rgba(0, 242, 254, 0.45)' : 'rgba(0, 180, 216, 0.45)';
            e.currentTarget.style.boxShadow = theme === 'dark'
              ? '0 2px 8px rgba(0, 0, 0, 0.6), 0 0 8px rgba(0, 242, 254, 0.25)'
              : '0 2px 8px rgba(0, 0, 0, 0.12), 0 0 8px rgba(2, 132, 199, 0.18)';
          }}
        >
          {collapsed ? (
            <IconChevronRight size={11} color={theme === 'dark' ? '#00f2fe' : '#0284c7'} strokeWidth={2.6} />
          ) : (
            <IconChevronLeft size={11} color={theme === 'dark' ? '#00f2fe' : '#0284c7'} strokeWidth={2.6} />
          )}
        </button>

        {/* Brand Header */}
        <div style={{
          padding: collapsed ? '14px 6px' : '14px 12px',
          borderBottom: `1px solid ${C.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          gap: '8px',
          minHeight: '40px',
          overflow: 'hidden',
        }}>
          <GuardianLogo
            collapsed={collapsed}
            onClick={toggle}
            style={{ cursor: 'pointer' }}
          />
        </div>

        {/* Navigation Items */}
        <nav style={{
          padding: collapsed ? '10px 4px' : '10px 6px',
          display: 'flex',
          flexDirection: 'column',
          gap: '3px',
          overflowY: 'auto',
          flex: 1,
        }}>
          {items.map(item => {
            const on = item.key === active;
            const IconComp = navIcons[item.key] || IconOverview;
            return (
              <button
                key={item.key}
                onClick={() => onNav(item.key)}
                title={collapsed ? item.label : undefined}
                style={{
                  textAlign: collapsed ? 'center' : 'left',
                  background: on
                    ? 'linear-gradient(90deg, rgba(0, 242, 254, 0.16) 0%, rgba(168, 85, 247, 0.05) 100%)'
                    : 'transparent',
                  color: on ? '#ffffff' : C.muted,
                  border: 'none',
                  borderLeft: collapsed ? 'none' : `3px solid ${on ? '#00f2fe' : 'transparent'}`,
                  borderBottom: collapsed && on ? '2px solid #00f2fe' : 'none',
                  boxShadow: on ? 'inset 0 0 16px rgba(0, 242, 254, 0.06)' : 'none',
                  height: '34px',
                  minHeight: '34px',
                  maxHeight: '34px',
                  padding: collapsed ? '0' : '0 10px',
                  boxSizing: 'border-box',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.84rem',
                  fontWeight: on ? 600 : 500,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  gap: '8px',
                  transition: 'all 0.16s ease',
                  width: '100%',
                  flex: 'none',
                }}
              >
                <span style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  filter: on ? 'drop-shadow(0 0 8px rgba(0,242,254,0.6))' : 'none',
                  flex: 'none',
                }}>
                  <IconComp size={16} color={on ? '#00f2fe' : 'currentColor'} strokeWidth={on ? 2.2 : 1.8} />
                </span>
                {!collapsed && (
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.label}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom System Status */}
        <div style={{ marginTop: 'auto', padding: collapsed ? '10px 4px' : '10px 8px', borderTop: `1px solid ${C.border}` }}>
          <div
            title="Proxy Engine Active"
            style={{
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              borderRadius: '6px',
              padding: collapsed ? '6px 0' : '6px 8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: collapsed ? 'center' : 'flex-start',
              gap: '6px',
              fontSize: '0.72rem',
              color: '#34d399',
              fontWeight: 600,
            }}
          >
            <span style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: '#10b981',
              boxShadow: '0 0 8px #10b981',
              display: 'inline-block',
              flex: 'none',
            }} />
            {!collapsed && <span style={{ whiteSpace: 'nowrap' }}>Proxy Engine Active</span>}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {/* Sticky Glassmorphic Header */}
        <header style={{
          height: '64px',
          flex: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 28px',
          borderBottom: `1px solid ${C.border}`,
          background: 'rgba(9, 14, 33, 0.75)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: theme === 'dark' ? '#00f2fe' : '#0284c7',
              filter: theme === 'dark' ? 'drop-shadow(0 0 6px rgba(0, 242, 254, 0.45))' : 'none',
              flex: 'none',
            }}>
              <PageIcon size={19} color={theme === 'dark' ? '#00f2fe' : '#0284c7'} strokeWidth={2.2} />
            </span>
            <div>
              <div style={{
                fontWeight: 700,
                fontSize: '1.10rem',
                background: theme === 'dark'
                  ? 'linear-gradient(135deg, #ffffff 40%, #cbd5e1 100%)'
                  : 'linear-gradient(135deg, #0f172a 40%, #334155 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                letterSpacing: '-0.01em',
              }}>
                {title}
              </div>
              {subtitle && <div style={{ color: C.muted, fontSize: '0.78rem', marginTop: '1px', fontWeight: 500 }}>{subtitle}</div>}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 14px',
                borderRadius: '10px',
                background: theme === 'dark' ? 'rgba(255, 255, 255, 0.06)' : 'rgba(15, 23, 42, 0.05)',
                border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(15, 23, 42, 0.12)',
                color: theme === 'dark' ? '#f8fafc' : '#0f172a',
                cursor: 'pointer',
                fontSize: '0.84rem',
                fontWeight: 600,
                transition: 'all 0.18s ease',
                backdropFilter: 'blur(12px)',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center' }}>
                {theme === 'dark' ? (
                  <IconMoon size={15} color="#94a3b8" strokeWidth={2} />
                ) : (
                  <IconSun size={15} color="#f59e0b" strokeWidth={2} />
                )}
              </span>
              <span>{theme === 'dark' ? 'Dark' : 'Light'}</span>
            </button>
            {userButton}
          </div>
        </header>

        {/* Main Content */}
        <main style={{
          flex: 1,
          padding: '28px 32px 48px',
          display: 'grid',
          gap: '22px',
          alignContent: 'start',
          width: '100%',
          boxSizing: 'border-box',
        }}>
          {children}
        </main>
      </div>
    </div>
  );
}
