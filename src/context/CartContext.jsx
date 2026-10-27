import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { normalize } from '../lib/format.js';

const CartContext = createContext(null);
export const useCart = () => useContext(CartContext);

const KEY = 'netwish_carts';

export function CartProvider({ children }) {
  const [carts, setCarts] = useState(() => {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
  });

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(carts)); } catch { /* storage unavailable */ }
  }, [carts]);

  const change = useCallback((business, product, delta) => {
    const key = normalize(business);
    setCarts((all) => {
      const items = [...(all[key]?.items || [])];
      // A shop line is one product in one size and colour: its id carries the variant.
      const id = product.variant ? `${product.id}~${product.variant}` : product.id;
      const idx = items.findIndex((i) => i.id === id);
      if (idx === -1 && delta > 0) {
        items.push({
          id,
          pid: product.id,
          variant: product.variant || null,
          name: product.name,
          price: Number(product.price) || 0,
          qty: delta,
          image: product.image_url || null,
          unit: product.unit || null,
          audio_url: product.audio_url || null,
          full_audio_url: product.full_audio_url || null,
        });
      } else if (idx !== -1) {
        const qty = items[idx].qty + delta;
        if (qty <= 0) items.splice(idx, 1);
        else items[idx] = { ...items[idx], qty };
      }
      return { ...all, [key]: { business, items } };
    });
  }, []);

  const value = useMemo(() => ({
    cartFor(business) {
      const items = carts[normalize(business)]?.items || [];
      return {
        items,
        count: items.reduce((a, i) => a + i.qty, 0),
        total: items.reduce((a, i) => a + i.qty * i.price, 0),
        qtyOf: (id) => items.find((i) => i.id === id)?.qty || 0,
      };
    },
    add: (business, product, qty = 1) => change(business, product, qty),
    remove: (business, product) => change(business, product, -1),
    clear: (business) => setCarts((all) => {
      const next = { ...all };
      delete next[normalize(business)];
      return next;
    }),
  }), [carts, change]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
