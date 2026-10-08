'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useDrag } from './use-drag';
import type { Done, Pair, Q } from './types';

type P<T extends Q['type']> = { q: Extract<Q, { type: T }>; onDone: (d: Done) => void };

export function shuffle<T>(list: T[]): T[] {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.,!?;:]+$/, '');

type Seg = { t: 'text'; v: string } | { t: 'blank'; answers: string[]; idx: number };

/** Text with *answer* or *answer/alternative* markup, as in H5P. */
function parseMarkup(text: string): Seg[] {
  const out: Seg[] = [];
  const re = /\*([^*]+)\*/g;
  let last = 0;
  let idx = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ t: 'text', v: text.slice(last, m.index) });
    out.push({ t: 'blank', answers: m[1].split('/').map((s) => s.trim()).filter(Boolean), idx: idx++ });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ t: 'text', v: text.slice(last) });
  return out;
}
const blanksOf = (segs: Seg[]) => segs.filter((s): s is Extract<Seg, { t: 'blank' }> => s.t === 'blank');
const tapOnKeyboard = (fn: () => void) => (e: React.MouseEvent) => { if (e.detail === 0) fn(); };

/* ---------- multiple choice, rapid single choice, true/false, personality ---------- */

export function ChoiceView({ q, onDone }: { q: { options: string[]; answer: number }; onDone: (d: Done) => void }) {
  const [picked, setPicked] = useState<number | null>(null);
  const pick = (k: number) => {
    if (picked !== null) return;
    setPicked(k);
    const ok = k === q.answer;
    onDone({ ok, note: ok ? undefined : `Right answer: ${q.options[q.answer]}` });
  };
  return (
    <div className="sq-opts">
      {q.options.map((o, k) => {
        const cls = picked === null ? '' : k === q.answer ? ' sq-ok' : k === picked ? ' sq-no' : '';
        return (
          <button key={k} type="button" className={`sq-opt${cls}`} disabled={picked !== null} onClick={() => pick(k)}>
            <span className="sq-letter">{'ABCD'[k]}</span><span>{o}</span>
          </button>
        );
      })}
    </div>
  );
}

export function TrueFalseView({ q, onDone }: P<'truefalse'>) {
  const [picked, setPicked] = useState<boolean | null>(null);
  const pick = (v: boolean) => {
    if (picked !== null) return;
    setPicked(v);
    const ok = v === q.answer;
    onDone({ ok, note: ok ? undefined : `The statement is ${q.answer ? 'true' : 'false'}.` });
  };
  return (
    <div className="sq-tf">
      {[true, false].map((v) => {
        const cls = picked === null ? '' : v === q.answer ? ' sq-ok' : v === picked ? ' sq-no' : '';
        return <button key={String(v)} type="button" className={`sq-opt sq-tfbtn${cls}`} disabled={picked !== null} onClick={() => pick(v)}>{v ? 'True' : 'False'}</button>;
      })}
    </div>
  );
}

export function PersonalityView({ q, onDone }: P<'personality'>) {
  const [picked, setPicked] = useState<number | null>(null);
  return (
    <div className="sq-opts">
      {q.options.map((o, k) => (
        <button key={k} type="button" className={`sq-opt${picked === k ? ' sq-ok' : ''}`} disabled={picked !== null} onClick={() => { setPicked(k); onDone({ ok: true, pick: o.outcome }); }}>
          <span className="sq-letter">{'ABCD'[k]}</span><span>{o.text}</span>
        </button>
      ))}
    </div>
  );
}

/* ---------- fill in the blanks (typed) ---------- */

export function BlanksView({ q, onDone }: P<'blanks'>) {
  const segs = useMemo(() => parseMarkup(q.text), [q.text]);
  const blanks = blanksOf(segs);
  const [vals, setVals] = useState<string[]>(() => Array(blanks.length).fill(''));
  const [res, setRes] = useState<boolean[] | null>(null);
  const check = () => {
    const r = blanks.map((b) => b.answers.some((a) => norm(a) === norm(vals[b.idx])));
    setRes(r);
    const ok = r.every(Boolean);
    onDone({ ok, note: ok ? undefined : `Answers: ${blanks.map((b) => b.answers.join(' or ')).join(', ')}` });
  };
  return (
    <div>
      <div className="sq-flow">
        {segs.map((s, k) => s.t === 'text'
          ? <span key={k}>{s.v}</span>
          : <input key={k} className={`sq-blank${res ? (res[s.idx] ? ' sq-ok' : ' sq-no') : ''}`} aria-label={`Blank ${s.idx + 1}`} value={vals[s.idx]} disabled={!!res}
              style={{ width: `${Math.max(4, Math.max(...s.answers.map((a) => a.length)) + 2)}ch` }} autoCapitalize="off" autoCorrect="off" spellCheck={false}
              onChange={(e) => setVals(vals.map((v, i) => (i === s.idx ? e.target.value : v)))} />)}
      </div>
      {!res && <div className="sq-foot"><button className="sq-btn" disabled={vals.some((v) => !v.trim())} onClick={check}>Check</button></div>}
    </div>
  );
}

