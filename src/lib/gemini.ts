// ============================================================
// CF Coach — Gemini API Client
// Supports env-configurable model with automatic fallback chain
// ============================================================

import { GoogleGenerativeAI } from '@google/generative-ai';

let genAI: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not set');
    }
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
}

/**
 * Model priority list.
 * - First: whatever is set in GEMINI_MODEL env var (if any)
 * - Fallbacks: tried in order until one works
 *
 * Set GEMINI_MODEL in .env.local to pin a specific model, e.g.:
 *   GEMINI_MODEL=gemini-2.5-flash
 */
const FALLBACK_MODELS = [
  'gemini-2.5-flash',           // Gemini 2.5 Flash (stable)
  'gemini-2.0-flash',           // Gemini 2 Flash
  'gemini-2.0-flash-lite',      // Gemini 2 Flash Lite (cheapest)
];

function getModelList(): string[] {
  const envModel = process.env.GEMINI_MODEL;
  if (envModel) {
    // Put the env-specified model first, then keep fallbacks that aren't duplicates
    return [envModel, ...FALLBACK_MODELS.filter((m) => m !== envModel)];
  }
  return FALLBACK_MODELS;
}

/**
 * Call Gemini with automatic model fallback.
 * Tries each model in priority order; on 404 moves to the next one.
 */
export async function callGemini<T>(prompt: string): Promise<T> {
  const ai = getGenAI();
  const models = getModelList();
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

      // Strip markdown fences if the model wrapped JSON in them
      let cleaned = text.trim();
      if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
      else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
      if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
      cleaned = cleaned.trim();

      try {
        return JSON.parse(cleaned) as T;
      } catch (parseErr) {
        console.error(`[Gemini] JSON parse failed for model ${modelId}:`, cleaned.slice(0, 200));
        throw new Error(`AI response was not valid JSON: ${(parseErr as Error).message}`);
      }
    } catch (err) {
      const msg = (err as Error).message || '';
      const is404 = msg.includes('404') || msg.includes('not found') || msg.includes('Not Found');

      if (is404 && models.indexOf(modelId) < models.length - 1) {
        console.warn(`[Gemini] Model "${modelId}" not available, trying next fallback...`);
        lastError = err as Error;
        continue; // Try next model
      }

      // Not a 404, or we're out of fallbacks — re-throw
      throw err;
    }
  }

  throw lastError ?? new Error('All Gemini models failed');
}

/**
 * Returns which model is active (for display in the UI).
 * Useful for debugging via /api/model-info.
 */
export function getActiveModelId(): string {
  return process.env.GEMINI_MODEL || FALLBACK_MODELS[0];
}
