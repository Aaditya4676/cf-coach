import { NextRequest, NextResponse } from 'next/server';
import { getAllProblems } from '@/lib/codeforces';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const contestId = parseInt(searchParams.get('contestId') || '0', 10);
    const index = searchParams.get('index')?.toUpperCase();

    if (!contestId || !index) {
      return NextResponse.json({ error: 'Missing contestId or index' }, { status: 400 });
    }

    // getAllProblems is cached by Next.js fetch, so this is fast after the first call
    const { problems } = await getAllProblems();
    
    const problem = problems.find(p => p.contestId === contestId && p.index === index);

    if (!problem) {
      return NextResponse.json({ error: 'Problem not found' }, { status: 404 });
    }

    return NextResponse.json({ problem });
  } catch (error) {
    console.error('Problem fetch error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch problem' },
      { status: 500 }
    );
  }
}
