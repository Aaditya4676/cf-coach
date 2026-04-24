'use client';

import { TagStats } from '@/lib/types';
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Tooltip,
} from 'recharts';

interface TagRadarProps {
  tagStats: TagStats[];
}

export function TagRadar({ tagStats }: TagRadarProps) {
  if (tagStats.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-text">No tag data yet</div>
      </div>
    );
  }

  // Take top 10 tags by solved count for the radar
  const top = tagStats.slice(0, 10);
  const maxSolved = Math.max(...top.map(t => t.solved), 1);

  const data = top.map(t => ({
    tag: t.tag.length > 12 ? t.tag.slice(0, 12) + '…' : t.tag,
    fullTag: t.tag,
    solved: t.solved,
    solveRate: t.solveRate,
    normalized: Math.round((t.solved / maxSolved) * 100),
    avgDiff: t.avgDifficulty,
  }));

  return (
    <div style={{ width: '100%' }}>
      <div className="chart-container">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} cx="50%" cy="50%" outerRadius="70%">
            <PolarGrid
              stroke="rgba(99, 140, 255, 0.1)"
              gridType="polygon"
            />
            <PolarAngleAxis
              dataKey="tag"
              tick={{ fontSize: 11, fill: '#94a3b8' }}
            />
            <PolarRadiusAxis
              tick={false}
              axisLine={false}
              domain={[0, 100]}
            />
            <Radar
              name="Competency"
              dataKey="normalized"
              stroke="#3b82f6"
              fill="#3b82f6"
              fillOpacity={0.15}
              strokeWidth={2}
            />
            <Tooltip
              contentStyle={{
                background: 'rgba(12, 18, 34, 0.95)',
                border: '1px solid rgba(99, 140, 255, 0.2)',
                borderRadius: 10,
                padding: '10px 14px',
              }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(_value: any, _name: any, props: any) => {
                const p = props.payload;
                return [
                  <div key="info" style={{ fontSize: 12 }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>{p.fullTag}</div>
                    <div>Solved: <span style={{ color: '#3b82f6', fontWeight: 600 }}>{p.solved}</span></div>
                    <div>Solve Rate: <span style={{ color: p.solveRate >= 60 ? '#10b981' : '#f59e0b', fontWeight: 600 }}>{p.solveRate}%</span></div>
                    <div>Avg Difficulty: <span style={{ fontWeight: 600 }}>{p.avgDiff}</span></div>
                  </div>,
                  '',
                ];
              }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Tag list below radar */}
      <div className="flex gap-sm mt-sm" style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
        {top.slice(0, 8).map((t) => (
          <span key={t.tag} className="tag-pill">
            {t.tag}: {t.solved}
          </span>
        ))}
      </div>
    </div>
  );
}
