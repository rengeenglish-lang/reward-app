'use client';

import { useEffect, useMemo, useRef } from 'react';

type Look = { remaining: number; duration: number; running: boolean; clock: string; size: 'card' | 'full' };
type Frame = { g: CanvasRenderingContext2D; W: number; H: number; p: number; t: number; dt: number; running: boolean; remaining: number };
type Draw = (f: Frame) => void;

function seeded(seed: number) {
  let a = seed;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Shared canvas stage: it keeps the picture moving smoothly between the once-a-second timer updates. */
function CanvasLook({ remaining, duration, running, clock, size, name, makeDraw }: Look & { name: string; makeDraw: () => Draw }) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const live = useRef({ remaining, duration, running, at: 0 });
  const draw = useMemo(makeDraw, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { live.current = { remaining, duration, running, at: performance.now() }; }, [remaining, duration, running]);

  useEffect(() => {
    const cv = canvas.current, holder = box.current;
    const g = cv?.getContext('2d');
    if (!cv || !holder || !g) return;
    let W = 0, H = 0, dpr = 1;
    const fit = () => { dpr = Math.min(2, window.devicePixelRatio || 1); W = holder.clientWidth; H = holder.clientHeight; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(holder);
    let last = performance.now(), raf = 0;
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const L = live.current;
      let rem = L.remaining - (L.running ? (now - L.at) / 1000 : 0);
      rem = Math.max(L.remaining > 0 ? L.remaining - 1 : 0, Math.min(L.duration, rem));
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw({ g, W, H, p: L.duration ? 1 - rem / L.duration : 0, t: now / 1000, dt, running: L.running, remaining: L.remaining });
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [draw]);

  return (
    <div ref={box} className={`timer-stage ${name}-stage ${size}${remaining === 0 ? ' done' : ''}`}>
      <canvas ref={canvas} />
      <div className="bomb-clock" role="timer" aria-label={`Time left ${clock}`}>{remaining === 0 ? "Time's up!" : clock}</div>
    </div>
  );
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

/* ============================================================ Liquid ============================================================ */

function makeLiquid(): Draw {
  const rnd = seeded(7);
  const bubbles = Array.from({ length: 22 }, () => ({ x: rnd(), y: rnd(), s: 0.4 + rnd() * 1.2, v: 0.04 + rnd() * 0.08 }));
  return ({ g, W, H, p, t, running, dt }) => {
    g.fillStyle = '#0a1226'; g.fillRect(0, 0, W, H);
    const tw = Math.min(W * 0.5, H * 0.95), th = H * 0.76, x = (W - tw) / 2, y = H * 0.08;
    g.save();
    roundRect(g, x, y, tw, th, 22); g.clip();
    g.fillStyle = 'rgba(255,255,255,.05)'; g.fillRect(x, y, tw, th);
    const level = y + th * (0.05 + 0.95 * p); // the surface sinks as time passes
    g.beginPath(); g.moveTo(x, y + th);
    for (let i = 0; i <= 40; i++) { const px = x + (tw * i) / 40; g.lineTo(px, level + Math.sin(t * 2.4 + i * 0.5) * 5 + Math.sin(t * 1.3 + i * 0.9) * 3); }
    g.lineTo(x + tw, y + th); g.closePath();
    const grad = g.createLinearGradient(0, level, 0, y + th);
    grad.addColorStop(0, '#6fc3ff'); grad.addColorStop(0.5, '#2f7ff0'); grad.addColorStop(1, '#1b3fb0');
    g.fillStyle = grad; g.fill();
    g.fillStyle = 'rgba(255,255,255,.55)';
    for (const b of bubbles) { if (running) b.y -= b.v * dt; if (b.y < 0) b.y = 1; const by = level + (y + th - level) * b.y; if (by > level + 6) { g.beginPath(); g.arc(x + b.x * tw, by, 2 + b.s * 3, 0, Math.PI * 2); g.fill(); } }
    g.restore();
    g.lineWidth = 6; g.strokeStyle = 'rgba(255,255,255,.65)'; roundRect(g, x, y, tw, th, 22); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.18)'; roundRect(g, x + 12, y + 14, 12, th * 0.6, 6); g.fill();
    if (p < 1) { // drain tap and drops
      g.fillStyle = '#9aa7c7'; g.fillRect(x + tw / 2 - 10, y + th, 20, 16);
      if (running) { const k = (t * 2.2) % 1; g.fillStyle = '#4da6ff'; g.beginPath(); g.arc(x + tw / 2, y + th + 18 + k * (H * 0.1), 4, 0, Math.PI * 2); g.fill(); }
    }
  };
}

/* ============================================================= Maze ============================================================= */

function makeMaze() {
  const cols = 16, rows = 9, rnd = seeded(41);
  const wall = Array.from({ length: cols * rows }, () => [true, true, true, true]); // top, right, bottom, left
  const seen = new Array(cols * rows).fill(false), parent = new Array(cols * rows).fill(-1);
  const stack = [0]; seen[0] = true;
  while (stack.length) {
    const c = stack[stack.length - 1], cx = c % cols, cy = Math.floor(c / cols);
    const opts: [number, number, number, number][] = [];
    if (cy > 0 && !seen[c - cols]) opts.push([c - cols, 0, 2, 0]);
    if (cx < cols - 1 && !seen[c + 1]) opts.push([c + 1, 1, 3, 0]);
    if (cy < rows - 1 && !seen[c + cols]) opts.push([c + cols, 2, 0, 0]);
    if (cx > 0 && !seen[c - 1]) opts.push([c - 1, 3, 1, 0]);
    if (!opts.length) { stack.pop(); continue; }
    const [n, a, b] = opts[Math.floor(rnd() * opts.length)];
    wall[c][a] = false; wall[n][b] = false; seen[n] = true; parent[n] = c; stack.push(n);
  }
  const path: number[] = [];
  for (let c = cols * rows - 1; c !== -1; c = parent[c]) path.push(c);
  path.reverse();
  return { cols, rows, wall, path };
}

function makeMazeDraw(): Draw {
  const m = makeMaze();
  return ({ g, W, H, p, t }) => {
    g.fillStyle = '#05070f'; g.fillRect(0, 0, W, H);
    const cs = Math.min((W * 0.94) / m.cols, (H * 0.86) / m.rows), ox = (W - cs * m.cols) / 2, oy = (H - cs * m.rows) / 2 - H * 0.02;
    const center = (c: number) => ({ x: ox + (c % m.cols) * cs + cs / 2, y: oy + Math.floor(c / m.cols) * cs + cs / 2 });
    g.lineCap = 'round'; g.lineWidth = Math.max(2, cs * 0.09); g.strokeStyle = 'rgba(140,160,255,.75)';
    g.beginPath();
    for (let c = 0; c < m.cols * m.rows; c++) {
      const x = ox + (c % m.cols) * cs, y = oy + Math.floor(c / m.cols) * cs, w = m.wall[c];
      if (w[0]) { g.moveTo(x, y); g.lineTo(x + cs, y); }
      if (w[3]) { g.moveTo(x, y); g.lineTo(x, y + cs); }
      if ((c + 1) % m.cols === 0 && w[1]) { g.moveTo(x + cs, y); g.lineTo(x + cs, y + cs); }
      if (c >= m.cols * (m.rows - 1) && w[2]) { g.moveTo(x, y + cs); g.lineTo(x + cs, y + cs); }
    }
    g.stroke();
    const total = m.path.length - 1, at = p * total, whole = Math.min(total, Math.floor(at)), frac = at - whole;
    g.lineWidth = Math.max(3, cs * 0.3); g.strokeStyle = `hsl(${150 - p * 130} 90% 58%)`; g.lineJoin = 'round';
    g.beginPath();
    let head = center(m.path[0]);
    g.moveTo(head.x, head.y);
    for (let i = 1; i <= whole; i++) { head = center(m.path[i]); g.lineTo(head.x, head.y); }
    if (whole < total) { const nx = center(m.path[whole + 1]); head = { x: head.x + (nx.x - head.x) * frac, y: head.y + (nx.y - head.y) * frac }; g.lineTo(head.x, head.y); }
    g.stroke();
    const finish = center(m.path[total]);
    g.fillStyle = '#ffd34d'; g.beginPath(); g.arc(finish.x, finish.y, cs * (0.28 + 0.05 * Math.sin(t * 5)), 0, Math.PI * 2); g.fill();
    const glow = g.createRadialGradient(head.x, head.y, 0, head.x, head.y, cs * 1.1);
    glow.addColorStop(0, 'rgba(255,255,255,.95)'); glow.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = glow; g.fillRect(head.x - cs * 1.2, head.y - cs * 1.2, cs * 2.4, cs * 2.4);
  };
}

/* ============================================================ Heart ============================================================= */

function heartPath(g: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
  g.beginPath();
  g.moveTo(cx, cy + s * 0.9);
  g.bezierCurveTo(cx - s * 1.5, cy - s * 0.1, cx - s * 0.95, cy - s * 1.15, cx, cy - s * 0.45);
  g.bezierCurveTo(cx + s * 0.95, cy - s * 1.15, cx + s * 1.5, cy - s * 0.1, cx, cy + s * 0.9);
  g.closePath();
}

function makeHeartDraw(): Draw {
  return ({ g, W, H, p, t, running, remaining }) => {
    g.fillStyle = '#12060d'; g.fillRect(0, 0, W, H);
    const beat = remaining === 0 ? 0 : Math.pow(Math.max(0, Math.sin(t * (running ? 3.6 + p * 4 : 1.6))), 6) * 0.07;
    const s = Math.min(W * 0.2, H * 0.36) * (1 + beat), cx = W / 2, cy = H * 0.5;
    const glow = g.createRadialGradient(cx, cy, 0, cx, cy, s * 2.4);
    glow.addColorStop(0, 'rgba(255,60,110,.28)'); glow.addColorStop(1, 'rgba(255,60,110,0)');
    g.fillStyle = glow; g.fillRect(0, 0, W, H);
    g.save();
    heartPath(g, cx, cy, s); g.clip();
    g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(0, 0, W, H);
    const top = cy - s * 1.2, bottom = cy + s * 1.0, level = top + (bottom - top) * p; // the heart empties from the top
    const fill = g.createLinearGradient(0, level, 0, bottom);
    fill.addColorStop(0, '#ff6b8f'); fill.addColorStop(1, '#d4163f');
    g.fillStyle = fill;
    g.beginPath(); g.moveTo(0, H);
    for (let i = 0; i <= 30; i++) { const px = (W * i) / 30; g.lineTo(px, level + Math.sin(t * 2 + i * 0.6) * 3); }
    g.lineTo(W, H); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,.22)'; g.beginPath(); g.ellipse(cx - s * 0.55, cy - s * 0.42, s * 0.2, s * 0.34, -0.7, 0, Math.PI * 2); g.fill();
    g.restore();
    g.lineWidth = Math.max(4, s * 0.06); g.strokeStyle = '#ff7a9c'; heartPath(g, cx, cy, s); g.stroke();
  };
}

/* ========================================================== Popcorn pot ========================================================= */

type Pop = { x: number; y: number; vx: number; vy: number; r: number; rot: number };

function makePopcornDraw(): Draw {
  const rnd = seeded(99);
  const N = 170;
  const pieces = Array.from({ length: N }, (_, i) => ({ x: rnd(), lift: i / N, jitter: (rnd() - 0.5) * 0.1, r: 0.8 + rnd() * 0.5, rot: rnd() * 6 }));
  const kernels = Array.from({ length: 60 }, () => ({ x: rnd(), y: rnd() }));
  const pops: Pop[] = [];
  let lidKick = 0, nextPop = 0;
  const popcorn = (g: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number) => {
    g.save(); g.translate(x, y); g.rotate(rot);
    g.fillStyle = '#fff3c8';
    for (const [dx, dy, k] of [[-0.5, 0.15, 0.7], [0.45, 0.1, 0.75], [0, -0.45, 0.8], [0.05, 0.35, 0.65]]) { g.beginPath(); g.arc(dx * r, dy * r, r * k, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#ffd24a'; g.beginPath(); g.arc(0.1 * r, 0.1 * r, r * 0.22, 0, Math.PI * 2); g.fill();
    g.restore();
  };
  return ({ g, W, H, p, t, running, dt, remaining }) => {
    g.fillStyle = '#16120c'; g.fillRect(0, 0, W, H);
    const pw = Math.min(W * 0.46, H * 0.95), ph = H * 0.5, px = (W - pw) / 2, py = H * 0.38;
    const unit = pw / 14;
    // handles
    g.lineWidth = unit * 0.7; g.strokeStyle = '#5b6070';
    g.beginPath(); g.arc(px - unit * 0.2, py + ph * 0.3, unit * 1.3, Math.PI * 0.5, Math.PI * 1.5); g.stroke();
    g.beginPath(); g.arc(px + pw + unit * 0.2, py + ph * 0.3, unit * 1.3, -Math.PI * 0.5, Math.PI * 0.5); g.stroke();
    // inside
    g.fillStyle = '#23262f'; roundRect(g, px, py, pw, ph, unit); g.fill();
    g.save(); roundRect(g, px + unit * 0.4, py + unit * 0.4, pw - unit * 0.8, ph - unit * 0.8, unit * 0.7); g.clip();
    const shown = Math.floor(p * N);
    const innerH = ph - unit * 1.2;
    for (let i = 0; i < shown; i++) {
      const q = pieces[i];
      popcorn(g, px + unit + q.x * (pw - unit * 2), py + ph - unit * 1.2 - q.lift * innerH * 0.92 + q.jitter * ph * 0.1, unit * 0.95 * q.r, q.rot);
    }
    g.fillStyle = '#e0a21a';
    for (const k of kernels) { if (k.y > 0.9 - p) continue; g.beginPath(); g.arc(px + unit + k.x * (pw - unit * 2), py + ph - unit * 0.9 - k.y * unit * 0.8, unit * 0.2, 0, Math.PI * 2); g.fill(); }
    g.restore();
    // pops flying out of the pot
    if (running && remaining > 0) {
      nextPop -= dt;
      if (nextPop <= 0) {
        nextPop = 0.45 - p * 0.36 + Math.random() * 0.15;
        pops.push({ x: px + pw * (0.25 + Math.random() * 0.5), y: py + ph * 0.3, vx: (Math.random() - 0.5) * pw * 0.7, vy: -H * (0.7 + Math.random() * 0.6), r: unit * (0.8 + Math.random() * 0.4), rot: Math.random() * 6 });
        lidKick = 1;
      }
    }
    for (let i = pops.length - 1; i >= 0; i--) {
      const b = pops[i];
      b.vy += H * 2.4 * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.rot += dt * 6;
      if (b.y > py + ph * 0.3 && b.vy > 0) { pops.splice(i, 1); continue; }
      popcorn(g, b.x, b.y, b.r, b.rot);
    }
    lidKick = Math.max(0, lidKick - dt * 5);
    // pot front and lid
    g.fillStyle = '#3a3e4c'; g.fillRect(px, py, pw, unit * 0.5);
    const lift = lidKick * unit * 1.2, tilt = (lidKick * Math.sin(t * 40)) * 0.03;
    g.save(); g.translate(px + pw / 2, py - unit * 0.4 - lift); g.rotate(tilt);
    g.fillStyle = '#5b6070'; roundRect(g, -pw * 0.52, -unit * 0.5, pw * 1.04, unit, unit * 0.5); g.fill();
    g.fillStyle = '#7b8196'; roundRect(g, -unit * 0.8, -unit * 1.4, unit * 1.6, unit, unit * 0.5); g.fill();
    g.restore();
  };
}

/* =========================================================== Traffic light ======================================================= */

function TrafficLight({ remaining, duration, clock, size }: Look) {
  const p = duration ? 1 - remaining / duration : 0;
  const phase = remaining === 0 ? 'red' : p < 0.55 ? 'green' : p < 0.8 ? 'yellow' : 'red';
  const words = remaining === 0 ? 'Stop!' : phase === 'green' ? 'Keep going' : phase === 'yellow' ? 'Almost time, wrap up' : 'Finish now!';
  return (
    <div className={`timer-stage traffic-stage ${size}${remaining === 0 ? ' done' : ''}`}>
      <div className="traffic-box" aria-hidden="true">
        <i className={`lamp red${phase === 'red' ? ' on' : ''}`} />
        <i className={`lamp yellow${phase === 'yellow' ? ' on' : ''}`} />
        <i className={`lamp green${phase === 'green' ? ' on' : ''}`} />
      </div>
      <div className="traffic-words" data-phase={phase}>{words}</div>
      <div className="bomb-clock" role="timer" aria-label={`Time left ${clock}`}>{remaining === 0 ? "Time's up!" : clock}</div>
    </div>
  );
}

export type LookName = 'liquid' | 'maze' | 'heart' | 'traffic' | 'popcorn';

export default function TimerLook({ name, ...look }: Look & { name: LookName }) {
  switch (name) {
    case 'liquid': return <CanvasLook key="liquid" {...look} name="liquid" makeDraw={makeLiquid} />;
    case 'maze': return <CanvasLook key="maze" {...look} name="maze" makeDraw={makeMazeDraw} />;
    case 'heart': return <CanvasLook key="heart" {...look} name="heart" makeDraw={makeHeartDraw} />;
    case 'popcorn': return <CanvasLook key="popcorn" {...look} name="popcorn" makeDraw={makePopcornDraw} />;
    default: return <TrafficLight {...look} />;
  }
}
