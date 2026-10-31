import { useCallback, useEffect, useState } from 'react';

// Favourite places, kept on this device. Every screen using the hook stays in sync.
const KEY = 'netwish.favs';
const EVENT = 'netwish-favs';

const read = () => {
  try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
};

export function useFavorites() {
  const [favs, setFavs] = useState(read);
  useEffect(() => {
    const sync = () => setFavs(read());
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener(EVENT, sync); window.removeEventListener('storage', sync); };
  }, []);
  const toggle = useCallback((biz) => {
    const list = read();
    const next = list.some((f) => f.name === biz.name)
      ? list.filter((f) => f.name !== biz.name)
      : [{ name: biz.name, category: biz.category || '', image: biz.image || '' }, ...list].slice(0, 50);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [favs, toggle];
}
