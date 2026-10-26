import { useEffect, useState } from 'react';

// Per-device panel preferences: they belong to this tablet or phone, not to the restaurant.
const KEY = 'netwish.panel';
const DEFAULTS = { theme: 'auto', sound: true, stand: false };

const read = () => {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { ...DEFAULTS }; }
};

export const soundOn = () => read().sound;

// "Auto" goes dark for the evening service, from 20:00 to 8:00.
const isNight = () => { const h = new Date().getHours(); return h >= 20 || h < 8; };

export function usePanelPrefs() {
  const [prefs, setPrefs] = useState(read);
  const [night, setNight] = useState(isNight);
  useEffect(() => {
    const t = setInterval(() => setNight(isNight()), 60000);
    return () => clearInterval(t);
  }, []);

  // Host-stand mode: full screen and the screen never sleeps.
  useEffect(() => {
    if (!prefs.stand) return undefined;
    let lock = null;
    const keepAwake = async () => {
      try { lock = await navigator.wakeLock?.request('screen'); } catch { /* not allowed */ }
    };
    keepAwake();
    document.documentElement.requestFullscreen?.().catch(() => {});
    const onVisible = () => document.visibilityState === 'visible' && keepAwake();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      lock?.release?.().catch(() => {});
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
  }, [prefs.stand]);

  const setPref = (k, v) => setPrefs((p) => {
    const next = { ...p, [k]: v };
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
    return next;
  });
  const dark = prefs.theme === 'dark' || (prefs.theme === 'auto' && night);
  return { prefs, setPref, dark };
}
