'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { ExternalLink, Globe2, Maximize2, Minimize2, Plus, X } from 'lucide-react';

type SavedSite = { id: string; name: string; url: string };
type SitesByClassroom = Record<string, SavedSite[]>;
const STORAGE_KEY = 'ezgili-classroom-sites';

function readSites(): SitesByClassroom {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function normalizeUrl(value: string): string | null {
  try {
    const parsed = new URL(value.trim().includes('://') ? value.trim() : `https://${value.trim()}`);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : null;
  } catch {
    return null;
  }
}

export default function ClassroomSites({ classroomId, classroom }: { classroomId: string; classroom: string }) {
  const [sites, setSites] = useState<SitesByClassroom>({});
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [activeSite, setActiveSite] = useState<SavedSite | null>(null);
  const [enlarged, setEnlarged] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const viewerRef = useRef<HTMLElement | null>(null);
  const currentSites = sites[classroomId] || [];

  useEffect(() => {
    setSites(readSites());
    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setSites(readSites());
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  useEffect(() => {
    const syncFullscreen = () => setIsFullscreen(document.fullscreenElement === viewerRef.current);
    document.addEventListener('fullscreenchange', syncFullscreen);
    return () => document.removeEventListener('fullscreenchange', syncFullscreen);
  }, []);

  const save = (next: SitesByClassroom) => {
    setSites(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
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
    save({ ...sites, [classroomId]: [...currentSites, nextSite] });
    setName('');
    setUrl('');
    setError('');
    setActiveSite(nextSite);
  };

  const removeSite = (id: string) => {
    const nextList = currentSites.filter((site) => site.id !== id);
    const next = { ...sites, [classroomId]: nextList };
    if (!nextList.length) delete next[classroomId];
    save(next);
    if (activeSite?.id === id) setActiveSite(null);
  };

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await viewerRef.current?.requestFullscreen();
    } catch {
      setError('Full screen is unavailable in this browser. You can still enlarge the website panel.');
    }
  };

  return (
    <div className="page-wrap alternate classroom-sites-page">
      <p className="eyebrow">YOUR CLASSROOM WEB LAUNCHPAD</p>
      <h1>Bring a website <em>in.</em></h1>
      <p className="subhead">Save a classroom site and open it right inside Ezgili Champs for {classroom}.</p>

      <section className="panel classroom-site-add">
        <div className="panel-title"><div className="panel-icon purple"><Globe2 size={19}/></div><div><h2>Add a website</h2><p>Links are saved in this browser for this classroom.</p></div></div>
        <form className="classroom-site-form" onSubmit={addSite}>
          <label><span className="field-label">Website name <small>optional</small></span><input className="field-select" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Math games" maxLength={70}/></label>
          <label><span className="field-label">Website link</span><input className="field-select" type="text" inputMode="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com" required/></label>
          <button className="primary-btn" type="submit"><Plus size={16}/> Save and open</button>
        </form>
        {error&&<p className="form-error" role="alert">{error}</p>}
      </section>

      {currentSites.length>0&&<section className="classroom-saved-sites" aria-label={`Saved websites for ${classroom}`}>
        <div className="section-heading compact"><div><h2>Saved for {classroom}</h2><p>Choose a site to open it inside your classroom.</p></div></div>
        <div className="classroom-site-list">{currentSites.map((site)=><div className={`classroom-site-chip ${activeSite?.id===site.id?'selected':''}`} key={site.id}>
          <button className="classroom-site-open" type="button" onClick={()=>{setActiveSite(site);setError('')}}><Globe2 size={17}/><span><strong>{site.name}</strong><small>{new URL(site.url).hostname}</small></span></button>
          <button className="classroom-site-remove icon-btn" type="button" aria-label={`Remove ${site.name}`} title={`Remove ${site.name}`} onClick={()=>removeSite(site.id)}><X size={15}/></button>
        </div>)}</div>
      </section>}

      {activeSite&&<section ref={viewerRef} className={`classroom-site-viewer ${enlarged?'enlarged':''} ${isFullscreen?'fullscreen':''}`} aria-label={`${activeSite.name} embedded website`}>
        <header className="classroom-site-viewer-head"><div className="classroom-site-viewer-title"><Globe2 size={18}/><div><strong>{activeSite.name}</strong><small>{activeSite.url}</small></div></div><div className="classroom-site-controls">
          <button className="outline-btn" type="button" onClick={()=>setEnlarged((value)=>!value)} aria-pressed={enlarged}><Maximize2 size={15}/>{enlarged?'Normal size':'Enlarge panel'}</button>
          <button className="outline-btn" type="button" onClick={toggleFullscreen} aria-pressed={isFullscreen}>{isFullscreen?<Minimize2 size={15}/>:<Maximize2 size={15}/>} {isFullscreen?'Exit full screen':'Full screen'}</button>
          <a className="outline-btn" href={activeSite.url} target="_blank" rel="noreferrer"><ExternalLink size={15}/> Open in new tab</a>
          <button className="icon-btn" type="button" aria-label="Close website" onClick={()=>setActiveSite(null)}><X size={18}/></button>
        </div></header>
        <iframe key={activeSite.id} className="classroom-site-frame" src={activeSite.url} title={`${activeSite.name} website`} allow="fullscreen; autoplay" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-presentation"/>
        <p className="classroom-site-note">If the frame stays blank, this website may block embedding. Try <a href={activeSite.url} target="_blank" rel="noreferrer">opening it in a new tab</a>.</p>
      </section>}
    </div>
  );
}
