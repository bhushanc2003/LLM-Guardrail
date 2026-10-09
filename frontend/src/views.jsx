import React, { useEffect, useState } from 'react';
import { C, Card, Kpi, DecisionChip, Empty, Loader, ScrollBox, LimitSelect, RequestTable, RequestDetail, ToggleSwitch, mono } from './ui.jsx';

const inputStyle = {
  background: 'rgba(6, 10, 24, 0.75)',
  color: '#f8fafc',
  border: `1px solid rgba(56, 189, 248, 0.2)`,
  borderRadius: '8px',
  padding: '8px 12px',
  fontSize: '0.88rem',
  outline: 'none',
  boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.4)',
};
const btn = {
  background: 'linear-gradient(135deg, #00f2fe 0%, #38bdf8 100%)',
  color: '#041324',
  border: 'none',
  borderRadius: '8px',
  padding: '9px 18px',
  fontWeight: 700,
  cursor: 'pointer',
  fontSize: '0.88rem',
  boxShadow: '0 0 16px rgba(0, 242, 254, 0.35)',
  letterSpacing: '0.01em',
};
const cellTh = {
  textAlign: 'left',
  padding: '11px 12px',
  color: '#94a3b8',
  fontSize: '0.78rem',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  borderBottom: `1px solid ${C.border}`,
};
const cellTd = {
  padding: '12px',
  fontSize: '0.88rem',
  borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
};

