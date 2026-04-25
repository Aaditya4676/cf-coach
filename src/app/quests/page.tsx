'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCFHandle } from '@/hooks/useCFHandle';
import { Quest, VirtualProfile } from '@/lib/types';
import { getQuests, saveQuests, getVirtualProfile, addXP, recordFailedQuest } from '@/lib/quests';
import { Trophy, Star, CheckCircle2, XCircle, Clock, Zap, Loader2, Sparkles } from 'lucide-react';

export default function QuestsPage() {
  const router = useRouter();
  const { handle, isReady, needsSetup } = useCFHandle();
  const [profile, setProfile] = useState<VirtualProfile | null>(null);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [assessing, setAssessing] = useState(false);
  const [assessmentResult, setAssessmentResult] = useState<{ completed: number, failed: number } | null>(null);

  useEffect(() => {
    if (isReady && needsSetup) {
      router.push('/settings');
    }
  }, [isReady, needsSetup, router]);

  const loadData = async () => {
    if (!handle) return;
    setProfile(await getVirtualProfile(handle));
    setQuests(await getQuests(handle));
  };

  useEffect(() => {
    loadData();
  }, [handle]);

  // Background assessment hook
  useEffect(() => {
    if (!handle || quests.length === 0 || assessing) return;

    const activeQuests = quests.filter(q => q.status === 'active');
    if (activeQuests.length === 0) return;

    // Check if any active quest is past its target date
    const now = new Date();
    const overdueQuests = activeQuests.filter(q => new Date(q.targetDate) <= now);

    if (overdueQuests.length > 0) {
      runAssessment(overdueQuests);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quests, handle]);

  const runAssessment = async (questsToAssess: Quest[]) => {
    setAssessing(true);
    try {
      const { getAIHeaders } = await import('@/hooks/useAISettings');
      const response = await fetch('/api/assess-quests', {
        method: 'POST',
        headers: getAIHeaders(),
        body: JSON.stringify({ handle, quests: questsToAssess }),
      });

      if (!response.ok) throw new Error('Assessment failed');

      const { results } = await response.json();
      
      let newCompleted = 0;
      let newFailed = 0;
      
      // Update quests array
      const allQuests = await getQuests(handle);
      const updatedQuests = allQuests.map(q => {
        const assessment = results.find((r: any) => r.questId === q.id);
        if (assessment) {
          if (assessment.status === 'completed') {
            newCompleted++;
            addXP(handle, q.xpReward);
          } else {
            newFailed++;
            recordFailedQuest(handle);
          }
          return {
            ...q,
            status: assessment.status,
            feedback: assessment.feedback,
            completedAt: new Date().toISOString()
          };
        }
        return q;
      });

      await saveQuests(handle, updatedQuests);
      
      if (newCompleted > 0 || newFailed > 0) {
        setAssessmentResult({ completed: newCompleted, failed: newFailed });
        loadData(); // refresh UI state
        // Hide banner after 10s
        setTimeout(() => setAssessmentResult(null), 10000);
      }
    } catch (err) {
      console.error('Auto-assessment error:', err);
    } finally {
      setAssessing(false);
    }
  };

  const activeQuests = quests.filter(q => q.status === 'active');
  const pastQuests = quests.filter(q => q.status !== 'active').sort((a,b) => 
    new Date(b.completedAt || b.createdAt).getTime() - new Date(a.completedAt || a.createdAt).getTime()
  );

  if (!profile) return null;

  const xpProgress = (profile.xp / 100) * 100;

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title flex items-center gap-sm">
          <Trophy size={28} style={{ color: 'var(--accent-amber)' }} />
          Virtual Rating & Quests
        </h1>
        <p className="page-description">
          Level up by completing practical challenges based on AI analysis
        </p>
      </div>

      {assessing && (
        <div className="card mb-lg" style={{ background: 'var(--accent-blue-dim)', borderColor: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
          <Loader2 size={16} className="spinner" style={{ color: 'var(--accent-blue)' }} />
          <span className="font-semibold text-sm">Evaluating overdue quests in the background...</span>
        </div>
      )}
      
      {assessmentResult && (
        <div className="card mb-lg animate-fade-in" style={{ background: 'var(--accent-emerald-dim)', borderColor: 'var(--accent-emerald)', display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
          <Sparkles size={18} style={{ color: 'var(--accent-emerald)' }} />
          <span className="font-semibold text-sm">
            Assessment complete! {assessmentResult.completed} Quests Completed (+XP), {assessmentResult.failed} Failed.
          </span>
        </div>
      )}

      {/* Profile Stats */}
      <div className="card mb-lg relative overflow-hidden" style={{ padding: 'var(--space-2xl)' }}>
        <div style={{ position: 'absolute', top: -50, right: -50, opacity: 0.05 }}>
          <Star size={300} />
        </div>
        
        <div className="flex justify-between items-center mb-xl">
          <div>
            <div className="text-muted font-bold tracking-widest text-xs uppercase mb-xs">Virtual Rank</div>
            <div className="font-bold flex items-center gap-sm" style={{ fontSize: 32, letterSpacing: '-0.5px' }}>
              Level {profile.level}
              <div className="badge" style={{ background: 'var(--accent-amber-dim)', color: 'var(--accent-amber)', fontSize: 13, border: '1px solid var(--accent-amber)' }}>
                {profile.totalXPEarned} Total XP
              </div>
            </div>
          </div>
          
          <div className="flex gap-md" style={{ textAlign: 'right' }}>
            <div>
              <div className="text-muted text-xs mb-xs">Completed</div>
              <div className="font-bold font-mono text-lg" style={{ color: 'var(--accent-emerald)' }}>{profile.questsCompleted}</div>
            </div>
            <div>
              <div className="text-muted text-xs mb-xs">Failed</div>
              <div className="font-bold font-mono text-lg" style={{ color: 'var(--accent-red)' }}>{profile.questsFailed}</div>
            </div>
          </div>
        </div>

        {/* Level Progress */}
        <div>
          <div className="flex justify-between items-center mb-sm text-sm">
            <span className="font-semibold">XP to Level {profile.level + 1}</span>
            <span className="font-mono text-muted">{profile.xp} / 100</span>
          </div>
          <div className="progress-bar" style={{ height: 12 }}>
            <div
              className="progress-fill"
              style={{
                width: `${xpProgress}%`,
                background: 'linear-gradient(90deg, var(--accent-amber), #fcd34d)',
                boxShadow: '0 0 10px rgba(245, 158, 11, 0.4)'
              }}
            />
          </div>
        </div>
      </div>

      <div className="grid-2">
        {/* Active Quests */}
        <div>
          <h2 className="font-bold mb-md flex items-center gap-sm pb-sm" style={{ borderBottom: '1px solid var(--glass-border)' }}>
            <Zap size={18} style={{ color: 'var(--accent-amber)' }} />
            Active Quests ({activeQuests.length})
          </h2>
          
          {activeQuests.length === 0 ? (
            <div className="text-muted text-sm text-center py-xl">
              No active quests. Visit the AI Mentor to analyze your practice and generate new action items.
            </div>
          ) : (
            <div className="stagger flex flex-col gap-sm">
              {activeQuests.map((q) => {
                const daysLeft = Math.ceil((new Date(q.targetDate).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
                return (
                  <div key={q.id} className="card" style={{ padding: 'var(--space-md)' }}>
                    <div className="flex justify-between items-start mb-sm">
                      <h3 className="font-semibold" style={{ fontSize: 15 }}>{q.title}</h3>
                      <div className="badge badge-amber font-mono font-bold">+{q.xpReward} XP</div>
                    </div>
                    <p className="text-sm text-muted mb-md line-clamp-2">{q.description}</p>
                    <div className="flex justify-between items-center" style={{ borderTop: '1px solid var(--glass-border)', paddingTop: 'var(--space-sm)' }}>
                      <div className="flex gap-xs flex-wrap">
                        {q.relatedTags.slice(0,3).map(t => <span key={t} className="tag-pill">{t}</span>)}
                      </div>
                      <div className="text-xs font-semibold flex items-center gap-xs" style={{ color: daysLeft <= 1 ? 'var(--accent-red)' : 'var(--text-secondary)' }}>
                        <Clock size={12} />
                        {daysLeft > 0 ? `${daysLeft} days left` : 'Evaluating soon'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* History */}
        <div>
          <h2 className="font-bold mb-md flex items-center gap-sm pb-sm" style={{ borderBottom: '1px solid var(--glass-border)' }}>
            <Clock size={18} style={{ color: 'var(--text-secondary)' }} />
            History ({pastQuests.length})
          </h2>
          
          {pastQuests.length === 0 ? (
            <div className="text-muted text-sm text-center py-xl">
              No completed or failed quests yet.
            </div>
          ) : (
            <div className="stagger flex flex-col gap-sm">
              {pastQuests.map(q => (
                <div key={q.id} className="card" style={{ padding: 'var(--space-md)', opacity: 0.8 }}>
                  <div className="flex gap-sm items-start mb-sm">
                    <div style={{ marginTop: 2 }}>
                      {q.status === 'completed' ? (
                        <CheckCircle2 size={16} style={{ color: 'var(--accent-emerald)' }} />
                      ) : (
                        <XCircle size={16} style={{ color: 'var(--accent-red)' }} />
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold" style={{ fontSize: 14 }}>{q.title}</h3>
                      <div className="text-xs text-muted">
                        {new Date(q.completedAt || '').toLocaleDateString()} • {q.status === 'completed' ? `+${q.xpReward} XP` : '0 XP'}
                      </div>
                    </div>
                  </div>
                  {q.feedback && (
                    <div className="text-sm mt-sm" style={{ padding: 'var(--space-sm)', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
                      {q.feedback}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
