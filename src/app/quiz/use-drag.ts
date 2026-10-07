'use client';

import { useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

type DragOpts = {
  enabled: boolean;
  /** A press-and-release on a piece without moving. */
  onTap: (id: string) => void;
  /** A piece was dropped. `drop` is the data-drop value of the zone under the pointer, or null. */
  onDrop: (id: string, drop: string | null, x: number, y: number, container: HTMLElement) => void;
};

type DragState = { id: string; el: HTMLElement; x: number; y: number; on: boolean; ghost: HTMLElement | null; pid: number };

/**
 * Pointer-event drag and drop that works with mouse, pen and touch.
 * Put the returned handlers on a container. Pieces carry data-drag="id", zones carry data-drop="key".
 */
export function useDrag(opts: DragOpts) {
  const latest = useRef(opts);
  latest.current = opts;
  const drag = useRef<DragState | null>(null);
  const [hover, setHover] = useState<string | null>(null);

  function dropAt(container: HTMLElement, x: number, y: number): string | null {
    const pad = 12;
    let best: string | null = null;
    let bestArea = Infinity;
    container.querySelectorAll<HTMLElement>('[data-drop]').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad) {
        const area = r.width * r.height;
        if (area < bestArea) { bestArea = area; best = el.dataset.drop ?? null; }
      }
    });
    return best;
  }

  function onPointerDown(e: ReactPointerEvent<HTMLElement>) {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-drag]');
    if (!el || !latest.current.enabled || e.button > 0) return;
    drag.current = { id: el.dataset.drag ?? '', el, x: e.clientX, y: e.clientY, on: false, ghost: null, pid: e.pointerId };
    try { el.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  }

  function onPointerMove(e: ReactPointerEvent<HTMLElement>) {
    const d = drag.current;
    if (!d || e.pointerId !== d.pid) return;
    if (!d.on && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6) {
      d.on = true;
      const ghost = d.el.cloneNode(true) as HTMLElement;
      ghost.classList.add('sq-ghostchip');
      ghost.removeAttribute('data-drag');
      document.body.append(ghost);
      d.ghost = ghost;
      d.el.classList.add('sq-lifting');
    }
    if (d.on && d.ghost) {
      d.ghost.style.left = `${e.clientX}px`;
      d.ghost.style.top = `${e.clientY}px`;
      setHover(dropAt(e.currentTarget, e.clientX, e.clientY));
    }
  }

  function finish(e: ReactPointerEvent<HTMLElement>, cancelled: boolean) {
    const d = drag.current;
    if (!d || e.pointerId !== d.pid) return;
    drag.current = null;
    d.ghost?.remove();
    d.el.classList.remove('sq-lifting');
    setHover(null);
    if (cancelled) return;
    if (!d.on) { latest.current.onTap(d.id); return; }
    latest.current.onDrop(d.id, dropAt(e.currentTarget, e.clientX, e.clientY), e.clientX, e.clientY, e.currentTarget);
  }

  return {
    hover,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: (e: ReactPointerEvent<HTMLElement>) => finish(e, false),
      onPointerCancel: (e: ReactPointerEvent<HTMLElement>) => finish(e, true),
    },
  };
}
