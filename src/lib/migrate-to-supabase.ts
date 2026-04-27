/**
 * One-time migration: push all localStorage data to Supabase.
 * Safe to run multiple times — uses upsert so it won't duplicate.
 */

import { supabase, isSupabaseConfigured } from './storage';
import type { SolveSession } from './practice-timer';

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

export interface MigrationResult {
  success: boolean;
  migrated: {
    sessions: number;
    quests: number;
    analyses: number;
    progress: number;
    ladders: number;
    reviews: number;
    memory: number;
    profile: boolean;
  };
  errors: string[];
}

export async function migrateLocalStorageToSupabase(cfHandle: string): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: false,
    migrated: { sessions: 0, quests: 0, analyses: 0, progress: 0, ladders: 0, reviews: 0, memory: 0, profile: false },
    errors: [],
  };

  if (!isSupabaseConfigured()) {
    result.errors.push('Supabase is not configured (missing env vars)');
    return result;
  }

  try {
    // 1. Ensure profile exists
    const profileId = await ensureProfile(cfHandle);
    result.migrated.profile = true;

    // 2. Migrate Solve Sessions
    try {
      const raw = localStorage.getItem('cf_coach_solve_sessions');
      if (raw) {
        const sessions: SolveSession[] = JSON.parse(raw);
        const userSessions = sessions.filter(s => s.handle === cfHandle);
        if (userSessions.length > 0) {
          const rows = userSessions.map(s => ({
            id: s.id,
            profile_id: profileId,
            problem_url: s.problemUrl,
            problem_info: s.problemInfo || null,
            start_time: s.startTime,
            end_time: s.endTime || null,
            duration_seconds: s.durationSeconds || null,
            status: s.status,
            rating_delta: s.ratingDelta || null,
          }));
          const { error } = await supabase.from('solve_sessions').upsert(rows);
          if (error) throw error;
          result.migrated.sessions = userSessions.length;
        }
      }
    } catch (err: any) {
      result.errors.push(`Sessions: ${err.message}`);
    }

    // 3. Migrate Quests
    try {
      const raw = localStorage.getItem(`quests_${cfHandle}`);
      if (raw) {
        const quests = JSON.parse(raw);
        if (quests.length > 0) {
          const rows = quests.map((q: any) => ({
            id: q.id,
            profile_id: profileId,
            title: q.title,
            description: q.description,
            xp_reward: q.xpReward,
            target_date: q.targetDate,
            related_tags: q.relatedTags,
            status: q.status,
            feedback: q.feedback || null,
            created_at: q.createdAt,
            completed_at: q.completedAt || null,
            assessed_submissions: q.assessedSubmissions || null,
          }));
          const { error } = await supabase.from('quests').upsert(rows);
          if (error) throw error;
          result.migrated.quests = quests.length;
        }
      }
    } catch (err: any) {
      result.errors.push(`Quests: ${err.message}`);
    }

    // 4. Migrate Virtual Profile
    try {
      const raw = localStorage.getItem(`profile_${cfHandle}`);
      if (raw) {
        const p = JSON.parse(raw);
        const { error } = await supabase.from('virtual_profiles').upsert({
          profile_id: profileId,
          level: p.level,
          xp: p.xp,
          total_xp_earned: p.totalXPEarned,
          quests_completed: p.questsCompleted,
          quests_failed: p.questsFailed,
          streak_multiplier: p.streakMultipler,
        }, { onConflict: 'profile_id' });
        if (error) throw error;
      }
    } catch (err: any) {
      result.errors.push(`Virtual Profile: ${err.message}`);
    }

    // 5. Migrate Progress Snapshots
    try {
      const raw = localStorage.getItem(`progress_${cfHandle}`);
      if (raw) {
        const snapshots = JSON.parse(raw);
        if (snapshots.length > 0) {
          const rows = snapshots.map((s: any) => ({
            profile_id: profileId,
            date: s.date,
            rating: s.rating,
            problems_solved: s.problemsSolved,
            tags_practiced: s.tagsPracticed,
            difficulty_range: Array.isArray(s.difficultyRange) ? `[${s.difficultyRange[0]},${s.difficultyRange[1]}]` : s.difficultyRange,
            streak_days: s.streakDays,
            snapshot_data: s.snapshotData,
          }));
          const { error } = await supabase.from('progress_snapshots').upsert(rows, { onConflict: 'profile_id,date' });
          if (error) throw error;
          result.migrated.progress = snapshots.length;
        }
      }
    } catch (err: any) {
      result.errors.push(`Progress: ${err.message}`);
    }

    // 6. Migrate Ladders
    try {
      const raw = localStorage.getItem(`ladders_${cfHandle}`);
      if (raw) {
        const ladders = JSON.parse(raw);
        if (ladders.length > 0) {
          const rows = ladders.map((l: any) => ({
            id: l.id,
            profile_id: profileId,
            name: l.name,
            description: l.description,
            problems: l.problems,
            target_tags: l.targetTags,
            difficulty_range: Array.isArray(l.difficultyRange) ? `[${l.difficultyRange[0]},${l.difficultyRange[1]}]` : l.difficultyRange,
            total_problems: l.totalProblems,
            completed_problems: l.completedProblems,
            is_active: l.isActive,
          }));
          const { error } = await supabase.from('ladders').upsert(rows);
          if (error) throw error;
          result.migrated.ladders = ladders.length;
        }
      }
    } catch (err: any) {
      result.errors.push(`Ladders: ${err.message}`);
    }

    // 7. Migrate Review Items
    try {
      const raw = localStorage.getItem(`reviews_${cfHandle}`);
      if (raw) {
        const reviews = JSON.parse(raw);
        if (reviews.length > 0) {
          const rows = reviews.map((r: any) => ({
            id: r.id,
            profile_id: profileId,
            problem_id: r.problemId,
            problem_name: r.problemName,
            problem_rating: r.problemRating,
            tags: r.tags,
            mastery_level: r.masteryLevel,
            ease_factor: r.easeFactor,
            interval_days: r.intervalDays,
            next_review: r.nextReview,
            last_reviewed: r.lastReviewed,
            review_count: r.reviewCount,
          }));
          const { error } = await supabase.from('review_items').upsert(rows);
          if (error) throw error;
          result.migrated.reviews = reviews.length;
        }
      }
    } catch (err: any) {
      result.errors.push(`Reviews: ${err.message}`);
    }

    // 8. Migrate Mentor Memory
    try {
      const raw = localStorage.getItem(`memory_${cfHandle}`);
      if (raw) {
        const memories = JSON.parse(raw);
        if (memories.length > 0) {
          // Memory doesn't have a natural unique key, so insert with conflict handling
          for (const m of memories) {
            const { error } = await supabase.from('mentor_memory').upsert({
              id: m.id,
              profile_id: profileId,
              memory_type: m.type,
              content: m.content,
              metadata: m.metadata,
              created_at: m.createdAt,
            });
            if (error) throw error;
          }
          result.migrated.memory = memories.length;
        }
      }
    } catch (err: any) {
      result.errors.push(`Memory: ${err.message}`);
    }

    // 9. Migrate Analysis Caches
    try {
      const timeRanges = ['6months', '1year', '2years', 'all'];
      let count = 0;
      for (const tr of timeRanges) {
        const raw = localStorage.getItem(`analysis_${cfHandle}_${tr}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          const { error } = await supabase.from('analyses').upsert({
            profile_id: profileId,
            time_range: tr,
            analysis_data: parsed.analysis,
            submissions_hash: parsed.submissionsHash,
          }, { onConflict: 'profile_id,time_range' });
          if (error) throw error;
          count++;
        }
      }
      result.migrated.analyses = count;
    } catch (err: any) {
      result.errors.push(`Analyses: ${err.message}`);
    }

    result.success = result.errors.length === 0;
  } catch (err: any) {
    result.errors.push(`Fatal: ${err.message}`);
  }

  return result;
}
