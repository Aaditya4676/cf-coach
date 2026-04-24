'use client';

import { DailyActivity } from '@/lib/types';

interface ActivityHeatmapProps {
  dailyActivity: DailyActivity[];
}

function getHeatmapLevel(count: number): number {
  if (count === 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  if (count <= 4) return 3;
  if (count <= 6) return 4;
  return 5;
}

export function ActivityHeatmap({ dailyActivity }: ActivityHeatmapProps) {
  if (dailyActivity.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-text">No activity data</div>
      </div>
    );
  }

  return (
    <div>
      <div className="heatmap-grid">
        {dailyActivity.map((day) => {
          const level = getHeatmapLevel(day.count);
          return (
            <div key={day.date} className="tooltip-wrapper">
              <div className={`heatmap-cell heatmap-${level}`} />
              <div className="tooltip">
                {day.date}: {day.count} problem{day.count !== 1 ? 's' : ''}
                {day.maxDifficulty > 0 && ` (max: ${day.maxDifficulty})`}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-sm mt-md" style={{ justifyContent: 'flex-end' }}>
        <span className="text-xs text-muted">Less</span>
        {[0, 1, 2, 3, 4, 5].map((level) => (
          <div
            key={level}
            className={`heatmap-cell heatmap-${level}`}
            style={{ cursor: 'default' }}
          />
        ))}
        <span className="text-xs text-muted">More</span>
      </div>
    </div>
  );
}
