'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { castBallot, getBallot, getBallotResults, resetBallot } from './actions';
import { announceBallot, setBallotAuto, useBallotProgress } from './ballot-alert';

type Person = { id: string; name: string; avatar: string };
type Tally = { id: string; student: string; avatar_key: string; votes: number };
export type BallotApi = {
  getBallot: (classroomId: string, voterId?: string) => Promise<{ nominated: string[] }>;
  castBallot: (classroomId: string, voterId: string, nomineeId: string) => Promise<unknown>;
  getBallotResults: (classroomId: string) => Promise<{ tally: Tally[]; voters: number }>;
  resetBallot: (classroomId: string) => Promise<unknown>;
};
const serverApi: BallotApi = {
  getBallot: (c, v) => getBallot(c, v),
  castBallot: (c, v, n) => castBallot(c, v, n),
  getBallotResults: (c) => getBallotResults(c) as unknown as Promise<{ tally: Tally[]; voters: number }>,
  resetBallot: (c) => resetBallot(c),
};

const shortName = (name: string) => {
  const p = name.trim().split(/\s+/).filter(Boolean);
  return p.length < 2 ? p[0] || name : `${p[0]} ${p.slice(1).map((x) => `${Array.from(x)[0]?.toLocaleUpperCase() || ''}.`).join(' ')}`;
};

type Step = 'who' | 'pick' | 'thanks';

/**
 * A secret ballot on one screen. A student taps their own name first, then a classmate who deserves a reward.
 * They can never pick themselves, and never the same classmate twice. After sending, the screen forgets the choice.
 */