/* ---------- drag the words ---------- */

export function DragWordsView({ q, onDone }: P<'dragwords'>) {
  const segs = useMemo(() => parseMarkup(q.text), [q.text]);
  const blanks = blanksOf(segs);
  const chips = useMemo(() => shuffle([...blanks.map((b) => b.answers[0]), ...q.distractors].map((t, id) => ({ id, t }))), [q]); // eslint-disable-line react-hooks/exhaustive-deps
  const [slots, setSlots] = useState<(number | null)[]>(() => Array(blanks.length).fill(null));
  const [sel, setSel] = useState<number | null>(null);
  const [res, setRes] = useState<boolean[] | null>(null);
  const textOf = (id: number | null) => chips.find((c) => c.id === id)?.t ?? '';

  const place = (id: number, slot: number) => setSlots((s) => { const n = s.map((x) => (x === id ? null : x)); n[slot] = id; return n; });
  const remove = (id: number) => setSlots((s) => s.map((x) => (x === id ? null : x)));
  const tap = (id: number) => { if (slots.includes(id)) remove(id); else setSel(sel === id ? null : id); };

  const { hover, handlers } = useDrag({
    enabled: !res,
    onTap: (id) => tap(Number(id)),
    onDrop: (id, drop) => { const n = Number(id); if (drop?.startsWith('slot-')) { place(n, Number(drop.slice(5))); setSel(null); } else remove(n); },
  });

  const check = () => {
    const r = blanks.map((b) => b.answers.some((a) => norm(a) === norm(textOf(slots[b.idx]))));
    setRes(r);
    const ok = r.every(Boolean);
    onDone({ ok, note: ok ? undefined : `Answers: ${blanks.map((b) => b.answers[0]).join(', ')}` });
  };
  const chipEl = (id: number) => (
    <button key={id} type="button" data-drag={id} className={`sq-chipbtn${sel === id ? ' sq-sel' : ''}`} onClick={tapOnKeyboard(() => tap(id))}>{textOf(id)}</button>
  );

  return (
    <div {...handlers}>
      <div className="sq-flow">
        {segs.map((s, k) => s.t === 'text'
          ? <span key={k}>{s.v}</span>
          : (
            <span key={k} data-drop={`slot-${s.idx}`} role="button" tabIndex={0}
              className={`sq-slot${hover === `slot-${s.idx}` ? ' sq-over' : ''}${res ? (res[s.idx] ? ' sq-ok' : ' sq-no') : ''}`}
              onClick={(e) => { if (e.target !== e.currentTarget || res) return; if (sel !== null) { place(sel, s.idx); setSel(null); } }}
              onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && sel !== null && !res) { e.preventDefault(); place(sel, s.idx); setSel(null); } }}>
              {slots[s.idx] !== null ? chipEl(slots[s.idx] as number) : null}
            </span>
          ))}
      </div>
      <div data-drop="bank" className={`sq-bank${hover === 'bank' ? ' sq-over' : ''}`}>
        {chips.filter((c) => !slots.includes(c.id)).map((c) => chipEl(c.id))}
      </div>
      <p className="sq-muted sq-small" style={{ margin: '4px 0 0' }}>Drag a word to a gap, or tap a word and then tap a gap.</p>
      {!res && <div className="sq-foot"><button className="sq-btn" disabled={slots.some((s) => s === null)} onClick={check}>Check</button></div>}
    </div>
  );
}

/* ---------- mark the words ---------- */

export function MarkWordsView({ q, onDone }: P<'markwords'>) {
  const tokens = useMemo(() => q.text.split(/\s+/).filter(Boolean).map((w) => {
    const m = w.match(/^(.*?)\*([^*]+)\*(.*)$/);
    return m ? { text: m[1] + m[2] + m[3], target: true } : { text: w, target: false };
  }), [q.text]);
  const [sel, setSel] = useState<number[]>([]);
  const [done, setDone] = useState(false);
  const check = () => {
    setDone(true);
    const ok = tokens.every((t, i) => t.target === sel.includes(i));
    const missed = tokens.filter((t, i) => t.target && !sel.includes(i)).map((t) => t.text);
    onDone({ ok, note: ok ? undefined : missed.length ? `You missed: ${missed.join(', ')}` : 'Some words you marked do not fit.' });
  };
  return (
    <div>
      <div className="sq-flow">
        {tokens.map((t, i) => {
          const on = sel.includes(i);
          const cls = done ? (on && t.target ? ' sq-ok' : on ? ' sq-no' : t.target ? ' sq-missed' : '') : on ? ' sq-sel' : '';
          return <button key={i} type="button" className={`sq-mark${cls}`} aria-pressed={on} disabled={done} onClick={() => setSel(on ? sel.filter((x) => x !== i) : [...sel, i])}>{t.text}</button>;
        })}
      </div>
      {!done && <div className="sq-foot"><button className="sq-btn" disabled={!sel.length} onClick={check}>Check</button></div>}
    </div>
  );
}

