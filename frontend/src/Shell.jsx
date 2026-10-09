import React, { useState } from 'react';
import { C } from './ui.jsx';

const navIcons = {
  overview: '⚡',
  activity: '📊',
  trust: '🛡️',
  users: '👥',
  test: '🧪',
};

export default function Shell({ items, active, onNav, title, subtitle, userButton, children }) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('sidebar_collapsed') === 'true';
    } catch (_) {
      return false;
    }
  });

  const toggle = () => {
    setCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('sidebar_collapsed', String(next));
      } catch (_) { }
      return next;
    });
  };

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
        width: collapsed ? '72px' : '240px',
        flex: 'none',
        background: 'linear-gradient(180deg, rgba(9, 14, 33, 0.88) 0%, rgba(5, 8, 20, 0.95) 100%)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRight: `1px solid ${C.border}`,
        display: 'flex',
        flexDirection: 'column',
        position: 'sticky',
        top: 0,
        height: '100vh',
        zIndex: 20,
        transition: 'width 0.24s cubic-bezier(0.4, 0, 0.2, 1)',
        overflow: 'hidden',
      }}>
        {/* Brand Header */}
        <div style={{
          padding: collapsed ? '20px 14px' : '20px 18px',
          borderBottom: `1px solid ${C.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          gap: '8px',
          minHeight: '44px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #00f2fe, #a855f7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.25rem',
                boxShadow: '0 0 16px rgba(0, 242, 254, 0.4)',
                flex: 'none',
                cursor: 'pointer',
              }}
              onClick={toggle}
              title={collapsed ? 'Click to expand sidebar' : 'PII Guardrail'}
            >
              🛡️
            </div>
            {!collapsed && (
              <div style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>
                <div style={{
                  fontWeight: 800,
                  fontSize: '1.02rem',
                  background: 'linear-gradient(135deg, #ffffff 20%, #00f2fe 65%, #a855f7 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  letterSpacing: '0.02em',
                }}>
                  Adrishya
                </div>
                <div style={{ color: C.muted, fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '2px' }}>
                  Invisible Privacy Layer
                </div>
              </div>
            )}
          </div>

          {!collapsed && (
            <button
              onClick={toggle}
              title="Collapse sidebar"
              style={{
                background: 'rgba(0, 242, 254, 0.08)',
                border: '1px solid rgba(0, 242, 254, 0.25)',
                color: '#00f2fe',
                borderRadius: '8px',
                width: '28px',
                height: '28px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.8rem',
                flex: 'none',
                transition: 'all 0.15s ease',
              }}
            >
              ❮
            </button>
          )}
        </div>

        {/* Navigation Items */}
        <nav style={{ padding: collapsed ? '16px 8px' : '16px 12px', display: 'grid', gap: '6px' }}>
          {items.map(item => {
            const on = item.key === active;
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
                  padding: collapsed ? '12px 0' : '10px 14px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '0.92rem',
                  fontWeight: on ? 700 : 500,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  gap: '10px',
                  transition: 'all 0.18s ease',
                  width: '100%',
                }}
              >
                <span style={{ fontSize: '1.2rem', filter: on ? 'drop-shadow(0 0 8px rgba(0,242,254,0.6))' : 'none', flex: 'none' }}>
                  {navIcons[item.key] || '•'}
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

        {/* Collapsed expand button at bottom of nav */}
        {collapsed && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0' }}>
            <button
              onClick={toggle}
              title="Expand sidebar"
              style={{
                background: 'rgba(0, 242, 254, 0.08)',
                border: '1px solid rgba(0, 242, 254, 0.25)',
                color: '#00f2fe',
                borderRadius: '8px',
                width: '34px',
                height: '34px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.85rem',
                transition: 'all 0.15s ease',
              }}
            >
              ❯
            </button>
          </div>
        )}

        {/* Bottom System Status */}
        <div style={{ marginTop: 'auto', padding: collapsed ? '14px 8px' : '16px 18px', borderTop: `1px solid ${C.border}` }}>
          <div
            title="Proxy Engine Active"
            style={{
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              borderRadius: '8px',
              padding: collapsed ? '8px 0' : '8px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: collapsed ? 'center' : 'flex-start',
              gap: '8px',
              fontSize: '0.78rem',
              color: '#34d399',
              fontWeight: 600,
            }}
          >
            <span style={{
              width: '7px',
              height: '7px',
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
          height: '68px',
          flex: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 32px',
          borderBottom: `1px solid ${C.border}`,
          background: 'rgba(9, 14, 33, 0.75)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <button
              onClick={toggle}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: `1px solid ${C.border}`,
                color: C.muted,
                borderRadius: '8px',
                width: '32px',
                height: '32px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.9rem',
                transition: 'all 0.15s ease',
              }}
            >
              ☰
            </button>
            <div>
              <div style={{
                fontWeight: 800,
                fontSize: '1.18rem',
                background: 'linear-gradient(135deg, #ffffff 40%, #cbd5e1 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                letterSpacing: '-0.01em',
              }}>
                {title}
              </div>
              {subtitle && <div style={{ color: C.muted, fontSize: '0.82rem', marginTop: '2px', fontWeight: 500 }}>{subtitle}</div>}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
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
          maxWidth: '1440px',
          width: '100%',
          boxSizing: 'border-box',
        }}>
          {children}
        </main>
      </div>
    </div>
  );
}
