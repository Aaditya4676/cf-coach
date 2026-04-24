// ============================================================
// CF Coach — AI Prompt Templates
// Powered by evidence-based learning science
// ============================================================

import { CFSubmission, CFUser, AnalyticsSummary, MentorMemory, TagStats } from './types';
import { getProblemId } from './codeforces';

/**
 * Format submissions into a concise summary for the AI prompt.
 * We keep it compact to minimize tokens.
 */
function formatSubmissionsSummary(submissions: CFSubmission[]): string {
  // Group by problem
  const problemMap = new Map<string, {
    name: string;
    rating: number | undefined;
    tags: string[];
    attempts: number;
    solved: boolean;
    verdicts: string[];
  }>();

  for (const sub of submissions) {
    const key = getProblemId(sub.problem);
    if (!problemMap.has(key)) {
      problemMap.set(key, {
        name: sub.problem.name,
        rating: sub.problem.rating,
        tags: sub.problem.tags,
        attempts: 0,
        solved: false,
        verdicts: [],
      });
    }
    const problem = problemMap.get(key)!;
    problem.attempts++;
    if (sub.verdict === 'OK') problem.solved = true;
    problem.verdicts.push(sub.verdict);
  }

  const lines: string[] = [];
  for (const [id, p] of problemMap) {
    const status = p.solved ? '✅' : '❌';
    lines.push(
      `${status} ${p.name} (${id}) | Rating: ${p.rating || '?'} | Tags: [${p.tags.join(', ')}] | Attempts: ${p.attempts}${p.attempts > 2 ? ' ⚠️ MANY ATTEMPTS' : ''}`
    );
  }

  return lines.join('\n');
}

/**
 * Format memories for context
 */
function formatMemories(memories: MentorMemory[]): string {
  if (memories.length === 0) return 'No previous observations.';
  return memories.slice(0, 15).map(m =>
    `[${m.type.toUpperCase()}] ${m.content} (${new Date(m.createdAt).toLocaleDateString()})`
  ).join('\n');
}

// --- MENTOR ANALYSIS PROMPT ---

