// ============================================================
// CF Coach — AI Settings Hook
// Reads user's preferred AI provider and key from localStorage
// ============================================================

import { AIProvider } from '@/lib/ai-client';

export interface AISettings {
  provider: AIProvider;
  geminiKey: string;
  openaiKey: string;
  claudeKey: string;
}

const STORAGE_KEY = 'cf_ai_settings';

export function getAISettings(): AISettings {
  if (typeof window === 'undefined') {
    return { provider: 'gemini', geminiKey: '', openaiKey: '', claudeKey: '' };
  }
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      // corrupted, reset
    }
  }
  return { provider: 'gemini', geminiKey: '', openaiKey: '', claudeKey: '' };
}

export function saveAISettings(settings: AISettings): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

/**
 * Get the active API key for the selected provider.
 */
export function getActiveKey(settings: AISettings): string {
  switch (settings.provider) {
    case 'gemini': return settings.geminiKey;
    case 'openai': return settings.openaiKey;
    case 'claude': return settings.claudeKey;
    default: return '';
  }
}

/**
 * Build headers to attach to API calls.
 * Only sends key if the user has configured one.
 */
export function getAIHeaders(settings?: AISettings): Record<string, string> {
  const s = settings || getAISettings();
  const key = getActiveKey(s);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (key) {
    headers['x-ai-provider'] = s.provider;
    headers['x-ai-key'] = key;
  }
  return headers;
}
