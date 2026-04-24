'use client';

import { TimeRange, TIME_RANGE_LABELS } from '@/lib/types';

interface TimeRangeSelectorProps {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
}

const ranges: TimeRange[] = ['7d', '14d', '30d', 'all'];

export function TimeRangeSelector({ value, onChange }: TimeRangeSelectorProps) {
  return (
    <div className="time-range-selector">
      {ranges.map((range) => (
        <button
          key={range}
          className={`time-range-btn ${value === range ? 'active' : ''}`}
          onClick={() => onChange(range)}
        >
          {TIME_RANGE_LABELS[range]}
        </button>
      ))}
    </div>
  );
}
