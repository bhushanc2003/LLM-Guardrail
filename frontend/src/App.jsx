import React, { useState, useEffect, useCallback } from 'react';
import { ClerkProvider, SignedIn, SignedOut, SignInButton, SignUpButton, UserButton, useAuth, useUser } from '@clerk/clerk-react';
import Shell from './Shell.jsx';
import { Loader3D, C, mono, IconShield, IconUser, AdrishyaLogo } from './ui.jsx';
import { OverviewAdmin, OverviewUser, LogsView, SessionsView, UsersView, UserView, TestView, TrustAnalyticsView, AdminActivityUserList, Segmented } from './views.jsx';

const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || "pk_test_ZHJpdmVuLWNsYW0tOTMwNi5jbGVyay5hY2NvdW50cy5kZXYk";

// High-Tech Cyber & DevSecOps SVG Micro-Icons (All standardized with checkmark shield logo)
const Icons = {
  Shield: ({ size = 22, color = 'currentColor', strokeWidth = 2.2, style = {} }) => (
    <IconShield size={size} color={color} strokeWidth={strokeWidth} style={style} />
  ),
  Lock: ({ size = 18, color = '#10b981', style = {} }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      <circle cx="12" cy="16" r="1.5" fill={color} />
    </svg>
  ),
  Bolt: ({ size = 18, color = '#00f2fe', style = {} }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill={`${color}22`} />
    </svg>
  ),
  Pulse: ({ size = 18, color = '#ec4899', style = {} }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  ),
  Card: ({ size = 18, color = '#f59e0b', style = {} }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
      <rect x="5" y="14" width="4" height="2" fill={color} />
    </svg>
  ),
  Globe: ({ size = 18, color = '#38bdf8', style = {} }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  ),
  EyeScan: ({ size = 22, color = '#a855f7', style = {} }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={style}>
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" fill={`${color}33`} />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </svg>
  ),
  Terminal: ({ size = 18, color = '#00f2fe', style = {} }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  ),
  Analytics: ({ size = 22, color = '#10b981', style = {} }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
      <path d="M2 20h20" />
    </svg>
  ),
  Layers: ({ size = 22, color = '#38bdf8', style = {} }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={style}>
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  ),
  Sparkle: ({ size = 16, color = '#00f2fe', style = {} }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={style}>
      <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
    </svg>
  ),
  Copy: ({ size = 15, color = 'currentColor', style = {} }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  ),
  Check: ({ size = 15, color = '#10b981', style = {} }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={style}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  ArrowRight: ({ size = 16, color = 'currentColor', style = {} }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={style}>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  ),
};

// 3D Isometric Wireframe Cube Component with White Lines
function WireframeCube({ size = 80, x = '10%', y = '20%', rotSpeed = '16s', delay = '0s', opacity = 0.85 }) {
  const half = size / 2;
  return (
    <div style={{
      position: 'absolute',
      left: x,
      top: y,
      width: `${size}px`,
      height: `${size}px`,
      perspective: '1000px',
      transformStyle: 'preserve-3d',
      pointerEvents: 'none',
      opacity,
      animation: `floatCube ${rotSpeed} ease-in-out infinite alternate ${delay}`,
    }}>
      <div style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        transformStyle: 'preserve-3d',
        animation: `spin3dCube ${rotSpeed} linear infinite ${delay}`,
      }}>
        {/* 6 Faces with White Lines Borders and Cyber Highlights */}
        {[
          { transform: `translateZ(${half}px)` },
          { transform: `rotateY(180deg) translateZ(${half}px)` },
          { transform: `rotateY(90deg) translateZ(${half}px)` },
          { transform: `rotateY(-90deg) translateZ(${half}px)` },
          { transform: `rotateX(90deg) translateZ(${half}px)` },
          { transform: `rotateX(-90deg) translateZ(${half}px)` },
        ].map((face, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              inset: 0,
              border: '1.5px solid rgba(255, 255, 255, 0.45)',
              background: 'linear-gradient(135deg, rgba(0, 242, 254, 0.08) 0%, rgba(168, 85, 247, 0.04) 100%)',
              boxShadow: 'inset 0 0 18px rgba(0, 242, 254, 0.15)',
              backdropFilter: 'blur(4px)',
              ...face,
            }}
          >
            {/* Inner Diagonal White Cross-Lines */}
            <div style={{
              position: 'absolute',
              inset: '6px',
              border: '1px dashed rgba(255, 255, 255, 0.22)',
            }} />
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: '#00f2fe',
              transform: 'translate(-50%, -50%)',
              boxShadow: '0 0 8px #00f2fe',
            }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function LandingPage() {
  const [activeTab, setActiveTab] = useState('healthcare');
  const [copied, setCopied] = useState(false);

  const presets = {
    healthcare: {
      badge: 'HIPAA Safe Harbor PHI Engine',
      icon: <Icons.Pulse size={14} color="#ec4899" />,
      title: 'Healthcare EHR & Clinical Consultation',
      ingress: 'Summarize clinical chart for Dr. Robert Chen: Patient Jane Doe (DOB: 08/23/1984, MRN-4820194, Insurance ID: HICN-9948201) presented with persistent cough and fever.',
      entities: [
        { label: 'NAME: Jane Doe', color: '#f59e0b' },
        { label: 'DOB: 08/23/1984', color: '#ec4899' },
        { label: 'MRN: MRN-4820194', color: '#00f2fe' },
        { label: 'POLICY: HICN-9948201', color: '#a855f7' },
      ],
      sanitized: 'Summarize clinical chart for [HASH:9f8e12a0]: Patient [HASH:4b8921df] (DOB: [HASH:b4d82f11], MRN: [HASH:77a091c2], Insurance ID: [HASH:83ca9104]) presented with persistent cough and fever.',
      egress: 'Clinical Summary: Patient [HASH:4b8921df] evaluated by [HASH:9f8e12a0]. Symptoms indicate upper respiratory infection. Treatment plan logged under policy [HASH:83ca9104].',
      egressStatus: 'Verified: 100% HIPAA Safe Harbor Certified · Zero Cleartext PHI Leaked',
    },
    fintech: {
      badge: 'DPDP Act 2023 Financial Shield',
      icon: <Icons.Card size={14} color="#f59e0b" />,
      title: 'Fintech KYC & Loan Risk Analysis',
      ingress: 'Analyze credit eligibility for Mr. Rajesh Kumar (Aadhaar: 4532 8901 2345, PAN: ABCDE1234F, UPI: rajesh.kumar@okhdfcbank, Mobile: +91 9876543210) requesting 500,000 INR loan.',
      entities: [
        { label: 'AADHAAR: 4532 8901 2345', color: '#00f2fe' },
        { label: 'PAN: ABCDE1234F', color: '#f59e0b' },
        { label: 'UPI: rajesh.kumar@okhdfcbank', color: '#a855f7' },
        { label: 'PHONE: +91 9876543210', color: '#10b981' },
      ],
      sanitized: 'Analyze credit eligibility for [HASH:12af89c0] (Aadhaar: [HASH:aad09481], PAN: [HASH:pan88392], UPI: [HASH:upi77492], Mobile: [HASH:mob99201]) requesting 500,000 INR loan.',
      egress: 'Credit Assessment: Applicant [HASH:12af89c0] identity verified via [HASH:pan88392]. Risk Score: 780. Loan approved for ₹500,000 with disbursement route [HASH:upi77492].',
      egressStatus: 'Verified: DPDP Act 2023 Compliant · Indian Financial Identifiers Cryptographically Masked',
    },
    support: {
      badge: 'Enterprise Geolocation & Contact Privacy',
      icon: <Icons.Globe size={14} color="#38bdf8" />,
      title: 'Customer Service & Logistics Dispatch',
      ingress: 'Support Ticket #9921 from Alice Smith (email: alice.smith@acmecorp.com, IP: 192.168.1.105): Dispatch urgent replacement to 742 Evergreen Terrace, Springfield, Zip Code: 62704.',
      entities: [
        { label: 'NAME: Alice Smith', color: '#f59e0b' },
        { label: 'EMAIL: alice.smith@acmecorp.com', color: '#00f2fe' },
        { label: 'IP: 192.168.1.105', color: '#ec4899' },
        { label: 'GEO: 742 Evergreen Terrace', color: '#a855f7' },
      ],
      sanitized: 'Support Ticket #9921 from [HASH:66ba0911] (email: [HASH:33fd8819], IP: [HASH:71ec8832]): Dispatch urgent replacement to [HASH:99ea7712], Zip Code: [HASH:55df0012].',
      egress: 'Dispatch Order #9921 created. Status notification queued for [HASH:33fd8819] with delivery route assigned to region [HASH:55df0012].',
      egressStatus: 'Verified: Zero Geographic or Identity Coordinates Disclosed Upstream',
    },
  };

  const active = presets[activeTab];

  const copyCurl = () => {
    navigator.clipboard.writeText(`curl -X POST https://api.adrishya.ai/v1/chat/completions \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "X-Action-Mode: HASH" \\
  -d '{"model":"gpt-4","messages":[{"role":"user","content":"Summarize chart for Patient Jane Doe (MRN-4820194)"}]}'`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div style={{ background: '#030712', minHeight: '100vh', color: '#f8fafc', fontFamily: "'Outfit', system-ui, sans-serif", position: 'relative', overflowX: 'hidden' }}>
      <style>{`
        @keyframes floatCube {
          0% { transform: translateY(0px) rotateX(15deg) rotateY(10deg); }
          50% { transform: translateY(-24px) rotateX(-10deg) rotateY(-15deg); }
          100% { transform: translateY(0px) rotateX(15deg) rotateY(10deg); }
        }
        @keyframes spin3dCube {
          0% { transform: rotateX(0deg) rotateY(0deg) rotateZ(0deg); }
          100% { transform: rotateX(360deg) rotateY(360deg) rotateZ(360deg); }
        }
        @keyframes gridTravelFloor {
          0% { background-position: 0 0; }
          100% { background-position: 0 50px; }
        }
        @keyframes pulseGlow {
          0%, 100% { opacity: 0.45; transform: scale(1); }
          50% { opacity: 0.85; transform: scale(1.1); }
        }
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes scanBeamMove {
          0% { top: -10%; opacity: 0; }
          20% { opacity: 0.8; }
          80% { opacity: 0.8; }
          100% { top: 110%; opacity: 0; }
        }
        .glow-hover:hover {
          transform: translateY(-4px) scale(1.01);
          box-shadow: 0 20px 40px -15px rgba(0, 242, 254, 0.35), 0 0 30px rgba(168, 85, 247, 0.2);
          border-color: rgba(0, 242, 254, 0.55) !important;
        }
        .btn-3d-primary {
          background: linear-gradient(135deg, #00f2fe 0%, #4f46e5 50%, #9333ea 100%);
          background-size: 200% 200%;
          animation: gradientShift 4s ease infinite;
          box-shadow: 0 10px 25px -5px rgba(0, 242, 254, 0.5), inset 0 1px 2px rgba(255, 255, 255, 0.6);
          transition: all 0.25s ease;
        }
        .btn-3d-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 15px 35px -5px rgba(0, 242, 254, 0.75), inset 0 1px 3px rgba(255, 255, 255, 0.8);
        }
      `}</style>

      {/* 3D Deep Cyber Matrix Background with White Lines Grid Blocks */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>

        {/* Animated Neon Volumetric Ambient Light Pods */}
        <div style={{ position: 'absolute', top: '-15%', left: '10%', width: '700px', height: '700px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(0, 242, 254, 0.22) 0%, rgba(79, 70, 229, 0.12) 40%, transparent 70%)', filter: 'blur(70px)', animation: 'pulseGlow 8s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', top: '30%', right: '-8%', width: '750px', height: '750px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(168, 85, 247, 0.22) 0%, rgba(236, 72, 153, 0.08) 40%, transparent 70%)', filter: 'blur(80px)', animation: 'pulseGlow 10s ease-in-out infinite 2s' }} />
        <div style={{ position: 'absolute', bottom: '0%', left: '25%', width: '800px', height: '800px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(16, 185, 129, 0.15) 0%, rgba(0, 242, 254, 0.08) 50%, transparent 70%)', filter: 'blur(90px)' }} />

        {/* Global 3D White Lines Perspective Floor Grid */}
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: '-20%',
          right: '-20%',
          height: '600px',
          backgroundImage: `
            linear-gradient(rgba(255, 255, 255, 0.18) 1.5px, transparent 1.5px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.18) 1.5px, transparent 1.5px),
            linear-gradient(rgba(0, 242, 254, 0.28) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 242, 254, 0.28) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px, 50px 50px, 10px 10px, 10px 10px',
          transform: 'perspective(600px) rotateX(68deg)',
          transformOrigin: 'bottom center',
          animation: 'gridTravelFloor 3s linear infinite',
          maskImage: 'linear-gradient(to top, rgba(0,0,0,1) 15%, rgba(0,0,0,0.85) 60%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to top, rgba(0,0,0,1) 15%, rgba(0,0,0,0.85) 60%, transparent 100%)',
        }} />



        {/* Floating 3D Isometric Wireframe Cyber Cubes (White Lines Blocks) */}
        <WireframeCube size={90} x="8%" y="15%" rotSpeed="18s" delay="0s" opacity={0.75} />
        <WireframeCube size={120} x="82%" y="12%" rotSpeed="22s" delay="2s" opacity={0.8} />
        <WireframeCube size={75} x="4%" y="55%" rotSpeed="15s" delay="1s" opacity={0.65} />
        <WireframeCube size={105} x="86%" y="62%" rotSpeed="20s" delay="3s" opacity={0.75} />
        <WireframeCube size={60} x="48%" y="8%" rotSpeed="14s" delay="2.5s" opacity={0.5} />

        {/* Downward Scanning Laser Beam */}
        <div style={{
          position: 'absolute',
          left: 0,
          right: 0,
          height: '2px',
          background: 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.9) 30%, rgba(0, 242, 254, 1) 50%, rgba(168, 85, 247, 0.9) 70%, transparent 100%)',
          boxShadow: '0 0 20px rgba(0, 242, 254, 0.8), 0 0 40px rgba(168, 85, 247, 0.6)',
          animation: 'scanBeamMove 7s cubic-bezier(0.4, 0, 0.2, 1) infinite',
        }} />
      </div>

      {/* Top Glassmorphic Navigation Bar */}
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        backgroundColor: 'rgba(3, 7, 18, 0.82)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
        padding: '16px 24px',
        boxShadow: '0 4px 30px rgba(0, 0, 0, 0.5)',
      }}>
        <div style={{ maxWidth: '1240px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>

          {/* Standardized Enterprise Brand Logo with checkmark shield */}
          <AdrishyaLogo size="large" />

          {/* Quick Metrics & Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              display: 'none',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 14px',
              borderRadius: '20px',
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              fontSize: '0.78rem',
              color: '#10b981',
              fontWeight: 600,
            }} className="desktop-indicator">
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 10px #10b981' }} />
              Reverse Proxy Online · &lt;2ms
            </div>

            <SignInButton mode="modal">
              <button style={{
                background: 'rgba(255, 255, 255, 0.06)',
                color: '#f8fafc',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                padding: '9px 20px',
                borderRadius: '10px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.9rem',
                backdropFilter: 'blur(8px)',
                transition: 'all 0.2s ease',
              }}>
                Sign In
              </button>
            </SignInButton>

            <SignUpButton mode="modal">
              <button className="btn-3d-primary" style={{
                color: '#fff',
                border: 'none',
                padding: '10px 24px',
                borderRadius: '10px',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '0.92rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                <span>Get Started Free</span>
                <Icons.ArrowRight size={15} color="#fff" />
              </button>
            </SignUpButton>
          </div>
        </div>
      </header>

      {/* Main Hero Section with 3D Depth */}
      <main style={{ maxWidth: '1240px', margin: '0 auto', padding: '60px 24px 100px 24px', position: 'relative', zIndex: 1 }}>

        {/* Hero Top Chip */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '10px',
            padding: '8px 18px',
            borderRadius: '100px',
            background: 'linear-gradient(135deg, rgba(0, 242, 254, 0.12) 0%, rgba(168, 85, 247, 0.12) 100%)',
            border: '1px solid rgba(0, 242, 254, 0.35)',
            backdropFilter: 'blur(12px)',
            boxShadow: '0 4px 20px rgba(0, 242, 254, 0.15)',
          }}>
            <Icons.Sparkle size={14} color="#00f2fe" />
            <span style={{ fontSize: '0.86rem', fontWeight: 700, background: 'linear-gradient(90deg, #00f2fe, #c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '0.02em' }}>
              HIPAA Safe Harbor & India DPDP Act 2023 Real-Time Guardrail
            </span>
          </div>
        </div>

        {/* Hero Headline */}
        <div style={{ textAlign: 'center', maxWidth: '960px', margin: '0 auto' }}>
          <h1 style={{
            fontSize: 'clamp(2.5rem, 5.5vw, 4.4rem)',
            fontWeight: 900,
            lineHeight: 1.08,
            letterSpacing: '-0.03em',
            margin: '0 0 24px 0',
            textShadow: '0 10px 40px rgba(0, 0, 0, 0.8)',
          }}>
            <span style={{
              background: 'linear-gradient(135deg, #ffffff 30%, #93c5fd 60%, #c084fc 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              The Invisible Privacy Layer
            </span>
            <br />
            <span style={{
              background: 'linear-gradient(135deg, #00f2fe 0%, #38bdf8 40%, #ffffff 80%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              for Generative AI & LLMs
            </span>
          </h1>

          <p style={{
            fontSize: 'clamp(1.05rem, 1.8vw, 1.25rem)',
            color: '#94a3b8',
            maxWidth: '780px',
            margin: '0 auto 36px auto',
            lineHeight: 1.65,
            fontWeight: 400,
          }}>
            <strong style={{ color: '#f8fafc', fontWeight: 600 }}>Adrishya</strong> sits silently between your users and external AI models—intercepting, cryptographically hashing (<code style={{ color: '#00f2fe', fontFamily: mono }}>SHA-256</code>), and auditing prompts on <strong style={{ color: '#38bdf8' }}>ingress</strong> and <strong style={{ color: '#c084fc' }}>egress</strong> in &lt;2ms with zero cleartext data leakage.
          </p>

          {/* CTA Buttons */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '18px', flexWrap: 'wrap' }}>
            <SignUpButton mode="modal">
              <button className="btn-3d-primary" style={{
                color: '#fff',
                border: 'none',
                padding: '16px 36px',
                borderRadius: '12px',
                fontSize: '1.1rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '12px',
                letterSpacing: '0.01em',
              }}>
                <Icons.Shield size={20} color="#fff" />
                <span>Sign Up & Deploy Proxy</span>
              </button>
            </SignUpButton>

            <button
              onClick={() => {
                const el = document.getElementById('pipeline-demo');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              style={{
                background: 'rgba(15, 23, 42, 0.7)',
                color: '#e2e8f0',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                padding: '16px 30px',
                borderRadius: '12px',
                fontSize: '1.05rem',
                fontWeight: 600,
                cursor: 'pointer',
                backdropFilter: 'blur(16px)',
                transition: 'all 0.2s ease',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '10px',
              }}
              className="glow-hover"
            >
              <Icons.Bolt size={18} color="#00f2fe" />
              <span>Explore Live 3D Pipeline</span>
            </button>
          </div>
        </div>

        {/* Live Metrics Trust Strip */}
        <div style={{
          maxWidth: '1000px',
          margin: '60px auto 70px auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
        }}>
          {[
            { metric: '0%', label: 'Cleartext Exposure', desc: 'Prompts hashed before reaching LLM', color: '#10b981', icon: <Icons.Lock size={22} color="#10b981" /> },
            { metric: '< 2ms', label: 'Processing Latency', desc: 'Ultra-low overhead inline proxy', color: '#00f2fe', icon: <Icons.Bolt size={22} color="#00f2fe" /> },
            { metric: '15 / 15', label: 'HIPAA Safe Harbor', desc: 'All 18 PHI identifier categories', color: '#a855f7', icon: <Icons.Pulse size={22} color="#a855f7" /> },
            { metric: '27 / 27', label: 'India DPDP Act 2023', desc: 'Aadhaar, PAN, UPI, Voter ID, PIN', color: '#f59e0b', icon: <Icons.Card size={22} color="#f59e0b" /> },
          ].map((item, idx) => (
            <div key={idx} style={{
              background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.75) 0%, rgba(8, 13, 26, 0.85) 100%)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              padding: '20px',
              textAlign: 'left',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.4)',
              transition: 'all 0.25s ease',
            }} className="glow-hover">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(255, 255, 255, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {item.icon}
                </div>
                <span style={{ fontSize: '1.8rem', fontWeight: 900, color: item.color, fontFamily: mono }}>{item.metric}</span>
              </div>
              <div style={{ fontWeight: 700, fontSize: '0.94rem', color: '#f8fafc', marginBottom: '4px' }}>{item.label}</div>
              <div style={{ fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.4 }}>{item.desc}</div>
            </div>
          ))}
        </div>

        {/* 3D Interactive Pipeline Visualizer (The Showcase) */}
        <section id="pipeline-demo" style={{
          background: 'linear-gradient(135deg, rgba(12, 19, 39, 0.85) 0%, rgba(6, 10, 22, 0.95) 100%)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(56, 189, 248, 0.25)',
          borderRadius: '24px',
          padding: '36px 32px',
          boxShadow: '0 25px 60px -10px rgba(0, 0, 0, 0.8), 0 0 50px rgba(0, 242, 254, 0.12)',
          position: 'relative',
          overflow: 'hidden',
          marginBottom: '80px',
        }}>
          {/* Header & Preset Switcher */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px', marginBottom: '32px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Icons.Layers size={22} color="#00f2fe" />
                <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, color: '#f8fafc' }}>
                  Interactive 3D Pipeline Visualizer
                </h2>
              </div>
              <p style={{ fontSize: '0.88rem', color: '#94a3b8', margin: '4px 0 0 0' }}>
                See how Adrishya transforms raw sensitive queries into zero-trust cryptographic tokens in real-time.
              </p>
            </div>

            {/* Presets Tabs */}
            <div style={{
              display: 'flex',
              background: 'rgba(4, 7, 17, 0.7)',
              padding: '4px',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              gap: '6px',
            }}>
              {[
                { key: 'healthcare', label: 'Clinical & EHR (HIPAA)', icon: <Icons.Pulse size={14} color={activeTab === 'healthcare' ? '#fff' : '#ec4899'} /> },
                { key: 'fintech', label: 'Fintech & KYC (DPDP)', icon: <Icons.Card size={14} color={activeTab === 'fintech' ? '#fff' : '#f59e0b'} /> },
                { key: 'support', label: 'Enterprise & Identity', icon: <Icons.Globe size={14} color={activeTab === 'support' ? '#fff' : '#38bdf8'} /> },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  style={{
                    background: activeTab === tab.key ? 'linear-gradient(135deg, #00f2fe, #4f46e5)' : 'transparent',
                    color: activeTab === tab.key ? '#fff' : '#94a3b8',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontSize: '0.84rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: activeTab === tab.key ? '0 4px 15px rgba(0, 242, 254, 0.35)' : 'none',
                  }}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 3D Three-Stage Flow Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', alignItems: 'stretch' }}>

            {/* Stage 1: Client Ingress */}
            <div style={{
              background: 'rgba(6, 10, 24, 0.7)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: '16px',
              padding: '22px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              position: 'relative',
            }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    1. Ingress User Prompt
                  </span>
                  <span style={{ fontSize: '0.72rem', padding: '3px 8px', borderRadius: '6px', background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)', fontWeight: 600 }}>
                    RAW SENSITIVE DATA
                  </span>
                </div>
                <div style={{
                  fontFamily: mono,
                  fontSize: '0.86rem',
                  lineHeight: 1.6,
                  color: '#e2e8f0',
                  background: 'rgba(0, 0, 0, 0.4)',
                  padding: '14px',
                  borderRadius: '10px',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  minHeight: '100px',
                }}>
                  "{active.ingress}"
                </div>
              </div>

              <div style={{ marginTop: '16px' }}>
                <div style={{ fontSize: '0.74rem', color: '#94a3b8', fontWeight: 600, marginBottom: '8px', textTransform: 'uppercase' }}>
                  Detected Entities ({active.entities.length})
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {active.entities.map((ent, i) => (
                    <span key={i} style={{
                      fontSize: '0.72rem',
                      fontFamily: mono,
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: '6px',
                      background: `${ent.color}18`,
                      color: ent.color,
                      border: `1px solid ${ent.color}55`,
                    }}>
                      {ent.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Stage 2: Adrishya 3D Stealth Processor */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(16, 24, 48, 0.9) 0%, rgba(8, 14, 30, 0.95) 100%)',
              border: '1px solid rgba(0, 242, 254, 0.45)',
              borderRadius: '16px',
              padding: '22px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: '0 0 35px rgba(0, 242, 254, 0.15)',
              position: 'relative',
            }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#00f2fe', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    2. Adrishya Stealth Engine
                  </span>
                  <span style={{ fontSize: '0.72rem', padding: '3px 8px', borderRadius: '6px', background: 'rgba(0, 242, 254, 0.15)', color: '#00f2fe', border: '1px solid rgba(0, 242, 254, 0.35)', fontWeight: 700 }}>
                    ⚡ 1.2ms HASHING
                  </span>
                </div>
                <div style={{
                  fontFamily: mono,
                  fontSize: '0.86rem',
                  lineHeight: 1.6,
                  color: '#93c5fd',
                  background: 'rgba(0, 0, 0, 0.5)',
                  padding: '14px',
                  borderRadius: '10px',
                  border: '1px solid rgba(0, 242, 254, 0.2)',
                  minHeight: '100px',
                }}>
                  "{active.sanitized}"
                </div>
              </div>

              <div style={{ marginTop: '16px', padding: '10px 14px', borderRadius: '10px', background: 'rgba(0, 242, 254, 0.08)', border: '1px solid rgba(0, 242, 254, 0.25)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Icons.Lock size={16} color="#00f2fe" />
                <div style={{ fontSize: '0.76rem', color: '#00f2fe', fontWeight: 600 }}>
                  Cryptographic SHA-256 Session Vault active · Zero cleartext transmitted to upstream LLM
                </div>
              </div>
            </div>

            {/* Stage 3: LLM Response & Egress Verification */}
            <div style={{
              background: 'rgba(6, 10, 24, 0.7)',
              border: '1px solid rgba(168, 85, 247, 0.35)',
              borderRadius: '16px',
              padding: '22px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              position: 'relative',
            }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#c084fc', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    3. Upstream LLM Egress Guard
                  </span>
                  <span style={{ fontSize: '0.72rem', padding: '3px 8px', borderRadius: '6px', background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', border: '1px solid rgba(168, 85, 247, 0.35)', fontWeight: 600 }}>
                    MODEL COMPLETION
                  </span>
                </div>
                <div style={{
                  fontFamily: mono,
                  fontSize: '0.86rem',
                  lineHeight: 1.6,
                  color: '#e2e8f0',
                  background: 'rgba(0, 0, 0, 0.4)',
                  padding: '14px',
                  borderRadius: '10px',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  minHeight: '100px',
                }}>
                  "{active.egress}"
                </div>
              </div>

              <div style={{ marginTop: '16px', padding: '10px 14px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Icons.Check size={16} color="#10b981" />
                <div style={{ fontSize: '0.76rem', color: '#10b981', fontWeight: 700 }}>
                  {active.egressStatus}
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* 3D Feature Grid */}
        <section style={{ marginBottom: '80px' }}>
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <h2 style={{
              fontSize: '2.4rem',
              fontWeight: 800,
              margin: '0 0 12px 0',
              background: 'linear-gradient(135deg, #ffffff 0%, #94a3b8 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              Engineered for Zero-Trust Enterprise AI
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '1rem', maxWidth: '600px', margin: '0 auto' }}>
              Everything required to achieve full compliance across OpenAI, Anthropic, and open-source models.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '22px' }}>
            {[
              {
                icon: <Icons.Shield size={26} color="#00f2fe" />,
                title: 'Autonomous Ingress Masking',
                desc: 'Scans prompts and multi-modal payloads across 15 HIPAA Safe Harbor and 27 Indian DPDP categories, replacing sensitive entities with deterministic SHA-256 tokens in <1.5ms.',
                color: '#00f2fe',
              },
              {
                icon: <Icons.EyeScan size={26} color="#a855f7" />,
                title: 'Active Egress Guardrail',
                desc: 'Intercepts streaming and non-streaming model completions to eliminate synthetic PII hallucinations, unmasking leaks, and unauthorized identifier output.',
                color: '#a855f7',
              },
              {
                icon: <Icons.Terminal size={26} color="#38bdf8" />,
                title: '1-Line Reverse Proxy',
                desc: 'Native drop-in replacement for OpenAI `/v1/chat/completions`. Compatible out-of-the-box with LangChain, LlamaIndex, LiteLLM, and OpenWebUI without code refactoring.',
                color: '#38bdf8',
              },
              {
                icon: <Icons.Analytics size={26} color="#10b981" />,
                title: 'Tamper-Evident Audit & Trust Matrix',
                desc: 'Real-time Trust Analytics, Authority-Trust scoring, effective-use ratings, and zero-cleartext audit receipts recorded in your local cryptographic session vault.',
                color: '#10b981',
              },
            ].map((feat, i) => (
              <div key={i} style={{
                background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.7) 0%, rgba(8, 13, 26, 0.8) 100%)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '20px',
                padding: '28px 24px',
                position: 'relative',
                boxShadow: '0 12px 35px rgba(0, 0, 0, 0.35)',
                transition: 'all 0.25s ease',
              }} className="glow-hover">
                <div style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '14px',
                  background: `${feat.color}18`,
                  border: `1px solid ${feat.color}44`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '18px',
                  boxShadow: `0 0 20px ${feat.color}22`,
                }}>
                  {feat.icon}
                </div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 10px 0', color: '#f8fafc' }}>
                  {feat.title}
                </h3>
                <p style={{ fontSize: '0.88rem', color: '#94a3b8', lineHeight: 1.6, margin: 0 }}>
                  {feat.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* 1-Minute Developer Integration Code Card */}
        <section style={{
          background: 'linear-gradient(135deg, rgba(12, 19, 39, 0.9) 0%, rgba(5, 8, 18, 0.95) 100%)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '20px',
          padding: '32px',
          marginBottom: '80px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', marginBottom: '20px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Icons.Terminal size={18} color="#00f2fe" />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#f8fafc' }}>
                  Instant Integration (Drop-in OpenAI Replacement)
                </h3>
              </div>
              <p style={{ fontSize: '0.84rem', color: '#94a3b8', margin: '4px 0 0 0' }}>
                Route existing OpenAI client traffic through your Adrishya reverse proxy link.
              </p>
            </div>

            <button
              onClick={copyCurl}
              style={{
                background: copied ? 'rgba(16, 185, 129, 0.15)' : 'rgba(0, 242, 254, 0.12)',
                color: copied ? '#10b981' : '#00f2fe',
                border: `1px solid ${copied ? 'rgba(16, 185, 129, 0.4)' : 'rgba(0, 242, 254, 0.3)'}`,
                padding: '8px 16px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.84rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s ease',
              }}
            >
              {copied ? <Icons.Check size={14} color="#10b981" /> : <Icons.Copy size={14} color="#00f2fe" />}
              <span>{copied ? 'Copied to Clipboard' : 'Copy cURL Request'}</span>
            </button>
          </div>

          <div style={{
            background: 'rgba(2, 4, 10, 0.85)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: '12px',
            padding: '18px 20px',
            fontFamily: mono,
            fontSize: '0.85rem',
            lineHeight: 1.6,
            color: '#38bdf8',
            overflowX: 'auto',
          }}>
            <span style={{ color: '#ec4899' }}>curl</span> -X POST http://localhost:8000/v1/chat/completions \\<br />
            &nbsp;&nbsp;-H <span style={{ color: '#10b981' }}>"Content-Type: application/json"</span> \\<br />
            &nbsp;&nbsp;-H <span style={{ color: '#10b981' }}>"X-Action-Mode: HASH"</span> \\<br />
            &nbsp;&nbsp;-H <span style={{ color: '#10b981' }}>"Authorization: Bearer YOUR_API_KEY"</span> \\<br />
            &nbsp;&nbsp;-d <span style={{ color: '#f59e0b' }}>{"'{\"model\":\"gpt-4\",\"messages\":[{\"role\":\"user\",\"content\":\"Summarize medical chart for Patient Jane Doe (DOB: 08/23/1984, MRN-4820194)\"}]}'"}</span>
          </div>
        </section>

        {/* Bottom 3D Call to Action Banner */}
        <section style={{
          background: 'linear-gradient(135deg, rgba(0, 242, 254, 0.1) 0%, rgba(168, 85, 247, 0.12) 50%, rgba(79, 70, 229, 0.1) 100%)',
          border: '1px solid rgba(0, 242, 254, 0.35)',
          borderRadius: '24px',
          padding: '50px 32px',
          textAlign: 'center',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.6), 0 0 40px rgba(0, 242, 254, 0.15), inset 0 1px 1px rgba(255, 255, 255, 0.25)',
          position: 'relative',
        }}>
          <div style={{
            width: '56px',
            height: '56px',
            margin: '0 auto 20px auto',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #00f2fe, #a855f7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 25px rgba(0, 242, 254, 0.5), inset 0 1px 2px rgba(255, 255, 255, 0.5)',
          }}>
            <IconShield size={30} color="#ffffff" strokeWidth={2.2} />
          </div>
          <h2 style={{
            fontSize: '2.4rem',
            fontWeight: 800,
            margin: '0 0 14px 0',
            background: 'linear-gradient(135deg, #ffffff 30%, #38bdf8 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            Ready to Cloak Your AI Prompts with Adrishya?
          </h2>
          <p style={{ fontSize: '1.05rem', color: '#94a3b8', maxWidth: '620px', margin: '0 auto 28px auto', lineHeight: 1.6 }}>
            Set up in 60 seconds. Eliminate HIPAA and DPDP compliance risk while unleashing full LLM capabilities across your team.
          </p>

          <SignUpButton mode="modal">
            <button className="btn-3d-primary" style={{
              color: '#fff',
              border: 'none',
              padding: '16px 36px',
              borderRadius: '12px',
              fontSize: '1.1rem',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 10px 30px rgba(0, 242, 254, 0.5)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
            }}>
              <IconShield size={20} color="#fff" strokeWidth={2.2} />
              <span>Get Started Free · Sign Up Now</span>
            </button>
          </SignUpButton>
        </section>

        {/* Footer */}
        <footer style={{ marginTop: '80px', paddingTop: '24px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', color: '#64748b', fontSize: '0.84rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AdrishyaLogo size="small" showSubtitle={false} />
            <span>•</span>
            <span>Invisible Privacy Layer</span>
          </div>
          <div style={{ display: 'flex', gap: '18px' }}>
            <span>HIPAA Safe Harbor</span>
            <span>•</span>
            <span>DPDP Act 2023 India</span>

          </div>
        </footer>

      </main>
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
  const [pageReady, setPageReady] = useState(false);

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
    setPageReady(false);
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
        const nextMe = res.ok ? await res.json() : null;
        setMe(nextMe);
      } catch (e) {
        setMe(null);
      } finally {
        setPageReady(true);
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

  if (me === undefined || !pageReady) {
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
                <span style={{ color: '#00f2fe', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <IconUser size={15} color="#00f2fe" strokeWidth={2} />
                  {nav.params.user_email || nav.params.user_uuid}
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
      userButton={
        <UserButton
          showName
          appearance={{
            variables: {
              colorText: '#ffffff',
              colorTextSecondary: '#ffffff',
              colorBackground: '#0b1020',
              colorPrimary: '#38bdf8',
              colorBorder: 'rgba(255,255,255,0.15)',
            },
            elements: {
              userButtonPopoverCard: {
                backgroundColor: '#0b1020',
                borderColor: 'rgba(255,255,255,0.12)',
              },
              userButtonPopoverActionButton: {
                color: '#ffffff',
                backgroundColor: '#0b1020',
              },
              userButtonPopoverActionButtonText: {
                color: '#ffffff',
              },
              userButtonPopoverActionButtonIcon: {
                color: '#ffffff',
              },
              userButtonPopoverFooter: {
                color: '#ffffff',
              },
              userButtonPopoverRow: {
                color: '#ffffff',
              },
              userButtonPopoverName: {
                color: '#ffffff',
              },
              userButtonPopoverEmailAddress: {
                color: '#ffffff',
              },
            },
          }}
        />
      }
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
