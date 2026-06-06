import { NextRequest, NextResponse } from 'next/server';
import { getContestProblems } from '@/lib/codeforces';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const contestId = parseInt(searchParams.get('contestId') || '0', 10);

    if (!contestId) {
      return NextResponse.json({ error: 'Missing contestId' }, { status: 400 });
    }

    const problems = await getContestProblems(contestId);
    
    if (!problems || problems.length === 0) {
      return NextResponse.json({ error: 'Contest not found or has no problems' }, { status: 404 });
    }

    return NextResponse.json({ problems });
  } catch (error) {
    console.error('Contest fetch error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch contest' },
      { status: 500 }
    );
  }
}
