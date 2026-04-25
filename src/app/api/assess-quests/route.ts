import { NextResponse } from 'next/server';
import { callAI, getAIOptionsFromHeaders } from '@/lib/ai-client';
import { buildQuestAssessmentPrompt } from '@/lib/prompts';
import { Quest, CFSubmission } from '@/lib/types';
import { getUserSubmissions } from '@/lib/codeforces';

export async function POST(request: Request) {
  try {
    const { handle, quests } = await request.json();
    const aiOptions = getAIOptionsFromHeaders(new Headers(request.headers));

    if (!handle || !quests || !Array.isArray(quests) || quests.length === 0) {
      return NextResponse.json({ error: 'Handle and quests array are required' }, { status: 400 });
    }

    // Find the oldest quest creation date to fetch submissions
    let oldestDate = new Date();
    quests.forEach((q: Quest) => {
      const qDate = new Date(q.createdAt);
      if (qDate < oldestDate) oldestDate = qDate;
    });

    // Fetch submissions covering the time span
    const allSubs = await getUserSubmissions(handle, 1, 300);
    
    const oldestTimestamp = oldestDate.getTime() / 1000;
    const relevantSubs = allSubs.filter((s: CFSubmission) => 
      s.creationTimeSeconds >= oldestTimestamp
    );

    const prompt = buildQuestAssessmentPrompt(quests, relevantSubs);
    const assessmentResults = await callAI<any[]>(prompt, aiOptions);
    
    return NextResponse.json({ results: assessmentResults });

  } catch (error) {
    console.error('Quest assessment error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
