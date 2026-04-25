// ============================================================
// CF Coach — Pure Analytics Engine (No AI needed)
// ============================================================

import { format, subDays, startOfWeek, differenceInDays, parseISO } from 'date-fns';
import {
  CFSubmission,
  CFUser,
  CFRatingChange,
  TagStats,
  DifficultyBucket,
  DailyActivity,
  StreakInfo,
  AnalyticsSummary,
  TimeRange,
  TIME_RANGE_DAYS,
  WeeklyDifficultyPoint,
  ProblemRatingPoint,
  RatingPrediction,
} from './types';
import { getSubmissionsInTimeRange, getUniqueSolvedProblems } from './codeforces';

// --- Tag Analysis ---

export function computeTagStats(submissions: CFSubmission[]): TagStats[] {
  const tagMap = new Map<string, { solved: number; attempted: number; totalDifficulty: number }>();

  for (const sub of submissions) {
    for (const tag of sub.problem.tags) {
      if (!tagMap.has(tag)) {
        tagMap.set(tag, { solved: 0, attempted: 0, totalDifficulty: 0 });
      }
      const stats = tagMap.get(tag)!;
      stats.attempted++;
      if (sub.verdict === 'OK') {
        stats.solved++;
        if (sub.problem.rating) {
          stats.totalDifficulty += sub.problem.rating;
        }
      }
    }
  }

  return Array.from(tagMap.entries())
    .map(([tag, stats]) => ({
      tag,
      solved: stats.solved,
      attempted: stats.attempted,
      solveRate: stats.attempted > 0 ? Math.round((stats.solved / stats.attempted) * 100) : 0,
      avgDifficulty: stats.solved > 0 ? Math.round(stats.totalDifficulty / stats.solved) : 0,
    }))
    .sort((a, b) => b.solved - a.solved);
}

// --- Difficulty Distribution ---

export function computeDifficultyDistribution(submissions: CFSubmission[]): DifficultyBucket[] {
  const solved = getUniqueSolvedProblems(submissions);
  const bucketMap = new Map<number, number>();

  for (const sub of solved) {
    const rating = sub.problem.rating;
    if (rating) {
      // Round to nearest 100
      const bucket = Math.round(rating / 100) * 100;
      bucketMap.set(bucket, (bucketMap.get(bucket) || 0) + 1);
    }
  }

  return Array.from(bucketMap.entries())
    .map(([rating, count]) => ({ rating, count }))
    .sort((a, b) => a.rating - b.rating);
}

// --- Daily Activity ---

