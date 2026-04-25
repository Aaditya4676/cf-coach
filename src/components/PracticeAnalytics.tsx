'use client';

import React, { useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, Cell
} from 'recharts';
import { SolveSession } from '@/lib/practice-timer';

interface PracticeAnalyticsProps {
  sessions: SolveSession[];
}

export default function PracticeAnalytics({ sessions }: PracticeAnalyticsProps) {
  const completedSessions = useMemo(() => 
    sessions.filter(s => s.status === 'completed' && s.durationSeconds !== undefined),
    [sessions]
  );

  const ratingData = useMemo(() => {
    const map = new Map<number, { sum: number, count: number }>();
    
    completedSessions.forEach(s => {
      const rating = s.problemInfo?.rating || 0;
      if (rating === 0) return; // Skip unrated
      
      const current = map.get(rating) || { sum: 0, count: 0 };
      map.set(rating, {
        sum: current.sum + (s.durationSeconds || 0),
        count: current.count + 1
      });
    });

    return Array.from(map.entries())
      .map(([rating, { sum, count }]) => ({
        rating,
        avgMinutes: Number((sum / count / 60).toFixed(1)),
        count
      }))
      .sort((a, b) => a.rating - b.rating);
  }, [completedSessions]);

  const trendData = useMemo(() => {
    return completedSessions
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
      .map((s, idx) => ({
        index: idx + 1,
        minutes: Number(((s.durationSeconds || 0) / 60).toFixed(1)),
        rating: s.problemInfo?.rating || 'Unrated',
        name: s.problemInfo?.name || 'Problem'
      }))
      .slice(-10); // Last 10 sessions
  }, [completedSessions]);

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
      .slice(0, 8); // Top 8 tags
  }, [completedSessions]);

  if (completedSessions.length === 0) {
    return null;
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-black/80 border border-white/20 p-sm rounded shadow-xl backdrop-blur-md">
          <p className="text-xs font-bold text-white mb-xs">{label}</p>
          {payload.map((p: any, i: number) => (
            <p key={i} className="text-xs" style={{ color: p.color }}>
              {p.name}: {p.value} min
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex flex-col gap-lg mt-lg animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-lg">
        {/* Rating vs Avg Time */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title text-sm">Avg Solve Time by Rating</h3>
          </div>
          <div className="h-[250px] w-full pt-md">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ratingData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                <XAxis 
                  dataKey="rating" 
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
                  label={{ value: 'Min', angle: -90, position: 'insideLeft', fill: '#ffffff40', fontSize: 10 }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="avgMinutes" name="Avg Time" radius={[4, 4, 0, 0]}>
                  {ratingData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={`hsl(${200 + (entry.rating - 800) / 10}, 70%, 60%)`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Solve Time Trend */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title text-sm">Solving Speed Trend (Last 10)</h3>
          </div>
          <div className="h-[250px] w-full pt-md">
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
                  content={({ active, payload }: any) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-black/80 border border-white/20 p-sm rounded shadow-xl backdrop-blur-md">
                          <p className="text-xs font-bold text-white mb-xs">{data.name}</p>
                          <p className="text-[10px] text-muted mb-xs">Rating: {data.rating}</p>
                          <p className="text-xs text-accent-cyan">Time: {data.minutes} min</p>
                        </div>
                      );
                    }
                    return null;
                  }} 
                />
                <Line 
                  type="monotone" 
                  dataKey="minutes" 
                  stroke="var(--accent-cyan)" 
                  strokeWidth={2} 
                  dot={{ r: 4, fill: 'var(--accent-cyan)' }}
                  activeDot={{ r: 6, fill: 'var(--accent-cyan)', stroke: 'white' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Tag Performance */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title text-sm">Top Tags - Avg Solve Time</h3>
        </div>
        <div className="h-[300px] w-full pt-md">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={tagData} layout="vertical" margin={{ left: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" horizontal={false} />
              <XAxis type="number" stroke="#ffffff60" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis 
                type="category" 
                dataKey="tag" 
                stroke="#ffffff60" 
                fontSize={10} 
                tickLine={false} 
                axisLine={false}
                width={80}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="avgMinutes" name="Avg Time" fill="var(--accent-purple)" radius={[0, 4, 4, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
