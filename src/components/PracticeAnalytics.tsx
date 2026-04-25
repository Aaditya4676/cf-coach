'use client';

import React, { useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, Cell, PieChart, Pie, AreaChart, Area, ScatterChart, Scatter, ZAxis
} from 'recharts';
import { SolveSession } from '@/lib/practice-timer';
import { BarChart3, TrendingUp, Clock, Target, Zap, Activity, Award, Flame } from 'lucide-react';

interface PracticeAnalyticsProps {
  sessions: SolveSession[];
}

const COLORS = [
  '#06b6d4', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444',
  '#ec4899', '#3b82f6', '#14b8a6', '#f97316', '#a855f7'
];

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

  // --- Solve Trend (Last 10) ---
  const trendData = useMemo(() => {
    return completedSessions
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
      .map((s, idx) => ({
        index: idx + 1,
        minutes: Number(((s.durationSeconds || 0) / 60).toFixed(1)),
        rating: s.problemInfo?.rating || 'N/A',
        name: s.problemInfo?.name || 'Problem'
      }))
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

        {/* Solving Speed Trend */}
        {trendData.length > 1 && (
          <div className="card" style={{ padding: 'var(--space-lg)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', marginBottom: 'var(--space-md)' }}>
              <TrendingUp size={16} style={{ color: 'var(--accent-emerald)' }} />
              <h3 style={{ fontSize: 14, fontWeight: 600 }}>Solving Speed Trend (Last 10)</h3>
            </div>
            <div style={{ width: '100%', height: 250 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                  <XAxis 
                    dataKey="index" 
                    stroke="#ffffff60" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false}
                  />
                  <YAxis 
                    stroke="#ffffff60" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false}
                  />
                  <Tooltip 
                    contentStyle={{ background: '#0d1117', border: '1px solid #ffffff20', borderRadius: 8, fontSize: 12 }}
                    content={({ active, payload }: any) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div style={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '8px 12px' }}>
                            <p style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{data.name}</p>
                            <p style={{ fontSize: 11, color: '#ffffff80', marginBottom: 2 }}>Rating: {data.rating}</p>
                            <p style={{ fontSize: 12, color: '#06b6d4' }}>Time: {data.minutes} min</p>
                          </div>
                        );
                      }
                      return null;
                    }} 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="minutes" 
                    stroke="#06b6d4"
                    strokeWidth={2.5} 
                    dot={{ r: 5, fill: '#06b6d4', stroke: '#0d1117', strokeWidth: 2 }}
                    activeDot={{ r: 7, fill: '#06b6d4', stroke: 'white', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Charts Row 2: Scatter + Rating Distribution */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 'var(--space-lg)' }}>
        {/* Scatter: Rating vs Solve Time */}
        {scatterData.length > 1 && (
          <div className="card" style={{ padding: 'var(--space-lg)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', marginBottom: 'var(--space-md)' }}>
              <Activity size={16} style={{ color: 'var(--accent-amber)' }} />
              <h3 style={{ fontSize: 14, fontWeight: 600 }}>Difficulty vs Speed</h3>
            </div>
            <div style={{ width: '100%', height: 250 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                  <XAxis 
                    dataKey="rating" 
                    name="Rating" 
                    stroke="#ffffff60" 
                    fontSize={10} 
                    tickLine={false}
                    label={{ value: 'Rating', position: 'insideBottom', offset: -5, fill: '#ffffff40', fontSize: 10 }}
                  />
                  <YAxis 
                    dataKey="minutes" 
                    name="Minutes" 
                    stroke="#ffffff60" 
                    fontSize={10} 
                    tickLine={false}
                    label={{ value: 'Min', angle: -90, position: 'insideLeft', fill: '#ffffff40', fontSize: 10 }}
                  />
                  <ZAxis range={[40, 200]} />
                  <Tooltip 
                    contentStyle={{ background: '#0d1117', border: '1px solid #ffffff20', borderRadius: 8, fontSize: 12 }}
                    formatter={(value: any, name: any) => [name === 'Rating' ? value : `${value} min`, name]}
                    labelFormatter={() => ''}
                  />
                  <Scatter data={scatterData} fill="#f59e0b">
                    {scatterData.map((_, index) => (
                      <Cell key={`dot-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>
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
