'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useState, useTransition } from 'react';
import { BookOpenCheck, Camera, Plus, Trash2 } from 'lucide-react';
import { addUnitPlan, deleteUnitPlan, listUnitPlans } from './unit-plans-actions';
import { readImageText } from './read-image-text';
import { GRADES, PYP_THEMES, type UnitPlan } from '@/lib/teacher-issues';

type Draft = { title: string; grade: number | null; theme: string | null; start: string; end: string; body: string; source: 'typed' | 'photo' };
const empty = (): Draft => ({ title: '', grade: null, theme: null, start: '', end: '', body: '', source: 'typed' });
const fmt = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const range = (p: UnitPlan) => (p.start_date && p.end_date ? `${fmt(p.start_date)} – ${fmt(p.end_date)}` : p.start_date ? `From ${fmt(p.start_date)}` : p.end_date ? `Until ${fmt(p.end_date)}` : '');
const isCurrent = (p: UnitPlan, today: string) => !!today && (!!p.start_date || !!p.end_date) && (!p.start_date || p.start_date <= today) && (!p.end_date || p.end_date >= today);

export default function UnitPlans() {
  const [plans, setPlans] = useState<UnitPlan[]>([]);
  const [today, setToday] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [draft, setDraft] = useState<Draft>(empty);
  const [error, setError] = useState('');
  const [reading, setReading] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [fGrade, setFGrade] = useState(0);
  const [fTheme, setFTheme] = useState('');
  const [pending, start] = useTransition();

  useEffect(() => { listUnitPlans().then((r) => { setPlans(r.plans); setToday(r.today); setLoaded(true); }).catch(() => { setError('Could not load unit plans.'); setLoaded(true); }); }, []);
  const patch = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));

  const readPictures = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = [...(event.target.files ?? [])];
    event.target.value = '';
    if (!files.length) return;
    setError('');
    const pages: string[] = [];
    try {
      for (const [i, file] of files.entries()) { setReading(`Reading picture ${i + 1} of ${files.length}…`); pages.push(await readImageText(file)); }
      setDraft((d) => ({ ...d, body: [d.body, ...pages].filter(Boolean).join('\n\n'), source: 'photo' }));
    } catch { setError(pages.length ? 'One of the pictures could not be read. The ones before it were added.' : 'Could not read any text in that picture. Try a clearer, well lit photo.'); if (pages.length) setDraft((d) => ({ ...d, body: [d.body, ...pages].filter(Boolean).join('\n\n'), source: 'photo' })); }
    finally { setReading(''); }
  };

  const save = (event: FormEvent) => {
    event.preventDefault();
    setError('');
    start(async () => {
      try {
        const plan = await addUnitPlan({ title: draft.title, grade: draft.grade, theme: draft.theme as never, startDate: draft.start || null, endDate: draft.end || null, body: draft.body, source: draft.source });
        setPlans((l) => [plan, ...l]); setDraft(empty());
      } catch (e) { setError(e instanceof Error && /end date/i.test(e.message) ? 'The end date is before the start date.' : 'Could not save this unit plan. Check the title and text.'); }
    });
  };
  const remove = (id: string) => start(async () => { try { await deleteUnitPlan(id); setPlans((l) => l.filter((p) => p.id !== id)); } catch { setError('Could not delete this plan.'); } });
  const shown = useMemo(() => plans.filter((p) => (!fGrade || p.grade === fGrade) && (!fTheme || p.theme === fTheme)), [plans, fGrade, fTheme]);

  return <>
    <section className="panel ti-panel" aria-labelledby="ti-unit-add">
      <div className="panel-title"><div className="panel-icon coral"><BookOpenCheck size={19} /></div><div><h2 id="ti-unit-add">Add a unit plan</h2><p>Type it, or take pictures of the plan, one or several pages. The text is read on this device for you to check; the pictures are not kept.</p></div></div>
      <form className="ti-form" onSubmit={save}>
        <label className="ti-wide"><span className="field-label">Unit title</span><input className="field-select" value={draft.title} onChange={(e) => patch({ title: e.target.value })} placeholder="e.g. Unit 2 · How the world works" maxLength={160} required /></label>
        <label><span className="field-label">Grade <small>optional</small></span><select className="field-select" value={draft.grade ?? ''} onChange={(e) => patch({ grade: e.target.value ? Number(e.target.value) : null })}><option value="">Any</option>{GRADES.map((g) => <option key={g} value={g}>Grade {g}</option>)}</select></label>
        <label><span className="field-label">PYP theme <small>optional</small></span><select className="field-select" value={draft.theme ?? ''} onChange={(e) => patch({ theme: e.target.value || null })}><option value="">None</option>{PYP_THEMES.map((t) => <option key={t} value={t}>{t}</option>)}</select></label>
        <label><span className="field-label">Starts <small>optional</small></span><input className="field-select" type="date" value={draft.start} onChange={(e) => patch({ start: e.target.value })} /></label>
        <label><span className="field-label">Ends <small>optional</small></span><input className="field-select" type="date" value={draft.end} onChange={(e) => patch({ end: e.target.value })} /></label>
        <label className="outline-btn ti-photo"><Camera size={16} /> {reading || 'Add plan from pictures'}<input type="file" accept="image/*" multiple capture="environment" onChange={readPictures} disabled={!!reading} /></label>
        <label className="ti-wide"><span className="field-label">Plan {draft.source === 'photo' && <small>read from pictures – check and correct</small>}</span><textarea className="field-select" rows={10} value={draft.body} onChange={(e) => patch({ body: e.target.value })} required /></label>
        <button className="primary-btn" type="submit" disabled={pending || !!reading}><Plus size={16} /> Save unit plan</button>
      </form>
      {error && <p className="form-error" role="alert">{error}</p>}
    </section>

    <section className="panel ti-panel" aria-labelledby="ti-unit-list">
      <div className="panel-title"><div><h2 id="ti-unit-list">Unit plans ({shown.length})</h2></div></div>
      <div className="ti-filters">
        <select className="field-select" aria-label="Filter by grade" value={fGrade} onChange={(e) => setFGrade(Number(e.target.value))}><option value={0}>All grades</option>{GRADES.map((g) => <option key={g} value={g}>Grade {g}</option>)}</select>
        <select className="field-select" aria-label="Filter by PYP theme" value={fTheme} onChange={(e) => setFTheme(e.target.value)}><option value="">All themes</option>{PYP_THEMES.map((t) => <option key={t} value={t}>{t}</option>)}</select>
      </div>
      {!loaded ? <p className="ti-empty">Loading…</p> : shown.length === 0 ? <p className="ti-empty">No unit plans yet.</p> : <div className="ti-notes">{shown.map((p) => <article className={`ti-note up-plan${isCurrent(p, today) ? ' current' : ''}`} key={p.id}>
        <header><div><strong>{p.title} {isCurrent(p, today) && <em className="up-badge">Current unit</em>}</strong><small>{[p.grade ? `Grade ${p.grade}` : '', p.theme || '', range(p), p.source === 'photo' ? 'from pictures' : ''].filter(Boolean).join(' · ') || 'No grade or dates'}</small></div><div className="up-tools"><button type="button" className="outline-btn" onClick={() => setOpen(open === p.id ? null : p.id)} aria-expanded={open === p.id}>{open === p.id ? 'Hide' : 'Read'}</button><button type="button" className="icon-btn" aria-label={`Delete ${p.title}`} onClick={() => remove(p.id)} disabled={pending}><Trash2 size={15} /></button></div></header>
        <p className={open === p.id ? '' : 'up-clamp'}>{p.body}</p>
      </article>)}</div>}
    </section>
  </>;
}
