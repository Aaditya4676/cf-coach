'use client';

import React, { useMemo, useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, Cell, PieChart, Pie, AreaChart, Area, ScatterChart, Scatter, ZAxis
} from 'recharts';
import { SolveSession } from '@/lib/practice-timer';
import { BarChart3, TrendingUp, Clock, Target, Zap, Activity, Award, Flame, Brain, Gauge, TrendingDown } from 'lucide-react';

interface PracticeAnalyticsProps {
  sessions: SolveSession[];
}

const COLORS = [
  '#06b6d4', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444',
  '#ec4899', '#3b82f6', '#14b8a6', '#f97316', '#a855f7'
];

// ---- Difficulty vs Speed Panel (multi-mode) ----
type DvSMode = 'scatter' | 'bar' | 'line';

interface DvSProps {
  scatterData: { rating: number; minutes: number; name: string }[];
  ratingData: { rating: string; avgMinutes: number; count: number }[];
}

function DifficultySpeedPanel({ scatterData, ratingData }: DvSProps) {
  const [mode, setMode] = useState<DvSMode>('scatter');

  const modes: { key: DvSMode; label: string; emoji: string }[] = [
    { key: 'scatter', label: 'Scatter', emoji: '🔵' },
    { key: 'bar',     label: 'Avg Bar', emoji: '📊' },
    { key: 'line',    label: 'Line',    emoji: '📈' },
  ];

  const tooltipStyle = { background: '#0d1117', border: '1px solid #ffffff20', borderRadius: 8, fontSize: 12 };

  return (
    <div className="card" style={{ padding: 'var(--space-lg)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
          <Activity size={16} style={{ color: 'var(--accent-amber)' }} />
          <h3 style={{ fontSize: 14, fontWeight: 600 }}>Difficulty vs Speed</h3>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {modes.map(m => (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              style={{
                padding: '3px 10px', fontSize: 11, borderRadius: 6, cursor: 'pointer',
                background: mode === m.key ? 'var(--accent-amber)' : 'transparent',
                color: mode === m.key ? '#000' : 'var(--text-muted)',
                border: `1px solid ${mode === m.key ? 'var(--accent-amber)' : '#ffffff20'}`,
                fontWeight: mode === m.key ? 700 : 400,
                transition: 'all 0.15s',
              }}
            >{m.emoji} {m.label}</button>
          ))}
        </div>
      </div>

      <div style={{ width: '100%', height: 250 }}>
        <ResponsiveContainer width="100%" height="100%">
          {mode === 'scatter' ? (
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis dataKey="rating" name="Rating" stroke="#ffffff60" fontSize={10} tickLine={false}
                label={{ value: 'Rating', position: 'insideBottom', offset: -5, fill: '#ffffff40', fontSize: 10 }} />
              <YAxis dataKey="minutes" name="Minutes" stroke="#ffffff60" fontSize={10} tickLine={false}
                label={{ value: 'Min', angle: -90, position: 'insideLeft', fill: '#ffffff40', fontSize: 10 }} />
              <ZAxis range={[40, 200]} />
              <Tooltip contentStyle={tooltipStyle}
                content={({ active, payload }: any) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div style={tooltipStyle as any}>
                      <p style={{ fontWeight: 700, color: '#fff', marginBottom: 4 }}>{d.name}</p>
                      <p style={{ color: '#f59e0b' }}>Rating: {d.rating}</p>
                      <p style={{ color: '#06b6d4' }}>Time: {d.minutes} min</p>
                    </div>
                  );
                }}
              />
              <Scatter data={scatterData} fill="#f59e0b">
                {scatterData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Scatter>
            </ScatterChart>
          ) : mode === 'bar' ? (
            <BarChart data={ratingData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
              <XAxis dataKey="rating" stroke="#ffffff60" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="#ffffff60" fontSize={10} tickLine={false} axisLine={false}
                label={{ value: 'Min', angle: -90, position: 'insideLeft', fill: '#ffffff40', fontSize: 10 }} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: '#fff', fontWeight: 700 }}
                formatter={(v: any) => [`${v} min avg`, 'Avg Time']} />
              <Bar dataKey="avgMinutes" radius={[6, 6, 0, 0]}>
                {ratingData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          ) : (
            <LineChart data={ratingData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
              <XAxis dataKey="rating" stroke="#ffffff60" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="#ffffff60" fontSize={10} tickLine={false} axisLine={false}
                label={{ value: 'Min', angle: -90, position: 'insideLeft', fill: '#ffffff40', fontSize: 10 }} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [`${v} min`, 'Avg Time']} />
              <Line type="monotone" dataKey="avgMinutes" stroke="#f59e0b" strokeWidth={2.5}
                dot={{ r: 5, fill: '#f59e0b', stroke: '#0d1117', strokeWidth: 2 }}
                activeDot={{ r: 7, fill: '#f59e0b' }} />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function PracticeAnalytics({ sessions }: PracticeAnalyticsProps) {
  const completedSessions = useMemo(() => 
    sessions.filter(s => s.status === 'completed' && s.durationSeconds !== undefined),
    [sessions]
  );

  // --- Stat Cards ---
  const stats = useMemo(() => {
    if (completedSessions.length === 0) return null;

    const durations = completedSessions.map(s => s.durationSeconds || 0);
    const totalTime = durations.reduce((a, b) => a + b, 0);
    const avgTime = totalTime / durations.length;
    const fastest = Math.min(...durations);
    const slowest = Math.max(...durations);
    const median = [...durations].sort((a, b) => a - b)[Math.floor(durations.length / 2)];

    // Ratings solved
    const ratings = completedSessions
      .map(s => s.problemInfo?.rating)
      .filter((r): r is number => !!r);
    const avgRating = ratings.length > 0 ? Math.round(ratings.reduce((a, b) => a + b, 0) / ratings.length) : 0;
    const maxRating = ratings.length > 0 ? Math.max(...ratings) : 0;

    // Streak: consecutive days with at least one solve
    const daySet = new Set(
      completedSessions.map(s => new Date(s.startTime).toISOString().split('T')[0])
    );
    const sortedDays = Array.from(daySet).sort().reverse();
    let streak = 0;
    const today = new Date().toISOString().split('T')[0];
    let checkDate = new Date(today);
    for (let i = 0; i < 365; i++) {
      const dateStr = checkDate.toISOString().split('T')[0];
      if (daySet.has(dateStr)) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else if (i === 0) {
        // Today not solved yet, check from yesterday
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    // Efficiency: avg solve time per 100 rating points (lower = better)
    const withRating = completedSessions.filter(s => s.problemInfo?.rating);
    const efficiencyScore = withRating.length > 0
      ? Math.round(
          withRating.reduce((a, s) => a + (s.durationSeconds || 0) / (s.problemInfo!.rating! / 100), 0)
          / withRating.length
        )
      : 0;

    // Consistency: coefficient of variation (lower = more consistent)
    const stdDev = durations.length > 1
      ? Math.sqrt(durations.reduce((a, d) => a + Math.pow(d - avgTime, 2), 0) / durations.length)
      : 0;
    const consistencyPct = avgTime > 0 ? Math.max(0, Math.round(100 - (stdDev / avgTime) * 100)) : 0;

    // Improvement rate: compare first half avg vs second half avg (negative = faster = better)
    const half = Math.floor(durations.length / 2);
    const firstHalfAvg = half > 0 ? durations.slice(0, half).reduce((a, b) => a + b, 0) / half : 0;
    const secondHalfAvg = half > 0 ? durations.slice(half).reduce((a, b) => a + b, 0) / (durations.length - half) : 0;
    const improvementRate = half > 0 ? Math.round(((firstHalfAvg - secondHalfAvg) / firstHalfAvg) * 100) : 0;

    return {
      totalSolves: completedSessions.length,
      totalTime,
      avgTime,
      fastest,
      slowest,
      median,
      avgRating,
      maxRating,
      streak,
      uniqueDays: daySet.size,
      efficiencyScore,
      consistencyPct,
      improvementRate,
    };
  }, [completedSessions]);

  // --- Rating Bucket Data ---
  const ratingData = useMemo(() => {
    const map = new Map<number, { sum: number, count: number }>();
    
    completedSessions.forEach(s => {
      const rating = s.problemInfo?.rating || 0;
      if (rating === 0) return;
      
      const current = map.get(rating) || { sum: 0, count: 0 };
      map.set(rating, {
        sum: current.sum + (s.durationSeconds || 0),
        count: current.count + 1
      });
    });

    return Array.from(map.entries())
      .map(([rating, { sum, count }]) => ({
        rating: String(rating),
        avgMinutes: Number((sum / count / 60).toFixed(1)),
        count
      }))
      .sort((a, b) => Number(a.rating) - Number(b.rating));
  }, [completedSessions]);

  // --- Solve Trend (Last 10) — difficulty-normalized ---
  const trendData = useMemo(() => {
    return completedSessions
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
      .map((s, idx) => {
        const minutes = Number(((s.durationSeconds || 0) / 60).toFixed(1));
        const rating = s.problemInfo?.rating || 0;
        // normalizedSpeed: minutes per 100 rating points — lower means faster relative to difficulty
        const normalizedSpeed = rating > 0 ? Number((minutes / (rating / 100)).toFixed(2)) : null;
        return {
          index: idx + 1,
          minutes,
          rating: rating || 'N/A',
          normalizedSpeed,
          name: s.problemInfo?.name || 'Problem'
        };
      })
      .slice(-10);
  }, [completedSessions]);

  // --- Tag Performance ---
  const tagData = useMemo(() => {
    const map = new Map<string, { sum: number, count: number }>();
    
    completedSessions.forEach(s => {
      s.problemInfo?.tags?.forEach(tag => {
        const current = map.get(tag) || { sum: 0, count: 0 };
        map.set(tag, {
          sum: current.sum + (s.durationSeconds || 0),
          count: current.count + 1
        });
      });
    });

    return Array.from(map.entries())
      .map(([tag, { sum, count }]) => ({
        tag,
        avgMinutes: Number((sum / count / 60).toFixed(1)),
        count
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [completedSessions]);

  // --- Rating Distribution (Pie chart) ---
  const ratingDistribution = useMemo(() => {
    const buckets: Record<string, number> = {};
    completedSessions.forEach(s => {
      const rating = s.problemInfo?.rating;
      if (!rating) return;
      const bucket = `${Math.floor(rating / 200) * 200}-${Math.floor(rating / 200) * 200 + 199}`;
      buckets[bucket] = (buckets[bucket] || 0) + 1;
    });
    return Object.entries(buckets)
      .map(([range, count]) => ({ name: range, value: count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [completedSessions]);

  // --- Daily Solve Count (Area chart) ---
  const dailyData = useMemo(() => {
    const map = new Map<string, { count: number, totalMin: number }>();
    completedSessions.forEach(s => {
      const day = new Date(s.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const current = map.get(day) || { count: 0, totalMin: 0 };
      map.set(day, {
        count: current.count + 1,
        totalMin: Number((current.totalMin + (s.durationSeconds || 0) / 60).toFixed(1))
      });
    });
    return Array.from(map.entries())
      .map(([day, { count, totalMin }]) => ({ day, count, totalMin }));
  }, [completedSessions]);

  // --- Time of Day distribution ---
  const timeOfDayData = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => ({ 
      hour: `${i.toString().padStart(2, '0')}:00`, 
      count: 0 
    }));
    completedSessions.forEach(s => {
      const hour = new Date(s.startTime).getHours();
      hours[hour].count++;
    });
    return hours.filter(h => h.count > 0);
  }, [completedSessions]);

  // --- Difficulty vs Speed (Scatter) ---
  const scatterData = useMemo(() => {
    return completedSessions
      .filter(s => s.problemInfo?.rating)
      .map(s => ({
        rating: s.problemInfo!.rating!,
        minutes: Number(((s.durationSeconds || 0) / 60).toFixed(1)),
        name: s.problemInfo?.name || 'Problem'
      }));
  }, [completedSessions]);

  if (completedSessions.length === 0) {
    return null;
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)', marginTop: 'var(--space-lg)' }} className="animate-fade-in">
      {/* Section Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
        <BarChart3 size={22} style={{ color: 'var(--accent-cyan)' }} />
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>Performance Insights</h2>
      </div>
      <p className="text-muted text-sm" style={{ marginTop: '-var(--space-sm)' }}>
        Detailed breakdown of your solving speed and consistency.
      </p>

      {/* Key Stats Row */}
      {stats && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--space-md)' }}>
            <div className="card" style={{ padding: 'var(--space-md)', textAlign: 'center' }}>
              <div className="text-muted text-xs" style={{ marginBottom: 4 }}>Fastest Solve</div>
              <div className="font-bold font-mono" style={{ fontSize: 22, color: 'var(--accent-emerald)' }}>
                {formatTime(stats.fastest)}
              </div>
            </div>
            <div className="card" style={{ padding: 'var(--space-md)', textAlign: 'center' }}>
              <div className="text-muted text-xs" style={{ marginBottom: 4 }}>Median Time</div>
              <div className="font-bold font-mono" style={{ fontSize: 22, color: 'var(--accent-cyan)' }}>
                {formatTime(stats.median)}
              </div>
            </div>
            <div className="card" style={{ padding: 'var(--space-md)', textAlign: 'center' }}>
              <div className="text-muted text-xs" style={{ marginBottom: 4 }}>Avg Time</div>
              <div className="font-bold font-mono" style={{ fontSize: 22, color: '#a78bfa' }}>
                {formatTime(Math.round(stats.avgTime))}
              </div>
            </div>
            <div className="card" style={{ padding: 'var(--space-md)', textAlign: 'center' }}>
              <div className="text-muted text-xs" style={{ marginBottom: 4 }}>Avg Rating Solved</div>
              <div className="font-bold font-mono" style={{ fontSize: 22, color: 'var(--accent-purple)' }}>
                {stats.avgRating || '—'}
              </div>
            </div>
            <div className="card" style={{ padding: 'var(--space-md)', textAlign: 'center' }}>
              <div className="text-muted text-xs" style={{ marginBottom: 4 }}>Hardest Solved</div>
              <div className="font-bold font-mono" style={{ fontSize: 22, color: 'var(--accent-amber)' }}>
                {stats.maxRating || '—'}
              </div>
            </div>
            <div className="card" style={{ padding: 'var(--space-md)', textAlign: 'center' }}>
              <div className="text-muted text-xs" style={{ marginBottom: 4 }}>Practice Streak</div>
              <div className="font-bold font-mono flex items-center justify-center gap-xs" style={{ fontSize: 22, color: 'var(--accent-red)' }}>
                <Flame size={18} /> {stats.streak}d
              </div>
            </div>
            <div className="card" style={{ padding: 'var(--space-md)', textAlign: 'center' }}>
              <div className="text-muted text-xs" style={{ marginBottom: 4 }}>Active Days</div>
              <div className="font-bold font-mono" style={{ fontSize: 22, color: 'var(--accent-blue)' }}>
                {stats.uniqueDays}
              </div>
            </div>
          </div>

          {/* Extra Insight Boxes */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-md)' }}>
            <div className="card" style={{ padding: 'var(--space-md)', display: 'flex', gap: 'var(--space-md)', alignItems: 'center' }}>
              <Gauge size={32} style={{ color: 'var(--accent-cyan)', flexShrink: 0 }} />
              <div>
                <div className="text-muted text-xs" style={{ marginBottom: 2 }}>Efficiency Score</div>
                <div className="font-bold font-mono" style={{ fontSize: 20, color: 'var(--accent-cyan)' }}>{stats.efficiencyScore > 0 ? `${stats.efficiencyScore}s` : '—'}</div>
                <div className="text-xs text-muted">sec per 100 rating pts · lower = better</div>
              </div>
            </div>
            <div className="card" style={{ padding: 'var(--space-md)', display: 'flex', gap: 'var(--space-md)', alignItems: 'center' }}>
              <Brain size={32} style={{ color: '#10b981', flexShrink: 0 }} />
              <div>
                <div className="text-muted text-xs" style={{ marginBottom: 2 }}>Consistency Index</div>
                <div className="font-bold font-mono" style={{ fontSize: 20, color: '#10b981' }}>{stats.consistencyPct}%</div>
                <div className="text-xs text-muted">low variance = predictable solver</div>
              </div>
            </div>
            <div className="card" style={{ padding: 'var(--space-md)', display: 'flex', gap: 'var(--space-md)', alignItems: 'center' }}>
              {stats.improvementRate >= 0
                ? <TrendingUp size={32} style={{ color: '#06b6d4', flexShrink: 0 }} />
                : <TrendingDown size={32} style={{ color: '#ef4444', flexShrink: 0 }} />}
              <div>
                <div className="text-muted text-xs" style={{ marginBottom: 2 }}>Speed Improvement</div>
                <div className="font-bold font-mono" style={{ fontSize: 20, color: stats.improvementRate >= 0 ? '#06b6d4' : '#ef4444' }}>
                  {stats.improvementRate >= 0 ? '+' : ''}{stats.improvementRate}%
                </div>
                <div className="text-xs text-muted">1st half vs 2nd half avg time</div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Charts Row 1: Rating vs Time + Trend */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 'var(--space-lg)' }}>
        {/* Avg Solve Time by Rating */}
        {ratingData.length > 0 && (
          <div className="card" style={{ padding: 'var(--space-lg)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', marginBottom: 'var(--space-md)' }}>
              <Target size={16} style={{ color: 'var(--accent-cyan)' }} />
              <h3 style={{ fontSize: 14, fontWeight: 600 }}>Avg Solve Time by Rating</h3>
            </div>
            <div style={{ width: '100%', height: 250 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ratingData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                  <XAxis 
                    dataKey="rating" 
                    stroke="#ffffff60" 
                    fontSize={11} 
                    tickLine={false} 
                    axisLine={false}
                  />
                  <YAxis 
                    stroke="#ffffff60" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false}
                    label={{ value: 'Min', angle: -90, position: 'insideLeft', fill: '#ffffff40', fontSize: 10 }}
                  />
                  <Tooltip 
                    contentStyle={{ background: '#0d1117', border: '1px solid #ffffff20', borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: '#ffffff', fontWeight: 700 }}
                    itemStyle={{ color: '#06b6d4' }}
                    formatter={(value: any) => [`${value} min`, 'Avg Time']}
                  />
                  <Bar dataKey="avgMinutes" name="Avg Time" radius={[6, 6, 0, 0]}>
                    {ratingData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Solving Speed Trend — difficulty-normalized */}
        {trendData.length > 1 && (
          <div className="card" style={{ padding: 'var(--space-lg)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
                <TrendingUp size={16} style={{ color: 'var(--accent-emerald)' }} />
                <h3 style={{ fontSize: 14, fontWeight: 600 }}>Speed Trend (Last 10, Difficulty-Adjusted)</h3>
              </div>
            </div>
            <div className="text-xs text-muted" style={{ marginBottom: 8 }}>
              <span style={{ color: '#06b6d4' }}>━</span> Raw minutes &nbsp;
              <span style={{ color: '#f59e0b' }}>━━</span> Normalized (min per 100 rating pts) — falling line = getting faster relative to difficulty
            </div>
            <div style={{ width: '100%', height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                  <XAxis dataKey="index" stroke="#ffffff60" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="left" stroke="#ffffff60" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="right" orientation="right" stroke="#ffffff60" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ background: '#0d1117', border: '1px solid #ffffff20', borderRadius: 8, fontSize: 12 }}
                    content={({ active, payload }: any) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload;
                        return (
                          <div style={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '8px 12px' }}>
                            <p style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{d.name}</p>
                            <p style={{ fontSize: 11, color: '#ffffff70', marginBottom: 2 }}>Rating: {d.rating}</p>
                            <p style={{ fontSize: 12, color: '#06b6d4' }}>Time: {d.minutes} min</p>
                            {d.normalizedSpeed != null && (
                              <p style={{ fontSize: 11, color: '#f59e0b' }}>Normalized: {d.normalizedSpeed} min/100pts</p>
                            )}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Line yAxisId="left" type="monotone" dataKey="minutes" stroke="#06b6d4" strokeWidth={2.5}
                    dot={{ r: 4, fill: '#06b6d4', stroke: '#0d1117', strokeWidth: 2 }}
                    activeDot={{ r: 6, fill: '#06b6d4', stroke: 'white', strokeWidth: 2 }} name="Raw (min)" />
                  <Line yAxisId="right" type="monotone" dataKey="normalizedSpeed" stroke="#f59e0b" strokeWidth={2}
                    strokeDasharray="5 3"
                    dot={{ r: 4, fill: '#f59e0b', stroke: '#0d1117', strokeWidth: 2 }}
                    activeDot={{ r: 6, fill: '#f59e0b' }} name="Normalized" connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Charts Row 2: Scatter + Rating Distribution */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 'var(--space-lg)' }}>
        {/* Difficulty vs Speed — multi-mode */}
        {scatterData.length > 0 && (
          <DifficultySpeedPanel scatterData={scatterData} ratingData={ratingData} />
        )}

        {/* Rating Distribution Pie */}
        {ratingDistribution.length > 0 && (
          <div className="card" style={{ padding: 'var(--space-lg)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', marginBottom: 'var(--space-md)' }}>
              <Award size={16} style={{ color: 'var(--accent-purple)' }} />
              <h3 style={{ fontSize: 14, fontWeight: 600 }}>Rating Distribution</h3>
            </div>
            <div style={{ width: '100%', height: 250 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie 
                    data={ratingDistribution} 
                    dataKey="value" 
                    nameKey="name"
                    cx="50%" 
                    cy="50%" 
                    outerRadius={90}
                    innerRadius={50}
                    paddingAngle={3}
                    label={({ name, percent }) => `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`}
                    labelLine={{ stroke: '#ffffff30' }}
                    style={{ fontSize: 10 }}
                  >
                    {ratingDistribution.map((_, index) => (
                      <Cell key={`pie-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ background: '#0d1117', border: '1px solid #ffffff20', borderRadius: 8, fontSize: 12 }}
                    formatter={(value: any) => [`${value} problems`, 'Count']}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Charts Row 3: Tags + Daily Activity */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 'var(--space-lg)' }}>
        {/* Tag Performance */}
        {tagData.length > 0 && (
          <div className="card" style={{ padding: 'var(--space-lg)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', marginBottom: 'var(--space-md)' }}>
              <Zap size={16} style={{ color: 'var(--accent-purple)' }} />
              <h3 style={{ fontSize: 14, fontWeight: 600 }}>Top Tags — Avg Solve Time</h3>
            </div>
            <div style={{ width: '100%', height: Math.max(200, tagData.length * 38) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tagData} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" horizontal={false} />
                  <XAxis 
                    type="number" 
                    stroke="#ffffff60" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false}
                    label={{ value: 'Min', position: 'insideBottom', offset: -5, fill: '#ffffff40', fontSize: 10 }}
                  />
                  <YAxis 
                    type="category" 
                    dataKey="tag" 
                    stroke="#ffffff60" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false}
                    width={100}
                  />
                  <Tooltip 
                    contentStyle={{ background: '#0d1117', border: '1px solid #ffffff20', borderRadius: 8, fontSize: 12 }}
                    formatter={(value: any) => [`${value} min`, 'Avg Time']}
                  />
                  <Bar dataKey="avgMinutes" name="Avg Time" radius={[0, 6, 6, 0]} barSize={22}>
                    {tagData.map((_, index) => (
                      <Cell key={`tag-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Daily Activity */}
        {dailyData.length > 1 && (
          <div className="card" style={{ padding: 'var(--space-lg)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', marginBottom: 'var(--space-md)' }}>
              <Clock size={16} style={{ color: 'var(--accent-blue)' }} />
              <h3 style={{ fontSize: 14, fontWeight: 600 }}>Daily Practice Activity</h3>
            </div>
            <div style={{ width: '100%', height: 250 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyData}>
                  <defs>
                    <linearGradient id="gradientBlue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                  <XAxis dataKey="day" stroke="#ffffff60" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#ffffff60" fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip 
                    contentStyle={{ background: '#0d1117', border: '1px solid #ffffff20', borderRadius: 8, fontSize: 12 }}
                    formatter={(value: any, name: any) => [
                      name === 'count' ? `${value} problems` : `${value} min`,
                      name === 'count' ? 'Problems' : 'Total Time'
                    ]}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="count" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    fill="url(#gradientBlue)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Time of Day Distribution */}
      {timeOfDayData.length > 1 && (
        <div className="card" style={{ padding: 'var(--space-lg)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', marginBottom: 'var(--space-md)' }}>
            <Clock size={16} style={{ color: 'var(--accent-amber)' }} />
            <h3 style={{ fontSize: 14, fontWeight: 600 }}>When Do You Practice?</h3>
          </div>
          <div style={{ width: '100%', height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={timeOfDayData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                <XAxis dataKey="hour" stroke="#ffffff60" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#ffffff60" fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip 
                  contentStyle={{ background: '#0d1117', border: '1px solid #ffffff20', borderRadius: 8, fontSize: 12 }}
                  formatter={(value: any) => [`${value} solves`, 'Count']}
                />
                <Bar dataKey="count" name="Solves" radius={[4, 4, 0, 0]} barSize={20}>
                  {timeOfDayData.map((_, index) => (
                    <Cell key={`tod-${index}`} fill={`hsl(${200 + index * 8}, 70%, 55%)`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
