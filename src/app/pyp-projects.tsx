'use client';

import { useEffect, useState, useTransition } from 'react';
import { ExternalLink, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react';
import { suggestProject } from './pyp-projects-actions';
import { addTeacherNote, deleteTeacherNote, listTeacherNotes, updateTeacherNote } from './teacher-notes-actions';
import { useCustomThemes, useThemeDescriptions } from './pyp-themes';
import { GRADES, IB_PYP_URL, PYP_THEMES, THEME_INFO, suggestionToText, type ProjectSuggestion, type TeacherNote } from '@/lib/teacher-issues';

type Form = { theme: string; id: string | null; title: string; body: string };
const today = () => { const d = new Date(); const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
const ibDescription = (theme: string) => (THEME_INFO as Record<string, { description: string } | undefined>)[theme]?.description ?? '';
const ibIcon = (theme: string) => (THEME_INFO as Record<string, { icon: string } | undefined>)[theme]?.icon ?? '✨';

export default function PypProjects() {
  const [grade, setGrade] = useState<number>(1);
  const [results, setResults] = useState<Record<string, ProjectSuggestion[]>>({});
  const [busy, setBusy] = useState('');
  const [mine, setMine] = useState<TeacherNote[]>([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState<Form | null>(null);
  const [editingDesc, setEditingDesc] = useState<string | null>(null);
  const [descDraft, setDescDraft] = useState('');
  const [pending, start] = useTransition();
  const { custom } = useCustomThemes();
  const { map: descriptions, set: setDescription } = useThemeDescriptions();
  const themes: string[] = [...PYP_THEMES, ...custom];
  const key = (theme: string) => `${grade}|${theme}`;
  const describe = (theme: string) => descriptions[theme] ?? ibDescription(theme);

  useEffect(() => { listTeacherNotes().then((n) => setMine(n.filter((x) => x.kind === 'project'))).catch(() => setError('Could not load your saved projects.')); }, []);

  const suggest = (theme: string) => {
    const k = key(theme);
    setBusy(k); setError('');
    start(async () => {
      const previous = results[k] ?? [];
      try {
        const s = await suggestProject({ grade, theme, description: describe(theme) || undefined, avoid: previous.map((p) => p.title) });
        setResults((r) => ({ ...r, [k]: [s, ...(r[k] ?? [])] }));
      } catch { setError('Could not get a suggestion. Try again.'); }
      finally { setBusy(''); }
    });
  };

  const saveForm = () => {
    if (!form) return;
    setError('');
    start(async () => {
      try {
        const input = { kind: 'project' as const, grade, theme: form.theme, title: form.title, body: form.body, noteDate: today(), source: 'typed' as const };
        if (form.id) { const note = await updateTeacherNote(form.id, input); setMine((l) => l.map((x) => (x.id === note.id ? note : x))); }
        else { const note = await addTeacherNote(input); setMine((l) => [note, ...l]); }
        setForm(null);
      } catch { setError('Could not save this project. Add a title and some text.'); }
    });
  };
  const removeProject = (id: string) => start(async () => { try { await deleteTeacherNote(id); setMine((l) => l.filter((x) => x.id !== id)); } catch { setError('Could not delete this project.'); } });

  const saveDescription = (theme: string) => { setDescription(theme, descDraft); setEditingDesc(null); };

  return <section className="panel ti-panel" aria-labelledby="ti-pyp">
    <div className="panel-title"><div className="panel-icon purple"><Sparkles size={19} /></div><div><h2 id="ti-pyp">PYP projects</h2><p>The six IB PYP transdisciplinary themes, plus any theme you added. Choose a grade, then press <strong>Suggest a project</strong>, or <strong>Add a project</strong> of your own. Use <strong>Edit</strong> to change a theme’s description.</p></div></div>
    <div className="ti-filters" role="tablist" aria-label="Grade">{GRADES.map((g) => <button key={g} role="tab" aria-selected={grade === g} className={`ti-pill${grade === g ? ' active' : ''}`} onClick={() => { setGrade(g); setForm(null); }}>Grade {g}</button>)}</div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="pyp-grid">{themes.map((theme) => {
      const k = key(theme), list = results[k] ?? [], current = list[0], loading = busy === k;
      const projects = mine.filter((p) => p.grade === grade && p.theme === theme);
      const showForm = form?.theme === theme;
      const isCustom = !(PYP_THEMES as readonly string[]).includes(theme);
      return <article className="pyp-card" key={theme}>
        <h3><span aria-hidden="true">{ibIcon(theme)}</span> {theme}</h3>
        {editingDesc === theme
          ? <div className="pyp-desc-edit">
            <textarea className="field-select" rows={5} maxLength={600} value={descDraft} aria-label={`Description of ${theme}`} onChange={(e) => setDescDraft(e.target.value)} />
            <div className="ti-actions">
              <button type="button" className="primary-btn" onClick={() => saveDescription(theme)}>Save</button>
              {!isCustom && descriptions[theme] !== undefined && <button type="button" className="outline-btn" onClick={() => { setDescription(theme, ''); setEditingDesc(null); }}>Back to IB text</button>}
              <button type="button" className="outline-btn" onClick={() => setEditingDesc(null)}>Cancel</button>
            </div>
          </div>
          : <><p className="pyp-desc">{describe(theme) || <em>No description yet.</em>}</p>
            <button type="button" className="text-link pyp-edit" onClick={() => { setEditingDesc(theme); setDescDraft(describe(theme)); }}><Pencil size={12} /> Edit description</button></>}
        <div className="pyp-buttons">
          <button type="button" className="primary-btn pyp-suggest" onClick={() => suggest(theme)} disabled={loading}><Sparkles size={15} /> {loading ? 'Thinking…' : current ? 'Suggest another' : 'Suggest a project'}</button>
          <button type="button" className="outline-btn" onClick={() => setForm({ theme, id: null, title: '', body: '' })}><Plus size={14} /> Add a project</button>
        </div>
        {showForm && form && <div className="pyp-form">
          <label><span className="field-label">Project title</span><input className="field-select" value={form.title} maxLength={160} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Nature Guardians garden game" /></label>
          <label><span className="field-label">Details</span><textarea className="field-select" rows={6} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="What the children do, central idea, lines of inquiry…" /></label>
          <div className="ti-actions"><button type="button" className="primary-btn" onClick={saveForm} disabled={pending || !form.title.trim() || !form.body.trim()}>{form.id ? 'Save changes' : 'Save project'}</button><button type="button" className="outline-btn" onClick={() => setForm(null)}>Cancel</button></div>
        </div>}
        {current && <div className="pyp-result" aria-live="polite">
          <small>{current.source === 'ai' ? `GRADE ${grade} SUGGESTION` : `GRADE ${grade} STARTER IDEA`}</small>
          <h4>{current.title}</h4>
          <p>{current.summary}</p>
          {current.centralIdea && <p><strong>Central idea:</strong> {current.centralIdea}</p>}
          {current.linesOfInquiry.length > 0 && <><strong>Lines of inquiry</strong><ul>{current.linesOfInquiry.map((l) => <li key={l}>{l}</li>)}</ul></>}
          {current.activities.length > 0 && <><strong>Activities</strong><ul>{current.activities.map((l) => <li key={l}>{l}</li>)}</ul></>}
          {current.studentAction && <p><strong>Student action:</strong> {current.studentAction}</p>}
          <button type="button" className="outline-btn" onClick={() => setForm({ theme, id: null, title: current.title, body: suggestionToText(current) })}><Pencil size={14} /> Edit &amp; save as my project</button>
        </div>}
        {projects.length > 0 && <div className="pyp-mine"><strong>My projects ({projects.length})</strong>
          <ul>{projects.map((p) => <li key={p.id}>
            <div><b>{p.title}</b><p>{p.body}</p></div>
            <div className="up-tools"><button type="button" className="outline-btn" onClick={() => setForm({ theme, id: p.id, title: p.title, body: p.body })}>Edit</button><button type="button" className="icon-btn" aria-label={`Delete ${p.title}`} onClick={() => removeProject(p.id)} disabled={pending}><Trash2 size={14} /></button></div>
          </li>)}</ul>
        </div>}
      </article>;
    })}</div>
    <p className="sa-hint">Themes and descriptions follow the IB’s PYP framework (<a href={IB_PYP_URL} target="_blank" rel="noreferrer">ibo.org <ExternalLink size={11} /></a>). Each school writes its own central ideas, so suggestions are starting points to adapt to your programme of inquiry. Projects you add are saved with your Teacher Issues notes.</p>
  </section>;
}
