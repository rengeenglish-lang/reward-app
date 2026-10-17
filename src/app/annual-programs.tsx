'use client';

import { ChangeEvent, useEffect, useState, useTransition } from 'react';
import { upload } from '@vercel/blob/client';
import { CalendarDays, Camera, ExternalLink, Plus, Trash2 } from 'lucide-react';
import { createAnnualProgram, deleteAnnualProgram, getAnnualProgramUploadPath, listAnnualPrograms, type AnnualProgram } from './annual-program-actions';

type EventDraft = { dateLabel: string; gradeLevel: string; activity: string; location: string };
const blankEvent = (): EventDraft => ({ dateLabel: '', gradeLevel: '', activity: '', location: '' });
const SOURCE_PROGRAM: AnnualProgram = {
  id: 'english-department-2026-2027',
  academic_year: '2026-2027',
  title: 'English Department Activity Calendar',
  image_url: '', file_name: '', file_size: 0, created_at: '',
  events: [
    { id: 'source-01', position: 0, date_label: '22 EYLÜL', grade_level: 'Ana sınıfı + İlkokul', activity: 'Avrupa Dilleri Günü', location: 'Ana sınıfı ön bahçe ve Futbol Sahası' },
    { id: 'source-02', position: 1, date_label: '26 EYLÜL', grade_level: 'Ortaokul', activity: 'Avrupa Dilleri Günü', location: 'Futbol Sahası' },
    { id: 'source-03', position: 2, date_label: '3 EKİM', grade_level: 'İlkokul 3/4 / Ortaokul 5/6. sınıflar', activity: 'ESOL SINAVI', location: 'Konferans Salonu, Kütüphane ve 3. Kat dersliklerin tamamı' },
    { id: 'source-04', position: 3, date_label: 'KASIM', grade_level: 'Ana sınıfı', activity: 'Very Hungry Caterpillar', location: 'Konferans Salonu' },
    { id: 'source-05', position: 4, date_label: 'KASIM', grade_level: 'Ortaokul', activity: 'The Voice', location: 'Konferans Salonu' },
    { id: 'source-06', position: 5, date_label: 'ARALIK', grade_level: 'İlkokul + Ortaokul', activity: 'Quiz Show', location: 'Konferans Salonu' },
    { id: 'source-07', position: 6, date_label: 'OCAK', grade_level: 'Ana sınıfı + İlkokul (1. Sınıflar)', activity: 'Okulun 100. günü', location: 'Okulun çeşitli alanları' },
    { id: 'source-08', position: 7, date_label: 'ŞUBAT', grade_level: 'Ana sınıfı + İlkokul + Ortaokul', activity: 'Bookweek', location: 'Okulun çeşitli alanları' },
    { id: 'source-09', position: 8, date_label: 'NİSAN', grade_level: 'Ana sınıfı + İlkokul + Ortaokul', activity: 'Jeans for Jeans Day', location: '—' },
    { id: 'source-10', position: 9, date_label: 'MAYIS', grade_level: 'İlkokul 3/4 / Ortaokul 5/6. sınıflar', activity: 'ESOL SINAVI', location: 'Konferans Salonu, Kütüphane ve 3. Kat dersliklerin tamamı' },
    { id: 'source-11', position: 10, date_label: 'HAZİRAN', grade_level: 'Ana sınıfı', activity: 'Beach Day', location: 'Atakum Sahili' },
    { id: 'source-12', position: 11, date_label: 'HAZİRAN', grade_level: 'İlkokul', activity: 'Forest Day', location: 'Kent Ormanı veya Çakırlar Korusu' },
    { id: 'source-13', position: 12, date_label: 'HAZİRAN', grade_level: 'Ortaokul', activity: '—', location: '—' },
  ],
};

const sizeLabel = (size: number) => size < 1024 * 1024 ? `${Math.round(size / 1024)} KB` : `${(size / (1024 * 1024)).toFixed(1)} MB`;

