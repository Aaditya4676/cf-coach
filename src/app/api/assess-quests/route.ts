import { NextResponse } from 'next/server';
import { callGemini } from '@/lib/gemini';
import { buildQuestAssessmentPrompt } from '@/lib/prompts';
import { Quest, CFSubmission } from '@/lib/types';
import { getUserSubmissions } from '@/lib/codeforces';

export async function POST(request: Request) {
  try {
    const { handle, quests } = await request.json();

    if (!handle || !quests || !Array.isArray(quests) || quests.length === 0) {
      return NextResponse.json({ error: 'Handle and quests array are required' }, { status: 400 });
    }

    // Find the oldest quest creation date to fetch submissions
    let oldestDate = new Date();
    quests.forEach((q: Quest) => {
      const qDate = new Date(q.createdAt);
      if (qDate < oldestDate) oldestDate = qDate;
    });

    // We fetch a larger chunk of submissions to cover the time span
    const allSubs = await getUserSubmissions(handle, 1, 300);
    
    // Filter submissions that happened AFTER the oldest quest was created
    const oldestTimestampStr = (oldestDate.getTime() / 1000).toString();
    const relevantSubs = allSubs.filter((s: CFSubmission) => 
      s.creationTimeSeconds >= parseInt(oldestTimestampStr)
    );

    const prompt = buildQuestAssessmentPrompt(quests, relevantSubs);
    
    // Call Gemini with JSON mode enforced
    const assessmentResults = await callGemini<any[]>(prompt);
    
    return NextResponse.json({ results: assessmentResults });

  } catch (error) {
    console.error('Quest assessment error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
