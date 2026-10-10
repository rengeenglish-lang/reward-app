'use client';

import { useEffect, useState } from 'react';

type Saved = { theme: string; idea: string };

/** The six IB PYP transdisciplinary themes. Teachers can also type their own. */
export const PYP_THEMES = [
  { name: 'Who we are', emoji: '🧑‍🤝‍🧑' },
  { name: 'Where we are in place and time', emoji: '🗺️' },
  { name: 'How we express ourselves', emoji: '🎭' },
  { name: 'How the world works', emoji: '🔬' },
  { name: 'How we organize ourselves', emoji: '🏗️' },
  { name: 'Sharing the planet', emoji: '🌍' },
] as const;

const key = (classroomId: string) => `ezgili-pyp-theme:${classroomId}`;

/** A chip on the Today page showing the class's PYP theme. Tap it to choose one of the six or type your own. */
export default function PypTheme({ classroomId, showIdea = false }: { classroomId: string; showIdea?: boolean }) {
  const [saved, setSaved] = useState<Saved>({ theme: '', idea: '' });
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState('');
  const [idea, setIdea] = useState('');

  useEffect(() => {
    try {
      const next = JSON.parse(localStorage.getItem(key(classroomId)) || 'null') as Saved | null;
      setSaved(next && typeof next.theme === 'string' ? { theme: next.theme, idea: next.idea || '' } : { theme: '', idea: '' });
    } catch { setSaved({ theme: '', idea: '' }); }
    setOpen(false);
  }, [classroomId]);

  const persist = (next: Saved) => {
    setSaved(next);
    try { if (next.theme || next.idea) localStorage.setItem(key(classroomId), JSON.stringify(next)); else localStorage.removeItem(key(classroomId)); } catch { /* storage can be blocked */ }
  };
  const show = () => { setCustom(PYP_THEMES.some((t) => t.name === saved.theme) ? '' : saved.theme); setIdea(saved.idea); setOpen(true); };
  const choose = (theme: string) => { persist({ theme, idea }); setCustom(''); };
  const addOwn = () => { const theme = custom.trim().slice(0, 60); if (theme) persist({ theme, idea }); };
  const emoji = PYP_THEMES.find((t) => t.name === saved.theme)?.emoji || '🌟';

  return (
    <>
      <button type="button" className="pyp-chip" onClick={show} aria-haspopup="dialog" title="Set the PYP theme for this class">
        <span aria-hidden="true">{saved.theme ? emoji : '🌟'}</span>
        <span className="pyp-chip-text"><small>PYP theme</small><b>{saved.theme || 'Add theme'}</b></span>
      </button>
      {showIdea && <p className="pyp-idea">{saved.idea ? `Central idea: ${saved.idea}` : 'No central idea yet.'}</p>}
      {open && (
        <div className="pyp-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <section className="pyp-pop" role="dialog" aria-modal="true" aria-label="PYP theme">
            <button type="button" className="pyp-close" aria-label="Close" onClick={() => setOpen(false)}>✕</button>
            <h2>PYP theme</h2>
            <p>Pick a transdisciplinary theme, or type your own.</p>
            <div className="pyp-grid">
              {PYP_THEMES.map((t) => (
                <button key={t.name} type="button" className={`pyp-option${saved.theme === t.name ? ' on' : ''}`} aria-pressed={saved.theme === t.name} onClick={() => choose(t.name)}>
                  <span aria-hidden="true">{t.emoji}</span><b>{t.name}</b>
                </button>
              ))}
            </div>
            <label className="pyp-label" htmlFor="pyp-own">Add my own theme</label>
            <div className="pyp-own">
              <input id="pyp-own" value={custom} maxLength={60} placeholder="e.g. Our oceans" onChange={(event) => setCustom(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') addOwn(); }} />
              <button type="button" className="primary-btn" disabled={!custom.trim()} onClick={addOwn}>Use it</button>
            </div>
            <label className="pyp-label" htmlFor="pyp-idea">Central idea <small>optional</small></label>
            <textarea id="pyp-idea" rows={2} maxLength={200} value={idea} placeholder="e.g. Water is precious and must be protected" onChange={(event) => setIdea(event.target.value)} onBlur={() => persist({ theme: saved.theme, idea })} />
            <div className="pyp-actions">
              <button type="button" className="outline-btn" onClick={() => { persist({ theme: '', idea: '' }); setCustom(''); setIdea(''); }}>Clear</button>
              <button type="button" className="primary-btn" onClick={() => { persist({ theme: saved.theme, idea }); setOpen(false); }}>Done</button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

/** Teacher Issues: every class with its PYP theme and central idea, ready to change. */
export function PypThemeList({ classrooms }: { classrooms: Array<{ id: string; name: string }> }) {
  return (
    <section className="panel ti-panel pyp-panel" aria-labelledby="pyp-themes-title">
      <div className="panel-title"><div className="panel-icon purple">🌟</div><div><h2 id="pyp-themes-title">PYP theme for each class</h2><p>Choose one of the six transdisciplinary themes or type your own. The theme also shows on the Today page.</p></div></div>
      {classrooms.length === 0 ? <p className="readers-empty">Add a classroom first.</p> : (
        <ul className="pyp-rows">
          {classrooms.map((c) => (
            <li key={c.id} className="pyp-row"><strong>{c.name}</strong><div><PypTheme classroomId={c.id} showIdea /></div></li>
          ))}
        </ul>
      )}
    </section>
  );
}

type Tool = { id: string; name: string };
const TOOLS_KEY = 'ezgili-pyp-tools';

/** Your own list of PYP tools. Type one, or paste a whole list with one tool on each line. */
export function PypToolList() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(TOOLS_KEY) || '[]') as Tool[];
      if (Array.isArray(saved)) setTools(saved.filter((t) => t && typeof t.name === 'string'));
    } catch { /* start empty */ }
  }, []);

  const save = (next: Tool[]) => {
    setTools(next);
    try { localStorage.setItem(TOOLS_KEY, JSON.stringify(next)); } catch { /* storage can be blocked */ }
  };
  const add = () => {
    const have = new Set(tools.map((t) => t.name.toLowerCase()));
    const fresh: Tool[] = [];
    for (const raw of text.split(/\r?\n|;/)) {
      const name = raw.replace(/^[\s\-*•\d.)]+/, '').trim().slice(0, 80);
      if (!name || have.has(name.toLowerCase())) continue;
      have.add(name.toLowerCase());
      fresh.push({ id: `${Date.now()}-${fresh.length}`, name });
    }
    if (fresh.length) save([...tools, ...fresh]);
    setText('');
  };
  const shown = tools.filter((t) => t.name.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <section className="panel ti-panel pyp-panel" aria-labelledby="pyp-tools-title">
      <div className="panel-title"><div className="panel-icon coral">🧰</div><div><h2 id="pyp-tools-title">My PYP tools</h2><p>Add your own list of PYP tools. Paste many at once, one on each line.</p></div></div>
      <label className="pyp-label" htmlFor="pyp-tools-input">Add tools</label>
      <textarea id="pyp-tools-input" className="pyp-tools-input" rows={4} value={text} placeholder={'Thinking routines\nLearner profile\nKey concepts\nApproaches to learning'} onChange={(event) => setText(event.target.value)} />
      <div className="pyp-actions"><button type="button" className="primary-btn" disabled={!text.trim()} onClick={add}>Add to my list</button></div>
      {tools.length > 0 && (
        <>
          <div className="pyp-list-head"><strong>{tools.length} {tools.length === 1 ? 'tool' : 'tools'}</strong><input className="pyp-search" value={query} placeholder="Search" aria-label="Search PYP tools" onChange={(event) => setQuery(event.target.value)} /></div>
          <ul className="pyp-tool-list">
            {shown.map((t) => (
              <li key={t.id}><span>{t.name}</span><button type="button" aria-label={`Remove ${t.name}`} onClick={() => save(tools.filter((x) => x.id !== t.id))}>✕</button></li>
            ))}
            {shown.length === 0 && <li className="pyp-none">No tools match.</li>}
          </ul>
        </>
      )}
    </section>
  );
}
