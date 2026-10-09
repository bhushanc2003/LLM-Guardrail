import React, { useState, useEffect, useCallback } from 'react';
import { ClerkProvider, SignedIn, SignedOut, SignInButton, SignUpButton, UserButton, useAuth, useUser } from '@clerk/clerk-react';
import Shell from './Shell.jsx';
import { Loader3D, C, mono } from './ui.jsx';
import { OverviewAdmin, OverviewUser, LogsView, SessionsView, UsersView, UserView, TestView, TrustAnalyticsView, AdminActivityUserList, Segmented } from './views.jsx';

const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || "pk_test_ZHJpdmVuLWNsYW0tOTMwNi5jbGVyay5hY2NvdW50cy5kZXYk";

function LandingPage() {
  return (
    <div style={{ background: '#060913', minHeight: '100vh', color: '#f8fafc', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '1200px', margin: '0 auto', padding: '20px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'linear-gradient(135deg, #00f2fe, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem' }}>
            🛡️
          </div>
          <div>
            <h1 style={{ fontSize: '1.5rem', margin: 0, background: 'linear-gradient(to right, #fff, #38bdf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              PII Governance Platform
            </h1>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: 0 }}>HIPAA Safe Harbor & DPDP Execution Engine</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <SignInButton mode="modal">
            <button style={{ background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', padding: '8px 18px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>
              Sign In
            </button>
          </SignInButton>
          <SignUpButton mode="modal">
            <button style={{ background: 'linear-gradient(135deg, #00f2fe, #7f00ff)', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
              Get Started / Sign Up
            </button>
          </SignUpButton>
        </div>
      </header>

      <section style={{ maxWidth: '900px', margin: '60px auto 40px auto', textAlign: 'center', padding: '0 20px' }}>
        <h1 style={{ fontSize: '3rem', fontWeight: '800', lineHeight: 1.15, marginBottom: '20px', background: 'linear-gradient(to right, #ffffff, #93c5fd, #c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          HIPAA & DPDP Compliance Execution Engine for AI Agents
        </h1>
        <p style={{ fontSize: '1.1rem', color: '#94a3b8', maxWidth: '750px', margin: '0 auto 30px auto', lineHeight: 1.6 }}>
          Intercept, anonymize, and audit LLM prompts in real-time before sensitive data reaches external GPU nodes.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '15px' }}>
          <SignUpButton mode="modal">
            <button style={{ background: 'linear-gradient(135deg, #00f2fe, #7f00ff)', color: '#fff', border: 'none', padding: '14px 28px', borderRadius: '10px', fontSize: '1.05rem', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 20px rgba(0,242,254,0.3)' }}>
              Sign Up & Get Your Proxy Link
            </button>
          </SignUpButton>
          <SignInButton mode="modal">
            <button style={{ background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', padding: '14px 24px', borderRadius: '10px', fontSize: '1rem', fontWeight: '600', cursor: 'pointer' }}>
              Sign In
            </button>
          </SignInButton>
        </div>
      </section>
    </div>
  );
}

function parseUrl(path, searchStr) {
  const search = new URLSearchParams(searchStr);
  const scope = search.get('scope') || 'all';
  const view = search.get('view') || 'sessions';
  const event = search.get('event') || null;
  const session = search.get('session') ? { session_id: search.get('session'), external_id: search.get('session') } : null;
  const user_uuid = search.get('user_uuid') || null;
  const user_email = search.get('user_email') || null;

  if (path.startsWith('/activity')) {
    return { page: 'activity', params: { view, scope, event, session, user_uuid, user_email } };
  } else if (path.startsWith('/users')) {
    return { page: 'users', params: {} };
  } else if (path.startsWith('/trust')) {
    return { page: 'trust', params: {} };
  } else if (path.startsWith('/test')) {
    return { page: 'test', params: {} };
  }
  return { page: 'overview', params: { scope } };
}

function navToUrl(page, params = {}) {
  const search = new URLSearchParams();
  if (params.scope && params.scope !== 'all') search.set('scope', params.scope);
  if (params.view && params.view !== 'sessions') search.set('view', params.view);
  if (params.event) search.set('event', params.event);
  if (params.session?.session_id) search.set('session', params.session.session_id);
  if (params.user_uuid) search.set('user_uuid', params.user_uuid);
  if (params.user_email) search.set('user_email', params.user_email);

  const query = search.toString() ? `?${search.toString()}` : '';
  if (page === 'activity') return `/activity${query}`;
  if (page === 'users') return `/users${query}`;
  if (page === 'user') return `/users${query}`;
  if (page === 'trust') return `/trust${query}`;
  if (page === 'test') return `/test${query}`;
  return `/overview${query}`;
}

function Dashboard() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const [me, setMe] = useState(undefined);
  const [nav, setNav] = useState(() => parseUrl(window.location.pathname, window.location.search));

  const authedFetch = useCallback(async (url, options = {}) => {
    const token = await getToken();
    return fetch(url, { ...options, headers: { ...(options.headers || {}), Authorization: `Bearer ${token}` } });
  }, [getToken]);

  useEffect(() => {
    const handlePopState = () => {
      setNav(parseUrl(window.location.pathname, window.location.search));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        await authedFetch('/api/users/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clerk_user_id: user.id,
            email: user.primaryEmailAddress?.emailAddress || '',
            name: user.fullName || 'User',
          }),
        });
        const res = await authedFetch('/api/me');
        setMe(res.ok ? await res.json() : null);
      } catch (e) {
        setMe(null);
      }
    };
    load();
  }, [user, authedFetch]);

  const go = (page, params = {}) => {
    const url = navToUrl(page, params);
    if (window.location.pathname + window.location.search !== url) {
      window.history.pushState(null, '', url);
    }
    setNav({ page, params });
  };

  if (me === undefined) {
    return <Loader3D />;
  }
  if (me === null) {
    return <div style={{ color: '#f87171', padding: '40px', fontFamily: 'system-ui, sans-serif', background: '#0b1020', minHeight: '100vh' }}>Could not load your account. Refresh to try again.</div>;
  }

  const isAdmin = me.role === 'admin';
  const items = isAdmin
    ? [
        { key: 'overview', label: 'Overview' },
        { key: 'activity', label: 'Activity' },
        { key: 'trust', label: 'Trust & Tokens' },
        { key: 'users', label: 'Users' },
        { key: 'test', label: 'Test' },
      ]
    : [
        { key: 'overview', label: 'Overview' },
        { key: 'activity', label: 'Activity' },
        { key: 'trust', label: 'Trust & Tokens' },
        { key: 'test', label: 'Test' },
      ];

  const scope = nav.params.scope || 'all';
  const view = nav.params.view || 'sessions';
  const showMe = !isAdmin || scope === 'me';
  const selectedUserEmail = nav.params.user_email || (nav.params.user_uuid === 'all' ? 'All Users (System-wide)' : null);

  const titles = {
    overview: 'Overview',
    activity: isAdmin && !nav.params.user_uuid
      ? 'Activity Logs · Users'
      : (selectedUserEmail ? `${selectedUserEmail} · Activity` : (view === 'sessions' ? 'Sessions' : 'Requests')),
    trust: 'Trust & Token Analytics',
    users: 'Users',
    user: nav.params.user?.email || 'User',
    test: 'Test a prompt',
  };
  const subtitles = {
    overview: isAdmin && !showMe ? 'System-wide activity' : 'Your activity and how PII is handled',
    activity: isAdmin && !nav.params.user_uuid
      ? 'Select a user below to inspect their session history and request logs'
      : (view === 'sessions' ? 'Tasks and conversations for this user' : 'Every request with decision, PII findings, and latency'),
    trust: 'Per-user token usage tracking across all requests, authority-trust, violation frequency, effective-use score',
    users: 'Search and open a user',
    user: 'Sessions, logs and categories for this user',
    test: 'Check a prompt without sending it to the model',
  };

  const openEvent = id => go('activity', { view: 'requests', event: id, user_uuid: nav.params.user_uuid, user_email: nav.params.user_email });
  const openSession = (id, name) => go('activity', { view: 'sessions', session: { session_id: id, external_id: name || id }, user_uuid: nav.params.user_uuid, user_email: nav.params.user_email });

  let header = null;
  let content;
  if (nav.page === 'overview') {
    if (isAdmin) {
      header = <Segmented value={scope} onChange={v => go('overview', { scope: v })} options={[['all', 'All users'], ['me', 'Me']]} />;
    }
    content = showMe
      ? <OverviewUser authedFetch={authedFetch} me={me} onOpenEvent={openEvent} />
      : <OverviewAdmin authedFetch={authedFetch} onOpenEvent={openEvent} onOpenUser={u => go('user', { user: u })} />;
  } else if (nav.page === 'activity') {
    if (isAdmin && !nav.params.user_uuid) {
      header = null;
      content = (
        <AdminActivityUserList
          authedFetch={authedFetch}
          onSelectUser={u => go('activity', { user_uuid: u.user_uuid, user_email: u.email, view: 'sessions' })}
          onSelectAll={() => go('activity', { user_uuid: 'all', user_email: 'All Users (System-wide)', view: 'sessions' })}
        />
      );
    } else {
      const isSpecificAdminUser = isAdmin && nav.params.user_uuid;
      const targetUuid = isSpecificAdminUser
        ? (nav.params.user_uuid === 'all' ? null : nav.params.user_uuid)
        : (showMe ? me.user_uuid : null);

      header = (
        <div style={{ display: 'grid', gap: '12px', width: '100%' }}>
          {isSpecificAdminUser && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <button
                onClick={() => go('activity', { user_uuid: null, user_email: null, view: 'sessions' })}
                style={{
                  background: 'rgba(0, 242, 254, 0.08)',
                  border: `1px solid rgba(0, 242, 254, 0.3)`,
                  color: '#00f2fe',
                  padding: '7px 16px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease',
                }}
              >
                ← Back to Users
              </button>
              <div style={{
                padding: '6px 14px',
                borderRadius: '8px',
                background: 'rgba(12, 19, 39, 0.8)',
                border: `1px solid ${C.border}`,
                fontSize: '0.86rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                <span style={{ color: '#00f2fe', fontWeight: 700 }}>
                  👤 {nav.params.user_email || nav.params.user_uuid}
                </span>
                {nav.params.user_uuid !== 'all' && (
                  <span style={{ color: C.faint, fontSize: '0.76rem', fontFamily: mono }}>
                    ({nav.params.user_uuid})
                  </span>
                )}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Segmented
              value={view}
              onChange={v => go('activity', {
                view: v,
                scope: nav.params.scope,
                user_uuid: nav.params.user_uuid,
                user_email: nav.params.user_email,
              })}
              options={[['sessions', 'Sessions'], ['requests', 'Requests']]}
            />
          </div>
        </div>
      );

      content = view === 'sessions'
        ? <SessionsView authedFetch={authedFetch} uuid={targetUuid} showUser={targetUuid === null} initialSession={nav.params.session || null} title="Sessions" />
        : <LogsView authedFetch={authedFetch} uuid={targetUuid} initialEvent={nav.params.event || null} onOpenSession={openSession} title="Requests" />;
    }
  } else if (nav.page === 'trust') {
    content = <TrustAnalyticsView authedFetch={authedFetch} me={me} isAdmin={isAdmin} initialUuid={nav.params.user_uuid || null} />;
  } else if (nav.page === 'users' && isAdmin) {
    content = <UsersView authedFetch={authedFetch} onOpenUser={u => go('user', { user: u })} />;
  } else if (nav.page === 'user' && isAdmin && nav.params.user) {
    content = <UserView authedFetch={authedFetch} user={nav.params.user} />;
  } else if (nav.page === 'test') {
    content = <TestView authedFetch={authedFetch} />;
  } else {
    content = <OverviewUser authedFetch={authedFetch} me={me} onOpenEvent={openEvent} />;
  }

  const activeKey = nav.page === 'user' ? 'users' : nav.page;
  return (
    <Shell
      items={items}
      active={activeKey}
      onNav={key => go(key)}
      title={titles[nav.page] || titles.overview}
      subtitle={subtitles[nav.page] || subtitles.overview}
      userButton={<UserButton showName />}
    >
      {header}
      {content}
    </Shell>
  );
}

export default function App() {
  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
      <SignedOut>
        <LandingPage />
      </SignedOut>
      <SignedIn>
        <Dashboard />
      </SignedIn>
    </ClerkProvider>
  );
}
