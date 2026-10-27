import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import { Empty, Mono, PageHeader, Spinner, useToast } from '../../components/ui.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import useAsync from '../../hooks/useAsync.js';
import { cancelMyBooking, isPickup, isReservation, myOrders, STATUS, subscribe } from '../../lib/data.js';
import { myPickups } from '../../lib/guest.js';
import { paymentLabel } from '../../lib/shop.js';
import { money, todayISO } from '../../lib/format.js';
import { guestBookings } from '../../components/ReserveSheet.jsx';

const LABELS = {
  [STATUS.PAID]: { text: 'Pagado', tone: 'var(--accent)' },
  [STATUS.PENDING]: { text: 'Pendiente', tone: '#F4E3B5' },
  [STATUS.KITCHEN]: { text: 'En cocina', tone: '#F7D2C4' },
  [STATUS.CONFIRMED]: { text: 'Confirmada', tone: 'var(--accent)' },
  [STATUS.READY]: { text: 'Listo', tone: 'var(--accent)' },
  [STATUS.DONE]: { text: 'Completado', tone: '#E4EFE8' },
  [STATUS.REJECTED]: { text: 'Rechazado', tone: '#F3C9C9' },
  [STATUS.CANCELLED]: { text: 'Cancelada', tone: 'var(--bg)' },
  [STATUS.SEATED]: { text: 'En la mesa', tone: 'var(--accent)' },
  [STATUS.NOSHOW]: { text: 'No asististe', tone: '#F3C9C9' },
  [STATUS.ORDERED]: { text: 'Recibido', tone: '#F4E3B5' },
  [STATUS.PREPARING]: { text: 'Preparando', tone: '#F4E3B5' },
  [STATUS.PICKUP]: { text: '¡Listo para recoger!', tone: 'var(--accent)' },
  [STATUS.COLLECTED]: { text: 'Recogido', tone: '#E4EFE8' },
};

const ACTIVE_PICKUP = [STATUS.ORDERED, STATUS.PREPARING, STATUS.PICKUP];
const pickupText = (items = '') => String(items).replace(/^Pedido para recoger:\s*/i, '').split(' · Nota:')[0];

