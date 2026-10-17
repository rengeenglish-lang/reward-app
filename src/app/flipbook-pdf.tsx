'use client';

import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy, PDFPageProxy, PDFDocumentLoadingTask, RenderTask } from 'pdfjs-dist';

export default function FlipbookPdf({src,page,onPageCount,onPageChange}:{src:string;page:number;onPageCount:(count:number)=>void;onPageChange:(page:number)=>void}){
  const canvasRef=useRef<HTMLCanvasElement|null>(null);
  const documentRef=useRef<PDFDocumentProxy|null>(null);
  const renderToken=useRef(0);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [turn,setTurn]=useState<'next'|'previous'|''>('');
  const previousPage=useRef(page);

  useEffect(()=>{
    let cancelled=false;
    let task:PDFDocumentLoadingTask|undefined;
    setLoading(true);setError('');documentRef.current=null;
    void (async()=>{
      try{
        const pdfjs=await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc='/pdf.worker.min.mjs';
        task=pdfjs.getDocument({url:src,withCredentials:true});
        const document=await task.promise;
        if(cancelled)return;
        documentRef.current=document;
        onPageCount(document.numPages);
        setLoading(false);
      }catch(reason){if(!cancelled){setError(reason instanceof Error?reason.message:'Could not open this PDF.');setLoading(false);}}
    })();
    return()=>{cancelled=true;documentRef.current=null;if(task)void task.destroy();};
  },[src,onPageCount]);

  useEffect(()=>{
    const document=documentRef.current;
    const canvas=canvasRef.current;
    if(!document||!canvas)return;
    const token=++renderToken.current;
    let renderTask:RenderTask|undefined;
    void (async()=>{
      try{
        const pdfPage:PDFPageProxy=await document.getPage(Math.max(1,Math.min(page,document.numPages)));
        if(token!==renderToken.current)return;
        const viewport=pdfPage.getViewport({scale:1.45});
        const ratio=Math.min(window.devicePixelRatio||1,2);
        canvas.width=Math.floor(viewport.width*ratio);
        canvas.height=Math.floor(viewport.height*ratio);
        canvas.style.aspectRatio=`${viewport.width}/${viewport.height}`;
        const context=canvas.getContext('2d');
        if(!context)return;
        context.setTransform(ratio,0,0,ratio,0,0);
        renderTask=pdfPage.render({canvas,canvasContext:context,viewport});
        await renderTask.promise;
      }catch(reason){if(token===renderToken.current&&!(reason instanceof Error&&reason.name==='RenderingCancelledException'))setError('Could not render this PDF page.');}
    })();
    return()=>{renderToken.current++;renderTask?.cancel();};
  },[page,loading,src]);

  useEffect(()=>{
    if(previousPage.current===page)return;
    setTurn(page>previousPage.current?'next':'previous');
    previousPage.current=page;
    const timer=window.setTimeout(()=>setTurn(''),480);
    return()=>window.clearTimeout(timer);
  },[page]);

  return <div className="flipbook-stage" aria-label="PDF flipbook reader">
    {loading&&<div className="flipbook-message" role="status">Opening your book…</div>}
    {error&&<div className="flipbook-message flipbook-error" role="alert">{error}</div>}
    {!loading&&!error&&<><button type="button" className="flipbook-turn flipbook-turn-previous" onClick={()=>onPageChange(Math.max(1,page-1))} disabled={page<=1} aria-label="Turn to previous page">‹</button><div className={`flipbook-page ${turn?`turn-${turn}`:''}`}><div className="flipbook-spine" aria-hidden="true"/><canvas ref={canvasRef} className="flipbook-canvas" aria-label={`PDF page ${page}`}/></div><button type="button" className="flipbook-turn flipbook-turn-next" onClick={()=>onPageChange(page+1)} aria-label="Turn to next page">›</button></>}
  </div>;
}
