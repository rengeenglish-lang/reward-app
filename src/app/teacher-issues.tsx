'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useState, useTransition } from 'react';
import { Camera, CalendarDays, ClipboardList, Lightbulb, Lock, Plus, RotateCcw, Trash2, Unlock } from 'lucide-react';
import StudentAnalysis from './student-analysis';
import DepartmentTimeline from './department-timeline';
import UnitPlans from './unit-plans';
import PypProjects from './pyp-projects';
import { readImageText } from './read-image-text';
import { LESSONS, getProgram, resetProgram, saveProgram, type Slot } from './lesson-schedule';
import { addTeacherNote, deleteTeacherNote, listTeacherNotes } from './teacher-notes-actions';
import { GRADES, NOTE_KINDS, PYP_THEMES, kindLabel, type NoteKind, type TeacherNote } from '@/lib/teacher-issues';

import { PypThemeList, PypToolList } from './pyp-theme';

type Section = 'program' | 'notes' | 'students' | 'units' | 'timeline' | 'ideas' | 'pyp';
const DAYS = [{ n: 1, label: 'Monday' }, { n: 2, label: 'Tuesday' }, { n: 3, label: 'Wednesday' }, { n: 4, label: 'Thursday' }, { n: 5, label: 'Friday' }];
const today = () => { const d = new Date(); const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
const noteTag = (n: Pick<TeacherNote, 'kind' | 'grade' | 'theme'>) => [kindLabel(n.kind), n.grade ? `Grade ${n.grade}` : '', n.theme || ''].filter(Boolean).join(' · ');

function LessonProgram() {
  const [program, setProgram] = useState<Record<number, Slot[]>>(LESSONS);
  const [locked, setLocked] = useState(true);
  const [saved, setSaved] = useState('');
  useEffect(() => { setProgram(structuredClone(getProgram())); }, []);

  const edit = (day: number, index: number, patch: Partial<Slot>) => { setSaved(''); setProgram((p) => ({ ...p, [day]: (p[day] ?? []).map((s, i) => (i === index ? { ...s, ...patch } : s)) })); };
  const add = (day: number) => { setSaved(''); setProgram((p) => ({ ...p, [day]: [...(p[day] ?? []), { period: (p[day]?.length ?? 0) + 1, start: '09:00', end: '09:40', cls: '' }] })); };
  const remove = (day: number, index: number) => { setSaved(''); setProgram((p) => ({ ...p, [day]: (p[day] ?? []).filter((_, i) => i !== index) })); };
  const save = () => {
    const clean: Record<number, Slot[]> = {};
    for (const { n } of DAYS) clean[n] = (program[n] ?? []).filter((s) => s.cls.trim() && s.start && s.end && s.start < s.end).map((s) => ({ ...s, cls: s.cls.trim() })).sort((a, b) => a.start.localeCompare(b.start));
    try { saveProgram(clean); setProgram(clean); setLocked(true); setSaved('Saved. The lesson timer will use this program.'); } catch { setSaved('Could not save in this browser.'); }
  };
  const reset = () => { resetProgram(); setProgram(structuredClone(LESSONS)); setSaved('Back to the original program.'); };

  return <section className="panel ti-panel" aria-labelledby="ti-program">
    <div className="panel-title"><div className="panel-icon purple"><CalendarDays size={19} /></div><div><h2 id="ti-program">Teacher lesson program</h2><p>Your weekly timetable. Unlock it to adjust lessons; the automatic lesson timer follows it. Use class names like 4/A.</p></div></div>
    <div className="ti-actions">
      <button type="button" className="outline-btn" onClick={() => setLocked((v) => !v)}>{locked ? <><Unlock size={15} /> Adjust program</> : <><Lock size={15} /> Lock</>}</button>
      {!locked && <><button type="button" className="primary-btn" onClick={save}>Save program</button><button type="button" className="outline-btn" onClick={reset}><RotateCcw size={15} /> Original program</button></>}
      {saved && <span className="ti-status" role="status">{saved}</span>}
    </div>
    <div className="ti-days">{DAYS.map(({ n, label }) => <div className="ti-day" key={n}>
      <h3>{label}</h3>
      {(program[n] ?? []).length === 0 && <p className="ti-empty">No lessons.</p>}
      {(program[n] ?? []).map((s, i) => locked
        ? <div className="ti-slot" key={i}><strong>{s.cls}</strong><span>P{s.period} · {s.start}–{s.end}</span></div>
        : <div className="ti-slot edit" key={i}>
          <input aria-label={`${label} lesson ${i + 1} class`} className="field-select" value={s.cls} onChange={(e) => edit(n, i, { cls: e.target.value })} placeholder="4/A" maxLength={12} />
          <input aria-label="Period" className="field-select ti-period" type="number" min={1} max={12} value={s.period} onChange={(e) => edit(n, i, { period: Number(e.target.value) || 1 })} />
          <input aria-label="Start" className="field-select" type="time" value={s.start} onChange={(e) => edit(n, i, { start: e.target.value })} />
          <input aria-label="End" className="field-select" type="time" value={s.end} onChange={(e) => edit(n, i, { end: e.target.value })} />
          <button type="button" className="icon-btn" aria-label="Remove lesson" onClick={() => remove(n, i)}><Trash2 size={15} /></button>
        </div>)}
      {!locked && <button type="button" className="outline-btn ti-add" onClick={() => add(n)}><Plus size={14} /> Add lesson</button>}
    </div>)}</div>
  </section>;
}

type Draft = { kind: NoteKind; grade: number | null; theme: string | null; title: string; body: string; date: string; source: 'typed' | 'photo' };
const emptyDraft = (): Draft => ({ kind: 'department', grade: null, theme: null, title: '', body: '', date: today(), source: 'typed' });

function MeetingNotes({ draft, setDraft }: { draft: Draft; setDraft: (d: Draft) => void }) {
  const [notes, setNotes] = useState<TeacherNote[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [reading, setReading] = useState(false);
  const [pending, start] = useTransition();
  const [fKind, setFKind] = useState<'all' | NoteKind>('all');
  const [fGrade, setFGrade] = useState(0);
  const [fTheme, setFTheme] = useState('');

  useEffect(() => { listTeacherNotes().then((n) => { setNotes(n); setLoaded(true); }).catch(() => { setError('Could not load saved notes.'); setLoaded(true); }); }, []);

  const needsGrade = draft.kind === 'class' || draft.kind === 'project';
  const patch = (p: Partial<Draft>) => setDraft({ ...draft, ...p });
  const setKind = (kind: NoteKind) => patch({ kind, grade: kind === 'class' || kind === 'project' ? draft.grade ?? 1 : null, theme: kind === 'project' ? draft.theme ?? PYP_THEMES[0] : null });

  const readPhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError(''); setReading(true);
    try {
      const text = await readImageText(file);
      setDraft({ ...draft, body: draft.body ? `${draft.body}\n\n${text}` : text, source: 'photo' });
    } catch { setError('Could not read any text in that picture. Try a clearer, well lit photo.'); }
    finally { setReading(false); }
  };

  const save = (event: FormEvent) => {
    event.preventDefault();
    setError('');
    start(async () => {
      try {
        const note = await addTeacherNote({ kind: draft.kind, grade: draft.grade, theme: draft.theme as never, title: draft.title, body: draft.body, noteDate: draft.date, source: draft.source });
        setNotes((n) => [note, ...n]);
        setDraft(emptyDraft());
      } catch (e) { setError(e instanceof Error ? e.message : 'Could not save this note.'); }
    });
  };
  const remove = (id: string) => start(async () => { try { await deleteTeacherNote(id); setNotes((n) => n.filter((x) => x.id !== id)); } catch { setError('Could not delete this note.'); } });

  const shown = useMemo(() => notes.filter((n) => (fKind === 'all' || n.kind === fKind) && (!fGrade || n.grade === fGrade) && (!fTheme || n.theme === fTheme)), [notes, fKind, fGrade, fTheme]);

  return <>
    <section className="panel ti-panel" aria-labelledby="ti-add">
      <div className="panel-title"><div className="panel-icon coral"><ClipboardList size={19} /></div><div><h2 id="ti-add">Add meeting notes or project notes</h2><p>Type them, or take a picture of handwritten or printed notes. The text is read on this device and stored with the date; the picture itself is not kept.</p></div></div>
      <form className="ti-form" onSubmit={save}>
        <label><span className="field-label">Type</span><select className="field-select" value={draft.kind} onChange={(e) => setKind(e.target.value as NoteKind)}>{NOTE_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}</select></label>
        {needsGrade && <label><span className="field-label">Grade</span><select className="field-select" value={draft.grade ?? 1} onChange={(e) => patch({ grade: Number(e.target.value) })}>{GRADES.map((g) => <option key={g} value={g}>Grade {g}</option>)}</select></label>}
        {draft.kind === 'project' && <label><span className="field-label">PYP theme</span><select className="field-select" value={draft.theme ?? PYP_THEMES[0]} onChange={(e) => patch({ theme: e.target.value })}>{PYP_THEMES.map((t) => <option key={t} value={t}>{t}</option>)}</select></label>}
        <label><span className="field-label">Date</span><input className="field-select" type="date" value={draft.date} onChange={(e) => patch({ date: e.target.value })} required /></label>
        <label className="ti-wide"><span className="field-label">Title</span><input className="field-select" value={draft.title} onChange={(e) => patch({ title: e.target.value })} placeholder="e.g. Unit 2 planning" maxLength={160} required /></label>
        <label className="outline-btn ti-photo"><Camera size={16} /> {reading ? 'Reading the picture…' : 'Add notes from a picture'}<input type="file" accept="image/*" capture="environment" onChange={readPhoto} disabled={reading} /></label>
        <label className="ti-wide"><span className="field-label">Notes {draft.source === 'photo' && <small>read from a picture – check and correct</small>}</span><textarea className="field-select" rows={8} value={draft.body} onChange={(e) => patch({ body: e.target.value })} required /></label>
        <button className="primary-btn" type="submit" disabled={pending || reading}><Plus size={16} /> Save note</button>
      </form>
      {error && <p className="form-error" role="alert">{error}</p>}
    </section>

    <section className="panel ti-panel" aria-labelledby="ti-saved">
      <div className="panel-title"><div><h2 id="ti-saved">Saved notes ({shown.length})</h2></div></div>
      <div className="ti-filters">
        <select className="field-select" aria-label="Filter by type" value={fKind} onChange={(e) => setFKind(e.target.value as 'all' | NoteKind)}><option value="all">All types</option>{NOTE_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}</select>
        <select className="field-select" aria-label="Filter by grade" value={fGrade} onChange={(e) => setFGrade(Number(e.target.value))}><option value={0}>All grades</option>{GRADES.map((g) => <option key={g} value={g}>Grade {g}</option>)}</select>
        <select className="field-select" aria-label="Filter by PYP theme" value={fTheme} onChange={(e) => setFTheme(e.target.value)}><option value="">All themes</option>{PYP_THEMES.map((t) => <option key={t} value={t}>{t}</option>)}</select>
      </div>
      {!loaded ? <p className="ti-empty">Loading…</p> : shown.length === 0 ? <p className="ti-empty">No notes yet.</p> : <div className="ti-notes">{shown.map((n) => <article className="ti-note" key={n.id}>
        <header><div><strong>{n.title}</strong><small>{noteTag(n)} · {n.note_date}{n.source === 'photo' ? ' · from picture' : ''}</small></div><button type="button" className="icon-btn" aria-label={`Delete ${n.title}`} onClick={() => remove(n.id)} disabled={pending}><Trash2 size={15} /></button></header>
        <p>{n.body}</p>
      </article>)}</div>}
    </section>
  </>;
}

function TodayStrip() {
  const [lessons, setLessons] = useState<Slot[]>([]);
  useEffect(() => { setLessons(getProgram()[new Date().getDay()] ?? []); }, []);
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const mins = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const next = lessons.find((l) => mins(l.start) > minutes);
  return <section className="ti-today" aria-label="Today">
    <div><small>TODAY</small><strong>{now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</strong></div>
    <div><small>LESSONS</small><strong>{lessons.length || 'None'}</strong></div>
    <div><small>UP NEXT</small><strong>{next ? `${next.cls} · ${next.start}` : lessons.length ? 'Done for today' : '—'}</strong></div>
  </section>;
}

export default function TeacherIssues({ classrooms = [] }: { classrooms?: Array<{ id: string; name: string }> }) {
  const [section, setSection] = useState<Section>('program');
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const tabs: Array<[Section, string, string, string]> = [['program', '🗓️', 'Lesson program', 'Your weekly timetable'], ['units', '📘', 'Unit plans', 'Type or scan pictures'], ['notes', '📝', 'Meeting & project notes', 'Type or scan a photo'], ['students', '🧠', 'Student analysis', 'Academic & behaviour'], ['timeline', '🧭', 'Department timeline', 'What comes next'], ['ideas', '💡', 'PYP projects', 'Suggest a project by theme'], ['pyp', '🌟', 'PYP theme & tools', 'Each class’s theme + your list']];
  return <div className="page-wrap alternate ti-page">
    <p className="eyebrow">FOR YOU, THE TEACHER</p>
    <h1>Teacher <em>Issues</em></h1>
    <p className="subhead">Your lesson program, meeting notes, student analysis and school projects in one place.</p>
    <TodayStrip />
    <div className="hub-tiles" role="tablist">{tabs.map(([id, icon, label, note]) => <button key={id} role="tab" aria-selected={section === id} className={`hub-tile ${section === id ? 'active' : ''}`} onClick={() => setSection(id)}><span className="hub-tile-icon" aria-hidden="true">{icon}</span><strong>{label}</strong><small>{note}</small></button>)}</div>
    {section === 'program' && <LessonProgram />}
    {section === 'units' && <UnitPlans />}
    {section === 'notes' && <MeetingNotes draft={draft} setDraft={setDraft} />}
    {section === 'students' && <StudentAnalysis />}
    {section === 'timeline' && <DepartmentTimeline />}
    {section === 'pyp' && <><PypThemeList classrooms={classrooms} /><PypToolList /></>}
    {section === 'ideas' &&<PypProjects onSave={(d) => { setDraft(d); setSection('notes'); }} />}
  </div>;
}
