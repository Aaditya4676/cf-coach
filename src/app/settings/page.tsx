'use client';

import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Key, User, Database, Zap, ExternalLink, ShieldCheck } from 'lucide-react';

import { useCFHandle } from '@/hooks/useCFHandle';
import { getAISettings, saveAISettings, AISettings } from '@/hooks/useAISettings';
import { AIProvider } from '@/lib/ai-client';

export default function SettingsPage() {
  const { handle: globalHandle, updateHandle } = useCFHandle();
  
  // CF Handle
  const [localHandle, setLocalHandle] = useState('');
  
  // AI Settings
  const [aiSettings, setAiSettings] = useState<AISettings>({
    provider: 'gemini',
    geminiKey: '',
    openaiKey: '',
    claudeKey: '',
  });

  const [supabaseConfigured, setSupabaseConfigured] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (globalHandle && globalHandle !== 'tourist') {
      setLocalHandle(globalHandle);
    }
    // Load AI settings from hook (which reads from localStorage)
    setAiSettings(getAISettings());
    
    // Check if env vars are set (can only check public ones on client)
    setSupabaseConfigured(!!process.env.NEXT_PUBLIC_SUPABASE_URL);
  }, [globalHandle]);

  const saveAllSettings = () => {
    updateHandle(localHandle);
    saveAISettings(aiSettings);
    
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
            className="input-field"
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
        </div>
        <div className="text-xs text-muted mt-sm">
          This is used to fetch your profile and submissions from the Codeforces API
        </div>
      </div>

      {/* API Configuration Status */}
      <div className="card mb-lg">
        <div className="card-header border-b pb-sm mb-md" style={{ borderColor: 'var(--glass-border)' }}>
          <div className="card-title flex items-center justify-between w-full">
            <div className="flex items-center gap-sm">
              <Key size={16} />
              AI Provider & Keys
            </div>
            <div className="badge badge-emerald flex items-center gap-xs">
              <ShieldCheck size={12} />
              Local Storage Only
            </div>
          </div>
        </div>

        <div className="text-sm text-muted mb-md">
          Your API keys are stored securely in your browser's local storage and are sent directly to the AI provider via our proxy. They are never saved to a database.
        </div>

        <div className="mb-md">
          <label className="text-xs font-bold text-muted uppercase tracking-wider mb-xs block">
            Preferred AI Provider
          </label>
          <select 
            value={aiSettings.provider}
            onChange={(e) => setAiSettings({ ...aiSettings, provider: e.target.value as AIProvider })}
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--glass-border)',
              background: 'var(--bg-input)',
              color: 'var(--text-primary)',
              fontSize: 14,
              marginBottom: 'var(--space-md)'
            }}
          >
            <option value="gemini">Google Gemini (Recommended)</option>
            <option value="openai">OpenAI (GPT-4o / 3.5)</option>
            <option value="claude">Anthropic Claude</option>
          </select>
        </div>

        <div className="flex flex-col gap-sm">
          {/* Gemini */}
          <div>
            <div className="flex items-center justify-between mb-xs">
              <span className="text-sm font-semibold">Gemini API Key</span>
              {aiSettings.geminiKey ? (
                <span className="text-xs text-emerald-400">Configured</span>
              ) : (
                <span className="text-xs text-muted">Optional (Falls back to env)</span>
              )}
            </div>
            <input
              type="password"
              value={aiSettings.geminiKey}
              onChange={(e) => setAiSettings({ ...aiSettings, geminiKey: e.target.value })}
              placeholder="AIzaSy..."
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--glass-border)',
                background: 'var(--bg-input)',
                color: 'var(--text-primary)',
                fontFamily: 'monospace',
                fontSize: 13,
              }}
            />
          </div>

          {/* OpenAI */}
          <div>
            <div className="flex items-center justify-between mb-xs">
              <span className="text-sm font-semibold">OpenAI API Key</span>
              {aiSettings.openaiKey ? (
                <span className="text-xs text-emerald-400">Configured</span>
              ) : null}
            </div>
            <input
              type="password"
              value={aiSettings.openaiKey}
              onChange={(e) => setAiSettings({ ...aiSettings, openaiKey: e.target.value })}
              placeholder="sk-..."
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--glass-border)',
                background: 'var(--bg-input)',
                color: 'var(--text-primary)',
                fontFamily: 'monospace',
                fontSize: 13,
              }}
            />
          </div>

          {/* Claude */}
          <div>
            <div className="flex items-center justify-between mb-xs">
              <span className="text-sm font-semibold">Claude API Key</span>
              {aiSettings.claudeKey ? (
                <span className="text-xs text-emerald-400">Configured</span>
              ) : null}
            </div>
            <input
              type="password"
              value={aiSettings.claudeKey}
              onChange={(e) => setAiSettings({ ...aiSettings, claudeKey: e.target.value })}
              placeholder="sk-ant-..."
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--glass-border)',
                background: 'var(--bg-input)',
                color: 'var(--text-primary)',
                fontFamily: 'monospace',
                fontSize: 13,
              }}
            />
          </div>
        </div>
      </div>
      
      {/* Save Button */}
      <div className="flex justify-end mb-xl">
        <button 
          className="btn btn-primary" 
          onClick={saveAllSettings}
          style={{ padding: '12px 32px', fontSize: 16 }}
        >
          {saved ? '✅ Saved Successfully!' : 'Save All Settings'}
        </button>
      </div>

      {/* Supabase Status */}
      <div className="card mb-lg">
        <div className="card-header">
          <div className="card-title">
            <Database size={16} />
            Cloud Persistence
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
            <code className="font-mono" style={{ color: 'var(--accent-blue)' }}>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> as environment variables to enable database persistence across devices.
          </div>
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
            Built with Next.js, Multi-Provider AI (Gemini, OpenAI, Claude), Recharts, and Supabase.
          </p>
        </div>
      </div>
    </div>
  );
}
