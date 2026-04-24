'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getUserInfo, getUserSubmissions, getUserRatingHistory } from '@/lib/codeforces';
import { useCFHandle } from '@/hooks/useCFHandle';
import { computeAnalytics, computeTagStats, computeStreak } from '@/lib/analytics';
import { CFUser, CFSubmission, CFRatingChange, TagStats, StreakInfo } from '@/lib/types';
import { RatingChart } from '@/components/RatingChart';
import {
  TrendingUp,
  Calendar,
  Target,
  Award,
  ArrowUp,
  ArrowDown,
  Minus,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { format, subDays, differenceInDays } from 'date-fns';

export default function ProgressPage() {
  const router = useRouter();
  const { handle, isReady, needsSetup } = useCFHandle();
  const [user, setUser] = useState<CFUser | null>(null);
  const [submissions, setSubmissions] = useState<CFSubmission[]>([]);
  const [ratingHistory, setRatingHistory] = useState<CFRatingChange[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isReady && needsSetup) {
      router.push('/settings');
    }
  }, [isReady, needsSetup, router]);

  const fetchData = useCallback(async () => {
    if (!handle || !isReady || needsSetup) return;
    try {
      setLoading(true);
      const [userInfo, subs, ratings] = await Promise.all([
        getUserInfo(handle),
        getUserSubmissions(handle, 1, 1000),
        getUserRatingHistory(handle),
      ]);
      setUser(userInfo);
      setSubmissions(subs);
      setRatingHistory(ratings);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [handle, isReady, needsSetup]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="animate-fade-in">
        <div className="page-header">
          <h1 className="page-title">Progress</h1>
        </div>
        <div className="skeleton" style={{ height: 200 }}></div>
        <div className="skeleton mt-lg" style={{ height: 350 }}></div>
      </div>
    );
  }

  if (!user) return null;

  // Compute milestones from rating history
  const milestones: { date: string; event: string; rating: number }[] = [];
  let prevMaxRating = 0;
  const ratingThresholds = [1200, 1400, 1600, 1900, 2100, 2400];

  for (const r of ratingHistory) {
    const maxSoFar = Math.max(prevMaxRating, r.newRating);
    for (const threshold of ratingThresholds) {
      if (prevMaxRating < threshold && maxSoFar >= threshold) {
        milestones.push({
          date: format(new Date(r.ratingUpdateTimeSeconds * 1000), 'MMM dd, yyyy'),
          event: `Reached ${threshold} rating!`,
          rating: r.newRating,
        });
      }
    }
    prevMaxRating = maxSoFar;
  }

  // Detect breaks
  const breaks: { start: string; end: string; days: number }[] = [];
  for (let i = 1; i < ratingHistory.length; i++) {
    const gap = differenceInDays(
      new Date(ratingHistory[i].ratingUpdateTimeSeconds * 1000),
      new Date(ratingHistory[i - 1].ratingUpdateTimeSeconds * 1000)
    );
    if (gap > 30) {
      breaks.push({
        start: format(new Date(ratingHistory[i - 1].ratingUpdateTimeSeconds * 1000), 'MMM dd, yyyy'),
        end: format(new Date(ratingHistory[i].ratingUpdateTimeSeconds * 1000), 'MMM dd, yyyy'),
        days: gap,
      });
    }
  }

  // Weekly solve count for area chart
  const weeklyData: { week: string; solved: number }[] = [];
  const accepted = submissions.filter(s => s.verdict === 'OK');
  const weekMap = new Map<string, Set<string>>();
  for (const sub of accepted) {
    const date = new Date(sub.creationTimeSeconds * 1000);
    const weekStart = format(subDays(date, date.getDay()), 'MMM dd');
    if (!weekMap.has(weekStart)) weekMap.set(weekStart, new Set());
    weekMap.get(weekStart)!.add(`${sub.problem.contestId}-${sub.problem.index}`);
  }
  for (const [week, problems] of weekMap) {
    weeklyData.push({ week, solved: problems.size });
  }
  weeklyData.sort((a, b) => a.week.localeCompare(b.week));
  const recentWeeks = weeklyData.slice(-20);

  // Rating changes summary
  const recent10 = ratingHistory.slice(-10);
  const ratingChanges = recent10.map(r => ({
    contest: r.contestName.length > 40 ? r.contestName.slice(0, 40) + '…' : r.contestName,
    date: format(new Date(r.ratingUpdateTimeSeconds * 1000), 'MMM dd'),
    change: r.newRating - r.oldRating,
    newRating: r.newRating,
  }));

  const streak = computeStreak(submissions);

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title flex items-center gap-sm">
          <TrendingUp size={28} style={{ color: 'var(--accent-blue)' }} />
          Progress
        </h1>
        <p className="page-description">
          Your journey from {ratingHistory[0]?.newRating || '?'} to {user.rating}
        </p>
      </div>

      {/* Key Stats */}
      <div className="stats-grid mb-lg" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="stat-card">
          <div className="stat-label"><Award size={14} /> Total Contests</div>
          <div className="stat-value" style={{ color: 'var(--accent-blue)' }}>{ratingHistory.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label"><TrendingUp size={14} /> Rating Gained</div>
          <div className="stat-value" style={{ color: 'var(--accent-emerald)' }}>
            +{user.rating - (ratingHistory[0]?.newRating || 0)}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label"><Target size={14} /> Problems Solved</div>
          <div className="stat-value" style={{ color: 'var(--accent-purple)' }}>
            {new Set(accepted.map(s => `${s.problem.contestId}-${s.problem.index}`)).size}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label"><Calendar size={14} /> Days Active</div>
          <div className="stat-value" style={{ color: 'var(--accent-amber)' }}>
            {new Set(accepted.map(s => format(new Date(s.creationTimeSeconds * 1000), 'yyyy-MM-dd'))).size}
          </div>
        </div>
      </div>

      {/* Full Rating Chart */}
      <div className="card mb-lg">
        <div className="card-header">
          <div className="card-title">Full Rating History</div>
        </div>
        <RatingChart ratingHistory={ratingHistory} />
      </div>

      <div className="grid-2 mb-lg">
        {/* Weekly Solve Volume */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Weekly Solve Volume</div>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={recentWeeks} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="solveGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,140,255,0.06)" vertical={false} />
                <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#475569' }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} width={30} />
                <Tooltip
                  contentStyle={{
                    background: 'rgba(12,18,34,0.95)',
                    border: '1px solid rgba(99,140,255,0.2)',
                    borderRadius: 10,
                  }}
                />
                <Area type="monotone" dataKey="solved" stroke="#8b5cf6" strokeWidth={2} fill="url(#solveGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Rating Changes */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Recent Contests</div>
          </div>
          <div className="table-container" style={{ maxHeight: 300, overflowY: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Contest</th>
                  <th>Change</th>
                  <th>Rating</th>
                </tr>
              </thead>
              <tbody>
                {ratingChanges.reverse().map((rc, i) => (
                  <tr key={i}>
                    <td>
                      <div className="text-sm">{rc.contest}</div>
                      <div className="text-xs text-muted">{rc.date}</div>
                    </td>
                    <td>
                      <span className="flex items-center gap-xs font-bold font-mono" style={{
                        color: rc.change >= 0 ? 'var(--accent-emerald)' : 'var(--accent-red)',
                      }}>
                        {rc.change >= 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                        {rc.change >= 0 ? '+' : ''}{rc.change}
                      </span>
                    </td>
                    <td className="font-mono font-bold">{rc.newRating}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Milestones + Breaks */}
      <div className="grid-2">
        {/* Milestones */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">🏆 Milestones</div>
          </div>
          {milestones.length === 0 ? (
            <div className="text-sm text-muted">No milestones yet — keep pushing!</div>
          ) : (
            milestones.map((m, i) => (
              <div key={i} className="flex items-center gap-md mb-md">
                <div style={{
                  width: 40, height: 40, borderRadius: 'var(--radius-lg)',
                  background: 'var(--accent-emerald-dim)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18,
                }}>
                  🎯
                </div>
                <div>
                  <div className="font-semibold text-sm">{m.event}</div>
                  <div className="text-xs text-muted">{m.date}</div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Break History */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">☕ Break History</div>
          </div>
          {breaks.length === 0 ? (
            <div className="text-sm text-muted">No significant breaks detected!</div>
          ) : (
            breaks.map((b, i) => (
              <div key={i} className="flex items-center gap-md mb-md" style={{
                padding: 'var(--space-sm) var(--space-md)',
                background: b.days > 60 ? 'var(--accent-red-dim)' : 'var(--accent-amber-dim)',
                borderRadius: 'var(--radius-md)',
              }}>
                <div className="font-bold" style={{
                  color: b.days > 60 ? 'var(--accent-red)' : 'var(--accent-amber)',
                }}>
                  {b.days}d
                </div>
                <div>
                  <div className="text-sm">{b.start} → {b.end}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
