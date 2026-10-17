'use client';

import { ChangeEvent, FormEvent, MouseEvent, useCallback, useEffect, useRef, useState } from 'react';
import { upload } from '@vercel/blob/client';
import { BookMarked, ExternalLink, FileText, Globe2, Maximize2, Minimize2, Plus, X, Lightbulb } from 'lucide-react';
import { bookrWeeks, isIssued, issueDate, latestFriday } from '@/lib/bookr-schedule';
import { readingAnswerBanks } from '@/lib/reading-answers';
import FlipbookPdf from './flipbook-pdf';

type SavedSite = { id: string; name: string; url: string };
type StoredMaterial = { id: string; name: string; file?: Blob; size: number };
type CloudMaterial = { name: string; size: number; updatedAt: string };
const STORAGE_KEY = 'ezgili-classroom-sites';
const MATERIAL_DB = 'ezgili-classroom-materials';
const MATERIAL_STORE = 'materials';
const BOOKR_START_KEY = 'ezgili-bookr-start-friday';
const MATERIAL_ID = 'shared-pdf';
const MATERIAL_PATH = 'classroom-materials/shared.pdf';

function readSites(): SavedSite[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (Array.isArray(parsed)) return parsed as SavedSite[];
    // Migrate the earlier classroom-specific list into one shared library.
    if (parsed && typeof parsed === 'object') {
      const values = Object.values(parsed as Record<string, SavedSite[]>).flat();
      return [...new Map(values.map((site) => [site.url, site])).values()];
    }
    return [];
  } catch {
    return [];
  }
}

function openMaterialDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(MATERIAL_DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(MATERIAL_STORE, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readMaterial(): Promise<StoredMaterial | null> {
  const db = await openMaterialDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(MATERIAL_STORE).objectStore(MATERIAL_STORE).get(MATERIAL_ID);
    request.onsuccess = () => { db.close(); resolve((request.result as StoredMaterial | undefined) || null); };
    request.onerror = () => { db.close(); reject(request.error); };
  });
}

async function saveMaterial(file: File): Promise<void> {
  const db = await openMaterialDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(MATERIAL_STORE, 'readwrite').objectStore(MATERIAL_STORE).put({ id: MATERIAL_ID, name: file.name, file, size: file.size } satisfies StoredMaterial);
    request.onsuccess = () => { db.close(); resolve(); };
    request.onerror = () => { db.close(); reject(request.error); };
  });
}

async function deleteMaterial(): Promise<void> {
  const db = await openMaterialDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(MATERIAL_STORE, 'readwrite').objectStore(MATERIAL_STORE).delete(MATERIAL_ID);
    request.onsuccess = () => { db.close(); resolve(); };
    request.onerror = () => { db.close(); reject(request.error); };
  });
}

function normalizeUrl(value: string): string | null {
  try {
    const trimmed = value.trim();
    const parsed = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : null;
  } catch {
    return null;
  }
}

