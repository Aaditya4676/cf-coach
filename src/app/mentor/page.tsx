'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MentorAnalysis, TimeRange, TIME_RANGE_LABELS } from '@/lib/types';
import { convertActionItemsToQuests } from '@/lib/quests';
import { useCFHandle } from '@/hooks/useCFHandle';
import { getAIHeaders } from '@/hooks/useAISettings';
import { TimeRangeSelector } from '@/components/TimeRangeSelector';
import {
  Brain,
  Zap,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Sparkles,
  Clock,
  Shield,
  Loader2,
  BookOpen,
} from 'lucide-react';

export default function MentorPage() {
  const router = useRouter();
  const { handle, isReady, needsSetup } = useCFHandle();
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');
  const [analysis, setAnalysis] = useState<MentorAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cached, setCached] = useState(false);
  const [questsGenerated, setQuestsGenerated] = useState(false);

  useEffect(() => {
    if (isReady && needsSetup) {
      router.push('/settings');
    }
  }, [isReady, needsSetup, router]);

  const runAnalysis = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: getAIHeaders(),
        body: JSON.stringify({ handle, timeRange }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Analysis failed');
      }

      const data = await response.json();
      const newAnalysis: MentorAnalysis = data.analysis;
      setAnalysis(newAnalysis);
      setCached(data.cached);

      if (!data.cached && handle) {
        convertActionItemsToQuests(handle, newAnalysis.actionItems);
        setQuestsGenerated(true);
      } else {
        setQuestsGenerated(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title flex items-center gap-sm">
            <Brain size={28} style={{ color: 'var(--accent-purple)' }} />
            AI Mentor
          </h1>
          <p className="page-description">
            Brutally honest feedback on your practice quality
          </p>
        </div>
        <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
      </div>

      {/* Run Analysis Button */}
      {!analysis && !loading && (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-3xl)' }}>
          <div style={{ fontSize: 48, marginBottom: 'var(--space-md)' }}>🧠</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 'var(--space-sm)' }}>
            Ready for honest feedback?
          </h2>
          <p className="text-muted" style={{ maxWidth: 500, margin: '0 auto', marginBottom: 'var(--space-xl)' }}>
            The AI mentor will analyze your {TIME_RANGE_LABELS[timeRange].toLowerCase()} of practice
            and give you a no-BS assessment. This uses 1 API call.
          </p>
          <button
            className="btn btn-primary btn-lg"
            onClick={runAnalysis}
            disabled={loading}
          >
            <Sparkles size={18} />
            Analyze My Practice
          </button>
          {error && (
            <div className="mt-lg" style={{ color: 'var(--accent-red)', fontSize: 14 }}>
              ⚠️ {error}
            </div>
          )}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-3xl)' }}>
          <Loader2 size={40} className="spinner-lg" style={{ margin: '0 auto', marginBottom: 'var(--space-md)', color: 'var(--accent-purple)' }} />
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 'var(--space-sm)' }}>
            Analyzing your submissions...
          </h2>
          <p className="text-muted text-sm">
            Fetching data from Codeforces and running AI analysis
          </p>
        </div>
      )}

      {/* Analysis Results */}
      {analysis && !loading && (
        <div className="stagger">
          {/* Cached indicator */}
          {cached && (
            <div className="badge badge-neutral mb-md" style={{ fontSize: 11 }}>
              <Clock size={12} /> Cached result — same submissions
            </div>
          )}

          {/* Overall Verdict */}
          <div className={`verdict-card mb-lg verdict-${analysis.overallVerdict.replace('_', '-')}`}>
            <div className="flex items-center gap-md mb-md">
              <div style={{ fontSize: 40 }}>
                {analysis.overallVerdict === 'good' && '🟢'}
                {analysis.overallVerdict === 'needs_work' && '🟡'}
                {analysis.overallVerdict === 'not_productive' && '🔴'}
              </div>
              <div>
                <h2 style={{ fontSize: 22, fontWeight: 800 }}>
                  {analysis.overallVerdict === 'good' && 'Good Progress'}
                  {analysis.overallVerdict === 'needs_work' && 'Needs Adjustment'}
                  {analysis.overallVerdict === 'not_productive' && 'Not Productive'}
                </h2>
                <div className="text-sm text-muted">
                  Practice Quality: <span className="font-bold" style={{
                    color: analysis.practiceQualityScore >= 70 ? 'var(--accent-emerald)' :
                      analysis.practiceQualityScore >= 40 ? 'var(--accent-amber)' : 'var(--accent-red)'
                  }}>
                    {analysis.practiceQualityScore}/100
                  </span>
                </div>
              </div>
            </div>
            <p style={{ fontSize: 15, lineHeight: 1.7 }}>{analysis.summary}</p>
          </div>

          {questsGenerated && (
            <div className="card mb-lg" style={{ background: 'var(--accent-emerald-dim)', borderColor: 'var(--accent-emerald)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div className="flex items-center gap-sm">
                <Sparkles size={20} style={{ color: 'var(--accent-emerald)' }} />
                <span className="font-semibold text-sm">Action Items automatically added to your Quests!</span>
              </div>
              <button 
                className="btn btn-sm" 
                style={{ background: 'var(--accent-emerald)', color: '#000', border: 'none' }}
                onClick={() => router.push('/quests')}
              >
                View Quests →
              </button>
            </div>
          )}

          {/* Honest Feedback */}
          <div className="card mb-lg">
            <div className="mentor-section-title">
              <Shield size={16} style={{ color: 'var(--accent-red)' }} />
              Honest Feedback
            </div>
            <p style={{ fontSize: 15, lineHeight: 1.8, color: 'var(--text-secondary)' }}>
              {analysis.honestFeedback}
            </p>
          </div>

          <div className="grid-2 mb-lg">
            {/* Strengths */}
            <div className="card">
              <div className="mentor-section-title">
                <CheckCircle2 size={16} style={{ color: 'var(--accent-emerald)' }} />
                Strengths
              </div>
              {analysis.strengthAreas.map((s, i) => (
                <div key={i} className="flex items-center gap-sm mb-sm">
                  <span className="badge badge-emerald">{s}</span>
                </div>
              ))}
            </div>

            {/* Weaknesses */}
            <div className="card">
              <div className="mentor-section-title">
                <XCircle size={16} style={{ color: 'var(--accent-red)' }} />
                Weak Areas
              </div>
              {analysis.weakAreas.map((w, i) => (
                <div key={i} className="flex items-center gap-sm mb-sm">
                  <span className="badge badge-red">{w}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Action Items */}
          <div className="card mb-lg">
            <div className="mentor-section-title">
              <ArrowRight size={16} style={{ color: 'var(--accent-blue)' }} />
              Action Items
            </div>
            {analysis.actionItems.map((item, i) => (
              <div key={i} className="action-item">
                <div className={`action-priority ${item.priority}`} />
                <div className="action-content" style={{ flex: 1 }}>
                  <h4>{item.action}</h4>
                  <p>{item.reason}</p>
                  {item.relatedTags && item.relatedTags.length > 0 && (
                    <div className="flex gap-xs mt-sm">
                      {item.relatedTags.map(t => (
                        <span key={t} className="tag-pill">{t}</span>
                      ))}
                    </div>
                  )}
                </div>
                <span className={`badge badge-${item.priority === 'high' ? 'red' : item.priority === 'medium' ? 'amber' : 'blue'}`}>
                  {item.priority}
                </span>
              </div>
            ))}
          </div>

          {/* Spaced Repetition Suggestions */}
          {analysis.spacedRepetitionSuggestions && analysis.spacedRepetitionSuggestions.length > 0 && (
            <div className="card mb-lg">
              <div className="mentor-section-title">
                <Clock size={16} style={{ color: 'var(--accent-cyan)' }} />
                Spaced Repetition Schedule
              </div>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Topic</th>
                      <th>Last Practiced</th>
                      <th>Review By</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.spacedRepetitionSuggestions.map((s, i) => (
                      <tr key={i}>
                        <td className="font-semibold">{s.topic}</td>
                        <td className="text-muted">{s.lastPracticed}</td>
                        <td>{s.suggestedReviewDate}</td>
                        <td>
                          <span className={`badge badge-${
                            s.urgency === 'overdue' ? 'red' :
                            s.urgency === 'due_soon' ? 'amber' : 'emerald'
                          }`}>
                            {s.urgency === 'overdue' ? '⚠️ Overdue' :
                             s.urgency === 'due_soon' ? '⏰ Due Soon' : '✅ On Track'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Break Analysis */}
          {analysis.breakAnalysis && (
            <div className="card mb-lg" style={{
              borderColor: 'rgba(245, 158, 11, 0.2)',
              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.04), var(--bg-card))',
            }}>
              <div className="mentor-section-title">
                <AlertTriangle size={16} style={{ color: 'var(--accent-amber)' }} />
                Break Analysis ({analysis.breakAnalysis.breakDuration} days)
              </div>
              <div className="mb-md">
                <div className="text-sm font-semibold mb-sm" style={{ color: 'var(--accent-amber)' }}>
                  Skill Decay Risk:
                </div>
                <div className="flex gap-sm" style={{ flexWrap: 'wrap' }}>
                  {analysis.breakAnalysis.skillDecayRisk.map((s, i) => (
                    <span key={i} className="badge badge-amber">{s}</span>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-sm font-semibold mb-sm">Warm-up Plan:</div>
                {analysis.breakAnalysis.warmUpPlan.map((step, i) => (
                  <div key={i} className="flex items-center gap-sm mb-sm">
                    <span className="badge badge-neutral" style={{ minWidth: 24, justifyContent: 'center' }}>{i + 1}</span>
                    <span className="text-sm">{step}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Learning Insights */}
          {analysis.learningInsights && analysis.learningInsights.length > 0 && (
            <div className="card mb-lg">
              <div className="mentor-section-title">
                <BookOpen size={16} style={{ color: 'var(--accent-purple)' }} />
                Learning Science Insights
              </div>
              {analysis.learningInsights.map((insight, i) => (
                <div key={i} className="flex gap-sm mb-md" style={{ alignItems: 'flex-start' }}>
                  <span style={{ color: 'var(--accent-purple)', marginTop: 2 }}>💡</span>
                  <p className="text-sm" style={{ lineHeight: 1.7 }}>{insight}</p>
                </div>
              ))}
            </div>
          )}

          {/* Re-run Button */}
          <div style={{ textAlign: 'center', marginTop: 'var(--space-xl)' }}>
            <button className="btn btn-secondary" onClick={runAnalysis}>
              <Sparkles size={16} />
              Re-analyze (uses 1 API call)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
