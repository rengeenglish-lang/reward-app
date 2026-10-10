'use client';

import { useState } from 'react';
import { themeEmoji, useThemes, usePypCurrent, type PypThemeItem } from './pyp-themes';

type Actions = { rename: (id: string, next: string) => boolean; remove: (id: string) => void };

/** One theme in your list, with buttons to edit (rename) and remove it. `onPick` makes the name itself selectable. */
function ThemeName({ theme, selected, onPick, rename, remove, variant }: { theme: PypThemeItem; selected?: boolean; onPick?: () => void; variant: 'option' | 'tag' } & Actions) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(theme.name);
  const [bad, setBad] = useState(false);
  const save = () => { if (rename(theme.id, draft)) { setEditing(false); setBad(false); } else setBad(true); };
  const wrap = variant === 'option' ? `pyp-option pyp-custom${selected ? ' on' : ''}` : '';
  if (editing) {
    const Box = variant === 'tag' ? 'li' : 'div';
    return (
      <Box className={`${wrap} pyp-editing`}>
        <input className="pyp-edit-input" aria-label={`Edit theme name ${theme.name}`} value={draft} maxLength={60} autoFocus aria-invalid={bad} onChange={(event) => { setDraft(event.target.value); setBad(false); }} onKeyDown={(event) => { if (event.key === 'Enter') save(); if (event.key === 'Escape') { setEditing(false); setBad(false); } }} />
        <button type="button" className="pyp-edit-save" onClick={save} disabled={!draft.trim()}>Save</button>
        <button type="button" className="pyp-custom-remove" aria-label="Cancel editing" onClick={() => { setEditing(false); setBad(false); }}>✕</button>
        {bad && <small className="pyp-bad" role="alert">That name is empty or already used.</small>}
      </Box>
    );
  }
  const edit = <button type="button" className="pyp-custom-edit" aria-label={`Edit theme ${theme.name}`} title="Edit this theme name" onClick={() => { setDraft(theme.name); setEditing(true); }}>✎</button>;
  const del = <button type="button" className="pyp-custom-remove" aria-label={`Remove theme ${theme.name}`} title="Remove this theme" onClick={() => { if (window.confirm(`Remove the theme “${theme.name}”? Plans and notes already saved with it keep their text.`)) remove(theme.id); }}>✕</button>;
  if (variant === 'tag') return <li><span>{themeEmoji(theme)} {theme.name}</span>{edit}{del}</li>;
  return (
    <div className={wrap}>
      <button type="button" className="pyp-custom-pick" aria-pressed={selected} onClick={onPick}><span aria-hidden="true">{themeEmoji(theme)}</span><b>{theme.name}</b></button>
      {edit}{del}
    </div>
  );
}

/**
 * The PYP theme for all of Grade 4 (every class shares it). Tap the chip to choose a theme, add a new one,
 * rename or remove themes in the list, and write the central idea.
 */
export default function PypTheme({ showIdea = false }: { showIdea?: boolean }) {
  const { current, set } = usePypCurrent();
  const { themes, add, remove, rename, restoreIb, missingIb } = useThemes();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [idea, setIdea] = useState('');

  const chosen = themes.find((t) => t.name === current.theme);
  const emoji = chosen ? themeEmoji(chosen) : current.theme ? '✨' : '🌟';
  const show = () => { setIdea(current.idea); setName(''); setOpen(true); };
  const choose = (theme: string) => set({ theme, idea });
  const addName = () => { const added = add(name); if (added) { set({ theme: added.name, idea }); setName(''); } };

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
            <p>This theme is for all your Grade 4 classes. Pick one, add a theme, or use ✎ and ✕ to rename or remove one.</p>
            <div className="pyp-pick-grid">
              {themes.map((t) => <ThemeName key={t.id} variant="option" theme={t} selected={current.theme === t.name} onPick={() => choose(t.name)} rename={rename} remove={remove} />)}
              {themes.length === 0 && <p className="pyp-none">No themes yet. Add one below.</p>}
            </div>
            {missingIb && <button type="button" className="text-link pyp-restore" onClick={restoreIb}>Restore the removed IB themes</button>}
            <label className="pyp-label" htmlFor="pyp-own">Add a theme</label>
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

/** Teacher Issues: set the Grade 4 theme and manage your list of themes (add, rename, remove). */
export function PypThemePanel() {
  const { themes, add, remove, rename, restoreIb, missingIb } = useThemes();
  const [name, setName] = useState('');
  return (
    <section className="panel ti-panel pyp-panel" aria-labelledby="pyp-themes-title">
      <div className="panel-title"><div className="panel-icon purple">🌟</div><div><h2 id="pyp-themes-title">PYP theme for Grade 4</h2><p>One theme for all your Grade 4 classes. It also shows on the Today page. Add, rename or remove themes below; every theme can be picked in Unit plans and notes.</p></div></div>
      <div className="pyp-current"><PypTheme showIdea /></div>
      <label className="pyp-label" htmlFor="pyp-add-name">Add a theme</label>
      <div className="pyp-own">
        <input id="pyp-add-name" value={name} maxLength={60} placeholder="e.g. Our oceans" onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && name.trim()) { add(name); setName(''); } }} />
        <button type="button" className="primary-btn" disabled={!name.trim()} onClick={() => { add(name); setName(''); }}>Add</button>
      </div>
      <ul className="pyp-tool-list" aria-label="Your PYP themes">
        {themes.map((t) => <ThemeName key={t.id} variant="tag" theme={t} rename={rename} remove={remove} />)}
      </ul>
      {themes.length === 0 && <p className="pyp-none">No themes yet. Add one above.</p>}
      {missingIb && <button type="button" className="text-link pyp-restore" onClick={restoreIb}>Restore the removed IB themes</button>}
    </section>
  );
}
