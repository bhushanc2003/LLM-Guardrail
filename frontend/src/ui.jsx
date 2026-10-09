import React, { useEffect, useState } from 'react';

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
  const cfg = {
    allow: { bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.4)', text: '#34d399', glow: 'rgba(16, 185, 129, 0.3)' },
    redact: { bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.4)', text: '#fbbf24', glow: 'rgba(245, 158, 11, 0.3)' },
    block: { bg: 'rgba(244, 63, 94, 0.14)', border: 'rgba(244, 63, 94, 0.45)', text: '#fb7185', glow: 'rgba(244, 63, 94, 0.35)' },
    deny: { bg: 'rgba(244, 63, 94, 0.14)', border: 'rgba(244, 63, 94, 0.45)', text: '#fb7185', glow: 'rgba(244, 63, 94, 0.35)' },
  }[decision] || { bg: 'rgba(148, 163, 184, 0.1)', border: 'rgba(148, 163, 184, 0.3)', text: '#94a3b8', glow: 'transparent' };

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

export function Loader3D({ title = 'Initializing Governance Engine...', subtitle = 'Syncing session state' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'radial-gradient(circle at center, #0f172a 0%, #060913 75%)', textAlign: 'center', padding: '20px', fontFamily: "'Outfit', system-ui, sans-serif" }}>
      <div style={{ position: 'relative', width: '120px', height: '120px', perspective: '1000px', transformStyle: 'preserve-3d', marginBottom: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ position: 'absolute', width: '100px', height: '100px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,242,254,0.3) 0%, rgba(168,85,247,0.15) 50%, transparent 70%)', filter: 'blur(12px)' }} />
        <div style={{ position: 'absolute', width: '110px', height: '110px', borderRadius: '50%', border: '3px solid transparent', borderTop: '3px solid #00f2fe', borderBottom: '3px solid #00f2fe', boxShadow: '0 0 22px rgba(0, 242, 254, 0.45)', animation: 'spin3dX 3.5s linear infinite' }} />
        <div style={{ position: 'absolute', width: '85px', height: '85px', borderRadius: '50%', border: '3px solid transparent', borderLeft: '3px solid #a855f7', borderRight: '3px solid #a855f7', boxShadow: '0 0 20px rgba(168, 85, 247, 0.45)', animation: 'spin3dY 2.8s linear infinite' }} />
        <div style={{ position: 'absolute', width: '60px', height: '60px', borderRadius: '50%', border: '2.5px solid transparent', borderTop: '2.5px solid #38bdf8', borderRight: '2.5px solid #38bdf8', animation: 'spin3dX 2s linear infinite reverse' }} />
        <div style={{ position: 'absolute', width: '22px', height: '22px', borderRadius: '50%', background: 'linear-gradient(135deg, #00f2fe, #a855f7)', animation: 'pulseCore 2.2s ease-in-out infinite' }} />
      </div>
      <h3 style={{ margin: '0 0 8px 0', fontSize: '1.3rem', fontWeight: 700, background: 'linear-gradient(135deg, #ffffff 20%, #38bdf8 65%, #a855f7 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '0.02em' }}>
        {title}
      </h3>
      <p style={{ margin: 0, fontSize: '0.88rem', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
        <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#00f2fe', boxShadow: '0 0 10px #00f2fe', animation: 'pulseDot 1.5s ease-in-out infinite' }} />
        {subtitle}
      </p>
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
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th style={th}>Time</th>
          {showUser && <th style={th}>User</th>}
          {onOpenSession && <th style={th}>Session</th>}
          <th style={th}>Decision</th>
          <th style={th}>Categories</th>
          <th style={th}>Prompt</th>
          <th style={{ ...th, textAlign: 'right' }}>Tokens (In / Out)</th>
          <th style={{ ...th, textAlign: 'right' }}>Latency</th>
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
              <td style={td}><DecisionChip decision={r.decision} /></td>
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
        <DecisionChip decision={e.decision} />
        <span style={{ color: C.muted, fontSize: '0.88rem' }}>{e.created_at ? new Date(e.created_at).toLocaleString() : ''}</span>
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px', marginBottom: '20px' }}>
        <div>
          <div style={label}>Original Prompt (Ingress)</div>
          <div style={box}>{e.original_text || <span style={{ color: C.faint }}>not stored</span>}</div>
        </div>
        <div>
          <div style={label}>Processed Payload (Upstream AI Model)</div>
          <div style={{ ...box, color: C.allow, borderColor: e.decision === 'block' && (!e.egress_pii_count) ? 'rgba(244, 63, 94, 0.4)' : 'rgba(16, 185, 129, 0.4)' }}>
            {e.decision === 'block' && (!e.egress_pii_count)
              ? <span style={{ color: C.block, fontWeight: 700 }}>🚫 BLOCKED. Policy violation intercepted before reaching external nodes.</span>
              : (e.anonymized_text || e.original_text || <span style={{ color: C.faint }}>no change</span>)}
          </div>
        </div>
      </div>

      {(e.original_response || e.anonymized_response) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px', marginBottom: '24px' }}>
          <div>
            <div style={label}>Model Raw Output (Egress)</div>
            <div style={{ ...box, color: '#f8fafc' }}>{e.original_response}</div>
          </div>
          <div>
            <div style={label}>Delivered Response (Sanitized)</div>
            <div style={{ ...box, color: C.allow, borderColor: e.decision === 'block' && e.egress_pii_count ? 'rgba(244, 63, 94, 0.4)' : 'rgba(16, 185, 129, 0.4)' }}>
              {e.decision === 'block' && e.egress_pii_count
                ? <span style={{ color: C.block, fontWeight: 700 }}>🚫 BLOCKED. Model output policy violation intercepted from reaching user.</span>
                : (e.anonymized_response || e.original_response || <span style={{ color: C.faint }}>no change</span>)}
            </div>
          </div>
        </div>
      )}

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

export function ToggleSwitch({ checked, onChange, label, description, icon = '🛡️' }) {
  return (
    <div
      onClick={() => onChange(!checked)}
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontSize: '1.25rem' }}>{icon}</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.92rem', color: checked ? '#f8fafc' : C.muted }}>
            {label}
          </div>
          {description && (
            <div style={{ fontSize: '0.76rem', color: C.faint, marginTop: '2px' }}>
              {description}
            </div>
          )}
        </div>
      </div>
      <div style={{
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
      }}>
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
