import React, { useEffect, useState, useRef } from 'react';

export const C = {
  bg: '#050814',
  side: '#090e21',
  surface: 'rgba(15, 23, 42, 0.65)',
  border: 'rgba(56, 189, 248, 0.12)',
  borderHighlight: 'rgba(255, 255, 255, 0.08)',
  text: '#f8fafc',
  muted: '#94a3b8',
  faint: '#64748b',
  accent: '#00f2fe',
  accentPurple: '#a855f7',
  allow: '#10b981',
  redact: '#f59e0b',
  block: '#f43f5e',
};

export const mono = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace";

export function Card({ title, action, children, style }) {
  return (
    <section style={{
      background: 'linear-gradient(135deg, rgba(16, 24, 46, 0.75) 0%, rgba(8, 13, 26, 0.65) 100%)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      border: `1px solid ${C.border}`,
      borderRadius: '14px',
      padding: '22px 24px',
      minWidth: 0,
      boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.42), inset 0 1px 0 rgba(255, 255, 255, 0.06)',
      transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
      ...style
    }}>
      {(title || action) && (
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '12px' }}>
          <h2 style={{
            margin: 0,
            fontSize: '1rem',
            fontWeight: 700,
            background: 'linear-gradient(135deg, #ffffff 40%, #94a3b8 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '0.01em',
          }}>
            {title}
          </h2>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function Kpi({ label, value, hint }) {
  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(16, 24, 48, 0.8) 0%, rgba(10, 16, 30, 0.7) 100%)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      border: `1px solid ${C.border}`,
      borderRadius: '14px',
      padding: '18px 20px',
      position: 'relative',
      overflow: 'hidden',
      boxShadow: '0 8px 24px 0 rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
    }}>
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '2.5px',
        background: 'linear-gradient(90deg, #00f2fe 0%, #a855f7 100%)',
        boxShadow: '0 0 12px rgba(0, 242, 254, 0.6)',
      }} />
      <div style={{ color: C.muted, fontSize: '0.78rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
        {label}
      </div>
      <div style={{
        fontSize: '1.9rem',
        fontWeight: 800,
        fontFamily: "'Outfit', sans-serif",
        color: '#ffffff',
        fontVariantNumeric: 'tabular-nums',
        letterSpacing: '-0.02em',
      }}>
        {value}
      </div>
      {hint && (
        <div style={{ color: C.faint, fontSize: '0.8rem', marginTop: '6px', fontWeight: 500 }}>
          {hint}
        </div>
      )}
    </div>
  );
}

export function DecisionChip({ decision }) {
  const dLower = (decision || '').toLowerCase();
  const cfg = {
    allow: { bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.4)', text: '#34d399', glow: 'rgba(16, 185, 129, 0.3)' },
    redact: { bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.4)', text: '#fbbf24', glow: 'rgba(245, 158, 11, 0.3)' },
    hash: { bg: 'rgba(168, 85, 247, 0.12)', border: 'rgba(168, 85, 247, 0.4)', text: '#c084fc', glow: 'rgba(168, 85, 247, 0.3)' },
    block: { bg: 'rgba(244, 63, 94, 0.14)', border: 'rgba(244, 63, 94, 0.45)', text: '#fb7185', glow: 'rgba(244, 63, 94, 0.35)' },
    deny: { bg: 'rgba(244, 63, 94, 0.14)', border: 'rgba(244, 63, 94, 0.45)', text: '#fb7185', glow: 'rgba(244, 63, 94, 0.35)' },
  }[dLower] || { bg: 'rgba(148, 163, 184, 0.1)', border: 'rgba(148, 163, 184, 0.3)', text: '#94a3b8', glow: 'transparent' };

  return (
    <span style={{
      background: cfg.bg,
      color: cfg.text,
      border: `1px solid ${cfg.border}`,
      boxShadow: `0 0 10px ${cfg.glow}`,
      padding: '3px 10px',
      borderRadius: '999px',
      fontSize: '0.76rem',
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
    }}>
      <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: cfg.text }} />
      {decision}
    </span>
  );
}

export function Empty({ children }) {
  return (
    <div style={{ color: C.faint, padding: '36px 20px', textAlign: 'center', fontSize: '0.92rem', background: 'rgba(6, 10, 24, 0.4)', borderRadius: '10px', border: `1px dashed ${C.border}` }}>
      {children}
    </div>
  );
}

