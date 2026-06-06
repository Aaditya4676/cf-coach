// ============================================================
// CF Coach — Codeforces API Client
// ============================================================

import {
  CFUser,
  CFSubmission,
  CFRatingChange,
  CFProblem,
  CFApiResponse,
} from './types';

const CF_API_BASE = 'https://codeforces.com/api';
const RATE_LIMIT_MS = 250; // 4 req/sec (staying under 5/sec limit)

let lastRequestTime = 0;

async function rateLimitedFetch<T>(endpoint: string): Promise<T> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < RATE_LIMIT_MS) {
    await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_MS - timeSinceLastRequest));
  }
  lastRequestTime = Date.now();

  const response = await fetch(`${CF_API_BASE}/${endpoint}`, {
    next: { revalidate: 300 }, // Cache for 5 minutes in Next.js
  });

  if (!response.ok) {
    throw new Error(`Codeforces API error: ${response.status} ${response.statusText}`);
  }

  const data: CFApiResponse<T> = await response.json();

  if (data.status === 'FAILED') {
    throw new Error(`Codeforces API: ${data.comment || 'Unknown error'}`);
  }

  return data.result as T;
}

// --- Public API Methods ---

export async function getUserInfo(handle: string): Promise<CFUser> {
  const result = await rateLimitedFetch<CFUser[]>(`user.info?handles=${handle}`);
  return result[0];
}

export async function getUserSubmissions(
  handle: string,
  from: number = 1,
  count?: number
): Promise<CFSubmission[]> {
  let endpoint = `user.status?handle=${handle}&from=${from}`;
  if (count) endpoint += `&count=${count}`;
  return rateLimitedFetch<CFSubmission[]>(endpoint);
}

export async function getUserRatingHistory(handle: string): Promise<CFRatingChange[]> {
  return rateLimitedFetch<CFRatingChange[]>(`user.rating?handle=${handle}`);
}

export async function getAllProblems(tags?: string[]): Promise<{ problems: CFProblem[]; problemStatistics: { contestId: number; index: string; solvedCount: number }[] }> {
  let endpoint = 'problemset.problems';
  if (tags && tags.length > 0) {
    endpoint += `?tags=${tags.join(';')}`;
  }
  return rateLimitedFetch(endpoint);
}

export async function getContestProblems(contestId: number): Promise<CFProblem[]> {
  const result = await rateLimitedFetch<any>(`contest.standings?contestId=${contestId}`);
  return result.problems;
}

// --- Helper Functions ---

export function getSubmissionsInTimeRange(
  submissions: CFSubmission[],
  days: number
): CFSubmission[] {
  const cutoff = Date.now() / 1000 - days * 86400;
  return submissions.filter((s) => s.creationTimeSeconds >= cutoff);
}

export function getAcceptedSubmissions(submissions: CFSubmission[]): CFSubmission[] {
  return submissions.filter((s) => s.verdict === 'OK');
}

export function getUniqueSolvedProblems(submissions: CFSubmission[]): CFSubmission[] {
  const seen = new Set<string>();
  const unique: CFSubmission[] = [];
  for (const sub of submissions) {
    if (sub.verdict === 'OK') {
      const key = `${sub.problem.contestId}-${sub.problem.index}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(sub);
      }
    }
  }
  return unique;
}

export function getProblemUrl(contestId: number, index: string): string {
  return `https://codeforces.com/problemset/problem/${contestId}/${index}`;
}

export function getProblemId(problem: CFProblem): string {
  return `${problem.contestId}/${problem.index}`;
}

/**
 * Hash submissions for cache invalidation.
 * Returns a simple hash of submission IDs.
 */
export function hashSubmissions(submissions: CFSubmission[]): string {
  const ids = submissions.map((s) => s.id).sort().join(',');
  let hash = 0;
  for (let i = 0; i < ids.length; i++) {
    const char = ids.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash.toString(36);
}
