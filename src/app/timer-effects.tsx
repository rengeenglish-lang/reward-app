'use client';

import { useEffect, useId, useMemo, useRef } from 'react';
import TimerLook from './timer-looks';

export type TimerEffect = 'ring' | 'neon' | 'bomb' | 'liquid' | 'maze' | 'heart' | 'traffic' | 'popcorn';

/** Add a new look here and give it a case in TimerStage. */
export const TIMER_EFFECTS: { id: TimerEffect; label: string; emoji: string }[] = [
  { id: 'ring', label: 'Classic ring', emoji: '⭕' },
  { id: 'neon', label: 'Neon countdown', emoji: '🌈' },
  { id: 'bomb', label: 'Bomb fuse', emoji: '💣' },
  { id: 'liquid', label: 'Liquid', emoji: '💧' },
  { id: 'maze', label: 'Maze', emoji: '🧩' },
  { id: 'heart', label: 'Heart', emoji: '❤️' },
  { id: 'traffic', label: 'Traffic light', emoji: '🚦' },
  { id: 'popcorn', label: 'Popcorn', emoji: '🍿' },
];

type StageProps = { effect: Exclude<TimerEffect, 'ring'>; remaining: number; duration: number; running: boolean; clock: string; size: 'card' | 'full' };

export default function TimerStage(props: StageProps) {
  if (props.effect === 'neon') return <NeonStage {...props} />;
  if (props.effect === 'bomb') return <BombStage {...props} />;
  return <TimerLook name={props.effect} remaining={props.remaining} duration={props.duration} running={props.running} clock={props.clock} size={props.size} />;
}

/* ====================================================== Neon countdown ====================================================== */

const SEGMENTS: Record<string, string> = {
  a: '14,4 46,4 52,10 46,16 14,16 8,10',
  b: '44,18 50,12 56,18 56,44 50,50 44,44',
  c: '44,56 50,50 56,56 56,82 50,88 44,82',
  d: '14,84 46,84 52,90 46,96 14,96 8,90',
  e: '4,56 10,50 16,56 16,82 10,88 4,82',
  f: '4,18 10,12 16,18 16,44 10,50 4,44',
  g: '14,44 46,44 52,50 46,56 14,56 8,50',
};
const DIGIT_SEGMENTS: Record<string, string> = { '0': 'abcdef', '1': 'bc', '2': 'abdeg', '3': 'abcdg', '4': 'bcfg', '5': 'acdfg', '6': 'acdefg', '7': 'abc', '8': 'abcdefg', '9': 'abcdfg' };

function SevenSegment({ digit }: { digit: string }) {
  const id = useId().replace(/:/g, '');
  const on = DIGIT_SEGMENTS[digit] ?? '';
  return (
    <svg className="neon-digit" viewBox="0 0 60 100" aria-hidden="true">
      <defs>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor="#f6f3ff" />
          <stop offset="0.55" stopColor="#b9b0ff" />
          <stop offset="1" stopColor="#7d72dd" />
        </linearGradient>
      </defs>
      {on.split('').map((s) => <polygon key={s} points={SEGMENTS[s]} fill={`url(#g${id})`} stroke="#2a1d73" strokeWidth="1.4" strokeLinejoin="round" />)}
    </svg>
  );
}

function NeonStage({ remaining, duration, running, clock, size }: StageProps) {
  const progress = duration ? 1 - remaining / duration : 0;
  const finalSeconds = remaining > 0 && remaining <= 10;
  const hue = remaining === 0 ? 330 : finalSeconds ? 310 - (10 - remaining) * 4 : 275 - progress * 85; // purple, drifting to blue, hot pink at the end
  const text = finalSeconds ? String(remaining).padStart(2, '0') : clock;
  const chars = text.split('');
  const fixed = finalSeconds ? 0 : Math.max(0, chars.length - 2); // when the minutes show, only the seconds tumble
  return (
    <div className={`timer-stage neon-stage ${size}${running ? '' : ' paused'}${remaining === 0 ? ' done' : ''}`} style={{ ['--h' as string]: hue }}>
      <div className="neon-bg a" />
      <div className="neon-bg b" />
      <div className="neon-glow" />
      <div className="neon-digits" role="timer" aria-label={`Time left ${clock}`}>
        {chars.slice(0, fixed).map((ch, i) => (ch === ':' ? <i key={i} className="neon-colon" /> : <SevenSegment key={i} digit={ch} />))}
        <span className="neon-tumble" key={remaining}>
          {chars.slice(fixed).map((ch, i) => (ch === ':' ? <i key={i} className="neon-colon" /> : <SevenSegment key={i} digit={ch} />))}
        </span>
      </div>
    </div>
  );
}

/* ======================================================== Bomb fuse ========================================================= */

type Pt = { x: number; y: number };
const ASPECT = 16 / 9;

