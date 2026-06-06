import { CFProblem } from './types';
import { supabase, isSupabaseConfigured } from './storage';

export interface SolveSession {
  id: string;
  handle: string;
  problemUrl: string;
  problemInfo?: CFProblem; // Cached problem info
  startTime: string; // ISO string — never mutated after creation
  endTime?: string; // ISO string
  durationSeconds?: number;
  status: 'active' | 'completed' | 'abandoned';
  type?: 'practice' | 'virtual_contest'; // distinguish session types
  ratingDelta?: number; // Post-solve prediction delta (for future advanced ML)
  pausedElapsed?: number;  // Accumulated seconds at moment of pause (only set while paused)
  pausedAt?: string;       // ISO string of when the timer was paused
}

const STORAGE_KEY = 'cf_coach_solve_sessions';

// Maximum age (in ms) before an active session is considered stale and auto-abandoned
const STALE_SESSION_MS = 6 * 60 * 60 * 1000; // 6 hours

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

      return (data || []).map((d: any) => {
        // pausedElapsed and pausedAt are stored inside problem_info JSONB to avoid migration
        const pauseState = d.problem_info?._pauseState;
        const problemInfo = d.problem_info ? { ...d.problem_info } : undefined;
        if (problemInfo) delete problemInfo._pauseState;

        return {
          id: d.id,
          handle,
          problemUrl: d.problem_url,
          problemInfo: problemInfo && Object.keys(problemInfo).length > 0 ? problemInfo : undefined,
          startTime: d.start_time,
          endTime: d.end_time,
          durationSeconds: d.duration_seconds,
          status: d.status,
          ratingDelta: d.rating_delta,
          pausedElapsed: pauseState?.pausedElapsed ?? undefined,
          pausedAt: pauseState?.pausedAt ?? undefined,
        };
      });
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
    const profileId = await ensureProfile(session.handle);
    // Pack pausedElapsed/pausedAt into problem_info JSONB to avoid needing a DB migration
    const problemInfoWithPause = {
      ...(session.problemInfo || {}),
      ...(session.pausedElapsed != null || session.pausedAt
        ? { _pauseState: { pausedElapsed: session.pausedElapsed, pausedAt: session.pausedAt } }
        : {}),
    };
    const hasInfo = Object.keys(problemInfoWithPause).length > 0;

    const { error } = await supabase.from('solve_sessions').upsert({
      id: session.id,
      profile_id: profileId,
      problem_url: session.problemUrl,
      problem_info: hasInfo ? problemInfoWithPause : null,
      start_time: session.startTime,
      end_time: session.endTime || null,
      duration_seconds: session.durationSeconds ?? null,
      status: session.status,
      rating_delta: session.ratingDelta ?? null,
    });

    if (error) {
      console.error('Supabase saveSolveSession error:', error);
      // Still save to localStorage as backup so we don't lose data
    } else {
      // Also sync to localStorage so both are consistent
      _saveToLocalStorage(session);
      return;
    }
  }

  _saveToLocalStorage(session);
}

function _saveToLocalStorage(session: SolveSession): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const allSessions: SolveSession[] = raw ? JSON.parse(raw) : [];

    const idx = allSessions.findIndex(s => s.id === session.id);
    if (idx >= 0) {
      allSessions[idx] = session;
    } else {
      allSessions.push(session);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(allSessions));
  } catch (err) {
    console.error('Failed to save solve session to localStorage', err);
  }
}

export async function deleteSolveSession(id: string): Promise<void> {
  if (typeof window === 'undefined') return;

  if (isSupabaseConfigured()) {
    try {
      const { error } = await supabase.from('solve_sessions').delete().eq('id', id);
      if (error) console.error('Supabase deleteSolveSession error:', error);
    } catch (err) {
      console.error('Supabase deleteSolveSession error:', err);
    }
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const allSessions: SolveSession[] = JSON.parse(raw);
      const filtered = allSessions.filter(s => s.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    }
  } catch (err) {
    console.error('Failed to delete solve session from localStorage', err);
  }
}

/**
 * Get the active session for a handle.
 * Automatically abandons stale sessions (older than STALE_SESSION_MS).
 * Also checks for "zombie" active sessions — if a completed session already
 * exists for the same problem after the active session's start time, the
 * active one is auto-abandoned.
 */
export async function getActiveSession(handle: string): Promise<SolveSession | null> {
  const sessions = await getSolveSessions(handle);
  const active = sessions.find(s => s.status === 'active');

  if (!active) return null;

  // For stale detection: if paused, measure from when it was paused, not from start
  const referenceTime = active.pausedAt
    ? new Date(active.pausedAt).getTime()
    : new Date(active.startTime).getTime();
  const ageMs = Date.now() - referenceTime;

  // Auto-abandon sessions idle for longer than 6 hours
  if (ageMs > STALE_SESSION_MS) {
    console.warn(`Auto-abandoning stale session ${active.id} (idle: ${Math.floor(ageMs / 60000)}min)`);
    const abandoned: SolveSession = {
      ...active,
      status: 'abandoned',
      endTime: new Date().toISOString(),
      durationSeconds: active.pausedElapsed ?? Math.floor((Date.now() - new Date(active.startTime).getTime()) / 1000),
      pausedElapsed: undefined,
      pausedAt: undefined,
    };
    await saveSolveSession(abandoned);
    return null;
  }

  // Check for zombie: if we already have a completed session for the same
  // problem URL that was completed AFTER this active session started, the
  // active session is a stale duplicate (e.g. from a page refresh race).
  const activeStart = new Date(active.startTime).getTime();
  const alreadyCompleted = sessions.find(s =>
    s.id !== active.id &&
    s.status === 'completed' &&
    s.problemUrl === active.problemUrl &&
    new Date(s.startTime).getTime() >= activeStart - 60000 // within 1 min of same start
  );

  if (alreadyCompleted) {
    console.warn(`Deleting zombie session ${active.id} — already completed as ${alreadyCompleted.id}`);
    await deleteSolveSession(active.id);
    return null;
  }

  return active;
}

/**
 * Check whether a problem URL already has a completed session
 * whose start time is close to the given start time (within 2 minutes).
 * Prevents duplicate completion entries.
 */
export async function hasRecentCompletion(
  handle: string,
  problemUrl: string,
  sessionStartTime: string
): Promise<boolean> {
  const sessions = await getSolveSessions(handle);
  const startMs = new Date(sessionStartTime).getTime();

  return sessions.some(s =>
    s.status === 'completed' &&
    s.problemUrl === problemUrl &&
    Math.abs(new Date(s.startTime).getTime() - startMs) < 2 * 60 * 1000
  );
}
