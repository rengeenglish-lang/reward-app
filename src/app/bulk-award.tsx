'use client';

import { useMemo, useState } from 'react';
import { X } from 'lucide-react';

export type BulkStudent = { id: string; name: string; avatar: string; groupId: string };
export type BulkGroup = { id: string; name: string };

/**
 * Give the same points to the whole class, a group, or any students you tick, all at once.
 * Each student still gets their own award, so one tap on Undo takes the whole batch back.
 */
export default function BulkAward({ classroom, students, groups, presentIds, criteria, icons, busy, onAward, onClose }: {
  classroom: string; students: BulkStudent[]; groups: BulkGroup[]; presentIds?: string[];
  criteria: string[]; icons: string[]; busy: boolean;
  onAward: (ids: string[], criterionIndex: number, amount: number) => Promise<boolean>; onClose: () => void;
}) {
  const [mode, setMode] = useState<'class' | 'pick'>('class');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [onlyHere, setOnlyHere] = useState(Boolean(presentIds));
  const [criterion, setCriterion] = useState(1);
  const [amount, setAmount] = useState('1');

  const here = useMemo(() => (presentIds && onlyHere ? students.filter((s) => presentIds.includes(s.id)) : students), [students, presentIds, onlyHere]);
  const targets = mode === 'class' ? here : here.filter((s) => picked.has(s.id));
  const points = Math.max(1, Math.min(1000, Number.parseInt(amount, 10) || 1));
  const classGroups = groups.filter((g) => students.some((s) => s.groupId === g.id));

  const toggle = (id: string) => setPicked((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const pickGroup = (groupId: string) => setPicked((current) => { const next = new Set(current); const ids = here.filter((s) => s.groupId === groupId).map((s) => s.id); const all = ids.every((id) => next.has(id)); ids.forEach((id) => (all ? next.delete(id) : next.add(id))); return next; });

  const submit = async () => { if (!targets.length || busy) return; if (await onAward(targets.map((s) => s.id), criterion, points)) onClose(); };

  return (
    <div className="dojo-pop-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="dojo-pop bulk-award" role="dialog" aria-modal="true" aria-label="Award points to a group or the whole class">
        <button type="button" className="dojo-pop-close" aria-label="Close" onClick={onClose}><X size={20} /></button>
        <span className="bulk-emoji" aria-hidden="true">🏅</span>
        <h2>Award many at once</h2>
        <p>{classroom}: give everyone you choose the same points in one tap.</p>

        <div className="award-mode-switch" role="group" aria-label="Who gets the points">
          <button type="button" className={mode === 'class' ? 'selected' : ''} aria-pressed={mode === 'class'} onClick={() => setMode('class')}>Whole class ({here.length})</button>
          <button type="button" className={mode === 'pick' ? 'selected' : ''} aria-pressed={mode === 'pick'} onClick={() => setMode('pick')}>A group or chosen students</button>
        </div>
        {presentIds && <label className="bulk-here"><input type="checkbox" checked={onlyHere} onChange={(event) => setOnlyHere(event.target.checked)} /> <span>Only students who are here ({presentIds.length} of {students.length})</span></label>}

        {mode === 'pick' && (
          <div className="bulk-pick">
            <div className="bulk-pick-tools">
              {classGroups.length > 1 && classGroups.map((g) => <button key={g.id} type="button" onClick={() => pickGroup(g.id)}>{g.name}</button>)}
              <button type="button" onClick={() => setPicked(new Set(here.map((s) => s.id)))}>Everyone</button>
              <button type="button" onClick={() => setPicked(new Set())}>Nobody</button>
            </div>
            <ul className="bulk-students">
              {here.map((s) => <li key={s.id}><label className={picked.has(s.id) ? 'on' : ''}><input type="checkbox" checked={picked.has(s.id)} onChange={() => toggle(s.id)} /> <span aria-hidden="true">{s.avatar}</span> <b>{s.name}</b></label></li>)}
            </ul>
          </div>
        )}

        <h3 className="bulk-step">Which goal?</h3>
        <div className="dojo-criteria">
          {criteria.map((c, i) => (
            <button key={c} type="button" className={`dojo-criterion${criterion === i ? ' on' : ''}`} aria-pressed={criterion === i} onClick={() => setCriterion(i)}>
              <span className="dojo-crit-icon" aria-hidden="true">{icons[i]}</span><b>{c}</b>
            </button>
          ))}
        </div>

        <h3 className="bulk-step">How many points each?</h3>
        <div className="bulk-amount">
          {[1, 2, 5, 10].map((n) => <button key={n} type="button" className={points === n ? 'on' : ''} onClick={() => setAmount(String(n))}>+{n}</button>)}
          <input type="number" min={1} max={1000} value={amount} aria-label="Points for each student" onChange={(event) => setAmount(event.target.value)} />
        </div>

        <div className="dojo-pop-actions">
          <button type="button" className="outline-btn" onClick={onClose}>Cancel</button>
          <button type="button" className="primary-btn" onClick={submit} disabled={busy || targets.length === 0}>{busy ? 'Awarding…' : targets.length === 0 ? 'Choose students first' : `Give +${points} to ${targets.length} ${targets.length === 1 ? 'student' : 'students'}`}</button>
        </div>
      </section>
    </div>
  );
}
