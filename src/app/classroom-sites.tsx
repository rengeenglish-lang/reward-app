'use client';

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
import { ExternalLink, FileText, Globe2, Maximize2, Minimize2, Plus, X } from 'lucide-react';

type SavedSite = { id: string; name: string; url: string };
type StoredMaterial = { id: string; name: string; file: Blob; size: number };
const STORAGE_KEY = 'ezgili-classroom-sites';
const MATERIAL_DB = 'ezgili-classroom-materials';
const MATERIAL_STORE = 'materials';
const MATERIAL_ID = 'shared-pdf';

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
  const [materialUrl, setMaterialUrl] = useState('');
  const [materialBusy, setMaterialBusy] = useState(false);
  const [enlarged, setEnlarged] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const viewerRef = useRef<HTMLElement | null>(null);
  const objectUrlRef = useRef('');

  useEffect(() => {
    setSites(readSites());
    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setSites(readSites());
    };
    window.addEventListener('storage', handleStorage);
    let cancelled = false;
    void readMaterial().then((saved) => {
      if (!saved || cancelled) return;
      const blobUrl = URL.createObjectURL(saved.file);
      objectUrlRef.current = blobUrl;
      setMaterial(saved);
      setMaterialUrl(blobUrl);
    }).catch(() => setError('Could not open the saved PDF on this browser.'));
    return () => {
      cancelled = true;
      window.removeEventListener('storage', handleStorage);
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  useEffect(() => {
    const syncFullscreen = () => setIsFullscreen(document.fullscreenElement === viewerRef.current);
    document.addEventListener('fullscreenchange', syncFullscreen);
    return () => document.removeEventListener('fullscreenchange', syncFullscreen);
  }, []);

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
      setError('This PDF is over the 150 MB browser storage limit.');
      return;
    }
    setMaterialBusy(true);
    setError('');
    try {
      await saveMaterial(file);
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      const blobUrl = URL.createObjectURL(file);
      objectUrlRef.current = blobUrl;
      setMaterial({ id: MATERIAL_ID, name: file.name, file, size: file.size });
      setMaterialUrl(blobUrl);
      setActiveSite(null);
    } catch {
      setError('Could not save this PDF in browser storage. Check available device storage and try again.');
    } finally {
      setMaterialBusy(false);
    }
  };

  const removePdf = async () => {
    try {
      await deleteMaterial();
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = '';
      setMaterial(null);
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

  const viewerControls = <div className="classroom-site-controls">
    <button className="outline-btn" type="button" onClick={()=>setEnlarged((value)=>!value)} aria-pressed={enlarged}><Maximize2 size={15}/>{enlarged?'Normal size':'Enlarge panel'}</button>
    <button className="outline-btn" type="button" onClick={toggleFullscreen} aria-pressed={isFullscreen}>{isFullscreen?<Minimize2 size={15}/>:<Maximize2 size={15}/>} {isFullscreen?'Exit full screen':'Full screen'}</button>
  </div>;

  return (
    <div className="page-wrap alternate classroom-sites-page">
      <p className="eyebrow">YOUR CLASSROOM WEB LAUNCHPAD</p>
      <h1>Bring a website <em>in.</em></h1>
      <p className="subhead">Your saved websites and PDF material stay available in every classroom on this browser.</p>

      <section className="panel classroom-site-add">
        <div className="panel-title"><div className="panel-icon purple"><Globe2 size={19}/></div><div><h2>Add a website</h2><p>Links you save here are shared across all classrooms on this browser.</p></div></div>
        <form className="classroom-site-form" onSubmit={addSite}>
          <label><span className="field-label">Website name <small>optional</small></span><input className="field-select" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Math games" maxLength={70}/></label>
          <label><span className="field-label">Website link</span><input className="field-select" type="text" inputMode="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com" required/></label>
          <button className="primary-btn" type="submit"><Plus size={16}/> Save and open</button>
        </form>
      </section>

      <section className="panel classroom-material-add">
        <div className="panel-title"><div className="panel-icon coral"><FileText size={19}/></div><div><h2>Shared PDF material</h2><p>Stored on this browser only and available in every classroom. PDFs open unchanged in the browser viewer.</p></div></div>
        <div className="material-upload-row"><label className="outline-btn material-upload-label"><Plus size={16}/>{materialBusy?'Saving PDF…':material?'Replace PDF material':'Add a PDF'}<input type="file" accept="application/pdf,.pdf" onChange={uploadPdf} disabled={materialBusy}/></label>{material&&<div className="material-current"><FileText size={16}/><span><strong>{material.name}</strong><small>{formatSize(material.size)} · Shared across classrooms in this browser</small></span><button type="button" className="outline-btn material-open" onClick={()=>{setActiveSite(null);setMaterialUrl(objectUrlRef.current)}}>Open PDF</button><button type="button" className="material-remove" onClick={removePdf} aria-label="Remove PDF material">Remove</button></div>}</div>
      </section>

      {error&&<p className="form-error classroom-sites-error" role="alert">{error}</p>}

      {sites.length>0&&<section className="classroom-saved-sites" aria-label="Shared saved websites">
        <div className="section-heading compact"><div><h2>Your saved websites</h2><p>Open a saved site in any classroom.</p></div></div>
        <div className="classroom-site-list">{sites.map((site)=><div className={`classroom-site-chip ${activeSite?.id===site.id?'selected':''}`} key={site.id}>
          <button className="classroom-site-open" type="button" onClick={()=>chooseSite(site)}><Globe2 size={17}/><span><strong>{site.name}</strong><small>{new URL(site.url).hostname}</small></span></button>
          <button className="classroom-site-remove icon-btn" type="button" aria-label={`Remove ${site.name}`} title={`Remove ${site.name}`} onClick={()=>removeSite(site.id)}><X size={15}/></button>
        </div>)}</div>
      </section>}

      {activeSite&&<section ref={viewerRef} className={`classroom-site-viewer ${enlarged?'enlarged':''} ${isFullscreen?'fullscreen':''}`} aria-label={`${activeSite.name} embedded website`}>
        <header className="classroom-site-viewer-head"><div className="classroom-site-viewer-title"><Globe2 size={18}/><div><strong>{activeSite.name}</strong><small>{activeSite.url}</small></div></div><div className="classroom-site-controls">{viewerControls}<a className="outline-btn" href={activeSite.url} target="_blank" rel="noreferrer"><ExternalLink size={15}/> Open in new tab</a><button className="icon-btn" type="button" aria-label="Close website" onClick={()=>setActiveSite(null)}><X size={18}/></button></div></header>
        <iframe key={activeSite.id} className="classroom-site-frame" src={activeSite.url} title={`${activeSite.name} website`} allow="fullscreen; autoplay" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-presentation"/>
        <p className="classroom-site-note">If the frame stays blank, this website may block embedding. Try <a href={activeSite.url} target="_blank" rel="noreferrer">opening it in a new tab</a>.</p>
      </section>}

      {material&&materialUrl&&<section ref={viewerRef} className={`classroom-site-viewer ${enlarged?'enlarged':''} ${isFullscreen?'fullscreen':''}`} aria-label={`${material.name} PDF viewer`}>
        <header className="classroom-site-viewer-head"><div className="classroom-site-viewer-title"><FileText size={18}/><div><strong>{material.name}</strong><small>{formatSize(material.size)} · This original PDF is displayed without conversion</small></div></div>{viewerControls}<button className="icon-btn" type="button" aria-label="Close PDF" onClick={()=>setMaterialUrl('')}><X size={18}/></button></header>
        <iframe key={materialUrl} className="classroom-site-frame pdf-material-frame" src={materialUrl} title={`${material.name} PDF`} allow="fullscreen" allowFullScreen/>
      </section>}
    </div>
  );
}
