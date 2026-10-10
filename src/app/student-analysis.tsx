'use client';

import { ChangeEvent, useEffect, useState, useTransition } from 'react';
import { Brain, Camera, Plus, Trash2, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { addStudentEntry, deleteStudentEntry, getStudentAnalysis, listAnalysisStudents, type AnalysisStudent } from './student-analysis-actions';
import { readImageText } from './read-image-text';
import type { BehaviourSummary, StudentEntry } from '@/lib/student-analysis';

type Area = 'academic' | 'behaviour';
const AREAS: Array<{ id: Area; label: string; hint: string }> = [
  { id: 'academic', label: 'Academic analysis', hint: 'Reading, writing, speaking, test results, strengths and what to work on.' },
  { id: 'behaviour', label: 'Behaviour analysis', hint: 'Attitude, social skills, concerns, incidents and what helps.' },
];
const today = () => { const d = new Date(); const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };

function EntryForm({ area, studentId, onAdded }: { area: (typeof AREAS)[number]; studentId: string; onAdded: (e: StudentEntry) => void }) {
  const [body, setBody] = useState('');
  const [date, setDate] = useState(today);
  const [source, setSource] = useState<'typed' | 'photo'>('typed');
  const [reading, setReading] = useState(false);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();

  const photo = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError(''); setReading(true);
    try { const text = await readImageText(file); setBody((b) => (b ? `${b}\n\n${text}` : text)); setSource('photo'); }
    catch { setError('Could not read any text in that picture. Try a clearer, well lit photo.'); }
    finally { setReading(false); }
  };
  const save = () => start(async () => {
    setError('');
    try { onAdded(await addStudentEntry({ studentId, area: area.id, body, entryDate: date, source })); setBody(''); setSource('typed'); }
    catch { setError('Could not save. Write something first and try again.'); }
  });

  return <div className="sa-form">
    <p className="sa-hint">{area.hint}</p>
    <label><span className="field-label">Date</span><input className="field-select" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
    <textarea className="field-select" rows={5} aria-label={area.label} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Type here, or add from a picture…" />
    <div className="sa-form-actions">
      <label className="outline-btn ti-photo"><Camera size={15} /> {reading ? 'Reading…' : 'From a picture'}<input type="file" accept="image/*" capture="environment" onChange={photo} disabled={reading} /></label>
      <button className="primary-btn" type="button" onClick={save} disabled={pending || reading || !body.trim()}><Plus size={15} /> Save</button>
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
  </div>;
}

function Summary({ s }: { s: BehaviourSummary }) {
  if (!s.days) return <p className="ti-empty">No daily checklist records in the last 90 days, so there is no automatic analysis yet.</p>;
  const Trend = s.trend === 'up' ? TrendingUp : s.trend === 'down' ? TrendingDown : Minus;
  return <div className="sa-summary">
    <div className="sa-score"><strong>{s.overall}%</strong><span>of daily goals met · {s.days} recorded {s.days === 1 ? 'day' : 'days'}</span>
      {s.trend && <em className={`sa-trend ${s.trend}`}><Trend size={14} /> {s.trend === 'up' ? 'Improving over the last 2 weeks' : s.trend === 'down' ? 'Slipping over the last 2 weeks' : 'Steady over the last 2 weeks'}</em>}</div>
    <div className="sa-bars">{s.perCriterion.map((c) => <div key={c.key} className="sa-bar"><span>{c.label}</span><div role="progressbar" aria-valuenow={c.percent} aria-valuemin={0} aria-valuemax={100} aria-label={c.label}><i style={{ width: `${c.percent}%` }} /></div><b>{c.percent}%</b></div>)}</div>
    <p className="sa-lines">{s.strengths.length ? <><strong>Strong in:</strong> {s.strengths.join(', ')}. </> : null}{s.needsAttention.length ? <><strong>Needs attention:</strong> {s.needsAttention.join(', ')}.</> : null}{!s.strengths.length && !s.needsAttention.length ? 'Results are mixed across all goals.' : null}</p>
  </div>;
}

export default function StudentAnalysis() {
  const [students, setStudents] = useState<AnalysisStudent[]>([]);
  const [studentId, setStudentId] = useState('');
  const [summary, setSummary] = useState<BehaviourSummary | null>(null);
  const [entries, setEntries] = useState<StudentEntry[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [, start] = useTransition();

  useEffect(() => { listAnalysisStudents().then(setStudents).catch(() => setError('Could not load students.')); }, []);
  useEffect(() => {
    if (!studentId) return;
    let live = true;
    setLoading(true); setError('');
    getStudentAnalysis(studentId).then((r) => { if (live) { setSummary(r.summary); setEntries(r.entries); } }).catch(() => live && setError('Could not load this student’s analysis.')).finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [studentId]);

  const classrooms = [...new Set(students.map((s) => s.classroom))];
  const remove = (id: string) => start(async () => { try { await deleteStudentEntry(id); setEntries((e) => e.filter((x) => x.id !== id)); } catch { setError('Could not delete this entry.'); } });
  const student = students.find((s) => s.id === studentId);

  return <section className="panel ti-panel" aria-labelledby="ti-students">
    <div className="panel-title"><div className="panel-icon purple"><Brain size={19} /></div><div><h2 id="ti-students">Student academic &amp; behaviour analysis</h2><p>Pick a student. Behaviour is analysed automatically from the daily goal checklists; add your own academic and behaviour observations, typed or from a picture.</p></div></div>
    <label className="sa-pick"><span className="field-label">Student</span>
      <select className="field-select" value={studentId} onChange={(e) => { setStudentId(e.target.value); setSummary(null); setEntries([]); }}>
        <option value="">Choose a student…</option>
        {classrooms.map((c) => <optgroup key={c} label={c}>{students.filter((s) => s.classroom === c).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</optgroup>)}
      </select></label>
    {error && <p className="form-error" role="alert">{error}</p>}
    {studentId && <>
      <h3 className="sa-name">{student?.name} <small>{student?.classroom}</small></h3>
      {loading ? <p className="ti-empty">Loading…</p> : <>
        {summary && <Summary s={summary} />}
        <div className="sa-areas">{AREAS.map((area) => <div className="sa-area" key={area.id}>
          <h3>{area.label}</h3>
          <EntryForm area={area} studentId={studentId} onAdded={(e) => setEntries((list) => [e, ...list])} />
          <div className="ti-notes">{entries.filter((e) => e.area === area.id).map((e) => <article className="ti-note" key={e.id}>
            <header><small>{e.entry_date}{e.source === 'photo' ? ' · from picture' : ''}</small><button type="button" className="icon-btn" aria-label="Delete entry" onClick={() => remove(e.id)}><Trash2 size={15} /></button></header>
            <p>{e.body}</p></article>)}</div>
        </div>)}</div>
      </>}
    </>}
  </section>;
}