export function buildMentorAnalysisPrompt(
  user: CFUser,
  submissions: CFSubmission[],
  analytics: AnalyticsSummary,
  memories: MentorMemory[],
  timeRangeLabel: string,
): string {
  const submissionsSummary = formatSubmissionsSummary(submissions);
  const topTags = analytics.tagStats.slice(0, 8).map(t =>
    `${t.tag}: ${t.solved} solved, ${t.solveRate}% solve rate, avg diff ${t.avgDifficulty}`
  ).join('\n');

  const weakTags = analytics.tagStats
    .filter(t => t.attempted >= 2 && t.solveRate < 50)
    .map(t => t.tag)
    .join(', ');

  return `You are CF Coach, a supportive, encouraging, and data-driven competitive programming mentor. You understand that the student might be a busy working professional with limited time to practice, so you focus on maximizing the value of whatever time they have. Be warm, motivating, and constructive — celebrate small wins and frame weaknesses as exciting opportunities for growth.

## YOUR LEARNING SCIENCE KNOWLEDGE
You apply these evidence-based principles:
1. **Desirable Difficulties (Bjork)**: Try to gently push the student out of their comfort zone for better retention.
2. **Spacing Effect**: Distributed practice > cramming. Check if student revisits topics.
3. **Interleaving**: Mixing problem types builds transfer. Suggest mixing things up if they only solve one tag.
4. **Generalization over Memorization**: Solving different problems testing the SAME concept > re-solving the exact same problem.
5. **Deliberate Practice (Ericsson)**: Focused practice on weaknesses with feedback > random grinding.
6. **Cognitive Load Theory**: Break complex patterns into schemas. Identify recurring patterns.

## STUDENT PROFILE
- Handle: ${user.handle}
- Current Rating: ${user.rating} (${user.rank})
- Max Rating: ${user.maxRating}
- Organization: ${user.organization || 'N/A'}
- Optimal practice range: ${user.rating - 200} to ${user.rating + 300} rated problems

## ANALYSIS PERIOD: ${timeRangeLabel}

## SUBMISSIONS (${submissions.length} total)
${submissionsSummary}

## ANALYTICS
- Unique problems solved: ${analytics.uniqueProblemsSolved}
- Solve rate: ${analytics.solveRate}%
- Average difficulty: ${analytics.avgDifficulty}
- Max difficulty: ${analytics.maxDifficulty}
- Practice quality score: ${analytics.practiceQualityScore}/100
- Rating trend: ${analytics.ratingTrend}
- Current streak: ${analytics.streak.currentStreak} days
- Is on break: ${analytics.streak.isOnBreak} (${analytics.streak.breakDays} days since last solve)

## TAG BREAKDOWN
${topTags}

## WEAK AREAS (low solve rate)
${weakTags || 'None identified yet'}

## PREVIOUS MENTOR OBSERVATIONS
${formatMemories(memories)}

---

Respond with a JSON object (and ONLY a valid JSON object, no markdown fences) with this exact structure:
{
  "overallVerdict": "good" | "needs_work" | "not_productive",
  "practiceQualityScore": <number 0-100>,
  "summary": "<2-3 sentence high-level summary>",
  "honestFeedback": "<Be encouraging, warm, and highly supportive. Acknowledge that they are making time for this despite a busy schedule. Gently guide them toward solving slightly harder problems out of their comfort zone.>",
  "strengthAreas": ["<tag or skill>", ...],
  "weakAreas": ["<tag or skill that needs work>", ...],
  "actionItems": [
    {
      "priority": "high" | "medium" | "low",
      "action": "<specific actionable step>",
      "reason": "<why this matters>",
      "relatedTags": ["<tag>"]
    }
  ],
  "spacedRepetitionSuggestions": [
    {
      "topic": "<tag or concept>",
      "lastPracticed": "<approximate date or 'never'>",
      "suggestedReviewDate": "<YYYY-MM-DD>",
      "urgency": "overdue" | "due_soon" | "on_track"
    }
  ],
  "breakAnalysis": ${analytics.streak.isOnBreak ? `{
    "breakDuration": ${analytics.streak.breakDays},
    "skillDecayRisk": ["<topics that may have decayed>"],
    "warmUpPlan": ["<step 1>", "<step 2>", ...]
  }` : 'null'},
  "learningInsights": ["<specific learning science insight applied to this student>", ...],
  "newMemories": [
    {
      "type": "observation" | "milestone" | "weakness" | "strength",
      "content": "<what to remember about this student for next time>"
    }
  ]
}`;
}

// --- LADDER GENERATION PROMPT ---

