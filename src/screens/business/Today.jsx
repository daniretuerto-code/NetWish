import { useEffect, useState } from 'react';
import { Link, Navigate, useOutletContext } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import BookingCard, { useBookingActions } from '../../components/BookingCard.jsx';
import OwnerBookingSheet from '../../components/OwnerBookingSheet.jsx';
import { PageHeader, Ring, Spinner, useToast } from '../../components/ui.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import useAsync from '../../hooks/useAsync.js';
import { businessInbox, businessOrders, expirePending, listProducts, notifyReady, sendReminders, STATUS, subscribe } from '../../lib/data.js';
import { ACTIVE_BOOKING, bookingsOf, byTime, customerKey, customersFrom, guestsOf, parseTableBooking, shiftOf } from '../../lib/agenda.js';
import { greeting, longDate, minutesToTime, todayISO } from '../../lib/format.js';
import { profileProgress } from '../../lib/questionnaire.js';

const tomorrowISO = () => {
  const d = new Date(`${todayISO()}T12:00:00`);
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
};

// .widget.link stacks its children; these cards read as one line.
const ROW = { display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 14 };

export const bookingLink = (business) => `${window.location.origin}/r/${business.username}`;

// What a new restaurant still needs before its page goes public.
function PublishChecklist({ business, settings, products }) {
  const toast = useToast();
  const [asked, setAsked] = useState(false);
  const steps = [
    { done: !!settings?.profile?.onboarded, label: 'Horario y mesas', to: '/panel/empezar' },
    { done: products > 0, label: 'Tu carta con al menos un plato', to: '/panel/carta' },
    { done: !!business.cover_url, label: 'Una foto de portada', to: '/panel/ajustes' },
    { done: !!business.telefono, label: 'Teléfono del local', to: '/panel/ajustes' },
    { done: !!business.notification_email, label: 'Correo para avisos de reservas', to: '/panel/ajustes' },
  ];
  const done = steps.filter((s) => s.done).length;
  const ready = done === steps.length;
  return (
    <section className="widget stack" style={{ gap: 6, boxShadow: '0 0 0 3px var(--accent)' }}>
      <div className="row between">
        <span className="stack" style={{ gap: 0 }}>
          <span className="eyebrow">Para salir publicado</span>
          <h2 className="title-lg">{ready ? '¡Todo listo!' : `${done} de ${steps.length} hechos`}</h2>
        </span>
        <Ring value={done / steps.length} color="var(--ink)" label={`${done} de ${steps.length}`} />
      </div>
      {steps.map((s) => (
        <Link key={s.label} to={s.to} className="list-row">
          <span className="mono" style={{ width: 32, height: 32, background: s.done ? 'var(--accent)' : 'var(--bg)', color: 'var(--ink)' }}>
            {s.done ? <Icon name="check" size={16} stroke={3} /> : null}
          </span>
          <span className="grow t" style={{ fontSize: 15, textDecoration: s.done ? 'line-through' : 'none', color: s.done ? 'var(--muted)' : 'var(--ink)' }}>{s.label}</span>
          {!s.done && <Icon name="chevron" size={18} />}
        </Link>
      ))}
      {ready && (
        <button className="btn primary block" disabled={asked} onClick={() => { notifyReady(business); setAsked(true); toast('Avisado. Revisamos tu página y la publicamos en cuanto podamos.'); }}>
          {asked ? 'Te avisaremos por correo' : 'Ya está, publicad mi página'}
        </button>
      )}
    </section>
  );
}

