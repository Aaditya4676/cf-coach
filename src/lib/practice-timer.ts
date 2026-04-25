import { CFProblem } from './types';
import { supabase, isSupabaseConfigured } from './storage';

export interface SolveSession {
  id: string;
  handle: string;
  problemUrl: string;
  problemInfo?: CFProblem; // Cached problem info
  startTime: string; // ISO string
  endTime?: string; // ISO string
  durationSeconds?: number;
  status: 'active' | 'completed' | 'abandoned';
  ratingDelta?: number; // Post-solve prediction delta (for future advanced ML)
}

const STORAGE_KEY = 'cf_coach_solve_sessions';

// --- Helper to get profile_id for Supabase ---
async function ensureProfile(cfHandle: string): Promise<string> {
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('cf_handle', cfHandle)
    .single();

  if (existing) return existing.id;

  const { data: created } = await supabase
    .from('profiles')
    .insert({ cf_handle: cfHandle })
    .select('id')
    .single();

  return created!.id;
}

// --- Solve Sessions ---

export async function getSolveSessions(handle: string): Promise<SolveSession[]> {
  if (typeof window === 'undefined') return [];

  if (isSupabaseConfigured()) {
    try {
      const profileId = await ensureProfile(handle);
      const { data, error } = await supabase
        .from('solve_sessions')
        .select('*')
        .eq('profile_id', profileId)
        .order('start_time', { ascending: false });

      if (error) throw error;

      return (data || []).map((d: any) => ({
        id: d.id,
        handle,
        problemUrl: d.problem_url,
        problemInfo: d.problem_info,
        startTime: d.start_time,
        endTime: d.end_time,
        durationSeconds: d.duration_seconds,
        status: d.status,
        ratingDelta: d.rating_delta,
      }));
    } catch (err) {
      console.error('Supabase getSolveSessions error, falling back to localStorage', err);
    }
  }

  // localStorage fallback
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const allSessions: SolveSession[] = JSON.parse(raw);
    return allSessions.filter(s => s.handle === handle);
  } catch (err) {
    console.error('Failed to load solve sessions', err);
    return [];
  }
}

export async function saveSolveSession(session: SolveSession): Promise<void> {
  if (typeof window === 'undefined') return;

  if (isSupabaseConfigured()) {
    try {
      const profileId = await ensureProfile(session.handle);
      await supabase.from('solve_sessions').upsert({
        id: session.id,
        profile_id: profileId,
        problem_url: session.problemUrl,
        problem_info: session.problemInfo || null,
        start_time: session.startTime,
        end_time: session.endTime || null,
        duration_seconds: session.durationSeconds || null,
        status: session.status,
        rating_delta: session.ratingDelta || null,
      });
      return;
    } catch (err) {
      console.error('Supabase saveSolveSession error, falling back to localStorage', err);
    }
  }

  // localStorage fallback
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const allSessions: SolveSession[] = raw ? JSON.parse(raw) : [];

    // Update or insert
    const idx = allSessions.findIndex(s => s.id === session.id);
    if (idx >= 0) {
      allSessions[idx] = session;
    } else {
      allSessions.push(session);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(allSessions));
  } catch (err) {
    console.error('Failed to save solve session', err);
  }
}

export async function getActiveSession(handle: string): Promise<SolveSession | null> {
  const sessions = await getSolveSessions(handle);
  return sessions.find(s => s.status === 'active') || null;
}
