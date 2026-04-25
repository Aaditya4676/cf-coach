import { NextRequest, NextResponse } from 'next/server';
import { getUserInfo, getUserSubmissions, getAllProblems, getUniqueSolvedProblems, getProblemId } from '@/lib/codeforces';
import { computeTagStats } from '@/lib/analytics';
import { callAI, getAIOptionsFromHeaders } from '@/lib/ai-client';
import { buildLadderPrompt } from '@/lib/prompts';
import { LadderProblem } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { handle, focusTags, difficultyMin, difficultyMax, count = 20 } = body;
    const aiOptions = getAIOptionsFromHeaders(request.headers);

    if (!handle) {
      return NextResponse.json({ error: 'Missing handle' }, { status: 400 });
    }

    // 1. Get user info + submissions + problemset
    const [userInfo, submissions, { problems }] = await Promise.all([
      getUserInfo(handle),
      getUserSubmissions(handle, 1, 1000),
      getAllProblems(),
    ]);

    // 2. Get solved problem IDs
    const solved = getUniqueSolvedProblems(submissions);
    const solvedIds = new Set(solved.map(s => getProblemId(s.problem)));

    // 3. Compute weak tags
    const tagStats = computeTagStats(submissions);

    // 4. Call Gemini for ladder
    const prompt = buildLadderPrompt(
      userInfo,
      tagStats.filter(t => t.solveRate < 60).slice(0, 5),
      solvedIds,
      problems.map(p => ({
        contestId: p.contestId,
        index: p.index,
        name: p.name,
        rating: p.rating,
        tags: p.tags,
      })),
      { focusTags, difficultyMin, difficultyMax, count }
    );

    const ladderProblems = await callAI<Array<{
      contestId: number;
      index: string;
      name: string;
      rating: number;
      tags: string[];
      reason: string;
    }>>(prompt, aiOptions);

    // 5. Format response
    const formattedProblems: LadderProblem[] = ladderProblems.map(p => ({
      contestId: p.contestId,
      index: p.index,
      name: p.name,
      rating: p.rating,
      tags: p.tags,
      reason: p.reason,
      url: `https://codeforces.com/problemset/problem/${p.contestId}/${p.index}`,
      isCompleted: false,
      isReview: false,
    }));

    return NextResponse.json({ problems: formattedProblems });
  } catch (error) {
    console.error('Ladder generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Ladder generation failed' },
      { status: 500 }
    );
  }
}
