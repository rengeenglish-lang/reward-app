'use client';

import { ChangeEvent, useEffect, useMemo, useState, useTransition } from 'react';
import { Camera, CalendarClock, Plus, Trash2, X } from 'lucide-react';
import { addActivities, deleteActivity, listActivities, updateActivity } from './department-timeline-actions';
import { readImageText } from './read-image-text';
import { daysUntil, parseActivities, upcoming, type Activity, type ParsedActivity } from '@/lib/department-timeline';

const fmt = (date: string, long = false) => new Date(date + 'T00:00:00').toLocaleDateString(undefined, long ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' } : { day: 'numeric', month: 'short' });
const away = (days: number) => (days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : days > 1 ? `In ${days} days` : `${-days} days ago`);

export default function DepartmentTimeline() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [today, setToday] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [reading, setReading] = useState(false);
  const [review, setReview] = useState<ParsedActivity[] | null>(null);
  const [popup, setPopup] = useState<Activity | null>(null);
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<{ date: string; title: string } | null>(null);

  useEffect(() => { listActivities().then((r) => { setActivities(r.activities); setToday(r.today); setLoaded(true); }).catch(() => { setError('Could not load the timeline.'); setLoaded(true); }); }, []);
  useEffect(() => {
    if (!popup) return;
    const close = (e: KeyboardEvent) => { if (e.key === 'Escape') setPopup(null); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [popup]);

  useEffect(() => { setEditing(null); }, [popup?.id]);
  const saveEdit = () => start(async () => {
    if (!popup || !editing) return;
    try { const a = await updateActivity(popup.id, { date: editing.date, title: editing.title }); setActivities((l) => l.map((x) => (x.id === a.id ? a : x)).sort((p, q) => p.activity_date.localeCompare(q.activity_date))); setPopup(a); setEditing(null); setError(''); }
    catch { setError('Could not save this change. Check the date and title.'); }
  });

  const ahead = useMemo(() => (today ? upcoming(activities, today) : []), [activities, today]);
  const past = useMemo(() => (today ? activities.filter((a) => a.activity_date < today).reverse() : []), [activities, today]);
  const next = ahead[0] ?? null;
  const following = (a: Activity) => { const i = activities.indexOf(a); return i >= 0 ? activities[i + 1] ?? null : null; };

  const photo = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError(''); setReading(true);
    try {
      const rows = parseActivities(await readImageText(file), today || new Date().toISOString().slice(0, 10));
      if (!rows.length) throw new Error('none');
      setReview(rows);
    } catch { setError('Could not find dated activities in that picture. Try a clearer photo, or add them by hand.'); }
    finally { setReading(false); }
  };

  const saveReview = () => start(async () => {
    const rows = (review ?? []).filter((r) => r.date && r.title.trim());
    if (!rows.length) { setError('Add a date and a title to at least one activity.'); return; }
    try { const added = await addActivities(rows, 'photo'); setActivities((l) => [...l, ...added].sort((a, b) => a.activity_date.localeCompare(b.activity_date))); setReview(null); setError(''); }
    catch { setError('Could not save these activities.'); }
  });
  const remove = (id: string) => start(async () => { try { await deleteActivity(id); setActivities((l) => l.filter((a) => a.id !== id)); setPopup(null); } catch { setError('Could not delete this activity.'); } });
  const editRow = (i: number, patch: Partial<ParsedActivity>) => setReview((r) => r && r.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const dot = (a: Activity, isNext: boolean, isPast: boolean) => <li key={a.id} className={`tl-item${isNext ? ' next' : ''}${isPast ? ' past' : ''}`}>
    <button type="button" onClick={() => setPopup(a)} aria-label={`${a.title}, ${fmt(a.activity_date)}`}><i aria-hidden="true" /><b>{fmt(a.activity_date)}</b><span>{a.title}</span>{isNext && <em>Next</em>}</button>
  </li>;

  return <section className="panel ti-panel" aria-labelledby="ti-timeline">
    <div className="panel-title"><div className="panel-icon purple"><CalendarClock size={19} /></div><div><h2 id="ti-timeline">Department activities timeline</h2><p>Upload a picture of the department plan. Dated activities are read from it into a timeline that shows what comes next. Click any activity for details and what follows it.</p></div></div>
    <div className="ti-actions">
      <label className="outline-btn ti-photo"><Camera size={15} /> {reading ? 'Reading the picture…' : 'Add from a picture'}<input type="file" accept="image/*" capture="environment" onChange={photo} disabled={reading} /></label>
      <button type="button" className="outline-btn" onClick={() => setReview([{ date: today, title: '' }])}><Plus size={15} /> Add by hand</button>
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}

    {review && <div className="tl-review">
      <h3>Check what was read ({review.length})</h3>
      <p className="sa-hint">Fix any date or title, remove wrong lines, then save. Dates without a year use the nearest upcoming one.</p>
      {review.map((r, i) => <div className="tl-row" key={i}>
        <input className="field-select" type="date" aria-label="Date" value={r.date} onChange={(e) => editRow(i, { date: e.target.value })} />
        <input className="field-select" aria-label="Activity" value={r.title} onChange={(e) => editRow(i, { title: e.target.value })} maxLength={200} placeholder="Activity" />
        <button type="button" className="icon-btn" aria-label="Remove line" onClick={() => setReview((l) => l && l.filter((_, j) => j !== i))}><Trash2 size={15} /></button>
      </div>)}
      <div className="ti-actions"><button type="button" className="outline-btn" onClick={() => setReview((l) => [...(l ?? []), { date: today, title: '' }])}><Plus size={14} /> Add line</button><button type="button" className="primary-btn" onClick={saveReview} disabled={pending}>Save to timeline</button><button type="button" className="outline-btn" onClick={() => setReview(null)}>Cancel</button></div>
    </div>}

    {!loaded ? <p className="ti-empty">Loading…</p> : activities.length === 0 && !review ? <p className="ti-empty">No activities yet. Add a picture of your department plan to start the timeline.</p> : <>
      {next && <button type="button" className="tl-hero" onClick={() => setPopup(next)}><small>NEXT ACTIVITY · {away(daysUntil(next.activity_date, today)).toUpperCase()}</small><strong>{next.title}</strong><span>{fmt(next.activity_date, true)}</span></button>}
      {!next && activities.length > 0 && <p className="ti-empty">No upcoming activities. Add the next plan to continue the timeline.</p>}
      <ol className="tl" aria-label="Department timeline">
        {past.length > 0 && <li className="tl-gap">Earlier ({past.length})</li>}
        {past.slice().reverse().slice(-3).map((a) => dot(a, false, true))}
        {ahead.map((a, i) => dot(a, i === 0, false))}
      </ol>
    </>}

    {popup && <div className="tl-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setPopup(null); }}>
      <div className="tl-pop" role="dialog" aria-modal="true" aria-labelledby="tl-pop-title">
        <button type="button" className="icon-btn tl-close" aria-label="Close" onClick={() => setPopup(null)}><X size={18} /></button>
        <small>{popup.activity_date >= today ? away(daysUntil(popup.activity_date, today)).toUpperCase() : 'PAST ACTIVITY'}</small>
        {editing ? <div className="tl-row tl-edit"><input className="field-select" type="date" aria-label="Date" value={editing.date} onChange={(e) => setEditing({ ...editing, date: e.target.value })} /><input className="field-select" aria-label="Activity" value={editing.title} maxLength={200} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></div> : <><h3 id="tl-pop-title">{popup.title}</h3>
        <p>{fmt(popup.activity_date, true)}</p></>}
        {(() => { const n = following(popup); return n ? <div className="tl-pop-next"><small>NEXT NEAR ACTIVITY</small><strong>{n.title}</strong><span>{fmt(n.activity_date, true)} · {away(daysUntil(n.activity_date, today))}</span></div> : <div className="tl-pop-next"><small>NEXT NEAR ACTIVITY</small><span>Nothing planned after this one.</span></div>; })()}
        {editing ? <div className="ti-actions"><button type="button" className="primary-btn" onClick={saveEdit} disabled={pending || !editing.date || !editing.title.trim()}>Save changes</button><button type="button" className="outline-btn" onClick={() => setEditing(null)}>Cancel</button></div> : <div className="ti-actions"><button type="button" className="outline-btn" onClick={() => setEditing({ date: popup.activity_date, title: popup.title })}>Edit activity</button><button type="button" className="outline-btn" onClick={() => remove(popup.id)} disabled={pending}><Trash2 size={14} /> Delete activity</button></div>}
      </div>
    </div>}
  </section>;
}
