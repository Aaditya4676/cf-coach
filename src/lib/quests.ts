import { Quest, VirtualProfile, ActionItem } from './types';
import { supabase, isSupabaseConfigured } from './storage';

const INITIAL_PROFILE: VirtualProfile = {
  level: 1,
  xp: 0,
  totalXPEarned: 0,
  questsCompleted: 0,
  questsFailed: 0,
  streakMultipler: 1.0,
};

const XP_PER_LEVEL = 100;

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

// --- Quests ---

export async function getQuests(handle: string): Promise<Quest[]> {
  if (typeof window === 'undefined') return [];

  if (isSupabaseConfigured()) {
    try {
      const profileId = await ensureProfile(handle);
      const { data, error } = await supabase
        .from('quests')
        .select('*')
        .eq('profile_id', profileId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map((d: any) => ({
        id: d.id,
        title: d.title,
        description: d.description,
        xpReward: d.xp_reward,
        targetDate: d.target_date,
        relatedTags: d.related_tags || [],
        status: d.status,
        feedback: d.feedback,
        createdAt: d.created_at,
        completedAt: d.completed_at,
        assessedSubmissions: d.assessed_submissions,
      }));
    } catch (err) {
      console.error('Supabase getQuests error, falling back to localStorage', err);
    }
  }

  // localStorage fallback
  const stored = localStorage.getItem(`quests_${handle}`);
  return stored ? JSON.parse(stored) : [];
}

export async function saveQuests(handle: string, quests: Quest[]): Promise<void> {
  if (typeof window === 'undefined') return;

  if (isSupabaseConfigured()) {
    try {
      const profileId = await ensureProfile(handle);
      // Upsert all quests
      const rows = quests.map(q => ({
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
      await supabase.from('quests').upsert(rows);
      return;
    } catch (err) {
      console.error('Supabase saveQuests error, falling back to localStorage', err);
    }
  }

  // localStorage fallback
  localStorage.setItem(`quests_${handle}`, JSON.stringify(quests));
}

// --- Virtual Profile ---

export async function getVirtualProfile(handle: string): Promise<VirtualProfile> {
  if (typeof window === 'undefined') return INITIAL_PROFILE;

  if (isSupabaseConfigured()) {
    try {
      const profileId = await ensureProfile(handle);
      const { data, error } = await supabase
        .from('virtual_profiles')
        .select('*')
        .eq('profile_id', profileId)
        .single();

      if (error || !data) return INITIAL_PROFILE;

      return {
        level: data.level,
        xp: data.xp,
        totalXPEarned: data.total_xp_earned,
        questsCompleted: data.quests_completed,
        questsFailed: data.quests_failed,
        streakMultipler: data.streak_multiplier,
      };
    } catch (err) {
      console.error('Supabase getVirtualProfile error, falling back to localStorage', err);
    }
  }

  // localStorage fallback
  const stored = localStorage.getItem(`profile_${handle}`);
  return stored ? JSON.parse(stored) : INITIAL_PROFILE;
}

export async function saveVirtualProfile(handle: string, profile: VirtualProfile): Promise<void> {
  if (typeof window === 'undefined') return;

  if (isSupabaseConfigured()) {
    try {
      const profileId = await ensureProfile(handle);
      await supabase.from('virtual_profiles').upsert({
        profile_id: profileId,
        level: profile.level,
        xp: profile.xp,
        total_xp_earned: profile.totalXPEarned,
        quests_completed: profile.questsCompleted,
        quests_failed: profile.questsFailed,
        streak_multiplier: profile.streakMultipler,
      }, { onConflict: 'profile_id' });
      return;
    } catch (err) {
      console.error('Supabase saveVirtualProfile error, falling back to localStorage', err);
    }
  }

  // localStorage fallback
  localStorage.setItem(`profile_${handle}`, JSON.stringify(profile));
}

/**
 * Add XP to profile and handle level ups
 */
export async function addXP(handle: string, amount: number): Promise<VirtualProfile> {
  const profile = await getVirtualProfile(handle);

  let newXp = profile.xp + amount;
  let newLevel = profile.level;

  while (newXp >= XP_PER_LEVEL) {
    newXp -= XP_PER_LEVEL;
    newLevel++;
  }

  const updated: VirtualProfile = {
    ...profile,
    level: newLevel,
    xp: newXp,
    totalXPEarned: profile.totalXPEarned + amount,
    questsCompleted: profile.questsCompleted + 1,
  };

  await saveVirtualProfile(handle, updated);
  return updated;
}

/**
 * Handle failed quest
 */
export async function recordFailedQuest(handle: string): Promise<VirtualProfile> {
  const profile = await getVirtualProfile(handle);
  const updated: VirtualProfile = {
    ...profile,
    questsFailed: profile.questsFailed + 1,
  };
  await saveVirtualProfile(handle, updated);
  return updated;
}

/**
 * Generate Quests from LLM Action Items
 */
export async function convertActionItemsToQuests(handle: string, items: ActionItem[]): Promise<Quest[]> {
  const existing = await getQuests(handle);

  // Prevent stacking: if there are active quests, don't add new ones
  const activeQuests = existing.filter(q => q.status === 'active');
  if (activeQuests.length > 0) {
    return [];
  }

  const xpMap = {
    high: 50,
    medium: 20,
    low: 5
  };

  // Set deadline to 7 days from now
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + 7);

  const newQuests: Quest[] = items.map(item => ({
    id: crypto.randomUUID(),
    title: item.action,
    description: item.reason,
    xpReward: xpMap[item.priority] || 10,
    targetDate: targetDate.toISOString(),
    relatedTags: item.relatedTags || [],
    status: 'active',
    createdAt: new Date().toISOString()
  }));

  await saveQuests(handle, [...existing, ...newQuests]);
  return newQuests;
}
