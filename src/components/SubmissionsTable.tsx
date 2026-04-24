'use client';

import { CFSubmission } from '@/lib/types';
import { getProblemUrl } from '@/lib/codeforces';
import { formatDistanceToNow } from 'date-fns';
import { ExternalLink } from 'lucide-react';

interface SubmissionsTableProps {
  submissions: CFSubmission[];
}

function getVerdictClass(verdict: string): string {
  switch (verdict) {
    case 'OK': return 'verdict-ok';
    case 'WRONG_ANSWER': return 'verdict-wa';
    case 'TIME_LIMIT_EXCEEDED': return 'verdict-tle';
    case 'MEMORY_LIMIT_EXCEEDED': return 'verdict-mle';
    case 'RUNTIME_ERROR': return 'verdict-re';
    default: return 'verdict-wa';
  }
}

function getVerdictLabel(verdict: string): string {
  switch (verdict) {
    case 'OK': return 'Accepted';
    case 'WRONG_ANSWER': return 'Wrong Answer';
    case 'TIME_LIMIT_EXCEEDED': return 'TLE';
    case 'MEMORY_LIMIT_EXCEEDED': return 'MLE';
    case 'RUNTIME_ERROR': return 'Runtime Error';
    case 'COMPILATION_ERROR': return 'Compile Error';
    default: return verdict.replace(/_/g, ' ');
  }
}

function getDiffColor(rating: number | undefined): string {
  if (!rating) return 'var(--text-muted)';
  if (rating >= 2400) return '#ff0000';
  if (rating >= 2100) return '#ff8c00';
  if (rating >= 1900) return '#aa00aa';
  if (rating >= 1600) return '#4444ff';
  if (rating >= 1400) return '#03a89e';
  if (rating >= 1200) return '#008000';
  return '#808080';
}

export function SubmissionsTable({ submissions }: SubmissionsTableProps) {
  if (submissions.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-text">No submissions yet</div>
      </div>
    );
  }

  return (
    <div className="table-container" style={{ maxHeight: 400, overflowY: 'auto' }}>
      <table>
        <thead>
          <tr>
            <th>Problem</th>
            <th>Rating</th>
            <th>Verdict</th>
            <th>When</th>
          </tr>
        </thead>
        <tbody>
          {submissions.map((sub) => (
            <tr key={sub.id}>
              <td>
                <a
                  href={getProblemUrl(sub.problem.contestId, sub.problem.index)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-xs"
                  style={{ color: 'var(--text-primary)' }}
                >
                  <span className="truncate" style={{ maxWidth: 180 }}>
                    {sub.problem.name}
                  </span>
                  <ExternalLink size={12} style={{ flexShrink: 0, opacity: 0.4 }} />
                </a>
                <div className="flex gap-xs mt-sm" style={{ flexWrap: 'wrap' }}>
                  {sub.problem.tags.slice(0, 3).map(tag => (
                    <span key={tag} className="tag-pill">{tag}</span>
                  ))}
                </div>
              </td>
              <td>
                <span
                  className="font-bold font-mono"
                  style={{ color: getDiffColor(sub.problem.rating) }}
                >
                  {sub.problem.rating || '?'}
                </span>
              </td>
              <td>
                <span className={getVerdictClass(sub.verdict)}>
                  {getVerdictLabel(sub.verdict)}
                </span>
              </td>
              <td className="text-xs text-muted" style={{ whiteSpace: 'nowrap' }}>
                {formatDistanceToNow(new Date(sub.creationTimeSeconds * 1000), { addSuffix: true })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
