'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getUserInfo, getUserSubmissions, getUserRatingHistory, getSubmissionsInTimeRange } from '@/lib/codeforces';
import { useCFHandle } from '@/hooks/useCFHandle';
import { computeAnalytics, computeWeeklyDifficultyTrend, computeProblemRatingScatter } from '@/lib/analytics';
import {
  CFUser, CFSubmission, CFRatingChange, AnalyticsSummary, TimeRange, TIME_RANGE_LABELS,
  WeeklyDifficultyPoint, ProblemRatingPoint, TIME_RANGE_DAYS
} from '@/lib/types';
import { ProfileCard } from '@/components/ProfileCard';
import { RatingChart } from '@/components/RatingChart';
import { TagRadar } from '@/components/TagRadar';
import { DifficultyChart } from '@/components/DifficultyChart';
import { DifficultyTrendChart } from '@/components/DifficultyTrendChart';
import { ActivityHeatmap } from '@/components/ActivityHeatmap';
import { SubmissionsTable } from '@/components/SubmissionsTable';
import { StreakCounter } from '@/components/StreakCounter';
import { TimeRangeSelector } from '@/components/TimeRangeSelector';
import {
  TrendingUp,
  Target,
  Zap,
  BarChart3,
} from 'lucide-react';

export default function DashboardPage() {
  const router = useRouter();
  const { handle, isReady, needsSetup } = useCFHandle();
  const [user, setUser] = useState<CFUser | null>(null);
  const [submissions, setSubmissions] = useState<CFSubmission[]>([]);
  const [ratingHistory, setRatingHistory] = useState<CFRatingChange[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weeklyTrend, setWeeklyTrend] = useState<WeeklyDifficultyPoint[]>([]);
  const [ratingScatter, setRatingScatter] = useState<ProblemRatingPoint[]>([]);

  useEffect(() => {
    if (isReady && needsSetup) {
      router.push('/settings');
    }
  }, [isReady, needsSetup, router]);

  const fetchData = useCallback(async () => {
    if (!handle || !isReady || needsSetup) return;
    try {
      setLoading(true);
      setError(null);

      const [userInfo, subs, ratings] = await Promise.all([
        getUserInfo(handle),
        getUserSubmissions(handle, 1, 500),
        getUserRatingHistory(handle),
      ]);

      setUser(userInfo);
      setSubmissions(subs);
      setRatingHistory(ratings);

      const analyticsData = computeAnalytics(subs, userInfo, timeRange);
      setAnalytics(analyticsData);

      const days = TIME_RANGE_DAYS[timeRange];
      const filteredSubs = timeRange === 'all' ? subs : getSubmissionsInTimeRange(subs, days);
      setWeeklyTrend(computeWeeklyDifficultyTrend(filteredSubs));
      setRatingScatter(computeProblemRatingScatter(filteredSubs));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
      console.error('Dashboard error:', err);
    } finally {
      setLoading(false);
    }
  }, [timeRange, handle, isReady, needsSetup]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (user && submissions.length > 0) {
      const analyticsData = computeAnalytics(submissions, user, timeRange);
      setAnalytics(analyticsData);
    }
  }, [timeRange, user, submissions]);

  if (error) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">⚠️</div>
        <div className="empty-state-title">Failed to load data</div>
        <div className="empty-state-text">{error}</div>
        <button className="btn btn-primary mt-lg" onClick={fetchData}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Page Header */}
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-description">
            Your Codeforces analytics at a glance
          </p>
        </div>
        <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
      </div>

      {/* Profile + Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 'var(--space-lg)', marginBottom: 'var(--space-lg)' }}>
        {loading || !isReady ? (
          <>
            <div className="skeleton" style={{ height: 200 }}></div>
            <div className="skeleton" style={{ height: 200 }}></div>
          </>
        ) : (
          <>
            <ProfileCard user={user!} streak={analytics?.streak} />
            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
              <StatCard
                label="Problems Solved"
                value={analytics?.uniqueProblemsSolved || 0}
                icon={<Target size={16} />}
                trend={`${analytics?.solveRate || 0}% solve rate`}
                trendType="neutral"
                color="var(--accent-blue)"
              />
              <StatCard
                label="Avg Difficulty"
                value={analytics?.avgDifficulty || 0}
                icon={<BarChart3 size={16} />}
                trend={`max: ${analytics?.maxDifficulty || 0}`}
                trendType="neutral"
                color="var(--accent-purple)"
              />
              <StatCard
                label="Practice Quality"
                value={`${analytics?.practiceQualityScore || 0}/100`}
                icon={<Zap size={16} />}
                trend={
                  (analytics?.practiceQualityScore || 0) >= 70
                    ? 'Good practice!'
                    : 'Needs improvement'
                }
                trendType={(analytics?.practiceQualityScore || 0) >= 70 ? 'positive' : 'negative'}
                color="var(--accent-emerald)"
              />
              <StatCard
                label="Rating Trend"
                value={analytics?.ratingTrend === 'rising' ? '↑ Rising' : analytics?.ratingTrend === 'falling' ? '↓ Falling' : '→ Stable'}
                icon={<TrendingUp size={16} />}
                trend={`${TIME_RANGE_LABELS[timeRange]} trend`}
                trendType={analytics?.ratingTrend === 'rising' ? 'positive' : analytics?.ratingTrend === 'falling' ? 'negative' : 'neutral'}
                color="var(--accent-amber)"
              />
            </div>
          </>
        )}
      </div>

      {/* Streak + Heatmap */}
      {!loading && analytics && (
        <div style={{ marginBottom: 'var(--space-lg)' }}>
          <StreakCounter streak={analytics.streak} />
          <div className="card mt-lg">
            <div className="card-header">
              <div className="card-title">Activity Heatmap</div>
              <div className="text-xs text-muted">{TIME_RANGE_LABELS[timeRange]}</div>
            </div>
            <ActivityHeatmap dailyActivity={analytics.dailyActivity} />
          </div>
        </div>
      )}

      {/* Charts Row */}
      <div className="grid-2" style={{ marginBottom: 'var(--space-lg)' }}>
        {loading ? (
          <>
            <div className="skeleton" style={{ height: 350 }}></div>
            <div className="skeleton" style={{ height: 350 }}></div>
          </>
        ) : (
          <>
            <div className="card">
              <div className="card-header">
                <div className="card-title">Rating History</div>
              </div>
              <RatingChart ratingHistory={ratingHistory} />
            </div>
            <div className="card">
              <div className="card-header">
                <div className="card-title">Tag Competency</div>
              </div>
              {analytics && <TagRadar tagStats={analytics.tagStats} />}
            </div>
          </>
        )}
      </div>

      {/* Difficulty Distribution + Submissions */}
      <div className="grid-2" style={{ marginBottom: 'var(--space-lg)' }}>
        {loading ? (
          <>
            <div className="skeleton" style={{ height: 350 }}></div>
            <div className="skeleton" style={{ height: 350 }}></div>
          </>
        ) : (
          <>
            <div className="card">
              <div className="card-header">
                <div className="card-title">Difficulty Distribution</div>
              </div>
              {analytics && <DifficultyChart distribution={analytics.difficultyDistribution} userRating={user?.rating || 0} />}
            </div>
            <div className="card">
              <div className="card-header">
                <div className="card-title">Recent Submissions</div>
              </div>
              <SubmissionsTable submissions={submissions.slice(0, 15)} />
            </div>
          </>
        )}
      </div>

      {/* Difficulty Trend + Rating Scatter */}
      {!loading && weeklyTrend.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Practice Difficulty Analysis</div>
              <div className="card-subtitle">Track how hard you&apos;re pushing yourself over time</div>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
              <span className="badge badge-blue">
                Avg: <strong style={{ marginLeft: 4 }}>{analytics?.avgDifficulty || 0}</strong>
              </span>
              <span className="badge badge-purple">
                Max: <strong style={{ marginLeft: 4 }}>{analytics?.maxDifficulty || 0}</strong>
              </span>
            </div>
          </div>
          <DifficultyTrendChart
            weeklyTrend={weeklyTrend}
            scatter={ratingScatter}
            userRating={user?.rating || 1522}
          />
        </div>
      )}
    </div>
  );
}

// --- Stat Card Component ---
function StatCard({
  label,
  value,
  icon,
  trend,
  trendType,
  color,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  trend: string;
  trendType: 'positive' | 'negative' | 'neutral';
  color: string;
}) {
  return (
    <div className="stat-card">
      <div className="stat-label">
        <span style={{ color }}>{icon}</span>
        {label}
      </div>
      <div className="stat-value" style={{ color }}>
        {value}
      </div>
      <div className={`stat-trend ${trendType}`}>{trend}</div>
    </div>
  );
}
