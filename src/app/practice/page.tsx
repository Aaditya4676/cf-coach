'use client';

import { useState, useEffect, useRef } from 'react';
import { useCFHandle } from '@/hooks/useCFHandle';
import { SolveSession, getSolveSessions, saveSolveSession, getActiveSession } from '@/lib/practice-timer';
import { Timer, Play, Square, CheckCircle2, XCircle, Loader2, Target, BarChart3 } from 'lucide-react';
import { getUserSubmissions } from '@/lib/codeforces';
import { CFProblem } from '@/lib/types';

function formatTime(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function parseProblemInput(input: string): { contestId: number; index: string } | null {
  input = input.trim();
  let match = input.match(/contest\/(\d+)\/problem\/([A-Za-z0-9]+)/i);
  if (match) return { contestId: parseInt(match[1]), index: match[2].toUpperCase() };
  
  match = input.match(/problemset\/problem\/(\d+)\/([A-Za-z0-9]+)/i);
  if (match) return { contestId: parseInt(match[1]), index: match[2].toUpperCase() };
  
  match = input.match(/^(\d+)\s*([A-Za-z0-9]+)$/i);
  if (match) return { contestId: parseInt(match[1]), index: match[2].toUpperCase() };
  
  return null;
}

export default function PracticePage() {
  const { handle, isReady } = useCFHandle();
  const [sessions, setSessions] = useState<SolveSession[]>([]);
  const [activeSession, setActiveSession] = useState<SolveSession | null>(null);
  
  // Timer state
  const [urlInput, setUrlInput] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [isPolling, setIsPolling] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const [verifying, setVerifying] = useState(false);
  const [verifiedProblem, setVerifiedProblem] = useState<CFProblem | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // Load data
  useEffect(() => {
    if (handle) {
      setSessions(getSolveSessions(handle));
      const active = getActiveSession(handle);
      if (active) {
        setActiveSession(active);
        setUrlInput(active.problemUrl);
      }
    }
  }, [handle]);

  // Timer loop
  useEffect(() => {
    if (activeSession && activeSession.status === 'active') {
      const startTime = new Date(activeSession.startTime).getTime();
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    } else {
      setElapsed(0);
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeSession]);

  // Polling loop
  useEffect(() => {
    let pollInterval: NodeJS.Timeout;
    
    const checkSubmissions = async () => {
      if (!handle || !activeSession || activeSession.status !== 'active') return;
      setIsPolling(true);
      try {
        const subs = await getUserSubmissions(handle, 1, 20);
        const startTimeSec = Math.floor(new Date(activeSession.startTime).getTime() / 1000);
        
        // Look for an 'OK' submission that happened AFTER start time
        // Note: For a robust implementation, we should extract contestId and index from URL
        // and match it against the submission.
        // For simplicity, we just look for the first OK submission since start.
        
        const solved = subs.find(s => 
          s.verdict === 'OK' && 
          s.creationTimeSeconds >= startTimeSec &&
          // Basic heuristic: URL contains contestId and index
          (activeSession.problemUrl.includes(s.problem.contestId.toString()) || 
           activeSession.problemUrl.includes(s.problem.index))
        );

        if (solved) {
          // Solved!
          const duration = Math.floor((solved.creationTimeSeconds * 1000 - new Date(activeSession.startTime).getTime()) / 1000);
          
          const completedSession: SolveSession = {
            ...activeSession,
            status: 'completed',
            endTime: new Date(solved.creationTimeSeconds * 1000).toISOString(),
            durationSeconds: duration,
            problemInfo: solved.problem
          };
          
          saveSolveSession(completedSession);
          setActiveSession(null);
          setUrlInput('');
          setSessions(getSolveSessions(handle));
        }
      } catch (err) {
        console.error('Polling error', err);
      } finally {
        setIsPolling(false);
      }
    };

    if (activeSession && activeSession.status === 'active') {
      // Poll every 15 seconds
      pollInterval = setInterval(checkSubmissions, 15000);
    }

    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [activeSession, handle]);

  const verifyProblem = async () => {
    const parsed = parseProblemInput(urlInput);
    if (!parsed) {
      setVerifyError('Invalid format. Use URL or ID like "1553C"');
      return;
    }
    
    setVerifying(true);
    setVerifyError(null);
    try {
      const res = await fetch(`/api/problem?contestId=${parsed.contestId}&index=${parsed.index}`);
      if (!res.ok) {
        throw new Error('Problem not found');
      }
      const data = await res.json();
      setVerifiedProblem(data.problem);
    } catch (err) {
      setVerifyError(err instanceof Error ? err.message : 'Error fetching problem');
    } finally {
      setVerifying(false);
    }
  };

  const startPractice = () => {
    if (!handle || !urlInput.trim() || activeSession) return;
    
    const newSession: SolveSession = {
      id: crypto.randomUUID(),
      handle,
      problemUrl: verifiedProblem ? `https://codeforces.com/problemset/problem/${verifiedProblem.contestId}/${verifiedProblem.index}` : urlInput.trim(),
      problemInfo: verifiedProblem || undefined,
      startTime: new Date().toISOString(),
      status: 'active'
    };
    
    saveSolveSession(newSession);
    setActiveSession(newSession);
    setSessions(getSolveSessions(handle));
  };

  const abandonPractice = () => {
    if (!activeSession) return;
    
    const abandoned: SolveSession = {
      ...activeSession,
      status: 'abandoned',
      endTime: new Date().toISOString(),
      durationSeconds: elapsed
    };
    
    saveSolveSession(abandoned);
    setActiveSession(null);
    setUrlInput('');
    setSessions(getSolveSessions(handle));
  };

  const completed = sessions.filter(s => s.status === 'completed');
  const avgTime = completed.length > 0 
    ? Math.floor(completed.reduce((a, b) => a + (b.durationSeconds || 0), 0) / completed.length)
    : 0;

  if (!isReady) return null;

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title flex items-center gap-sm">
          <Timer size={28} style={{ color: 'var(--accent-cyan)' }} />
          Live Practice
        </h1>
        <p className="page-description">
          Track your problem-solving speed and build contest stamina.
        </p>
      </div>

      <div className="grid-2">
        {/* Timer Panel */}
        <div className="card text-center" style={{ padding: 'var(--space-2xl)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          
          <div className="font-mono" style={{ fontSize: '64px', fontWeight: 'bold', color: activeSession ? 'var(--accent-emerald)' : 'var(--text-muted)', textShadow: activeSession ? '0 0 20px rgba(16, 185, 129, 0.3)' : 'none', marginBottom: 'var(--space-xl)' }}>
            {formatTime(elapsed)}
          </div>

          {!activeSession ? (
            <div className="w-full max-w-md mx-auto">
              <input
                type="text"
                placeholder="Paste Codeforces Problem URL or ID (e.g. 1553C)"
                value={urlInput}
                onChange={(e) => {
                  setUrlInput(e.target.value);
                  setVerifiedProblem(null);
                  setVerifyError(null);
                }}
                className="input-field mb-sm w-full"
                style={{ textAlign: 'center', fontFamily: 'monospace' }}
              />
              
              {verifyError && (
                <div className="text-red-500 text-xs mb-sm">{verifyError}</div>
              )}

              {!verifiedProblem ? (
                <button 
                  className="btn btn-primary w-full flex items-center justify-center gap-sm"
                  onClick={verifyProblem}
                  disabled={!urlInput.trim() || verifying}
                  style={{ padding: '16px', fontSize: '16px' }}
                >
                  {verifying ? <Loader2 size={16} className="spinner" /> : <Target size={16} />} Verify Problem
                </button>
              ) : (
                <div className="flex flex-col gap-sm">
                  <div className="text-sm p-sm rounded border" style={{ borderColor: 'var(--accent-emerald)', background: 'var(--accent-emerald-dim)', color: 'var(--accent-emerald)' }}>
                    ✅ Verified: <strong>{verifiedProblem.contestId}{verifiedProblem.index} - {verifiedProblem.name}</strong> ({verifiedProblem.rating || 'Unrated'})
                  </div>
                  <button 
                    className="btn btn-primary w-full flex items-center justify-center gap-sm"
                    onClick={startPractice}
                    style={{ padding: '16px', fontSize: '16px' }}
                  >
                    <Play fill="currentColor" size={16} /> Start Timer
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="w-full max-w-md mx-auto">
              <div className="text-sm text-muted mb-md font-mono truncate px-md py-sm rounded bg-black/20">
                {activeSession.problemUrl}
              </div>
              <div className="flex gap-md">
                <button 
                  className="btn flex-1 flex items-center justify-center gap-sm bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20"
                  onClick={abandonPractice}
                  style={{ padding: '16px', fontSize: '16px' }}
                >
                  <Square fill="currentColor" size={16} /> Abandon
                </button>
              </div>
              <div className="mt-xl text-xs text-muted flex items-center justify-center gap-xs">
                {isPolling ? <Loader2 size={12} className="spinner" /> : <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
                Auto-polling Codeforces for your solution...
              </div>
            </div>
          )}
        </div>

        {/* Stats Panel */}
        <div className="flex flex-col gap-lg">
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
            <div className="stat-card">
              <div className="stat-label">Total Solved (Timer)</div>
              <div className="stat-value">{completed.length}</div>
              <div className="stat-icon"><Target size={16} /></div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Average Time</div>
              <div className="stat-value">{formatTime(avgTime)}</div>
              <div className="stat-icon"><BarChart3 size={16} /></div>
            </div>
          </div>

          <div className="card flex-1">
            <div className="card-header">
              <div className="card-title">Recent Sessions</div>
            </div>
            
            {sessions.length === 0 ? (
              <div className="text-center text-muted text-sm py-xl">
                No practice sessions yet. Start the timer to record your speed!
              </div>
            ) : (
              <div className="flex flex-col gap-sm">
                {sessions.sort((a,b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()).slice(0, 5).map(s => (
                  <div key={s.id} className="flex items-center justify-between p-sm rounded bg-black/10 border border-white/5">
                    <div className="flex items-center gap-sm">
                      {s.status === 'completed' ? (
                        <CheckCircle2 size={16} className="text-emerald-500" />
                      ) : s.status === 'abandoned' ? (
                        <XCircle size={16} className="text-red-500" />
                      ) : (
                        <Timer size={16} className="text-amber-500 animate-pulse" />
                      )}
                      <div>
                        <div className="text-sm font-semibold truncate max-w-[200px]" title={s.problemUrl}>
                          {s.problemInfo ? `${s.problemInfo.contestId}${s.problemInfo.index} - ${s.problemInfo.name}` : new URL(s.problemUrl).pathname.split('/').pop() || 'Problem'}
                        </div>
                        <div className="text-xs text-muted">
                          {new Date(s.startTime).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div className="font-mono text-sm font-bold">
                      {s.durationSeconds ? formatTime(s.durationSeconds) : '--:--'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