function seeded(seed: number) {
  let a = seed;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** A long, tangled fuse that wanders over the whole stage and ends where the bomb sits. Points are in a 0..1 (width) by 0..1/ASPECT (height) box. */
function makeFuse(): { pts: Pt[]; len: number[]; total: number } {
  const rnd = seeded(20261009);
  const H = 1 / ASPECT;
  const raw: Pt[] = [];
  let x = 0.06, y = 0.08, heading = 0.5;
  for (let i = 0; i < 520; i++) {
    heading += (rnd() - 0.5) * (rnd() < 0.04 ? 5 : 0.7); // mostly gentle bends, now and then a tight loop
    const nx = x + Math.cos(heading) * 0.0135, ny = y + Math.sin(heading) * 0.0135;
    if (nx < 0.04 || nx > 0.96 || ny < 0.05 || ny > H - 0.05) heading = Math.atan2(H / 2 - y, 0.5 - x) + (rnd() - 0.5) * 0.8; // steer back inside
    x = Math.min(0.96, Math.max(0.04, x + Math.cos(heading) * 0.0135));
    y = Math.min(H - 0.05, Math.max(0.05, y + Math.sin(heading) * 0.0135));
    raw.push({ x, y });
  }
  const end: Pt = { x: 0.5, y: H * 0.62 };
  const last = raw[raw.length - 1];
  for (let i = 1; i <= 14; i++) raw.push({ x: last.x + ((end.x - last.x) * i) / 14, y: last.y + ((end.y - last.y) * i) / 14 });
  let pts = raw;
  for (let pass = 0; pass < 2; pass++) { // smooth the corners
    const next: Pt[] = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      next.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 }, { x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
    }
    next.push(pts[pts.length - 1]);
    pts = next;
  }
  const len = [0];
  for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  return { pts, len, total: len[len.length - 1] };
}

type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; kind: 'spark' | 'fire' | 'smoke' };

