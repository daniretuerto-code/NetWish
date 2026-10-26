import { useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { useToast } from './ui.jsx';
import { notifyOrder, setOrderStatus, STATUS } from '../lib/data.js';
import { parseTableBooking, STATUS_LOOK, tableLabel, telLink, whatsappLink } from '../lib/agenda.js';
import { isAllergyTag } from '../lib/tags.js';

// Status changes wait a few seconds before they are saved, so a slip of the finger can be undone.
const UNDO_MS = 5000;
const queued = new Map();
const flushAll = () => queued.forEach((run) => run());
if (typeof window !== 'undefined') window.addEventListener('pagehide', flushAll);

const DONE_TEXT = {
  [STATUS.CONFIRMED]: 'Reserva confirmada',
  [STATUS.REJECTED]: 'Reserva rechazada',
  [STATUS.SEATED]: 'Marcados como sentados',
  [STATUS.NOSHOW]: 'Marcada como «No vino»',
  [STATUS.CANCELLED]: 'Reserva cancelada',
  [STATUS.DONE]: 'Mesa libre',
};

// Changing a booking's status from the panel, with the customer e-mail on confirmation.
export function useBookingActions(onChange) {
  const toast = useToast();
  const [busy, setBusy] = useState(null);
  const move = (order, status) => {
    onChange?.(order, status);
    let done = false;
    const run = async () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      queued.delete(order.id);
      try {
        await setOrderStatus(order.id, status);
        if (status === STATUS.CONFIRMED && order.status === STATUS.PENDING && order.customer_email) notifyOrder(order.id, 'confirmed');
      } catch (e) {
        onChange?.(order, order.status);
        toast(e.message, 'error');
      }
    };
    queued.get(order.id)?.();
    const timer = setTimeout(run, UNDO_MS);
    queued.set(order.id, run);
    const mail = status === STATUS.CONFIRMED && order.status === STATUS.PENDING && order.customer_email ? '. Le avisamos por correo' : '';
    toast(`${DONE_TEXT[status] || 'Hecho'} · ${order.customer}${mail}`, 'info', {
      duration: UNDO_MS,
      action: {
        label: 'Deshacer',
        onClick: () => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          queued.delete(order.id);
          onChange?.({ ...order, status }, order.status);
        },
      },
    });
  };
  return { busy, move, setBusy };
}

