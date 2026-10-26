import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import { Empty, Spinner, useToast } from '../../components/ui.jsx';
import ReserveSheet, { CalendarButtons } from '../../components/ReserveSheet.jsx';
import { findBusiness, getRestaurantSettings, respondBooking, STATUS } from '../../lib/data.js';
import { calendarLinks } from '../../lib/calendar.js';

// netwish.es/reserva/:token — the link in the reminder e-mail. Works without signing in.
export default function BookingResponse() {
  const { token } = useParams();
  const [params] = useSearchParams();
  const toast = useToast();
  const [booking, setBooking] = useState(undefined);
  const [askCancel, setAskCancel] = useState(params.get('r') === 'no');
  const [busy, setBusy] = useState(false);
  // Changing opens the restaurant's booking sheet, which needs the business and its settings.
  const [changing, setChanging] = useState(null);

  useEffect(() => {
    // "Sí, allí estaré" in the e-mail confirms straight away; cancelling always takes a tap here.
    respondBooking(token, params.get('r') === 'si' ? 'confirm' : 'view').then(setBooking).catch(() => setBooking(null));
  }, [token, params]);

  const canChange = booking && [STATUS.PENDING, STATUS.CONFIRMED].includes(booking.status) && /\d+\s*pax/i.test(booking.items);

  const startChange = async () => {
    setBusy(true);
    try {
      const biz = await findBusiness(booking.business_name);
      if (!biz) throw new Error('No encontramos el restaurante');
      setChanging({ biz, settings: await getRestaurantSettings(biz.name, 'restaurant') });
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  // "Cambiar la reserva" in the reminder e-mail opens the sheet straight away.
  useEffect(() => {
    if (params.get('r') === 'cambiar' && canChange && !changing) startChange();
  }, [canChange]);

  const act = async (action) => {
    setBusy(true);
    try {
      setBooking(await respondBooking(token, action));
      setAskCancel(false);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  if (booking === undefined) return <Spinner />;
  if (!booking) return <div className="page"><Empty icon="calendar" title="No encontramos esta reserva">Puede que el enlace esté incompleto.</Empty></div>;

  const cancelled = booking.status === STATUS.CANCELLED;
  const open = [STATUS.PENDING, STATUS.CONFIRMED].includes(booking.status);
  const start = String(booking.time).split(' - ')[0];
  const calendar = calendarLinks({ token, ...booking });
  const day = new Date(`${booking.date}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="page" style={{ maxWidth: 560 }}>
      <div className="widget dark stack" style={{ gap: 6 }}>
        <span className="eyebrow" style={{ color: 'var(--accent)' }}>Tu reserva</span>
        <h1 className="title-xl" style={{ color: '#fff' }}>{booking.business_name}</h1>
        <span style={{ fontSize: 18, fontWeight: 700 }}>{day.charAt(0).toUpperCase() + day.slice(1)} · {start}</span>
        <span className="small" style={{ opacity: 0.7 }}>{booking.items}</span>
      </div>

      {cancelled && (
        <div className="widget stack" style={{ alignItems: 'center', textAlign: 'center' }}>
          <h2 className="title-lg">Reserva cancelada</h2>
          <p className="muted" style={{ margin: 0 }}>Gracias por avisar. La mesa queda libre para otra persona.</p>
        </div>
      )}

      {open && booking.confirmed && !askCancel && (
        <div className="widget stack" style={{ alignItems: 'center', textAlign: 'center' }}>
          <span className="mono lg" style={{ background: 'var(--accent)', color: 'var(--ink)' }}><Icon name="check" size={28} stroke={3} /></span>
          <h2 className="title-lg">¡Perfecto, te esperan!</h2>
          <p className="muted" style={{ margin: 0 }}>Hemos avisado a {booking.business_name} de que vas.</p>
          <button className="btn ghost sm" onClick={() => setAskCancel(true)}>Al final no puedo ir</button>
        </div>
      )}

      {open && !askCancel && booking.status === STATUS.CONFIRMED && calendar && (
        <div className="widget"><CalendarButtons links={calendar} /></div>
      )}

      {canChange && !askCancel && (
        <button className="btn soft block" disabled={busy} onClick={startChange}>Cambiar día, hora o personas</button>
      )}

      {changing && (
        <ReserveSheet
          open
          onClose={() => setChanging(null)}
          biz={changing.biz}
          settings={changing.settings}
          change={{ token, date: booking.date, time: booking.time, items: booking.items }}
          onChanged={() => respondBooking(token).then(setBooking).catch(() => {})}
        />
      )}

      {open && !booking.confirmed && !askCancel && (
        <div className="stack">
          <button className="btn primary block" disabled={busy} onClick={() => act('confirm')}>Sí, allí estaré</button>
          <button className="btn soft block" disabled={busy} onClick={() => setAskCancel(true)}>No puedo ir</button>
        </div>
      )}

      {open && askCancel && (
        <div className="widget stack">
          <h2 className="title-lg">¿Cancelar la reserva?</h2>
          <p className="muted" style={{ margin: 0 }}>{booking.business_name} podrá dar tu mesa a otra persona.</p>
          <button className="btn primary block" disabled={busy} onClick={() => act('cancel')}>Sí, cancelar</button>
          <button className="btn ghost block" disabled={busy} onClick={() => setAskCancel(false)}>No, mantenerla</button>
        </div>
      )}

      {!open && !cancelled && <p className="muted" style={{ textAlign: 'center' }}>Esta reserva ya no se puede cambiar.</p>}
      <Link to="/" className="btn ghost block">Ir a NetWish</Link>
    </div>
  );
}
