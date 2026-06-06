'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useCFHandle } from '@/hooks/useCFHandle';
import { SolveSession, getSolveSessions, saveSolveSession, getActiveSession, hasRecentCompletion } from '@/lib/practice-timer';
import { Timer, Play, Square, CheckCircle2, XCircle, Loader2, Target, Pause } from 'lucide-react';
import { getUserSubmissions } from '@/lib/codeforces';
import { CFProblem } from '@/lib/types';
import PracticeAnalytics from '@/components/PracticeAnalytics';

function formatTime(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function parseInput(input: string): { type: 'problem'; contestId: number; index: string } | { type: 'contest'; contestId: number } | null {
  input = input.trim();
  let match = input.match(/contest\/(\d+)\/problem\/([A-Za-z0-9]+)/i);
  if (match) return { type: 'problem', contestId: parseInt(match[1]), index: match[2].toUpperCase() };
  
  match = input.match(/problemset\/problem\/(\d+)\/([A-Za-z0-9]+)/i);
  if (match) return { type: 'problem', contestId: parseInt(match[1]), index: match[2].toUpperCase() };
  
  match = input.match(/^(\d+)\s+([A-Za-z0-9]+)$/i) || input.match(/^(\d+)([A-Za-z]+)$/i);
  if (match) return { type: 'problem', contestId: parseInt(match[1]), index: match[2].toUpperCase() };

  match = input.match(/contest\/(\d+)\/?$/i);
  if (match) return { type: 'contest', contestId: parseInt(match[1]) };

  match = input.match(/^(\d+)$/i);
  if (match) return { type: 'contest', contestId: parseInt(match[1]) };
  
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
  const checkingRef = useRef(false); // Guard against concurrent checkSubmissions

  const [verifying, setVerifying] = useState(false);
  const [verifiedProblem, setVerifiedProblem] = useState<CFProblem | null>(null);
  const [verifiedContest, setVerifiedContest] = useState<{ contestId: number; problems: CFProblem[] } | null>(null);
  const [contestWarning, setContestWarning] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // Load data
  useEffect(() => {
    if (handle) {
      const loadData = async () => {
        const loadedSessions = await getSolveSessions(handle);
        setSessions(loadedSessions);
        const active = await getActiveSession(handle);
        if (active) {
          setActiveSession(active);
          setUrlInput(active.problemUrl);
        }
      };
      loadData();
    }
  }, [handle]);

  // Timer loop
  useEffect(() => {
    if (activeSession && activeSession.status === 'active') {
      const isPaused = activeSession.pausedAt != null;
      if (isPaused) {
        setElapsed(activeSession.pausedElapsed ?? 0);
        if (timerRef.current) clearInterval(timerRef.current);
      } else {
        const startMs = new Date(activeSession.startTime).getTime();
        setElapsed(Math.floor((Date.now() - startMs) / 1000));
        timerRef.current = setInterval(() => {
          setElapsed(Math.floor((Date.now() - startMs) / 1000));
        }, 1000);
      }
    } else {
      setElapsed(0);
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeSession]);

  const checkSubmissions = useCallback(async () => {
    if (!handle || !activeSession || activeSession.status !== 'active') return;
    if (activeSession.pausedAt != null) return;
    if (checkingRef.current) return;
    checkingRef.current = true;
    setIsPolling(true);
    try {
      const subs = await getUserSubmissions(handle, 1, 30);
      const startTimeSec = Math.floor(new Date(activeSession.startTime).getTime() / 1000);
      
      if (activeSession.problemInfo?._contestProblems) {
        const solvedProblems = activeSession.problemInfo._solvedProblems || [];
        const solvedSet = new Set(solvedProblems.map(sp => `${activeSession.problemInfo!.contestId}/${sp.index}`));
        
        const newSolves = subs.filter(s => 
          s.verdict === 'OK' && 
          s.creationTimeSeconds >= startTimeSec &&
          s.problem.contestId === activeSession.problemInfo!.contestId &&
          !solvedSet.has(`${s.problem.contestId}/${s.problem.index}`)
        ).sort((a, b) => a.creationTimeSeconds - b.creationTimeSeconds);

        if (newSolves.length > 0) {
          let currentSession = { ...activeSession, problemInfo: { ...activeSession.problemInfo, _solvedProblems: [...solvedProblems] } };
          
          for (const s of newSolves) {
            const lastSolveTimeSec = currentSession.problemInfo._solvedProblems.length > 0 
              ? Math.floor(currentSession.problemInfo._solvedProblems[currentSession.problemInfo._solvedProblems.length - 1].solveTimeMs / 1000)
              : startTimeSec;
            
            const submissionTimeSec = s.creationTimeSeconds;
            const realDuration = Math.max(0, submissionTimeSec - lastSolveTimeSec);
            
            const singleSession: SolveSession = {
              id: crypto.randomUUID(),
              handle,
              type: 'practice',
              problemUrl: `https://codeforces.com/problemset/problem/${s.problem.contestId}/${s.problem.index}`,
              problemInfo: s.problem,
              startTime: new Date(lastSolveTimeSec * 1000).toISOString(),
              endTime: new Date(submissionTimeSec * 1000).toISOString(),
              durationSeconds: realDuration,
              status: 'completed',
            };
            await saveSolveSession(singleSession);
            
            currentSession.problemInfo._solvedProblems.push({
              index: s.problem.index,
              solveTimeMs: submissionTimeSec * 1000,
              durationSeconds: realDuration,
              id: singleSession.id
            });
          }
          
          await saveSolveSession(currentSession);
          setActiveSession(currentSession);
          setSessions(await getSolveSessions(handle));
        }
      } else {
        const solved = subs.find(s => 
          s.verdict === 'OK' && 
          s.creationTimeSeconds >= startTimeSec &&
          activeSession.problemUrl.includes(s.problem.contestId.toString()) && 
          activeSession.problemUrl.includes(s.problem.index)
        );

        if (solved) {
          const isDuplicate = await hasRecentCompletion(handle, activeSession.problemUrl, activeSession.startTime);
          if (isDuplicate) {
            console.warn('Duplicate completion detected — already saved, cleaning up local state');
            setActiveSession(null);
            setUrlInput('');
            setSessions(await getSolveSessions(handle));
            return;
          }

          const submissionTimeMs = solved.creationTimeSeconds * 1000;
          const sessionStartMs = new Date(activeSession.startTime).getTime();
          const realDuration = Math.max(0, Math.floor((submissionTimeMs - sessionStartMs) / 1000));

          const completedSession: SolveSession = {
            ...activeSession,
            status: 'completed',
            endTime: new Date(submissionTimeMs).toISOString(),
            durationSeconds: realDuration,
            problemInfo: solved.problem,
            pausedElapsed: undefined,
            pausedAt: undefined,
          };
          
          await saveSolveSession(completedSession);
          setActiveSession(null);
          setUrlInput('');
          setSessions(await getSolveSessions(handle));
        }
      }
    } catch (err) {
      console.error('Polling error', err);
    } finally {
      setIsPolling(false);
      checkingRef.current = false;
    }
  }, [handle, activeSession]);

  // Polling loop
  useEffect(() => {
    let pollInterval: NodeJS.Timeout;
    
    if (activeSession && activeSession.status === 'active' && activeSession.pausedAt == null) {
      // Poll every 15 seconds only when timer is running
      pollInterval = setInterval(checkSubmissions, 15000);
    }

    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [activeSession, checkSubmissions]);

  const verifyInput = async () => {
    const parsed = parseInput(urlInput);
    if (!parsed) {
      setVerifyError('Invalid format. Use URL or ID like "1553C" or "1553" for contest');
      return;
    }
    
    setVerifying(true);
    setVerifyError(null);
    setContestWarning(null);
    try {
      if (parsed.type === 'problem') {
        const res = await fetch(`/api/problem?contestId=${parsed.contestId}&index=${parsed.index}`);
        if (!res.ok) throw new Error('Problem not found');
        const data = await res.json();
        setVerifiedProblem(data.problem);
        setVerifiedContest(null);
      } else {
        const res = await fetch(`/api/contest?contestId=${parsed.contestId}`);
        if (!res.ok) throw new Error('Contest not found');
        const data = await res.json();
        setVerifiedContest({ contestId: parsed.contestId, problems: data.problems });
        setVerifiedProblem(null);

        // Check if user has already solved any of these
        try {
          const subs = await getUserSubmissions(handle!, 1, 1000); // Check recent 1000 subs
          const solvedIds = new Set(subs.filter(s => s.verdict === 'OK').map(s => `${s.problem.contestId}/${s.problem.index}`));
          const solvedInContest = data.problems.filter((p: CFProblem) => solvedIds.has(`${p.contestId}/${p.index}`));
          
          if (solvedInContest.length > 0) {
            const names = solvedInContest.map((p: CFProblem) => p.index).join(', ');
            setContestWarning(`You have already solved ${solvedInContest.length} problem(s) in this contest (${names}). Best course of action: Focus on the remaining unsolved problems or practice speed-solving these again.`);
          }
        } catch (e) {
          // ignore error in checking subs
        }
      }
    } catch (err) {
      setVerifyError(err instanceof Error ? err.message : 'Error fetching data');
    } finally {
      setVerifying(false);
    }
  };

  const startPractice = async () => {
    if (!handle || !urlInput.trim() || activeSession) return;
    
    if (verifiedContest) {
      const newSession: SolveSession = {
        id: crypto.randomUUID(),
        handle,
        type: 'virtual_contest',
        problemUrl: `https://codeforces.com/contest/${verifiedContest.contestId}`,
        problemInfo: {
          contestId: verifiedContest.contestId,
          index: '',
          name: `Virtual Contest ${verifiedContest.contestId}`,
          type: 'PROGRAMMING',
          tags: [],
          _contestProblems: verifiedContest.problems,
          _solvedProblems: []
        },
        startTime: new Date().toISOString(),
        status: 'active'
      };
      await saveSolveSession(newSession);
      setActiveSession(newSession);
    } else if (verifiedProblem) {
      const newSession: SolveSession = {
        id: crypto.randomUUID(),
        handle,
        type: 'practice',
        problemUrl: `https://codeforces.com/problemset/problem/${verifiedProblem.contestId}/${verifiedProblem.index}`,
        problemInfo: verifiedProblem,
        startTime: new Date().toISOString(),
        status: 'active'
      };
      await saveSolveSession(newSession);
      setActiveSession(newSession);
    } else {
      const newSession: SolveSession = {
        id: crypto.randomUUID(),
        handle,
        type: 'practice',
        problemUrl: urlInput.trim(),
        startTime: new Date().toISOString(),
        status: 'active'
      };
      await saveSolveSession(newSession);
      setActiveSession(newSession);
    }
    setSessions(await getSolveSessions(handle));
  };

  const abandonPractice = async () => {
    if (!activeSession) return;
    
    const abandoned: SolveSession = {
      ...activeSession,
      status: 'abandoned',
      endTime: new Date().toISOString(),
      durationSeconds: elapsed,
      pausedElapsed: undefined,
      pausedAt: undefined,
    };
    
    await saveSolveSession(abandoned);
    setActiveSession(null);
    setUrlInput('');
    setSessions(await getSolveSessions(handle!));
  };

  const pausePractice = async () => {
    if (!activeSession || !handle) return;
    const pausedSession: SolveSession = {
      ...activeSession,
      pausedElapsed: elapsed,
      pausedAt: new Date().toISOString(),
    };
    await saveSolveSession(pausedSession);
    setActiveSession(pausedSession);
    setSessions(await getSolveSessions(handle));
  };

  const resumePractice = async () => {
    if (!activeSession || !handle || activeSession.pausedAt == null) return;
    const savedElapsed = activeSession.pausedElapsed ?? 0;
    // Shift startTime so that (now - newStartTime) = savedElapsed at resume instant
    const newStartTime = new Date(Date.now() - savedElapsed * 1000).toISOString();
    
    const resumedSession: SolveSession = {
      ...activeSession,
      startTime: newStartTime,
      pausedElapsed: undefined,
      pausedAt: undefined,
    };
    await saveSolveSession(resumedSession);
    setActiveSession(resumedSession);
    setSessions(await getSolveSessions(handle));
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
          
          <div className="font-mono" style={{ fontSize: '64px', fontWeight: 'bold', color: activeSession ? (activeSession.pausedAt ? 'var(--accent-amber, #f59e0b)' : 'var(--accent-emerald)') : 'var(--text-muted)', textShadow: activeSession ? (activeSession.pausedAt ? '0 0 20px rgba(245, 158, 11, 0.3)' : '0 0 20px rgba(16, 185, 129, 0.3)') : 'none', marginBottom: 'var(--space-xl)' }}>
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
                  setVerifiedContest(null);
                  setVerifyError(null);
                  setContestWarning(null);
                }}
                className="input-field mb-sm w-full"
                style={{ textAlign: 'center', fontFamily: 'monospace' }}
              />
              
              {verifyError && (
                <div className="text-red-500 text-xs mb-sm">{verifyError}</div>
              )}

              {!verifiedProblem && !verifiedContest ? (
                <button 
                  className="btn btn-primary w-full flex items-center justify-center gap-sm"
                  onClick={verifyInput}
                  disabled={!urlInput.trim() || verifying}
                  style={{ padding: '16px', fontSize: '16px' }}
                >
                  {verifying ? <Loader2 size={16} className="spinner" /> : <Target size={16} />} Verify Target
                </button>
              ) : (
                <div className="flex flex-col gap-sm">
                  {verifiedProblem && (
                    <div className="text-sm p-sm rounded border" style={{ borderColor: 'var(--accent-emerald)', background: 'var(--accent-emerald-dim)', color: 'var(--accent-emerald)' }}>
                      ✅ Verified Problem: <strong>{verifiedProblem.contestId}{verifiedProblem.index} - {verifiedProblem.name}</strong> ({verifiedProblem.rating || 'Unrated'})
                    </div>
                  )}
                  {verifiedContest && (
                    <>
                      <div className="text-sm p-sm rounded border" style={{ borderColor: 'var(--accent-emerald)', background: 'var(--accent-emerald-dim)', color: 'var(--accent-emerald)' }}>
                        ✅ Verified Contest: <strong>Virtual Contest {verifiedContest.contestId}</strong> ({verifiedContest.problems.length} problems)
                      </div>
                      {contestWarning && (
                        <div className="text-sm p-sm rounded border text-left" style={{ borderColor: 'var(--accent-amber)', background: 'var(--accent-amber-dim)', color: 'var(--accent-amber)' }}>
                          ⚠️ {contestWarning}
                        </div>
                      )}
                    </>
                  )}
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
                {activeSession.problemInfo?._contestProblems ? `Virtual Contest ${activeSession.problemInfo?.contestId}` : activeSession.problemUrl}
              </div>
              
              {activeSession.problemInfo?._contestProblems && activeSession.problemInfo?._solvedProblems && activeSession.problemInfo._solvedProblems.length > 0 && (
                <div className="mb-md text-left bg-black/30 p-sm rounded border border-white/10">
                  <div className="text-xs text-muted mb-xs uppercase tracking-wider font-semibold">Solved in this session</div>
                  <div className="flex flex-col gap-xs">
                    {activeSession.problemInfo._solvedProblems.map(sp => (
                      <div key={sp.index} className="flex justify-between items-center text-sm font-mono">
                        <span className="text-emerald-400">Problem {sp.index}</span>
                        <span className="text-cyan-400">+{formatTime(sp.durationSeconds)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="flex gap-md">
                {activeSession.pausedAt != null ? (
                  <button 
                    className="btn flex-1 flex items-center justify-center gap-sm btn-primary"
                    onClick={resumePractice}
                    style={{ padding: '16px', fontSize: '16px' }}
                  >
                    <Play fill="currentColor" size={16} /> Resume
                  </button>
                ) : (
                  <button 
                    className="btn flex-1 flex items-center justify-center gap-sm bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/20"
                    onClick={pausePractice}
                    style={{ padding: '16px', fontSize: '16px' }}
                  >
                    <Pause fill="currentColor" size={16} /> Pause
                  </button>
                )}
                <button 
                  className="btn flex-1 flex items-center justify-center gap-sm bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20"
                  onClick={abandonPractice}
                  style={{ padding: '16px', fontSize: '16px' }}
                >
                  <Square fill="currentColor" size={16} /> Abandon
                </button>
              </div>
              <div className="mt-xl text-xs text-muted flex flex-col items-center gap-sm">
                <div className="flex items-center justify-center gap-xs">
                  {activeSession.pausedAt != null ? (
                    <>
                      <div className="w-2 h-2 rounded-full bg-amber-500" />
                      Timer paused. Auto-polling suspended.
                    </>
                  ) : (
                    <>
                      {isPolling ? <Loader2 size={12} className="spinner" /> : <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
                      Auto-polling Codeforces for your solution...
                    </>
                  )}
                </div>
                <button 
                  onClick={checkSubmissions}
                  disabled={isPolling}
                  className="btn btn-secondary text-xs py-1 px-3 flex items-center gap-xs"
                >
                  {isPolling ? <Loader2 size={10} className="spinner" /> : <CheckCircle2 size={10} />} Check Now
                </button>
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
              <div className="stat-icon"><Timer size={16} /></div>
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

      <PracticeAnalytics sessions={sessions} />
    </div>
  );
}
