import { NextRequest, NextResponse } from 'next/server';
import { getUserInfo, getUserSubmissions, getUserRatingHistory } from '@/lib/codeforces';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const handle = searchParams.get('handle');
  const action = searchParams.get('action'); // 'info' | 'submissions' | 'rating'
  const count = searchParams.get('count');

  if (!handle) {
    return NextResponse.json({ error: 'Missing handle parameter' }, { status: 400 });
  }

  try {
    switch (action) {
      case 'info': {
        const data = await getUserInfo(handle);
        return NextResponse.json(data);
      }
      case 'submissions': {
        const data = await getUserSubmissions(handle, 1, count ? parseInt(count) : 500);
        return NextResponse.json(data);
      }
      case 'rating': {
        const data = await getUserRatingHistory(handle);
        return NextResponse.json(data);
      }
      default:
        return NextResponse.json({ error: 'Invalid action. Use: info, submissions, rating' }, { status: 400 });
    }
  } catch (error) {
    console.error('CF API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Codeforces API error' },
      { status: 500 }
    );
  }
}
