'use client';

import { useState } from 'react';
import { PYP_SIX, useCustomThemes, usePypCurrent } from './pyp-themes';

/**
 * The PYP theme for all of Grade 4 (every class shares it). Tap the chip to choose one of the six themes
 * or one you added yourself, add a new theme name, and write the central idea.
 */
export default function PypTheme({ showIdea = false }: { showIdea?: boolean }) {
  const { current, set } = usePypCurrent();
  const { custom, add, remove } = useCustomThemes();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [idea, setIdea] = useState('');

  const emoji = PYP_SIX.find((t) => t.name === current.theme)?.emoji || (current.theme ? '✨' : '🌟');
  const show = () => { setIdea(current.idea); setName(''); setOpen(true); };
  const choose = (theme: string) => set({ theme, idea });
  const addName = () => { const added = add(name); if (added) { set({ theme: added, idea }); setName(''); } };

  return (
    <>
      <button type="button" className="pyp-chip" onClick={show} aria-haspopup="dialog" title="Set the PYP theme for Grade 4">
        <span aria-hidden="true">{emoji}</span>
        <span className="pyp-chip-text"><small>PYP theme · Grade 4</small><b>{current.theme || 'Add theme'}</b></span>
      </button>
      {showIdea && <p className="pyp-idea">{current.idea ? `Central idea: ${current.idea}` : 'No central idea yet.'}</p>}
      {open && (
        <div className="pyp-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <section className="pyp-pop" role="dialog" aria-modal="true" aria-label="PYP theme">
            <button type="button" className="pyp-close" aria-label="Close" onClick={() => setOpen(false)}>✕</button>
            <h2>PYP theme for Grade 4</h2>
            <p>This theme is for all your Grade 4 classes. Pick one, or add your own theme name below.</p>
            <div className="pyp-pick-grid">
              {PYP_SIX.map((t) => (
                <button key={t.name} type="button" className={`pyp-option${current.theme === t.name ? ' on' : ''}`} aria-pressed={current.theme === t.name} onClick={() => choose(t.name)}>
                  <span aria-hidden="true">{t.emoji}</span><b>{t.name}</b>
                </button>
              ))}
              {custom.map((t) => (
                <div key={t} className={`pyp-option pyp-custom${current.theme === t ? ' on' : ''}`}>
                  <button type="button" className="pyp-custom-pick" aria-pressed={current.theme === t} onClick={() => choose(t)}><span aria-hidden="true">✨</span><b>{t}</b></button>
                  <button type="button" className="pyp-custom-remove" aria-label={`Remove theme ${t}`} title="Remove this theme name" onClick={() => remove(t)}>✕</button>
                </div>
              ))}
            </div>
            <label className="pyp-label" htmlFor="pyp-own">Add a theme name</label>
            <div className="pyp-own">
              <input id="pyp-own" value={name} maxLength={60} placeholder="e.g. Our oceans" onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') addName(); }} />
              <button type="button" className="primary-btn" disabled={!name.trim()} onClick={addName}>Add</button>
            </div>
            <label className="pyp-label" htmlFor="pyp-idea">Central idea <small>optional</small></label>
            <textarea id="pyp-idea" rows={2} maxLength={200} value={idea} placeholder="e.g. Water is precious and must be protected" onChange={(event) => setIdea(event.target.value)} onBlur={() => set({ theme: current.theme, idea })} />
            <div className="pyp-actions">
              <button type="button" className="outline-btn" onClick={() => { set({ theme: '', idea: '' }); setIdea(''); }}>Clear theme</button>
              <button type="button" className="primary-btn" onClick={() => { set({ theme: current.theme, idea }); setOpen(false); }}>Done</button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

/** Teacher Issues: set the Grade 4 theme and manage the theme names you added. */
export function PypThemePanel() {
  const { custom, add, remove } = useCustomThemes();
  const [name, setName] = useState('');
  return (
    <section className="panel ti-panel pyp-panel" aria-labelledby="pyp-themes-title">
      <div className="panel-title"><div className="panel-icon purple">🌟</div><div><h2 id="pyp-themes-title">PYP theme for Grade 4</h2><p>One theme for all your Grade 4 classes. It also shows on the Today page, and every theme here can be picked in Unit plans.</p></div></div>
      <div className="pyp-current"><PypTheme showIdea /></div>
      <label className="pyp-label" htmlFor="pyp-add-name">Add a theme name</label>
      <div className="pyp-own">
        <input id="pyp-add-name" value={name} maxLength={60} placeholder="e.g. Our oceans" onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && name.trim()) { add(name); setName(''); } }} />
        <button type="button" className="primary-btn" disabled={!name.trim()} onClick={() => { add(name); setName(''); }}>Add</button>
      </div>
      {custom.length > 0 && (
        <ul className="pyp-tool-list" aria-label="Theme names you added">
          {custom.map((t) => <li key={t}><span>{t}</span><button type="button" aria-label={`Remove theme ${t}`} onClick={() => remove(t)}>✕</button></li>)}
        </ul>
      )}
    </section>
  );
}
