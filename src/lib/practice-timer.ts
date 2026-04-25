import { getProblemId } from './codeforces';
import { CFProblem } from './types';

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

export function getSolveSessions(handle: string): SolveSession[] {
  if (typeof window === 'undefined') return [];
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

export function saveSolveSession(session: SolveSession): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    let allSessions: SolveSession[] = raw ? JSON.parse(raw) : [];
    
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

export function getActiveSession(handle: string): SolveSession | null {
  const sessions = getSolveSessions(handle);
  return sessions.find(s => s.status === 'active') || null;
}