export function buildLadderPrompt(
  user: CFUser,
  weakTags: TagStats[],
  solvedProblemIds: Set<string>,
  availableProblems: { contestId: number; index: string; name: string; rating?: number; tags: string[] }[],
  preferences?: { focusTags?: string[]; difficultyMin?: number; difficultyMax?: number; count?: number }
): string {
  const focusTags = preferences?.focusTags || weakTags.slice(0, 5).map(t => t.tag);
  const minDiff = preferences?.difficultyMin || Math.max(800, user.rating - 200);
  const maxDiff = preferences?.difficultyMax || user.rating + 300;
  const count = preferences?.count || 20;

  // Filter available problems to relevant ones
  const relevant = availableProblems
    .filter(p =>
      p.rating && p.rating >= minDiff && p.rating <= maxDiff &&
      !solvedProblemIds.has(`${p.contestId}/${p.index}`) &&
      p.tags.some(t => focusTags.includes(t))
    )
    .slice(0, 200); // limit context window

  const problemList = relevant.map(p =>
    `${p.contestId}/${p.index} "${p.name}" r${p.rating} [${p.tags.join(', ')}]`
  ).join('\n');

  return `You are CF Coach's ladder generator. Create a personalized practice ladder.

## STUDENT
- Rating: ${user.rating} (${user.rank})
- Weak areas: ${focusTags.join(', ')}
- Difficulty range: ${minDiff} - ${maxDiff}
- Ladder size: ${count} problems

## LEARNING PRINCIPLES TO APPLY
1. **Interleaving**: Don't group all problems of one tag together. Mix tags.
2. **Progressive Difficulty**: Start slightly below current rating, build up.
3. **Desirable Difficulties**: Include 3-4 problems that are a significant stretch.
4. **Pattern Building**: Include pairs of problems that teach the same underlying pattern.

## AVAILABLE UNSOLVED PROBLEMS
${problemList}

---

Select exactly ${count} problems from the list above. Respond with a JSON array (and ONLY a valid JSON array, no markdown fences):
[
  {
    "contestId": <number>,
    "index": "<string>",
    "name": "<string>",
    "rating": <number>,
    "tags": ["<tag>", ...],
    "reason": "<why this problem is good for this student right now — be specific about the learning goal>"
  }
]

Order them in the sequence they should be solved (interleaved, progressive difficulty with occasional spikes).`;
}

// --- BREAK RETURN PROMPT ---

export function buildBreakReturnPrompt(
  user: CFUser,
  breakDays: number,
  lastSolvedProblems: CFSubmission[],
  memories: MentorMemory[]
): string {
  const lastSolved = lastSolvedProblems.slice(0, 5).map(s =>
    `${s.problem.name} (r${s.problem.rating}) [${s.problem.tags.join(', ')}]`
  ).join('\n');

  return `You are CF Coach. The student is returning after a ${breakDays}-day break.

## STUDENT
- Handle: ${user.handle}, Rating: ${user.rating} (${user.rank})
- Break duration: ${breakDays} days

## LAST PROBLEMS BEFORE BREAK
${lastSolved}

## PREVIOUS OBSERVATIONS
${formatMemories(memories)}

Based on the break duration and their history, provide a warm-up plan.
Respond with JSON only (no markdown fences):
{
  "welcomeBack": "<motivational but honest message>",
  "skillDecayRisk": ["<topics that may need refreshing>"],
  "warmUpPlan": [
    { "day": 1, "activity": "<what to do>" },
    { "day": 2, "activity": "<what to do>" },
    { "day": 3, "activity": "<what to do>" }
  ],
  "avoidFor3Days": "<what NOT to do right away (e.g., don't jump into hard problems)>"
}`;
}

// --- QUEST ASSESSMENT PROMPT ---

export function buildQuestAssessmentPrompt(
  quests: import('./types').Quest[],
  submissions: import('./types').CFSubmission[]
): string {
  const questStr = quests.map(q => 
    `ID: ${q.id}\nTitle: ${q.title}\nDescription: ${q.description}\nTags: ${q.relatedTags.join(', ')}`
  ).join('\n---\n');

  const subsStr = submissions.slice(0, 50).map(s => 
    `[${new Date(s.creationTimeSeconds * 1000).toISOString().split('T')[0]}] ${s.verdict} - r${s.problem.rating} [${s.problem.tags.join(', ')}]`
  ).join('\n');

  return `You are CF Coach, evaluating if a student completed their assigned learning quests.

## ACTIVE QUESTS
${questStr}

## RECENT SUBMISSIONS (since quests were assigned)
${subsStr}

Analyze the submissions to determine if each quest was met. Be somewhat strict but fair. If a quest asked them to solve 3 DP problems, check if they successfully (OK) solved 3 DP problems.

Respond ONLY with a JSON array (no markdown fences):
[
  {
    "questId": "<id>",
    "status": "completed" | "failed",
    "feedback": "<brief explanation of why they passed or failed, be encouraging if failed, praise if completed>"
  }
]`;
}