export default function AnnualPrograms() {
  const [programs, setPrograms] = useState<AnnualProgram[]>([]);
  const [year, setYear] = useState('2027-2028');
  const [title, setTitle] = useState('English Department Activity Calendar');
  const [events, setEvents] = useState<EventDraft[]>([blankEvent()]);
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
  const editEvent = (index: number, patch: Partial<EventDraft>) => setEvents((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));

  const save = () => {
    setError(''); setStatus('');
    const normalizedYear = year.trim().replace(/[–/]/g, '-');
    if (!/^\d{4}-\d{4}$/.test(normalizedYear)) { setError('Enter a school year like 2027-2028.'); return; }
    if (!title.trim()) { setError('Add a name for this program.'); return; }
    if (!file) { setError('Choose a picture of the yearly program.'); return; }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setError('Use a JPEG, PNG or WebP image.'); return; }
    if (file.size > 15 * 1024 * 1024) { setError('Images must be 15 MB or smaller.'); return; }
    const cleanEvents = events.filter((row) => row.dateLabel.trim() && row.gradeLevel.trim() && row.activity.trim() && row.location.trim());
    if (!cleanEvents.length) { setError('Add at least one complete program row: date, grade, activity and location.'); return; }

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
        const saved = await createAnnualProgram({ id, academicYear: normalizedYear, title: title.trim(), fileName: safeName, events: cleanEvents });
        setPrograms((items) => [saved, ...items].sort((a, b) => b.academic_year.localeCompare(a.academic_year) || b.created_at.localeCompare(a.created_at)));
        setYear(`${Number(normalizedYear.slice(5))}-${Number(normalizedYear.slice(5)) + 1}`);
        setTitle('English Department Activity Calendar'); setEvents([blankEvent()]); setFile(null);
        const input = document.getElementById('annual-program-image') as HTMLInputElement | null;
        if (input) input.value = '';
        setStatus(`${normalizedYear} program saved with ${cleanEvents.length} activities.`);
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

  const renderProgram = (program: AnnualProgram, isSource = false) => <article className="annual-program-card" key={program.id}>
    <div className="annual-program-card-head"><div><span className="annual-program-year">{program.academic_year}</span><h3>{program.title}</h3>{isSource && <small>Transcribed from the English department calendar you shared.</small>}</div>{!isSource && <button className="icon-btn" type="button" aria-label={`Delete ${program.academic_year} program`} onClick={() => remove(program)} disabled={busy}><Trash2 size={16} /></button>}</div>
    <div className="annual-program-table-scroll"><table className="annual-program-table"><thead><tr><th>Month / date</th><th>Grade level</th><th>Activity</th><th>Location</th></tr></thead><tbody>{program.events.map((event) => <tr key={event.id}><td>{event.date_label}</td><td>{event.grade_level || '—'}</td><td>{event.activity || '—'}</td><td>{event.location || '—'}</td></tr>)}</tbody></table></div>
    {!isSource && <a className="annual-program-source-link" href={program.image_url} target="_blank" rel="noreferrer"><ExternalLink size={14} /> View uploaded picture · {program.file_name} · {sizeLabel(program.file_size)}</a>}
  </article>;

  return <section className="panel ti-panel annual-program-panel" aria-labelledby="annual-program-title">
    <div className="panel-title"><div className="panel-icon coral"><CalendarDays size={19} /></div><div><h2 id="annual-program-title">English department yearly programs</h2><p>See each year’s activities in a clear table. The 2026–2027 program below is transcribed from your picture; future years can be added with their source picture and activity rows.</p></div></div>
    <div className="annual-programs-list">{renderProgram(SOURCE_PROGRAM, true)}{programs.map((program) => renderProgram(program))}</div>
    <details className="annual-program-add"><summary><Plus size={16} /> Add a future yearly program</summary>
      <div className="annual-program-form">
        <label><span className="field-label">School year</span><input className="field-select" inputMode="numeric" value={year} onChange={(event) => setYear(event.target.value)} placeholder="2027-2028" aria-label="School year" maxLength={9} /></label>
        <label className="annual-program-title-field"><span className="field-label">Program name</span><input className="field-select" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} aria-label="Program name" /></label>
        <label className="outline-btn ti-photo annual-program-file"><Camera size={15} />{file ? file.name : 'Choose program picture'}<input id="annual-program-image" type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseImage} aria-label="Choose yearly program picture" /></label>
      </div>
      <div className="annual-program-editor-head"><div><h3>Program activities</h3><p>Enter each row from the program picture. Use month names or exact dates.</p></div><button type="button" className="outline-btn" onClick={() => setEvents((rows) => [...rows, blankEvent()])}><Plus size={14} /> Add row</button></div>
      <div className="annual-program-event-editor"><div className="annual-program-event-labels"><span>Month / date</span><span>Grade level</span><span>Activity</span><span>Location</span><span aria-hidden="true" /></div>
        {events.map((row, index) => <div className="annual-program-event-row" key={index}>
          <input className="field-select" aria-label={`Activity ${index + 1} month or date`} value={row.dateLabel} onChange={(event) => editEvent(index, { dateLabel: event.target.value })} placeholder="E.g. September / 22 Sep" maxLength={40} />
          <input className="field-select" aria-label={`Activity ${index + 1} grade level`} value={row.gradeLevel} onChange={(event) => editEvent(index, { gradeLevel: event.target.value })} placeholder="Grade levels" maxLength={160} />
          <input className="field-select" aria-label={`Activity ${index + 1} name`} value={row.activity} onChange={(event) => editEvent(index, { activity: event.target.value })} placeholder="Activity" maxLength={200} />
          <input className="field-select" aria-label={`Activity ${index + 1} location`} value={row.location} onChange={(event) => editEvent(index, { location: event.target.value })} placeholder="Location" maxLength={240} />
          <button className="icon-btn" type="button" aria-label={`Remove activity row ${index + 1}`} onClick={() => setEvents((rows) => rows.filter((_, rowIndex) => rowIndex !== index))}><Trash2 size={15} /></button>
        </div>)}
      </div>
      <div className="ti-actions"><button type="button" className="primary-btn" onClick={save} disabled={busy || uploading}><Plus size={15} />{uploading ? 'Saving program…' : 'Save yearly program'}</button></div>
    </details>
    {status && <p className="annual-program-status" role="status">{status}</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </section>;
}
