// ============================================================
// CF Coach — Supabase Client
// ============================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

let _supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!_supabase) {
    _supabase = createClient(supabaseUrl, supabaseAnonKey);
  }
  return _supabase;
}

// Export as a getter so existing code using `supabase.from(...)` still works
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getSupabase() as any)[prop];
  },
});

// Check if Supabase is configured
export function isSupabaseConfigured(): boolean {
  return !!(supabaseUrl && supabaseAnonKey);
}

// ============================================================
// Storage Abstraction Layer
// Uses Supabase if configured, falls back to localStorage
// ============================================================

import type { MentorAnalysis, Ladder, ProgressSnapshot, MentorMemory, ReviewItem, ApiUsage } from './types';

// --- Analysis Cache ---

export async function saveAnalysis(
  cfHandle: string,
  timeRange: string,
  analysis: MentorAnalysis,
  submissionsHash: string
): Promise<void> {
  if (isSupabaseConfigured()) {
    const profileId = await ensureProfile(cfHandle);
    await supabase.from('analyses').upsert({
      profile_id: profileId,
      time_range: timeRange,
      analysis_data: analysis,
      submissions_hash: submissionsHash,
    }, { onConflict: 'profile_id,time_range' });
  } else {
    const key = `analysis_${cfHandle}_${timeRange}`;
    localStorage.setItem(key, JSON.stringify({ analysis, submissionsHash, timestamp: Date.now() }));
  }
}

