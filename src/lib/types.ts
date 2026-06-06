// ============================================================
// CF Coach — TypeScript Type Definitions
// ============================================================

// --- Codeforces API Types ---

export interface CFUser {
  handle: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  country?: string;
  city?: string;
  organization?: string;
  contribution: number;
  rank: CFRank;
  rating: number;
  maxRank: CFRank;
  maxRating: number;
  lastOnlineTimeSeconds: number;
  registrationTimeSeconds: number;
  friendOfCount: number;
  avatar: string;
  titlePhoto: string;
}

export type CFRank =
  | 'newbie'
  | 'pupil'
  | 'specialist'
  | 'expert'
  | 'candidate master'
  | 'master'
  | 'international master'
  | 'grandmaster'
  | 'international grandmaster'
  | 'legendary grandmaster';

export interface CFProblem {
  contestId: number;
  index: string;
  name: string;
  type: 'PROGRAMMING' | 'QUESTION';
  points?: number;
  rating?: number;
  tags: string[];
  
  // Virtual Contest Tracking
  _contestProblems?: CFProblem[];
  _solvedProblems?: { index: string; solveTimeMs: number; durationSeconds: number; id: string }[];
}

export type CFVerdict =
  | 'OK'
  | 'WRONG_ANSWER'
  | 'TIME_LIMIT_EXCEEDED'
  | 'MEMORY_LIMIT_EXCEEDED'
  | 'RUNTIME_ERROR'
  | 'COMPILATION_ERROR'
  | 'CHALLENGED'
  | 'SKIPPED'
  | 'TESTING'
  | 'REJECTED'
  | 'PARTIAL'
  | 'FAILED';

export interface CFSubmission {
  id: number;
  contestId: number;
  creationTimeSeconds: number;
  relativeTimeSeconds: number;
  problem: CFProblem;
  author: {
    contestId: number;
    members: { handle: string }[];
    participantType: 'CONTESTANT' | 'PRACTICE' | 'VIRTUAL' | 'MANAGER' | 'OUT_OF_COMPETITION';
    ghost: boolean;
    startTimeSeconds: number;
  };
  programmingLanguage: string;
  verdict: CFVerdict;
  testset: string;
  passedTestCount: number;
  timeConsumedMillis: number;
  memoryConsumedBytes: number;
}

export interface CFRatingChange {
  contestId: number;
  contestName: string;
  handle: string;
  rank: number;
  ratingUpdateTimeSeconds: number;
  oldRating: number;
  newRating: number;
}

export interface CFApiResponse<T> {
  status: 'OK' | 'FAILED';
  result?: T;
  comment?: string;
}

// --- Analytics Types ---

export interface TagStats {
  tag: string;
  solved: number;
  attempted: number;
  solveRate: number; // 0-100
  avgDifficulty: number;
}

export interface DifficultyBucket {
  rating: number; // e.g., 800, 900, ...
  count: number;
}

export interface DailyActivity {
  date: string; // YYYY-MM-DD
  count: number;
  problems: string[];
  maxDifficulty: number;
}

export interface StreakInfo {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string;
  isOnBreak: boolean;
  breakDays: number;
}

export interface AnalyticsSummary {
  totalSolved: number;
  totalAttempted: number;
  uniqueProblemsSolved: number;
  solveRate: number;
  avgDifficulty: number;
  maxDifficulty: number;
  tagStats: TagStats[];
  difficultyDistribution: DifficultyBucket[];
  dailyActivity: DailyActivity[];
  streak: StreakInfo;
  ratingTrend: 'rising' | 'falling' | 'stagnant';
  practiceQualityScore: number; // 0-100
  contestPerformanceScore?: number; // 0-100
  userProfile?: 'practice_focused' | 'contest_specialist' | 'balanced';
  ratingPrediction?: RatingPrediction;
}

export interface RatingPrediction {
  predictedDelta: number; // e.g. +15, +0
  confidence: 'low' | 'medium' | 'high';
  reasoning: string;
}

// --- Difficulty Trend (new) ---

export interface WeeklyDifficultyPoint {
  weekLabel: string;      // e.g. "Apr 14"
  weekStart: string;      // YYYY-MM-DD for sorting
  avg: number;
  median: number;
  min: number;
  max: number;
  count: number;
}

export interface ProblemRatingPoint {
  date: string;           // ISO date string for x-axis
  dateLabel: string;      // human-readable
  rating: number;         // problem rating for y-axis
  name: string;
  contestId: number;
  index: string;
  tags: string[];
}

// --- Time Range ---

export type TimeRange = '7d' | '14d' | '30d' | 'all';

