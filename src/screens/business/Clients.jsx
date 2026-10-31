import { useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { PageHeader, Skeleton } from '../../components/ui.jsx';
import SectionTabs from '../../components/SectionTabs.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import useAsync from '../../hooks/useAsync.js';
import { businessOrders, customerNotes, isPickup, STATUS, subscribe } from '../../lib/data.js';
import { bookingsOf } from '../../lib/agenda.js';
import { Customers, Stats } from './Reservations.jsx';
import Icon from '../../components/Icon.jsx';
import { exportBookings, exportCustomers } from '../../lib/csv.js';
import { channelLabel } from '../../lib/channel.js';

// A shop's pickup orders count as visits, like a booking that turned up.
const asVisit = (o) => (isPickup(o) ? {
  ...o,
  items: `Reserva · ${o.items}`,
  status: o.status === STATUS.COLLECTED ? STATUS.DONE : [STATUS.CANCELLED, STATUS.REJECTED].includes(o.status) ? STATUS.CANCELLED : STATUS.CONFIRMED,
} : o);

// Everyone who has booked: visits, notes, allergies and birthdays.
export default function Clients() {
  const { business } = useAuth();
  const { data: orders, loading } = useAsync(async () => (await businessOrders(business.name)).map(asVisit), [business.name]);
  const { data: profiles, setData: setProfiles } = useAsync(() => customerNotes(business.name), [business.name]);
  return (
    <div className="page">
      <PageHeader eyebrow={business.name} title="Clientes"
        right={orders?.length > 0 && <button className="btn soft sm" onClick={() => exportCustomers(business, orders, profiles)}><Icon name="download" size={16} /> Excel</button>} />
      <SectionTabs />
      {loading && !orders ? <Skeleton rows={4} /> : <Customers orders={orders || []} business={business} profiles={profiles} setProfiles={setProfiles} />}
    </div>
  );
}

// Where online bookings come from in the last 30 days: the proof NetWish brings customers.
function Channels({ orders }) {
  const since = Date.now() - 30 * 864e5;
  const online = orders.filter((o) => (!o.source || o.source === 'app') && o.created_at && new Date(o.created_at) > since);
  if (!online.length) return null;
  const counts = {};
  online.forEach((o) => { const c = o.channel || 'netwish'; counts[c] = (counts[c] || 0) + 1; });
  const list = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const max = list[0][1];
  return (
    <section className="widget stack" style={{ gap: 8 }}>
      <span className="eyebrow">De dónde vienen tus reservas online · 30 días</span>
      <span style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em' }}>{online.length} reservas sin coger el teléfono</span>
      {list.map(([c, n]) => (
        <div key={c} className="row" style={{ gap: 10 }}>
          <span className="small" style={{ width: 96, fontWeight: 600 }}>{channelLabel(c)}</span>
          <span className="grow" style={{ height: 10, borderRadius: 6, background: 'var(--bg)' }}>
            <span style={{ display: 'block', height: '100%', width: `${(n / max) * 100}%`, borderRadius: 6, background: 'var(--ink)' }} />
          </span>
          <span className="small" style={{ width: 28, textAlign: 'right', fontWeight: 700 }}>{n}</span>
        </div>
      ))}
      <span className="small muted">Para saber de dónde viene cada una, usa los enlaces de "Compartir": cada sitio lleva su etiqueta.</span>
    </section>
  );
}

// How the restaurant is doing: diners, occupancy, no-shows and what NetWish brought.
export function Numbers() {
  const { business } = useAuth();
  const { settings } = useOutletContext();
  const { data: orders, loading, reload } = useAsync(() => businessOrders(business.name), [business.name]);
  useEffect(() => subscribe('orders', () => reload()), [reload]);
  return (
    <div className="page">
      <PageHeader eyebrow={business.name} title="Tus números"
        right={orders?.length > 0 && <button className="btn soft sm" onClick={() => exportBookings(business, orders)}><Icon name="download" size={16} /> Excel</button>} />
      <SectionTabs />
      {orders && <Channels orders={orders} />}
      {(loading && !orders) || !settings ? <Skeleton rows={4} /> : <Stats bookings={bookingsOf(orders || [])} settings={settings} />}
    </div>
  );
}
