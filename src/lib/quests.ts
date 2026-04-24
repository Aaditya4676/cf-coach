import { Quest, VirtualProfile, ActionItem } from './types';

const INITIAL_PROFILE: VirtualProfile = {
  level: 1,
  xp: 0,
  totalXPEarned: 0,
  questsCompleted: 0,
  questsFailed: 0,
  streakMultipler: 1.0,
};

const XP_PER_LEVEL = 100;

export function getQuests(handle: string): Quest[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(`quests_${handle}`);
  return stored ? JSON.parse(stored) : [];
}

export function saveQuests(handle: string, quests: Quest[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`quests_${handle}`, JSON.stringify(quests));
}

export function getVirtualProfile(handle: string): VirtualProfile {
  if (typeof window === 'undefined') return INITIAL_PROFILE;
  const stored = localStorage.getItem(`profile_${handle}`);
  return stored ? JSON.parse(stored) : INITIAL_PROFILE;
}

export function saveVirtualProfile(handle: string, profile: VirtualProfile): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`profile_${handle}`, JSON.stringify(profile));
}

/**
 * Add XP to profile and handle level ups
 */
export function addXP(handle: string, amount: number): VirtualProfile {
  const profile = getVirtualProfile(handle);
  
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
  
  saveVirtualProfile(handle, updated);
  return updated;
}

/**
 * Handle failed quest
 */
export function recordFailedQuest(handle: string): VirtualProfile {
  const profile = getVirtualProfile(handle);
  const updated: VirtualProfile = {
    ...profile,
    questsFailed: profile.questsFailed + 1,
  };
  saveVirtualProfile(handle, updated);
  return updated;
}

/**
 * Generate Quests from LLM Action Items
 */
export function convertActionItemsToQuests(handle: string, items: ActionItem[]): Quest[] {
  const existing = getQuests(handle);
  
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
  
  saveQuests(handle, [...existing, ...newQuests]);
  return newQuests;
}