export const TIME_RANGE_LABELS: Record<TimeRange, string> = {
  '7d': '7 Days',
  '14d': '14 Days',
  '30d': '30 Days',
  'all': 'All Time',
};

export const TIME_RANGE_DAYS: Record<TimeRange, number> = {
  '7d': 7,
  '14d': 14,
  '30d': 30,
  'all': 9999,
};

// --- Mentor Types ---

export interface MentorAnalysis {
  overallVerdict: 'good' | 'needs_work' | 'not_productive';
  practiceQualityScore: number;
  summary: string;
  honestFeedback: string;
  strengthAreas: string[];
  weakAreas: string[];
  actionItems: ActionItem[];
  spacedRepetitionSuggestions: SpacedRepSuggestion[];
  breakAnalysis?: BreakAnalysis;
  learningInsights: string[];
  timestamp: string;
}

export interface ActionItem {
  priority: 'high' | 'medium' | 'low';
  action: string;
  reason: string;
  relatedTags?: string[];
}

export interface SpacedRepSuggestion {
  topic: string;
  lastPracticed: string;
  suggestedReviewDate: string;
  urgency: 'overdue' | 'due_soon' | 'on_track';
}

export interface BreakAnalysis {
  breakDuration: number;
  skillDecayRisk: string[];
  warmUpPlan: string[];
}

// --- Ladder Types ---

export interface LadderProblem {
  contestId: number;
  index: string;
  name: string;
  rating: number;
  tags: string[];
  reason: string; // Why this problem is recommended
  url: string;
  isCompleted: boolean;
  isReview: boolean; // Spaced repetition re-solve
}

export interface Ladder {
  id: string;
  name: string;
  description: string;
  problems: LadderProblem[];
  targetTags: string[];
  difficultyRange: [number, number];
  totalProblems: number;
  completedProblems: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// --- Progress Types ---

export interface ProgressSnapshot {
  id: string;
  date: string;
  rating: number;
  problemsSolved: number;
  tagsPracticed: string[];
  difficultyRange: [number, number];
  streakDays: number;
  snapshotData: Record<string, unknown>;
}

export interface MentorMemory {
  id: string;
  type: 'observation' | 'milestone' | 'weakness' | 'strength' | 'break';
  content: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

// --- Quests & Virtual Rating Types ---

export interface Quest {
  id: string;
  title: string;          // Action item text
  description: string;    // Reason
  xpReward: number;       // e.g. High=50, Med=20, Low=5
  targetDate: string;     // ISO format, deadline for checking
  relatedTags: string[];
  status: 'active' | 'completed' | 'failed';
  feedback?: string;      // LLM's assessment text when evaluated
  createdAt: string;
  completedAt?: string;
  assessedSubmissions?: string[]; // IDs of submissions evaluated
}

export interface VirtualProfile {
  level: number;
  xp: number;
  totalXPEarned: number;
  questsCompleted: number;
  questsFailed: number;
  streakMultipler: number;
}

// --- Spaced Repetition Types ---

export interface ReviewItem {
  id: string;
  problemId: string; // contestId/index
  problemName: string;
  problemRating: number;
  tags: string[];
  masteryLevel: number; // 0-5
  easeFactor: number;
  intervalDays: number;
  nextReview: string;
  lastReviewed?: string;
  reviewCount: number;
}

// --- API Usage ---

export interface ApiUsage {
  date: string;
  callsMade: number;
  callsLimit: number;
}

// --- CF Rank Color Map ---

export const CF_RANK_COLORS: Record<CFRank, string> = {
  'newbie': '#808080',
  'pupil': '#008000',
  'specialist': '#03a89e',
  'expert': '#0000ff',
  'candidate master': '#aa00aa',
  'master': '#ff8c00',
  'international master': '#ff8c00',
  'grandmaster': '#ff0000',
  'international grandmaster': '#ff0000',
  'legendary grandmaster': '#ff0000',
};

// --- All CF Tags ---

export const ALL_CF_TAGS = [
  'implementation', 'math', 'greedy', 'dp', 'data structures',
  'brute force', 'constructive algorithms', 'graphs', 'sortings',
  'binary search', 'dfs and similar', 'trees', 'strings',
  'number theory', 'geometry', 'combinatorics', 'two pointers',
  'dsu', 'bitmasks', 'probabilities', 'shortest paths', 'hashing',
  'divide and conquer', 'games', 'flows', 'interactive',
  'matrices', 'string suffix structures', 'fft', 'ternary search',
  'expression parsing', 'meet-in-the-middle', 'chinese remainder theorem',
  '2-sat', 'schedules',
] as const;
