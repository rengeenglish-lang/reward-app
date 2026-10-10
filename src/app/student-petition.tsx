'use client';

import { useEffect, useState } from 'react';
import { FileText, Printer, Copy } from 'lucide-react';
import { PURPOSES, RECIPIENTS, buildPetition, type Purpose, type Recipient } from '@/lib/petition';
import type { BehaviourSummary, StudentEntry } from '@/lib/student-analysis';

const SAVED = 'ezgili-petition-details';
const todayIso = () => { const d = new Date(); const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };

/** Writes a formal Turkish dilekçe from a student's analysis, addressed to the student counsellor and/or the principal. */
export default function StudentPetition({ studentName, classroom, summary, entries }: { studentName: string; classroom: string; summary: BehaviourSummary | null; entries: StudentEntry[] }) {
  const [open, setOpen] = useState(false);
  const [recipient, setRecipient] = useState<Recipient>('counsellor');
  const [purpose, setPurpose] = useState<Purpose>('support');
  const [school, setSchool] = useState('');
  const [teacher, setTeacher] = useState('');
  const [text, setText] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try { const saved = JSON.parse(localStorage.getItem(SAVED) || '{}') as { school?: string; teacher?: string }; setSchool(saved.school || ''); setTeacher(saved.teacher || ''); } catch { /* start empty */ }
  }, []);
  useEffect(() => { setText(''); setOpen(false); }, [studentName]);

  const remember = (next: { school: string; teacher: string }) => { try { localStorage.setItem(SAVED, JSON.stringify(next)); } catch { /* storage can be blocked */ } };
  const generate = () => setText(buildPetition({ recipient, purpose, school, teacher, date: todayIso(), studentName, classroom, summary, entries }));
  const copy = async () => { try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* clipboard blocked */ } };
  const print = () => {
    document.body.classList.add('printing-petition');
    const done = () => { document.body.classList.remove('printing-petition'); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    window.print();
  };

  return (
    <section className="sa-petition" aria-label="Dilekçe">
      <button type="button" className="outline-btn" aria-expanded={open} onClick={() => { setOpen(!open); }}><FileText size={15} /> {open ? 'Hide dilekçe' : 'Write a dilekçe'}</button>
      {open && (
        <div className="sa-petition-box">
          <p className="sa-hint">Writes a formal Turkish dilekçe about {studentName} from the observations and daily checklist results above. Edit the text before you print or copy it.</p>
          <div className="ti-form">
            <label><span className="field-label">Address to</span><select className="field-select" value={recipient} onChange={(e) => setRecipient(e.target.value as Recipient)}>{RECIPIENTS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</select></label>
            <label><span className="field-label">Purpose</span><select className="field-select" value={purpose} onChange={(e) => setPurpose(e.target.value as Purpose)}>{PURPOSES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</select></label>
            <label><span className="field-label">School name <small>optional</small></span><input className="field-select" value={school} maxLength={80} placeholder="e.g. Atatürk İlkokulu" onChange={(e) => { setSchool(e.target.value); remember({ school: e.target.value, teacher }); }} /></label>
            <label><span className="field-label">Your name <small>optional</small></span><input className="field-select" value={teacher} maxLength={80} placeholder="Ad Soyad" onChange={(e) => { setTeacher(e.target.value); remember({ school, teacher: e.target.value }); }} /></label>
          </div>
          <div className="ti-actions"><button type="button" className="primary-btn" onClick={generate}>{text ? 'Write it again' : 'Write the dilekçe'}</button></div>
          {text && (
            <>
              <textarea className="field-select sa-petition-text" rows={18} value={text} onChange={(e) => setText(e.target.value)} aria-label="Dilekçe text" />
              <div className="ti-actions">
                <button type="button" className="primary-btn" onClick={print}><Printer size={15} /> Print</button>
                <button type="button" className="outline-btn" onClick={copy}><Copy size={15} /> {copied ? 'Copied!' : 'Copy text'}</button>
              </div>
              <div className="petition-sheet" aria-hidden="true">{text}</div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
