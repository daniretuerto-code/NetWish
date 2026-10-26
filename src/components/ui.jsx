import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import { initials, toneFor } from '../lib/format.js';

// ---------- Toasts ----------
const ToastContext = createContext(() => {});
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  // show(text, type, { action: { label, onClick }, duration }): a toast can carry one button, e.g. "Deshacer".
  const show = useCallback((text, type = 'info', opts = {}) => {
    const id = Math.random();
    const close = () => setToasts((t) => t.filter((x) => x.id !== id));
    setToasts((t) => [...t, { id, text, type, action: opts.action, close }]);
    setTimeout(close, opts.duration || (opts.action ? 5000 : 3200));
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            <span>{t.text}</span>
            {t.action && <button className="toast-action" onClick={() => { t.action.onClick(); t.close(); }}>{t.action.label}</button>}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// ---------- Sheet ----------
export function Sheet({ open, onClose, title, children, labelledBy }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="sheet-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={labelledBy ? undefined : title} aria-labelledby={labelledBy} tabIndex={-1} ref={ref}>
        <div className="grabber" />
        <div className="row between" style={{ minHeight: 44, marginBottom: 8 }}>
          <span className="title-lg">{title}</span>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar">
            <Icon name="close" size={18} stroke={2.6} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// Frosts the strip under the phone's status bar once the page scrolls, so titles never run into the clock.
export function StatusVeil() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const onScroll = () => setOn(window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return <div className={`status-veil${on ? ' on' : ''}`} aria-hidden="true" />;
}

// ---------- Small pieces ----------
export function Mono({ name, image, size = '', tone }) {
  return (
    <span className={`mono ${size}`} style={{ background: tone || toneFor(name) }}>
      {image ? <img src={image} alt="" /> : initials(name)}
    </span>
  );
}

export function Spinner({ label = 'Cargando' }) {
  return (
    <div className="center-screen" role="status">
      <div className="spinner" />
      <span className="visually-hidden">{label}</span>
    </div>
  );
}

// Grey shapes in the place of what is loading, instead of a spinner.
export function Skeleton({ rows = 3 }) {
  return (
    <div className="page" aria-busy="true" role="status">
      <span className="visually-hidden">Cargando</span>
      <div className="skel" style={{ width: 120, height: 14 }} />
      <div className="skel" style={{ width: 220, height: 34 }} />
      <div className="skel" style={{ height: 150, borderRadius: 'var(--r-xl)' }} />
      {Array.from({ length: rows }, (_, i) => <div key={i} className="skel" style={{ height: 76, borderRadius: 'var(--r-lg)' }} />)}
    </div>
  );
}

export function Empty({ icon = 'store', title, children }) {
  return (
    <div className="empty">
      <Icon name={icon} size={30} stroke={1.6} />
      <strong style={{ color: 'var(--ink)' }}>{title}</strong>
      {children && <span className="small">{children}</span>}
    </div>
  );
}

export function BackButton({ to = -1, glass = false, label = 'Atrás', onClick }) {
  const cls = `icon-btn${glass ? ' glass' : ''}`;
  if (onClick) {
    return (
      <button className={cls} onClick={onClick} aria-label={label}>
        <Icon name="back" stroke={2.6} />
      </button>
    );
  }
  if (to === -1) {
    return (
      <button className={cls} onClick={() => (window.history.length > 1 ? window.history.back() : (window.location.href = '/'))} aria-label={label}>
        <Icon name="back" stroke={2.6} />
      </button>
    );
  }
  return (
    <Link to={to} className={cls} aria-label={label}>
      <Icon name="back" stroke={2.6} />
    </Link>
  );
}

export function PageHeader({ eyebrow, title, right, back }) {
  return (
    <div className="row" style={{ alignItems: 'flex-end', padding: '0 4px' }}>
      {back}
      <div className="grow stack" style={{ gap: 2 }}>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1 className="title-xl">{title}</h1>
      </div>
      {right}
    </div>
  );
}

export function Ring({ value = 0, size = 56, color = 'var(--cover)', label }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={label}>
      <circle cx="32" cy="32" r={r} fill="none" stroke="#EDEAE3" strokeWidth="9" />
      <circle cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round" strokeDasharray={`${c * value} ${c}`} transform="rotate(-90 32 32)" />
    </svg>
  );
}

export function Stepper({ qty, onAdd, onRemove, addLabel = 'AÑADIR' }) {
  if (!qty) {
    return (
      <button className="pill" onClick={onAdd}>
        {addLabel}
      </button>
    );
  }
  return (
    <span className="row" style={{ gap: 4, background: 'var(--accent)', borderRadius: 16, height: 32 }}>
      <button className="pill on" style={{ minWidth: 32, padding: 0 }} onClick={onRemove} aria-label="Quitar uno">
        <Icon name="minus" size={16} stroke={2.6} />
      </button>
      <span className="price" style={{ minWidth: 14, textAlign: 'center', fontSize: 14 }}>{qty}</span>
      <button className="pill on" style={{ minWidth: 32, padding: 0 }} onClick={onAdd} aria-label="Añadir uno">
        <Icon name="plus" size={16} stroke={2.6} />
      </button>
    </span>
  );
}