export default function SecretBallot({ paneClass, classroomId, classroom, students, presentIds, api = serverApi }: {
  paneClass: string; classroomId: string; classroom: string; students: Person[]; presentIds?: string[]; api?: BallotApi;
}) {
  const [step, setStep] = useState<Step>('who');
  const [voter, setVoter] = useState<Person | null>(null);
  const [chosen, setChosen] = useState<string | null>(null); // the highlighted classmate, before sending
  const [done, setDone] = useState<string[]>([]); // classmates this voter already chose
  const [error, setError] = useState('');
  const [ready, setReady] = useState(true);
  const [busy, setBusy] = useState(false);
  const [teacher, setTeacher] = useState(false);
  const [results, setResults] = useState<{ tally: Tally[]; voters: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progress = useBallotProgress(classroom);

  const people = presentIds ? students.filter((s) => presentIds.includes(s.id)) : students;

  useEffect(() => { // is the ballot table there yet?
    if (!classroomId) return;
    api.getBallot(classroomId).then(() => setReady(true)).catch(() => setReady(false));
  }, [classroomId, api]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const reset = useCallback(() => { setStep('who'); setVoter(null); setChosen(null); setDone([]); setError(''); }, []);
  useEffect(() => { reset(); setTeacher(false); setResults(null); }, [classroomId, reset]);

  const startAs = async (p: Person) => {
    setError(''); setBusy(true);
    try { const r = await api.getBallot(classroomId, p.id); setDone(r.nominated); setVoter(p); setChosen(null); setStep('pick'); }
    catch { setError('The ballot is not ready yet. It needs one more database update.'); }
    finally { setBusy(false); }
  };

  const send = async () => {
    if (!voter || !chosen || busy) return;
    setBusy(true); setError('');
    try {
      await api.castBallot(classroomId, voter.id, chosen);
      setStep('thanks'); setChosen(null); setVoter(null); setDone([]);
      timer.current = setTimeout(reset, 2600); // the screen forgets everything, so the next student cannot see it
    } catch { setError('That vote could not be saved. You may have chosen this classmate already.'); }
    finally { setBusy(false); }
  };

  const showResults = async () => {
    const open = !teacher;
    setTeacher(open);
    if (!open) return;
    try { setResults(await api.getBallotResults(classroomId)); } catch { setResults(null); setError('Could not load the results.'); }
  };
  const clearAll = async () => {
    if (!window.confirm('Clear every vote in this classroom and start a new ballot?')) return;
    try { await api.resetBallot(classroomId); setResults(await api.getBallotResults(classroomId)); } catch { setError('Could not clear the ballot.'); }
  };

  const others = voter ? people.filter((s) => s.id !== voter.id) : [];

  return (
    <section className={`fun-card ballot-card ${paneClass}`}>
      <div className="ballot-head">
        <span className="ballot-emoji" aria-hidden="true">🤫</span>
        <div><h2>Secret ballot</h2><p>Who deserves a reward in {classroom || 'our class'}? Choose quietly. Nobody sees your choice.</p></div>
      </div>
      <div className="ballot-announce">
        <button type="button" className="fun-action secondary" onClick={() => announceBallot(classroom, 'manual')}>📢 Announce ballot time</button>
        <label><input type="checkbox" checked={progress.auto} onChange={(event) => setBallotAuto(event.target.checked)} /> Announce by itself after every 3 lessons</label>
        <small>{classroom || 'This class'}: {progress.count} {progress.count === 1 ? 'lesson' : 'lessons'} finished this week · the next announcement comes after {progress.untilNext} more</small>
      </div>
      {!ready && <p className="book-error" role="alert">The ballot is not ready yet. It needs one more database update.</p>}
      {error && ready && <p className="book-error" role="alert">{error}</p>}

      {step === 'who' && (
        <>
          <h3 className="ballot-step">Step 1 · Tap your own name</h3>
          {people.length === 0 ? <p className="readers-empty">No students here yet.</p> : (
            <ul className="ballot-grid">
              {people.map((s) => (
                <li key={s.id}><button type="button" className="ballot-person" disabled={busy || !ready} onClick={() => startAs(s)}><span aria-hidden="true">{s.avatar}</span><b>{shortName(s.name)}</b></button></li>
              ))}
            </ul>
          )}
        </>
      )}

      {step === 'pick' && voter && (
        <>
          <h3 className="ballot-step">Step 2 · Hi {shortName(voter.name)}! Who deserves a reward?</h3>
          <p className="ballot-note">You cannot choose yourself, and you cannot choose the same classmate twice.{done.length ? ` You have already chosen ${done.length}.` : ''}</p>
          <ul className="ballot-grid">
            {others.map((s) => {
              const used = done.includes(s.id);
              return (
                <li key={s.id}>
                  <button type="button" className={`ballot-person${chosen === s.id ? ' picked' : ''}${used ? ' used' : ''}`} disabled={used || busy} aria-pressed={chosen === s.id} onClick={() => setChosen(s.id)}>
                    <span aria-hidden="true">{s.avatar}</span><b>{shortName(s.name)}</b>{used && <small>Already chosen</small>}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="ballot-actions">
            <button type="button" className="fun-action secondary" onClick={reset}>Back</button>
            <button type="button" className="fun-action primary" disabled={!chosen || busy} onClick={send}>{busy ? 'Sending…' : 'Send my secret vote 🤫'}</button>
          </div>
        </>
      )}

      {step === 'thanks' && (
        <div className="ballot-thanks" role="status"><span aria-hidden="true">💌</span><h3>Thank you!</h3><p>Your vote is secret. Pass the screen to the next student.</p></div>
      )}

      <div className="ballot-teacher">
        <button type="button" className="text-link" onClick={showResults} aria-expanded={teacher}>{teacher ? 'Hide teacher results' : 'Teacher: show results'}</button>
        {teacher && results && (
          <div className="ballot-results">
            <p><b>{results.voters}</b> of {students.length} students have voted.</p>
            {results.tally.length === 0 ? <p className="readers-empty">No votes yet.</p> : (
              <ul>{results.tally.map((t) => <li key={t.id}><span>{t.student}</span><b>{t.votes} {t.votes === 1 ? 'vote' : 'votes'}</b></li>)}</ul>
            )}
            <button type="button" className="fun-action secondary" onClick={clearAll}>Clear all votes</button>
          </div>
        )}
      </div>
    </section>
  );
}
