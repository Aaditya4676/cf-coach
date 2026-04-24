'use client';

import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Key, User, Database, Zap, ExternalLink } from 'lucide-react';

import { useCFHandle } from '@/hooks/useCFHandle';

export default function SettingsPage() {
  const { handle: globalHandle, updateHandle } = useCFHandle();
  const [localHandle, setLocalHandle] = useState('');
  const [geminiKeyConfigured, setGeminiKeyConfigured] = useState(false);
  const [supabaseConfigured, setSupabaseConfigured] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (globalHandle && globalHandle !== 'tourist') {
      setLocalHandle(globalHandle);
    }
    // Check if env vars are set (can only check public ones on client)
    setSupabaseConfigured(!!process.env.NEXT_PUBLIC_SUPABASE_URL);
  }, [globalHandle]);

  const saveSettings = () => {
    updateHandle(localHandle);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title flex items-center gap-sm">
          <SettingsIcon size={28} style={{ color: 'var(--text-secondary)' }} />
          Settings
        </h1>
        <p className="page-description">
          Configure your CF Coach
        </p>
      </div>

      {/* CF Handle */}
      <div className="card mb-lg">
        <div className="card-header">
          <div className="card-title">
            <User size={16} />
            Codeforces Handle
          </div>
        </div>
        <div className="flex gap-md items-center">
          <input
            type="text"
            value={localHandle}
            onChange={(e) => setLocalHandle(e.target.value)}
            placeholder="Your CF handle"
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--glass-border)',
              background: 'var(--bg-input)',
              color: 'var(--text-primary)',
              fontSize: 14,
              fontFamily: "'JetBrains Mono', monospace",
            }}
          />
          <button className="btn btn-primary" onClick={saveSettings}>
            {saved ? '✅ Saved!' : 'Save'}
          </button>
        </div>
        <div className="text-xs text-muted mt-sm">
          This is used to fetch your profile and submissions from the Codeforces API
        </div>
      </div>

      {/* API Configuration Status */}
      <div className="card mb-lg">
        <div className="card-header">
          <div className="card-title">
            <Key size={16} />
            API Configuration
          </div>
        </div>

        <div className="mb-lg">
          <div className="flex items-center justify-between mb-sm">
            <div className="flex items-center gap-sm">
              <Zap size={14} style={{ color: 'var(--accent-purple)' }} />
              <span className="font-semibold text-sm">Gemini API Key</span>
            </div>
            <span className={`badge ${geminiKeyConfigured ? 'badge-emerald' : 'badge-amber'}`}>
              {geminiKeyConfigured ? '✅ Configured' : '⚠️ Set in .env.local'}
            </span>
          </div>
          <div className="text-xs text-muted">
            Set <code className="font-mono" style={{ color: 'var(--accent-blue)' }}>GEMINI_API_KEY</code> in your{' '}
            <code className="font-mono" style={{ color: 'var(--accent-blue)' }}>.env.local</code> file
            (or as a Vercel environment variable)
          </div>
        </div>

        <div className="mb-lg">
          <div className="flex items-center justify-between mb-sm">
            <div className="flex items-center gap-sm">
              <Database size={14} style={{ color: 'var(--accent-cyan)' }} />
              <span className="font-semibold text-sm">Supabase</span>
            </div>
            <span className={`badge ${supabaseConfigured ? 'badge-emerald' : 'badge-neutral'}`}>
              {supabaseConfigured ? '✅ Connected' : '📦 Using localStorage'}
            </span>
          </div>
          <div className="text-xs text-muted">
            Set <code className="font-mono" style={{ color: 'var(--accent-blue)' }}>NEXT_PUBLIC_SUPABASE_URL</code> and{' '}
            <code className="font-mono" style={{ color: 'var(--accent-blue)' }}>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to enable database persistence
          </div>
        </div>
      </div>

      {/* Setup Instructions */}
      <div className="card mb-lg">
        <div className="card-header">
          <div className="card-title">📋 Setup Guide</div>
        </div>
        <div style={{ fontSize: 14, lineHeight: 1.8 }}>
          <p className="mb-md"><strong>1. Get a Gemini API Key</strong></p>
          <p className="text-muted mb-md" style={{ paddingLeft: 16 }}>
            Visit{' '}
            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="flex items-center gap-xs" style={{ display: 'inline-flex' }}>
              Google AI Studio <ExternalLink size={12} />
            </a>{' '}
            → Create an API key → Add it to <code className="font-mono" style={{ color: 'var(--accent-blue)' }}>.env.local</code>
          </p>

          <p className="mb-md"><strong>2. Create <code className="font-mono">.env.local</code></strong></p>
          <pre style={{
            padding: 'var(--space-md)',
            background: 'var(--bg-input)',
            borderRadius: 'var(--radius-md)',
            fontSize: 13,
            marginBottom: 'var(--space-md)',
            overflowX: 'auto',
          }}>
{`GEMINI_API_KEY=your_gemini_api_key_here

# Optional: Supabase (for persistent storage)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key`}
          </pre>

          <p className="mb-md"><strong>3. Deploy to Vercel</strong></p>
          <p className="text-muted" style={{ paddingLeft: 16 }}>
            Push to GitHub → Import to Vercel → Add environment variables in Vercel dashboard
          </p>
        </div>
      </div>

      {/* About */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">About CF Coach</div>
        </div>
        <div className="text-sm text-muted" style={{ lineHeight: 1.8 }}>
          <p>
            CF Coach is an AI-powered Codeforces coaching agent built with evidence-based
            learning science principles including spaced repetition (SM-2), deliberate practice,
            interleaving, and Bjork&apos;s desirable difficulties framework.
          </p>
          <p className="mt-md">
            Built with Next.js, Gemini AI, Recharts, and Supabase.
          </p>
        </div>
      </div>
    </div>
  );
}
