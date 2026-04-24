'use client';

import { useState, useEffect } from 'react';
import { ReviewItem } from '@/lib/types';
import { updateReviewItem, getDueReviewItems, createReviewItem, getMasteryStats } from '@/lib/spaced-repetition';
import { RotateCcw, ExternalLink, CheckCircle2, XCircle, AlertCircle, BookOpen } from 'lucide-react';

import { useRouter } from 'next/navigation';
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

function getMasteryLabel(level: number): string {
  const labels = ['New', 'Learning', 'Familiar', 'Practiced', 'Solid', 'Mastered'];
  return labels[Math.min(level, 5)];
}

function getMasteryColor(level: number): string {
  if (level >= 4) return 'var(--accent-emerald)';
  if (level >= 2) return 'var(--accent-blue)';
  if (level >= 1) return 'var(--accent-amber)';
  return 'var(--accent-red)';
}

export default function ReviewPage() {
  const router = useRouter();
  const { handle, isReady, needsSetup } = useCFHandle();
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [reviewingIdx, setReviewingIdx] = useState<number | null>(null);

  useEffect(() => {
    if (isReady && needsSetup) {
      router.push('/settings');
    }
  }, [isReady, needsSetup, router]);

  useEffect(() => {
    if (!handle) return;
    const stored = localStorage.getItem(`reviews_${handle}`);
    if (stored) {
      setItems(JSON.parse(stored));
    }
  }, [handle]);

  const saveItems = (newItems: ReviewItem[]) => {
    setItems(newItems);
    if(handle) localStorage.setItem(`reviews_${handle}`, JSON.stringify(newItems));
  };

  const dueItems = getDueReviewItems(items);
  const masteryStats = getMasteryStats(items);

  const handleReview = (itemId: string, quality: number) => {
    const updated = items.map(item => {
      if (item.id !== itemId) return item;
      return updateReviewItem(item, quality);
    });
    saveItems(updated);
    setReviewingIdx(null);
  };

  const addSampleItems = () => {
    // Add some sample items for demonstration
    const samples = [
      createReviewItem('230/B', 'T-primes', 1300, ['binary search', 'math', 'number theory']),
      createReviewItem('363/B', 'Fence', 1100, ['brute force', 'dp']),
      createReviewItem('327/A', 'Flipping Game', 1200, ['brute force', 'dp', 'implementation']),
      createReviewItem('388/A', 'Fox and Box Accumulation', 1400, ['greedy', 'sortings']),
      createReviewItem('272/C', 'Dima and Staircase', 1500, ['data structures', 'implementation']),
    ];
    saveItems([...items, ...samples]);
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title flex items-center gap-sm">
          <RotateCcw size={28} style={{ color: 'var(--accent-cyan)' }} />
          Review Queue
        </h1>
        <p className="page-description">
          Spaced repetition — re-solve problems to build long-term mastery
        </p>
      </div>

      {/* Stats */}
      <div className="stats-grid mb-lg" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="stat-card">
          <div className="stat-label">📚 Total Items</div>
          <div className="stat-value" style={{ color: 'var(--accent-blue)' }}>{items.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">⏰ Due Today</div>
          <div className="stat-value" style={{ color: dueItems.length > 0 ? 'var(--accent-amber)' : 'var(--accent-emerald)' }}>
            {dueItems.length}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">✅ Mastered</div>
          <div className="stat-value" style={{ color: 'var(--accent-emerald)' }}>
            {items.filter(i => i.masteryLevel >= 4).length}
          </div>
        </div>
      </div>

      {/* Mastery by topic */}
      {masteryStats.size > 0 && (
        <div className="card mb-lg">
          <div className="card-header">
            <div className="card-title">
              <BookOpen size={16} />
              Topic Mastery
            </div>
          </div>
          <div className="flex gap-sm" style={{ flexWrap: 'wrap' }}>
            {Array.from(masteryStats.entries()).map(([tag, stats]) => (
              <div
                key={tag}
                style={{
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--glass-border)',
                }}
              >
                <div className="text-xs text-muted">{tag}</div>
                <div className="flex items-center gap-xs">
                  <span className="font-bold text-sm" style={{
                    color: getMasteryColor(Math.round(stats.avgMastery)),
                  }}>
                    {stats.avgMastery.toFixed(1)}/5
                  </span>
                  <span className="text-xs text-muted">({stats.count})</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {items.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-3xl)' }}>
          <div style={{ fontSize: 48, marginBottom: 'var(--space-md)' }}>🧠</div>
          <div className="empty-state-title">No review items yet</div>
          <div className="empty-state-text mb-lg">
            Problems you solve will be added here for spaced repetition review.
            <br />Add some sample items to try it out →
          </div>
          <button className="btn btn-primary" onClick={addSampleItems}>
            Add Sample Items
          </button>
        </div>
      )}

      {/* Due items */}
      {dueItems.length > 0 && (
        <div className="mb-lg">
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 'var(--space-md)', color: 'var(--accent-amber)' }}>
            ⏰ Due for Review ({dueItems.length})
          </h2>
          {dueItems.map((item, idx) => (
            <div key={item.id} className="card mb-sm" style={{
              padding: 'var(--space-md)',
              borderColor: reviewingIdx === idx ? 'var(--accent-blue)' : undefined,
            }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-md" style={{ flex: 1 }}>
                  <div
                    className="font-mono font-bold"
                    style={{
                      color: getDiffColor(item.problemRating),
                      minWidth: 40,
                    }}
                  >
                    {item.problemRating}
                  </div>
                  <div>
                    <a
                      href={`https://codeforces.com/problemset/problem/${item.problemId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold flex items-center gap-xs"
                    >
                      {item.problemName}
                      <ExternalLink size={12} style={{ opacity: 0.4 }} />
                    </a>
                    <div className="flex gap-xs mt-xs">
                      {item.tags.slice(0, 4).map(t => (
                        <span key={t} className="tag-pill">{t}</span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-md">
                  <span className="badge" style={{
                    background: `${getMasteryColor(item.masteryLevel)}20`,
                    color: getMasteryColor(item.masteryLevel),
                  }}>
                    {getMasteryLabel(item.masteryLevel)}
                  </span>

                  {reviewingIdx === idx ? (
                    <div className="flex gap-xs">
                      <button
                        className="btn btn-sm"
                        style={{ background: 'var(--accent-red-dim)', color: 'var(--accent-red)' }}
                        onClick={() => handleReview(item.id, 1)}
                        title="Couldn't solve it"
                      >
                        <XCircle size={14} /> Failed
                      </button>
                      <button
                        className="btn btn-sm"
                        style={{ background: 'var(--accent-amber-dim)', color: 'var(--accent-amber)' }}
                        onClick={() => handleReview(item.id, 3)}
                        title="Solved with difficulty"
                      >
                        <AlertCircle size={14} /> Hard
                      </button>
                      <button
                        className="btn btn-sm"
                        style={{ background: 'var(--accent-emerald-dim)', color: 'var(--accent-emerald)' }}
                        onClick={() => handleReview(item.id, 5)}
                        title="Solved easily"
                      >
                        <CheckCircle2 size={14} /> Easy
                      </button>
                    </div>
                  ) : (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => setReviewingIdx(idx)}
                    >
                      Review
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* All items list */}
      {items.length > 0 && dueItems.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
          <div style={{ fontSize: 40, marginBottom: 'var(--space-md)' }}>✅</div>
          <div className="font-bold" style={{ fontSize: 18, color: 'var(--accent-emerald)' }}>
            All caught up!
          </div>
          <div className="text-sm text-muted">
            No items due for review right now. Keep solving problems!
          </div>
        </div>
      )}
    </div>
  );
}