export function Loader({ text = 'Loading data…' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '36px', color: C.accent, fontSize: '0.92rem', fontWeight: 600 }}>
      <div style={{
        width: '18px',
        height: '18px',
        border: '2px solid rgba(0, 242, 254, 0.2)',
        borderTop: '2px solid #00f2fe',
        borderRadius: '50%',
        animation: 'ui-spin 0.75s linear infinite',
        boxShadow: '0 0 12px rgba(0, 242, 254, 0.4)',
      }} />
      <span>{text}</span>
      <style>{`@keyframes ui-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export function Loader3D({
  title = 'GuardIAn',
  subtitle = 'Autonomous AI Privacy Guardian',
  isReady = true,
  onFinish = null
}) {
  const [progress, setProgress] = useState(0);
  const [gifSrc] = useState(() => `/assets/guardian_robot.gif?t=${Date.now()}`);
  const hasFinishedRef = useRef(false);

  useEffect(() => {
    const originalBodyBg = document.body.style.backgroundColor;
    const originalHtmlBg = document.documentElement.style.backgroundColor;
    document.body.style.backgroundColor = '#000000';
    document.documentElement.style.backgroundColor = '#000000';

    const duration = 5200; // 5.2s for 1 complete GIF cycle (155 frames @ ~33ms = 5160ms)
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min(100, (elapsed / duration) * 100);
      setProgress(pct);
      if (pct >= 100) {
        clearInterval(interval);
      }
    }, 50);

    return () => {
      clearInterval(interval);
      document.body.style.backgroundColor = originalBodyBg;
      document.documentElement.style.backgroundColor = originalHtmlBg;
    };
  }, []);

  useEffect(() => {
    if (progress >= 100 && isReady && !hasFinishedRef.current) {
      hasFinishedRef.current = true;
      if (onFinish) {
        const timer = setTimeout(onFinish, 120);
        return () => clearTimeout(timer);
      }
    }
  }, [progress, isReady, onFinish]);

  let statusLabel = 'INITIALIZING NEURAL ENGINE…';
  if (progress >= 30 && progress < 70) {
    statusLabel = 'PATROLLING DATA PERIMETER…';
  } else if (progress >= 70 && progress < 100) {
    statusLabel = 'ARMING REAL-TIME LLM GUARDRAILS…';
  } else if (progress >= 100 && !isReady) {
    statusLabel = 'PERIMETER SECURE · PREPARING DASHBOARD…';
  } else if (progress >= 100) {
    statusLabel = 'PERIMETER SECURE · ACCESS GRANTED';
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      width: '100%',
      background: '#000000',
      color: '#f8fafc',
      textAlign: 'center',
      padding: '24px',
      fontFamily: "'Outfit', system-ui, sans-serif",
      position: 'relative',
      overflow: 'hidden',
      boxSizing: 'border-box',
    }}>
      {/* Header Title with AI Highlight */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #00f2fe, #a855f7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 25px rgba(0, 242, 254, 0.6)',
          }}>
            <IconShield size={24} color="#ffffff" strokeWidth={2.4} />
          </div>
          <div style={{
            fontSize: '3rem',
            fontWeight: 900,
            letterSpacing: '0.04em',
            lineHeight: 1.1,
          }}>
            <span style={{ color: '#ffffff' }}>Guard</span>
            <span style={{
              color: '#00f2fe',
              textShadow: '0 0 28px rgba(0, 242, 254, 0.9), 0 0 12px rgba(0, 242, 254, 0.6)',
            }}>IA</span>
            <span style={{ color: '#ffffff' }}>n</span>
          </div>
        </div>
        <div style={{
          fontSize: '0.85rem',
          fontWeight: 600,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: '#94a3b8',
        }}>
          {subtitle}
        </div>
      </div>

      {/* 3D Robot Walking Stage - Seamless black integration */}
      <div style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#000000',
        margin: '10px 0 16px 0',
      }}>
        <img
          src={gifSrc}
          alt="GuardIAn Robot"
          onError={(e) => { e.currentTarget.src = 'https://upload.wikimedia.org/wikipedia/commons/7/7b/Avatar_3D.gif'; }}
          style={{
            maxWidth: '380px',
            maxHeight: '290px',
            width: 'auto',
            height: 'auto',
            display: 'block',
            background: '#000000',
          }}
        />

        {/* Ambient floor reflection / ground glow */}
        <div style={{
          width: '240px',
          height: '14px',
          borderRadius: '50%',
          background: 'radial-gradient(ellipse at center, rgba(0, 242, 254, 0.28) 0%, rgba(0, 0, 0, 0) 70%)',
          marginTop: '-6px',
          filter: 'blur(3px)',
        }} />
      </div>

      {/* Progress Bar & Status Tracker */}
      <div style={{ width: '340px', maxWidth: '88vw', margin: '16px 0 0 0' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '0.78rem',
          fontWeight: 700,
          color: '#94a3b8',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          marginBottom: '8px',
        }}>
          <span>{statusLabel}</span>
          <span style={{ color: '#00f2fe', fontFamily: 'monospace' }}>{Math.round(progress)}%</span>
        </div>
        <div style={{
          width: '100%',
          height: '6px',
          borderRadius: '3px',
          background: '#1a1f2c',
          overflow: 'hidden',
        }}>
          <div style={{
            width: `${progress}%`,
            height: '100%',
            background: 'linear-gradient(90deg, #00f2fe, #a855f7)',
            borderRadius: '3px',
            boxShadow: '0 0 12px rgba(0, 242, 254, 0.8)',
            transition: 'width 0.05s linear',
          }} />
        </div>
      </div>
    </div>
  );
}

export function ScrollBox({ children, maxHeight = 480 }) {
  return <div style={{ maxHeight, overflow: 'auto' }}>{children}</div>;
}

export function LimitSelect({ value, onChange, options = [10, 20, 30, 50, 100] }) {
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: C.muted, fontSize: '0.85rem' }}>
      Show
      <select
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{
          background: 'rgba(6, 10, 24, 0.8)',
          color: C.text,
          border: `1px solid ${C.border}`,
          borderRadius: '8px',
          padding: '5px 10px',
          outline: 'none',
          cursor: 'pointer',
          fontSize: '0.84rem',
        }}
      >
        {options.map(n => <option key={n} value={n}>{n}</option>)}
      </select>
    </label>
  );
}

const th = {
  textAlign: 'left',
  padding: '11px 12px',
  color: C.muted,
  fontSize: '0.78rem',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  position: 'sticky',
  top: 0,
  background: 'rgba(10, 16, 32, 0.95)',
  borderBottom: `1px solid ${C.border}`,
};
const td = {
  padding: '12px',
  fontSize: '0.88rem',
  borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
  verticalAlign: 'top',
};

function Preview({ text }) {
  return (
    <span style={{
      display: 'inline-block',
      maxWidth: '420px',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      verticalAlign: 'middle',
      fontFamily: mono,
      color: '#cbd5e1',
      fontSize: '0.85rem',
      background: 'rgba(0,0,0,0.2)',
      padding: '2px 6px',
      borderRadius: '4px',
    }}>
      {text || '—'}
    </span>
  );
}

export function RequestTable({ rows, onOpen, onOpenSession, showUser = false, empty = 'No requests yet.' }) {
  if (!rows || rows.length === 0) return <Empty>{empty}</Empty>;
  const KIND_LABEL = { prompt: 'Prompt', completion: 'Agent response', tool_call: 'Tool call', tool_result: 'Tool result', final_output: 'Session summary' };
  const KIND_COLOR = { prompt: '#38bdf8', completion: '#a78bfa', tool_call: '#f59e0b', tool_result: '#34d399', final_output: '#94a3b8' };
  const hasKinds = rows.some(r => r.kind && r.kind !== 'prompt');
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th style={th}>Time</th>
          {showUser && <th style={th}>User</th>}
          {onOpenSession && <th style={th}>Session</th>}
          <th style={th}>Decision</th>
          <th style={th}>Categories</th>
          <th style={th}>Content</th>
          <th style={{ ...th, textAlign: 'right' }}>Tokens (In / Out)</th>
          <th style={{ ...th, textAlign: 'right' }}>Latency</th>
          {hasKinds && <th style={th}>Type</th>}
        </tr>
      </thead>
      <tbody>
        {rows.map(r => {
          const id = r.event_id || r.id;
          return (
            <tr
              key={id}
              onClick={() => onOpen(id)}
              style={{ cursor: 'pointer', transition: 'background 0.15s ease' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0, 242, 254, 0.05)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <td style={{ ...td, whiteSpace: 'nowrap', color: C.muted, fontSize: '0.82rem' }}>{r.created_at ? new Date(r.created_at).toLocaleString() : '—'}</td>
              {showUser && <td style={td}>{r.user_email || '—'}</td>}
              {onOpenSession && (
                <td style={td}>
                  <button
                    onClick={(e) => { e.stopPropagation(); onOpenSession(r.session_id, r.session_external_id); }}
                    style={{
                      background: 'rgba(0, 242, 254, 0.08)',
                      border: '1px solid rgba(0, 242, 254, 0.3)',
                      color: C.accent,
                      borderRadius: '6px',
                      padding: '3px 8px',
                      cursor: 'pointer',
                      fontFamily: mono,
                      fontSize: '0.78rem',
                      fontWeight: 600,
                    }}
                  >
                    {r.session_external_id || (r.session_id || '').slice(0, 8)}
                  </button>
                </td>
              )}
              <td style={td}><DecisionChip decision={r.decision || (r.action_mode === 'HASH' && r.decision !== 'allow' ? 'hash' : r.decision)} /></td>
              <td style={{ ...td, color: '#e2e8f0', fontWeight: 500 }}>{(r.categories_found || []).join(', ') || '—'}</td>
              <td style={td}><Preview text={r.original_prompt || r.original_text} /></td>
              <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                {r.prompt_tokens != null || r.completion_tokens != null ? (
                  <div>
                    <div style={{ color: '#00f2fe', fontWeight: 600 }}>
                      {((r.prompt_tokens || 0) + (r.completion_tokens || 0)).toLocaleString()}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: C.faint, whiteSpace: 'nowrap' }}>
                      ↓{(r.prompt_tokens || 0).toLocaleString()} in · ↑{(r.completion_tokens || 0).toLocaleString()} out
                    </div>
                  </div>
                ) : '—'}
              </td>
              <td style={{ ...td, textAlign: 'right', color: '#38bdf8', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{r.latency_ms != null ? `${Math.round(r.latency_ms)} ms` : '—'}</td>
              {hasKinds && (
                <td style={td}>
                  <span style={{ color: KIND_COLOR[r.kind] || C.muted, fontSize: '0.78rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {r.label || KIND_LABEL[r.kind] || r.kind || '—'}
                    {!r.label && r.tool_name ? ` · ${r.tool_name}` : ''}
                  </span>
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function RequestDetail({ eventId, authedFetch, onBack }) {
  const [e, setE] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    authedFetch(`/api/events/${eventId}`)
      .then(async r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        if (!cancelled) setE(data);
      })
      .catch(err => !cancelled && setError(`Could not load this request (${err.message})`));
    return () => { cancelled = true; };
  }, [eventId, authedFetch]);

  if (error) return <Empty>{error}</Empty>;
  if (!e) return <Empty>Loading…</Empty>;

  const box = {
    background: 'rgba(6, 10, 24, 0.8)',
    border: `1px solid ${C.border}`,
    borderRadius: '10px',
    padding: '16px',
    minHeight: '96px',
    whiteSpace: 'pre-wrap',
    fontFamily: mono,
    fontSize: '0.88rem',
    lineHeight: 1.6,
    color: '#cbd5e1',
    boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.4)',
  };
  const label = { color: C.muted, fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' };
  const kv = { display: 'grid', gridTemplateColumns: '140px 1fr', rowGap: '10px', fontSize: '0.88rem' };

  return (
    <div>
      {onBack && (
        <button
          onClick={onBack}
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: `1px solid ${C.border}`,
            color: C.accent,
            padding: '7px 14px',
            borderRadius: '8px',
            cursor: 'pointer',
            marginBottom: '18px',
            fontWeight: 600,
            fontSize: '0.86rem',
          }}
        >
          ← Back to activity
        </button>
      )}
      <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '14px' }}>
        <DecisionChip decision={e.decision || (e.action_mode === 'HASH' && e.decision !== 'allow' ? 'hash' : e.decision)} />
        <span style={{ color: C.muted, fontSize: '0.88rem' }}>{e.created_at ? new Date(e.created_at).toLocaleString() : ''}</span>
        {e.label && <span style={{ fontSize: '0.8rem', fontWeight: 600, padding: '3px 10px', borderRadius: '6px', border: `1px solid ${C.border}`, color: '#e2e8f0' }}>{e.label}</span>}
        {e.agent_name && <span style={{ fontSize: '0.8rem', fontFamily: mono, padding: '3px 10px', borderRadius: '6px', border: `1px solid ${C.border}`, color: C.accent }}>agent: {e.agent_name}</span>}
        {e.tool_name && <span style={{ fontSize: '0.8rem', fontFamily: mono, padding: '3px 10px', borderRadius: '6px', border: `1px solid ${C.border}`, color: '#f59e0b' }}>tool: {e.tool_name}</span>}
      </div>
      {e.reason && (
        <div style={{
          color: '#f8fafc',
          background: 'rgba(56, 189, 248, 0.08)',
          borderLeft: '3px solid #00f2fe',
          padding: '10px 14px',
          borderRadius: '6px',
          marginBottom: '22px',
          fontSize: '0.94rem',
        }}>
          {e.reason}
        </div>
      )}

      {/* 4 Pipeline Boxes: Prompt Ingress -> Processed to LLM -> Raw LLM Output -> Filtered & Delivered to User */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        <div>
          <div style={{ ...label, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: '#38bdf8', fontWeight: 800 }}>1.</span> USER PROMPT (INGRESS)
          </div>
          <div style={box}>{e.original_text || <span style={{ color: C.faint }}>not stored</span>}</div>
        </div>

        <div>
          <div style={{ ...label, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: '#00f2fe', fontWeight: 800 }}>2.</span> PROCESSED PAYLOAD (SENT TO LLM)
          </div>
          <div style={{
            ...box,
            color: C.allow,
            borderColor: e.decision === 'block' && (!e.egress_pii_count) ? 'rgba(244, 63, 94, 0.4)' : 'rgba(16, 185, 129, 0.4)'
          }}>
            {e.decision === 'block' && (!e.egress_pii_count)
              ? <span style={{ color: C.block, fontWeight: 700 }}>🚫 BLOCKED. Policy violation intercepted before reaching external nodes.</span>
              : (e.anonymized_text || e.original_text || <span style={{ color: C.faint }}>no change</span>)}
          </div>
        </div>

        <div>
          <div style={{ ...label, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: '#a855f7', fontWeight: 800 }}>3.</span> RAW LLM OUTPUT (RECEIVED FROM MODEL)
          </div>
          <div style={{ ...box, color: '#f8fafc' }}>
            {e.original_response ? (
              e.original_response
            ) : (
              <span style={{ color: C.faint }}>
                {e.decision === 'block' && (!e.egress_pii_count)
                  ? 'Request blocked on ingress — never reached upstream model.'
                  : (e.completion_tokens ? `Completion recorded (${e.completion_tokens} tokens), raw text not captured.` : 'No output captured.')}
              </span>
            )}
          </div>
        </div>

        <div>
          <div style={{ ...label, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: '#10b981', fontWeight: 800 }}>4.</span> DELIVERED RESPONSE (FILTERED & SENT TO USER)
          </div>
          <div style={{
            ...box,
            color: C.allow,
            borderColor: (e.action_mode === 'BLOCK' || e.decision === 'block') && e.egress_pii_count ? 'rgba(244, 63, 94, 0.4)' : 'rgba(16, 185, 129, 0.4)'
          }}>
            {(e.action_mode === 'BLOCK' || e.decision === 'block') && e.egress_pii_count
              ? <span style={{ color: C.block, fontWeight: 700 }}>🚫 BLOCKED. Model output policy violation intercepted from reaching user (output tokens tracked, user score unaffected).</span>
              : (e.anonymized_response || e.original_response || (
                  <span style={{ color: C.faint }}>
                    {e.decision === 'block' && (!e.egress_pii_count)
                      ? 'Request was blocked on ingress.'
                      : (e.completion_tokens ? 'Delivered as-is to user.' : 'No response delivered.')}
                  </span>
                ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
        <div>
          <div style={label}>Identified Sensitive PII Findings</div>
          {e.findings.length === 0 ? <Empty>No PII detected.</Empty> : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={th}>Entity Type</th><th style={th}>Category</th><th style={th}>Direction</th><th style={th}>Compliance Action</th></tr></thead>
              <tbody>
                {e.findings.map((f, i) => (
                  <tr key={i}>
                    <td style={{ ...td, fontWeight: 600, color: '#f8fafc' }}>{f.entity_type}</td>
                    <td style={td}>{f.category}</td>
                    <td style={td}>
                      <span style={{
                        fontSize: '0.72rem',
                        padding: '2px 7px',
                        borderRadius: '4px',
                        fontWeight: 600,
                        background: f.direction === 'egress' ? 'rgba(168, 85, 247, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                        color: f.direction === 'egress' ? '#c084fc' : '#38bdf8',
                        border: `1px solid ${f.direction === 'egress' ? 'rgba(168, 85, 247, 0.3)' : 'rgba(56, 189, 248, 0.3)'}`,
                      }}>
                        {f.direction === 'egress' ? '↑ Egress (Model)' : '↓ Ingress (Prompt)'}
                      </span>
                    </td>
                    <td style={{ ...td, fontFamily: mono, color: C.accent, fontWeight: 600 }}>{f.placeholder || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div>
          <div style={label}>Telemetry & Cryptographic Routing</div>
          <div style={kv}>
            <span style={{ color: C.muted }}>Session UUID</span><span style={{ fontFamily: mono, color: C.accent }}>{e.session_external_id || '—'}</span>
            <span style={{ color: C.muted }}>Agent ID</span><span>{e.agent_name || 'default'}</span>
            <span style={{ color: C.muted }}>Target Model</span><span style={{ fontFamily: mono }}>{e.model || '—'}</span>
            <span style={{ color: C.muted }}>Action Mode</span><span style={{ fontWeight: 700, color: '#ffffff' }}>{e.action_mode || '—'}</span>
            <span style={{ color: C.muted }}>Input Tokens (Prompt)</span><span style={{ fontFamily: mono, color: '#38bdf8' }}>{e.prompt_tokens != null ? e.prompt_tokens.toLocaleString() : '—'}</span>
            <span style={{ color: C.muted }}>Output Tokens (Completion)</span><span style={{ fontFamily: mono, color: '#c084fc' }}>{e.completion_tokens != null ? e.completion_tokens.toLocaleString() : '—'}{e.tokens_estimated ? ' (estimated)' : ''}</span>
            <span style={{ color: C.muted }}>Total Tokens</span><span style={{ fontFamily: mono, fontWeight: 700, color: '#00f2fe' }}>{(e.prompt_tokens != null || e.completion_tokens != null) ? ((e.prompt_tokens || 0) + (e.completion_tokens || 0)).toLocaleString() : '—'}</span>
            <span style={{ color: C.muted }}>Gateway Latency</span><span style={{ color: '#38bdf8', fontWeight: 600 }}>{e.latency_ms} ms</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export const COMPLIANCE_FRAMEWORKS_DATA = {
  hipaa: {
    key: 'hipaa',
    title: 'HIPAA Compliance (US PHI)',
    badge: '18 Safe Harbor Identifiers (§ 164.514)',
    law: 'Health Insurance Portability and Accountability Act (US HHS)',
    icon: '🏥',
    color: '#00f2fe',
    description: 'Enforces strict Safe Harbor de-identification rules across 18 Protected Health Information (PHI) categories. Intercepts EHR identifiers, medical codes, patient numbers, clinical dates, and personal coordinates.',
    identifiers: [
      { id: 1, name: "Names (Patient, Relatives, Employers)", cat: "Names", example: "Dr. Robert Chen, Jane Doe", method: "Contextual Heuristics + Presidio NLP", desc: "Names of patients, relatives, household members, and clinical employers." },
      { id: 2, name: "Geographic Subdivisions", cat: "Geographical", example: "742 Evergreen Terr, Springfield, 62704", method: "Street Grammar + US ZIP Parser", desc: "All subdivisions smaller than a state (street address, city, county, precinct, ZIP code)." },
      { id: 3, name: "Clinical & Personal Dates", cat: "Dates", example: "DOB: 08/23/1984, Admitted: 10/02/2026", method: "Clinical Event & Slash Date Regex", desc: "All dates directly related to an individual (birth, admission, discharge, death, exact ages > 89)." },
      { id: 4, name: "Telephone Numbers", cat: "Telephony", example: "+1 (555) 234-5678, 202-555-0199", method: "NANP & E.164 Phone Parser", desc: "Patient, physician, and emergency contact phone and cellular numbers." },
      { id: 5, name: "Fax Numbers", cat: "Telephony", example: "Fax: +1-212-555-0143", method: "Keyword-Anchored Fax Regex", desc: "Medical clinic, pharmacy, and hospital facsimile communication lines." },
      { id: 6, name: "Email Addresses", cat: "Digital", example: "jane.doe@hospital.org", method: "RFC 5322 Standard Matcher", desc: "Electronic mail contact addresses of individuals." },
      { id: 7, name: "Social Security Numbers (SSN)", cat: "National ID", example: "123-45-6789", method: "9-Digit Structured Grammar", desc: "United States Social Security Numbers across standard 3-2-4 hyphenated formats." },
      { id: 8, name: "Medical Record Numbers (MRN)", cat: "Medical / EHR", example: "MRN-4820194, Med Rec #992144", method: "Healthcare Anchor & Prefix Matcher", desc: "Hospital, clinical chart, and Electronic Health Record (EHR) unique identification codes." },
      { id: 9, name: "Health Plan Beneficiary Numbers", cat: "Insurance", example: "HICN-9948201, Policy #POL-88321", method: "Policy & Member ID Grammar", desc: "Health insurance policy numbers, Medicare HICN, Medicaid IDs, and subscriber numbers." },
      { id: 10, name: "Account Numbers (Bank & Billing)", cat: "Financial", example: "Acct #440291049281, IBAN US99...", method: "Keyword-Bounded Account Matcher", desc: "Patient hospital billing accounts, credit balances, and bank account numbers." },
      { id: 11, name: "Certificate & License Numbers", cat: "Licenses", example: "DL #D98472019, Med Lic #MD-4819", method: "State & Medical Board Regex", desc: "Physician state license numbers, patient driver's licenses, and professional credentials." },
      { id: 12, name: "Vehicle Identifiers (VIN & Plates)", cat: "Vehicles", example: "1HGCR2F83HA123456, Plate #7XYZ89", method: "ISO 3779 VIN + Plate Grammar", desc: "Vehicle Identification Numbers (VIN) and vehicle license plate serials." },
      { id: 13, name: "Device Identifiers & Serial Numbers", cat: "Hardware", example: "IMEI: 352099001761481, Serial #SN-882", method: "Hardware & Pacemaker Serial Matcher", desc: "Implanted medical device serials, telemetry monitors, and hardware IMEIs." },
      { id: 14, name: "Web Universal Resource Locators (URLs)", cat: "Digital", example: "https://portal.clinic.org/patient/992", method: "URI Scheme & FQDN Parser", desc: "Patient portal URLs, personal website links, and medical record hyperlinks." },
      { id: 15, name: "Internet Protocol (IP) Addresses", cat: "Network", example: "192.168.1.105, 2001:db8::1", method: "Validated Octet IPv4 / IPv6 Parser", desc: "Inbound client IP addresses, telemedicine endpoints, and network host addresses." },
      { id: 16, name: "Biometric Identifiers", cat: "Biometric", example: "Fingerprint ID: FP-8812, Retinal Scan", method: "Clinical Biometric Matcher", desc: "Fingerprints, voiceprints, retinal scans, and biometric telemetry data." },
      { id: 17, name: "Full Face Photos & Medical Images", cat: "Imaging", example: "DICOM (.dcm), Patient Photo attachment", method: "Multimodal Tag & Image Meta Parser", desc: "Full-face photographic images and any comparable clinical imagery identifying the individual." },
      { id: 18, name: "Any Unique Patient Identifier", cat: "Unique Codes", example: "Patient ID: PID-992019", method: "Patient Specific Prefix Matcher", desc: "Any unique identifying number, characteristic, or code not otherwise specified." }
    ]
  },
  dpdp: {
    key: 'dpdp',
    title: 'DPDP Compliance (India 2023)',
    badge: '27 Personal Identifiers',
    law: 'Digital Personal Data Protection Act 2023 (Ministry of Electronics & IT, India)',
    icon: '🇮🇳',
    color: '#f59e0b',
    description: 'Enforces comprehensive digital personal data protection across 27 Indian citizen identifiers. Guards national IDs (Aadhaar, PAN, Voter ID, Passport), financial rails (UPI handles, IFSC, Bank Accounts), compensation (CTC, Salary), and telemetry.',
    identifiers: [
      { id: 1, name: "Aadhaar Number (UIDAI)", cat: "National ID", example: "4532 8901 2345", method: "Verhoeff Checksum + 12-Digit UID", desc: "12-digit Indian national identity number issued by UIDAI with Verhoeff algorithmic validation." },
      { id: 2, name: "Permanent Account Number (PAN)", cat: "Tax & Financial", example: "ABCDE1234F", method: "ITD 10-Char Grammar (5L-4N-1L)", desc: "10-digit alphanumeric identifier issued by the Indian Income Tax Department with entity type encoding." },
      { id: 3, name: "UPI Handles & VPAs", cat: "Payments", example: "rajesh.kumar@okhdfcbank, user@paytm", method: "VPA Bank Extension Registry", desc: "Unified Payments Interface Virtual Payment Addresses mapped to NPCI bank provider handles." },
      { id: 4, name: "Indian Mobile Numbers", cat: "Telephony", example: "+91 9876543210, 9820112345", method: "TRAI +91 & [6-9] 10-Digit Grammar", desc: "10-digit Indian cellular telephone series starting with authorized TRAI prefixes (6, 7, 8, 9)." },
      { id: 5, name: "Indian PIN Code", cat: "Geographical", example: "PIN: 400001, 560038, 110001", method: "Postal Anchor + 6-Digit Non-Zero Regex", desc: "6-digit Postal Index Numbers designating sorting and delivery postal districts across India." },
      { id: 6, name: "Indian Passport Number", cat: "Travel ID", example: "Passport No: Z1234567, A9876543", method: "MEA 1-Letter + 7-Digit Grammar", desc: "Indian Ministry of External Affairs travel document passport numbers." },
      { id: 7, name: "Voter ID (EPIC Card)", cat: "Electoral ID", example: "EPIC: ABC1234567", method: "ECI 3-Letter + 7-Digit Parser", desc: "Elector's Photo Identity Card number issued by the Election Commission of India." },
      { id: 8, name: "Indian Driving Licence (DL)", cat: "Transport ID", example: "MH12-20180012345, DL0420210001234", method: "Parivahan Sarathi State+RTO Syntax", desc: "Indian Motor Vehicles driving licence with 2-letter state code, 2-digit RTO, and license number." },
      { id: 9, name: "IFSC Bank Branch Code", cat: "Banking", example: "HDFC0001234, SBIN0004567", method: "RBI 11-Char Format (4L-0-6AN)", desc: "Reserve Bank of India 11-character code identifying electronic funds transfer bank branches." },
      { id: 10, name: "Employee ID / Staff Number", cat: "Corporate", example: "Emp ID: EMP-99214, Staff #8821", method: "Corporate Workplace Context Regex", desc: "Workplace identification, staff personnel numbers, and corporate badge credentials." },
      { id: 11, name: "Salary & Compensation History", cat: "Financial", example: "Salary: ₹18.5 LPA, CTC: 1,50,000 pm", method: "Currency (₹/Rs/INR) + CTC Heuristic", desc: "Compensation packages, annual CTC (LPA), monthly salary, stipends, and bonus figures." },
      { id: 12, name: "Student ID & Roll Numbers", cat: "Academic", example: "Roll No: 20BCS1042, Reg #992144", method: "Academic Institution Anchor Regex", desc: "University enrollment numbers, student registration codes, and school roll numbers." },
      { id: 13, name: "Personal & Full Names", cat: "Identity", example: "Shri Rajesh Kumar, Anita Sharma", method: "Honorifics (Shri/Smt/Dr) + NER", desc: "Full citizen names, patronymics, and honorific-prefixed identity records." },
      { id: 14, name: "Residential & Street Addresses", cat: "Geographical", example: "Flat 402, Shanti Towers, MG Road", method: "Premise & Locality Boundary Parser", desc: "Residential premises, apartment numbers, street names, and postal delivery locations." },
      { id: 15, name: "City, District & Locality", cat: "Geographical", example: "City: Pune, District: Ernakulam", method: "Geopolitical Location Classifier", desc: "Indian administrative districts, metropolitan areas, talukas, and municipal towns." },
      { id: 16, name: "Personal Email Addresses", cat: "Digital", example: "rajesh.kumar@gmail.com", method: "RFC 5322 Standard Grammar", desc: "Personal, business, and enterprise electronic mail accounts." },
      { id: 17, name: "Landline & STD Telephone", cat: "Telephony", example: "Tel: 020-25678901, 011-23456789", method: "STD Area Code + Landline Parser", desc: "Indian fixed-line telecommunication numbers with regional STD codes." },
      { id: 18, name: "Bank Account Numbers", cat: "Banking", example: "Acct #987654321012, 11-16 digits", method: "Banking Anchor + Digit Sequence", desc: "Indian commercial bank savings, current, and overdraft account numbers." },
      { id: 19, name: "Credit & Debit Card Numbers", cat: "Payments", example: "RuPay 6071 ..., Visa, Mastercard", method: "Luhn Mod-10 + Card BIN Matcher", desc: "Payment card PAN numbers across RuPay, Visa, Mastercard, and Amex networks." },
      { id: 20, name: "Age & Demographic Pairings", cat: "Demographics", example: "Age: 32 years, Male, aged 28", method: "Demographic Pairing Heuristics", desc: "Age records linked to identifiable gender or personal characteristics." },
      { id: 21, name: "Date of Birth (DOB)", cat: "Dates", example: "DOB: 15/08/1992, Born: 1985-04-12", method: "ISO/Indian Slash Date Regex", desc: "Calendar birth dates identifying the individual." },
      { id: 22, name: "Precise GPS Coordinates", cat: "Location", example: "GPS: 18.5204° N, 73.8567° E", method: "Coordinate Lat/Long Parser", desc: "Precise global positioning coordinates and mobile telemetry locations." },
      { id: 23, name: "Device Hardware IDs (IMEI / MAC)", cat: "Hardware", example: "IMEI: 864201048291048, 00:1A:2B:...", method: "MAC Hex & 15-Digit IMEI Parser", desc: "Mobile device IMEI codes and network interface MAC addresses." },
      { id: 24, name: "IP Addresses (IPv4 & IPv6)", cat: "Network", example: "103.21.244.0, 2405:201::", method: "Validated IP Octet Matcher", desc: "Public and private IP addresses assigning network activity to an individual." },
      { id: 25, name: "Vehicle Registration (RC)", cat: "Transport", example: "MH 12 AB 1234, DL 01 CA 5678", method: "State + District + Series RC Grammar", desc: "Regional Transport Office (RTO) vehicle registration certificate numbers." },
      { id: 26, name: "UUIDs & System Identifiers", cat: "Digital", example: "550e8400-e29b-41d4-a716-446655440000", method: "RFC 4122 Standard GUID Regex", desc: "Universally Unique Identifiers assigned to user sessions, devices, and records." },
      { id: 27, name: "Personal Profile / Web URLs", cat: "Digital", example: "linkedin.com/in/rajesh-kumar", method: "FQDN & Profile Path Matcher", desc: "Social profiles, professional portfolios, and individual web endpoints." }
    ]
  }
};

export function ToggleSwitch({
  checked,
  onChange,
  label,
  description,
  icon = '🛡️',
  onInfo = null,
  infoBadge = null,
}) {
  return (
    <div
      onClick={() => {
        if (onInfo) {
          onInfo();
        } else {
          onChange(!checked);
        }
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        borderRadius: '10px',
        background: checked
          ? 'linear-gradient(135deg, rgba(0, 242, 254, 0.08) 0%, rgba(168, 85, 247, 0.06) 100%)'
          : 'rgba(6, 10, 24, 0.6)',
        border: `1px solid ${checked ? 'rgba(0, 242, 254, 0.35)' : C.border}`,
        cursor: 'pointer',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        userSelect: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: '1.25rem', flex: 'none' }}>{icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: '0.92rem', color: checked ? '#f8fafc' : C.muted }}>
              {label}
            </span>
            {infoBadge && (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  onInfo && onInfo();
                }}
                style={{
                  fontSize: '0.70rem',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  background: 'rgba(0, 242, 254, 0.12)',
                  color: '#00f2fe',
                  border: '1px solid rgba(0, 242, 254, 0.3)',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                title="Click to view all covered identifiers"
              >
                <span>ℹ️</span>
                <span>{infoBadge}</span>
              </span>
            )}
          </div>
          {description && (
            <div style={{ fontSize: '0.76rem', color: C.faint, marginTop: '2px' }}>
              {description}
            </div>
          )}
        </div>
      </div>
      <div
        onClick={(e) => {
          e.stopPropagation();
          onChange(!checked);
        }}
        title={`Click to turn ${checked ? 'OFF' : 'ON'}`}
        style={{
          width: '46px',
          height: '24px',
          borderRadius: '12px',
          background: checked ? 'linear-gradient(135deg, #00f2fe, #a855f7)' : 'rgba(255, 255, 255, 0.1)',
          padding: '2px',
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
          transition: 'all 0.2s ease',
          boxShadow: checked ? '0 0 12px rgba(0, 242, 254, 0.4)' : 'none',
          flex: 'none',
          marginLeft: '12px',
        }}
      >
        <div style={{
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          background: '#ffffff',
          transform: checked ? 'translateX(22px)' : 'translateX(0px)',
          transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.4)',
        }} />
      </div>
    </div>
  );
}

export function ComplianceInfoModal({ frameworkKey, onClose, isEnabled = true, onToggle = null }) {
  const [search, setSearch] = useState('');
  const data = COMPLIANCE_FRAMEWORKS_DATA[frameworkKey];

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!data) return null;

  const filtered = data.identifiers.filter(item => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      item.name.toLowerCase().includes(q) ||
      item.cat.toLowerCase().includes(q) ||
      item.example.toLowerCase().includes(q) ||
      item.desc.toLowerCase().includes(q) ||
      item.method.toLowerCase().includes(q)
    );
  });

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(2, 6, 18, 0.82)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        animation: 'modalFadeIn 0.2s ease-out',
      }}
    >
      <style>{`
        @keyframes modalFadeIn {
          from { opacity: 0; transform: scale(0.97); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>

      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '820px',
          maxHeight: '90vh',
          background: 'linear-gradient(135deg, rgba(13, 20, 39, 0.98) 0%, rgba(6, 10, 24, 0.98) 100%)',
          border: `1.5px solid ${data.color}55`,
          borderRadius: '18px',
          boxShadow: `0 24px 60px rgba(0, 0, 0, 0.8), 0 0 35px ${data.color}22`,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Top Accent Gradient Bar */}
        <div style={{ height: '3px', background: `linear-gradient(90deg, ${data.color}, #a855f7)` }} />

        {/* Modal Header */}
        <div style={{
          padding: '22px 26px 18px 26px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: `linear-gradient(135deg, ${data.color}22, rgba(168, 85, 247, 0.15))`,
              border: `1.5px solid ${data.color}66`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.6rem',
              boxShadow: `0 0 16px ${data.color}33`,
            }}>
              {data.icon}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#f8fafc' }}>
                  {data.title}
                </h3>
                <span style={{
                  fontSize: '0.74rem',
                  padding: '3px 10px',
                  borderRadius: '20px',
                  background: isEnabled ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                  color: isEnabled ? '#10b981' : '#94a3b8',
                  border: `1px solid ${isEnabled ? 'rgba(16, 185, 129, 0.35)' : 'rgba(255, 255, 255, 0.12)'}`,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}>
                  {isEnabled ? '● Active & Enforcing' : '○ Disabled'}
                </span>
              </div>
              <div style={{ fontSize: '0.80rem', color: '#94a3b8', marginTop: '4px' }}>
                {data.law} · <span style={{ color: data.color, fontWeight: 700 }}>{data.badge}</span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '8px',
              color: '#94a3b8',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '1.1rem',
              transition: 'all 0.15s ease',
            }}
            title="Close (Esc)"
          >
            ✕
          </button>
        </div>

        {/* Description Banner & Search */}
        <div style={{
          padding: '16px 26px',
          background: 'rgba(6, 10, 24, 0.65)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}>
          <p style={{ margin: 0, fontSize: '0.84rem', color: '#cbd5e1', lineHeight: 1.5 }}>
            {data.description}
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search covered identifiers (e.g. MRN, PAN, Aadhaar, dates, email)...`}
                style={{
                  width: '100%',
                  padding: '9px 14px 9px 36px',
                  borderRadius: '8px',
                  background: 'rgba(12, 19, 39, 0.85)',
                  border: '1px solid rgba(0, 242, 254, 0.25)',
                  color: '#f8fafc',
                  fontSize: '0.84rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', fontSize: '0.85rem' }}>
                🔍
              </span>
              {search && (
                <button
                  onClick={() => setSearch('')}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                  }}
                >
                  ✕
                </button>
              )}
            </div>

            <div style={{
              fontSize: '0.78rem',
              color: '#94a3b8',
              flex: 'none',
              fontFamily: mono,
              fontWeight: 600,
            }}>
              {filtered.length} of {data.identifiers.length}
            </div>
          </div>
        </div>

        {/* Scrollable Identifier Grid */}
        <div style={{
          padding: '20px 26px',
          overflowY: 'auto',
          flex: 1,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
          gap: '12px',
          alignContent: 'start',
        }}>
          {filtered.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px 0', color: '#64748b', fontStyle: 'italic' }}>
              No covered identifiers match "{search}"
            </div>
          ) : (
            filtered.map((item) => (
              <div
                key={item.id}
                style={{
                  padding: '14px 16px',
                  borderRadius: '10px',
                  background: 'rgba(12, 19, 39, 0.7)',
                  border: '1px solid rgba(255, 255, 255, 0.07)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  transition: 'border-color 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      fontSize: '0.70rem',
                      fontWeight: 800,
                      color: data.color,
                      fontFamily: mono,
                      background: `${data.color}15`,
                      border: `1px solid ${data.color}35`,
                      padding: '1px 6px',
                      borderRadius: '4px',
                    }}>
                      #{item.id}
                    </span>
                    <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#f8fafc' }}>
                      {item.name}
                    </span>
                  </div>
                  <span style={{
                    fontSize: '0.68rem',
                    padding: '2px 7px',
                    borderRadius: '4px',
                    background: 'rgba(168, 85, 247, 0.12)',
                    color: '#c084fc',
                    border: '1px solid rgba(168, 85, 247, 0.25)',
                    fontWeight: 600,
                    flex: 'none',
                  }}>
                    {item.cat}
                  </span>
                </div>

                <div style={{ fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.4 }}>
                  {item.desc}
                </div>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  marginTop: '4px',
                  paddingTop: '6px',
                  borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                  fontSize: '0.72rem',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden' }}>
                    <span style={{ color: '#64748b' }}>Ex:</span>
                    <code style={{
                      fontFamily: mono,
                      color: '#00f2fe',
                      background: 'rgba(0, 242, 254, 0.08)',
                      padding: '1px 6px',
                      borderRadius: '4px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {item.example}
                    </code>
                  </div>
                  <span style={{ color: '#64748b', fontSize: '0.68rem', flex: 'none' }} title={item.method}>
                    {item.method.split(' ')[0]}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '14px 26px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(6, 10, 24, 0.9)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}>
          <div style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: '#00f2fe' }}>🔒</span>
            <span>Covered items are automatically sanitized via your active Governance policy (HASH / REDACT / BLOCK).</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {onToggle && (
              <button
                onClick={() => onToggle(!isEnabled)}
                style={{
                  padding: '7px 16px',
                  borderRadius: '8px',
                  border: isEnabled ? '1px solid rgba(244, 63, 94, 0.4)' : '1px solid rgba(16, 185, 129, 0.4)',
                  background: isEnabled ? 'rgba(244, 63, 94, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                  color: isEnabled ? '#fb7185' : '#10b981',
                  cursor: 'pointer',
                  fontSize: '0.80rem',
                  fontWeight: 600,
                  transition: 'all 0.15s ease',
                }}
              >
                {isEnabled ? 'Turn OFF' : 'Turn ON'}
              </button>
            )}
            <button
              onClick={onClose}
              style={{
                padding: '7px 20px',
                borderRadius: '8px',
                border: 'none',
                background: 'linear-gradient(135deg, #00f2fe, #a855f7)',
                color: '#041324',
                fontWeight: 700,
                cursor: 'pointer',
                fontSize: '0.82rem',
                boxShadow: '0 0 16px rgba(0, 242, 254, 0.35)',
              }}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Standardized Enterprise Brand Logo */
export function AdrishyaLogo({ size = 'default', showSubtitle = true, collapsed = false, onClick = null, style = {} }) {
  const isLarge = size === 'large';
  const isSmall = size === 'small';
  const boxSize = isLarge ? '44px' : isSmall ? '28px' : '32px';
  const iconSize = isLarge ? 22 : isSmall ? 15 : 18;

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: isLarge ? '12px' : isSmall ? '8px' : '9px',
        cursor: onClick ? 'pointer' : 'default',
        userSelect: 'none',
        ...style,
      }}
      onClick={onClick}
    >
      <div
        style={{
          width: boxSize,
          height: boxSize,
          borderRadius: isLarge ? '12px' : isSmall ? '8px' : '9px',
          background: 'linear-gradient(135deg, #00f2fe, #a855f7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 0 14px rgba(0, 242, 254, 0.38), inset 0 1px 2px rgba(255, 255, 255, 0.45)',
          flex: 'none',
          transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        }}
      >
        <IconShield size={iconSize} color="#ffffff" strokeWidth={2.2} />
      </div>

      {!collapsed && (
        <div style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>
          <div
            style={{
              fontWeight: 800,
              fontSize: isLarge ? '1.5rem' : isSmall ? '0.92rem' : '1.05rem',
              letterSpacing: isLarge ? '-0.02em' : '0.01em',
              lineHeight: 1.15,
            }}
          >
            <span style={{ color: '#ffffff' }}>Guard</span>
            <span style={{
              background: 'linear-gradient(135deg, #00f2fe 0%, #a855f7 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              filter: 'drop-shadow(0 0 10px rgba(0, 242, 254, 0.5))',
            }}>IA</span>
            <span style={{ color: '#ffffff' }}>n</span>
          </div>
          {showSubtitle && (
            <div
              style={{
                color: C.muted,
                fontSize: isLarge ? '0.74rem' : isSmall ? '0.62rem' : '0.65rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginTop: '1px',
              }}
            >
              Invisible Privacy Layer
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export const GuardianLogo = AdrishyaLogo;

/* Professional Enterprise SVG Icons */
export function IconShield({ size = 18, color = 'currentColor', strokeWidth = 2, style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none', ...style }}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

export function IconOverview({ size = 18, color = 'currentColor', strokeWidth = 2, style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none', ...style }}>
      <rect width="7" height="9" x="3" y="3" rx="1.5" />
      <rect width="7" height="5" x="14" y="3" rx="1.5" />
      <rect width="7" height="9" x="14" y="12" rx="1.5" />
      <rect width="7" height="5" x="3" y="16" rx="1.5" />
    </svg>
  );
}

export function IconActivity({ size = 18, color = 'currentColor', strokeWidth = 2, style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none', ...style }}>
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}

export function IconTrust({ size = 18, color = 'currentColor', strokeWidth = 2, style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none', ...style }}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <circle cx="12" cy="11" r="3" />
    </svg>
  );
}

export function IconUsers({ size = 18, color = 'currentColor', strokeWidth = 2, style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none', ...style }}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export function IconUser({ size = 16, color = 'currentColor', strokeWidth = 2, style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none', ...style }}>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

export function IconTest({ size = 18, color = 'currentColor', strokeWidth = 2, style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none', ...style }}>
      <path d="M10 2v7.31" />
      <path d="M14 9.3V2" />
      <path d="M8.5 2h7" />
      <path d="M14 9.3a6.5 6.5 0 1 1-4 0" />
      <path d="M5.52 16h12.96" />
    </svg>
  );
}

export function IconZap({ size = 18, color = 'currentColor', strokeWidth = 2, style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none', ...style }}>
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

export function IconSun({ size = 16, color = 'currentColor', strokeWidth = 2, style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none', ...style }}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </svg>
  );
}

export function IconMoon({ size = 16, color = 'currentColor', strokeWidth = 2, style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none', ...style }}>
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}

export function IconMenu({ size = 16, color = 'currentColor', strokeWidth = 2, style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none', ...style }}>
      <line x1="4" x2="20" y1="12" y2="12" />
      <line x1="4" x2="20" y1="6" y2="6" />
      <line x1="4" x2="20" y1="18" y2="18" />
    </svg>
  );
}

export function IconChevronLeft({ size = 14, color = 'currentColor', strokeWidth = 2, style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none', ...style }}>
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

export function IconChevronRight({ size = 14, color = 'currentColor', strokeWidth = 2, style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none', ...style }}>
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