function BombStage({ remaining, duration, running, clock, size }: StageProps) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const live = useRef({ remaining, duration, running, at: 0 });
  const fuse = useMemo(() => makeFuse(), []);

  useEffect(() => { live.current = { remaining, duration, running, at: performance.now() }; }, [remaining, duration, running]);

  useEffect(() => {
    const cv = canvas.current, holder = box.current;
    if (!cv || !holder) return;
    const g = cv.getContext('2d');
    if (!g) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const bomb = new Image();
    bomb.src = '/timers/bomb-3d.png';
    let W = 0, H = 0, dpr = 1;
    const fit = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = holder.clientWidth; H = holder.clientHeight;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(holder);

    const particles: Particle[] = [];
    let boomAt = 0;
    let last = performance.now();
    let raf = 0;

    const at = (s: number): Pt => { // point at distance s along the fuse
      const { pts, len, total } = fuse;
      const d = Math.min(Math.max(s, 0), total);
      let lo = 0, hi = len.length - 1;
      while (lo < hi - 1) { const mid = (lo + hi) >> 1; if (len[mid] <= d) lo = mid; else hi = mid; }
      const k = len[hi] === len[lo] ? 0 : (d - len[lo]) / (len[hi] - len[lo]);
      return { x: pts[lo].x + (pts[hi].x - pts[lo].x) * k, y: pts[lo].y + (pts[hi].y - pts[lo].y) * k };
    };

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const L = live.current;
      // smooth progress between the once-a-second updates
      let rem = L.remaining - (L.running ? (now - L.at) / 1000 : 0);
      rem = Math.max(L.remaining > 0 ? L.remaining - 1 : 0, Math.min(L.duration, rem));
      const progress = L.duration ? 1 - rem / L.duration : 0;
      const exploded = L.remaining === 0 && L.duration > 0;
      if (exploded && !boomAt) {
        boomAt = now;
        const c = at(fuse.total);
        for (let i = 0; i < (reduce ? 40 : 170); i++) {
          const a = Math.random() * Math.PI * 2, v = 0.15 + Math.random() * 0.9;
          particles.push({ x: c.x, y: c.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: 0.6 + Math.random() * 0.9, size: 0.012 + Math.random() * 0.03, kind: 'fire' });
        }
        for (let i = 0; i < (reduce ? 20 : 90); i++) {
          const a = Math.random() * Math.PI * 2, v = 0.05 + Math.random() * 0.25;
          particles.push({ x: c.x, y: c.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.08, life: 0, max: 2 + Math.random() * 2.5, size: 0.03 + Math.random() * 0.05, kind: 'smoke' });
        }
      }
      if (!exploded && boomAt) { boomAt = 0; particles.length = 0; }

      const sx = W / 1, sy = W; // normalised units: x*W, y*W (the box is 16:9, so y runs 0..0.5625)
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, W, H);
      g.fillStyle = '#0b1030';
      g.fillRect(0, 0, W, H);
      const sinceBoom = boomAt ? (now - boomAt) / 1000 : 0;
      if (boomAt && !reduce && sinceBoom < 0.5) g.translate((Math.random() - 0.5) * 16 * (1 - sinceBoom * 2), (Math.random() - 0.5) * 16 * (1 - sinceBoom * 2));

      const spark = at(progress * fuse.total);
      const width = Math.max(4, W * 0.0105);

      if (!exploded) {
        // the part of the fuse that has not burned yet
        const { pts, len } = fuse;
        const from = progress * fuse.total;
        g.lineCap = 'round'; g.lineJoin = 'round';
        const path = new Path2D();
        path.moveTo(spark.x * sx, spark.y * sy);
        for (let i = 0; i < pts.length; i++) if (len[i] > from) path.lineTo(pts[i].x * sx, pts[i].y * sy);
        g.strokeStyle = '#05081f'; g.lineWidth = width * 1.55; g.stroke(path);
        g.strokeStyle = '#d6dbf4'; g.lineWidth = width; g.stroke(path);
        g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = width * 0.3; g.stroke(path);
        // scorched edge right behind the spark
        const scorch = new Path2D();
        let started = false;
        for (let s = Math.max(0, from - 0.05); s <= from; s += 0.004) { const p = at(s); if (!started) { scorch.moveTo(p.x * sx, p.y * sy); started = true; } else scorch.lineTo(p.x * sx, p.y * sy); }
        g.strokeStyle = 'rgba(70,45,30,.55)'; g.lineWidth = width * 0.8; g.stroke(scorch);
        // the bomb at the end of the fuse
        const end = at(fuse.total);
        const bs = Math.max(70, W * 0.17);
        if (bomb.complete && bomb.naturalWidth) g.drawImage(bomb, end.x * sx - bs / 2, end.y * sy - bs * (560 / 512) * 0.19, bs, bs * (560 / 512));
        // the burning spark
        const glow = g.createRadialGradient(spark.x * sx, spark.y * sy, 0, spark.x * sx, spark.y * sy, W * 0.045);
        glow.addColorStop(0, 'rgba(255,250,200,.95)'); glow.addColorStop(0.35, 'rgba(255,170,60,.55)'); glow.addColorStop(1, 'rgba(255,90,20,0)');
        g.globalCompositeOperation = 'lighter';
        g.fillStyle = glow;
        g.fillRect(spark.x * sx - W * 0.05, spark.y * sy - W * 0.05, W * 0.1, W * 0.1);
        g.globalCompositeOperation = 'source-over';
        if (L.running || reduce) {
          for (let i = 0; i < (reduce ? 1 : 3); i++) particles.push({ x: spark.x, y: spark.y, vx: (Math.random() - 0.5) * 0.18, vy: -0.05 - Math.random() * 0.22, life: 0, max: 0.35 + Math.random() * 0.35, size: 0.002 + Math.random() * 0.004, kind: 'spark' });
        }
      }

      // particles: sparks, fire and smoke
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life += dt;
        if (p.life >= p.max) { particles.splice(i, 1); continue; }
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.kind === 'spark') p.vy += 0.5 * dt;
        if (p.kind === 'smoke') { p.vy -= 0.02 * dt; p.vx *= 0.995; }
        const t = p.life / p.max;
        if (p.kind === 'smoke') {
          g.globalAlpha = (1 - t) * 0.5;
          g.fillStyle = '#4a4a55';
          g.beginPath(); g.arc(p.x * sx, p.y * sy, p.size * sx * (1 + t * 3), 0, Math.PI * 2); g.fill();
        } else {
          g.globalCompositeOperation = 'lighter';
          g.globalAlpha = 1 - t;
          g.fillStyle = p.kind === 'fire' ? `hsl(${50 - t * 45} 100% ${60 - t * 25}%)` : `hsl(${40 + Math.random() * 15} 100% 70%)`;
          g.beginPath(); g.arc(p.x * sx, p.y * sy, p.size * sx * (p.kind === 'fire' ? 1 + t : 1), 0, Math.PI * 2); g.fill();
          g.globalCompositeOperation = 'source-over';
        }
        g.globalAlpha = 1;
      }

      if (boomAt) { // the flash and the fireball
        const c = at(fuse.total);
        if (sinceBoom < 1.2) {
          const r = Math.min(1, sinceBoom / 0.9) * W * 0.55;
          const ball = g.createRadialGradient(c.x * sx, c.y * sy, 0, c.x * sx, c.y * sy, Math.max(1, r));
          const a = Math.max(0, 1 - sinceBoom / 1.2);
          ball.addColorStop(0, `rgba(255,255,230,${a})`); ball.addColorStop(0.4, `rgba(255,170,40,${a * 0.85})`); ball.addColorStop(1, 'rgba(200,40,10,0)');
          g.globalCompositeOperation = 'lighter'; g.fillStyle = ball; g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'source-over';
        }
        if (sinceBoom < 0.25) { g.fillStyle = `rgba(255,255,255,${0.9 * (1 - sinceBoom / 0.25)})`; g.fillRect(0, 0, W, H); }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [fuse]);

  return (
    <div ref={box} className={`timer-stage bomb-stage ${size}${remaining === 0 ? ' done' : ''}`}>
      <canvas ref={canvas} />
      <div className="bomb-clock" role="timer" aria-label={`Time left ${clock}`}>{remaining === 0 ? 'BOOM!' : clock}</div>
    </div>
  );
}
