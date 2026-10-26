// New-booking alerts for the panel: a soft chime and, if allowed, a system notification.
let ctx = null;

// Browsers only let a page play sound after a tap, so the first tap unlocks it.
export function unlockSound() {
  if (ctx) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) ctx = new AC();
  } catch { /* no audio */ }
}

export function chime() {
  if (!ctx) return;
  try {
    if (ctx.state === 'suspended') ctx.resume();
    const t = ctx.currentTime;
    // Two bell-like notes, a fifth apart.
    [[880, 0], [1318.5, 0.16]].forEach(([freq, delay]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t + delay);
      gain.gain.exponentialRampToValueAtTime(0.25, t + delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + delay + 0.9);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t + delay);
      osc.stop(t + delay + 1);
    });
  } catch { /* no audio */ }
}

export const canNotify = () => typeof Notification !== 'undefined';
export const notifyPermission = () => (canNotify() ? Notification.permission : 'denied');

export async function askNotifyPermission() {
  if (!canNotify()) return 'denied';
  try { return await Notification.requestPermission(); } catch { return 'denied'; }
}

export function systemNotify(title, body) {
  if (notifyPermission() !== 'granted' || document.visibilityState === 'visible') return;
  try {
    const n = new Notification(title, { body, icon: '/icon-192.png', tag: 'netwish-booking' });
    n.onclick = () => { window.focus(); n.close(); };
  } catch { /* not supported here */ }
}

export { soundOn } from './panelPrefs.js';
