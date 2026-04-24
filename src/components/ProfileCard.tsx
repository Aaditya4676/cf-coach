'use client';

import { CFUser, CFRank, CF_RANK_COLORS, StreakInfo } from '@/lib/types';
import { User, Trophy, Star, Calendar } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ProfileCardProps {
  user: CFUser;
  streak?: StreakInfo;
}

function getRankClass(rank: CFRank): string {
  return `rank-${rank.replace(/ /g, '-')}`;
}

export function ProfileCard({ user, streak }: ProfileCardProps) {
  const rankColor = CF_RANK_COLORS[user.rank];
  const lastOnline = formatDistanceToNow(new Date(user.lastOnlineTimeSeconds * 1000), { addSuffix: true });

  return (
    <div
      className="card"
      style={{
        borderColor: `${rankColor}33`,
        background: `linear-gradient(135deg, ${rankColor}08, var(--bg-card))`,
      }}
    >
      <div className="flex items-center gap-md" style={{ marginBottom: 'var(--space-lg)' }}>
        {user.avatar && !user.avatar.includes('no-avatar') ? (
          <img
            src={user.avatar}
            alt={user.handle}
            style={{
              width: 56,
              height: 56,
              borderRadius: 'var(--radius-lg)',
              border: `2px solid ${rankColor}`,
            }}
          />
        ) : (
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 'var(--radius-lg)',
              border: `2px solid ${rankColor}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--bg-input)',
            }}
          >
            <User size={24} color={rankColor} />
          </div>
        )}
        <div>
          <div
            className="font-bold"
            style={{ fontSize: 20, color: rankColor }}
          >
            {user.handle}
          </div>
          <div className="text-sm text-muted" style={{ textTransform: 'capitalize' }}>
            {user.rank}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
        <div>
          <div className="text-xs text-muted flex items-center gap-xs">
            <Trophy size={12} /> Rating
          </div>
          <div className="font-bold" style={{ fontSize: 22, color: rankColor }}>
            {user.rating}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted flex items-center gap-xs">
            <Star size={12} /> Max Rating
          </div>
          <div className="font-bold" style={{ fontSize: 22, color: CF_RANK_COLORS[user.maxRank] }}>
            {user.maxRating}
          </div>
        </div>
      </div>

      <div className="mt-md" style={{ borderTop: '1px solid var(--glass-border)', paddingTop: 'var(--space-md)' }}>
        <div className="flex items-center justify-between text-xs text-muted">
          <span className="flex items-center gap-xs">
            <Calendar size={12} />
            Online {lastOnline}
          </span>
          {user.organization && (
            <span>{user.organization}</span>
          )}
        </div>
      </div>
    </div>
  );
}
