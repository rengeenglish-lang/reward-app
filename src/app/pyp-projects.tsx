'use client';

import { useState, useTransition } from 'react';
import { ExternalLink, Plus, Sparkles } from 'lucide-react';
import { suggestProject } from './pyp-projects-actions';
import { GRADES, IB_PYP_URL, PYP_THEMES, THEME_INFO, suggestionToText, type ProjectSuggestion } from '@/lib/teacher-issues';

type Draft = { kind: 'project'; grade: number; theme: string; title: string; body: string; date: string; source: 'typed' };
const today = () => { const d = new Date(); const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };

export default function PypProjects({ onSave }: { onSave: (d: Draft) => void }) {
  const [grade, setGrade] = useState<number>(1);
  const [results, setResults] = useState<Record<string, ProjectSuggestion[]>>({});
  const [busy, setBusy] = useState('');
  const [, start] = useTransition();
  const key = (theme: string) => `${grade}|${theme}`;

  const suggest = (theme: (typeof PYP_THEMES)[number]) => {
    const k = key(theme);
    setBusy(k);
    start(async () => {
      const previous = results[k] ?? [];
      try {
        const s = await suggestProject({ grade, theme, avoid: previous.map((p) => p.title) });
        setResults((r) => ({ ...r, [k]: [s, ...(r[k] ?? [])] }));
      } finally { setBusy(''); }
    });
  };

  return <section className="panel ti-panel" aria-labelledby="ti-pyp">
    <div className="panel-title"><div className="panel-icon purple"><Sparkles size={19} /></div><div><h2 id="ti-pyp">PYP projects</h2><p>The six IB PYP transdisciplinary themes, which every PYP school in Turkey plans around for each grade. Choose a grade, then press <strong>Suggest a project</strong> on a theme.</p></div></div>
    <div className="ti-filters" role="tablist" aria-label="Grade">{GRADES.map((g) => <button key={g} role="tab" aria-selected={grade === g} className={`ti-pill${grade === g ? ' active' : ''}`} onClick={() => setGrade(g)}>Grade {g}</button>)}</div>
    <div className="pyp-grid">{PYP_THEMES.map((theme) => {
      const k = key(theme), list = results[k] ?? [], current = list[0], loading = busy === k;
      return <article className="pyp-card" key={theme}>
        <h3><span aria-hidden="true">{THEME_INFO[theme].icon}</span> {theme}</h3>
        <p className="pyp-desc">{THEME_INFO[theme].description}</p>
        <button type="button" className="primary-btn pyp-suggest" onClick={() => suggest(theme)} disabled={loading}><Sparkles size={15} /> {loading ? 'Thinking…' : current ? 'Suggest another' : 'Suggest a project'}</button>
        {current && <div className="pyp-result" aria-live="polite">
          <small>{current.source === 'ai' ? `GRADE ${grade} SUGGESTION` : `GRADE ${grade} STARTER IDEA`}</small>
          <h4>{current.title}</h4>
          <p>{current.summary}</p>
          {current.centralIdea && <p><strong>Central idea:</strong> {current.centralIdea}</p>}
          {current.linesOfInquiry.length > 0 && <><strong>Lines of inquiry</strong><ul>{current.linesOfInquiry.map((l) => <li key={l}>{l}</li>)}</ul></>}
          {current.activities.length > 0 && <><strong>Activities</strong><ul>{current.activities.map((l) => <li key={l}>{l}</li>)}</ul></>}
          {current.studentAction && <p><strong>Student action:</strong> {current.studentAction}</p>}
          <button type="button" className="outline-btn" onClick={() => onSave({ kind: 'project', grade, theme, title: current.title, body: suggestionToText(current), date: today(), source: 'typed' })}><Plus size={14} /> Save as project note</button>
        </div>}
      </article>;
    })}</div>
    <p className="sa-hint">Themes and descriptions follow the IB’s PYP framework (<a href={IB_PYP_URL} target="_blank" rel="noreferrer">ibo.org <ExternalLink size={11} /></a>). Each school writes its own central ideas, so suggestions are starting points to adapt to your programme of inquiry.</p>
  </section>;
}