export function StatusChip({ status }) {
  const look = STATUS_LOOK[status] || { label: status, bg: 'var(--bg)', fg: 'var(--ink)' };
  return <span className="pill" style={{ minWidth: 0, height: 26, fontSize: 12, background: look.bg, color: look.fg, display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap' }}>{look.label}</span>;
}

const ACTIONS = {
  [STATUS.PENDING]: [
    { label: 'Confirmar', to: STATUS.CONFIRMED, kind: 'primary' },
    { label: 'Rechazar', to: STATUS.REJECTED, kind: 'soft' },
  ],
  [STATUS.CONFIRMED]: [
    { label: 'Han llegado', to: STATUS.SEATED, kind: 'primary' },
    { label: 'No vino', to: STATUS.NOSHOW, kind: 'soft' },
    { label: 'Cancelar', to: STATUS.CANCELLED, kind: 'ghost' },
  ],
  [STATUS.SEATED]: [{ label: 'Mesa libre', to: STATUS.DONE, kind: 'accent' }],
  // Closed bookings can be brought back if they were marked by mistake.
  [STATUS.NOSHOW]: [{ label: 'Sí vino', to: STATUS.SEATED, kind: 'soft' }, { label: 'Volver a confirmada', to: STATUS.CONFIRMED, kind: 'ghost' }],
  [STATUS.DONE]: [{ label: 'Siguen sentados', to: STATUS.SEATED, kind: 'ghost' }],
  [STATUS.CANCELLED]: [{ label: 'Recuperar reserva', to: STATUS.CONFIRMED, kind: 'ghost' }],
  [STATUS.REJECTED]: [{ label: 'Recuperar reserva', to: STATUS.CONFIRMED, kind: 'ghost' }],
};

// Swipe right for the main action, left for the second one, like Mail on the iPhone.
function Swipe({ left, right, onLeft, onRight, children }) {
  const [dx, setDx] = useState(0);
  const start = useRef(null);
  const dragging = useRef(false);
  const limit = 96;
  if (!onLeft && !onRight) return <div className="order-card">{children}</div>;
  const down = (e) => {
    if (e.target.closest('button, a, input, textarea')) return;
    start.current = { x: e.clientX, y: e.clientY };
    dragging.current = false;
  };
  const move = (e) => {
    if (!start.current) return;
    const x = e.clientX - start.current.x;
    const y = e.clientY - start.current.y;
    if (!dragging.current) {
      if (Math.abs(x) < 10 || Math.abs(y) > Math.abs(x)) { if (Math.abs(y) > 10) start.current = null; return; }
      dragging.current = true;
      e.currentTarget.setPointerCapture?.(e.pointerId);
    }
    const max = x > 0 ? (onRight ? 160 : 0) : (onLeft ? -160 : 0);
    setDx(x > 0 ? Math.min(x, max) : Math.max(x, max));
  };
  const up = () => {
    if (dragging.current) {
      if (dx > limit) { navigator.vibrate?.(10); onRight(); }
      if (dx < -limit) { navigator.vibrate?.(10); onLeft(); }
    }
    start.current = null;
    dragging.current = false;
    setDx(0);
  };
  return (
    <div className={`swipe${dx ? ' dragging' : ''}`} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      <div className="swipe-under" style={{ background: dx > 0 ? 'var(--accent)' : dx < 0 ? 'var(--danger)' : 'transparent' }} aria-hidden="true">
        <span className="l" style={{ opacity: dx > 0 ? Math.min(1, dx / limit) : 0 }}>{right}</span>
        <span className="r" style={{ opacity: dx < 0 ? Math.min(1, -dx / limit) : 0 }}>{left}</span>
      </div>
      <div className="order-card" style={{ transform: `translateX(${dx}px)` }}>{children}</div>
    </div>
  );
}

// One booking as the restaurant sees it: who, how many, which table, and what to do next.
// `profile` is what the restaurant keeps about this customer: a private note and tags such as VIP or an allergy.
export default function BookingCard({ order, history, busy, onMove, onChangeTable, showDate, businessName, profile }) {
  const b = parseTableBooking(order);
  const actions = ACTIONS[order.status] || [];
  const contactText = `Hola ${order.customer}, te escribimos de ${businessName} por tu reserva del ${order.date} a las ${b.start}.`;
  const tags = profile?.tags || [];
  const live = [STATUS.PENDING, STATUS.CONFIRMED, STATUS.SEATED].includes(order.status);
  const main = live && onMove ? actions[0] : null;
  const second = live && onMove ? actions[1] : null;
  return (
    <Swipe right={main?.label} left={second?.label} onRight={main && !busy ? () => onMove(order, main.to) : null} onLeft={second && !busy ? () => onMove(order, second.to) : null}>
      <div className="row" style={{ gap: 12, alignItems: 'flex-start' }}>
        <span className="stack" style={{ gap: 0, alignItems: 'center', minWidth: 52 }}>
          <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em' }}>{b.start || order.time}</span>
          {showDate && <span className="small muted">{showDate}</span>}
        </span>
        <span className="grow stack" style={{ gap: 2, minWidth: 0 }}>
          <span className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            <strong style={{ fontSize: 17 }}>{order.customer}</strong>
            <StatusChip status={order.status} />
            {order.customer_confirmed_at && order.status === STATUS.CONFIRMED && <span className="small" style={{ fontWeight: 700, color: 'var(--seated-ink)' }}>✓ Ha confirmado que viene</span>}
          </span>
          <span style={{ fontSize: 15 }}>
            <strong>{b.guests || '?'} pers.</strong>
            {b.table ? ` · ${tableLabel(b.tables, b.zone)}` : ''}
            {order.source === 'telefono' ? ' · Por teléfono' : order.source === 'local' ? ' · Sin reserva' : ''}
          </span>
          {tags.length > 0 && (
            <span className="row" style={{ gap: 4, flexWrap: 'wrap' }}>
              {tags.map((t) => <span key={t} className={`tag${isAllergyTag(t) ? ' alert' : t === 'VIP' ? ' vip' : ''}`}>{isAllergyTag(t) ? `⚠︎ ${t}` : t}</span>)}
            </span>
          )}
          {b.note && <span className="small" style={{ background: 'var(--surface)', borderRadius: 10, padding: '4px 8px' }}>{b.note}</span>}
          {profile?.note && <span className="small" style={{ background: 'var(--surface)', borderRadius: 10, padding: '4px 8px', fontWeight: 600, display: 'inline-flex', gap: 6, alignItems: 'flex-start' }}><Icon name="person" size={14} /> {profile.note}</span>}
          {history && (history.noShows > 0 || history.visits > 0) && (
            <span className="small" style={{ fontWeight: 700, color: history.noShows ? 'var(--danger-ink)' : 'var(--muted)' }}>
              {history.noShows ? `Ojo: no vino ${history.noShows} ${history.noShows === 1 ? 'vez' : 'veces'}` : `Cliente habitual · ${history.visits} ${history.visits === 1 ? 'visita' : 'visitas'}`}
            </span>
          )}
        </span>
      </div>
      {(order.phone || order.customer_email || onChangeTable) && (
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          {onChangeTable && [STATUS.PENDING, STATUS.CONFIRMED, STATUS.SEATED].includes(order.status) && (
            <button className="btn soft sm" onClick={() => onChangeTable(order)}><Icon name="grid" size={15} /> {b.table ? 'Cambiar mesa' : 'Asignar mesa'}</button>
          )}
          {order.phone && <a className="btn soft sm" href={telLink(order.phone)}><Icon name="phone" size={15} /> {order.phone}</a>}
          {order.phone && <a className="btn soft sm" href={whatsappLink(order.phone, contactText)} target="_blank" rel="noreferrer"><Icon name="chat" size={15} /> WhatsApp</a>}
          {!order.phone && order.customer_email && <a className="btn soft sm" href={`mailto:${order.customer_email}`} style={{ maxWidth: '100%', overflow: 'hidden' }}><Icon name="mail" size={15} /> {order.customer_email}</a>}
        </div>
      )}
      {actions.length > 0 && onMove && (
        <div className="row" style={{ gap: 8 }}>
          {actions.map((a) => (
            <button key={a.label} className={`btn sm ${a.kind}`} style={{ flex: 1 }} disabled={busy} onClick={() => onMove(order, a.to)}>{a.label}</button>
          ))}
        </div>
      )}
    </Swipe>
  );
}