function formatSize(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ClassroomSites() {
  const [sites, setSites] = useState<SavedSite[]>([]);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [activeSite, setActiveSite] = useState<SavedSite | null>(null);
  const [material, setMaterial] = useState<StoredMaterial | null>(null);
  const [materialIsCloud, setMaterialIsCloud] = useState(false);
  const [materialUrl, setMaterialUrl] = useState('');
  const [pdfPage, setPdfPage] = useState(1);
  const [pdfTotalPages, setPdfTotalPages] = useState(0);
  const [pdfPageInput, setPdfPageInput] = useState('1');
  const [pdfPageReady, setPdfPageReady] = useState(false);
  const [materialBusy, setMaterialBusy] = useState(false);
  const [materialProgress, setMaterialProgress] = useState(0);
  const [enlarged, setEnlarged] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [answerBankId, setAnswerBankId] = useState(readingAnswerBanks[0]?.id || '');
  const [revealedAnswers, setRevealedAnswers] = useState<Set<string>>(() => new Set());
  const [revealsReady, setRevealsReady] = useState(false);
  const [answerWindowBankId,setAnswerWindowBankId]=useState<string|null>(null);
  const [hub, setHub] = useState<'bookr' | 'pdf' | 'sites' | 'answers'>('bookr');
  const [bookrStart, setBookrStart] = useState('');
  const [bookrWeekOverrides, setBookrWeekOverrides] = useState<Record<number, boolean>>({});
  const viewerRef = useRef<HTMLElement | null>(null);
  const objectUrlRef = useRef('');

  const uploadToSite = useCallback(async (file: Blob, fileName: string) => {
    setMaterialBusy(true);
    setMaterialProgress(0);
    setError('');
    try {
      await upload(MATERIAL_PATH, file, {
        access: 'private',
        handleUploadUrl: '/api/classroom-material/upload',
        contentType: 'application/pdf',
        clientPayload: JSON.stringify({ fileName }),
        multipart: true,
        onUploadProgress: ({ percentage }) => setMaterialProgress(Math.round(percentage)),
      });
      const response = await fetch('/api/classroom-material/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName }),
      });
      const payload = await response.json() as { material?: CloudMaterial; error?: string };
      if (!response.ok || !payload.material) throw new Error(payload.error || 'Could not finish saving the PDF.');
      await deleteMaterial().catch(() => undefined);
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = '';
      setMaterial({ id: MATERIAL_ID, name: payload.material.name, size: payload.material.size });
      setMaterialIsCloud(true);
      setMaterialUrl('/api/classroom-material/file');
      setActiveSite(null);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? `${uploadError.message} Your saved PDF on this browser is still available.` : 'Could not save this PDF to the site. Your local copy is still available.');
    } finally {
      setMaterialBusy(false);
      setMaterialProgress(0);
    }
  }, []);

  useEffect(() => {
    try { const savedPage = Math.max(1, Number(localStorage.getItem('ezgili-classroom-pdf-page') || 1)); setPdfPage(savedPage); setPdfPageInput(String(savedPage)); } catch { /* start at page one */ }
    setPdfPageReady(true);
  }, []);
  useEffect(() => {
    if (!pdfPageReady) return;
    try { localStorage.setItem('ezgili-classroom-pdf-page', String(pdfPage)); } catch { /* bookmark is best effort */ }
    setPdfPageInput(String(pdfPage));
  }, [pdfPage, pdfPageReady]);
  useEffect(() => {
    try { const saved=JSON.parse(localStorage.getItem('ezgili-reading-reveals')||'[]'); if(Array.isArray(saved))setRevealedAnswers(new Set(saved.filter((item):item is string=>typeof item==='string'))); } catch { /* start with unrevealed answers */ }
    setRevealsReady(true);
  }, []);
  useEffect(() => {
    if(!revealsReady)return;
    try { localStorage.setItem('ezgili-reading-reveals',JSON.stringify([...revealedAnswers])); } catch { /* answer reveals remain available for this visit */ }
  }, [revealedAnswers,revealsReady]);
  const onPdfPageCount=useCallback((count:number)=>{setPdfTotalPages(count);setPdfPage(current=>Math.min(current,count));},[]);
  const goToPdfPage=useCallback((requestedPage:number)=>{const page=Math.max(1,Math.min(pdfTotalPages||9999,Math.floor(requestedPage)||1));setPdfPage(page);setPdfPageInput(String(page));},[pdfTotalPages]);

  useEffect(() => {
    setSites(readSites());
    try { setBookrStart(localStorage.getItem(BOOKR_START_KEY) || latestFriday()); } catch { setBookrStart(latestFriday()); }
    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setSites(readSites());
    };
    window.addEventListener('storage', handleStorage);
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch('/api/classroom-material', { cache: 'no-store' });
        if (response.ok) {
          const payload = await response.json() as { material: CloudMaterial | null };
          if (payload.material) {
            setMaterial({ id: MATERIAL_ID, name: payload.material.name, size: payload.material.size });
            setMaterialIsCloud(true);
            setMaterialUrl('/api/classroom-material/file');
            await deleteMaterial().catch(() => undefined);
            return;
          }
        }
      } catch { /* try an existing local PDF below */ }
      try {
        const saved = await readMaterial();
        if (!saved || cancelled || !saved.file) return;
        const blobUrl = URL.createObjectURL(saved.file);
        objectUrlRef.current = blobUrl;
        setMaterial(saved);
        setMaterialIsCloud(false);
        setMaterialUrl(blobUrl);
        // Move the existing one-time browser upload into shared private storage.
        void uploadToSite(saved.file, saved.name);
      } catch {
        if (!cancelled) setError('Could not open the saved PDF on this browser.');
      }
    })();
    return () => {
      cancelled = true;
      window.removeEventListener('storage', handleStorage);
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, [uploadToSite]);

  useEffect(() => {
    const syncFullscreen = () => setIsFullscreen(document.fullscreenElement === viewerRef.current);
    document.addEventListener('fullscreenchange', syncFullscreen);
    return () => document.removeEventListener('fullscreenchange', syncFullscreen);
  }, []);

  const changeBookrStart = (value: string) => {
    if (!value) return;
    setBookrStart(value);
    setBookrWeekOverrides({});
    try { localStorage.setItem(BOOKR_START_KEY, value); } catch { /* keep the choice for this visit only */ }
  };

  const saveSites = (next: SavedSite[]) => {
    setSites(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { setError('Could not save the shared website list in this browser.'); }
  };

  const addSite = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const safeUrl = normalizeUrl(url);
    if (!safeUrl) {
      setError('Enter a valid website address beginning with http:// or https://.');
      return;
    }
    const siteName = name.trim() || new URL(safeUrl).hostname.replace(/^www\./, '');
    const nextSite = { id: crypto.randomUUID(), name: siteName, url: safeUrl };
    saveSites([...sites, nextSite]);
    setName('');
    setUrl('');
    setError('');
    setMaterialUrl('');
    setActiveSite(nextSite);
  };

  const removeSite = (id: string) => {
    saveSites(sites.filter((site) => site.id !== id));
    if (activeSite?.id === id) setActiveSite(null);
  };

  const uploadPdf = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Choose a PDF file.');
      return;
    }
    if (file.size > 150 * 1024 * 1024) {
      setError('This PDF is over the 150 MB upload limit.');
      return;
    }
    await uploadToSite(file, file.name);
  };

  const removePdf = async () => {
    try {
      const response = await fetch('/api/classroom-material/delete', { method: 'DELETE' });
      if (!response.ok) throw new Error('Could not remove the shared PDF.');
      await deleteMaterial();
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = '';
      setMaterial(null);
      setMaterialIsCloud(false);
      setMaterialUrl('');
    } catch {
      setError('Could not remove the saved PDF from this browser.');
    }
  };

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await viewerRef.current?.requestFullscreen();
    } catch {
      setError('Full screen is unavailable in this browser. You can still enlarge the viewer panel.');
    }
  };

  const chooseSite = (site: SavedSite) => {
    setActiveSite(site);
    setMaterialUrl('');
    setError('');
  };

  const answerBank = readingAnswerBanks.find((bank) => bank.id === answerBankId) || readingAnswerBanks[0];
  const pdfExercise = readingAnswerBanks.find((bank) => bank.pdfPage === pdfPage);
  const answerWindowBank=readingAnswerBanks.find((bank)=>bank.id===answerWindowBankId);
  const openExercisePage = (event: MouseEvent<HTMLAnchorElement>, pdfPage: number) => {
    event.preventDefault();
    if (!material) {
      setError('Add the shared PDF first, then these links will jump to the matching exercise page.');
      document.querySelector('.classroom-material-add')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const source = materialIsCloud ? '/api/classroom-material/file' : (objectUrlRef.current || materialUrl.split('#')[0]);
    if (!source) return;
    setActiveSite(null);
    setHub('pdf');
    setMaterialUrl(source.split('#')[0]);
    goToPdfPage(pdfPage);
    window.setTimeout(() => viewerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };
  const toggleAnswer = (id: string) => setRevealedAnswers((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const exerciseIsFullyRevealed=(bank:typeof readingAnswerBanks[number])=>bank.answers.every((_,index)=>revealedAnswers.has(`${bank.id}-${index}`));
  const revealNextAnswer=(bank:typeof readingAnswerBanks[number])=>setRevealedAnswers(current=>{const next=new Set(current);const index=bank.answers.findIndex((_,i)=>!next.has(`${bank.id}-${i}`));if(index>=0)next.add(`${bank.id}-${index}`);return next;});
  const toggleAllAnswers=(bank:typeof readingAnswerBanks[number])=>setRevealedAnswers(current=>{const next=new Set(current);const hide=bank.answers.every((_,index)=>next.has(`${bank.id}-${index}`));bank.answers.forEach((_,index)=>{const id=`${bank.id}-${index}`;if(hide)next.delete(id);else next.add(id);});return next;});
  const revealAllAnswers=(bank:typeof readingAnswerBanks[number])=>setRevealedAnswers(current=>{const next=new Set(current);bank.answers.forEach((_,index)=>next.add(`${bank.id}-${index}`));return next;});
  const restartAnswerExercise=(bank:typeof readingAnswerBanks[number])=>setRevealedAnswers(current=>{const next=new Set(current);bank.answers.forEach((_,index)=>next.delete(`${bank.id}-${index}`));return next;});
  const allExerciseAnswersRevealed = Boolean(answerBank?.answers.length) && answerBank!.answers.every((_, index) => revealedAnswers.has(`${answerBank!.id}-${index}`));

  const viewerControls = <div className="classroom-site-controls">
    <button className="outline-btn" type="button" onClick={()=>setEnlarged((value)=>!value)} aria-pressed={enlarged}><Maximize2 size={15}/>{enlarged?'Normal size':'Enlarge panel'}</button>
    <button className="outline-btn" type="button" onClick={toggleFullscreen} aria-pressed={isFullscreen}>{isFullscreen?<Minimize2 size={15}/>:<Maximize2 size={15}/>} {isFullscreen?'Exit full screen':'Full screen'}</button>
  </div>;

  return (
    <div className="page-wrap alternate classroom-sites-page">
      <p className="eyebrow">YOUR READING HUB</p>
      <h1>Reading &amp; <em>resources</em></h1>
      <p className="subhead">BOOKR books, the anthology, websites and answer keys, all in one place.</p>
      <div className="hub-tiles" role="tablist">{([['bookr','📚','BOOKR books','Weekly Friday issue'],['pdf','📖','Anthology PDF','Shared material'],['sites','🌐','Websites','Saved classroom links'],['answers','💡','Answer reveal','Story answers']] as const).map(([id,icon,label,note])=><button key={id} role="tab" aria-selected={hub===id} className={`hub-tile ${hub===id?'active':''}`} onClick={()=>setHub(id)}><span className="hub-tile-icon" aria-hidden="true">{icon}</span><strong>{label}</strong><small>{note}</small></button>)}</div>

      {hub==='bookr'&&bookrStart&&<section id="bookr-panel" className="panel bookr-panel" aria-labelledby="bookr-title">
        <div className="panel-title"><div className="panel-icon coral"><BookMarked size={19}/></div><div><h2 id="bookr-title">BOOKR books · weekly issue</h2><p>New books are issued every Friday. Cambridge Primary Path 3 · Grade 4.</p></div></div>
        <label className="bookr-start"><span className="field-label">Week 1 issue Friday</span><input className="field-select" type="date" value={bookrStart} onChange={(event)=>changeBookrStart(event.target.value)}/></label>
        <div className="bookr-weeks">{bookrWeeks.map((entry)=>{
          const open=isIssued(bookrStart,entry.week);
          const expanded=Object.prototype.hasOwnProperty.call(bookrWeekOverrides,entry.week)?bookrWeekOverrides[entry.week]:open;
          const toggle=()=>setBookrWeekOverrides((current)=>({
            ...current,
            [entry.week]:!(Object.prototype.hasOwnProperty.call(current,entry.week)?current[entry.week]:open),
          }));
          const when=issueDate(bookrStart,entry.week).toLocaleDateString(undefined,{weekday:'long',month:'short',day:'numeric'});
          return <article key={entry.week} role="button" tabIndex={0} aria-expanded={expanded}
            onClick={toggle}
            onKeyDown={(event)=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();toggle();}}}
            className={`bookr-week ${open?'issued':'locked'}${expanded?' expanded':''}`}>
            <header><strong>Week {entry.week}</strong><span>{open?`Issued ${when}`:`Opens ${when}`}</span></header>
            <small>{entry.unit}</small>
            {expanded?<ul>{entry.books.map((book)=><li key={book}>{book}</li>)}</ul>:<p className="bookr-locked-note">{open?'Click to hide the book titles.':'Click to reveal the book titles.'}</p>}
          </article>;
        })}</div>
      </section>}

      {hub==='sites'&&<section className="panel classroom-site-add">
        <div className="panel-title"><div className="panel-icon purple"><Globe2 size={19}/></div><div><h2>Add a website</h2><p>Links you save here are shared across all classrooms on this browser.</p></div></div>
        <form className="classroom-site-form" onSubmit={addSite}>
          <label><span className="field-label">Website name <small>optional</small></span><input className="field-select" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Math games" maxLength={70}/></label>
          <label><span className="field-label">Website link</span><input className="field-select" type="text" inputMode="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com" required/></label>
          <button className="primary-btn" type="submit"><Plus size={16}/> Save and open</button>
        </form>
      </section>}

      {hub==='pdf'&&<section id="pdf-material" className="panel classroom-material-add">
        <div className="panel-title"><div className="panel-icon coral"><FileText size={19}/></div><div><h2>Shared PDF material</h2><p>Upload once and it stays in every classroom on every device. Read it here as a page-turning flipbook.</p></div></div>
        <div className="material-upload-row"><label className="outline-btn material-upload-label"><Plus size={16}/>{materialBusy?`Saving PDF… ${materialProgress}%`:material?'Replace PDF material':'Add a PDF'}<input type="file" accept="application/pdf,.pdf" onChange={uploadPdf} disabled={materialBusy}/></label>{materialBusy&&<progress className="material-upload-progress" max="100" value={materialProgress} aria-label="PDF upload progress"/>}{material&&<div className="material-current"><FileText size={16}/><span><strong>{material.name}</strong><small>{formatSize(material.size)} · {materialIsCloud?'Shared securely across classrooms and devices':'Saved on this browser; moving it to shared storage…'}</small></span><button type="button" className="outline-btn material-open" onClick={()=>{setActiveSite(null);setMaterialUrl(objectUrlRef.current||'/api/classroom-material/file')}}>Open PDF</button><button type="button" className="material-remove" onClick={removePdf} aria-label="Remove PDF material">Remove</button></div>}</div>
      </section>}

      {error&&<p className="form-error classroom-sites-error" role="alert">{error}</p>}

      {hub==='sites'&&sites.length>0&&<section className="classroom-saved-sites" aria-label="Shared saved websites">
        <div className="section-heading compact"><div><h2>Your saved websites</h2><p>Open a saved site in any classroom.</p></div></div>
        <div className="classroom-site-list">{sites.map((site)=><div className={`classroom-site-chip ${activeSite?.id===site.id?'selected':''}`} key={site.id}>
          <button className="classroom-site-open" type="button" onClick={()=>chooseSite(site)}><Globe2 size={17}/><span><strong>{site.name}</strong><small>{new URL(site.url).hostname}</small></span></button>
          <button className="classroom-site-remove icon-btn" type="button" aria-label={`Remove ${site.name}`} title={`Remove ${site.name}`} onClick={()=>removeSite(site.id)}><X size={15}/></button>
        </div>)}</div>
      </section>}

      {hub==='sites'&&activeSite&&<section ref={viewerRef} className={`classroom-site-viewer ${enlarged?'enlarged':''} ${isFullscreen?'fullscreen':''}`} aria-label={`${activeSite.name} embedded website`}>
        <header className="classroom-site-viewer-head"><div className="classroom-site-viewer-title"><Globe2 size={18}/><div><strong>{activeSite.name}</strong><small>{activeSite.url}</small></div></div><div className="classroom-site-controls">{viewerControls}<a className="outline-btn" href={activeSite.url} target="_blank" rel="noreferrer"><ExternalLink size={15}/> Open in new tab</a><button className="icon-btn" type="button" aria-label="Close website" onClick={()=>setActiveSite(null)}><X size={18}/></button></div></header>
        <iframe key={activeSite.id} className="classroom-site-frame" src={activeSite.url} title={`${activeSite.name} website`} allow="fullscreen; autoplay" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-presentation"/>
        <p className="classroom-site-note">If the frame stays blank, this website may block embedding. Try <a href={activeSite.url} target="_blank" rel="noreferrer">opening it in a new tab</a>.</p>
      </section>}

      {hub==='pdf'&&material&&materialUrl&&<section ref={viewerRef} className={`classroom-site-viewer ${enlarged?'enlarged':''} ${isFullscreen?'fullscreen':''}`} aria-label={`${material.name} PDF viewer`}>
        <header className="classroom-site-viewer-head"><div className="classroom-site-viewer-title"><FileText size={18}/><div><strong>{material.name}</strong><small>{formatSize(material.size)} · Page {pdfPage}{pdfTotalPages?` of ${pdfTotalPages}`:''} · bookmark saved</small></div></div><div className="pdf-page-controls" aria-label="Saved PDF page controls"><button type="button" className="outline-btn" onClick={()=>goToPdfPage(pdfPage-1)} aria-label="Previous page">‹</button><label><span>Page</span><input type="number" min="1" max={pdfTotalPages||9999} value={pdfPageInput} aria-label="PDF page number" onChange={event=>setPdfPageInput(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'){goToPdfPage(Number(pdfPageInput));}}}/><button type="button" className="outline-btn" onClick={()=>goToPdfPage(Number(pdfPageInput))}>Go</button></label><button type="button" className="outline-btn" onClick={()=>goToPdfPage(pdfPage+1)} aria-label="Next page">›</button></div><a className="outline-btn material-open" href={`${materialUrl}#page=${pdfPage}`} target="_blank" rel="noreferrer"><ExternalLink size={15}/> Open in browser tab</a>{viewerControls}<button className="icon-btn" type="button" aria-label="Close PDF" onClick={()=>setMaterialUrl('')}><X size={18}/></button></header>
        <FlipbookPdf key={materialUrl} src={materialUrl} page={pdfPage} onPageCount={onPdfPageCount} onPageChange={goToPdfPage} exerciseAction={pdfExercise?<button type="button" className="pdf-exercise-arrow" aria-label={`Open answers for ${pdfExercise.title}, exercise page ${pdfExercise.printedPage}`} title="Open exercise answers" onClick={()=>setAnswerWindowBankId(pdfExercise.id)}>➜</button>:undefined}/>
        {answerWindowBank&&<div className="answer-window-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setAnswerWindowBankId(null)}}><section className="answer-window" role="dialog" aria-modal="true" aria-labelledby="answer-window-title"><header className="answer-window-bar"><span>📖 Exercise answer reveal</span><button type="button" aria-label="Close answer window" onClick={()=>setAnswerWindowBankId(null)}>×</button></header><div className="answer-window-body"><p className="eyebrow">UNIT {answerWindowBank.unit} · STUDENT BOOK PAGE {answerWindowBank.printedPage}</p><h2 id="answer-window-title">{answerWindowBank.title}</h2><p className="answer-window-help">Reveal answers one at a time, or show every answer in this exercise.</p><div className="answer-window-list">{answerWindowBank.answers.map((item,index)=>{const id=`${answerWindowBank.id}-${index}`;const open=revealedAnswers.has(id);return <article className={open?'is-revealed':''} key={id}><span>{index+1}</span><div><strong>{item.prompt}</strong>{open?<p><b>{item.matching?'Answer line':'Answer'}:</b> {item.answer}</p>:<small>Answer hidden</small>}</div></article>})}</div></div><footer className="answer-window-actions"><button type="button" className="answer-window-next" disabled={exerciseIsFullyRevealed(answerWindowBank)} onClick={()=>revealNextAnswer(answerWindowBank)}>Show next answer</button><button type="button" className="answer-window-all" onClick={()=>revealAllAnswers(answerWindowBank)}>Show all answers</button><button type="button" className="answer-window-restart" onClick={()=>restartAnswerExercise(answerWindowBank)}>↺ Start again</button></footer></section></div>}
        <p className="classroom-site-note">The last page is saved in this browser, even after you close the site. Use the page controls to update the shared bookmark before switching activities.</p>
      </section>}

      {hub==='answers'&&<section className="panel answer-reveal-panel" aria-labelledby="answer-reveal-title">
        <div className="answer-reveal-heading"><div className="panel-icon purple"><Lightbulb size={19}/></div><div><p className="eyebrow">READ, THINK, THEN REVEAL</p><h2 id="answer-reveal-title">Story answer reveal</h2><p>Reveal answers individually or show all answers for the selected exercise. Matching answers show the complete line.</p></div></div>
        <label className="answer-reveal-select"><span className="field-label">Reading</span><select className="field-select" value={answerBank?.id || ''} onChange={(event)=>setAnswerBankId(event.target.value)}>{readingAnswerBanks.map((bank)=><option key={bank.id} value={bank.id}>Unit {bank.unit} · {bank.kind} · {bank.title} · Exercise p. {bank.printedPage}</option>)}</select></label>
        {answerBank&&<><div className="answer-reveal-meta"><strong>Exercises: Student Book p. {answerBank.printedPage}</strong><span>PDF page {answerBank.pdfPage} · {answerBank.answers.length} answer reveals</span></div><div className="answer-reveal-tools"><div className="answer-reveal-sequential"><button type="button" className="fun-action secondary answer-reveal-all-button" disabled={!answerBank||allExerciseAnswersRevealed} onClick={()=>answerBank&&revealNextAnswer(answerBank)}>Reveal next answer</button><small>{answerBank?.answers.filter((_,index)=>revealedAnswers.has(`${answerBank.id}-${index}`)).length||0} of {answerBank?.answers.length||0} revealed</small></div><button type="button" className="fun-action secondary answer-reveal-all-button" aria-controls="answer-reveal-list" aria-expanded={allExerciseAnswersRevealed} onClick={()=>answerBank&&toggleAllAnswers(answerBank)}>{allExerciseAnswersRevealed?'Hide all answers in this exercise':'Reveal all answers in this exercise'}</button></div><div id="answer-reveal-list" className="answer-reveal-list">{answerBank.answers.map((item,index)=>{const id=`${answerBank.id}-${index}`;const isRevealed=revealedAnswers.has(id);return <article className={`answer-reveal-item ${isRevealed?'is-revealed':''}`} key={id}><div className="answer-reveal-question"><span className="answer-reveal-number">{index+1}</span><div><p>{item.prompt}</p><a className="answer-reveal-pdf-link" href={material ? `${materialIsCloud?'/api/classroom-material/file':objectUrlRef.current}#page=${answerBank.pdfPage}` : '#pdf-material'} onClick={(event)=>openExercisePage(event,answerBank.pdfPage)}>Student Book p. {answerBank.printedPage} · Open in PDF</a></div></div><button type="button" className="fun-action secondary answer-reveal-button" aria-expanded={isRevealed} onClick={()=>toggleAnswer(id)}>{isRevealed?'Hide answer':'View answer'}</button>{isRevealed&&<p className={`answer-reveal-answer ${item.matching?'matching-answer':''}`}><strong>{item.matching?'Answer line':'Answer'}:</strong> {item.answer}</p>}</article>})}</div></>}
      </section>}
    </div>
  );
}
