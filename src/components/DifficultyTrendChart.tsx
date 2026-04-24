'use client';

import { useMemo, useState } from 'react';
import { WeeklyDifficultyPoint, ProblemRatingPoint } from '@/lib/types';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Scatter,
  ScatterChart,
  ReferenceLine,
} from 'recharts';

interface DifficultyTrendChartProps {
  weeklyTrend: WeeklyDifficultyPoint[];
  scatter: ProblemRatingPoint[];
  userRating: number;
}

function getRatingColor(rating: number): string {
  if (rating >= 2400) return '#ff0000';
  if (rating >= 2100) return '#ff8c00';
  if (rating >= 1900) return '#aa00aa';
  if (rating >= 1600) return '#4444ff';
  if (rating >= 1400) return '#03a89e';
  if (rating >= 1200) return '#008000';
  return '#808080';
}

// Custom scatter dot colored by CF rank
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function RatingDot(props: any) {
  const { cx, cy, payload } = props;
  if (!cx || !cy) return null;
  const color = getRatingColor(payload.rating);
  return (
    <circle
      cx={cx}
      cy={cy}
      r={4}
      fill={color}
      fillOpacity={0.75}
      stroke={color}
      strokeWidth={1}
      strokeOpacity={0.4}
    />
  );
}

export function DifficultyTrendChart({
  weeklyTrend,
  scatter,
  userRating,
}: DifficultyTrendChartProps) {
  const [activeTab, setActiveTab] = useState<'trend' | 'scatter'>('trend');

  // Scatter needs numeric x for Recharts — convert date to timestamp number
  const scatterData = useMemo(
    () =>
      scatter.map((p) => ({
        ...p,
        ts: new Date(p.date).getTime(),
        // Format for x-axis tick display
        tsLabel: p.dateLabel,
      })),
    [scatter]
  );

  // Build x-axis ticks for scatter: sample every ~10 points
  const scatterTicks = useMemo(() => {
    if (scatterData.length === 0) return [];
    const step = Math.max(1, Math.floor(scatterData.length / 8));
    return scatterData.filter((_, i) => i % step === 0 || i === scatterData.length - 1).map((d) => d.ts);
  }, [scatterData]);

  const ratingMin = scatterData.length > 0 ? Math.min(...scatterData.map((d) => d.rating)) - 100 : 800;
  const ratingMax = scatterData.length > 0 ? Math.max(...scatterData.map((d) => d.rating)) + 100 : 2000;
  const trendMin = weeklyTrend.length > 0 ? Math.min(...weeklyTrend.map(d => d.min)) - 100 : 800;
  const trendMax = weeklyTrend.length > 0 ? Math.max(...weeklyTrend.map(d => d.max)) + 100 : 2000;

  const RANK_LINES = [
    { value: 1200, label: 'Pupil', color: '#008000' },
    { value: 1400, label: 'Specialist', color: '#03a89e' },
    { value: 1600, label: 'Expert', color: '#4444ff' },
    { value: 1900, label: 'CM', color: '#aa00aa' },
    { value: 2100, label: 'Master', color: '#ff8c00' },
  ];

  if (weeklyTrend.length === 0 && scatter.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-text">No difficulty data in selected range</div>
      </div>
    );
  }

  return (
    <div>
      {/* Tab selector */}
      <div className="flex gap-sm mb-lg" style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: 'var(--space-md)' }}>
        <button
          className={`btn btn-sm ${activeTab === 'trend' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('trend')}
        >
          📈 Avg / Median Trend
        </button>
        <button
          className={`btn btn-sm ${activeTab === 'scatter' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('scatter')}
        >
          🔵 Problem Rating Map
        </button>
      </div>

      {/* ── TREND VIEW ── */}
      {activeTab === 'trend' && (
        <div>
          {/* Summary stats row */}
          {weeklyTrend.length > 0 && (() => {
            const allAvgs = weeklyTrend.map(w => w.avg);
            const overallMedian = weeklyTrend.map(w => w.median);
            const last = weeklyTrend[weeklyTrend.length - 1];
            const first = weeklyTrend[0];
            const avgTrend = last.avg - first.avg;
            return (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
                {[
                  { label: 'Latest Week Avg', value: last.avg, color: getRatingColor(last.avg) },
                  { label: 'Latest Week Median', value: last.median, color: getRatingColor(last.median) },
                  { label: 'Overall Avg', value: Math.round(allAvgs.reduce((a,b)=>a+b,0)/allAvgs.length), color: 'var(--accent-blue)' },
                  {
                    label: 'Trend',
                    value: `${avgTrend >= 0 ? '+' : ''}${avgTrend}`,
                    color: avgTrend > 0 ? 'var(--accent-emerald)' : avgTrend < 0 ? 'var(--accent-red)' : 'var(--text-secondary)',
                  },
                ].map(s => (
                  <div key={s.label} style={{ padding: 'var(--space-md)', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', border: '1px solid var(--glass-border)' }}>
                    <div className="text-xs text-muted mb-sm">{s.label}</div>
                    <div className="font-bold font-mono" style={{ fontSize: 22, color: s.color }}>{s.value}</div>
                  </div>
                ))}
              </div>
            );
          })()}

          <div style={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={weeklyTrend} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="rangeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.1} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,140,255,0.06)" vertical={false} />
                <XAxis
                  dataKey="weekLabel"
                  tick={{ fontSize: 11, fill: '#475569' }}
                  axisLine={{ stroke: 'rgba(99,140,255,0.1)' }}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={[trendMin, trendMax]}
                  tick={{ fontSize: 11, fill: '#475569' }}
                  axisLine={false}
                  tickLine={false}
                  width={45}
                />
                {/* User rating reference line */}
                <ReferenceLine
                  y={userRating}
                  stroke="#f59e0b"
                  strokeDasharray="5 3"
                  strokeWidth={1.5}
                  label={{ value: `You (${userRating})`, position: 'right', fill: '#f59e0b', fontSize: 10 }}
                />
                {/* Rank tier lines */}
                {RANK_LINES.filter(r => r.value >= trendMin && r.value <= trendMax).map(r => (
                  <ReferenceLine
                    key={r.value}
                    y={r.value}
                    stroke={r.color}
                    strokeDasharray="3 6"
                    strokeOpacity={0.25}
                    label={{ value: r.label, position: 'insideTopRight', fill: r.color, fontSize: 9, opacity: 0.6 }}
                  />
                ))}
                <Tooltip
                  contentStyle={{
                    background: 'rgba(12,18,34,0.97)',
                    border: '1px solid rgba(99,140,255,0.2)',
                    borderRadius: 10,
                    padding: '12px 16px',
                  }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  content={({ active, payload, label }: any) => {
                    if (!active || !payload?.length) return null;
                    const d: WeeklyDifficultyPoint = payload[0]?.payload;
                    return (
                      <div>
                        <div className="font-semibold mb-sm" style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                          Week of {label}
                        </div>
                        <div style={{ fontSize: 13 }}>
                          <div>Avg: <span className="font-bold font-mono" style={{ color: getRatingColor(d.avg) }}>{d.avg}</span></div>
                          <div>Median: <span className="font-bold font-mono" style={{ color: getRatingColor(d.median) }}>{d.median}</span></div>
                          <div>Range: <span className="font-mono" style={{ color: 'var(--text-muted)' }}>{d.min} – {d.max}</span></div>
                          <div>Problems: <span className="font-bold">{d.count}</span></div>
                        </div>
                      </div>
                    );
                  }}
                />
                {/* Min-max shaded area hack: use two areas */}
                <Area
                  type="monotone"
                  dataKey="max"
                  stroke="none"
                  fill="url(#rangeGrad)"
                  fillOpacity={1}
                  legendType="none"
                />
                <Area
                  type="monotone"
                  dataKey="min"
                  stroke="none"
                  fill="var(--bg-primary)"
                  fillOpacity={1}
                  legendType="none"
                />
                <Line
                  type="monotone"
                  dataKey="avg"
                  stroke="#3b82f6"
                  strokeWidth={2.5}
                  dot={weeklyTrend.length < 20 ? { r: 4, fill: 'var(--bg-primary)', stroke: '#3b82f6', strokeWidth: 2 } : false}
                  activeDot={{ r: 6, fill: '#3b82f6' }}
                  name="Avg"
                />
                <Line
                  type="monotone"
                  dataKey="median"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  strokeDasharray="5 3"
                  dot={false}
                  activeDot={{ r: 5, fill: '#8b5cf6' }}
                  name="Median"
                />
                <Legend
                  wrapperStyle={{ fontSize: 12, color: '#94a3b8', paddingTop: 8 }}
                  formatter={(v) => v === 'avg' ? 'Avg difficulty' : 'Median difficulty'}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="text-xs text-muted mt-sm" style={{ textAlign: 'center' }}>
            Shaded band shows min–max range per week
          </div>
        </div>
      )}

      {/* ── SCATTER VIEW ── */}
      {activeTab === 'scatter' && (
        <div>
          <div style={{ height: 350 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,140,255,0.06)" />
                <XAxis
                  type="number"
                  dataKey="ts"
                  domain={['dataMin', 'dataMax']}
                  ticks={scatterTicks}
                  tickFormatter={(ts: number) => {
                    const d = new Date(ts);
                    return `${d.toLocaleString('default', { month: 'short' })} ${d.getDate()}`;
                  }}
                  tick={{ fontSize: 10, fill: '#475569' }}
                  axisLine={{ stroke: 'rgba(99,140,255,0.1)' }}
                  tickLine={false}
                  name="Date"
                />
                <YAxis
                  type="number"
                  dataKey="rating"
                  domain={[ratingMin, ratingMax]}
                  tick={{ fontSize: 11, fill: '#475569' }}
                  axisLine={false}
                  tickLine={false}
                  width={45}
                  name="Rating"
                />
                {/* User rating line */}
                <ReferenceLine
                  y={userRating}
                  stroke="#f59e0b"
                  strokeDasharray="5 3"
                  strokeWidth={1.5}
                  label={{ value: `You (${userRating})`, position: 'right', fill: '#f59e0b', fontSize: 10 }}
                />
                {/* Optimal zone shading — show as extra reference lines */}
                <ReferenceLine
                  y={userRating - 200}
                  stroke="rgba(16,185,129,0.2)"
                  strokeDasharray="2 4"
                  label={{ value: '−200', position: 'right', fill: '#10b981', fontSize: 9, opacity: 0.5 }}
                />
                <ReferenceLine
                  y={userRating + 300}
                  stroke="rgba(16,185,129,0.2)"
                  strokeDasharray="2 4"
                  label={{ value: '+300', position: 'right', fill: '#10b981', fontSize: 9, opacity: 0.5 }}
                />
                {RANK_LINES.filter(r => r.value >= ratingMin && r.value <= ratingMax).map(r => (
                  <ReferenceLine
                    key={r.value}
                    y={r.value}
                    stroke={r.color}
                    strokeDasharray="3 6"
                    strokeOpacity={0.2}
                  />
                ))}
                <Tooltip
                  cursor={{ stroke: 'rgba(99,140,255,0.2)', strokeWidth: 1 }}
                  contentStyle={{
                    background: 'rgba(12,18,34,0.97)',
                    border: '1px solid rgba(99,140,255,0.2)',
                    borderRadius: 10,
                    padding: '12px 16px',
                    maxWidth: 280,
                  }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  content={({ active, payload }: any) => {
                    if (!active || !payload?.length) return null;
                    const d: ProblemRatingPoint = payload[0]?.payload;
                    return (
                      <div>
                        <div className="font-semibold mb-xs" style={{ fontSize: 13 }}>{d.name}</div>
                        <div style={{ fontSize: 12 }}>
                          <div>
                            Rating:{' '}
                            <span className="font-bold font-mono" style={{ color: getRatingColor(d.rating) }}>
                              {d.rating}
                            </span>
                          </div>
                          <div className="text-muted">{d.dateLabel}</div>
                          {d.tags.length > 0 && (
                            <div className="flex gap-xs mt-xs" style={{ flexWrap: 'wrap', marginTop: 6 }}>
                              {d.tags.slice(0, 5).map(t => (
                                <span key={t} className="tag-pill">{t}</span>
                              ))}
                            </div>
                          )}
                          <div className="mt-xs">
                            <a
                              href={`https://codeforces.com/problemset/problem/${d.contestId}/${d.index}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: 'var(--accent-blue)', fontSize: 11 }}
                            >
                              Open on CF →
                            </a>
                          </div>
                        </div>
                      </div>
                    );
                  }}
                />
                <Scatter
                  data={scatterData}
                  shape={<RatingDot />}
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="flex gap-md mt-md" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
            {[
              { label: '< 1200', color: '#808080' },
              { label: '1200', color: '#008000' },
              { label: '1400', color: '#03a89e' },
              { label: '1600', color: '#4444ff' },
              { label: '1900', color: '#aa00aa' },
              { label: '2100+', color: '#ff8c00' },
            ].map(l => (
              <div key={l.label} className="flex items-center gap-xs" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: l.color, opacity: 0.8 }} />
                {l.label}
              </div>
            ))}
            <div className="flex items-center gap-xs" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              <div style={{ width: 24, height: 2, background: '#10b981', opacity: 0.5, borderTop: '1px dashed #10b981' }} />
              Optimal zone
            </div>
          </div>
          <div className="text-xs text-muted mt-sm" style={{ textAlign: 'center' }}>
            Green dashed lines = your optimal practice zone ({userRating - 200}–{userRating + 300})
          </div>
        </div>
      )}
    </div>
  );
}