// Orders waiting at a shop: the code to show at the counter, and what to pick up.
function PickupBlock({ list, onCancel, confirming, setConfirming }) {
  if (!list.length) return null;
  return (
    <div className="widget dark stack">
      <span className="eyebrow row" style={{ gap: 6 }}><Icon name="bag" size={14} /> Para recoger</span>
      {list.map((o, i) => {
        const label = LABELS[o.status] || LABELS[STATUS.ORDERED];
        return (
          <div key={o.id} className="stack" style={{ gap: 10, paddingTop: i ? 14 : 4, borderTop: i ? '1px solid rgba(255,255,255,.1)' : 0 }}>
            <div className="row between" style={{ gap: 10, alignItems: 'flex-start' }}>
              <span className="stack" style={{ gap: 2, minWidth: 0 }}>
                <strong style={{ fontSize: 17 }}>{o.business_name}</strong>
                <span className="small" style={{ opacity: 0.85, fontWeight: 600 }}>Recoge {dateLabel(o.date).toLowerCase()} · {String(o.time || '').slice(0, 5)}</span>
                <span className="small" style={{ opacity: 0.62 }}>{pickupText(o.items)}</span>
                <span className="small" style={{ opacity: 0.62 }}>{money(o.total)}{o.payment ? ` · pagas en tienda (${paymentLabel(o.payment).toLowerCase()})` : ''}</span>
              </span>
              <span className="stack" style={{ gap: 6, alignItems: 'flex-end', flex: 'none' }}>
                {(o.pickup_code || o.code) && <span className="pickup-code" style={{ fontSize: 20, padding: '4px 10px' }}>{o.pickup_code || o.code}</span>}
                <span className="status" style={{ background: label.tone, color: 'var(--ink)' }}>{label.text}</span>
              </span>
            </div>
            {onCancel && o.status === STATUS.ORDERED && (confirming === o.id ? (
              <div className="row" style={{ gap: 8 }}>
                <button className="btn accent sm" style={{ flex: 1 }} onClick={() => onCancel(o)}>Sí, cancelar</button>
                <button className="btn soft sm" style={{ flex: 1 }} onClick={() => setConfirming(null)}>No</button>
              </div>
            ) : (
              <button className="btn ghost sm" style={{ color: '#fff', alignSelf: 'flex-start' }} onClick={() => setConfirming(o.id)}>Cancelar pedido</button>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// Newest first by the day of the visit, not by when it was booked.
const byDateDesc = (a, b) => `${b.date || ''} ${b.time || ''}`.localeCompare(`${a.date || ''} ${a.time || ''}`);

// "Reserva 2 pax — Mesa 12 (Terraza) · Nota: Cumpleaños" → "2 personas · Mesa 12 (Terraza)" and the note apart.
function bookingLines(items = '') {
  const [main, ...rest] = String(items).split(' · ');
  const note = rest.join(' · ').replace(/^Nota:\s*/i, '');
  const pax = main.match(/(\d+)\s*pax/i);
  const table = main.split('—')[1]?.trim();
  const head = pax ? [`${pax[1]} ${pax[1] === '1' ? 'persona' : 'personas'}`, table].filter(Boolean).join(' · ') : main;
  return { head, note };
}

const dateLabel = (iso) => {
  if (!iso) return '';
  if (iso === todayISO()) return 'Hoy';
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
};

function OrderRow({ order }) {
  const label = LABELS[order.status] || { text: order.status, tone: 'var(--bg)' };
  const booking = isReservation(order);
  const { head, note } = booking ? bookingLines(order.items) : { head: isPickup(order) ? pickupText(order.items) : order.items, note: '' };
  return (
    <Link to={`/negocio/${encodeURIComponent(order.business_name)}`} className="list-row" style={{ alignItems: 'flex-start', padding: '12px 0' }}>
      <Mono name={order.business_name} />
      <span className="grow stack" style={{ gap: 3, minWidth: 0 }}>
        <span className="row between" style={{ gap: 8, alignItems: 'baseline' }}>
          <span className="t" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{order.business_name}</span>
          <span className="small muted" style={{ flex: 'none', fontVariantNumeric: 'tabular-nums' }}>{dateLabel(order.date)}{order.time ? ` · ${order.time.split(' - ')[0]}` : ''}</span>
        </span>
        <span className="s" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{head}</span>
        {note && <span className="s" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{note}</span>}
        <span className="row between" style={{ gap: 8, marginTop: 4 }}>
          <span className="status" style={{ background: label.tone }}>{label.text}</span>
          {Number(order.total) > 0 && <span className="price" style={{ fontSize: 15 }}>{money(order.total)}</span>}
        </span>
      </span>
    </Link>
  );
}

function HistoryBlock({ title, list }) {
  if (!list.length) return null;
  return (
    <div className="widget" style={{ paddingBottom: 4 }}>
      <h2 className="title-lg" style={{ marginBottom: 2 }}>{title}</h2>
      {list.map((o) => <OrderRow key={o.id} order={o} />)}
    </div>
  );
}

export default function Orders() {
  const { user } = useAuth();
  const toast = useToast();
  const [confirming, setConfirming] = useState(null);
  const { data, loading, reload } = useAsync(() => (user ? myOrders() : Promise.resolve([])), [user?.id]);

  const cancel = async (o) => {
    try {
      await cancelMyBooking(o.id);
      toast(isPickup(o) ? 'Pedido cancelado.' : 'Reserva cancelada. Gracias por avisar.');
      setConfirming(null);
      reload();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  useEffect(() => {
    if (!user) return undefined;
    return subscribe('orders', () => reload(), `customer_id=eq.${user.id}`);
  }, [user, reload]);

  if (!user) {
    // Bookings made without an account in this browser, soonest first.
    const mine = guestBookings().filter((b) => (b.date || '') >= todayISO()).sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
    const pickups = myPickups().filter((p) => (p.date || '') >= todayISO()).map((p) => ({ ...p, status: STATUS.ORDERED }));
    return (
      <div className="page">
        <PageHeader eyebrow="Tu actividad" title="Reservas" />
        <PickupBlock list={pickups} />
        {mine.length > 0 && (
          <div className="widget dark stack">
            <span className="eyebrow row" style={{ gap: 6 }}><Icon name="calendar" size={14} /> Próximas reservas</span>
            {mine.map((b, i) => {
              const { head } = bookingLines(b.items);
              return (
                <Link key={b.token} to={`/reserva/${b.token}`} className="row between" style={{ gap: 10, textDecoration: 'none', color: 'inherit', paddingTop: i ? 14 : 4, borderTop: i ? '1px solid rgba(255,255,255,.1)' : 0 }}>
                  <span className="stack" style={{ gap: 2, minWidth: 0 }}>
                    <strong style={{ fontSize: 17 }}>{b.business_name}</strong>
                    <span className="small" style={{ opacity: 0.85, fontWeight: 600 }}>{dateLabel(b.date)} · {b.time}</span>
                    <span className="small" style={{ opacity: 0.62 }}>{head}</span>
                  </span>
                  <span className="small" style={{ fontWeight: 800, color: 'var(--accent)', flex: 'none' }}>Ver o cambiar</span>
                </Link>
              );
            })}
          </div>
        )}
        <div className="widget">
          <Empty icon="calendar" title={mine.length ? 'Guarda todas tus reservas en un sitio' : 'Aquí verás tus reservas'}>
            {mine.length ? 'Con una cuenta las ves en cualquier móvil y reservas en dos toques.' : 'Reserva sin registrarte desde la página de cualquier restaurante, o entra para verlas en todos tus dispositivos.'}
            <span className="row" style={{ gap: 8, justifyContent: 'center', marginTop: 10, flexWrap: 'wrap' }}>
              <Link to="/explorar?cat=rest" className="btn soft">Buscar restaurante</Link>
              <Link to="/cuenta" className="btn primary">Entrar o crear cuenta</Link>
            </span>
          </Empty>
        </div>
      </div>
    );
  }

  if (loading && !data) return <Spinner />;
  const orders = data || [];
  const pickups = orders.filter((o) => isPickup(o) && ACTIVE_PICKUP.includes(o.status)).sort((a, b) => byDateDesc(b, a));
  const reservations = orders.filter((o) => !isPickup(o) && isReservation(o) && [STATUS.PENDING, STATUS.CONFIRMED].includes(o.status) && (o.date || '') >= todayISO());
  reservations.sort((a, b) => byDateDesc(b, a));
  const rest = orders.filter((o) => !reservations.includes(o) && !pickups.includes(o));
  // Bookings and old QR orders are different things: each gets its own list.
  const pastBookings = rest.filter((o) => isReservation(o) && !isPickup(o)).sort(byDateDesc);
  const pastOrders = rest.filter((o) => !isReservation(o) || isPickup(o)).sort(byDateDesc);

  return (
    <div className="page">
      <PageHeader eyebrow="Tu actividad" title="Reservas" />
      {orders.length === 0 ? (
        <div className="widget">
          <Empty icon="calendar" title="Aún no tienes reservas">
            <Link to="/explorar">Descubre comercios de Palencia</Link>
          </Empty>
        </div>
      ) : (
        <div className="two-col">
          <div className="stack">
            <PickupBlock list={pickups} onCancel={cancel} confirming={confirming} setConfirming={setConfirming} />
            {reservations.length > 0 && (
              <div className="widget dark stack">
                <span className="eyebrow row" style={{ gap: 6 }}><Icon name="calendar" size={14} /> Próximas reservas</span>
                {reservations.map((o, i) => {
                  const { head, note } = bookingLines(o.items);
                  return (
                  <div key={o.id} className="stack" style={{ gap: 10, paddingTop: i ? 14 : 4, borderTop: i ? '1px solid rgba(255,255,255,.1)' : 0 }}>
                  <div className="row between" style={{ gap: 10, alignItems: 'flex-start' }}>
                    <span className="stack" style={{ gap: 2, minWidth: 0 }}>
                      <strong style={{ fontSize: 17 }}>{o.business_name}</strong>
                      <span className="small" style={{ opacity: 0.85, fontWeight: 600 }}>{dateLabel(o.date)} · {o.time}</span>
                      <span className="small" style={{ opacity: 0.62 }}>{head}{note ? ` · ${note}` : ''}</span>
                    </span>
                    <span className="status lg" style={{ background: o.status === STATUS.CONFIRMED ? 'var(--accent)' : 'rgba(255,255,255,.14)', color: o.status === STATUS.CONFIRMED ? 'var(--ink)' : '#fff' }}>
                      {o.status === STATUS.CONFIRMED ? 'Confirmada' : 'Pendiente'}
                    </span>
                  </div>
                  {confirming === o.id ? (
                    <div className="row" style={{ gap: 8 }}>
                      <button className="btn accent sm" style={{ flex: 1 }} onClick={() => cancel(o)}>Sí, cancelar</button>
                      <button className="btn soft sm" style={{ flex: 1 }} onClick={() => setConfirming(null)}>No</button>
                    </div>
                  ) : (
                    <div className="row" style={{ gap: 8 }}>
                      {/\d+\s*pax/i.test(o.items) && o.remind_token && (
                        <Link className="btn soft sm" to={`/reserva/${o.remind_token}?r=cambiar`}>Cambiar</Link>
                      )}
                      <button className="btn ghost sm" style={{ color: '#fff' }} onClick={() => setConfirming(o.id)}>Cancelar reserva</button>
                    </div>
                  )}
                  </div>
                  );
                })}
              </div>
            )}
            <HistoryBlock title="Historial" list={pastBookings} />
            {reservations.length === 0 && pastBookings.length === 0 && pickups.length === 0 && (
              <div className="widget"><Empty icon="calendar" title="No tienes reservas próximas"><Link to="/explorar">Busca dónde ir</Link></Empty></div>
            )}
          </div>
          {pastOrders.length > 0 && (
          <div className="stack">
            <HistoryBlock title="Pedidos" list={pastOrders} />
          </div>
          )}
        </div>
      )}
    </div>
  );
}
