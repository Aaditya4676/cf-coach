// ============================================================
// CF Coach — Spaced Repetition (SM-2 Algorithm)
// ============================================================

import { addDays, format, isAfter, isBefore, isToday, parseISO } from 'date-fns';
import { ReviewItem } from './types';

/**
 * SM-2 Algorithm adapted for competitive programming.
 * 
 * Quality scale:
 * 0 - Complete failure (couldn't solve, needed editorial)
 * 1 - Serious difficulty (solved with heavy hints)
 * 2 - Moderate difficulty (solved but with struggle)
 * 3 - Solved correctly with some hesitation
 * 4 - Solved correctly with minor issues
 * 5 - Perfect recall (solved quickly and cleanly)
 */
export function updateReviewItem(item: ReviewItem, quality: number): ReviewItem {
  // Clamp quality to 0-5
  quality = Math.max(0, Math.min(5, quality));

  let newEaseFactor = item.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  newEaseFactor = Math.max(1.3, newEaseFactor); // Minimum ease factor

  let newInterval: number;
  let newMastery: number;

  if (quality < 3) {
    // Failed - reset interval but keep some mastery
    newInterval = 1;
    newMastery = Math.max(0, item.masteryLevel - 1);
  } else {
    // Passed
    if (item.reviewCount === 0) {
      newInterval = 1;
    } else if (item.reviewCount === 1) {
      newInterval = 3;
    } else {
      newInterval = Math.round(item.intervalDays * newEaseFactor);
    }
    newMastery = Math.min(5, item.masteryLevel + 1);
  }

  const today = new Date();

  return {
    ...item,
    easeFactor: newEaseFactor,
    intervalDays: newInterval,
    masteryLevel: newMastery,
    nextReview: format(addDays(today, newInterval), 'yyyy-MM-dd'),
    lastReviewed: today.toISOString(),
    reviewCount: item.reviewCount + 1,
  };
}

/**
 * Get items due for review today or overdue
 */
export function getDueReviewItems(items: ReviewItem[]): ReviewItem[] {
  const today = new Date();
  return items.filter(item => {
    if (!item.nextReview) return true;
    const reviewDate = parseISO(item.nextReview);
    return isBefore(reviewDate, today) || isToday(reviewDate);
  }).sort((a, b) => {
    // Overdue items first, then by mastery level (weakest first)
    const aDate = parseISO(a.nextReview);
    const bDate = parseISO(b.nextReview);
    if (isBefore(aDate, bDate)) return -1;
    if (isAfter(aDate, bDate)) return 1;
    return a.masteryLevel - b.masteryLevel;
  });
}

/**
 * Create a new review item from a solved problem
 */
export function createReviewItem(
  problemId: string,
  problemName: string,
  problemRating: number,
  tags: string[]
): ReviewItem {
  return {
    id: crypto.randomUUID(),
    problemId,
    problemName,
    problemRating,
    tags,
    masteryLevel: 1,
    easeFactor: 2.5,
    intervalDays: 1,
    nextReview: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
    lastReviewed: new Date().toISOString(),
    reviewCount: 0,
  };
}

/**
 * Get mastery stats across all topics
 */
export function getMasteryStats(items: ReviewItem[]): Map<string, { count: number; avgMastery: number }> {
  const tagMap = new Map<string, { total: number; count: number }>();

  for (const item of items) {
    for (const tag of item.tags) {
      if (!tagMap.has(tag)) {
        tagMap.set(tag, { total: 0, count: 0 });
      }
      const stats = tagMap.get(tag)!;
      stats.total += item.masteryLevel;
      stats.count++;
    }
  }

  const result = new Map<string, { count: number; avgMastery: number }>();
  for (const [tag, stats] of tagMap) {
    result.set(tag, {
      count: stats.count,
      avgMastery: Math.round((stats.total / stats.count) * 10) / 10,
    });
  }
  return result;
}