function LinkCard({ business }) {
  const toast = useToast();
  const url = bookingLink(business);
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: business.name, text: `Reserva mesa en ${business.name}`, url });
      else { await navigator.clipboard.writeText(url); toast('Enlace copiado'); }
    } catch { /* cancelled */ }
  };
  return (
    <section className="widget dark stack" style={{ gap: 8 }}>
      <span className="eyebrow" style={{ color: 'var(--accent)' }}>Tu enlace de reservas</span>
      <strong style={{ fontSize: 18, wordBreak: 'break-all' }}>{url.replace(/^https?:\/\//, '')}</strong>
      <span className="small" style={{ opacity: 0.7 }}>Pégalo en tu perfil de Google, en la bio de Instagram y en tu estado de WhatsApp. Quien lo abra reserva directo, sin comisiones.</span>
      <div className="row" style={{ gap: 8 }}>
        <button className="btn accent sm" style={{ flex: 1 }} onClick={() => navigator.clipboard?.writeText(url).then(() => toast('Enlace copiado'))}><Icon name="link" size={16} /> Copiar</button>
        <button className="btn soft sm" style={{ flex: 1 }} onClick={share}><Icon name="share" size={16} /> Compartir</button>
      </div>
    </section>
  );
}

// The restaurant's home: how many people come today, who is next, and what needs an answer.
export default function Today() {
  const { business } = useAuth();
  const { settings, modules } = useOutletContext();
  const [adding, setAdding] = useState(null);
  const [reminded, setReminded] = useState(0);
  const { data, loading, reload, setData } = useAsync(async () => {
    // Unanswered requests past their time are released before counting anything.
    await expirePending(business.name);
    const [orders, inbox, products] = await Promise.all([businessOrders(business.name), businessInbox(business.name), listProducts(business.name)]);
    return { orders, inbox, products: products.length };
  }, [business.name]);
  const actions = useBookingActions((order, status) => setData((d) => ({ ...d, orders: d.orders.map((o) => (o.id === order.id ? { ...o, status } : o)) })));

  useEffect(() => subscribe('orders', () => reload()), [reload]);
  // Tomorrow's customers get their reminder the first time the panel opens today.
  useEffect(() => { sendReminders().then(setReminded); }, [business.name]);

  if (settings && !settings.profile?.onboarded) return <Navigate to="/panel/empezar" replace />;
  if ((loading && !data) || !settings) return <Spinner />;

  const today = todayISO();
  const bookings = bookingsOf(data.orders);
  const history = new Map(customersFrom(data.orders).map((c) => [c.key, c]));
  const todays = bookings.filter((o) => o.date === today && ACTIVE_BOOKING.includes(o.status)).sort(byTime);
  const lunch = todays.filter((o) => shiftOf(o, settings) === 'comida');
  const dinner = todays.filter((o) => shiftOf(o, settings) === 'cena');
  const now = minutesToTime(new Date().getHours() * 60 + new Date().getMinutes());
  const next = todays.find((o) => o.status !== STATUS.SEATED && parseTableBooking(o).start >= now);
  const pending = bookings.filter((o) => o.status === STATUS.PENDING && o.date >= today).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  const tomorrow = bookings.filter((o) => o.date === tomorrowISO() && ACTIVE_BOOKING.includes(o.status));
  const unread = data.inbox.reduce((n, t) => n + t.unread, 0);
  const pct = profileProgress(settings.profile || {});
  const card = (o) => <BookingCard key={o.id} order={o} history={history.get(customerKey(o))} busy={actions.busy === o.id} onMove={actions.move} businessName={business.name} />;

  return (
    <div className="page">
      <PageHeader eyebrow={longDate()} title={greeting()} />

      {business.status !== 'approved' && <PublishChecklist business={business} settings={settings} products={data.products} />}
      {!business.notification_email && business.status === 'approved' && (
        <Link to="/panel/ajustes" className="widget row link" style={{ ...ROW, background: '#F3C9C9' }}>
          <Icon name="bell" size={20} />
          <span className="small grow" style={{ fontWeight: 700 }}>No tienes correo de avisos: no te enteras de las reservas nuevas. Añádelo en Ajustes.</span>
        </Link>
      )}

      <div className="two-col">
        <div className="stack">
          <section className="widget dark stack" style={{ gap: 10 }}>
            <span className="eyebrow">Hoy vienen</span>
            <span className="row" style={{ alignItems: 'baseline', gap: 10 }}>
              <span className="price" style={{ fontSize: 56, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1 }}>{guestsOf(todays)}</span>
              <span style={{ opacity: 0.7 }}>personas · {todays.length} {todays.length === 1 ? 'reserva' : 'reservas'}</span>
            </span>
            <div className="bento">
              <div className="stack" style={{ gap: 0, background: 'rgba(255,255,255,.08)', borderRadius: 16, padding: '10px 12px' }}>
                <span className="small" style={{ opacity: 0.7 }}>Comidas</span><strong style={{ fontSize: 20 }}>{guestsOf(lunch)} pers.</strong>
              </div>
              <div className="stack" style={{ gap: 0, background: 'rgba(255,255,255,.08)', borderRadius: 16, padding: '10px 12px' }}>
                <span className="small" style={{ opacity: 0.7 }}>Cenas</span><strong style={{ fontSize: 20 }}>{guestsOf(dinner)} pers.</strong>
              </div>
            </div>
            <span className="small" style={{ color: 'var(--accent)', fontWeight: 700 }}>
              {next ? `Próxima: ${parseTableBooking(next).start} · ${next.customer} · ${parseTableBooking(next).guests} pers.` : 'No quedan más llegadas hoy'}
            </span>
          </section>

          <div className="bento">
            <button className="widget link stack" onClick={() => setAdding({})} style={{ border: 0, textAlign: 'left', minHeight: 110, justifyContent: 'space-between', background: 'var(--accent)' }}>
              <span className="mono" style={{ background: 'var(--ink)', color: 'var(--accent)' }}><Icon name="phone" /></span>
              <strong style={{ fontSize: 17 }}>Apuntar reserva</strong>
            </button>
            <button className="widget link stack" onClick={() => setAdding({ walkIn: true })} style={{ border: 0, textAlign: 'left', minHeight: 110, justifyContent: 'space-between' }}>
              <span className="mono" style={{ background: 'var(--bg)', color: 'var(--ink)' }}><Icon name="users" /></span>
              <strong style={{ fontSize: 17 }}>Llega sin reserva</strong>
            </button>
          </div>

          {pending.length > 0 && (
            <section className="widget stack" style={{ gap: 10, boxShadow: '0 0 0 3px var(--accent)' }}>
              <div className="row between">
                <h2 className="title-md">Por confirmar</h2>
                <span className="count-badge accent">{pending.length}</span>
              </div>
              {pending.slice(0, 4).map(card)}
              {pending.length > 4 && <Link to="/panel/pedidos" className="btn soft sm">Ver las {pending.length}</Link>}
            </section>
          )}

          <section className="widget stack" style={{ gap: 10 }}>
            <div className="row between">
              <h2 className="title-md">Reservas de hoy</h2>
              <Link to="/panel/pedidos" className="small" style={{ fontWeight: 700 }}>Agenda</Link>
            </div>
            {todays.filter((o) => o.status !== STATUS.PENDING).length === 0
              ? <p className="small muted" style={{ margin: '0 0 6px' }}>Nada confirmado para hoy todavía.</p>
              : todays.filter((o) => o.status !== STATUS.PENDING).map(card)}
          </section>
        </div>

        <div className="stack">
          <Link to="/panel/pedidos" className="widget link row" style={ROW}>
            <span className="mono" style={{ background: 'var(--bg)', color: 'var(--ink)' }}><Icon name="calendar" /></span>
            <span className="grow stack" style={{ gap: 0 }}>
              <span className="eyebrow">Mañana</span>
              <strong style={{ fontSize: 17 }}>{tomorrow.length} {tomorrow.length === 1 ? 'reserva' : 'reservas'} · {guestsOf(tomorrow)} personas</strong>
              <span className="small muted">{reminded ? `Hemos enviado ${reminded} ${reminded === 1 ? 'recordatorio' : 'recordatorios'} por correo.` : 'Los clientes reciben un recordatorio por correo el día antes.'}</span>
            </span>
          </Link>

          {business.username && <LinkCard business={business} />}

          {unread > 0 && (
            <Link to="/panel/mensajes" className="widget link row" style={ROW}>
              <span className="mono" style={{ background: 'var(--accent)', color: 'var(--ink)' }}><Icon name="chat" /></span>
              <strong className="grow">{unread} {unread === 1 ? 'mensaje sin leer' : 'mensajes sin leer'}</strong>
              <Icon name="chevron" size={18} />
            </Link>
          )}

          {modules.menuDia && (
            <Link to="/panel/carta" className="widget link row" style={ROW}>
              <span className="mono" style={{ background: 'var(--bg)', color: 'var(--ink)' }}><Icon name="book" /></span>
              <span className="grow stack" style={{ gap: 0 }}>
                <strong>Menú del día</strong>
                <span className="small muted">{settings.daily_menu?.active !== false && settings.daily_menu?.first_courses?.length ? 'Publicado. Sale en "Hoy en Palencia".' : 'Publícalo y sal en "Hoy en Palencia".'}</span>
              </span>
              <Icon name="chevron" size={18} />
            </Link>
          )}

          {pct < 100 && (
            <Link to="/panel/personalizar" className="widget link row" style={ROW}>
              <Ring value={pct / 100} color="var(--ink)" size={44} label={`Perfil al ${pct} %`} />
              <span className="grow stack" style={{ gap: 0 }}>
                <strong>Personaliza tu restaurante</strong>
                <span className="small muted">{pct} % completado. Tus clientes ven más detalles.</span>
              </span>
              <Icon name="chevron" size={18} />
            </Link>
          )}
        </div>
      </div>

      <OwnerBookingSheet open={!!adding} initial={adding} onClose={() => setAdding(null)} business={business} settings={settings} onSaved={reload} />
    </div>
  );
}
