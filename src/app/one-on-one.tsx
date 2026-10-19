'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { listAnalysisStudents, type AnalysisStudent } from './student-analysis-actions';
import { addOneOnOneSession, deleteOneOnOneSession, getOneOnOne, setOneOnOneCompleted, setOneOnOneFlag, setOneOnOneFlagMany, updateOneOnOneSession } from './one-on-one-actions';
import { AREAS, DURATIONS, FORMATS, STATUS_RANK, areaLabel, formatLabel, statusOf, type Flag, type Session, type Status } from '@/lib/one-on-one';

type Form = { studentId: string; id: string | null; topic: string; details: string; area: string; format: string; date: string; time: string; duration: number; goal: string };
type Wrap = { id: string; outcome: string; followUp: boolean; followUpDate: string; parentInformed: boolean };

const STATUS_TEXT: Record<Status, string> = { waiting: 'Waiting for a one-on-one', planned: 'One-on-one planned', done: 'All done' };
const fmtDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
const blank = (studentId: string): Form => ({ studentId, id: null, topic: '', details: '', area: 'reading', format: 'face_to_face', date: '', time: '', duration: 15, goal: '' });

/**
 * One-on-one roster. Tick the weak students on the checklist, plan a one-on-one for each (topic, details, how and when),
 * start with the ones still waiting, and tick "Completed" when it has happened.
 */
