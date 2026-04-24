'use client';

import { DifficultyBucket } from '@/lib/types';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ReferenceLine,
} from 'recharts';

interface DifficultyChartProps {
  distribution: DifficultyBucket[];
  userRating: number;
}

function getDiffColor(rating: number): string {
  if (rating >= 2400) return '#ff0000';
  if (rating >= 2100) return '#ff8c00';
  if (rating >= 1900) return '#aa00aa';
  if (rating >= 1600) return '#4444ff';
  if (rating >= 1400) return '#03a89e';
  if (rating >= 1200) return '#008000';
  return '#808080';
}

export function DifficultyChart({ distribution, userRating }: DifficultyChartProps) {
  if (distribution.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-text">No difficulty data yet</div>
      </div>
    );
  }

  return (
    <div className="chart-container">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={distribution} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(99, 140, 255, 0.06)"
            vertical={false}
          />
          <XAxis
            dataKey="rating"
            tick={{ fontSize: 11, fill: '#475569' }}
            axisLine={{ stroke: 'rgba(99, 140, 255, 0.1)' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#475569' }}
            axisLine={false}
            tickLine={false}
            width={30}
          />
          {userRating > 0 && (
            <ReferenceLine
              x={Math.round(userRating / 100) * 100}
              stroke="#f59e0b"
              strokeDasharray="4 4"
              strokeWidth={2}
              label={{
                value: `Your Rating (${userRating})`,
                position: 'top',
                fill: '#f59e0b',
                fontSize: 10,
              }}
            />
          )}
          <Tooltip
            contentStyle={{
              background: 'rgba(12, 18, 34, 0.95)',
              border: '1px solid rgba(99, 140, 255, 0.2)',
              borderRadius: 10,
              padding: '10px 14px',
            }}
            itemStyle={{ color: '#cbd5e1' }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: any) => [
              <span key="v" style={{ fontWeight: 700, color: '#f8fafc' }}>{value} problems</span>,
              'Solved',
            ]}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            labelFormatter={(label: any) => (
              <span style={{ fontWeight: 600, color: getDiffColor(Number(label)) }}>
                Rating {label}
              </span>
            )}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={40}>
            {distribution.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getDiffColor(entry.rating)} fillOpacity={0.7} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
