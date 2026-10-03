'use client';

import { useEffect, useRef, useState } from 'react';

type ParadeGesture = 'thumbs' | 'clap' | 'bow' | 'karate';
type MascotSetting = { emoji: string; name: string };
const PARADE_INTERVAL = 10 * 60 * 1000;
const gestureDetails: Record<ParadeGesture, { emoji: string; cheer: string }> = {
  thumbs: { emoji: '👍', cheer: 'You’ve got this!' },
  clap: { emoji: '👏', cheer: 'Fantastic work, Champs!' },
  bow: { emoji: '🙇', cheer: 'Ta-da! You’re amazing!' },
  karate: { emoji: '🥋', cheer: 'Hi-yah, Champs!' },
};

function readMascot(classroomId: string): MascotSetting {
  try {
    const saved = JSON.parse(localStorage.getItem('ezgili-classroom-fun') || '{}');
    return saved.mascots?.[classroomId] || { emoji: '🦊', name: 'Champs' };
  } catch {
    return { emoji: '🦊', name: 'Champs' };
  }
}

export default function MascotParade({ classroomId, triggerKey }: { classroomId: string; triggerKey: number }) {
  const [mascot, setMascot] = useState<MascotSetting>({ emoji: '🦊', name: 'Champs' });
  const [parading, setParading] = useState(false);
  const [gesture, setGesture] = useState<ParadeGesture>('thumbs');
  const [paradeId, setParadeId] = useState(0);
  const lastParadeRef = useRef(0);
  const startParadeRef = useRef<() => void>(() => {});
  const hideRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!classroomId) return;
    const storageKey = `ezgili-mascot-parade:${classroomId}`;
    const syncMascot = () => setMascot(readMascot(classroomId));
    syncMascot();

    const startParade = () => {
      const now = Date.now();
      lastParadeRef.current = now;
      try {
        localStorage.setItem(storageKey, String(now));
      } catch {}
      const gestures: ParadeGesture[] = ['thumbs', 'clap', 'bow', 'karate'];
      setGesture(gestures[Math.floor(Math.random() * gestures.length)]);
      syncMascot();
      setParadeId((current) => current + 1);
      setParading(true);
      if (hideRef.current) clearTimeout(hideRef.current);
      hideRef.current = setTimeout(() => setParading(false), 7100);
    };
    startParadeRef.current = startParade;

    let last = 0;
    try {
      last = Number(localStorage.getItem(storageKey)) || 0;
      if (!last || last > Date.now()) {
        last = Date.now();
        localStorage.setItem(storageKey, String(last));
      }
    } catch {
      last = Date.now();
    }
    lastParadeRef.current = last;

    const checkParade = () => {
      const now = Date.now();
      let storedLast = lastParadeRef.current;
      try {
        storedLast = Number(localStorage.getItem(storageKey)) || storedLast;
      } catch {}
      if (now - storedLast < PARADE_INTERVAL) return;

      startParade();
    };

    const interval = window.setInterval(checkParade, 5000);
    window.addEventListener('ezgili-classroom-fun-updated', syncMascot);
    window.addEventListener('storage', syncMascot);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('ezgili-classroom-fun-updated', syncMascot);
      window.removeEventListener('storage', syncMascot);
      if (hideRef.current) clearTimeout(hideRef.current);
    };
  }, [classroomId]);

  useEffect(() => {
    if (triggerKey > 0) startParadeRef.current();
  }, [triggerKey]);

  if (!parading) return null;
  const finish = gestureDetails[gesture];
  return (
    <div key={paradeId} className="mascot-parade" aria-live="polite" aria-label={`${mascot.name} is celebrating`}>
      <div className={`mascot-parade-track gesture-${gesture}`}>
        <div className="mascot-cartoon">
          <span className="mascot-parade-head" aria-hidden="true">{mascot.emoji}</span>
          <span className="mascot-parade-body" aria-hidden="true" />
          <span className="mascot-parade-arm arm-left" aria-hidden="true" />
          <span className="mascot-parade-arm arm-right" aria-hidden="true" />
          <span className="mascot-parade-leg leg-left" aria-hidden="true" />
          <span className="mascot-parade-leg leg-right" aria-hidden="true" />
          <span className="mascot-parade-feet" aria-hidden="true">👟　👟</span>
        </div>
        <div className="mascot-parade-cheer"><span>{finish.emoji}</span><strong>{mascot.name}</strong><small>{finish.cheer}</small></div>
      </div>
      <span className="mascot-parade-spark spark-one" aria-hidden="true">✦</span>
      <span className="mascot-parade-spark spark-two" aria-hidden="true">✧</span>
    </div>
  );
}