export function Segmented({ value, options, onChange }) {
  return (
    <div style={{
      display: 'inline-flex',
      background: 'rgba(6, 10, 24, 0.85)',
      border: `1px solid ${C.border}`,
      borderRadius: '10px',
      padding: '4px',
      backdropFilter: 'blur(12px)',
      boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.5)',
    }}>
      {options.map(([key, label]) => {
        const active = value === key;
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            style={{
              background: active ? 'linear-gradient(135deg, rgba(0, 242, 254, 0.2) 0%, rgba(168, 85, 247, 0.12) 100%)' : 'transparent',
              color: active ? '#ffffff' : '#94a3b8',
              border: active ? '1px solid rgba(0, 242, 254, 0.4)' : '1px solid transparent',
              borderRadius: '8px',
              padding: '6px 16px',
              fontSize: '0.84rem',
              fontWeight: active ? 700 : 500,
              cursor: 'pointer',
              boxShadow: active ? '0 0 12px rgba(0, 242, 254, 0.25)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function usePoll(fn, deps, ms = 10000) {
  useEffect(() => {
    let cancelled = false;
    const run = async () => { if (!cancelled) await fn(() => cancelled); };
    run();
    const t = setInterval(run, ms);
    return () => { cancelled = true; clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

function Bars({ items, color = C.accent, empty = 'No data yet.' }) {
  if (!items || items.length === 0) return <Empty>{empty}</Empty>;
  const max = Math.max(...items.map(i => i.value), 1);
  return (
    <div style={{ display: 'grid', gap: '10px' }}>
      {items.map(item => (
        <div key={item.label} style={{ display: 'grid', gridTemplateColumns: '180px 1fr 44px', gap: '12px', alignItems: 'center', fontSize: '0.86rem' }}>
          <span style={{ color: '#c9d3e6', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
          <div style={{ background: C.border, borderRadius: '4px', height: '8px', overflow: 'hidden' }}>
            <div style={{ width: `${(item.value / max) * 100}%`, height: '100%', background: color }} />
          </div>
          <span style={{ textAlign: 'right', color: C.text, fontVariantNumeric: 'tabular-nums' }}>{item.value}</span>
        </div>
      ))}
    </div>
  );
}

// ---------- Logs ----------

export function LogsView({ authedFetch, uuid = null, initialEvent = null, onOpenSession, title = null }) {
  const [limit, setLimit] = useState(20);
  const [rows, setRows] = useState([]);
  const [users, setUsers] = useState([]);
  const [eventId, setEventId] = useState(initialEvent);
  const [search, setSearch] = useState('');
  const [decision, setDecision] = useState('all');
  const [userFilter, setUserFilter] = useState('');
  const [range, setRange] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => setEventId(initialEvent), [initialEvent]);

  usePoll(async (isCancelled) => {
    const url = uuid ? `/api/users/${uuid}/queries?limit=${limit}` : `/api/admin/activity?limit=${limit}`;
    const r = await authedFetch(url);
    if (r.ok && !isCancelled()) {
      setRows(await r.json());
      setLoading(false);
    }
  }, [uuid, limit, authedFetch]);

  usePoll(async (isCancelled) => {
    if (uuid) return;
    const r = await authedFetch('/api/admin/users');
    if (r.ok && !isCancelled()) setUsers(await r.json());
  }, [uuid, authedFetch], 30000);

  if (eventId) {
    return (
      <Card>
        <RequestDetail eventId={eventId} authedFetch={authedFetch} onBack={() => setEventId(null)} />
      </Card>
    );
  }

  const cutoffs = { '1h': 3600e3, '24h': 86400e3, '7d': 7 * 86400e3 };
  const cutoff = cutoffs[range] ? Date.now() - cutoffs[range] : 0;
  const q = search.trim().toLowerCase();
  const shown = rows.filter(r => {
    const d = (r.decision || (r.action_mode === 'HASH' && r.decision !== 'allow' ? 'hash' : 'redact')).toLowerCase();
    if (decision === 'violations' && d === 'allow') return false;
    if (decision !== 'all' && decision !== 'violations' && d !== decision) return false;
    if (userFilter && r.user_uuid !== userFilter) return false;
    if (cutoff && (!r.created_at || new Date(r.created_at).getTime() < cutoff)) return false;
    if (q) {
      const hay = [r.original_prompt, r.original_text, (r.categories_found || []).join(' '), r.session_external_id, r.user_email]
        .filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return (
    <Card
      title={title || (uuid ? 'Requests' : 'All logs')}
      action={<LimitSelect value={limit} onChange={setLimit} />}
    >
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '14px' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search prompt, category, session or user" style={{ ...inputStyle, flex: '1 1 260px' }} />
        <select value={decision} onChange={e => setDecision(e.target.value)} style={inputStyle}>
          <option value="all">All decisions</option>
          <option value="violations">Violations (redact + hash + block)</option>
          <option value="allow">Allowed</option>
          <option value="redact">Redacted</option>
          <option value="hash">Hashed</option>
          <option value="block">Blocked</option>
        </select>
        {!uuid && (
          <select value={userFilter} onChange={e => setUserFilter(e.target.value)} style={inputStyle}>
            <option value="">All users</option>
            {users.map(u => <option key={u.user_uuid} value={u.user_uuid}>{u.email}</option>)}
          </select>
        )}
        <select value={range} onChange={e => setRange(e.target.value)} style={inputStyle}>
          <option value="all">Any time</option>
          <option value="1h">Last hour</option>
          <option value="24h">Last 24 hours</option>
          <option value="7d">Last 7 days</option>
        </select>
      </div>
      <div style={{ color: C.faint, fontSize: '0.8rem', marginBottom: '10px' }}>
        {loading ? 'Loading requests…' : `Showing ${shown.length} of the latest ${rows.length} requests`}
      </div>
      <ScrollBox maxHeight={600}>
        {loading ? (
          <Loader text="Loading activity logs from database…" />
        ) : (
          <RequestTable
            rows={shown}
            onOpen={setEventId}
            onOpenSession={onOpenSession}
            showUser={!uuid}
            empty="No requests match these filters."
          />
        )}
      </ScrollBox>
    </Card>
  );
}

// ---------- Sessions ----------

// Categorical series colors, fixed order (dark-surface steps of the validated reference palette).
const SERIES = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'];

function ScoreChart({ agents }) {
  const [tip, setTip] = useState(null);
  const W = 760, H = 250, L = 38, R = agents.length <= 4 ? 110 : 16, T = 14, B = 30;
  // every score change across all agents, in time order; x = position in that sequence
  const events = [];
  agents.forEach((a, ai) => a.trend.slice(1).forEach(t => events.push({ ...t, agent: a.agent_name, ai })));
  events.sort((x, y) => (x.t || '').localeCompare(y.t || ''));
  events.forEach((e, i) => { e.x = i + 1; });
  const N = Math.max(events.length, 1);
  const X = v => L + (v / N) * (W - L - R);
  const Y = v => T + (1 - v / 100) * (H - T - B);

  const lines = agents.map((a, ai) => {
    const pts = [{ x: 0, score: a.trend[0].score }, ...events.filter(e => e.ai === ai).map(e => ({ x: e.x, score: e.score }))];
    pts.push({ x: N, score: a.score });
    let d = `M${X(pts[0].x)},${Y(pts[0].score)}`;
    for (let i = 1; i < pts.length; i++) d += ` L${X(pts[i].x)},${Y(pts[i - 1].score)} L${X(pts[i].x)},${Y(pts[i].score)}`;
    return { name: a.agent_name, color: SERIES[ai % SERIES.length], d, end: pts[pts.length - 1].score };
  });
  const gates = [[80, 'high-risk tools need 80'], [50, 'medium need 50'], [20, 'below 20 blocks output']];

  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img"
        aria-label="Authority score per agent over the session">
        {[0, 20, 40, 60, 80, 100].map(v => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} stroke="rgba(148,163,184,0.15)" strokeWidth="1" />
            <text x={L - 8} y={Y(v) + 4} textAnchor="end" fontSize="11" fill="#94a3b8">{v}</text>
          </g>
        ))}
        {gates.map(([v, label]) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} stroke="rgba(148,163,184,0.45)" strokeWidth="1" strokeDasharray="4 4" />
            <text x={W - R - 4} y={Y(v) - 4} textAnchor="end" fontSize="10" fill="#94a3b8">{label}</text>
          </g>
        ))}
        <text x={L} y={H - 8} fontSize="11" fill="#94a3b8">session start</text>
        <text x={W - R} y={H - 8} textAnchor="end" fontSize="11" fill="#94a3b8">score changes, in order →</text>
        {lines.map(l => <path key={l.name} d={l.d} fill="none" stroke={l.color} strokeWidth="2" strokeLinejoin="round" />)}
        {events.map((e, i) => {
          const color = SERIES[e.ai % SERIES.length];
          const cy = Y(e.score), cx = X(e.x);
          const common = {
            onMouseEnter: () => setTip({ x: (cx / W) * 100, y: (cy / H) * 100, e }),
            onMouseLeave: () => setTip(null),
            style: { cursor: 'default' },
          };
          return e.delta < 0
            ? <circle key={i} cx={cx} cy={cy} r="5" fill={color} stroke="#0c1327" strokeWidth="2" {...common} />
            : <rect key={i} x={cx - 4.5} y={cy - 4.5} width="9" height="9" transform={`rotate(45 ${cx} ${cy})`} fill={color} stroke="#0c1327" strokeWidth="2" {...common} />;
        })}
        {agents.length <= 4 && lines.map(l => (
          <text key={l.name} x={W - R + 8} y={Y(l.end) + 4} fontSize="11" fill="#e2e8f0">{l.name}</text>
        ))}
      </svg>
      {tip && (
        <div style={{
          position: 'absolute', left: `${Math.min(tip.x, 70)}%`, top: `${Math.max(tip.y - 14, 0)}%`, transform: 'translate(8px, -100%)',
          background: '#0c1327', border: `1px solid ${C.border}`, borderRadius: '8px', padding: '8px 10px',
          fontSize: '0.8rem', color: '#e2e8f0', pointerEvents: 'none', maxWidth: '320px', boxShadow: '0 8px 24px rgba(0,0,0,0.5)', zIndex: 5,
        }}>
          <div style={{ fontFamily: mono, color: SERIES[tip.e.ai % SERIES.length], fontWeight: 700 }}>{tip.e.agent}</div>
          <div>{tip.e.delta > 0 ? '+' : ''}{tip.e.delta} → score {tip.e.score}</div>
          <div style={{ color: C.muted }}>{tip.e.reason}</div>
        </div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginTop: '8px', fontSize: '0.8rem', color: '#cbd5e1' }}>
        {lines.map(l => (
          <span key={l.name} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: l.color, display: 'inline-block' }} />
            <span style={{ fontFamily: mono }}>{l.name}</span>
          </span>
        ))}
        <span style={{ color: C.faint }}>● penalty · ◆ reward</span>
      </div>
    </div>
  );
}

function AgentPanel({ data, requestCount, violations }) {
  if (!data || !data.agents) return null;
  const agents = data.agents;
  const direct = agents.length <= 1 && agents.every(a => !a.tool_calls && a.trend.length <= 1);
  const wrap = { marginTop: '22px', paddingTop: '18px', borderTop: `1px solid ${C.border}` };
  const heading = { color: C.muted, fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' };

  if (direct) {
    return (
      <div style={wrap}>
        <div style={heading}>How the agents performed</div>
        <div style={{ padding: '12px 14px', borderRadius: '8px', background: 'rgba(56,189,248,0.08)', borderLeft: '3px solid #38bdf8', color: '#e2e8f0', fontSize: '0.9rem', lineHeight: 1.5 }}>
          Direct LLM session: no tools and no sub-agents, so there is no authority score to show.
          Compliance results are in the requests above ({requestCount} request{requestCount === 1 ? '' : 's'}, {violations} redacted or blocked).
        </div>
      </div>
    );
  }

  const colorFor = sc => (sc >= 70 ? C.allow : sc >= 40 ? C.redact : C.block);
  const roots = agents.filter(a => !a.parent_agent_id);
  const ordered = [];
  const add = (a, depth) => { ordered.push({ ...a, depth }); agents.filter(c => c.parent_agent_id === a.agent_id).forEach(c => add(c, depth + 1)); };
  roots.forEach(a => add(a, 0));
  agents.forEach(a => { if (!ordered.find(o => o.agent_id === a.agent_id)) ordered.push({ ...a, depth: 0 }); });

  return (
    <div style={wrap}>
      <div style={heading}>How the agents performed</div>
      <div style={{
        padding: '10px 14px', marginBottom: '14px', borderRadius: '8px', fontSize: '0.9rem', color: '#f1f5f9',
        background: data.verdict.allowed ? 'rgba(16,185,129,0.08)' : 'rgba(244,63,94,0.1)',
        borderLeft: `3px solid ${data.verdict.allowed ? C.allow : C.block}`,
      }}>
        Session verdict: <b>{data.verdict.allowed ? 'output allowed' : 'output blocked'}</b> · {data.verdict.reason}
      </div>
      <ScoreChart agents={agents} />
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '16px' }}>
        <thead>
          <tr>
            <th style={cellTh}>Agent</th>
            <th style={cellTh}>Authority score</th>
            <th style={{ ...cellTh, textAlign: 'right' }}>Tool calls</th>
            <th style={{ ...cellTh, textAlign: 'right' }}>Denied</th>
            <th style={{ ...cellTh, textAlign: 'right' }}>Violations</th>
          </tr>
        </thead>
        <tbody>
          {ordered.map(a => {
            const c = colorFor(a.effective_score);
            return (
              <tr key={a.agent_id}>
                <td style={{ ...cellTd, fontFamily: mono, paddingLeft: `${12 + a.depth * 22}px` }}>
                  {a.depth > 0 && <span style={{ color: C.faint }}>└ </span>}{a.agent_name}
                  {a.parent_agent_name && <span style={{ color: C.faint, fontSize: '0.75rem' }}> (from {a.parent_agent_name})</span>}
                </td>
                <td style={cellTd}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '90px', height: '8px', borderRadius: '4px', background: 'rgba(148,163,184,0.2)', overflow: 'hidden' }}>
                      <div style={{ width: `${a.effective_score}%`, height: '100%', background: c }} />
                    </div>
                    <span style={{ fontFamily: mono, color: '#e2e8f0', fontWeight: 700 }}>{a.effective_score}</span>
                    {a.effective_score !== a.score && <span style={{ color: C.faint, fontSize: '0.75rem' }}>own {a.score}, capped by parent</span>}
                  </div>
                </td>
                <td style={{ ...cellTd, textAlign: 'right' }}>{a.tool_calls}</td>
                <td style={{ ...cellTd, textAlign: 'right', color: a.denied_calls ? C.block : C.muted }}>{a.denied_calls}</td>
                <td style={{ ...cellTd, textAlign: 'right', color: a.violations ? C.redact : C.muted }}>{a.violations}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function SessionsView({ authedFetch, uuid = null, showUser = false, initialSession = null, title = null, onOpenChange = null }) {
  const [limit, setLimit] = useState(20);
  const [sessions, setSessions] = useState([]);
  const [selected, setSelected] = useState(initialSession);
  const [events, setEvents] = useState([]);
  const [eventId, setEventId] = useState(null);
  const [search, setSearch] = useState('');
  const [violationsOnly, setViolationsOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [agentData, setAgentData] = useState(null);
  const [receiptCheck, setReceiptCheck] = useState(null);

  useEffect(() => { setSelected(initialSession); setEventId(null); }, [initialSession]);
  useEffect(() => { setReceiptCheck(null); }, [selected?.session_id]);
  useEffect(() => { if (onOpenChange) onOpenChange(!!selected || !!eventId); }, [selected, eventId]); // eslint-disable-line

  usePoll(async (isCancelled) => {
    const r = await authedFetch(uuid ? `/api/users/${uuid}/sessions` : '/api/admin/sessions');
    if (r.ok && !isCancelled()) {
      setSessions(await r.json());
      setLoading(false);
    }
  }, [uuid, authedFetch]);

  usePoll(async (isCancelled) => {
    if (!selected) return;
    const r = await authedFetch(`/api/sessions/${selected.session_id}/events`);
    if (r.ok && !isCancelled()) setEvents(await r.json());
    const a = await authedFetch(`/api/sessions/${selected.session_id}/agent-scores`);
    if (a.ok && !isCancelled()) setAgentData(await a.json());
  }, [selected?.session_id, authedFetch]);

  if (eventId) {
    return (
      <Card>
        <RequestDetail eventId={eventId} authedFetch={authedFetch} onBack={() => setEventId(null)} />
      </Card>
    );
  }

  if (selected) {
    const promptTokens = events.reduce((acc, ev) => acc + (ev.prompt_tokens || 0), 0);
    const completionTokens = events.reduce((acc, ev) => acc + (ev.completion_tokens || 0), 0);
    const totalTokens = promptTokens + completionTokens;
    return (
      <Card
        title={
          <span>
            <button onClick={() => setSelected(null)} style={{ background: 'transparent', border: 'none', color: C.accent, cursor: 'pointer', padding: 0, fontSize: 'inherit' }}>Sessions</button>
            <span style={{ color: C.faint }}> / </span>
            <span style={{ fontFamily: mono }}>{selected.external_id}</span>
          </span>
        }
      >
        <button
          onClick={() => setSelected(null)}
          style={{ background: 'rgba(255, 255, 255, 0.05)', border: `1px solid ${C.border}`, color: C.accent, padding: '7px 14px', borderRadius: '8px', cursor: 'pointer', marginBottom: '16px', fontWeight: 600, fontSize: '0.86rem' }}
        >
          ← Back to sessions
        </button>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '18px' }}>
          <Kpi label="Requests" value={events.length} />
          <Kpi label="Input Tokens" value={promptTokens.toLocaleString()} hint="Prompt payload" />
          <Kpi label="Output Tokens" value={completionTokens.toLocaleString()} hint="Completion text" />
          <Kpi label="Total Tokens" value={totalTokens.toLocaleString()} />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <button
            onClick={async () => {
              setReceiptCheck({ loading: true });
              const r = await authedFetch(`/api/sessions/${selected.session_id}/receipts/verify`);
              setReceiptCheck(r.ok ? await r.json() : { ok: false, reason: `request failed (${r.status})` });
            }}
            style={{ ...btn, background: 'transparent', color: C.accent, border: `1px solid ${C.border}` }}
          >
            Verify receipts
          </button>
          <button
            onClick={async () => {
              const r = await authedFetch(`/api/sessions/${selected.session_id}/receipts`);
              if (!r.ok) return;
              const blob = new Blob([JSON.stringify(await r.json(), null, 2)], { type: 'application/json' });
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = `receipts-${selected.external_id || selected.session_id}.json`;
              a.click();
              URL.revokeObjectURL(a.href);
            }}
            style={{ ...btn, background: 'transparent', color: C.accent, border: `1px solid ${C.border}` }}
          >
            Export receipts (JSON)
          </button>
          {receiptCheck && !receiptCheck.loading && (
            <span style={{ fontSize: '0.86rem', fontWeight: 600, color: receiptCheck.ok ? C.allow : C.block }}>
              {receiptCheck.ok
                ? `✓ Chain intact: ${receiptCheck.receipts} receipt${receiptCheck.receipts === 1 ? '' : 's'}, none altered`
                : `✗ Chain broken${receiptCheck.broken_at_seq ? ` at receipt #${receiptCheck.broken_at_seq}` : ''}: ${receiptCheck.reason}`}
            </span>
          )}
          {receiptCheck?.loading && <span style={{ color: C.muted, fontSize: '0.86rem' }}>Checking…</span>}
        </div>
        <ScrollBox maxHeight={600}>
          <RequestTable rows={events} onOpen={setEventId} empty="No requests in this session." />
        </ScrollBox>
        <AgentPanel data={agentData} requestCount={events.length} violations={events.filter(e => e.decision === 'redact' || e.decision === 'block').length} />
      </Card>
    );
  }

  const q = search.trim().toLowerCase();
  const filtered = sessions.filter(x => {
    if (violationsOnly && !(x.violations > 0)) return false;
    if (q && !`${x.external_id} ${x.user_email || ''}`.toLowerCase().includes(q)) return false;
    return true;
  });
  const shown = filtered.slice(0, limit);
  return (
    <Card title={title || (uuid ? 'Sessions' : 'All sessions')} action={<LimitSelect value={limit} onChange={setLimit} />}>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '14px' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder={showUser ? 'Search session or user' : 'Search session'} style={{ ...inputStyle, flex: '1 1 260px' }} />
        <select value={violationsOnly ? 'violations' : 'all'} onChange={e => setViolationsOnly(e.target.value === 'violations')} style={inputStyle}>
          <option value="all">All sessions</option>
          <option value="violations">With violations</option>
        </select>
      </div>
      <div style={{ color: C.faint, fontSize: '0.8rem', marginBottom: '10px' }}>
        {loading ? 'Loading sessions…' : `Showing ${shown.length} of ${filtered.length} sessions`}
      </div>
      {loading ? (
        <Loader text="Loading sessions from database…" />
      ) : sessions.length === 0 ? (
        <Empty>No sessions yet. Send a request through the proxy.</Empty>
      ) : (
        <ScrollBox maxHeight={600}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={cellTh}>Session</th>
                {showUser && <th style={cellTh}>User</th>}
                <th style={{ ...cellTh, textAlign: 'right' }}>Agents</th>
                <th style={{ ...cellTh, textAlign: 'right' }}>Requests</th>
                <th style={{ ...cellTh, textAlign: 'right' }}>Tokens (In / Out)</th>
                <th style={{ ...cellTh, textAlign: 'right' }}>Violations</th>
                <th style={cellTh}>Last seen</th>
              </tr>
            </thead>
            <tbody>
              {shown.map(s => (
                <tr
                  key={s.session_id}
                  onClick={() => setSelected({ session_id: s.session_id, external_id: s.external_id })}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#16213a')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ ...cellTd, fontFamily: mono, color: C.accent }}>{s.external_id}</td>
                  {showUser && <td style={cellTd}>{s.user_email}</td>}
                  <td style={{ ...cellTd, textAlign: 'right' }}>{s.agents}</td>
                  <td style={{ ...cellTd, textAlign: 'right' }}>{s.requests}</td>
                  <td style={{ ...cellTd, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    <div style={{ color: '#00f2fe', fontWeight: 600 }}>
                      {((s.total_tokens || ((s.prompt_tokens || 0) + (s.completion_tokens || 0)))).toLocaleString()}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: C.faint, whiteSpace: 'nowrap' }}>
                      ↓{(s.prompt_tokens || 0).toLocaleString()} in · ↑{(s.completion_tokens || 0).toLocaleString()} out
                    </div>
                  </td>
                  <td style={{ ...cellTd, textAlign: 'right', color: s.violations > 0 ? C.block : C.muted }}>{s.violations}</td>
                  <td style={{ ...cellTd, color: C.muted, whiteSpace: 'nowrap' }}>{s.last_seen_at ? new Date(s.last_seen_at).toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollBox>
      )}
    </Card>
  );
}

// ---------- Activity Users List (Admin) ----------

export function AdminActivityUserList({ authedFetch, onSelectUser, onSelectAll }) {
  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('requests');

  usePoll(async (isCancelled) => {
    const r = await authedFetch('/api/admin/users');
    if (r.ok && !isCancelled()) setUsers(await r.json());
  }, [authedFetch], 15000);

  const q = query.trim().toLowerCase();
  let list = users.filter(u => (!q || u.email.toLowerCase().includes(q) || (u.name || '').toLowerCase().includes(q)));
  if (filter === 'violations') list = list.filter(u => u.violations > 0);
  if (filter === 'admins') list = list.filter(u => u.role === 'admin');

  const sorters = {
    requests: (a, b) => (b.requests || 0) - (a.requests || 0),
    violations: (a, b) => (b.violations || 0) - (a.violations || 0),
    last_active: (a, b) => (b.last_active || '').localeCompare(a.last_active || ''),
  };
  list = [...list].sort(sorters[sort] || sorters.requests);

  const totalReqs = users.reduce((acc, u) => acc + (u.requests || 0), 0);
  const totalViolations = users.reduce((acc, u) => acc + (u.violations || 0), 0);

  return (
    <div style={{ display: 'grid', gap: '20px' }}>
      {/* Top Summary Banner */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '14px',
      }}>
        <Kpi label="Active Users" value={users.length} hint="Registered users with telemetry" />
        <Kpi label="Total Audited Requests" value={totalReqs.toLocaleString()} hint="Across all conversation sessions" />
        <Kpi
          label="Total Policy Violations"
          value={totalViolations.toLocaleString()}
          hint="Redacted and blocked prompt payloads"
        />
      </div>

      {/* Main Glassmorphic Card */}
      <Card
        title={`Select User to View Activity Logs (${list.length})`}
        action={
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search user name or email…"
              style={{ ...inputStyle, width: '220px' }}
            />
            <select value={filter} onChange={e => setFilter(e.target.value)} style={inputStyle}>
              <option value="all">All users</option>
              <option value="violations">With violations</option>
              <option value="admins">Admins</option>
            </select>
            <select value={sort} onChange={e => setSort(e.target.value)} style={inputStyle}>
              <option value="requests">Sort: Most requests</option>
              <option value="violations">Sort: Most violations</option>
              <option value="last_active">Sort: Last active</option>
            </select>
            {onSelectAll && (
              <button
                onClick={onSelectAll}
                style={{
                  ...btn,
                  padding: '7px 14px',
                  fontSize: '0.8rem',
                  background: 'rgba(0, 242, 254, 0.12)',
                  color: '#00f2fe',
                  border: '1px solid rgba(0, 242, 254, 0.3)',
                  boxShadow: 'none',
                }}
                title="View all logs from all users combined"
              >
                ⚡ View All Combined
              </button>
            )}
          </div>
        }
      >
        {list.length === 0 ? (
          <Empty>No users match your filter.</Empty>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={cellTh}>User / Identity</th>
                  <th style={cellTh}>Role</th>
                  <th style={{ ...cellTh, textAlign: 'right' }}>Requests</th>
                  <th style={{ ...cellTh, textAlign: 'right' }}>Violations</th>
                  <th style={{ ...cellTh, textAlign: 'right' }}>PII Found</th>
                  <th style={cellTh}>Last Active</th>
                  <th style={{ ...cellTh, textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {list.map(u => (
                  <tr
                    key={u.user_uuid}
                    onClick={() => onSelectUser(u)}
                    style={{
                      cursor: 'pointer',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0, 242, 254, 0.06)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={cellTd}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '34px',
                          height: '34px',
                          borderRadius: '8px',
                          background: 'linear-gradient(135deg, rgba(0, 242, 254, 0.2), rgba(168, 85, 247, 0.2))',
                          border: '1px solid rgba(0, 242, 254, 0.3)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1rem',
                          flex: 'none',
                        }}>
                          👤
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: '#f8fafc' }}>
                            {u.email}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: C.faint, fontFamily: mono }}>
                            {u.user_uuid} {u.name ? `· ${u.name}` : ''}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={cellTd}>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        background: u.role === 'admin' ? 'rgba(168, 85, 247, 0.15)' : 'rgba(255, 255, 255, 0.06)',
                        color: u.role === 'admin' ? '#c084fc' : C.muted,
                        border: u.role === 'admin' ? '1px solid rgba(168, 85, 247, 0.4)' : `1px solid ${C.border}`,
                      }}>
                        {u.role}
                      </span>
                    </td>
                    <td style={{ ...cellTd, textAlign: 'right', fontWeight: 700, color: '#00f2fe', fontFamily: mono }}>
                      {(u.requests || 0).toLocaleString()}
                    </td>
                    <td style={{ ...cellTd, textAlign: 'right', fontFamily: mono }}>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        background: (u.violations || 0) > 0 ? 'rgba(244, 63, 94, 0.12)' : 'rgba(16, 185, 129, 0.1)',
                        color: (u.violations || 0) > 0 ? '#f43f5e' : '#10b981',
                        border: (u.violations || 0) > 0 ? '1px solid rgba(244, 63, 94, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)',
                      }}>
                        {(u.violations || 0).toLocaleString()}
                      </span>
                    </td>
                    <td style={{ ...cellTd, textAlign: 'right', color: C.text, fontFamily: mono }}>
                      {(u.pii_detected || 0).toLocaleString()}
                    </td>
                    <td style={{ ...cellTd, color: C.muted, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                      {u.last_active ? new Date(u.last_active).toLocaleString() : 'never'}
                    </td>
                    <td style={{ ...cellTd, textAlign: 'right' }}>
                      <button
                        onClick={e => { e.stopPropagation(); onSelectUser(u); }}
                        style={{
                          background: 'linear-gradient(135deg, rgba(0, 242, 254, 0.15) 0%, rgba(168, 85, 247, 0.1) 100%)',
                          color: '#00f2fe',
                          border: '1px solid rgba(0, 242, 254, 0.35)',
                          borderRadius: '6px',
                          padding: '6px 14px',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        Open Logs →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

// ---------- Users (admin) ----------

export function UsersView({ authedFetch, onOpenUser }) {
  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('violations');
  const [shown, setShown] = useState(10);
  const [loading, setLoading] = useState(true);

  usePoll(async (isCancelled) => {
    const r = await authedFetch('/api/admin/users');
    if (r.ok && !isCancelled()) {
      setUsers(await r.json());
      setLoading(false);
    } else if (!isCancelled()) {
      setLoading(false);
    }
  }, [authedFetch], 15000);

  const q = query.trim().toLowerCase();
  let list = users.filter(u => (!q || u.email.toLowerCase().includes(q) || (u.name || '').toLowerCase().includes(q)));
  if (filter === 'violations') list = list.filter(u => u.violations > 0);
  if (filter === 'admins') list = list.filter(u => u.role === 'admin');
  const sorters = {
    violations: (a, b) => b.violations - a.violations,
    requests: (a, b) => b.requests - a.requests,
    last_active: (a, b) => (b.last_active || '').localeCompare(a.last_active || ''),
  };
  list = [...list].sort(sorters[sort]);

  return (
    <Card
      title={`Users (${list.length})`}
      action={
        <div style={{ display: 'flex', gap: '10px' }}>
          <input value={query} onChange={e => { setQuery(e.target.value); setShown(10); }} placeholder="Search name or email" style={{ ...inputStyle, width: '240px' }} />
          <select value={filter} onChange={e => { setFilter(e.target.value); setShown(10); }} style={inputStyle}>
            <option value="all">All users</option>
            <option value="violations">With violations</option>
            <option value="admins">Admins</option>
          </select>
          <select value={sort} onChange={e => setSort(e.target.value)} style={inputStyle}>
            <option value="violations">Sort: violations</option>
            <option value="requests">Sort: requests</option>
            <option value="last_active">Sort: last active</option>
          </select>
        </div>
      }
    >
      {loading ? (
        <Loader text="Loading Users Details…" />
      ) : list.length === 0 ? (
        <Empty>No users match.</Empty>
      ) : (
        <>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={cellTh}>Email</th>
                <th style={cellTh}>Role</th>
                <th style={{ ...cellTh, textAlign: 'right' }}>Requests</th>
                <th style={{ ...cellTh, textAlign: 'right' }}>Violations</th>
                <th style={{ ...cellTh, textAlign: 'right' }}>PII</th>
                <th style={cellTh}>Top category</th>
                <th style={cellTh}>Last active</th>
              </tr>
            </thead>
            <tbody>
              {list.slice(0, shown).map(u => (
                <tr
                  key={u.user_uuid}
                  onClick={() => onOpenUser(u)}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#16213a')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={cellTd}>{u.email}</td>
                  <td style={{ ...cellTd, color: u.role === 'admin' ? C.redact : C.muted }}>{u.role}</td>
                  <td style={{ ...cellTd, textAlign: 'right' }}>{u.requests}</td>
                  <td style={{ ...cellTd, textAlign: 'right', color: u.violations > 0 ? C.block : C.muted }}>{u.violations}</td>
                  <td style={{ ...cellTd, textAlign: 'right' }}>{u.pii_detected}</td>
                  <td style={cellTd}>{u.top_category || '—'}</td>
                  <td style={{ ...cellTd, color: C.muted, whiteSpace: 'nowrap' }}>{u.last_active ? new Date(u.last_active).toLocaleString() : 'never'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {list.length > shown && (
            <div style={{ textAlign: 'center', marginTop: '14px' }}>
              <button onClick={() => setShown(shown + 10)} style={{ ...btn, background: 'transparent', color: C.accent, border: `1px solid ${C.border}` }}>
                Show 10 more ({list.length - shown} left)
              </button>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

// ---------- One user (admin) ----------

export function UserView({ authedFetch, user, onOpenEvent }) {
  const [stats, setStats] = useState(null);
  const [tokens, setTokens] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionOpen, setSessionOpen] = useState(false);

  usePoll(async (isCancelled) => {
    const [s, t] = await Promise.all([
      authedFetch(`/api/stats?user_uuid=${user.user_uuid}`),
      authedFetch(`/api/users/${user.user_uuid}/tokens`),
    ]);
    if (isCancelled()) return;
    if (s.ok) setStats(await s.json());
    if (t.ok) setTokens(await t.json());
    setLoading(false);
  }, [user.user_uuid, authedFetch]);

  if (loading && !stats) {
    return <Loader text="Loading user details from database…" />;
  }

  const d = stats?.decision_counts || {};
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={() => resetRating(authedFetch, user)} style={{ ...btn, background: 'transparent', color: C.block, border: `1px solid ${C.border}` }}>
          Reset rating
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '14px' }}>
        <Kpi label="Requests" value={stats?.total_requests ?? 0} />
        <Kpi label="Violations" value={(d.redact || 0) + (d.block || 0) + (d.deny || 0)} hint={`${d.redact || 0} redacted · ${d.block || 0} blocked · ${d.deny || 0} denied`} />
        <Kpi label="PII found" value={stats?.total_pii_detected ?? 0} />
        <Kpi label="Tokens" value={(tokens?.total_tokens ?? 0).toLocaleString()} />
        <Kpi label="Average tokens per session" value={Math.round(tokens?.average_tokens_per_session ?? 0).toLocaleString()} />
        <Kpi label="Average latency" value={`${Math.round(stats?.avg_latency_ms ?? 0)} ms`} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: sessionOpen ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) minmax(0, 1fr)', gap: '18px' }}>
        <Card title="Sessions"><SessionsView authedFetch={authedFetch} uuid={user.user_uuid} onOpenChange={setSessionOpen} /></Card>
        {!sessionOpen && <Card title="Categories found"><Bars items={Object.entries(stats?.category_counts || {}).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)} empty="No PII found for this user." /></Card>}
      </div>
      <LogsView authedFetch={authedFetch} uuid={user.user_uuid} onOpenSession={null} />
    </>
  );
}

// ---------- Overview (user) ----------

export function OverviewUser({ authedFetch, me, onOpenEvent }) {
  const uuid = me.user_uuid;
  const [mode, setMode] = useState(me.action_mode || '');
  const [hipaa, setHipaa] = useState(me.hipaa_enabled !== false);
  const [dpdp, setDpdp] = useState(me.dpdp_enabled !== false);
  const [saved, setSaved] = useState('');
  const [compSaved, setCompSaved] = useState('');
  const [copied, setCopied] = useState(false);
  const [stats, setStats] = useState(null);
  const [tokens, setTokens] = useState(null);
  const [violations, setViolations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const syncMode = async () => {
      const r = await authedFetch('/api/me');
      if (r.ok) {
        const data = await r.json();
        setMode(data.action_mode || '');
        if (data.hipaa_enabled !== undefined) setHipaa(data.hipaa_enabled);
        if (data.dpdp_enabled !== undefined) setDpdp(data.dpdp_enabled);
      }
    };
    syncMode();
  }, [authedFetch]);
  // Vite's dev server (5173) only proxies API calls for browsing the dashboard itself;
  // the real backend a chat client connects to is always on 8000 in local dev.
  // Everywhere else (Vercel, or the built dashboard served by the backend directly),
  // the page's own origin is the backend.
  const proxyBase = window.location.port === '5173' ? 'http://localhost:8000' : window.location.origin;
  const proxyUrl = `${proxyBase}/proxy/${uuid}/v1`;

  usePoll(async (isCancelled) => {
    const [s, t, q] = await Promise.all([
      authedFetch(`/api/stats?user_uuid=${uuid}`),
      authedFetch(`/api/users/${uuid}/tokens`),
      authedFetch(`/api/users/${uuid}/queries?limit=50`),
    ]);
    if (isCancelled()) return;
    if (s.ok) setStats(await s.json());
    if (t.ok) setTokens(await t.json());
    if (q.ok) setViolations((await q.json()).filter(r => r.decision !== 'allow').slice(0, 8));
    setLoading(false);
  }, [uuid, authedFetch]);

  const saveMode = async (value) => {
    setMode(value);
    const res = await authedFetch(`/api/users/${uuid}/action-mode`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: value || null }),
    });
    setSaved(res.ok ? 'Saved' : `Could not save (HTTP ${res.status})`);
    setTimeout(() => setSaved(''), 2000);
  };

  const saveCompliance = async (nextHipaa, nextDpdp) => {
    setHipaa(nextHipaa);
    setDpdp(nextDpdp);
    const res = await authedFetch(`/api/users/${uuid}/compliance`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hipaa_enabled: nextHipaa, dpdp_enabled: nextDpdp }),
    });
    setCompSaved(res.ok ? 'Saved' : `Error (HTTP ${res.status})`);
    setTimeout(() => setCompSaved(''), 2000);
  };

  if (loading && !stats) {
    return <Loader text="Loading overview metrics…" />;
  }

  const d = stats?.decision_counts || {};
  const modes = [
    ['', 'Global default'],
    ['REDACT', 'Redact: static [REDACTED] replacement'],
    ['BLOCK', 'Block: reject prompt with HTTP 400'],
    ['HASH', 'Hash: SHA-256 hash replacement'],
    ['LOG_ONLY', 'Log only: send as-is, record in audit log'],
  ];

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '14px' }}>
        <Kpi label="Requests" value={stats?.total_requests ?? 0} hint={`${d.allow || 0} allowed`} />
        <Kpi label="Violations" value={(d.redact || 0) + (d.block || 0)} hint={`${d.redact || 0} redacted · ${d.block || 0} blocked`} />
        <Kpi label="PII found" value={stats?.total_pii_detected ?? 0} />
        <Kpi label="Tokens, latest session" value={(tokens?.latest_session?.total_tokens ?? 0).toLocaleString()} hint={tokens?.latest_session ? `${tokens.latest_session.prompt_tokens} in · ${tokens.latest_session.completion_tokens} out` : undefined} />
        <Kpi label="Average tokens per session" value={Math.round(tokens?.average_tokens_per_session ?? 0).toLocaleString()} hint={`${tokens?.average_tokens_per_request ?? 0} per request`} />
        <Kpi label="Average latency" value={`${Math.round(stats?.avg_latency_ms ?? 0)} ms`} hint="per request" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.2fr)', gap: '18px', alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: '18px' }}>
          <Card title="Your proxy link" action={<button onClick={() => { navigator.clipboard.writeText(proxyUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); }} style={btn}>{copied ? '✓ Copied' : 'Copy link'}</button>}>
            <div style={{
              fontFamily: mono,
              color: C.accent,
              fontSize: '0.88rem',
              wordBreak: 'break-all',
              background: 'rgba(0, 242, 254, 0.06)',
              border: '1px solid rgba(0, 242, 254, 0.22)',
              borderRadius: '8px',
              padding: '12px 14px',
              boxShadow: 'inset 0 0 12px rgba(0, 242, 254, 0.05)',
            }}>
              {proxyUrl}
            </div>
            <div style={{ color: C.muted, fontSize: '0.82rem', marginTop: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ color: C.accent }}>⚡</span> Compatible with Cline, Cursor, Open WebUI, and LangChain OpenAI base URLs.
            </div>
          </Card>

          <Card
            title="Compliance Frameworks"
            action={
              <span style={{ color: compSaved ? C.allow : C.accent, fontSize: '0.82rem', fontWeight: 600 }}>
                {compSaved || (hipaa && dpdp ? 'Active: HIPAA + DPDP' : hipaa ? 'Active: HIPAA only' : dpdp ? 'Active: DPDP only' : 'Pass-Through (No checks)')}
              </span>
            }
          >
            <div style={{ display: 'grid', gap: '10px' }}>
              <ToggleSwitch
                checked={hipaa}
                onChange={next => saveCompliance(next, dpdp)}
                label="HIPAA Compliance (US PHI)"
                description="Enforces 18 Safe Harbor medical & patient identifiers (MRN, health plan, clinical dates, SSN...)"
                icon="🏥"
              />
              <ToggleSwitch
                checked={dpdp}
                onChange={next => saveCompliance(hipaa, next)}
                label="DPDP Compliance (India 2023)"
                description="Enforces 27 Personal Identifiers (Aadhaar, PAN, UPI, Indian mobile, PIN, salary, employee ID...)"
                icon="🇮🇳"
              />
            </div>
            <div style={{ color: C.faint, fontSize: '0.78rem', marginTop: '10px' }}>
              Toggle ON to inspect and protect against that compliance framework. When toggled OFF, those identifiers pass through unflagged.
            </div>
          </Card>

          <Card title="How PII is handled for you">
            <select value={mode} onChange={e => saveMode(e.target.value)} style={{ ...inputStyle, width: '100%' }}>
              {modes.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
            </select>
            <div style={{ color: C.allow, fontSize: '0.82rem', marginTop: '8px', minHeight: '1em' }}>{saved}</div>
            <div style={{ color: C.faint, fontSize: '0.82rem', marginTop: '6px' }}>Applies to your next request. A request can still override it with the X-Action-Mode header, if it sends one.</div>
          </Card>
        </div>

        <Card title="What happened" action={<span style={{ color: C.faint, fontSize: '0.82rem' }}>latest violations</span>}>
          {violations.length === 0 ? <Empty>No violations. Nothing was redacted or blocked.</Empty> : (
            <div style={{ display: 'grid', gap: '2px' }}>
              {violations.map(v => (
                <button
                  key={v.id}
                  onClick={() => onOpenEvent(v.id)}
                  style={{ display: 'grid', gridTemplateColumns: '150px 84px 1fr', gap: '12px', alignItems: 'center', textAlign: 'left', background: 'transparent', border: 'none', borderBottom: `1px solid ${C.border}`, padding: '11px 6px', cursor: 'pointer', color: C.text }}
                >
                  <span style={{ color: C.muted, fontSize: '0.82rem' }}>{v.created_at ? new Date(v.created_at).toLocaleString() : ''}</span>
                  <DecisionChip decision={v.decision || (v.action_mode === 'HASH' && v.decision !== 'allow' ? 'hash' : v.decision)} />
                  <span style={{ fontSize: '0.88rem' }}>
                    {v.decision === 'block' ? 'Blocked, not sent' : (v.decision === 'hash' || v.action_mode === 'HASH' ? 'Hashed' : 'Redacted')}: {(v.categories_found || []).join(', ') || 'PII'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

// ---------- Overview (admin) ----------

export function OverviewAdmin({ authedFetch, onOpenEvent, onOpenUser }) {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [attention, setAttention] = useState([]);
  const [sessionCount, setSessionCount] = useState(0);
  const [loading, setLoading] = useState(true);

  usePoll(async (isCancelled) => {
    const [s, u, a, ss] = await Promise.all([
      authedFetch('/api/stats'),
      authedFetch('/api/admin/users'),
      authedFetch('/api/admin/activity?limit=8&violations_only=true'),
      authedFetch('/api/admin/sessions'),
    ]);
    if (isCancelled()) return;
    if (s.ok) setStats(await s.json());
    if (u.ok) setUsers(await u.json());
    if (a.ok) setAttention(await a.json());
    if (ss.ok) setSessionCount((await ss.json()).length);
    setLoading(false);
  }, [authedFetch]);

  if (loading && !stats) {
    return <Loader text="Loading Overview…" />;
  }

  const d = stats?.decision_counts || {};
  const avgTokensPerSession = sessionCount ? Math.round((stats?.total_tokens || 0) / sessionCount) : 0;
  const activeCutoff = Date.now() - 24 * 3600 * 1000;
  const activeUsers = users.filter(u => u.last_active && new Date(u.last_active).getTime() >= activeCutoff).length;
  const topUsers = [...users].filter(u => u.violations > 0).sort((a, b) => b.violations - a.violations).slice(0, 5);
  const categories = Object.entries(stats?.category_counts || {}).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '14px' }}>
        <Kpi label="Requests" value={stats?.total_requests ?? 0} hint={`${d.allow || 0} allowed`} />
        <Kpi label="Violations" value={(d.redact || 0) + (d.block || 0)} hint={`${d.redact || 0} redacted · ${d.block || 0} blocked`} />
        <Kpi label="PII found" value={stats?.total_pii_detected ?? 0} />
        <Kpi label="Total tokens" value={(stats?.total_tokens ?? 0).toLocaleString()} hint={`${avgTokensPerSession.toLocaleString()} per session on average`} />
        <Kpi label="Average latency" value={`${Math.round(stats?.avg_latency_ms ?? 0)} ms`} hint="across all requests" />
        <Kpi label="Active users, 24h" value={activeUsers} hint={`${users.length} users in total`} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)', gap: '18px', alignItems: 'start' }}>
        <Card title="Needs attention" action={<span style={{ color: C.faint, fontSize: '0.82rem' }}>latest violations, all users</span>}>
          {attention.length === 0 ? <Empty>No violations yet.</Empty> : (
            <div style={{ display: 'grid', gap: '2px' }}>
              {attention.map(v => (
                <button
                  key={v.event_id}
                  onClick={() => onOpenEvent(v.event_id)}
                  style={{ display: 'grid', gridTemplateColumns: '150px 1fr 84px', gap: '12px', alignItems: 'center', textAlign: 'left', background: 'transparent', border: 'none', borderBottom: `1px solid ${C.border}`, padding: '11px 6px', cursor: 'pointer', color: C.text }}
                >
                  <span style={{ color: C.muted, fontSize: '0.82rem' }}>{v.created_at ? new Date(v.created_at).toLocaleString() : ''}</span>
                  <span style={{ fontSize: '0.88rem' }}>
                    <span style={{ color: C.text }}>{v.user_email}</span>
                    <span style={{ color: C.muted }}> · {(v.categories_found || []).join(', ') || 'PII'}</span>
                  </span>
                  <DecisionChip decision={v.decision || (v.action_mode === 'HASH' && v.decision !== 'allow' ? 'hash' : v.decision)} />
                </button>
              ))}
            </div>
          )}
        </Card>

        <div style={{ display: 'grid', gap: '18px' }}>
          <Card title="Top users by violations">
            {topUsers.length === 0 ? <Empty>No users with violations.</Empty> : (
              <div style={{ display: 'grid', gap: '2px' }}>
                {topUsers.map(u => (
                  <button
                    key={u.user_uuid}
                    onClick={() => onOpenUser(u)}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left', background: 'transparent', border: 'none', borderBottom: `1px solid ${C.border}`, padding: '10px 6px', cursor: 'pointer', color: C.text, fontSize: '0.88rem' }}
                  >
                    <span>{u.email}</span>
                    <span style={{ color: C.block, fontVariantNumeric: 'tabular-nums' }}>{u.violations}</span>
                  </button>
                ))}
              </div>
            )}
          </Card>
          <Card title="PII categories found">
            <Bars items={categories} empty="No PII found yet." />
          </Card>
        </div>
      </div>
    </>
  );
}

// ---------- Test ----------

export function TestView({ authedFetch }) {
  const [direction, setDirection] = useState('ingress');
  const [mode, setMode] = useState('REDACT');
  const [prompt, setPrompt] = useState('Patient Saurabh Shisode (DOB: 04/12/1985), email saurabh@example.com, phone 555-123-4567, id 512592');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  const sampleIngress = 'Patient Saurabh Shisode (DOB: 04/12/1985), email saurabh@example.com, phone 555-123-4567, id 512592';
  const sampleEgress = 'Based on internal context, the patient Saurabh Shisode has Aadhaar 2345 6789 0123, PAN ABCDE1234F, UPI saurabh@okaxis, and annual salary package of 24 LPA.';

  const handleDirectionChange = (nextDir) => {
    setDirection(nextDir);
    setResult(null);
    if (nextDir === 'egress' && prompt === sampleIngress) {
      setPrompt(sampleEgress);
    } else if (nextDir === 'ingress' && prompt === sampleEgress) {
      setPrompt(sampleIngress);
    }
  };

  const run = async () => {
    setBusy(true);
    try {
      const r = await authedFetch('/api/test-inspect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, mode, direction }),
      });
      setResult(await r.json());
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'grid', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
        <Segmented
          value={direction}
          onChange={handleDirectionChange}
          options={[
            ['ingress', '↓ Inbound Prompt (Ingress)'],
            ['egress', '↑ LLM Output (Egress Guardrail)'],
          ]}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '0.82rem', color: C.muted }}>Action Mode:</span>
          <select value={mode} onChange={e => setMode(e.target.value)} style={inputStyle}>
            <option value="REDACT">REDACT</option>
            <option value="BLOCK">BLOCK</option>
            <option value="HASH">HASH</option>
            <option value="LOG_ONLY">LOG_ONLY</option>
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '18px', alignItems: 'start' }}>
        <Card title={direction === 'ingress' ? 'Inbound Prompt (User Input)' : 'Simulated Model Output (LLM Completion)'}>
          <textarea value={prompt} onChange={e => setPrompt(e.target.value)} style={{ ...inputStyle, width: '100%', height: '180px', boxSizing: 'border-box', fontFamily: mono, resize: 'vertical' }} />
          <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <span style={{ color: C.faint, fontSize: '0.82rem' }}>
              {direction === 'ingress'
                ? 'Inspected before forwarding to external GPU model node.'
                : 'Inspected upon return to prevent sensitive data leakage to user.'}
            </span>
            <button onClick={run} disabled={busy} style={btn}>{busy ? 'Inspecting…' : `Check ${direction === 'ingress' ? 'prompt' : 'output'}`}</button>
          </div>
        </Card>
        <Card title={direction === 'ingress' ? 'Payload Sent to Model' : 'Delivered Output (After Guardrails)'}>
          {!result ? <Empty>Run an inspection to test compliance guardrails on {direction === 'ingress' ? 'input prompts' : 'model output'}.</Empty> : (
            <>
              <div style={{
                fontFamily: mono,
                color: result.blocked ? C.block : C.allow,
                whiteSpace: 'pre-wrap',
                fontSize: '0.92rem',
                lineHeight: 1.6,
                background: result.blocked ? 'rgba(244, 63, 94, 0.08)' : C.bg,
                border: `1px solid ${result.blocked ? 'rgba(244, 63, 94, 0.4)' : C.border}`,
                borderRadius: '8px',
                padding: '14px',
                minHeight: '90px'
              }}>
                {result.anonymized_prompt || result.error || 'No output'}
              </div>
              <div style={{ marginTop: '16px', color: C.muted, fontSize: '0.82rem', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>{(result.matches || []).length} violation(s) identified</span>
                {result.latency_ms && <span style={{ color: '#38bdf8' }}>{result.latency_ms} ms</span>}
              </div>
              {(result.matches || []).length > 0 && (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr><th style={cellTh}>Type</th><th style={cellTh}>Category</th><th style={cellTh}>Found text</th></tr></thead>
                  <tbody>
                    {result.matches.map((m, i) => (
                      <tr key={i}>
                        <td style={{ ...cellTd, fontWeight: 600, color: '#f8fafc' }}>{m.entity_type}</td>
                        <td style={cellTd}>{m.category_name}</td>
                        <td style={{ ...cellTd, fontFamily: mono, color: C.accent }}>{m.text}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

function UserPicker({ users, value, onChange }) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const current = users.find(u => u.user_uuid === value);
  const q = text.trim().toLowerCase();
  const matches = users
    .filter(u => !q || u.email.toLowerCase().includes(q) || (u.name || '').toLowerCase().includes(q))
    .slice(0, 8);
  return (
    <div style={{ position: 'relative', minWidth: '260px' }}>
      <input
        value={open ? text : (current ? current.email : text)}
        placeholder="Search user by name or email"
        autoComplete="off"
        name="inspect-user-search"
        onFocus={() => { setOpen(true); setText(''); }}
        onChange={e => { setText(e.target.value); setOpen(true); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        style={{ ...inputStyle, width: '100%' }}
      />
      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, left: 0, zIndex: 20, marginTop: '4px',
          background: '#0c1327', border: `1px solid ${C.border}`, borderRadius: '8px', maxHeight: '280px', overflowY: 'auto', boxShadow: '0 12px 32px rgba(0,0,0,0.6)',
        }}>
          {matches.length === 0 && <div style={{ padding: '10px 12px', color: C.muted, fontSize: '0.85rem' }}>No users match.</div>}
          {matches.map(u => (
            <div
              key={u.user_uuid}
              onMouseDown={e => { e.preventDefault(); onChange(u.user_uuid); setOpen(false); setText(''); }}
              style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between', gap: '12px' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#16213a')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <span>{u.email}</span>
              <span style={{ color: u.role === 'admin' ? C.redact : C.muted }}>{u.role}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

async function resetRating(authedFetch, user, onDone) {
  if (!window.confirm(`Reset rating for ${user.email}?\n\nHistory is kept. Violations, trust and effective-use will count only from now on.`)) return;
  const r = await authedFetch(`/api/admin/users/${user.user_uuid}/reset-rating`, { method: 'POST' });
  if (r.ok) onDone && onDone();
  else window.alert('Reset failed');
}

export function TrustAnalyticsView({ authedFetch, me, isAdmin, initialUuid }) {
  const [selectedUuid, setSelectedUuid] = useState(initialUuid || me?.user_uuid || '');
  const [data, setData] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (isAdmin) {
      authedFetch('/api/admin/users')
        .then(r => r.ok && r.json())
        .then(u => {
          if (Array.isArray(u)) setUsers(u);
        })
        .catch(() => {});
    }
  }, [isAdmin, authedFetch]);

  useEffect(() => {
    const uuid = selectedUuid || me?.user_uuid;
    if (!uuid) return;
    let active = true;
    setLoading(true);
    authedFetch(`/api/users/${uuid}/trust-analytics`)
      .then(r => r.ok && r.json())
      .then(res => {
        if (active && res) {
          setData(res);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [selectedUuid, me?.user_uuid, authedFetch, reloadKey]);

  const tokens = data?.tokens || {};
  const metrics = data?.metrics || {};

  const totalTokens = tokens.total_tokens || 0;
  const promptTokens = tokens.prompt_tokens || 0;
  const completionTokens = tokens.completion_tokens || 0;
  const cleanTokens = tokens.clean_tokens || 0;
  const violationTokens = tokens.violation_tokens || 0;
  const avgTokens = tokens.avg_tokens_per_request || 0;
  const modelUsage = tokens.model_usage || {};

  const totalRequests = metrics.total_requests || 0;
  const cleanRequests = metrics.clean_requests || 0;
  const redactedRequests = metrics.redacted_requests || 0;
  const blockedRequests = metrics.blocked_requests || 0;
  const totalViolations = metrics.total_violations || 0;
  const violationFreq = metrics.violation_frequency_pct || 0;
  const effectiveUse = metrics.effective_use_score ?? null;
  const authorityTrust = metrics.authority_trust_score ?? 0;
  const composite = metrics.composite_rating ?? authorityTrust;
  const trustTier = metrics.trust_tier || 'Tier 2: Trusted Operator';
  const trustColor = metrics.trust_color || '#00f2fe';

  const promptPct = totalTokens > 0 ? Math.round((promptTokens / totalTokens) * 100) : 0;
  const complPct = totalTokens > 0 ? (100 - promptPct) : 0;

  return (
    <div style={{ display: 'grid', gap: '22px' }}>
      {/* User Selection & Identity Strip */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '14px',
        padding: '14px 20px',
        background: 'rgba(12, 19, 39, 0.75)',
        border: `1px solid ${C.border}`,
        borderRadius: '12px',
        backdropFilter: 'blur(16px)',
        position: 'relative',
        zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            background: `linear-gradient(135deg, ${trustColor}44, #a855f744)`,
            border: `1px solid ${trustColor}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.25rem',
            boxShadow: `0 0 16px ${trustColor}33`,
          }}>
            🛡️
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontWeight: 700, fontSize: '1.05rem', color: '#f8fafc' }}>
                {data?.email || me?.email || 'User'}
              </span>
              <span style={{
                fontSize: '0.72rem',
                padding: '2px 8px',
                borderRadius: '6px',
                background: 'rgba(0, 242, 254, 0.12)',
                color: '#00f2fe',
                border: '1px solid rgba(0, 242, 254, 0.3)',
                fontWeight: 600,
                textTransform: 'uppercase',
              }}>
                {data?.role || me?.role || 'user'}
              </span>
              <span style={{
                fontSize: '0.72rem',
                padding: '2px 8px',
                borderRadius: '6px',
                background: 'rgba(168, 85, 247, 0.12)',
                color: '#c084fc',
                border: '1px solid rgba(168, 85, 247, 0.3)',
                fontWeight: 600,
              }}>
                MODE: {data?.action_mode || me?.action_mode || 'DEFAULT'}
              </span>
            </div>
            <div style={{ fontSize: '0.78rem', color: C.faint, fontFamily: mono, marginTop: '2px' }}>
              UUID: {selectedUuid || me?.user_uuid}
            </div>
          </div>
        </div>

        {isAdmin && users.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '0.82rem', color: C.muted }}>Inspect User:</span>
            <UserPicker users={users} value={selectedUuid} onChange={setSelectedUuid} />
          </div>
        )}
      </div>

      {!loading && data && (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '12px 18px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: '12px' }}>
          <div style={{ fontSize: '0.88rem', color: C.muted }}>
            Composite rating{' '}
            <b style={{ color: trustColor, fontFamily: mono, fontSize: '1.1rem' }}>{metrics.composite_rating ?? '—'}</b> / 100
            <span style={{ marginLeft: '10px', color: C.faint }}>
              = 40% authority-trust + 30% (100 − smoothed violation %) + 30% effective use · redaction counts half, block/deny full, 5 virtual clean requests smooth small samples
              {metrics.rating_since ? ` · counted since ${new Date(metrics.rating_since).toLocaleString()}` : ' · all history'}
            </span>
          </div>
          {isAdmin && (
            <button onClick={() => resetRating(authedFetch, { user_uuid: selectedUuid || me?.user_uuid, email: data.email }, () => setReloadKey(k => k + 1))}
              style={{ ...btn, background: 'transparent', color: C.block, border: `1px solid ${C.border}` }}>
              Reset rating
            </button>
          )}
        </div>
      )}

      {loading ? (
        <Loader text="Calculating token metrics & authority-trust matrix…" />
      ) : (
        <>
          {/* Top 4 Cyber KPI Tiles */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
            {/* 1. Authority-Trust Score */}
            <div style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: '14px',
              padding: '20px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
              backdropFilter: 'blur(16px)',
              position: 'relative',
              overflow: 'hidden',
            }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: `linear-gradient(90deg, ${trustColor}, #a855f7)` }} />
              <div style={{ color: C.muted, fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Overall Rating
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', margin: '12px 0 8px 0' }}>
                <span style={{ fontSize: '2.1rem', fontWeight: 800, color: trustColor, fontFamily: mono }}>
                  {composite}
                </span>
                <span style={{ fontSize: '1rem', color: C.faint }}>/ 100</span>
              </div>
              {/* Trust Tier Badge */}
              <div style={{
                display: 'inline-block',
                padding: '3px 10px',
                borderRadius: '8px',
                fontSize: '0.78rem',
                fontWeight: 700,
                color: trustColor,
                background: `${trustColor}18`,
                border: `1px solid ${trustColor}55`,
                marginBottom: '10px',
              }}>
                {trustTier}
              </div>
              {/* Score bar */}
              <div style={{ width: '100%', height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(100, Math.max(0, authorityTrust))}%`, height: '100%', background: `linear-gradient(90deg, #f43f5e, #f59e0b 50%, ${trustColor} 85%)` }} />
              </div>
              <div style={{ fontSize: '0.74rem', color: C.faint, marginTop: '8px' }}>
                Authority-trust {authorityTrust} · violations {violationFreq}% · effective use {effectiveUse == null ? 'n/a' : `${effectiveUse}%`}
              </div>
            </div>

            {/* 2. Violation Frequency */}
            <div style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: '14px',
              padding: '20px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
              backdropFilter: 'blur(16px)',
              position: 'relative',
              overflow: 'hidden',
            }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg, #f43f5e, #f59e0b)' }} />
              <div style={{ color: C.muted, fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Violation Frequency
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', margin: '12px 0 8px 0' }}>
                <span style={{ fontSize: '2.1rem', fontWeight: 800, color: totalViolations > 0 ? '#f43f5e' : '#10b981', fontFamily: mono }}>
                  {violationFreq}%
                </span>
                <span style={{ fontSize: '0.85rem', color: C.faint }}>breach rate</span>
              </div>
              <div style={{ fontSize: '0.82rem', color: '#f8fafc', marginBottom: '8px' }}>
                {totalViolations} violations across {totalRequests} requests
              </div>
              {/* Ratio bar */}
              <div style={{ width: '100%', height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden', display: 'flex' }}>
                <div style={{ width: `${totalRequests > 0 ? (cleanRequests / totalRequests) * 100 : 100}%`, height: '100%', background: '#10b981' }} title={`Clean: ${cleanRequests}`} />
                <div style={{ width: `${totalRequests > 0 ? (redactedRequests / totalRequests) * 100 : 0}%`, height: '100%', background: '#f59e0b' }} title={`Redacted: ${redactedRequests}`} />
                <div style={{ width: `${totalRequests > 0 ? (blockedRequests / totalRequests) * 100 : 0}%`, height: '100%', background: '#f43f5e' }} title={`Blocked: ${blockedRequests}`} />
              </div>
              <div style={{ fontSize: '0.74rem', color: C.faint, marginTop: '8px' }}>
                {cleanRequests} clean · {redactedRequests} redacted · {blockedRequests} blocked
              </div>
            </div>

            {/* 3. Effective-Use Score */}
            <div style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: '14px',
              padding: '20px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
              backdropFilter: 'blur(16px)',
              position: 'relative',
              overflow: 'hidden',
            }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg, #00f2fe, #10b981)' }} />
              <div style={{ color: C.muted, fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Effective-Use Score
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', margin: '12px 0 8px 0' }}>
                <span style={{ fontSize: '2.1rem', fontWeight: 800, color: '#00f2fe', fontFamily: mono }}>
                  {effectiveUse == null ? 'n/a' : `${effectiveUse}%`}
                </span>
                <span style={{ fontSize: '0.85rem', color: C.faint }}>efficiency</span>
              </div>
              <div style={{ fontSize: '0.82rem', color: '#f8fafc', marginBottom: '8px' }}>
                Share of tokens spent on clean requests (n/a until token data exists)
              </div>
              {/* Effective bar */}
              <div style={{ width: '100%', height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(100, Math.max(0, effectiveUse ?? 0))}%`, height: '100%', background: 'linear-gradient(90deg, #38bdf8, #00f2fe)' }} />
              </div>
              <div style={{ fontSize: '0.74rem', color: C.faint, marginTop: '8px' }}>
                Evaluates prompt utility vs breach remediation waste
              </div>
            </div>

            {/* 4. Token Usage Tracking */}
            <div style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: '14px',
              padding: '20px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
              backdropFilter: 'blur(16px)',
              position: 'relative',
              overflow: 'hidden',
            }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg, #a855f7, #ec4899)' }} />
              <div style={{ color: C.muted, fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Total Tokens Tracked
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', margin: '12px 0 8px 0' }}>
                <span style={{ fontSize: '2.1rem', fontWeight: 800, color: '#f8fafc', fontFamily: mono }}>
                  {totalTokens.toLocaleString()}
                </span>
                <span style={{ fontSize: '0.85rem', color: C.faint }}>tokens</span>
              </div>
              <div style={{ fontSize: '0.82rem', color: '#f8fafc', marginBottom: '8px' }}>
                {promptTokens.toLocaleString()} prompt · {completionTokens.toLocaleString()} completion
              </div>
              {/* Token split bar */}
              <div style={{ width: '100%', height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden', display: 'flex' }}>
                <div style={{ width: `${promptPct}%`, height: '100%', background: '#00f2fe' }} title={`Prompt: ${promptTokens}`} />
                <div style={{ width: `${complPct}%`, height: '100%', background: '#a855f7' }} title={`Completion: ${completionTokens}`} />
              </div>
              <div style={{ fontSize: '0.74rem', color: C.faint, marginTop: '8px' }}>
                Avg {avgTokens} tokens per request across all sessions
              </div>
            </div>
          </div>

          {/* Deep-Dive Grid: Token Tracking by Model & Compliance Matrix */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '18px' }}>
            {/* Card 1: Per-User Token Tracking Across Requests & Models */}
            <Card title="Token Usage Tracking Across All Requests">
              <div style={{ display: 'grid', gap: '16px' }}>
                {/* Visual split box */}
                <div style={{
                  padding: '16px',
                  background: 'rgba(6, 10, 24, 0.7)',
                  border: `1px solid ${C.border}`,
                  borderRadius: '10px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.85rem' }}>
                    <span style={{ color: '#00f2fe', fontWeight: 600 }}>Prompt Tokens: {promptTokens.toLocaleString()} ({promptPct}%)</span>
                    <span style={{ color: '#a855f7', fontWeight: 600 }}>Completion Tokens: {completionTokens.toLocaleString()} ({complPct}%)</span>
                  </div>
                  <div style={{ width: '100%', height: '12px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', overflow: 'hidden', display: 'flex' }}>
                    <div style={{ width: `${promptPct}%`, height: '100%', background: 'linear-gradient(90deg, #00f2fe, #38bdf8)' }} />
                    <div style={{ width: `${complPct}%`, height: '100%', background: 'linear-gradient(90deg, #a855f7, #c084fc)' }} />
                  </div>
                </div>

                {/* Clean Tokens vs Violation Tokens */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '12px',
                }}>
                  <div style={{
                    padding: '14px',
                    borderRadius: '10px',
                    background: 'rgba(16, 185, 129, 0.08)',
                    border: '1px solid rgba(16, 185, 129, 0.25)',
                  }}>
                    <div style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600, textTransform: 'uppercase' }}>Clean Tokens</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f8fafc', fontFamily: mono, marginTop: '4px' }}>
                      {cleanTokens.toLocaleString()}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: C.faint, marginTop: '2px' }}>Zero-breach requests</div>
                  </div>
                  <div style={{
                    padding: '14px',
                    borderRadius: '10px',
                    background: 'rgba(244, 63, 94, 0.08)',
                    border: '1px solid rgba(244, 63, 94, 0.25)',
                  }}>
                    <div style={{ fontSize: '0.75rem', color: '#f43f5e', fontWeight: 600, textTransform: 'uppercase' }}>Remediated Tokens</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f8fafc', fontFamily: mono, marginTop: '4px' }}>
                      {violationTokens.toLocaleString()}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: C.faint, marginTop: '2px' }}>Redacted/intercepted</div>
                  </div>
                </div>

                {/* Model Breakdown */}
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f8fafc', marginBottom: '8px' }}>
                    Token Consumption by Model
                  </div>
                  {Object.keys(modelUsage).length === 0 ? (
                    <Empty>No model telemetry recorded yet.</Empty>
                  ) : (
                    <div style={{ display: 'grid', gap: '8px' }}>
                      {Object.entries(modelUsage).map(([mName, mTokens]) => {
                        const mPct = totalTokens > 0 ? Math.round((mTokens / totalTokens) * 100) : 0;
                        return (
                          <div key={mName} style={{
                            padding: '10px 14px',
                            background: 'rgba(6, 10, 24, 0.6)',
                            border: `1px solid ${C.border}`,
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span style={{ fontFamily: mono, fontSize: '0.88rem', color: '#00f2fe', fontWeight: 600 }}>
                                {mName}
                              </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                              <span style={{ fontSize: '0.85rem', fontFamily: mono, color: '#f8fafc' }}>
                                {mTokens.toLocaleString()} tokens
                              </span>
                              <span style={{
                                fontSize: '0.75rem',
                                color: '#c084fc',
                                background: 'rgba(168, 85, 247, 0.15)',
                                padding: '2px 8px',
                                borderRadius: '6px',
                                fontWeight: 600,
                              }}>
                                {mPct}%
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </Card>

            {/* Card 2: Authority-Trust & Risk Matrix */}
            <Card title="Authority-Trust & Risk Evaluation Matrix">
              <div style={{ display: 'grid', gap: '16px' }}>
                {/* Trust Status Callout */}
                <div style={{
                  padding: '16px',
                  borderRadius: '12px',
                  background: `linear-gradient(135deg, ${trustColor}12 0%, rgba(6, 10, 24, 0.8) 100%)`,
                  border: `1px solid ${trustColor}55`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                }}>
                  <div style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: '10px',
                    background: `${trustColor}22`,
                    border: `1px solid ${trustColor}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.4rem',
                    flex: 'none',
                  }}>
                    ⚡
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.98rem', color: trustColor }}>
                      {trustTier}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: C.muted, marginTop: '2px', lineHeight: 1.5 }}>
                      Rating from {totalRequests} request(s): violations (redact, block, deny), weakest-agent authority per session, and token purity.
                    </div>
                  </div>
                </div>

                {/* Score breakdown metrics */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', textAlign: 'center' }}>
                  <div style={{ padding: '12px', background: 'rgba(6, 10, 24, 0.6)', border: `1px solid ${C.border}`, borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.72rem', color: C.muted }}>COMPLIANCE RATE</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#10b981', fontFamily: mono, marginTop: '4px' }}>
                      {metrics.compliance_rate_pct || 0}%
                    </div>
                  </div>
                  <div style={{ padding: '12px', background: 'rgba(6, 10, 24, 0.6)', border: `1px solid ${C.border}`, borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.72rem', color: C.muted }}>TOTAL REQUESTS</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f8fafc', fontFamily: mono, marginTop: '4px' }}>
                      {totalRequests}
                    </div>
                  </div>
                  <div style={{ padding: '12px', background: 'rgba(6, 10, 24, 0.6)', border: `1px solid ${C.border}`, borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.72rem', color: C.muted }}>INTERCEPTIONS</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: totalViolations > 0 ? '#f43f5e' : '#10b981', fontFamily: mono, marginTop: '4px' }}>
                      {totalViolations}
                    </div>
                  </div>
                </div>

                {/* Trust Tier Scale Reference */}
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#94a3b8', marginBottom: '8px' }}>
                    TRUST TIER REFERENCE BENCHMARK
                  </div>
                  <div style={{ display: 'grid', gap: '6px', fontSize: '0.78rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', borderRadius: '6px', background: authorityTrust >= 88 ? 'rgba(16, 185, 129, 0.15)' : 'transparent', color: '#10b981' }}>
                      <span>Tier 1: High Authority (Zero Risk)</span>
                      <span style={{ fontFamily: mono, fontWeight: 700 }}>88 – 100</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', borderRadius: '6px', background: authorityTrust >= 70 && authorityTrust < 88 ? 'rgba(0, 242, 254, 0.15)' : 'transparent', color: '#00f2fe' }}>
                      <span>Tier 2: Trusted Operator</span>
                      <span style={{ fontFamily: mono, fontWeight: 700 }}>70 – 87</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', borderRadius: '6px', background: authorityTrust >= 50 && authorityTrust < 70 ? 'rgba(245, 158, 11, 0.15)' : 'transparent', color: '#f59e0b' }}>
                      <span>Tier 3: Moderate Trust (Monitored)</span>
                      <span style={{ fontFamily: mono, fontWeight: 700 }}>50 – 69</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', borderRadius: '6px', background: authorityTrust < 50 ? 'rgba(244, 63, 94, 0.15)' : 'transparent', color: '#f43f5e' }}>
                      <span>Tier 4: Restricted (High Risk)</span>
                      <span style={{ fontFamily: mono, fontWeight: 700 }}>&lt; 50</span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