export function computeDailyActivity(submissions: CFSubmission[], days: number): DailyActivity[] {
  const dailyMap = new Map<string, { count: number; problems: Set<string>; maxDiff: number }>();

  // Initialize all days
  for (let i = 0; i < days; i++) {
    const date = format(subDays(new Date(), i), 'yyyy-MM-dd');
    dailyMap.set(date, { count: 0, problems: new Set(), maxDiff: 0 });
  }

  const accepted = submissions.filter((s) => s.verdict === 'OK');
  for (const sub of accepted) {
    const date = format(new Date(sub.creationTimeSeconds * 1000), 'yyyy-MM-dd');
    if (dailyMap.has(date)) {
      const entry = dailyMap.get(date)!;
      const problemKey = `${sub.problem.contestId}-${sub.problem.index}`;
      if (!entry.problems.has(problemKey)) {
        entry.count++;
        entry.problems.add(problemKey);
        if (sub.problem.rating && sub.problem.rating > entry.maxDiff) {
          entry.maxDiff = sub.problem.rating;
        }
      }
    }
  }

  return Array.from(dailyMap.entries())
    .map(([date, data]) => ({
      date,
      count: data.count,
      problems: Array.from(data.problems),
      maxDifficulty: data.maxDiff,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// --- Streak Detection ---

export function computeStreak(submissions: CFSubmission[]): StreakInfo {
  const accepted = submissions.filter((s) => s.verdict === 'OK');
  if (accepted.length === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      lastActiveDate: '',
      isOnBreak: true,
      breakDays: 999,
    };
  }

  // Get unique active dates
  const activeDates = new Set<string>();
  for (const sub of accepted) {
    activeDates.add(format(new Date(sub.creationTimeSeconds * 1000), 'yyyy-MM-dd'));
  }

  const sortedDates = Array.from(activeDates).sort();
  const lastActive = sortedDates[sortedDates.length - 1];
  const today = format(new Date(), 'yyyy-MM-dd');
  const daysSinceLastActive = differenceInDays(parseISO(today), parseISO(lastActive));

  // Calculate current streak (backwards from today/last active)
  let currentStreak = 0;
  let checkDate = daysSinceLastActive <= 1 ? new Date() : parseISO(lastActive);

  while (true) {
    const dateStr = format(checkDate, 'yyyy-MM-dd');
    if (activeDates.has(dateStr)) {
      currentStreak++;
      checkDate = subDays(checkDate, 1);
    } else {
      break;
    }
  }

  // Calculate longest streak
  let longestStreak = 0;
  let tempStreak = 1;
  for (let i = 1; i < sortedDates.length; i++) {
    const diff = differenceInDays(parseISO(sortedDates[i]), parseISO(sortedDates[i - 1]));
    if (diff === 1) {
      tempStreak++;
    } else {
      longestStreak = Math.max(longestStreak, tempStreak);
      tempStreak = 1;
    }
  }
  longestStreak = Math.max(longestStreak, tempStreak);

  return {
    currentStreak,
    longestStreak,
    lastActiveDate: lastActive,
    isOnBreak: daysSinceLastActive > 2,
    breakDays: daysSinceLastActive,
  };
}

// --- Smarter Practice Quality & Profiling ---

export function computePracticeQuality(
  submissions: CFSubmission[],
  ratingHistory: CFRatingChange[],
  userRating: number,
  days: number
): {
  score: number;
  contestScore: number;
  userProfile: 'practice_focused' | 'contest_specialist' | 'balanced';
} {
  const cutoff = Date.now() / 1000 - days * 86400;
  const recentSubmissions = submissions.filter(s => s.creationTimeSeconds >= cutoff);
  const recentContests = ratingHistory.filter(c => c.ratingUpdateTimeSeconds >= cutoff);
  const solved = getUniqueSolvedProblems(recentSubmissions);
  
  // 1. Difficulty Alignment Score
  let difficultyScore = 0;
  if (solved.length > 0) {
    let rawScore = 0;
    for (const sub of solved) {
      const problemRating = sub.problem.rating || 800;
      const diff = problemRating - userRating;
      if (diff >= -200 && diff <= 300) {
        rawScore += 80 + (diff > 0 ? Math.min(diff / 15, 20) : 0);
      } else if (diff > 300) {
        rawScore += 90;
      } else if (diff < -200) {
        const penalty = Math.min(Math.abs(diff + 200) / 10, 60);
        rawScore += Math.max(20, 60 - penalty);
      }
    }
    difficultyScore = rawScore / solved.length;
  }

  // 2. Contest Performance Score
  let contestScore = 0;
  if (recentContests.length > 0) {
    let rawContestScore = 0;
    for (const contest of recentContests) {
      const delta = contest.newRating - contest.oldRating;
      
      // High rating adjustment curve
      // At 1200, losing 20 pts is bad. At 3000, losing 20 pts is normal/expected.
      const highRatingBuffer = Math.max(0, (contest.oldRating - 2000) / 50); // e.g. at 3000, buffer is 20
      const adjustedDelta = delta + highRatingBuffer;

      if (adjustedDelta > 0) {
        rawContestScore += Math.min(100, 50 + adjustedDelta * 1.5);
      } else if (adjustedDelta === 0) {
        rawContestScore += 50;
      } else {
        rawContestScore += Math.max(0, 50 + adjustedDelta); // drops below 50 for negative delta
      }
    }
    contestScore = rawContestScore / recentContests.length;
  } else {
    contestScore = 50; // Neutral if no contests
  }

  // Determine Profile
  let userProfile: 'practice_focused' | 'contest_specialist' | 'balanced' = 'balanced';
  if (recentContests.length >= 2 && solved.length < 5) {
    userProfile = 'contest_specialist';
  } else if (recentContests.length === 0 && solved.length > 10) {
    userProfile = 'practice_focused';
  }

  // Composite Score
  let finalScore = 0;
  if (userProfile === 'contest_specialist') {
    finalScore = (contestScore * 0.8) + (difficultyScore * 0.2);
  } else if (userProfile === 'practice_focused') {
    finalScore = (difficultyScore * 0.8) + (contestScore * 0.2);
  } else {
    finalScore = (difficultyScore * 0.6) + (contestScore * 0.4);
  }

  return {
    score: Math.round(finalScore),
    contestScore: Math.round(contestScore),
    userProfile
  };
}

// --- Rating Predictor ---

export function predictRatingDelta(
  submissions: CFSubmission[],
  ratingHistory: CFRatingChange[],
  userRating: number,
  days: number
): RatingPrediction {
  const cutoff = Date.now() / 1000 - days * 86400;
  const recentSubmissions = submissions.filter(s => s.creationTimeSeconds >= cutoff);
  const recentContests = ratingHistory.filter(c => c.ratingUpdateTimeSeconds >= cutoff);
  const solved = getUniqueSolvedProblems(recentSubmissions);

  if (solved.length === 0 && recentContests.length === 0) {
    return { predictedDelta: 0, confidence: 'low', reasoning: 'Not enough recent activity to predict.' };
  }

  let predictedDelta = 0;
  let reasons: string[] = [];
  
  // Signal 1: Contest momentum
  if (recentContests.length > 0) {
    const recentDeltas = recentContests.map(c => c.newRating - c.oldRating);
    const avgDelta = recentDeltas.reduce((a,b) => a+b, 0) / recentDeltas.length;
    if (avgDelta > 15) {
      predictedDelta += 15;
      reasons.push('Strong positive momentum in recent contests.');
    } else if (avgDelta > 0) {
      predictedDelta += 5;
    } else if (avgDelta < -20) {
      predictedDelta -= 10;
      reasons.push('Recent contest performance has been dipping.');
    }
  }

  // Signal 2: Practice difficulty
  if (solved.length > 5) {
    const ratings = solved.map(s => s.problem.rating || userRating);
    const avgDiff = ratings.reduce((a,b) => a+b, 0) / ratings.length;
    
    if (avgDiff > userRating + 100) {
      predictedDelta += 20;
      reasons.push(`Consistently solving problems ~${Math.round(avgDiff - userRating)} points above your rating.`);
    } else if (avgDiff > userRating) {
      predictedDelta += 10;
      reasons.push('Practicing slightly above your current rating.');
    } else if (avgDiff < userRating - 200) {
      predictedDelta -= 5;
      reasons.push('Practice problems are significantly below your rating (comfort zone).');
    }
  }

  // Floor at 0 (we don't want to show negative predictions, just "Steady")
  predictedDelta = Math.max(0, Math.round(predictedDelta));

  let confidence: 'low' | 'medium' | 'high' = 'low';
  if (recentContests.length >= 2 && solved.length >= 10) confidence = 'high';
  else if (recentContests.length >= 1 || solved.length >= 5) confidence = 'medium';

  return {
    predictedDelta,
    confidence,
    reasoning: reasons.join(' ') || 'Maintaining current skill level.',
  };
}

// --- Full Analytics Summary ---

export function computeAnalytics(
  submissions: CFSubmission[],
  ratingHistory: CFRatingChange[],
  userInfo: CFUser,
  timeRange: TimeRange
): AnalyticsSummary {
  const days = TIME_RANGE_DAYS[timeRange];
  const filtered = timeRange === 'all' ? submissions : getSubmissionsInTimeRange(submissions, days);
  const solved = getUniqueSolvedProblems(filtered);

  const ratings = solved
    .map((s) => s.problem.rating)
    .filter((r): r is number => r !== undefined);

  const avgDifficulty = ratings.length > 0
    ? Math.round(ratings.reduce((a, b) => a + b, 0) / ratings.length)
    : 0;

  // Compute rating trend from recent submissions difficulty
  const recentSolved = solved.slice(0, Math.min(10, solved.length));
  const olderSolved = solved.slice(Math.min(10, solved.length));
  const recentAvg = recentSolved.length > 0
    ? recentSolved.reduce((a, s) => a + (s.problem.rating || 800), 0) / recentSolved.length
    : 0;
  const olderAvg = olderSolved.length > 0
    ? olderSolved.reduce((a, s) => a + (s.problem.rating || 800), 0) / olderSolved.length
    : 0;

  let ratingTrend: 'rising' | 'falling' | 'stagnant' = 'stagnant';
  if (recentAvg > olderAvg + 50) ratingTrend = 'rising';
  else if (recentAvg < olderAvg - 50) ratingTrend = 'falling';

  const practiceQuality = computePracticeQuality(filtered, ratingHistory, userInfo.rating, days);
  const prediction = predictRatingDelta(filtered, ratingHistory, userInfo.rating, days);

  return {
    totalSolved: solved.length,
    totalAttempted: filtered.length,
    uniqueProblemsSolved: solved.length,
    solveRate: filtered.length > 0 ? Math.round((solved.length / new Set(filtered.map(s => `${s.problem.contestId}-${s.problem.index}`)).size) * 100) : 0,
    avgDifficulty,
    maxDifficulty: ratings.length > 0 ? Math.max(...ratings) : 0,
    tagStats: computeTagStats(filtered),
    difficultyDistribution: computeDifficultyDistribution(filtered),
    dailyActivity: computeDailyActivity(filtered, Math.min(days, 365)),
    streak: computeStreak(submissions), // Streak is always computed on all submissions
    ratingTrend,
    practiceQualityScore: practiceQuality.score,
    contestPerformanceScore: practiceQuality.contestScore,
    userProfile: practiceQuality.userProfile,
    ratingPrediction: prediction,
  };
}

// ----------------------------------------------------------------
// Weekly difficulty trend — avg + median per calendar week
// ----------------------------------------------------------------

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

export function computeWeeklyDifficultyTrend(
  submissions: CFSubmission[]
): WeeklyDifficultyPoint[] {
  const solved = getUniqueSolvedProblems(submissions);

  // Group by week start (Monday)
  const weekMap = new Map<string, number[]>();

  for (const sub of solved) {
    const rating = sub.problem.rating;
    if (!rating) continue;

    const date = new Date(sub.creationTimeSeconds * 1000);
    const weekStart = format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd');

    if (!weekMap.has(weekStart)) weekMap.set(weekStart, []);
    weekMap.get(weekStart)!.push(rating);
  }

  return Array.from(weekMap.entries())
    .map(([weekStart, ratings]) => ({
      weekStart,
      weekLabel: format(parseISO(weekStart), 'MMM dd'),
      avg: Math.round(ratings.reduce((a, b) => a + b, 0) / ratings.length),
      median: median(ratings),
      min: Math.min(...ratings),
      max: Math.max(...ratings),
      count: ratings.length,
    }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

// ----------------------------------------------------------------
// Problem rating scatter — one point per unique solved problem
// ----------------------------------------------------------------

export function computeProblemRatingScatter(
  submissions: CFSubmission[]
): ProblemRatingPoint[] {
  const solved = getUniqueSolvedProblems(submissions);

  return solved
    .filter(sub => sub.problem.rating)
    .map(sub => ({
      date: new Date(sub.creationTimeSeconds * 1000).toISOString(),
      dateLabel: format(new Date(sub.creationTimeSeconds * 1000), 'MMM dd, yyyy'),
      rating: sub.problem.rating!,
      name: sub.problem.name,
      contestId: sub.problem.contestId,
      index: sub.problem.index,
      tags: sub.problem.tags,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