/* ---------- sentence builder and sort the paragraphs ---------- */

type Chip = { id: number; t: string; o: number };

function makeChips(items: string[]): Chip[] {
  const base = items.map((t, id) => ({ id, t, o: 0 }));
  let ordered = base;
  for (let tries = 0; tries < 8; tries++) {
    ordered = shuffle(base);
    if (ordered.map((c) => c.t).join('|') !== items.join('|')) break;
  }
  return ordered.map((c, o) => ({ ...c, o }));
}

function SortView({ items, block, onDone }: { items: string[]; block: boolean; onDone: (d: Done) => void }) {
  const [lists, setLists] = useState<{ tray: Chip[]; bank: Chip[] }>(() => ({ tray: [], bank: makeChips(items) }));
  const [res, setRes] = useState<boolean | null>(null);

  function move(id: number, to: 'tray' | 'bank', idx?: number) {
    setLists((g) => {
      const chip = g.tray.find((c) => c.id === id) ?? g.bank.find((c) => c.id === id);
      if (!chip) return g;
      const tray = g.tray.filter((c) => c.id !== id);
      const bank = g.bank.filter((c) => c.id !== id);
      if (to === 'tray') tray.splice(Math.min(idx ?? tray.length, tray.length), 0, chip); else bank.push(chip);
      return { tray, bank };
    });
  }
  const toggle = (id: number) => move(id, lists.tray.some((c) => c.id === id) ? 'bank' : 'tray');

  const { hover, handlers } = useDrag({
    enabled: res === null,
    onTap: (id) => toggle(Number(id)),
    onDrop: (id, drop, x, y, container) => {
      const n = Number(id);
      if (drop === 'tray') {
        let idx = 0;
        container.querySelector<HTMLElement>('[data-drop="tray"]')?.querySelectorAll<HTMLElement>('[data-drag]').forEach((el) => {
          if (el.dataset.drag === id) return;
          const r = el.getBoundingClientRect();
          if (block ? y > r.top + r.height / 2 : y > r.bottom || (y >= r.top && x > r.left + r.width / 2)) idx++;
        });
        move(n, 'tray', idx);
      } else if (drop === 'bank') move(n, 'bank');
    },
  });

  const check = () => {
    const ok = lists.tray.map((c) => c.t).join('|') === items.join('|');
    setRes(ok);
    onDone({ ok, note: ok ? undefined : `Correct order: ${items.join(block ? ' → ' : ' ')}` });
  };
  const chip = (c: Chip, cls: string) => (
    <button key={c.id} type="button" data-drag={c.id} className={`sq-chipbtn${block ? ' sq-block' : ''}${cls}`} onClick={tapOnKeyboard(() => toggle(c.id))}>{c.t}</button>
  );
  return (
    <div {...handlers}>
      <div data-drop="tray" className={`sq-tray${block ? ' sq-col' : ''}${lists.tray.length ? '' : ' sq-hint'}${hover === 'tray' ? ' sq-over' : ''}`}>
        {lists.tray.length ? lists.tray.map((c) => chip(c, res === null ? '' : res ? ' sq-ok' : ' sq-no')) : (block ? 'Drag the sentences here in the right order' : 'Drag the pieces here to build the sentence')}
      </div>
      <div data-drop="bank" className={`sq-bank${block ? ' sq-col' : ''}${hover === 'bank' ? ' sq-over' : ''}`}>
        {lists.bank.slice().sort((a, b) => a.o - b.o).map((c) => chip(c, ''))}
      </div>
      {res === null && <div className="sq-foot"><button className="sq-btn" disabled={lists.bank.length > 0} onClick={check}>Check</button></div>}
    </div>
  );
}
export const SortWordsView = ({ q, onDone }: P<'sortwords'>) => <SortView items={q.chunks} block={false} onDone={onDone} />;
export const SortParasView = ({ q, onDone }: P<'sortparas'>) => <SortView items={q.items} block onDone={onDone} />;

/* ---------- summary ---------- */

