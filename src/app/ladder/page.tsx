'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { LadderProblem, ALL_CF_TAGS } from '@/lib/types';
import { useCFHandle } from '@/hooks/useCFHandle';
import { getAIHeaders } from '@/hooks/useAISettings';
import { ExternalLink, Sparkles, Loader2, Save, CheckCircle2, RotateCcw } from 'lucide-react';

function getDiffColor(rating: number): string {
  if (rating >= 2400) return '#ff0000';
  if (rating >= 2100) return '#ff8c00';
  if (rating >= 1900) return '#aa00aa';
  if (rating >= 1600) return '#4444ff';
  if (rating >= 1400) return '#03a89e';
  if (rating >= 1200) return '#008000';
  return '#808080';
}

export default function LadderPage() {
  const router = useRouter();
  const { handle, isReady, needsSetup } = useCFHandle();
  const [problems, setProblems] = useState<LadderProblem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (isReady && needsSetup) {
      router.push('/settings');
    }
  }, [isReady, needsSetup, router]);

  // Config
  const [focusTags, setFocusTags] = useState<string[]>([]);
  const [diffMin, setDiffMin] = useState(1300);
  const [diffMax, setDiffMax] = useState(1800);
  const [count, setCount] = useState(20);

  const generateLadder = async () => {
    if (!handle) return;
    try {
      setLoading(true);
      setError(null);
      setSaved(false);

      const response = await fetch('/api/ladder', {
        method: 'POST',
        headers: getAIHeaders(),
        body: JSON.stringify({
          handle: handle,
          focusTags: focusTags.length > 0 ? focusTags : undefined,
          difficultyMin: diffMin,
          difficultyMax: diffMax,
          count,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to generate ladder');
      }

      const data = await response.json();
      setProblems(data.problems);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const toggleCompleted = (index: number) => {
    setProblems(prev => prev.map((p, i) =>
      i === index ? { ...p, isCompleted: !p.isCompleted } : p
    ));
  };

  const saveLadder = () => {
    const ladder = {
      id: crypto.randomUUID(),
      name: `${focusTags.length > 0 ? focusTags.join(', ') : 'Mixed'} Ladder`,
      description: `Rating ${diffMin}-${diffMax}, ${count} problems`,
      problems,
      targetTags: focusTags,
      difficultyRange: [diffMin, diffMax] as [number, number],
      totalProblems: problems.length,
      completedProblems: problems.filter(p => p.isCompleted).length,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Save to localStorage
    const existing = JSON.parse(localStorage.getItem(`ladders_${handle}`) || '[]');
    existing.push(ladder);
    localStorage.setItem(`ladders_${handle}`, JSON.stringify(existing));
    setSaved(true);
  };

  const completedCount = problems.filter(p => p.isCompleted).length;
  const progress = problems.length > 0 ? Math.round((completedCount / problems.length) * 100) : 0;

  const tagOptions = [...ALL_CF_TAGS].sort();

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title flex items-center gap-sm">
          <span style={{ color: 'var(--accent-emerald)' }}>📶</span>
          Practice Ladder
        </h1>
        <p className="page-description">
          AI-generated personalized problem sequence based on your weak areas
        </p>
      </div>

      {/* Configuration */}
      {problems.length === 0 && !loading && (
        <div className="card mb-lg">
          <div className="card-header">
            <div className="card-title">Configure Your Ladder</div>
          </div>

          {/* Difficulty Range */}
          <div className="grid-2 mb-lg" style={{ gap: 'var(--space-md)' }}>
            <div>
              <label className="text-xs text-muted mb-sm" style={{ display: 'block' }}>
                Min Difficulty
              </label>
              <input
                type="number"
                value={diffMin}
                onChange={(e) => setDiffMin(parseInt(e.target.value) || 800)}
                step={100}
                min={800}
                max={3500}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--glass-border)',
                  background: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  fontSize: 14,
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              />
            </div>
            <div>
              <label className="text-xs text-muted mb-sm" style={{ display: 'block' }}>
                Max Difficulty
              </label>
              <input
                type="number"
                value={diffMax}
                onChange={(e) => setDiffMax(parseInt(e.target.value) || 2000)}
                step={100}
                min={800}
                max={3500}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--glass-border)',
                  background: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  fontSize: 14,
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              />
            </div>
          </div>

          {/* Problem Count */}
          <div className="mb-lg">
            <label className="text-xs text-muted mb-sm" style={{ display: 'block' }}>
              Number of Problems
            </label>
            <input
              type="number"
              value={count}
              onChange={(e) => setCount(parseInt(e.target.value) || 15)}
              min={5}
              max={50}
              style={{
                width: 120,
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--glass-border)',
                background: 'var(--bg-input)',
                color: 'var(--text-primary)',
                fontSize: 14,
                fontFamily: "'JetBrains Mono', monospace",
              }}
            />
          </div>

          {/* Focus Tags */}
          <div className="mb-lg">
            <label className="text-xs text-muted mb-sm" style={{ display: 'block' }}>
              Focus Tags (optional — leave empty for AI to choose based on weak areas)
            </label>
            <div className="flex gap-sm" style={{ flexWrap: 'wrap' }}>
              {tagOptions.slice(0, 20).map(tag => (
                <button
                  key={tag}
                  className={`tag-pill`}
                  onClick={() => {
                    setFocusTags(prev =>
                      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
                    );
                  }}
                  style={{
                    cursor: 'pointer',
                    background: focusTags.includes(tag) ? 'var(--accent-blue-dim)' : undefined,
                    borderColor: focusTags.includes(tag) ? 'var(--accent-blue)' : undefined,
                    color: focusTags.includes(tag) ? 'var(--accent-blue)' : undefined,
                  }}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Generate Button */}
          <button
            className="btn btn-primary btn-lg"
            onClick={generateLadder}
            disabled={loading}
          >
            <Sparkles size={18} />
            Generate Ladder (1 API call)
          </button>

          {error && (
            <div className="mt-lg" style={{ color: 'var(--accent-red)', fontSize: 14 }}>
              ⚠️ {error}
            </div>
          )}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-3xl)' }}>
          <Loader2 size={40} className="spinner-lg" style={{ margin: '0 auto', marginBottom: 'var(--space-md)', color: 'var(--accent-emerald)' }} />
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 'var(--space-sm)' }}>
            Creating your ladder...
          </h2>
          <p className="text-muted text-sm">
            Analyzing your weak areas and selecting optimal problems
          </p>
        </div>
      )}

      {/* Results */}
      {problems.length > 0 && !loading && (
        <>
          {/* Progress Bar */}
          <div className="card mb-lg">
            <div className="flex items-center justify-between mb-md">
              <div>
                <span className="font-bold" style={{ fontSize: 18 }}>
                  {completedCount}/{problems.length} Completed
                </span>
                <span className="text-muted text-sm" style={{ marginLeft: 8 }}>
                  ({progress}%)
                </span>
              </div>
              <div className="flex gap-sm">
                {!saved ? (
                  <button className="btn btn-primary btn-sm" onClick={saveLadder}>
                    <Save size={14} /> Save Ladder
                  </button>
                ) : (
                  <span className="badge badge-emerald">
                    <CheckCircle2 size={12} /> Saved!
                  </span>
                )}
                <button className="btn btn-secondary btn-sm" onClick={() => { setProblems([]); setSaved(false); }}>
                  <RotateCcw size={14} /> New Ladder
                </button>
              </div>
            </div>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{
                  width: `${progress}%`,
                  background: progress >= 80 ? 'var(--accent-emerald)' :
                    progress >= 40 ? 'var(--accent-blue)' : 'var(--accent-amber)',
                }}
              />
            </div>
          </div>

          {/* Problem List */}
          <div className="stagger">
            {problems.map((p, i) => (
              <div
                key={`${p.contestId}-${p.index}`}
                className={`ladder-problem ${p.isCompleted ? 'completed' : ''}`}
              >
                <div
                  className={`ladder-checkbox ${p.isCompleted ? 'checked' : ''}`}
                  onClick={() => toggleCompleted(i)}
                >
                  {p.isCompleted && <CheckCircle2 size={14} color="white" />}
                </div>

                <div className="font-mono text-muted text-xs" style={{ width: 30 }}>
                  #{i + 1}
                </div>

                <div style={{ flex: 1 }}>
                  <div className="flex items-center gap-sm">
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold flex items-center gap-xs"
                      style={{
                        color: p.isCompleted ? 'var(--text-muted)' : 'var(--text-primary)',
                        textDecoration: p.isCompleted ? 'line-through' : 'none',
                      }}
                    >
                      {p.name}
                      <ExternalLink size={12} style={{ opacity: 0.4 }} />
                    </a>
                  </div>
                  <div className="text-xs text-muted mt-sm">{p.reason}</div>
                  <div className="flex gap-xs mt-sm" style={{ flexWrap: 'wrap' }}>
                    {p.tags.map(t => (
                      <span key={t} className="tag-pill">{t}</span>
                    ))}
                  </div>
                </div>

                <div className="font-mono font-bold" style={{ color: getDiffColor(p.rating) }}>
                  {p.rating}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
