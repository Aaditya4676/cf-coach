import { NextRequest, NextResponse } from 'next/server';
import { getUserInfo, getUserSubmissions, getSubmissionsInTimeRange, hashSubmissions, getUniqueSolvedProblems } from '@/lib/codeforces';
import { computeAnalytics } from '@/lib/analytics';
import { callGemini } from '@/lib/gemini';
import { buildMentorAnalysisPrompt } from '@/lib/prompts';
import { MentorAnalysis, TIME_RANGE_DAYS, TIME_RANGE_LABELS, TimeRange } from '@/lib/types';

// In-memory cache (resets on cold start but that's fine for our use case)
const analysisCache = new Map<string, { analysis: MentorAnalysis; hash: string; timestamp: number }>();
const CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { handle, timeRange = '7d' } = body as { handle: string; timeRange: TimeRange };

    if (!handle) {
      return NextResponse.json({ error: 'Missing handle' }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 });
    }

    // 1. Fetch data from CF
    const [userInfo, allSubmissions] = await Promise.all([
      getUserInfo(handle),
      getUserSubmissions(handle, 1, 500),
    ]);

    const days = TIME_RANGE_DAYS[timeRange];
    const submissions = timeRange === 'all' ? allSubmissions : getSubmissionsInTimeRange(allSubmissions, days);
    const submissionsHash = hashSubmissions(submissions);

    // 2. Check cache
    const cacheKey = `${handle}_${timeRange}`;
    const cached = analysisCache.get(cacheKey);
    if (cached && cached.hash === submissionsHash && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json({
        analysis: cached.analysis,
        cached: true,
      });
    }

    // 3. Compute local analytics
    const analytics = computeAnalytics(allSubmissions, userInfo, timeRange);

    // 4. Build prompt and call Gemini
    // Pass empty memories for now (would come from DB in production)
    const prompt = buildMentorAnalysisPrompt(
      userInfo,
      submissions,
      analytics,
      [], // memories - will be loaded from Supabase later
      TIME_RANGE_LABELS[timeRange]
    );

    const analysis = await callGemini<MentorAnalysis>(prompt);
    analysis.timestamp = new Date().toISOString();

    // 5. Cache the result
    analysisCache.set(cacheKey, {
      analysis,
      hash: submissionsHash,
      timestamp: Date.now(),
    });

    return NextResponse.json({
      analysis,
      cached: false,
      analytics, // Also return local analytics
    });
  } catch (error) {
    console.error('Analysis error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Analysis failed' },
      { status: 500 }
    );
  }
}