export function SummaryView({ q, onDone }: P<'summary'>) {
  const orders = useMemo(() => q.rounds.map((r) => shuffle(r.statements.map((_, i) => i))), [q]);
  const [round, setRound] = useState(0);
  const [errors, setErrors] = useState(0);
  const [bad, setBad] = useState<number | null>(null);
  const [chosen, setChosen] = useState<string[]>([]);
  const [finished, setFinished] = useState(false);
  const r = q.rounds[Math.min(round, q.rounds.length - 1)];
  const pick = (k: number) => {
    if (finished) return;
    if (k !== r.answer) { setErrors((e) => e + 1); setBad(k); return; }
    setBad(null);
    setChosen([...chosen, r.statements[k]]);
    if (round + 1 >= q.rounds.length) {
      setFinished(true);
      onDone({ ok: errors === 0, note: errors ? `${errors} wrong pick${errors > 1 ? 's' : ''} on the way.` : undefined });
    } else setRound(round + 1);
  };
  return (
    <div>
      {chosen.length > 0 && <ul className="sq-summary">{chosen.map((s, i) => <li key={i}>{s}</li>)}</ul>}
      {!finished && (
        <div className="sq-opts">
          <div className="sq-kind">Step {round + 1} of {q.rounds.length}: pick the true statement</div>
          {orders[round].map((k) => (
            <button key={k} type="button" className={`sq-opt${bad === k ? ' sq-no' : ''}`} onClick={() => pick(k)}>{r.statements[k]}</button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- match the pairs ---------- */

export function MatchView({ q, onDone }: P<'match'>) {
  const right = useMemo(() => shuffle(q.pairs.map((_, i) => i)), [q]);
  const [pairs, setPairs] = useState<Record<number, number>>({});
  const [sel, setSel] = useState<number | null>(null);
  const [res, setRes] = useState<Record<number, boolean> | null>(null);
  const colorOf = (i: number) => `sq-c${i % 6}`;
  const clickLeft = (i: number) => {
    if (res) return;
    if (i in pairs) { const n = { ...pairs }; delete n[i]; setPairs(n); } else setSel(sel === i ? null : i);
  };
  const clickRight = (j: number) => {
    if (res || sel === null) return;
    const n: Record<number, number> = {};
    Object.entries(pairs).forEach(([l, r]) => { if (r !== j) n[Number(l)] = r; });
    n[sel] = j;
    setPairs(n);
    setSel(null);
  };
  const check = () => {
    const r: Record<number, boolean> = {};
    q.pairs.forEach((_, i) => { r[i] = pairs[i] === i; });
    setRes(r);
    const ok = Object.values(r).every(Boolean);
    onDone({ ok, note: ok ? undefined : `Correct pairs: ${q.pairs.map((p) => `${p.a} = ${p.b}`).join('; ')}` });
  };
  const rightOwner = (j: number) => Object.entries(pairs).find(([, r]) => r === j)?.[0];
  return (
    <div>
      <div className="sq-match">
        <div className="sq-mcol">
          {q.pairs.map((p, i) => (
            <button key={i} type="button" className={`sq-opt sq-pairbtn${i in pairs ? ` ${colorOf(i)}` : ''}${sel === i ? ' sq-sel' : ''}${res ? (res[i] ? ' sq-ok' : ' sq-no') : ''}`} onClick={() => clickLeft(i)}>{p.a}</button>
          ))}
        </div>
        <div className="sq-mcol">
          {right.map((j) => {
            const owner = rightOwner(j);
            return (
              <button key={j} type="button" className={`sq-opt sq-pairbtn${owner !== undefined ? ` ${colorOf(Number(owner))}` : ''}`} disabled={!!res} onClick={() => clickRight(j)}>{q.pairs[j].b}</button>
            );
          })}
        </div>
      </div>
      <p className="sq-muted sq-small" style={{ margin: '8px 0 0' }}>Tap a term, then tap its match. Tap a matched term to undo it.</p>
      {!res && <div className="sq-foot"><button className="sq-btn" disabled={Object.keys(pairs).length < q.pairs.length} onClick={check}>Check</button></div>}
    </div>
  );
}

/* ---------- memory game ---------- */

export function MemoryView({ q, onDone }: P<'memory'>) {
  const cards = useMemo(() => shuffle(q.pairs.flatMap((p: Pair, pid) => [{ pid, t: p.a }, { pid, t: p.b }])).map((c, uid) => ({ ...c, uid })), [q]);
  const [open, setOpen] = useState<number[]>([]);
  const [matched, setMatched] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const busy = useRef(false);
  const finished = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const flip = (uid: number) => {
    if (busy.current || open.includes(uid) || matched.includes(cards[uid].pid)) return;
    const next = [...open, uid];
    setOpen(next);
    if (next.length === 2) {
      setMoves((m) => m + 1);
      if (cards[next[0]].pid === cards[next[1]].pid) { setMatched((m) => [...m, cards[next[0]].pid]); setOpen([]); }
      else { busy.current = true; timer.current = setTimeout(() => { setOpen([]); busy.current = false; }, 900); }
    }
  };
  useEffect(() => {
    if (matched.length === q.pairs.length && !finished.current) {
      finished.current = true;
      onDone({ ok: true, bonus: Math.max(0, 12 - (moves - q.pairs.length) * 2), note: `All pairs found in ${moves} moves.` });
    }
  }, [matched, moves, q.pairs.length, onDone]);

  return (
    <div>
      <div className="sq-memory">
        {cards.map((c) => {
          const up = open.includes(c.uid) || matched.includes(c.pid);
          return (
            <button key={c.uid} type="button" className={`sq-mem${up ? ' sq-up' : ''}${matched.includes(c.pid) ? ' sq-ok' : ''}`} aria-label={up ? c.t : 'Hidden card'} onClick={() => flip(c.uid)}>{up ? c.t : '?'}</button>
          );
        })}
      </div>
      <p className="sq-muted sq-small" style={{ margin: '8px 0 0' }}>Moves: {moves}. Matched {matched.length} of {q.pairs.length}.</p>
    </div>
  );
}

/* ---------- flashcards ---------- */

export function CardsView({ q, onDone }: P<'cards'>) {
  const [i, setI] = useState(0);
  const [flip, setFlip] = useState(false);
  const [known, setKnown] = useState(0);
  const [done, setDone] = useState(false);
  const grade = (knew: boolean) => {
    const k = known + (knew ? 1 : 0);
    setKnown(k);
    if (i + 1 >= q.cards.length) { setDone(true); onDone({ ok: true, bonus: k * 2, note: `You knew ${k} of ${q.cards.length} cards.` }); }
    else { setI(i + 1); setFlip(false); }
  };
  if (done) return <p className="sq-muted">All cards reviewed.</p>;
  const c = q.cards[i];
  return (
    <div>
      <button type="button" className={`sq-flash${flip ? ' sq-back' : ''}`} onClick={() => setFlip(!flip)} aria-label="Flip card">
        <span className="sq-kind">{flip ? 'Answer' : 'Card'} {i + 1} of {q.cards.length}</span>
        <span className="sq-flashtext">{flip ? c.back : c.front}</span>
        <span className="sq-small sq-muted">{flip ? '' : 'Tap to flip'}</span>
      </button>
      {flip && (
        <div className="sq-row sq-center" style={{ marginTop: 12 }}>
          <button className="sq-btn sq-ghost" onClick={() => grade(false)}>Not yet</button>
          <button className="sq-btn" onClick={() => grade(true)}>I knew it</button>
        </div>
      )}
    </div>
  );
}

/* ---------- short answer ---------- */

export function EssayView({ q, onDone }: P<'essay'>) {
  const [text, setText] = useState('');
  const [done, setDone] = useState(false);
  const check = () => {
    const low = text.toLowerCase();
    const hit = q.keywords.filter((k) => low.includes(k.toLowerCase().slice(0, Math.max(4, k.length - 2))));
    const miss = q.keywords.filter((k) => !hit.includes(k));
    const ok = hit.length >= Math.ceil(q.keywords.length / 2);
    setDone(true);
    onDone({ ok, note: `Key ideas included: ${hit.join(', ') || 'none'}.${miss.length ? ` Missing: ${miss.join(', ')}.` : ''} Model answer: ${q.sample}` });
  };
  return (
    <div>
      <textarea className="sq-essay" rows={4} value={text} disabled={done} placeholder="Write your answer here" onChange={(e) => setText(e.target.value)} />
      {!done && <div className="sq-foot"><button className="sq-btn" disabled={text.trim().split(/\s+/).length < 3} onClick={check}>Check</button></div>}
    </div>
  );
}

/* ---------- word search ---------- */

const cleanWord = (w: string) => w.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z]/g, '');

function makeWordSearch(raw: string[]) {
  const words = Array.from(new Set(raw.map(cleanWord).filter((w) => w.length >= 3 && w.length <= 12))).slice(0, 10).sort((a, b) => b.length - a.length);
  const longest = Math.max(0, ...words.map((w) => w.length));
  const size = Math.min(14, Math.max(9, longest + 2, Math.ceil(Math.sqrt(words.join('').length * 2.2))));
  const grid: string[][] = Array.from({ length: size }, () => Array<string>(size).fill(''));
  const dirs = [[0, 1], [1, 0], [1, 1], [-1, 1]];
  const placed: string[] = [];
  for (const w of words) {
    let ok = false;
    for (let t = 0; t < 200 && !ok; t++) {
      const [dr, dc] = dirs[Math.floor(Math.random() * dirs.length)];
      const r = Math.floor(Math.random() * size);
      const c = Math.floor(Math.random() * size);
      const er = r + dr * (w.length - 1);
      const ec = c + dc * (w.length - 1);
      if (er < 0 || er >= size || ec < 0 || ec >= size) continue;
      let fits = true;
      for (let k = 0; k < w.length; k++) { const ch = grid[r + dr * k][c + dc * k]; if (ch && ch !== w[k]) { fits = false; break; } }
      if (!fits) continue;
      for (let k = 0; k < w.length; k++) grid[r + dr * k][c + dc * k] = w[k];
      ok = true;
    }
    if (ok) placed.push(w);
  }
  const abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (!grid[r][c]) grid[r][c] = abc[Math.floor(Math.random() * 26)];
  return { grid, words: placed, size };
}

type Cell = [number, number];
const cellKey = (c: Cell) => `${c[0]},${c[1]}`;
function lineCells(a: Cell, b: Cell): Cell[] | null {
  const dr = b[0] - a[0];
  const dc = b[1] - a[1];
  if (!(dr === 0 || dc === 0 || Math.abs(dr) === Math.abs(dc))) return null;
  const n = Math.max(Math.abs(dr), Math.abs(dc));
  const sr = Math.sign(dr);
  const sc = Math.sign(dc);
  return Array.from({ length: n + 1 }, (_, k) => [a[0] + sr * k, a[1] + sc * k] as Cell);
}

export function WordSearchView({ q, onDone }: P<'wordsearch'>) {
  const puzzle = useMemo(() => makeWordSearch(q.words), [q]);
  const [found, setFound] = useState<string[]>([]);
  const [foundCells, setFoundCells] = useState<string[]>([]);
  const [pending, setPending] = useState<Cell | null>(null);
  const [cur, setCur] = useState<Cell | null>(null);
  const start = useRef<Cell | null>(null);
  const dragging = useRef(false);
  const finished = useRef(false);

  const cellAt = (x: number, y: number): Cell | null => {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-cell]');
    if (!el?.dataset.cell) return null;
    const [r, c] = el.dataset.cell.split(',').map(Number);
    return [r, c];
  };
  const evaluate = (a: Cell, b: Cell) => {
    const cells = lineCells(a, b);
    if (!cells) return;
    const word = cells.map(([r, c]) => puzzle.grid[r][c]).join('');
    const rev = Array.from(word).reverse().join('');
    const hit = puzzle.words.find((w) => !found.includes(w) && (w === word || w === rev));
    if (!hit) return;
    const nf = [...found, hit];
    setFound(nf);
    setFoundCells((f) => [...f, ...cells.map(cellKey)]);
    if (nf.length === puzzle.words.length && !finished.current) { finished.current = true; onDone({ ok: true, bonus: 10, note: `Found all ${nf.length} words.` }); }
  };

  const preview = new Set<string>();
  if (dragging.current && start.current && cur) (lineCells(start.current, cur) ?? [start.current]).forEach((c) => preview.add(cellKey(c)));
  else if (pending) preview.add(cellKey(pending));

  return (
    <div>
      <div className="sq-ws" style={{ ['--cols' as string]: puzzle.size }}
        onPointerDown={(e) => {
          if (finished.current) return;
          const a = cellAt(e.clientX, e.clientY);
          if (!a) return;
          if (pending) { evaluate(pending, a); setPending(null); return; }
          start.current = a; dragging.current = true; setCur(a);
          try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
        }}
        onPointerMove={(e) => { if (dragging.current) { const c = cellAt(e.clientX, e.clientY); if (c) setCur(c); } }}
        onPointerUp={(e) => {
          if (!dragging.current || !start.current) return;
          const a = start.current;
          const b = cellAt(e.clientX, e.clientY) ?? cur ?? a;
          dragging.current = false; start.current = null; setCur(null);
          if (a[0] === b[0] && a[1] === b[1]) setPending(a); else evaluate(a, b);
        }}
        onPointerCancel={() => { dragging.current = false; start.current = null; setCur(null); }}>
        {puzzle.grid.map((row, r) => row.map((ch, c) => {
          const k = cellKey([r, c]);
          return <span key={k} data-cell={k} className={`sq-wscell${foundCells.includes(k) ? ' sq-found' : preview.has(k) ? ' sq-pick' : ''}`}>{ch}</span>;
        }))}
      </div>
      <ul className="sq-words">
        {puzzle.words.map((w) => <li key={w} className={found.includes(w) ? 'sq-gotit' : ''}>{w}</li>)}
      </ul>
      <p className="sq-muted sq-small" style={{ margin: '4px 0 0' }}>Drag across the letters, or tap the first and last letter of a word.</p>
    </div>
  );
}

/* ---------- crossword ---------- */

type Placed = { answer: string; clue: string; r: number; c: number; dir: 'across' | 'down'; n: number };

function layoutCrossword(entries: { answer: string; clue: string }[]) {
  const words = entries
    .map((e) => ({ answer: cleanWord(e.answer), clue: e.clue }))
    .filter((e) => e.answer.length >= 3 && e.answer.length <= 12)
    .sort((a, b) => b.answer.length - a.answer.length);
  const letters = new Map<string, string>();
  const dirsAt = new Map<string, string>();
  const placed: Omit<Placed, 'n'>[] = [];
  const key = (r: number, c: number) => `${r},${c}`;

  const canPlace = (w: string, r: number, c: number, dr: number, dc: number) => {
    if (letters.has(key(r - dr, c - dc)) || letters.has(key(r + dr * w.length, c + dc * w.length))) return false;
    let cross = 0;
    for (let k = 0; k < w.length; k++) {
      const rr = r + dr * k;
      const cc = c + dc * k;
      const ex = letters.get(key(rr, cc));
      if (ex !== undefined) {
        if (ex !== w[k] || (dirsAt.get(key(rr, cc)) ?? '').includes(dr ? 'd' : 'a')) return false;
        cross++;
      } else if (letters.has(key(rr + dc, cc + dr)) || letters.has(key(rr - dc, cc - dr))) return false;
    }
    return cross > 0;
  };
  const put = (e: { answer: string; clue: string }, r: number, c: number, dir: 'across' | 'down') => {
    const dr = dir === 'down' ? 1 : 0;
    const dc = dir === 'across' ? 1 : 0;
    for (let k = 0; k < e.answer.length; k++) {
      const kk = key(r + dr * k, c + dc * k);
      letters.set(kk, e.answer[k]);
      dirsAt.set(kk, (dirsAt.get(kk) ?? '') + (dir === 'down' ? 'd' : 'a'));
    }
    placed.push({ ...e, r, c, dir });
  };

  words.forEach((e, idx) => {
    if (idx === 0) { put(e, 0, 0, 'across'); return; }
    let spot: { r: number; c: number; dir: 'across' | 'down' } | null = null;
    outer: for (const p of placed) {
      for (let i = 0; i < p.answer.length; i++) {
        const pr = p.dir === 'across' ? p.r : p.r + i;
        const pc = p.dir === 'across' ? p.c + i : p.c;
        for (let k = 0; k < e.answer.length; k++) {
          if (e.answer[k] !== p.answer[i]) continue;
          const dir = p.dir === 'across' ? 'down' : 'across';
          const r = dir === 'down' ? pr - k : pr;
          const c = dir === 'across' ? pc - k : pc;
          if (canPlace(e.answer, r, c, dir === 'down' ? 1 : 0, dir === 'across' ? 1 : 0)) { spot = { r, c, dir }; break outer; }
        }
      }
    }
    if (spot) put(e, spot.r, spot.c, spot.dir);
  });

  const minR = Math.min(...placed.map((p) => p.r));
  const minC = Math.min(...placed.map((p) => p.c));
  const norm0 = placed.map((p) => ({ ...p, r: p.r - minR, c: p.c - minC }));
  const starts = Array.from(new Set(norm0.map((p) => key(p.r, p.c)))).sort((a, b) => {
    const [ar, ac] = a.split(',').map(Number);
    const [br, bc] = b.split(',').map(Number);
    return ar - br || ac - bc;
  });
  const out: Placed[] = norm0.map((p) => ({ ...p, n: starts.indexOf(key(p.r, p.c)) + 1 }));
  const cells = new Map<string, string>();
  out.forEach((p) => { for (let k = 0; k < p.answer.length; k++) cells.set(key(p.r + (p.dir === 'down' ? k : 0), p.c + (p.dir === 'across' ? k : 0)), p.answer[k]); });
  const rows = Math.max(0, ...out.map((p) => p.r + (p.dir === 'down' ? p.answer.length : 1)));
  const cols = Math.max(0, ...out.map((p) => p.c + (p.dir === 'across' ? p.answer.length : 1)));
  return { placed: out, cells, rows, cols };
}

export function CrosswordView({ q, onDone }: P<'crossword'>) {
  const cw = useMemo(() => layoutCrossword(q.entries), [q]);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [res, setRes] = useState<Record<string, boolean> | null>(null);
  if (cw.placed.length < 2) {
    return <div><p className="sq-muted">This crossword could not be laid out.</p><div className="sq-foot"><button className="sq-btn" onClick={() => onDone({ ok: true })}>Skip</button></div></div>;
  }
  const numberAt = new Map<string, number>();
  cw.placed.forEach((p) => numberAt.set(`${p.r},${p.c}`, p.n));
  const check = () => {
    const r: Record<string, boolean> = {};
    cw.cells.forEach((ch, k) => { r[k] = (vals[k] ?? '') === ch; });
    setRes(r);
    const ok = Object.values(r).every(Boolean);
    onDone({ ok, note: ok ? undefined : 'Some letters were wrong or missing. The correct letters are now shown in green.' });
    if (!ok) setVals(Object.fromEntries(Array.from(cw.cells.entries())));
  };
  const clues = (dir: 'across' | 'down') => cw.placed.filter((p) => p.dir === dir).sort((a, b) => a.n - b.n);
  const cells: React.ReactNode[] = [];
  for (let r = 0; r < cw.rows; r++) {
    for (let c = 0; c < cw.cols; c++) {
      const k = `${r},${c}`;
      if (!cw.cells.has(k)) { cells.push(<span key={k} className="sq-xwblock" />); continue; }
      const n = numberAt.get(k);
      cells.push(
        <span key={k} className="sq-xwcell">
          {n ? <i className="sq-xwnum">{n}</i> : null}
          <input aria-label={`Row ${r + 1} column ${c + 1}`} maxLength={1} value={vals[k] ?? ''} disabled={!!res} className={res ? (res[k] ? 'sq-ok' : 'sq-no') : ''}
            autoCapitalize="characters" autoCorrect="off" spellCheck={false}
            onChange={(e) => setVals({ ...vals, [k]: cleanWord(e.target.value).slice(-1) })} />
        </span>,
      );
    }
  }
  return (
    <div>
      <div className="sq-xwscroll"><div className="sq-xw" style={{ ['--cols' as string]: cw.cols }}>{cells}</div></div>
      <div className="sq-clues">
        <div><b>Across</b><ol>{clues('across').map((p) => <li key={`a${p.n}`} value={p.n}>{p.clue} ({p.answer.length})</li>)}</ol></div>
        <div><b>Down</b><ol>{clues('down').map((p) => <li key={`d${p.n}`} value={p.n}>{p.clue} ({p.answer.length})</li>)}</ol></div>
      </div>
      {!res && <div className="sq-foot"><button className="sq-btn" disabled={Object.values(vals).filter(Boolean).length === 0} onClick={check}>Check</button></div>}
    </div>
  );
}

/* ---------- dictation ---------- */

export function DictationView({ q, onDone }: P<'dictation'>) {
  const [can, setCan] = useState(false);
  const [text, setText] = useState('');
  const [done, setDone] = useState(false);
  useEffect(() => {
    setCan('speechSynthesis' in window);
    return () => { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); };
  }, []);
  const speak = (slow: boolean) => {
    const s = window.speechSynthesis;
    s.cancel();
    const u = new SpeechSynthesisUtterance(q.sentence);
    u.rate = slow ? 0.6 : 0.95;
    s.speak(u);
  };
  const check = () => {
    const strip = (s: string) => norm(s).replace(/[^\p{L}\p{N}\s']/gu, '');
    const ok = strip(text) === strip(q.sentence);
    setDone(true);
    onDone({ ok, note: ok ? undefined : `The sentence was: ${q.sentence}` });
  };
  return (
    <div>
      {can ? (
        <div className="sq-row" style={{ marginBottom: 12 }}>
          <button type="button" className="sq-btn sq-sun" onClick={() => speak(false)}>Play sentence</button>
          <button type="button" className="sq-btn sq-ghost" onClick={() => speak(true)}>Play slowly</button>
        </div>
      ) : <p className="sq-status">Audio is not available here. The sentence is: <b>{q.sentence}</b></p>}
      <textarea className="sq-essay" rows={2} value={text} disabled={done} placeholder="Type what you hear" onChange={(e) => setText(e.target.value)} />
      {!done && <div className="sq-foot"><button className="sq-btn" disabled={!text.trim()} onClick={check}>Check</button></div>}
    </div>
  );
}

/* ---------- arithmetic (timed) ---------- */

const ARITH_MS = 15000;
export function ArithView({ q, onDone }: P<'arith'>) {
  const [val, setVal] = useState('');
  const [res, setRes] = useState<boolean | null>(null);
  const [left, setLeft] = useState(ARITH_MS);
  const deadline = useRef(Date.now() + ARITH_MS);
  const valRef = useRef('');
  valRef.current = val;
  const settled = useRef(false);

  const settle = (timedOut: boolean) => {
    if (settled.current) return;
    settled.current = true;
    const ok = !timedOut && Number(valRef.current) === q.answer && valRef.current.trim() !== '';
    setRes(ok);
    onDone({ ok, bonus: ok ? Math.round((deadline.current - Date.now()) / 2000) : 0, note: ok ? undefined : `${timedOut ? "Time's up. " : ''}${q.a} ${q.op} ${q.b} = ${q.answer}` });
  };
  useEffect(() => {
    const t = setInterval(() => {
      const l = deadline.current - Date.now();
      if (l <= 0) { clearInterval(t); setLeft(0); settle(true); } else setLeft(l);
    }, 200);
    return () => clearInterval(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div>
      <div className="sq-bar" aria-label="Time left"><i style={{ width: `${(left / ARITH_MS) * 100}%` }} /></div>
      <div className="sq-row" style={{ marginTop: 14 }}>
        <input className={`sq-blank sq-num${res === null ? '' : res ? ' sq-ok' : ' sq-no'}`} inputMode="numeric" autoFocus value={val} disabled={res !== null} aria-label="Your answer"
          onChange={(e) => setVal(e.target.value.replace(/[^\d-]/g, ''))} onKeyDown={(e) => { if (e.key === 'Enter' && val) settle(false); }} />
        {res === null && <button className="sq-btn" disabled={!val} onClick={() => settle(false)}>Check</button>}
      </div>
    </div>
  );
}
