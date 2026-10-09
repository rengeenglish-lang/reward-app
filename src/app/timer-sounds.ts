'use client';

import type { TimerEffect } from './timer-effects';

// Timer sound effects, generated in the browser (no audio files). Every call is safe to fire and forget.
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let fuseNode: { source: AudioBufferSourceNode; gain: GainNode; crackle: number } | null = null;

function audio(): AudioContext | null {
  try {
    if (!ctx) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = 0.7;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch { return null; }
}

function noise(c: AudioContext, seconds: number) {
  const buffer = c.createBuffer(1, Math.ceil(c.sampleRate * seconds), c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function tone(freq: number, seconds: number, volume: number, type: OscillatorType = 'sine', delay = 0, slideTo?: number) {
  const c = audio();
  if (!c || !master) return;
  const at = c.currentTime + delay;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, at + seconds);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(volume, at + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + seconds);
  osc.connect(gain);
  gain.connect(master);
  osc.start(at);
  osc.stop(at + seconds + 0.02);
}

function click(volume: number) {
  const c = audio();
  if (!c || !master) return;
  const src = c.createBufferSource();
  const filter = c.createBiquadFilter();
  const gain = c.createGain();
  src.buffer = noise(c, 0.04);
  filter.type = 'bandpass';
  filter.frequency.value = 2400;
  filter.Q.value = 1.2;
  gain.gain.setValueAtTime(volume, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.035);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  src.start();
}

function boom() {
  const c = audio();
  if (!c || !master) return;
  const at = c.currentTime;
  // blast: noise falling from bright to dull
  const src = c.createBufferSource();
  const low = c.createBiquadFilter();
  const gain = c.createGain();
  src.buffer = noise(c, 3);
  low.type = 'lowpass';
  low.frequency.setValueAtTime(3200, at);
  low.frequency.exponentialRampToValueAtTime(90, at + 2.2);
  gain.gain.setValueAtTime(1, at);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 2.6);
  src.connect(low);
  low.connect(gain);
  gain.connect(master);
  src.start(at);
  src.stop(at + 3);
  // thump
  tone(110, 1.3, 0.9, 'sine', 0, 32);
  // falling debris
  for (let i = 0; i < 10; i++) tone(500 + Math.random() * 900, 0.08, 0.05, 'square', 0.4 + Math.random() * 1.6, 120);
}

function chime() {
  [880, 1108.7, 1318.5, 1760].forEach((f, i) => tone(f, 1.3, 0.2, 'triangle', i * 0.13));
}

export const timerSounds = {
  /** Call from a tap or click, so the browser allows sound afterwards. */
  unlock() { audio(); },

  start(effect: TimerEffect) {
    tone(260, 0.22, 0.16, 'sine', 0, 880);
    if (effect === 'bomb') tone(70, 0.4, 0.2, 'sine', 0.05, 40);
  },

  /** Called once for every second that passes while the timer runs. */
  second(effect: TimerEffect, remaining: number) {
    if (remaining <= 10) {
      tone(remaining <= 3 ? 1040 : 780, 0.12, 0.3, 'square');
      if (effect === 'bomb') click(0.4);
      return;
    }
    if (effect === 'bomb') click(0.28); // a ticking bomb
  },

  /** Hissing, crackling fuse while the bomb timer runs. */
  fuse(on: boolean) {
    if (!on) {
      if (fuseNode) {
        const node = fuseNode;
        fuseNode = null;
        window.clearInterval(node.crackle);
        try {
          node.gain.gain.setTargetAtTime(0.0001, ctx?.currentTime ?? 0, 0.08);
          node.source.stop((ctx?.currentTime ?? 0) + 0.4);
        } catch { /* already stopped */ }
      }
      return;
    }
    if (fuseNode) return;
    const c = audio();
    if (!c || !master) return;
    const source = c.createBufferSource();
    const high = c.createBiquadFilter();
    const band = c.createBiquadFilter();
    const gain = c.createGain();
    source.buffer = noise(c, 2);
    source.loop = true;
    high.type = 'highpass';
    high.frequency.value = 1800;
    band.type = 'bandpass';
    band.frequency.value = 4200;
    band.Q.value = 0.6;
    gain.gain.value = 0.06;
    source.connect(high);
    high.connect(band);
    band.connect(gain);
    gain.connect(master);
    source.start();
    const crackle = window.setInterval(() => {
      if (!ctx) return;
      gain.gain.setTargetAtTime(0.03 + Math.random() * 0.13, ctx.currentTime, 0.015);
    }, 70);
    fuseNode = { source, gain, crackle };
  },

  /** The timer reached zero. */
  finish(effect: TimerEffect) {
    this.fuse(false);
    if (effect === 'bomb') boom(); else chime();
  },

  stop() { this.fuse(false); },
};