export async function getCachedAnalysis(
  cfHandle: string,
  timeRange: string,
  currentHash: string
): Promise<MentorAnalysis | null> {
  if (isSupabaseConfigured()) {
    const profileId = await ensureProfile(cfHandle);
    const { data } = await supabase
      .from('analyses')
      .select('analysis_data, submissions_hash')
      .eq('profile_id', profileId)
      .eq('time_range', timeRange)
      .single();

    if (data && data.submissions_hash === currentHash) {
      return data.analysis_data as MentorAnalysis;
    }
    return null;
  } else {
    const key = `analysis_${cfHandle}_${timeRange}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.submissionsHash === currentHash) {
        return parsed.analysis as MentorAnalysis;
      }
    }
    return null;
  }
}

// --- Progress Snapshots ---

export async function saveProgressSnapshot(
  cfHandle: string,
  snapshot: Omit<ProgressSnapshot, 'id'>
): Promise<void> {
  if (isSupabaseConfigured()) {
    const profileId = await ensureProfile(cfHandle);
    await supabase.from('progress_snapshots').upsert({
      profile_id: profileId,
      date: snapshot.date,
      rating: snapshot.rating,
      problems_solved: snapshot.problemsSolved,
      tags_practiced: snapshot.tagsPracticed,
      difficulty_range: `[${snapshot.difficultyRange[0]},${snapshot.difficultyRange[1]}]`,
      streak_days: snapshot.streakDays,
      snapshot_data: snapshot.snapshotData,
    }, { onConflict: 'profile_id,date' });
  } else {
    const key = `progress_${cfHandle}`;
    const existing = JSON.parse(localStorage.getItem(key) || '[]');
    const idx = existing.findIndex((s: ProgressSnapshot) => s.date === snapshot.date);
    if (idx >= 0) existing[idx] = snapshot;
    else existing.push(snapshot);
    localStorage.setItem(key, JSON.stringify(existing));
  }
}

export async function getProgressHistory(cfHandle: string): Promise<ProgressSnapshot[]> {
  if (isSupabaseConfigured()) {
    const profileId = await ensureProfile(cfHandle);
    const { data } = await supabase
      .from('progress_snapshots')
      .select('*')
      .eq('profile_id', profileId)
      .order('date', { ascending: true });

    return (data || []).map((d) => ({
      id: d.id,
      date: d.date,
      rating: d.rating,
      problemsSolved: d.problems_solved,
      tagsPracticed: d.tags_practiced,
      difficultyRange: d.difficulty_range,
      streakDays: d.streak_days,
      snapshotData: d.snapshot_data,
    }));
  } else {
    const key = `progress_${cfHandle}`;
    return JSON.parse(localStorage.getItem(key) || '[]');
  }
}

// --- Ladders ---

export async function saveLadder(cfHandle: string, ladder: Ladder): Promise<void> {
  if (isSupabaseConfigured()) {
    const profileId = await ensureProfile(cfHandle);
    await supabase.from('ladders').upsert({
      id: ladder.id,
      profile_id: profileId,
      name: ladder.name,
      description: ladder.description,
      problems: ladder.problems,
      target_tags: ladder.targetTags,
      difficulty_range: `[${ladder.difficultyRange[0]},${ladder.difficultyRange[1]}]`,
      total_problems: ladder.totalProblems,
      completed_problems: ladder.completedProblems,
      is_active: ladder.isActive,
    });
  } else {
    const key = `ladders_${cfHandle}`;
    const existing = JSON.parse(localStorage.getItem(key) || '[]');
    const idx = existing.findIndex((l: Ladder) => l.id === ladder.id);
    if (idx >= 0) existing[idx] = ladder;
    else existing.push(ladder);
    localStorage.setItem(key, JSON.stringify(existing));
  }
}

export async function getLadders(cfHandle: string): Promise<Ladder[]> {
  if (isSupabaseConfigured()) {
    const profileId = await ensureProfile(cfHandle);
    const { data } = await supabase
      .from('ladders')
      .select('*')
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false });

    return (data || []).map((d) => ({
      id: d.id,
      name: d.name,
      description: d.description,
      problems: d.problems,
      targetTags: d.target_tags,
      difficultyRange: d.difficulty_range,
      totalProblems: d.total_problems,
      completedProblems: d.completed_problems,
      isActive: d.is_active,
      createdAt: d.created_at,
      updatedAt: d.updated_at,
    }));
  } else {
    const key = `ladders_${cfHandle}`;
    return JSON.parse(localStorage.getItem(key) || '[]');
  }
}

// --- Mentor Memory ---

export async function saveMentorMemory(
  cfHandle: string,
  memory: Omit<MentorMemory, 'id' | 'createdAt'>
): Promise<void> {
  if (isSupabaseConfigured()) {
    const profileId = await ensureProfile(cfHandle);
    await supabase.from('mentor_memory').insert({
      profile_id: profileId,
      memory_type: memory.type,
      content: memory.content,
      metadata: memory.metadata,
    });
  } else {
    const key = `memory_${cfHandle}`;
    const existing = JSON.parse(localStorage.getItem(key) || '[]');
    existing.push({ ...memory, id: crypto.randomUUID(), createdAt: new Date().toISOString() });
    localStorage.setItem(key, JSON.stringify(existing));
  }
}

export async function getMentorMemories(cfHandle: string): Promise<MentorMemory[]> {
  if (isSupabaseConfigured()) {
    const profileId = await ensureProfile(cfHandle);
    const { data } = await supabase
      .from('mentor_memory')
      .select('*')
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false })
      .limit(50);

    return (data || []).map((d) => ({
      id: d.id,
      type: d.memory_type,
      content: d.content,
      metadata: d.metadata,
      createdAt: d.created_at,
    }));
  } else {
    const key = `memory_${cfHandle}`;
    return JSON.parse(localStorage.getItem(key) || '[]');
  }
}

// --- Review Items ---

export async function saveReviewItem(cfHandle: string, item: ReviewItem): Promise<void> {
  if (isSupabaseConfigured()) {
    const profileId = await ensureProfile(cfHandle);
    await supabase.from('review_items').upsert({
      id: item.id,
      profile_id: profileId,
      problem_id: item.problemId,
      problem_name: item.problemName,
      problem_rating: item.problemRating,
      tags: item.tags,
      mastery_level: item.masteryLevel,
      ease_factor: item.easeFactor,
      interval_days: item.intervalDays,
      next_review: item.nextReview,
      last_reviewed: item.lastReviewed,
      review_count: item.reviewCount,
    });
  } else {
    const key = `reviews_${cfHandle}`;
    const existing = JSON.parse(localStorage.getItem(key) || '[]');
    const idx = existing.findIndex((r: ReviewItem) => r.id === item.id);
    if (idx >= 0) existing[idx] = item;
    else existing.push(item);
    localStorage.setItem(key, JSON.stringify(existing));
  }
}

export async function getReviewItems(cfHandle: string): Promise<ReviewItem[]> {
  if (isSupabaseConfigured()) {
    const profileId = await ensureProfile(cfHandle);
    const { data } = await supabase
      .from('review_items')
      .select('*')
      .eq('profile_id', profileId)
      .order('next_review', { ascending: true });

    return (data || []).map((d) => ({
      id: d.id,
      problemId: d.problem_id,
      problemName: d.problem_name,
      problemRating: d.problem_rating,
      tags: d.tags,
      masteryLevel: d.mastery_level,
      easeFactor: d.ease_factor,
      intervalDays: d.interval_days,
      nextReview: d.next_review,
      lastReviewed: d.last_reviewed,
      reviewCount: d.review_count,
    }));
  } else {
    const key = `reviews_${cfHandle}`;
    return JSON.parse(localStorage.getItem(key) || '[]');
  }
}

// --- API Usage Tracking ---

export async function getApiUsage(cfHandle: string): Promise<ApiUsage> {
  const today = new Date().toISOString().split('T')[0];

  if (isSupabaseConfigured()) {
    const profileId = await ensureProfile(cfHandle);
    const { data } = await supabase
      .from('api_usage')
      .select('*')
      .eq('profile_id', profileId)
      .eq('date', today)
      .single();

    return data
      ? { date: data.date, callsMade: data.calls_made, callsLimit: data.calls_limit }
      : { date: today, callsMade: 0, callsLimit: 20 };
  } else {
    const key = `api_usage_${cfHandle}_${today}`;
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : { date: today, callsMade: 0, callsLimit: 20 };
  }
}

export async function incrementApiUsage(cfHandle: string): Promise<ApiUsage> {
  const today = new Date().toISOString().split('T')[0];

  if (isSupabaseConfigured()) {
    const profileId = await ensureProfile(cfHandle);
    const current = await getApiUsage(cfHandle);
    const newCount = current.callsMade + 1;

    await supabase.from('api_usage').upsert({
      profile_id: profileId,
      date: today,
      calls_made: newCount,
      calls_limit: 20,
    }, { onConflict: 'profile_id,date' });

    return { date: today, callsMade: newCount, callsLimit: 20 };
  } else {
    const key = `api_usage_${cfHandle}_${today}`;
    const current = await getApiUsage(cfHandle);
    current.callsMade++;
    localStorage.setItem(key, JSON.stringify(current));
    return current;
  }
}

// --- Profile Management ---

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
