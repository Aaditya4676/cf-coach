// ============================================================
// CF Coach — Multi-Provider AI Client
// Supports Gemini, OpenAI, and Claude with user-provided keys
// Priority: User key (from header) → Env key → Error
// ============================================================

import { GoogleGenerativeAI } from '@google/generative-ai';

export type AIProvider = 'gemini' | 'openai' | 'claude';

interface AICallOptions {
  provider?: AIProvider;
  apiKey?: string;
}

// ── Gemini ──────────────────────────────────────────────────

const GEMINI_FALLBACK_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
];

function getGeminiModelList(): string[] {
  const envModel = process.env.GEMINI_MODEL;
  if (envModel) {
    return [envModel, ...GEMINI_FALLBACK_MODELS.filter((m) => m !== envModel)];
  }
  return GEMINI_FALLBACK_MODELS;
}

async function callGeminiProvider<T>(prompt: string, apiKey: string): Promise<T> {
  const ai = new GoogleGenerativeAI(apiKey);
  const models = getGeminiModelList();
  let lastError: Error | null = null;

  for (const modelId of models) {
    try {
      const model = ai.getGenerativeModel({
        model: modelId,
        generationConfig: {
          temperature: 0.7,
          topP: 0.95,
          maxOutputTokens: 8192,
          responseMimeType: 'application/json',
        },
      });

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      return parseAIResponse<T>(text);
    } catch (err) {
      const msg = (err as Error).message || '';
      const is404 = msg.includes('404') || msg.includes('not found') || msg.includes('Not Found');

      if (is404 && models.indexOf(modelId) < models.length - 1) {
        console.warn(`[Gemini] Model "${modelId}" not available, trying next fallback...`);
        lastError = err as Error;
        continue;
      }
      throw err;
    }
  }
  throw lastError ?? new Error('All Gemini models failed');
}

// ── OpenAI ──────────────────────────────────────────────────

const OPENAI_MODELS = ['gpt-4o-mini', 'gpt-3.5-turbo'];

async function callOpenAIProvider<T>(prompt: string, apiKey: string): Promise<T> {
  let lastError: Error | null = null;

  for (const model of OPENAI_MODELS) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content: 'You are a helpful assistant. Always respond with valid JSON only, no markdown fences.'
            },
            { role: 'user', content: prompt }
          ],
          temperature: 0.7,
          max_tokens: 8192,
          response_format: { type: 'json_object' },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = (errorData as any)?.error?.message || response.statusText;
        // If model not found, try next
        if (response.status === 404 && OPENAI_MODELS.indexOf(model) < OPENAI_MODELS.length - 1) {
          lastError = new Error(errorMsg);
          continue;
        }
        throw new Error(`OpenAI API error (${response.status}): ${errorMsg}`);
      }

      const data = await response.json();
      const text = data.choices?.[0]?.message?.content || '';
      return parseAIResponse<T>(text);
    } catch (err) {
      lastError = err as Error;
      if (OPENAI_MODELS.indexOf(model) < OPENAI_MODELS.length - 1) continue;
      throw err;
    }
  }
  throw lastError ?? new Error('All OpenAI models failed');
}

// ── Claude ──────────────────────────────────────────────────

const CLAUDE_MODELS = ['claude-sonnet-4-20250514', 'claude-3-5-haiku-20241022'];

async function callClaudeProvider<T>(prompt: string, apiKey: string): Promise<T> {
  let lastError: Error | null = null;

  for (const model of CLAUDE_MODELS) {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: 8192,
          messages: [
            {
              role: 'user',
              content: `${prompt}\n\nIMPORTANT: Respond with valid JSON only, no markdown fences or extra text.`
            }
          ],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = (errorData as any)?.error?.message || response.statusText;
        if (response.status === 404 && CLAUDE_MODELS.indexOf(model) < CLAUDE_MODELS.length - 1) {
          lastError = new Error(errorMsg);
          continue;
        }
        throw new Error(`Claude API error (${response.status}): ${errorMsg}`);
      }

      const data = await response.json();
      const text = data.content?.[0]?.text || '';
      return parseAIResponse<T>(text);
    } catch (err) {
      lastError = err as Error;
      if (CLAUDE_MODELS.indexOf(model) < CLAUDE_MODELS.length - 1) continue;
      throw err;
    }
  }
  throw lastError ?? new Error('All Claude models failed');
}

// ── Shared Utilities ────────────────────────────────────────

function parseAIResponse<T>(text: string): T {
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
  else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
  if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
  cleaned = cleaned.trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch (parseErr) {
    console.error('[AI] JSON parse failed:', cleaned.slice(0, 300));
    throw new Error(`AI response was not valid JSON: ${(parseErr as Error).message}`);
  }
}

// ── Public API ──────────────────────────────────────────────

/**
 * Call an AI provider with automatic fallback.
 * Priority: options.apiKey → env GEMINI_API_KEY → error
 */
export async function callAI<T>(prompt: string, options?: AICallOptions): Promise<T> {
  const provider = options?.provider || 'gemini';
  let apiKey = options?.apiKey;

  // Fallback to env key for Gemini
  if (!apiKey && provider === 'gemini') {
    apiKey = process.env.GEMINI_API_KEY;
  }

  if (!apiKey) {
    throw new Error(
      `No API key available for ${provider}. ` +
      `Please add your ${provider} API key in Settings, or set GEMINI_API_KEY as an environment variable.`
    );
  }

  switch (provider) {
    case 'gemini':
      return callGeminiProvider<T>(prompt, apiKey);
    case 'openai':
      return callOpenAIProvider<T>(prompt, apiKey);
    case 'claude':
      return callClaudeProvider<T>(prompt, apiKey);
    default:
      throw new Error(`Unknown AI provider: ${provider}`);
  }
}

/**
 * Extract AI options from incoming request headers.
 * Client sends x-ai-provider and x-ai-key headers.
 */
export function getAIOptionsFromHeaders(headers: Headers): AICallOptions {
  const provider = (headers.get('x-ai-provider') || 'gemini') as AIProvider;
  const apiKey = headers.get('x-ai-key') || undefined;
  return { provider, apiKey };
}

/**
 * Returns which model is active (for display).
 */
export function getActiveModelId(): string {
  return process.env.GEMINI_MODEL || GEMINI_FALLBACK_MODELS[0];
}

// Backwards-compatible alias
export const callGemini = callAI;
