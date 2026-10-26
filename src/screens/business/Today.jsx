import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useOutletContext } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import BookingCard, { useBookingActions } from '../../components/BookingCard.jsx';
import OwnerBookingSheet from '../../components/OwnerBookingSheet.jsx';
import { PageHeader, Ring, Sheet, Skeleton, useToast } from '../../components/ui.jsx';
import { busyTables, DEFAULT_TABLES } from '../../components/ReserveSheet.jsx';
import { Waitlist } from './Reservations.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import useAsync from '../../hooks/useAsync.js';
import { businessInbox, businessOrders, customerNotes, expirePending, listProducts, notifyReady, saveRestaurantSettings, sendReminders, STATUS, subscribe } from '../../lib/data.js';
import { askNotifyPermission, chime, notifyPermission, unlockSound } from '../../lib/alerts.js';
import { isAllergyTag } from '../../lib/tags.js';
import { ACTIVE_BOOKING, bookingsOf, byTime, customerKey, customersFrom, guestsOf, parseTableBooking, shiftOf } from '../../lib/agenda.js';
import { greeting, longDate, minutesToTime, timeToMinutes, todayISO } from '../../lib/format.js';
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

// The blocks of the home screen. Each restaurant can reorder or hide them ("Editar").
const WIDGETS = [
  { id: 'resumen', label: 'Hoy vienen y ocupación', col: 0 },
  { id: 'acciones', label: 'Apuntar reserva / Sin reserva', col: 0 },
  { id: 'atencion', label: 'Alergias y VIP de hoy', col: 0 },
  { id: 'pendientes', label: 'Por confirmar', col: 0 },
  { id: 'hoy', label: 'Reservas de hoy', col: 0 },
  { id: 'espera', label: 'Lista de espera', col: 1 },
  { id: 'manana', label: 'Mañana', col: 1 },
  { id: 'avisos', label: 'Avisos de reservas nuevas', col: 1 },
  { id: 'enlace', label: 'Tu enlace de reservas', col: 1 },
  { id: 'mensajes', label: 'Mensajes sin leer', col: 1 },
  { id: 'menu', label: 'Menú del día', col: 1 },
  { id: 'perfil', label: 'Personaliza tu restaurante', col: 1 },
];

function layoutOf(settings) {
  const saved = settings?.profile?.hoy || {};
  const order = [...(saved.order || []).filter((id) => WIDGETS.some((w) => w.id === id)), ...WIDGETS.map((w) => w.id).filter((id) => !(saved.order || []).includes(id))];
  return { order, hidden: saved.hidden || [] };
}

