'use client';

import { CFRatingChange } from '@/lib/types';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { format } from 'date-fns';

interface RatingChartProps {
  ratingHistory: CFRatingChange[];
}

// Rating tier boundaries
const RATING_TIERS = [
  { value: 1200, label: 'Pupil', color: '#008000' },
  { value: 1400, label: 'Specialist', color: '#03a89e' },
  { value: 1600, label: 'Expert', color: '#4444ff' },
  { value: 1900, label: 'CM', color: '#aa00aa' },
];

function getRatingColor(rating: number): string {
  if (rating >= 2400) return '#ff0000';
  if (rating >= 2100) return '#ff8c00';
  if (rating >= 1900) return '#aa00aa';
  if (rating >= 1600) return '#4444ff';
  if (rating >= 1400) return '#03a89e';
  if (rating >= 1200) return '#008000';
  return '#808080';
}

export function RatingChart({ ratingHistory }: RatingChartProps) {
  if (ratingHistory.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-text">No rating history yet</div>
      </div>
    );
  }

  const data = ratingHistory.map((r) => ({
    date: format(new Date(r.ratingUpdateTimeSeconds * 1000), 'MMM yy'),
    fullDate: format(new Date(r.ratingUpdateTimeSeconds * 1000), 'MMM dd, yyyy'),
    rating: r.newRating,
    change: r.newRating - r.oldRating,
    contest: r.contestName,
    color: getRatingColor(r.newRating),
  }));

  const currentRating = data[data.length - 1]?.rating || 0;
  const minRating = Math.min(...data.map(d => d.rating)) - 100;
  const maxRating = Math.max(...data.map(d => d.rating)) + 100;

  return (
    <div className="chart-container">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="ratingGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={getRatingColor(currentRating)} stopOpacity={0.3} />
              <stop offset="100%" stopColor={getRatingColor(currentRating)} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(99, 140, 255, 0.06)"
            vertical={false}
          />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: '#475569' }}
            axisLine={{ stroke: 'rgba(99, 140, 255, 0.1)' }}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[minRating, maxRating]}
            tick={{ fontSize: 11, fill: '#475569' }}
            axisLine={false}
            tickLine={false}
            width={45}
          />
          {RATING_TIERS.filter(t => t.value >= minRating && t.value <= maxRating).map((tier) => (
            <ReferenceLine
              key={tier.value}
              y={tier.value}
              stroke={tier.color}
              strokeDasharray="4 4"
              strokeOpacity={0.3}
              label={{
                value: tier.label,
                position: 'right',
                fill: tier.color,
                fontSize: 10,
                opacity: 0.6,
              }}
            />
          ))}
          <Tooltip
            contentStyle={{
              background: 'rgba(12, 18, 34, 0.95)',
              border: '1px solid rgba(99, 140, 255, 0.2)',
              borderRadius: 10,
              padding: '12px 16px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            }}
            labelStyle={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: any, _name: any, props: any) => {
              const change = props.payload.change;
              const changeStr = change >= 0 ? `+${change}` : `${change}`;
              return [
                <span key="v" style={{ color: getRatingColor(Number(value)), fontWeight: 700 }}>
                  {value} ({changeStr})
                </span>,
                'Rating',
              ];
            }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            labelFormatter={(_label: any, payload: readonly any[]) => {
              if (payload && payload[0]) {
                return (
                  <div>
                    <div style={{ fontWeight: 600 }}>{payload[0].payload.fullDate}</div>
                    <div style={{ fontSize: 11, color: '#64748b', maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {payload[0].payload.contest}
                    </div>
                  </div>
                );
              }
              return _label;
            }}
          />
          <Area
            type="monotone"
            dataKey="rating"
            stroke={getRatingColor(currentRating)}
            strokeWidth={2}
            fill="url(#ratingGradient)"
            dot={false}
            activeDot={{
              r: 5,
              stroke: getRatingColor(currentRating),
              strokeWidth: 2,
              fill: 'var(--bg-primary)',
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
