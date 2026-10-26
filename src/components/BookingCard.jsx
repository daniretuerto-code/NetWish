import { useState } from 'react';
import Icon from './Icon.jsx';
import { useToast } from './ui.jsx';
import { notifyOrder, setOrderStatus, STATUS } from '../lib/data.js';
import { parseTableBooking, STATUS_LOOK, telLink, whatsappLink } from '../lib/agenda.js';

// Changing a booking's status from the panel, with the customer e-mail on confirmation.
export function useBookingActions(onChange) {
  const toast = useToast();
  const [busy, setBusy] = useState(null);
  const move = async (order, status) => {
    setBusy(order.id);
    try {
      await setOrderStatus(order.id, status);
      onChange?.(order, status);
      if (status === STATUS.CONFIRMED && order.status === STATUS.PENDING && order.customer_email) {
        notifyOrder(order.id, 'confirmed');
        toast('Reserva confirmada. Avisamos al cliente por correo.');
      }
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(null);
    }
  };
  return { busy, move };
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
};

// One booking as the restaurant sees it: who, how many, which table, and what to do next.
export default function BookingCard({ order, history, busy, onMove, onChangeTable, showDate, businessName }) {
  const b = parseTableBooking(order);
  const actions = ACTIONS[order.status] || [];
  const contactText = `Hola ${order.customer}, te escribimos de ${businessName} por tu reserva del ${order.date} a las ${b.start}.`;
  return (
    <div className="order-card">
      <div className="row" style={{ gap: 12, alignItems: 'flex-start' }}>
        <span className="stack" style={{ gap: 0, alignItems: 'center', minWidth: 52 }}>
          <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em' }}>{b.start || order.time}</span>
          {showDate && <span className="small muted">{showDate}</span>}
        </span>
        <span className="grow stack" style={{ gap: 2, minWidth: 0 }}>
          <span className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            <strong style={{ fontSize: 17 }}>{order.customer}</strong>
            <StatusChip status={order.status} />
            {order.customer_confirmed_at && order.status === STATUS.CONFIRMED && <span className="small" style={{ fontWeight: 700, color: '#2F5D46' }}>✓ Ha confirmado que viene</span>}
          </span>
          <span style={{ fontSize: 15 }}>
            <strong>{b.guests || '?'} pers.</strong>
            {b.table ? ` · Mesa ${b.table}${b.zone ? ` (${b.zone})` : ''}` : ''}
            {order.source === 'telefono' ? ' · Por teléfono' : order.source === 'local' ? ' · Sin reserva' : ''}
          </span>
          {b.note && <span className="small" style={{ background: 'var(--surface)', borderRadius: 10, padding: '4px 8px' }}>{b.note}</span>}
          {history && (history.noShows > 0 || history.visits > 0) && (
            <span className="small" style={{ fontWeight: 700, color: history.noShows ? '#8E2B2B' : 'var(--muted)' }}>
              {history.noShows ? `Ojo: no vino ${history.noShows} ${history.noShows === 1 ? 'vez' : 'veces'}` : `Cliente habitual · ${history.visits} ${history.visits === 1 ? 'visita' : 'visitas'}`}
            </span>
          )}
        </span>
      </div>
      {(order.phone || order.customer_email || onChangeTable) && (
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          {onChangeTable && [STATUS.PENDING, STATUS.CONFIRMED, STATUS.SEATED].includes(order.status) && (
            <button className="btn soft sm" onClick={() => onChangeTable(order)}><Icon name="grid" size={15} /> {/Mesa \d+/.test(order.items) ? 'Cambiar mesa' : 'Asignar mesa'}</button>
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
    </div>
  );
}
