import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import { Empty, Spinner, useToast } from '../../components/ui.jsx';
import { respondBooking, STATUS } from '../../lib/data.js';

// netwish.es/reserva/:token — the link in the reminder e-mail. Works without signing in.
export default function BookingResponse() {
  const { token } = useParams();
  const [params] = useSearchParams();
  const toast = useToast();
  const [booking, setBooking] = useState(undefined);
  const [askCancel, setAskCancel] = useState(params.get('r') === 'no');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // "Sí, allí estaré" in the e-mail confirms straight away; cancelling always takes a tap here.
    respondBooking(token, params.get('r') === 'si' ? 'confirm' : 'view').then(setBooking).catch(() => setBooking(null));
  }, [token, params]);

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
