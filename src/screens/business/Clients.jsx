import { useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { PageHeader, Skeleton } from '../../components/ui.jsx';
import SectionTabs from '../../components/SectionTabs.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import useAsync from '../../hooks/useAsync.js';
import { businessOrders, customerNotes, subscribe } from '../../lib/data.js';
import { bookingsOf } from '../../lib/agenda.js';
import { Customers, Stats } from './Reservations.jsx';

// Everyone who has booked: visits, notes, allergies and birthdays.
export default function Clients() {
  const { business } = useAuth();
  const { data: orders, loading } = useAsync(() => businessOrders(business.name), [business.name]);
  const { data: profiles, setData: setProfiles } = useAsync(() => customerNotes(business.name), [business.name]);
  return (
    <div className="page">
      <PageHeader eyebrow={business.name} title="Clientes" />
      <SectionTabs />
      {loading && !orders ? <Skeleton rows={4} /> : <Customers orders={orders || []} business={business} profiles={profiles} setProfiles={setProfiles} />}
    </div>
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
      <PageHeader eyebrow={business.name} title="Tus números" />
      <SectionTabs />
      {(loading && !orders) || !settings ? <Skeleton rows={4} /> : <Stats bookings={bookingsOf(orders || [])} settings={settings} />}
    </div>
  );
}
