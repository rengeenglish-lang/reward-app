'use client';

import { ChangeEvent, useEffect, useState, useTransition } from 'react';
import { upload } from '@vercel/blob/client';
import { CalendarDays, Camera, ExternalLink, Plus, Trash2 } from 'lucide-react';
import { createAnnualProgram, deleteAnnualProgram, getAnnualProgramUploadPath, listAnnualPrograms, type AnnualProgram } from './annual-program-actions';

const REFERENCE_PROGRAM: AnnualProgram = {
  id: 'reference-english-program-2026-2027',
  academic_year: '2026-2027',
  title: 'English Department Activity Calendar',
  image_url: '/english-department-2026-2027.jpeg',
  file_name: 'English Department Activity Calendar.jpeg',
  file_size: 267790,
  created_at: '2026-10-10T00:00:00Z',
};

const sizeLabel = (size: number) => size < 1024 * 1024 ? `${Math.round(size / 1024)} KB` : `${(size / (1024 * 1024)).toFixed(1)} MB`;

export default function AnnualPrograms() {
  const [programs, setPrograms] = useState<AnnualProgram[]>([]);
  const [year, setYear] = useState('2027-2028');
  const [title, setTitle] = useState('English Department Activity Calendar');
  const [file, setFile] = useState<File | null>(null);
  const [busy, start] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => { listAnnualPrograms().then(setPrograms).catch(() => setError('Could not load saved yearly programs.')); }, []);

  const chooseImage = (event: ChangeEvent<HTMLInputElement>) => {
    setFile(event.target.files?.[0] ?? null);
    setError(''); setStatus('');
  };

  const save = () => {
    setError(''); setStatus('');
    const normalizedYear = year.trim().replace(/[–/]/g, '-');
    if (!/^\d{4}-\d{4}$/.test(normalizedYear)) { setError('Enter a school year like 2027-2028.'); return; }
    if (!title.trim()) { setError('Add a name for this program.'); return; }
    if (!file) { setError('Choose a picture of the yearly program.'); return; }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setError('Use a JPEG, PNG or WebP image.'); return; }
    if (file.size > 15 * 1024 * 1024) { setError('Images must be 15 MB or smaller.'); return; }

    start(async () => {
      const id = crypto.randomUUID();
      let safeName = file.name.split(/[\\/]/).pop() || 'program-image';
      if (!/\.(jpg|jpeg|png|webp)$/i.test(safeName)) safeName += `.${file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'}`;
      setUploading(true);
      try {
        const path = await getAnnualProgramUploadPath(id, safeName);
        await upload(path, file, {
          access: 'private',
          handleUploadUrl: '/api/annual-programs/upload',
          contentType: file.type,
          clientPayload: JSON.stringify({ id, fileName: safeName }),
          multipart: true,
        });
        const saved = await createAnnualProgram({ id, academicYear: normalizedYear, title: title.trim(), fileName: safeName });
        setPrograms((items) => [saved, ...items].sort((a, b) => b.academic_year.localeCompare(a.academic_year) || b.created_at.localeCompare(a.created_at)));
        setYear(`${Number(normalizedYear.slice(5))}-${Number(normalizedYear.slice(5)) + 1}`);
        setTitle('English Department Activity Calendar'); setFile(null);
        const input = document.getElementById('annual-program-image') as HTMLInputElement | null;
        if (input) input.value = '';
        setStatus(`${normalizedYear} program saved.`);
      } catch (uploadError) {
        setError(uploadError instanceof Error ? uploadError.message : 'Could not save this yearly program.');
      } finally { setUploading(false); }
    });
  };

  const remove = (program: AnnualProgram) => {
    setError(''); setStatus('');
    start(async () => {
      try { await deleteAnnualProgram(program.id); setPrograms((items) => items.filter((item) => item.id !== program.id)); }
      catch { setError(`Could not remove “${program.title}”.`); }
    });
  };

  const cards = [REFERENCE_PROGRAM, ...programs];

  return <section className="panel ti-panel annual-program-panel" aria-labelledby="annual-program-title">
    <div className="panel-title"><div className="panel-icon coral"><CalendarDays size={19} /></div><div><h2 id="annual-program-title">English department yearly programs</h2><p>Keep each school year’s activity program in one place. Upload a picture now and add future years whenever they are ready.</p></div></div>
    <div className="annual-program-form">
      <label><span className="field-label">School year</span><input className="field-select" inputMode="numeric" value={year} onChange={(event) => setYear(event.target.value)} placeholder="2027-2028" aria-label="School year" maxLength={9} /></label>
      <label className="annual-program-title-field"><span className="field-label">Program name</span><input className="field-select" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} aria-label="Program name" /></label>
      <label className="outline-btn ti-photo annual-program-file"><Camera size={15} />{file ? file.name : 'Choose program picture'}<input id="annual-program-image" type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseImage} aria-label="Choose yearly program picture" /></label>
      <button type="button" className="primary-btn" onClick={save} disabled={busy || uploading}><Plus size={15} />{uploading ? 'Saving picture…' : 'Add yearly program'}</button>
    </div>
    {status && <p className="annual-program-status" role="status">{status}</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="annual-program-grid" aria-label="Saved yearly programs">
      {cards.map((program, index) => <article className="annual-program-card" key={program.id}>
        <div className="annual-program-card-head"><div><span className="annual-program-year">{program.academic_year}</span><h3>{program.title}</h3></div>{index > 0 && <button className="icon-btn" type="button" aria-label={`Delete ${program.academic_year} program`} onClick={() => remove(program)} disabled={busy}><Trash2 size={16} /></button>}</div>
        <a className="annual-program-image-link" href={program.image_url} target="_blank" rel="noreferrer" aria-label={`Open ${program.academic_year} program picture`}><img src={program.image_url} alt={`${program.title}, ${program.academic_year}`} loading={index === 0 ? 'eager' : 'lazy'} /><span><ExternalLink size={15} /> Open full picture</span></a>
        <p className="annual-program-file-meta">{program.file_name} · {sizeLabel(program.file_size)}</p>
      </article>)}
    </div>
  </section>;
}