function EditHome({ open, onClose, settings, business, reloadSettings }) {
  const toast = useToast();
  const [layout, setLayout] = useState(() => layoutOf(settings));
  useEffect(() => { if (open) setLayout(layoutOf(settings)); }, [open]);
  const move = (i, d) => setLayout((l) => {
    const order = l.order.slice();
    const j = i + d;
    if (j < 0 || j >= order.length) return l;
    [order[i], order[j]] = [order[j], order[i]];
    return { ...l, order };
  });
  const toggle = (id) => setLayout((l) => ({ ...l, hidden: l.hidden.includes(id) ? l.hidden.filter((x) => x !== id) : [...l.hidden, id] }));
  const save = async () => {
    try {
      await saveRestaurantSettings(business.name, { profile: { ...(settings.profile || {}), hoy: layout } });
      await reloadSettings();
      toast('Pantalla de Hoy guardada');
      onClose();
    } catch (e) {
      toast(e.message, 'error');
    }
  };
  return (
    <Sheet open={open} onClose={onClose} title="Tu pantalla de Hoy">
      <p className="small muted" style={{ marginTop: 0 }}>Ordena los bloques con las flechas y apaga los que no uses.</p>
      <div className="widget" style={{ paddingTop: 4, paddingBottom: 4 }}>
        {layout.order.map((id, i) => {
          const w = WIDGETS.find((x) => x.id === id);
          const on = !layout.hidden.includes(id);
          return (
            <div key={id} className="list-row">
              <span className="stack" style={{ gap: 2 }}>
                <button className="icon-btn" style={{ width: 30, height: 26, background: 'var(--bg)' }} disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Subir ${w.label}`}><Icon name="back" size={14} stroke={2.6} style={{ transform: 'rotate(90deg)' }} /></button>
                <button className="icon-btn" style={{ width: 30, height: 26, background: 'var(--bg)' }} disabled={i === layout.order.length - 1} onClick={() => move(i, 1)} aria-label={`Bajar ${w.label}`}><Icon name="back" size={14} stroke={2.6} style={{ transform: 'rotate(-90deg)' }} /></button>
              </span>
              <span className="grow t" style={{ opacity: on ? 1 : 0.45 }}>{w.label}</span>
              <button className={`switch ${on ? 'on' : ''}`} style={{ border: 0, padding: 0 }} role="switch" aria-checked={on} aria-label={`Mostrar ${w.label}`} onClick={() => toggle(id)}><span /></button>
            </div>
          );
        })}
      </div>
      <div className="row" style={{ gap: 8, marginTop: 12 }}>
        <button className="btn soft" style={{ flex: 1 }} onClick={() => setLayout({ order: WIDGETS.map((w) => w.id), hidden: [] })}>Restablecer</button>
        <button className="btn primary" style={{ flex: 1 }} onClick={save}>Guardar</button>
      </div>
    </Sheet>
  );
}

// Sound and system notifications for new bookings, until they are switched on.
function AlertsCard() {
  const [perm, setPerm] = useState(notifyPermission());
  if (perm !== 'default') return null;
  return (
    <section className="widget stack" style={{ gap: 8 }}>
      <span className="row" style={{ gap: 12 }}>
        <span className="mono" style={{ background: 'var(--accent)', color: 'var(--ink)' }}><Icon name="bell" /></span>
        <span className="grow stack" style={{ gap: 0 }}>
          <strong>Entérate al momento</strong>
          <span className="small muted">Suena y te avisa cuando entra una reserva, aunque estés en otra pestaña.</span>
        </span>
      </span>
      <button className="btn primary sm" onClick={async () => { unlockSound(); chime(); setPerm(await askNotifyPermission()); }}>Activar avisos</button>
    </section>
  );
}

// The restaurant's home: how many people come today, who is next, and what needs an answer.
export default function Today() {
  const { business } = useAuth();
  const { settings, modules, reloadSettings } = useOutletContext();
  const [adding, setAdding] = useState(null);
  const [editing, setEditing] = useState(false);
  const [reminded, setReminded] = useState(0);
  const { data, loading, reload, setData } = useAsync(async () => {
    // Unanswered requests past their time are released before counting anything.
    await expirePending(business.name);
    const [orders, inbox, products, profiles] = await Promise.all([businessOrders(business.name), businessInbox(business.name), listProducts(business.name), customerNotes(business.name)]);
    return { orders, inbox, products: products.length, profiles };
  }, [business.name]);
  const actions = useBookingActions((order, status) => setData((d) => ({ ...d, orders: d.orders.map((o) => (o.id === order.id ? { ...o, status } : o)) })));

  useEffect(() => subscribe('orders', () => reload()), [reload]);
  // Tomorrow's customers get their reminder the first time the panel opens today.
  useEffect(() => { sendReminders().then(setReminded); }, [business.name]);
  const layout = useMemo(() => layoutOf(settings), [settings]);

  if (settings && !settings.profile?.onboarded) return <Navigate to="/panel/empezar" replace />;
  if ((loading && !data) || !settings) return <Skeleton rows={3} />;

  const today = todayISO();
  const bookings = bookingsOf(data.orders);
  const history = new Map(customersFrom(data.orders).map((c) => [c.key, c]));
  const profiles = data.profiles || {};
  const todays = bookings.filter((o) => o.date === today && ACTIVE_BOOKING.includes(o.status)).sort(byTime);
  const lunch = todays.filter((o) => shiftOf(o, settings) === 'comida');
  const dinner = todays.filter((o) => shiftOf(o, settings) === 'cena');
  const now = minutesToTime(new Date().getHours() * 60 + new Date().getMinutes());
  const next = todays.find((o) => o.status !== STATUS.SEATED && parseTableBooking(o).start >= now);
  const pending = bookings.filter((o) => o.status === STATUS.PENDING && o.date >= today).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  const tomorrow = bookings.filter((o) => o.date === tomorrowISO() && ACTIVE_BOOKING.includes(o.status));
  const unread = data.inbox.reduce((n, t) => n + t.unread, 0);
  const pct = profileProgress(settings.profile || {});
  const card = (o, showDate) => <BookingCard key={o.id} order={o} history={history.get(customerKey(o))} profile={profiles[customerKey(o)]} busy={actions.busy === o.id} onMove={actions.move} businessName={business.name} showDate={showDate} />;

  // Seats and tables: how full each service is, and what is free right now.
  const tables = settings.tables?.length ? settings.tables : DEFAULT_TABLES;
  const seats = tables.reduce((n, t) => n + Number(t.capacity || 0), 0);
  const busyNow = busyTables(todays.filter((o) => o.status !== STATUS.PENDING), now, 1);
  const freeNow = tables.filter((t) => !busyNow.has(Number(t.table_number))).length;
  const inService = [[settings.lunch_start, settings.lunch_end], [settings.dinner_start, settings.dinner_end]]
    .some(([a, b]) => a && b && timeToMinutes(now) >= timeToMinutes(a) - 30 && timeToMinutes(now) <= timeToMinutes(b));
  const share = (list) => (seats ? Math.min(100, Math.round((guestsOf(list) / seats) * 100)) : 0);
  const watch = todays.filter((o) => (profiles[customerKey(o)]?.tags || []).length);

  const shiftBox = (label, list) => (
    <div className="stack" style={{ gap: 4, background: 'rgba(255,255,255,.08)', borderRadius: 16, padding: '10px 12px' }}>
      <span className="small" style={{ opacity: 0.7 }}>{label}</span>
      <strong style={{ fontSize: 20 }}>{guestsOf(list)}{seats ? <span style={{ opacity: 0.55, fontWeight: 600, fontSize: 14 }}> / {seats}</span> : ' pers.'}</strong>
      {seats > 0 && (
        <span style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,.14)', overflow: 'hidden' }}>
          <span style={{ display: 'block', height: '100%', width: `${share(list)}%`, background: 'var(--accent)', borderRadius: 3 }} />
        </span>
      )}
      {seats > 0 && <span className="small" style={{ opacity: 0.7 }}>{share(list)} % lleno</span>}
    </div>
  );

  const blocks = {
    resumen: (
      <section className="widget dark stack" style={{ gap: 10 }}>
        <span className="eyebrow">Hoy vienen</span>
        <span className="row" style={{ alignItems: 'baseline', gap: 10 }}>
          <span className="price" style={{ fontSize: 56, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1 }}>{guestsOf(todays)}</span>
          <span style={{ opacity: 0.7 }}>personas · {todays.length} {todays.length === 1 ? 'reserva' : 'reservas'}</span>
        </span>
        <div className="bento">
          {shiftBox('Comidas', lunch)}
          {shiftBox('Cenas', dinner)}
        </div>
        {inService && <span className="small" style={{ opacity: 0.8 }}>Ahora mismo: <strong>{freeNow} de {tables.length} mesas libres</strong></span>}
        <span className="small" style={{ color: 'var(--accent)', fontWeight: 700 }}>
          {next ? `Próxima: ${parseTableBooking(next).start} · ${next.customer} · ${parseTableBooking(next).guests} pers.` : 'No quedan más llegadas hoy'}
        </span>
      </section>
    ),
    acciones: (
      <div className="bento">
        <button className="widget link stack" onClick={() => setAdding({})} style={{ border: 0, textAlign: 'left', minHeight: 110, justifyContent: 'space-between', background: 'var(--accent)' }}>
          <span className="mono" style={{ background: '#111', color: 'var(--accent)' }}><Icon name="phone" /></span>
          <strong style={{ fontSize: 17 }}>Apuntar reserva</strong>
        </button>
        <button className="widget link stack" onClick={() => setAdding({ walkIn: true })} style={{ border: 0, textAlign: 'left', minHeight: 110, justifyContent: 'space-between' }}>
          <span className="mono" style={{ background: 'var(--bg)', color: 'var(--ink)' }}><Icon name="users" /></span>
          <strong style={{ fontSize: 17 }}>Llega sin reserva</strong>
        </button>
      </div>
    ),
    atencion: watch.length > 0 && (
      <section className="widget stack" style={{ gap: 8 }}>
        <h2 className="title-md">Ojo hoy</h2>
        {watch.map((o) => {
          const tags = profiles[customerKey(o)].tags;
          return (
            <div key={o.id} className="list-row" style={{ alignItems: 'flex-start' }}>
              <span style={{ fontWeight: 800, minWidth: 48 }}>{parseTableBooking(o).start}</span>
              <span className="grow stack" style={{ gap: 4 }}>
                <strong>{o.customer} · {parseTableBooking(o).guests} pers.</strong>
                <span className="row" style={{ gap: 4, flexWrap: 'wrap' }}>
                  {tags.map((t) => <span key={t} className={`tag${isAllergyTag(t) ? ' alert' : t === 'VIP' ? ' vip' : ''}`} style={{ background: isAllergyTag(t) || t === 'VIP' ? undefined : 'var(--bg)' }}>{t}</span>)}
                </span>
              </span>
            </div>
          );
        })}
      </section>
    ),
    pendientes: pending.length > 0 && (
      <section className="widget stack" style={{ gap: 10, boxShadow: '0 0 0 3px var(--accent)' }}>
        <div className="row between">
          <h2 className="title-md">Por confirmar</h2>
          <span className="count-badge accent">{pending.length}</span>
        </div>
        {pending.slice(0, 4).map((o) => card(o, o.date === today ? 'Hoy' : new Date(`${o.date}T12:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })))}
        {pending.length > 4 && <Link to="/panel/pedidos" className="btn soft sm">Ver las {pending.length}</Link>}
      </section>
    ),
    hoy: (
      <section className="widget stack" style={{ gap: 10 }}>
        <div className="row between">
          <h2 className="title-md">Reservas de hoy</h2>
          <Link to="/panel/pedidos?ver=linea" className="small" style={{ fontWeight: 700 }}>Ver línea del día</Link>
        </div>
        {todays.filter((o) => o.status !== STATUS.PENDING).length === 0
          ? <p className="small muted" style={{ margin: '0 0 6px' }}>Nada confirmado para hoy todavía.</p>
          : todays.filter((o) => o.status !== STATUS.PENDING).map((o) => card(o))}
      </section>
    ),
    espera: <WaitlistToday business={business} />,
    manana: (
      <Link to="/panel/pedidos" className="widget link row" style={ROW}>
        <span className="mono" style={{ background: 'var(--bg)', color: 'var(--ink)' }}><Icon name="calendar" /></span>
        <span className="grow stack" style={{ gap: 0 }}>
          <span className="eyebrow">Mañana</span>
          <strong style={{ fontSize: 17 }}>{tomorrow.length} {tomorrow.length === 1 ? 'reserva' : 'reservas'} · {guestsOf(tomorrow)} personas</strong>
          <span className="small muted">{reminded ? `Hemos enviado ${reminded} ${reminded === 1 ? 'recordatorio' : 'recordatorios'} por correo.` : 'Los clientes reciben un recordatorio por correo el día antes.'}</span>
        </span>
      </Link>
    ),
    avisos: <AlertsCard />,
    enlace: business.username && <LinkCard business={business} />,
    mensajes: unread > 0 && (
      <Link to="/panel/mensajes" className="widget link row" style={ROW}>
        <span className="mono" style={{ background: 'var(--accent)', color: 'var(--ink)' }}><Icon name="chat" /></span>
        <strong className="grow">{unread} {unread === 1 ? 'mensaje sin leer' : 'mensajes sin leer'}</strong>
        <Icon name="chevron" size={18} />
      </Link>
    ),
    menu: modules.menuDia && (
      <Link to="/panel/carta" className="widget link row" style={ROW}>
        <span className="mono" style={{ background: 'var(--bg)', color: 'var(--ink)' }}><Icon name="book" /></span>
        <span className="grow stack" style={{ gap: 0 }}>
          <strong>Menú del día</strong>
          <span className="small muted">{settings.daily_menu?.active !== false && settings.daily_menu?.first_courses?.length ? 'Publicado. Sale en "Hoy en Palencia".' : 'Publícalo y sal en "Hoy en Palencia".'}</span>
        </span>
        <Icon name="chevron" size={18} />
      </Link>
    ),
    perfil: pct < 100 && (
      <Link to="/panel/personalizar" className="widget link row" style={ROW}>
        <Ring value={pct / 100} color="var(--ink)" size={44} label={`Perfil al ${pct} %`} />
        <span className="grow stack" style={{ gap: 0 }}>
          <strong>Personaliza tu restaurante</strong>
          <span className="small muted">{pct} % completado. Tus clientes ven más detalles.</span>
        </span>
        <Icon name="chevron" size={18} />
      </Link>
    ),
  };
  const column = (col) => layout.order
    .filter((id) => !layout.hidden.includes(id) && WIDGETS.find((w) => w.id === id).col === col && blocks[id])
    .map((id) => <Fragment key={id}>{blocks[id]}</Fragment>);

  return (
    <div className="page">
      <PageHeader eyebrow={longDate()} title={greeting()}
        right={<button className="btn soft sm" onClick={() => setEditing(true)} aria-label="Editar la pantalla de Hoy">Editar</button>} />

      {business.status !== 'approved' && <PublishChecklist business={business} settings={settings} products={data.products} />}
      {!business.notification_email && business.status === 'approved' && (
        <Link to="/panel/ajustes" className="widget row link" style={{ ...ROW, background: 'var(--danger-soft)' }}>
          <Icon name="bell" size={20} />
          <span className="small grow" style={{ fontWeight: 700 }}>No tienes correo de avisos: no te enteras de las reservas nuevas. Añádelo en Ajustes.</span>
        </Link>
      )}

      <div className="two-col">
        <div className="stack">{column(0)}</div>
        <div className="stack">{column(1)}</div>
      </div>

      <OwnerBookingSheet open={!!adding} initial={adding} onClose={() => setAdding(null)} business={business} settings={settings} onSaved={reload} />
      <EditHome open={editing} onClose={() => setEditing(false)} settings={settings} business={business} reloadSettings={reloadSettings} />
    </div>
  );
}

// Today's waiting list, in its own card; nothing shows when nobody is waiting.
function WaitlistToday({ business }) {
  return <Waitlist day={todayISO()} business={business} framed title={<h2 className="title-md">Lista de espera de hoy</h2>} />;
}
