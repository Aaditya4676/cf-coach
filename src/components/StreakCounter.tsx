'use client';

import { StreakInfo } from '@/lib/types';
import { Flame, AlertTriangle, Coffee } from 'lucide-react';

interface StreakCounterProps {
  streak: StreakInfo;
}

export function StreakCounter({ streak }: StreakCounterProps) {
  if (streak.isOnBreak) {
    return (
      <div
        className="card flex items-center gap-md"
        style={{
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.06), var(--bg-card))',
          borderColor: 'rgba(245, 158, 11, 0.15)',
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 'var(--radius-lg)',
            background: 'var(--accent-amber-dim)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {streak.breakDays > 7 ? (
            <AlertTriangle size={22} color="var(--accent-amber)" />
          ) : (
            <Coffee size={22} color="var(--accent-amber)" />
          )}
        </div>
        <div style={{ flex: 1 }}>
          <div className="font-semibold" style={{ color: 'var(--accent-amber)' }}>
            {streak.breakDays > 7 ? '⚠️ Extended Break' : '☕ Taking a Break'}
          </div>
          <div className="text-sm text-muted">
            {streak.breakDays} days since last solve
            {streak.breakDays > 14 && ' — skill decay risk is high!'}
            {streak.breakDays > 7 && streak.breakDays <= 14 && ' — consider a warm-up session'}
            {streak.breakDays <= 7 && ' — rest is good, come back strong!'}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="text-xs text-muted">Longest streak</div>
          <div className="font-bold" style={{ fontSize: 18 }}>
            🔥 {streak.longestStreak}d
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="card flex items-center gap-md"
      style={{
        background: `linear-gradient(135deg, rgba(16, 185, 129, ${Math.min(streak.currentStreak * 0.02, 0.1)}), var(--bg-card))`,
        borderColor: `rgba(16, 185, 129, ${Math.min(streak.currentStreak * 0.05, 0.25)})`,
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 'var(--radius-lg)',
          background: 'var(--accent-emerald-dim)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Flame size={22} color="var(--accent-emerald)" />
      </div>
      <div style={{ flex: 1 }}>
        <div className="flex items-center gap-sm">
          <span className="streak-fire">🔥</span>
          <span className="font-bold" style={{ fontSize: 22, color: 'var(--accent-emerald)' }}>
            {streak.currentStreak} day streak
          </span>
        </div>
        <div className="text-sm text-muted">
          {streak.currentStreak >= 7
            ? 'Incredible consistency! Keep grinding!'
            : streak.currentStreak >= 3
              ? 'Building momentum — stay consistent!'
              : 'Great start! Let\'s keep it going!'}
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div className="text-xs text-muted">Longest streak</div>
        <div className="font-bold" style={{ fontSize: 18 }}>
          🏆 {streak.longestStreak}d
        </div>
      </div>
    </div>
  );
}
