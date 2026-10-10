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
export default function PypTheme({ classroomId }: { classroomId: string }) {
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