export default function OneOnOne() {
  const [students, setStudents] = useState<AnalysisStudent[]>([]);
  const [flags, setFlags] = useState<Flag[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [today, setToday] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [ready, setReady] = useState(true);
  const [error, setError] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | Status>('all');
  const [checklistOpen, setChecklistOpen] = useState(true);
  const [form, setForm] = useState<Form | null>(null);
  const [wrap, setWrap] = useState<Wrap | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    Promise.all([listAnalysisStudents(), getOneOnOne()])
      .then(([list, data]) => { setStudents(list); setFlags(data.flags); setSessions(data.sessions); setToday(data.today); setChecklistOpen(data.flags.length === 0); setLoaded(true); })
      .catch(() => { setReady(false); setLoaded(true); });
  }, []);

  const flagOf = useMemo(() => new Map(flags.map((f) => [f.student_id, f.priority])), [flags]);
  const byStudent = useMemo(() => { const m = new Map<string, Session[]>(); for (const s of sessions) m.set(s.student_id, [...(m.get(s.student_id) ?? []), s]); return m; }, [sessions]);
  const classes = useMemo(() => [...new Set(students.map((s) => s.classroom))], [students]);
  const inClass = (s: AnalysisStudent) => !classFilter || s.classroom === classFilter;

  const roster = useMemo(() => {
    const rows = students.filter((s) => inClass(s) && (flagOf.has(s.id) || byStudent.has(s.id))).map((s) => {
      const list = byStudent.get(s.id) ?? [];
      const open = list.filter((x) => !x.completed).map((x) => x.planned_date ?? '9999-12-31').sort()[0] ?? '9999-12-31';
      return { student: s, sessions: list, status: statusOf(list), priority: flagOf.get(s.id) ?? 0, open };
    });
    return rows
      .filter((r) => statusFilter === 'all' || r.status === statusFilter)
      .sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || b.priority - a.priority || a.open.localeCompare(b.open) || a.student.classroom.localeCompare(b.student.classroom) || a.student.name.localeCompare(b.student.name));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students, flagOf, byStudent, classFilter, statusFilter]);

  const counts = useMemo(() => {
    const c = { weak: 0, waiting: 0, planned: 0, done: 0 };
    for (const s of students) { if (!inClass(s)) continue; if (flagOf.has(s.id)) c.weak++; if (flagOf.has(s.id) || byStudent.has(s.id)) c[statusOf(byStudent.get(s.id) ?? [])]++; }
    return c;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students, flagOf, byStudent, classFilter]);

  const fail = (message: string) => setError(message);

  const toggleWeak = (studentId: string, weak: boolean, priority = 1) => {
    const before = flags;
    setFlags((f) => weak ? [...f.filter((x) => x.student_id !== studentId), { student_id: studentId, priority }] : f.filter((x) => x.student_id !== studentId));
    setError('');
    start(async () => { try { await setOneOnOneFlag(studentId, weak, priority); } catch { setFlags(before); fail('Could not save the checklist. Please try again.'); } });
  };
  const toggleMany = (ids: string[], weak: boolean) => {
    const before = flags;
    setFlags((f) => weak ? [...f, ...ids.filter((id) => !f.some((x) => x.student_id === id)).map((id) => ({ student_id: id, priority: 1 }))] : f.filter((x) => !ids.includes(x.student_id)));
    setError('');
    if (ids.length) start(async () => { try { await setOneOnOneFlagMany(ids, weak); } catch { setFlags(before); fail('Could not save the checklist. Please try again.'); } });
  };

  const saveForm = () => {
    if (!form) return;
    setError('');
    start(async () => {
      try {
        const input = { topic: form.topic, details: form.details, area: form.area, format: form.format, plannedDate: form.date || null, plannedTime: form.time || null, duration: form.duration, goal: form.goal };
        if (form.id) { const s = await updateOneOnOneSession(form.id, input); setSessions((l) => l.map((x) => (x.id === s.id ? s : x))); }
        else { const s = await addOneOnOneSession(form.studentId, input); setSessions((l) => [...l, s]); if (!flagOf.has(form.studentId)) setFlags((f) => [...f, { student_id: form.studentId, priority: 1 }]); }
        setForm(null);
      } catch { fail('Could not save this one-on-one. Add a topic and check the date and time.'); }
    });
  };

  const finish = () => {
    if (!wrap) return;
    setError('');
    start(async () => {
      try {
        const s = await setOneOnOneCompleted(wrap.id, { completed: true, outcome: wrap.outcome, followUp: wrap.followUp, followUpDate: wrap.followUp && wrap.followUpDate ? wrap.followUpDate : null, parentInformed: wrap.parentInformed });
        setSessions((l) => l.map((x) => (x.id === s.id ? s : x)));
        setWrap(null);
      } catch { fail('Could not mark this one-on-one as completed. Please try again.'); }
    });
  };
  const reopen = (s: Session) => {
    if (!window.confirm('Mark this one-on-one as not completed again?')) return;
    setError('');
    start(async () => {
      try {
        const next = await setOneOnOneCompleted(s.id, { completed: false, outcome: s.outcome, followUp: s.follow_up, followUpDate: s.follow_up_date, parentInformed: s.parent_informed });
        setSessions((l) => l.map((x) => (x.id === next.id ? next : x)));
      } catch { fail('Could not change this one-on-one. Please try again.'); }
    });
  };
  const remove = (s: Session) => {
    if (!window.confirm(`Delete the one-on-one “${s.topic}”?`)) return;
    start(async () => { try { await deleteOneOnOneSession(s.id); setSessions((l) => l.filter((x) => x.id !== s.id)); } catch { fail('Could not delete this one-on-one.'); } });
  };
  const edit = (s: Session) => setForm({ studentId: s.student_id, id: s.id, topic: s.topic, details: s.details, area: s.area, format: s.format, date: s.planned_date ?? '', time: s.planned_time ?? '', duration: s.duration_min, goal: s.goal });

  return (
    <section className="panel ti-panel oo" aria-labelledby="oo-title">
      <div className="panel-title"><div className="panel-icon purple">🤝</div><div><h2 id="oo-title">One-on-one roster</h2><p>Tick the students who need a one-on-one with you, starting with the weak ones. Plan each one-on-one with a topic in detail, then tick <strong>Completed</strong> when it has happened.</p></div></div>

      {!ready && <p className="book-error" role="alert">The one-on-one roster is not ready yet. It needs one more database update.</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {!loaded ? <p className="readers-empty">Loading…</p> : (
        <>
          <div className="oo-bar">
            <label><span className="field-label">Class</span><select className="field-select" value={classFilter} onChange={(e) => setClassFilter(e.target.value)}><option value="">All classes</option>{classes.map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
            <div className="oo-counts" role="group" aria-label="Show students by status">
              {([['all', `Roster · ${counts.waiting + counts.planned + counts.done}`], ['waiting', `Waiting · ${counts.waiting}`], ['planned', `Planned · ${counts.planned}`], ['done', `Done · ${counts.done}`]] as const).map(([id, label]) => <button key={id} type="button" className={`oo-chip${statusFilter === id ? ' on' : ''}`} aria-pressed={statusFilter === id} onClick={() => setStatusFilter(id)}>{label}</button>)}
            </div>
          </div>

          <details className="oo-checklist" open={checklistOpen} onToggle={(e) => setChecklistOpen((e.target as HTMLDetailsElement).open)}>
            <summary><strong>Step 1 · Checklist: who needs a one-on-one?</strong> <span>{counts.weak} ticked</span></summary>
            <p className="oo-hint">Tick the students you think are weak and need time with you. Use ⚑ to mark the most urgent ones. Only ticked students appear in the roster below.</p>
            {(classFilter ? [classFilter] : classes).map((c) => {
              const list = students.filter((s) => s.classroom === c);
              return (
                <div className="oo-class" key={c}>
                  <div className="oo-class-head"><h3>{c}</h3><span><button type="button" onClick={() => toggleMany(list.map((s) => s.id), true)}>Tick all</button><button type="button" onClick={() => toggleMany(list.map((s) => s.id), false)}>Clear</button></span></div>
                  <ul className="oo-checks">
                    {list.map((s) => {
                      const on = flagOf.has(s.id), high = flagOf.get(s.id) === 2;
                      return (
                        <li key={s.id} className={on ? 'on' : ''}>
                          <label><input type="checkbox" checked={on} onChange={(e) => toggleWeak(s.id, e.target.checked, 1)} /> <span>{s.name}</span></label>
                          {on && <button type="button" className={`oo-flag${high ? ' on' : ''}`} aria-pressed={high} title="Most urgent" onClick={() => toggleWeak(s.id, true, high ? 1 : 2)}>⚑ {high ? 'Urgent' : 'Mark urgent'}</button>}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </details>

          <h3 className="oo-step">Step 2 · The roster <small>students still waiting come first</small></h3>
          {roster.length === 0 ? <p className="readers-empty">{flags.length === 0 ? 'Nobody is ticked yet. Open the checklist above and tick the students who need a one-on-one.' : 'No students match this filter.'}</p> : (
            <ol className="oo-roster">
              {roster.map(({ student, sessions: list, status, priority }, index) => {
                const startHere = index === 0 && status === 'waiting' && statusFilter === 'all';
                return (
                  <li key={student.id} className={`oo-card status-${status}`}>
                    <header>
                      <div>
                        <strong>{student.name}</strong> <small>{student.classroom}</small>
                        {priority === 2 && <span className="oo-badge urgent">⚑ Urgent</span>}
                        {startHere && <span className="oo-badge start">Start here</span>}
                      </div>
                      <span className={`oo-badge ${status}`}>{status === 'done' ? '✓ ' : ''}{STATUS_TEXT[status]}</span>
                    </header>

                    {list.length > 0 && (
                      <ul className="oo-sessions">
                        {list.map((s) => {
                          const overdue = !s.completed && s.planned_date && today && s.planned_date < today;
                          const followDue = s.completed && s.follow_up && s.follow_up_date && today && s.follow_up_date <= today;
                          return (
                            <li key={s.id} className={s.completed ? 'done' : ''}>
                              <label className="oo-complete"><input type="checkbox" checked={s.completed} onChange={(e) => { if (e.target.checked) setWrap({ id: s.id, outcome: s.outcome, followUp: s.follow_up, followUpDate: s.follow_up_date ?? '', parentInformed: s.parent_informed }); else reopen(s); }} /> <span>{s.completed ? 'Completed' : 'Completed?'}</span></label>
                              <div className="oo-session-body">
                                <strong>{s.topic}</strong>
                                <div className="oo-tags">
                                  <span>{areaLabel(s.area)}</span><span>{formatLabel(s.format)}</span><span>{s.duration_min} min</span>
                                  {s.planned_date && <span className={overdue ? 'warn' : ''}>{overdue ? 'Overdue · ' : ''}{fmtDate(s.planned_date)}{s.planned_time ? ` · ${s.planned_time}` : ''}</span>}
                                  {s.completed && s.parent_informed && <span>Parent told</span>}
                                  {s.follow_up && <span className={followDue ? 'warn' : ''}>Follow-up{s.follow_up_date ? ` ${fmtDate(s.follow_up_date)}` : ''}</span>}
                                </div>
                                {s.details && <p className="oo-details">{s.details}</p>}
                                {s.goal && <p className="oo-goal"><b>Goal:</b> {s.goal}</p>}
                                {s.completed && s.outcome && <p className="oo-outcome"><b>What came of it:</b> {s.outcome}</p>}
                              </div>
                              <div className="oo-tools"><button type="button" className="outline-btn" onClick={() => (s.completed ? setWrap({ id: s.id, outcome: s.outcome, followUp: s.follow_up, followUpDate: s.follow_up_date ?? '', parentInformed: s.parent_informed }) : edit(s))}>{s.completed ? 'Edit wrap-up' : 'Edit'}</button><button type="button" className="outline-btn" onClick={() => remove(s)} disabled={pending} aria-label={`Delete ${s.topic}`}>Delete</button></div>

                              {wrap?.id === s.id && (
                                <div className="oo-form oo-wrap">
                                  <h4>Wrap-up · {s.topic}</h4>
                                  <label><span className="field-label">What came of it? <small>optional</small></span><textarea className="field-select" rows={3} value={wrap.outcome} onChange={(e) => setWrap({ ...wrap, outcome: e.target.value })} placeholder="What was agreed, what went well, what to practise…" /></label>
                                  <label className="oo-check"><input type="checkbox" checked={wrap.followUp} onChange={(e) => setWrap({ ...wrap, followUp: e.target.checked })} /> Needs a follow-up one-on-one</label>
                                  {wrap.followUp && <label><span className="field-label">Follow-up date <small>optional</small></span><input className="field-select" type="date" value={wrap.followUpDate} onChange={(e) => setWrap({ ...wrap, followUpDate: e.target.value })} /></label>}
                                  <label className="oo-check"><input type="checkbox" checked={wrap.parentInformed} onChange={(e) => setWrap({ ...wrap, parentInformed: e.target.checked })} /> Parent has been told</label>
                                  <div className="ti-actions"><button type="button" className="primary-btn" onClick={finish} disabled={pending}>Save as completed</button><button type="button" className="outline-btn" onClick={() => setWrap(null)}>Cancel</button></div>
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}

                    {form?.studentId === student.id ? (
                      <div className="oo-form">
                        <h4>{form.id ? 'Edit one-on-one' : `Plan a one-on-one with ${student.name}`}</h4>
                        <label><span className="field-label">Topic to discuss</span><input className="field-select" value={form.topic} maxLength={200} onChange={(e) => setForm({ ...form, topic: e.target.value })} placeholder="e.g. Reading aloud with confidence" /></label>
                        <label><span className="field-label">The topic in detail</span><textarea className="field-select" rows={4} value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} placeholder="What exactly do you want to talk about? Examples, questions to ask, things you noticed…" /></label>
                        <div className="oo-grid">
                          <label><span className="field-label">Focus area</span><select className="field-select" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })}>{AREAS.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}</select></label>
                          <label><span className="field-label">How</span><select className="field-select" value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value })}>{FORMATS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}</select></label>
                          <label><span className="field-label">Date <small>optional</small></span><input className="field-select" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
                          <label><span className="field-label">Time <small>optional</small></span><input className="field-select" type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></label>
                          <label><span className="field-label">Length</span><select className="field-select" value={form.duration} onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })}>{DURATIONS.map((d) => <option key={d} value={d}>{d} minutes</option>)}</select></label>
                        </div>
                        <label><span className="field-label">Goal for this one-on-one <small>optional</small></span><input className="field-select" value={form.goal} maxLength={500} onChange={(e) => setForm({ ...form, goal: e.target.value })} placeholder="e.g. Read one page aloud without stopping" /></label>
                        <div className="ti-actions"><button type="button" className="primary-btn" onClick={saveForm} disabled={pending || !form.topic.trim()}>{form.id ? 'Save changes' : 'Save one-on-one'}</button><button type="button" className="outline-btn" onClick={() => setForm(null)}>Cancel</button></div>
                      </div>
                    ) : (
                      <div className="ti-actions"><button type="button" className="primary-btn" onClick={() => { setWrap(null); setForm(blank(student.id)); }}>+ Plan a one-on-one</button></div>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </>
      )}
    </section>
  );
}
