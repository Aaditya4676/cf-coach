'use client';

import { useState, useEffect } from 'react';
import { Ladder } from '@/lib/types';
import { BookmarkCheck, Trash2, ExternalLink, CheckCircle2 } from 'lucide-react';import { useRouter } from 'next/navigation';
import { useCFHandle } from '@/hooks/useCFHandle';

function getDiffColor(rating: number): string {
  if (rating >= 2400) return '#ff0000';
  if (rating >= 2100) return '#ff8c00';
  if (rating >= 1900) return '#aa00aa';
  if (rating >= 1600) return '#4444ff';
  if (rating >= 1400) return '#03a89e';
  if (rating >= 1200) return '#008000';
  return '#808080';
}

export default function SavedLaddersPage() {
  const router = useRouter();
  const { handle, isReady, needsSetup } = useCFHandle();
  const [ladders, setLadders] = useState<Ladder[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (isReady && needsSetup) {
      router.push('/settings');
    }
  }, [isReady, needsSetup, router]);

  useEffect(() => {
    if (!handle) return;
    const stored = localStorage.getItem(`ladders_${handle}`);
    if (stored) {
      setLadders(JSON.parse(stored));
    }
  }, [handle]);

  const deleteLadder = (id: string) => {
    const updated = ladders.filter(l => l.id !== id);
    setLadders(updated);
    if (handle) localStorage.setItem(`ladders_${handle}`, JSON.stringify(updated));
  };

  const toggleProblem = (ladderId: string, problemIdx: number) => {
    const updated = ladders.map(l => {
      if (l.id !== ladderId) return l;
      const newProblems = l.problems.map((p, i) =>
        i === problemIdx ? { ...p, isCompleted: !p.isCompleted } : p
      );
      return {
        ...l,
        problems: newProblems,
        completedProblems: newProblems.filter(p => p.isCompleted).length,
        updatedAt: new Date().toISOString(),
      };
    });
    setLadders(updated);
    if (handle) localStorage.setItem(`ladders_${handle}`, JSON.stringify(updated));
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title flex items-center gap-sm">
          <BookmarkCheck size={28} style={{ color: 'var(--accent-amber)' }} />
          Saved Ladders
        </h1>
        <p className="page-description">
          Your saved practice ladders with progress tracking
        </p>
      </div>

      {ladders.length === 0 && (
        <div className="card empty-state">
          <div className="empty-state-icon">📋</div>
          <div className="empty-state-title">No saved ladders yet</div>
          <div className="empty-state-text">
            Generate a ladder from the Practice Ladder page and save it here
          </div>
        </div>
      )}

      <div className="stagger">
        {ladders.map(ladder => {
          const progress = ladder.totalProblems > 0
            ? Math.round((ladder.completedProblems / ladder.totalProblems) * 100)
            : 0;
          const isExpanded = expandedId === ladder.id;

          return (
            <div key={ladder.id} className="card mb-md">
              {/* Header */}
              <div
                className="flex items-center justify-between"
                style={{ cursor: 'pointer' }}
                onClick={() => setExpandedId(isExpanded ? null : ladder.id)}
              >
                <div>
                  <div className="font-bold" style={{ fontSize: 16 }}>{ladder.name}</div>
                  <div className="text-xs text-muted">{ladder.description}</div>
                  <div className="flex gap-xs mt-sm">
                    {ladder.targetTags.slice(0, 5).map(t => (
                      <span key={t} className="tag-pill">{t}</span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-md">
                  <div style={{ textAlign: 'right' }}>
                    <div className="font-bold" style={{
                      color: progress >= 80 ? 'var(--accent-emerald)' :
                        progress >= 40 ? 'var(--accent-blue)' : 'var(--text-secondary)',
                    }}>
                      {progress}%
                    </div>
                    <div className="text-xs text-muted">
                      {ladder.completedProblems}/{ladder.totalProblems}
                    </div>
                  </div>
                  <button
                    className="btn btn-ghost btn-icon"
                    onClick={(e) => { e.stopPropagation(); deleteLadder(ladder.id); }}
                  >
                    <Trash2 size={16} style={{ color: 'var(--accent-red)' }} />
                  </button>
                </div>
              </div>

              {/* Progress bar */}
              <div className="progress-bar mt-md">
                <div
                  className="progress-fill"
                  style={{
                    width: `${progress}%`,
                    background: progress >= 80 ? 'var(--accent-emerald)' :
                      progress >= 40 ? 'var(--accent-blue)' : 'var(--accent-amber)',
                  }}
                />
              </div>

              {/* Expanded problem list */}
              {isExpanded && (
                <div className="mt-lg">
                  {ladder.problems.map((p, i) => (
                    <div
                      key={`${p.contestId}-${p.index}`}
                      className="flex items-center gap-md mb-sm"
                      style={{
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-sm)',
                        background: p.isCompleted ? 'rgba(16, 185, 129, 0.04)' : 'transparent',
                        opacity: p.isCompleted ? 0.6 : 1,
                      }}
                    >
                      <div
                        className={`ladder-checkbox ${p.isCompleted ? 'checked' : ''}`}
                        onClick={() => toggleProblem(ladder.id, i)}
                        style={{ width: 18, height: 18 }}
                      >
                        {p.isCompleted && <CheckCircle2 size={12} color="white" />}
                      </div>
                      <span className="font-mono text-xs text-muted">#{i + 1}</span>
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-xs text-sm"
                        style={{
                          flex: 1,
                          color: p.isCompleted ? 'var(--text-muted)' : 'var(--text-primary)',
                          textDecoration: p.isCompleted ? 'line-through' : 'none',
                        }}
                      >
                        {p.name}
                        <ExternalLink size={10} style={{ opacity: 0.3 }} />
                      </a>
                      <span className="font-mono text-sm font-bold" style={{ color: getDiffColor(p.rating) }}>
                        {p.rating}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
