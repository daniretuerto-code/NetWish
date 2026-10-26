import { useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext, useSearchParams } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import BookingCard, { StatusChip, useBookingActions } from '../../components/BookingCard.jsx';
import OwnerBookingSheet from '../../components/OwnerBookingSheet.jsx';
import { busyTables, DEFAULT_TABLES } from '../../components/ReserveSheet.jsx';
import { Empty, PageHeader, Sheet, Spinner, useToast } from '../../components/ui.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import useAsync from '../../hooks/useAsync.js';
import { businessOrders, businessWaitlist, customerNotes, reservationsOn, setWaitlistStatus, saveCustomerNote, saveRestaurantSettings, setOrderItems, STATUS, subscribe } from '../../lib/data.js';
import FloorPlan from '../../components/FloorPlan.jsx';
import { joinPairs, placeTables, zoneHeight, zoneOf, zonesOf } from '../../lib/floor.js';
import { tableLabel, blockFor, ACTIVE_BOOKING, bookingsOf, byTime, customerKey, customersFrom, dayLabel, guestsOf, parseTableBooking, shiftOf, telLink, whatsappLink } from '../../lib/agenda.js';
import { nextDays } from '../../lib/booking.js';
import { minutesToTime, normalize, timeToMinutes, todayISO } from '../../lib/format.js';
import Orders from './Orders.jsx';

const nowHHMM = () => {
  const d = new Date();
  return minutesToTime(d.getHours() * 60 + d.getMinutes());
};

// "Completo": close a day's lunch or dinner to online bookings. Phone bookings still go in.
function DayOnline({ day, settings, business, reloadSettings }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const block = blockFor(settings, day);
  const shifts = [['comida', 'Comidas', settings.lunch_start], ['cena', 'Cenas', settings.dinner_start]].filter((x) => x[2]);
  const toggle = async (shift) => {
    setBusy(true);
    const others = (settings.blocks || []).filter((b) => b.date >= todayISO() && !(b.date === day && (b.shift === shift || b.shift === 'todo')));
    const keep = block.todo ? shifts.map((x) => x[0]).filter((x) => x !== shift).map((x) => ({ date: day, shift: x })) : [];
    const blocks = block[shift] ? [...others, ...keep] : [...others, { date: day, shift }];
    try {
      await saveRestaurantSettings(business.name, { blocks });
      await reloadSettings();
      toast(block[shift] ? 'Abierto otra vez a reservas online' : 'Cerrado a reservas online');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
      <span className="small muted" style={{ fontWeight: 600 }}>Online:</span>
      {shifts.map(([k, label]) => (
        <button key={k} className="pill" disabled={busy} onClick={() => toggle(k)} aria-pressed={block[k]}
          style={{ minWidth: 0, height: 32, background: block[k] ? '#F3C9C9' : 'var(--bg)', color: block[k] ? '#8E2B2B' : 'var(--ink)' }}>
          {block[k] ? `${label}: completo` : `${label}: abiertas`}
        </button>
      ))}
    </div>
  );
}

// Move a booking to another table that is free at that time.
function ChangeTableSheet({ order, settings, business, onClose, onDone }) {
  const toast = useToast();
  const [busyList, setBusyList] = useState(null);
  const b = order ? parseTableBooking(order) : null;
  useEffect(() => {
    if (!order) return;
    setBusyList(null);
    reservationsOn(business.name, order.date).then((list) => {
      const others = list.filter((x) => !(x.time === order.time && x.items === order.items.split(' · Nota:')[0]));
      setBusyList(busyTables(others, b.start, (settings.turn_duration_min || 90)));
    });
  }, [order?.id]);
  if (!order) return null;
  const tables = settings?.tables?.length ? settings.tables : DEFAULT_TABLES;
  const pairs = joinPairs(tables).filter(([x, y]) => Number(x.capacity) + Number(y.capacity) >= b.guests);
  const move = async (t, other) => {
    const label = tableLabel(other ? [t.table_number, other.table_number] : [t.table_number], zoneOf(t));
    const items = /Mesas? \d+/.test(order.items)
      ? order.items.replace(/Mesas? [\d+]+( \([^)]*\))?/, label)
      : order.items.replace(/(\d+\s*pax)/i, `$1 — ${label}`);
    try {
      await setOrderItems(order.id, items);
      toast(other ? `Pasada a las mesas ${t.table_number}+${other.table_number}` : `Pasada a la mesa ${t.table_number}`);
      onDone(order, items);
      onClose();
    } catch (e) {
      toast(e.message, 'error');
    }
  };
  return (
    <Sheet open onClose={onClose} title={`Cambiar mesa · ${order.customer}`}>
      <p className="small muted" style={{ marginTop: 0 }}>{b.guests} personas · {b.start}. Ahora: {b.table ? tableLabel(b.tables) : 'sin mesa'}.</p>
      {!busyList ? <Spinner /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))', gap: 8 }}>
          {pairs.filter(([x, y]) => !busyList.has(Number(x.table_number)) && !busyList.has(Number(y.table_number))).map(([x, y]) => (
            <button key={`${x.table_number}+${y.table_number}`} className="pill" onClick={() => move(x, y)}
              style={{ minWidth: 0, height: 56, flexDirection: 'column', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--accent)', boxShadow: 'inset 0 0 0 1px var(--line)' }}>
              <span style={{ fontSize: 17 }}>{x.table_number}+{y.table_number}</span>
              <span style={{ fontSize: 11, fontWeight: 600 }}>juntas · {Number(x.capacity) + Number(y.capacity)}</span>
            </button>
          ))}
          {tables.filter((t) => !(b.tables.length === 1 && Number(t.table_number) === Number(b.table))).map((t) => {
            const taken = busyList.has(Number(t.table_number));
            return (
              <button key={t.table_number} className="pill" disabled={taken} onClick={() => move(t)}
                style={{ minWidth: 0, height: 56, flexDirection: 'column', display: 'flex', alignItems: 'center', justifyContent: 'center', background: taken ? 'var(--bg)' : Number(t.capacity) >= b.guests ? 'var(--accent)' : 'var(--surface)', color: taken ? '#B5B1A8' : 'var(--ink)', boxShadow: 'inset 0 0 0 1px var(--line)' }}>
                <span style={{ fontSize: 17 }}>Mesa {t.table_number}</span>
                <span style={{ fontSize: 11, fontWeight: 600 }}>{taken ? 'ocupada' : `${t.capacity} plazas`}</span>
              </button>
            );
          })}
        </div>
      )}
    </Sheet>
  );
}

// Close a range of days at once: holidays, a family celebration, works in the kitchen.
function CloseDaysSheet({ open, onClose, settings, business, reloadSettings }) {
  const toast = useToast();
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(todayISO());
  const [busy, setBusy] = useState(false);
  const save = async (e) => {
    e.preventDefault();
    if (to < from) return toast('La fecha final va después de la inicial', 'error');
    const days = [];
    for (let d = new Date(`${from}T12:00:00`); days.length < 120; d.setDate(d.getDate() + 1)) {
      const iso = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
      if (iso > to) break;
      days.push(iso);
    }
    const blocks = [...(settings.blocks || []).filter((b) => b.date >= todayISO() && !days.includes(b.date)), ...days.map((date) => ({ date, shift: 'todo' }))];
    setBusy(true);
    try {
      await saveRestaurantSettings(business.name, { blocks });
      await reloadSettings();
      toast(`${days.length} ${days.length === 1 ? 'día cerrado' : 'días cerrados'} a reservas online`);
      onClose();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  const closedAhead = (settings.blocks || []).filter((b) => b.shift === 'todo' && b.date >= todayISO()).map((b) => b.date).sort();
  const reopen = async (date) => {
    await saveRestaurantSettings(business.name, { blocks: (settings.blocks || []).filter((b) => b.date !== date) });
    await reloadSettings();
  };
  return (
    <Sheet open={open} onClose={onClose} title="Cerrar varios días">
      <form className="stack" onSubmit={save}>
        <p className="small muted" style={{ margin: 0 }}>Vacaciones, festivos o un evento privado. Esos días nadie podrá reservar online.</p>
        <div className="bento">
          <div className="field"><label htmlFor="cd-from">Desde</label><input id="cd-from" className="input" type="date" min={todayISO()} value={from} onChange={(e) => { setFrom(e.target.value); if (to < e.target.value) setTo(e.target.value); }} /></div>
          <div className="field"><label htmlFor="cd-to">Hasta</label><input id="cd-to" className="input" type="date" min={from} value={to} onChange={(e) => setTo(e.target.value)} /></div>
        </div>
        <button className="btn primary block" disabled={busy}>{busy ? 'Guardando…' : 'Cerrar esos días'}</button>
      </form>
      {closedAhead.length > 0 && (
        <div className="stack" style={{ gap: 6, marginTop: 14 }}>
          <span className="eyebrow">Días cerrados</span>
          <div className="chips" style={{ flexWrap: 'wrap' }}>
            {closedAhead.map((d) => <button key={d} className="chip" style={{ background: '#F3C9C9' }} onClick={() => reopen(d)} aria-label={`Abrir el ${d}`}>{new Date(`${d}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })} ✕</button>)}
          </div>
        </div>
      )}
    </Sheet>
  );
}

function Waitlist({ day, business }) {
  const toast = useToast();
  const { data, setData } = useAsync(() => businessWaitlist(business.name), [business.name]);
  const list = (data || []).filter((w) => w.date === day && w.status === 'esperando');
  if (!list.length) return null;
  const done = async (w, status) => {
    try {
      await setWaitlistStatus(w.id, status);
      setData((all) => all.map((x) => (x.id === w.id ? { ...x, status } : x)));
    } catch (e) {
      toast(e.message, 'error');
    }
  };
  return (
    <div className="stack" style={{ gap: 8 }}>
      <span className="eyebrow">Lista de espera · {list.length}</span>
      {list.map((w) => (
        <div key={w.id} className="order-card">
          <span className="row between"><strong>{w.name}</strong><span className="small" style={{ fontWeight: 700 }}>{w.guests} pers. · {w.shift === 'comida' ? 'comida' : 'cena'}</span></span>
          {w.notified_at && <span className="small muted">Le avisamos por correo de que se liberó una mesa{w.freed_time ? ` a las ${w.freed_time}` : ''}.</span>}
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            {w.phone && <a className="btn soft sm" href={telLink(w.phone)}><Icon name="phone" size={15} /> Llamar</a>}
            {w.phone && <a className="btn soft sm" href={whatsappLink(w.phone, `Hola ${w.name}, te escribimos de ${business.name}: se ha liberado una mesa para ${w.guests}. ¿Os la guardamos?`)} target="_blank" rel="noreferrer"><Icon name="chat" size={15} /> WhatsApp</a>}
            {!w.phone && w.email && <a className="btn soft sm" href={`mailto:${w.email}`}><Icon name="mail" size={15} /> Correo</a>}
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn primary sm" style={{ flex: 1 }} onClick={() => done(w, 'avisado')}>Avisado</button>
            <button className="btn ghost sm" style={{ flex: 1 }} onClick={() => done(w, 'descartado')}>Quitar</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function Agenda({ bookings, history, actions, settings, business, onAdd, onChangeTable, reloadSettings }) {
  const today = todayISO();
  const [day, setDay] = useState(today);
  const [showOld, setShowOld] = useState(false);
  const [closing, setClosing] = useState(false);
  const pending = bookings.filter((o) => o.status === STATUS.PENDING && o.date >= today).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  const ofDay = bookings.filter((o) => o.date === day).sort(byTime);
  const active = ofDay.filter((o) => ACTIVE_BOOKING.includes(o.status));
  const closed = ofDay.filter((o) => !ACTIVE_BOOKING.includes(o.status));
  const shifts = ['comida', 'cena'].map((s) => ({ key: s, list: active.filter((o) => shiftOf(o, settings) === s) })).filter((s) => s.list.length);
  const card = (o, showDate) => (
    <BookingCard key={o.id} order={o} history={history.get(customerKey(o))} busy={actions.busy === o.id} onMove={actions.move} onChangeTable={onChangeTable} businessName={business.name} showDate={showDate} />
  );

  return (
    <>
      {pending.length > 0 && (
        <section className="widget stack" style={{ gap: 10, boxShadow: '0 0 0 3px var(--accent)' }}>
          <div className="row between">
            <h2 className="title-md">Por confirmar</h2>
            <span className="count-badge accent">{pending.length}</span>
          </div>
          {pending.map((o) => card(o, o.date === today ? 'Hoy' : new Date(`${o.date}T12:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })))}
        </section>
      )}

      <div className="chips" role="tablist" aria-label="Día">
        {nextDays(21).map((d) => {
          const n = guestsOf(bookings.filter((o) => o.date === d.iso && ACTIVE_BOOKING.includes(o.status)));
          const on = day === d.iso;
          return (
            <button key={d.iso} role="tab" aria-selected={on} onClick={() => setDay(d.iso)} className="stack"
              style={{ gap: 0, alignItems: 'center', justifyContent: 'center', minWidth: 58, height: 70, borderRadius: 20, border: 0, background: on ? 'var(--ink)' : 'var(--surface)', color: on ? '#fff' : 'var(--ink)', flex: '0 0 auto' }}>
              <span className="small" style={{ fontWeight: 700, opacity: 0.7 }}>{d.weekday}</span>
              <span style={{ fontSize: 20, fontWeight: 800 }}>{d.day}</span>
              <span style={{ fontSize: 11, fontWeight: 800, color: on ? 'var(--accent)' : n ? 'var(--ink)' : 'var(--muted)' }}>{n ? `${n} p.` : '·'}</span>
            </button>
          );
        })}
      </div>

      <section className="widget stack" style={{ gap: 10 }}>
        <div className="row between" style={{ alignItems: 'flex-start' }}>
          <span className="stack" style={{ gap: 0 }}>
            <h2 className="title-lg">{dayLabel(day, today)}</h2>
            <span className="small muted">{active.length} {active.length === 1 ? 'reserva' : 'reservas'} · {guestsOf(active)} personas</span>
          </span>
          <button className="btn primary sm" onClick={() => onAdd({ date: day })}><Icon name="plus" size={16} /> Reserva</button>
        </div>
        <DayOnline day={day} settings={settings} business={business} reloadSettings={reloadSettings} />
        <button className="btn ghost sm" style={{ alignSelf: 'flex-start', height: 'auto', padding: 0, textDecoration: 'underline' }} onClick={() => setClosing(true)}>Cerrar varios días (vacaciones, festivos)</button>
        <Waitlist day={day} business={business} />
        {active.length === 0 && <p className="small muted" style={{ margin: '4px 0 8px' }}>No hay reservas este día.</p>}
        {shifts.map((s) => (
          <div key={s.key} className="stack" style={{ gap: 8 }}>
            <span className="eyebrow">{s.key === 'comida' ? 'Comidas' : 'Cenas'} · {guestsOf(s.list)} personas</span>
            {s.list.map((o) => card(o))}
          </div>
        ))}
        {closed.length > 0 && (
          <button className="btn ghost sm" onClick={() => setShowOld((v) => !v)}>{showOld ? 'Ocultar' : `Ver canceladas y terminadas (${closed.length})`}</button>
        )}
        {showOld && closed.map((o) => card(o))}
      </section>
      <CloseDaysSheet open={closing} onClose={() => setClosing(false)} settings={settings} business={business} reloadSettings={reloadSettings} />
    </>
  );
}

function Hall({ bookings, settings, actions, history, business, onAdd, onChangeTable }) {
  const today = todayISO();
  const zones = zonesOf({ ...settings, tables: settings?.tables?.length ? settings.tables : DEFAULT_TABLES });
  const items = settings?.floor?.items || [];
  const tables = placeTables(settings?.tables?.length ? settings.tables : DEFAULT_TABLES, zones, items);
  const shiftTimes = [settings.lunch_start, settings.dinner_start].filter(Boolean);
  const [at, setAt] = useState(nowHHMM());
  const [open, setOpen] = useState(null);
  const [zoneName, setZoneName] = useState(null);
  const [zoom, setZoom] = useState(1);
  const zone = zones.find((z) => z.name === zoneName) || zones[0];
  const todays = bookings.filter((o) => o.date === today && ACTIVE_BOOKING.includes(o.status));

  const stateOf = (t) => {
    const m = timeToMinutes(at);
    const hits = todays.filter((o) => {
      const b = parseTableBooking(o);
      if (!b.tables.includes(Number(t.table_number))) return false;
      const s = timeToMinutes(b.start);
      const e = b.end ? timeToMinutes(b.end) : s + (settings.turn_duration_min || 90);
      return s - 30 <= m && m < (o.status === STATUS.SEATED ? e + 60 : e);
    });
    return hits.find((o) => o.status === STATUS.SEATED) || hits[0] || null;
  };
  const current = open && todays.find((o) => o.id === open);
  const look = (t) => {
    const o = stateOf(t);
    if (!o) return { badge: `${t.capacity} pl.`, badgeBg: 'rgba(255,255,255,0.92)', badgeFg: '#111' };
    const seated = o.status === STATUS.SEATED;
    const color = seated ? '#2F8F5B' : o.status === STATUS.PENDING ? '#C9A400' : '#111111';
    return { ring: color, badge: `${parseTableBooking(o).start} ${o.customer.split(' ')[0]}`, badgeBg: color, badgeFg: '#fff' };
  };
  const zoneCount = (z) => tables.filter((t) => zoneOf(t) === z.name && stateOf(t)).length;

  return (
    <>
      <div className="chips">
        <button className={`chip ${at === nowHHMM() ? 'on' : ''}`} onClick={() => setAt(nowHHMM())}>Ahora</button>
        {shiftTimes.flatMap((t) => [t, minutesToTime(timeToMinutes(t) + 60)]).sort().map((t) => <button key={t} className={`chip ${at === t ? 'on' : ''}`} onClick={() => setAt(t)}>{t}</button>)}
      </div>
      {zones.length > 1 && (
        <div className="segmented" role="tablist" aria-label="Zona">
          {zones.map((z) => (
            <button key={z.name} role="tab" aria-selected={z.name === zone.name} onClick={() => setZoneName(z.name)}>
              {z.name}{zoneCount(z) ? ` · ${zoneCount(z)}` : ''}{z.outdoor && z.open === false ? ' (cerrada)' : ''}
            </button>
          ))}
        </div>
      )}
      <div className="row" style={{ gap: 14, flexWrap: 'wrap', padding: '0 4px' }}>
        {[['var(--surface)', 'Libre'], ['#C9A400', 'Por confirmar'], ['var(--ink)', 'Reservada'], ['#2F8F5B', 'Sentados']].map(([c, l]) => (
          <span key={l} className="row small" style={{ gap: 6, fontWeight: 600 }}><span style={{ width: 14, height: 14, borderRadius: 4, background: c, boxShadow: 'inset 0 0 0 1px var(--line)' }} />{l}</span>
        ))}
      </div>
      <div className="row" style={{ gap: 6, justifyContent: 'flex-end' }}>
        <button className="icon-btn" style={{ width: 36, height: 36 }} disabled={zoom <= 1} onClick={() => setZoom((z) => Math.max(1, z - 0.5))} aria-label="Alejar"><Icon name="minus" size={16} /></button>
        <button className="icon-btn" style={{ width: 36, height: 36 }} disabled={zoom >= 3} onClick={() => setZoom((z) => Math.min(3, z + 0.5))} aria-label="Acercar"><Icon name="plus" size={16} /></button>
      </div>
      <section className="widget" style={{ padding: 10 }}>
        <FloorPlan zoom={zoom} zone={zone} height={zoneHeight(zone, tables, items)} tables={tables} items={items} look={look}
          onTableClick={(t) => { const o = stateOf(t); return o ? setOpen(o.id) : onAdd({ walkIn: true, table: t.table_number }); }} />
      </section>
      <p className="small muted" style={{ margin: '0 4px' }}>Toca una mesa libre para sentar a alguien que llega sin reserva. El plano se cambia en <Link to="/panel/mesas">Tu sala</Link>.</p>
      <Sheet open={!!current} onClose={() => setOpen(null)} title={current ? tableLabel(parseTableBooking(current).tables) : ''}>
        {current && <BookingCard order={current} history={history.get(customerKey(current))} busy={actions.busy === current.id} onMove={(o, s) => { actions.move(o, s); setOpen(null); }} onChangeTable={(o) => { setOpen(null); onChangeTable(o); }} businessName={business.name} />}
      </Sheet>
    </>
  );
}

const WEEKDAYS_LONG = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

// The last 30 days in numbers: who came, who didn't, and which days are quiet.
function Stats({ bookings, settings }) {
  const today = todayISO();
  const from = (() => { const d = new Date(`${today}T12:00:00`); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10); })();
  const past = bookings.filter((o) => o.date >= from && o.date < today);
  const came = past.filter((o) => [STATUS.DONE, STATUS.SEATED, STATUS.CONFIRMED].includes(o.status));
  const noShow = past.filter((o) => o.status === STATUS.NOSHOW).length;
  const cancelled = past.filter((o) => o.status === STATUS.CANCELLED).length;
  const online = past.filter((o) => !o.source || o.source === 'app').length;
  const counted = came.length + noShow;
  const diners = guestsOf(came);
  const customers = customersFrom(past);
  const returning = customers.filter((c) => c.bookings.filter((o) => [STATUS.DONE, STATUS.SEATED, STATUS.CONFIRMED].includes(o.status)).length > 1).length;
  const byDay = WEEKDAYS_LONG.map((label, i) => ({ label, n: guestsOf(came.filter((o) => new Date(`${o.date}T12:00:00`).getDay() === i)) }));
  const top = Math.max(1, ...byDay.map((d) => d.n));
  const order = [1, 2, 3, 4, 5, 6, 0].filter((i) => !(settings.closed_days || []).includes(i));
  const tile = (label, value, sub, tone) => (
    <div className="widget tight stack" style={{ gap: 0, background: tone }}>
      <span className="eyebrow">{label}</span>
      <span className="title-lg">{value}</span>
      {sub && <span className="small muted">{sub}</span>}
    </div>
  );
  if (!past.length) return <div className="widget"><Empty icon="chart" title="Aún no hay datos">En cuanto tengas reservas verás aquí tus números de los últimos 30 días.</Empty></div>;
  return (
    <>
      <p className="small muted" style={{ margin: '0 4px' }}>Últimos 30 días</p>
      <div className="bento">
        {tile('Comensales', diners, `${came.length} ${came.length === 1 ? 'reserva' : 'reservas'}`)}
        {tile('Por persona', came.length ? (diners / came.length).toFixed(1) : '0', 'personas por mesa')}
        {tile('No vinieron', counted ? `${Math.round((noShow / counted) * 100)} %` : '0 %', `${noShow} ${noShow === 1 ? 'reserva' : 'reservas'}`, noShow ? '#F3C9C9' : undefined)}
        {tile('Cancelaron', cancelled, 'con aviso')}
        {tile('Por NetWish', past.length ? `${Math.round((online / past.length) * 100)} %` : '0 %', 'del total de reservas')}
        {tile('Repiten', customers.length ? `${Math.round((returning / customers.length) * 100)} %` : '0 %', `${returning} de ${customers.length} clientes`)}
      </div>
      <section className="widget stack" style={{ gap: 8 }}>
        <h2 className="title-md">Comensales por día de la semana</h2>
        {order.map((i) => (
          <div key={i} className="row" style={{ gap: 10 }}>
            <span className="small" style={{ width: 82, fontWeight: 600 }}>{byDay[i].label}</span>
            <span className="grow" style={{ background: 'var(--bg)', borderRadius: 8, height: 22, overflow: 'hidden' }}>
              <span style={{ display: 'block', height: '100%', width: `${(byDay[i].n / top) * 100}%`, background: byDay[i].n === top ? 'var(--ink)' : 'var(--accent)', borderRadius: 8 }} />
            </span>
            <span className="small" style={{ width: 32, textAlign: 'right', fontWeight: 800 }}>{byDay[i].n}</span>
          </div>
        ))}
        <span className="small muted">Los días con la barra más corta son los mejores para un menú especial o una promoción.</span>
      </section>
    </>
  );
}

function Customers({ orders, business }) {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null);
  const [note, setNote] = useState('');
  const { data: notes, setData: setNotes } = useAsync(() => customerNotes(business.name), [business.name]);
  const list = useMemo(() => customersFrom(orders)
    .map((c) => ({ ...c, latest: c.bookings.map((o) => o.date).sort().pop() }))
    .sort((a, b) => String(b.latest).localeCompare(String(a.latest))), [orders]);
  const shown = list.filter((c) => !q || normalize(`${c.name} ${c.phone || ''} ${c.email || ''}`).includes(normalize(q)));
  const current = open && list.find((c) => c.key === open);

  const exportCsv = () => {
    const rows = [['Nombre', 'Teléfono', 'Correo', 'Visitas', 'No vino', 'Última visita'], ...list.map((c) => [c.name, c.phone || '', c.email || '', c.visits, c.noShows, c.last])];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n');
    const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `clientes-${business.username || 'netwish'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const saveNote = async () => {
    try {
      await saveCustomerNote(business.name, current.key, note.trim().slice(0, 500));
      setNotes({ ...(notes || {}), [current.key]: note.trim() });
      toast('Nota guardada');
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  if (list.length === 0) return <div className="widget"><Empty icon="users" title="Aún no tienes clientes">Cada persona que reserve, por NetWish o por teléfono, aparecerá aquí con sus visitas.</Empty></div>;

  return (
    <>
      <div className="row" style={{ gap: 8 }}>
        <input className="input grow" type="search" placeholder="Buscar por nombre o teléfono" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar cliente" />
        <button className="btn soft sm" onClick={exportCsv}><Icon name="download" size={16} /> Descargar</button>
      </div>
      <div className="widget" style={{ paddingBottom: 4 }}>
        <p className="small muted" style={{ margin: '0 0 4px' }}>{list.length} clientes. Son tuyos: puedes descargarlos cuando quieras.</p>
        {shown.map((c) => (
          <button key={c.key} className="list-row" onClick={() => { setOpen(c.key); setNote(notes?.[c.key] || ''); }}>
            <span className="grow stack" style={{ gap: 1, minWidth: 0 }}>
              <span className="t">{c.name}</span>
              <span className="s">{[c.phone, c.email].filter(Boolean).join(' · ') || 'Sin contacto'}{notes?.[c.key] ? ` · ${notes[c.key]}` : ''}</span>
            </span>
            <span className="stack" style={{ gap: 1, alignItems: 'flex-end' }}>
              <span className="small" style={{ fontWeight: 800 }}>{c.visits} {c.visits === 1 ? 'visita' : 'visitas'}</span>
              {c.noShows > 0 && <span className="small" style={{ fontWeight: 700, color: '#8E2B2B' }}>No vino {c.noShows}</span>}
            </span>
          </button>
        ))}
      </div>
      <Sheet open={!!current} onClose={() => setOpen(null)} title={current?.name || ''}>
        {current && (
          <div className="stack">
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              {current.phone && <a className="btn soft sm" href={telLink(current.phone)}><Icon name="phone" size={15} /> Llamar</a>}
              {current.phone && <a className="btn soft sm" href={whatsappLink(current.phone, `Hola ${current.name}, te escribimos de ${business.name}.`)} target="_blank" rel="noreferrer"><Icon name="chat" size={15} /> WhatsApp</a>}
              {current.email && <a className="btn soft sm" href={`mailto:${current.email}`}><Icon name="mail" size={15} /> Correo</a>}
            </div>
            <div className="bento">
              <div className="widget tight stack" style={{ gap: 0, background: 'var(--bg)' }}><span className="eyebrow">Visitas</span><span className="title-lg">{current.visits}</span></div>
              <div className="widget tight stack" style={{ gap: 0, background: current.noShows ? '#F3C9C9' : 'var(--bg)' }}><span className="eyebrow">No vino</span><span className="title-lg">{current.noShows}</span></div>
            </div>
            <div className="field">
              <label htmlFor="cn-note">Nota privada (solo la ves tú)</label>
              <textarea id="cn-note" className="input" rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej.: alergia al marisco, prefiere terraza" />
            </div>
            <button className="btn primary block" onClick={saveNote}>Guardar nota</button>
            <span className="eyebrow">Historial</span>
            {current.bookings.slice().sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`)).map((o) => (
              <div key={o.id} className="list-row">
                <span className="grow stack" style={{ gap: 1 }}>
                  <span className="t">{new Date(`${o.date}T12:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })} · {parseTableBooking(o).start}</span>
                  <span className="s">{parseTableBooking(o).guests} personas</span>
                </span>
                <StatusChip status={o.status} />
              </div>
            ))}
          </div>
        )}
      </Sheet>
    </>
  );
}

// The restaurant's bookings: the agenda by day, the hall right now and its customers.
export default function Reservations() {
  const { business } = useAuth();
  const { settings, modules, reloadSettings } = useOutletContext();
  const [params, setParams] = useSearchParams();
  const [moving, setMoving] = useState(null);
  const tab = params.get('ver') || 'agenda';
  const [adding, setAdding] = useState(null);
  const { data, loading, reload, setData } = useAsync(() => businessOrders(business.name), [business.name]);
  const orders = data || [];
  const actions = useBookingActions((order, status) => setData((list) => (list || []).map((o) => (o.id === order.id ? { ...o, status } : o))));

  useEffect(() => subscribe('orders', () => reload()), [reload]);

  const bookings = bookingsOf(orders);
  const history = useMemo(() => new Map(customersFrom(orders).map((c) => [c.key, c])), [orders]);
  if ((loading && !data) || !settings) return <Spinner />;

  const tabs = [
    ['agenda', 'Agenda'], ['sala', 'Sala'], ['clientes', 'Clientes'], ['datos', 'Datos'],
    ...(modules.pedidosQr ? [['comandas', 'Comandas']] : []),
  ];
  const props = { bookings, history, actions, settings, business, onAdd: setAdding, onChangeTable: setMoving, reloadSettings };
  const auto = settings.profile?.auto_confirm !== false;

  return (
    <div className="page">
      <PageHeader eyebrow={business.name} title="Reservas"
        right={<button className="btn soft sm" onClick={() => setAdding({ walkIn: true })}>Sin reserva</button>} />
      <div className="segmented" role="tablist">
        {tabs.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setParams(k === 'agenda' ? {} : { ver: k }, { replace: true })}>{l}</button>)}
      </div>
      {tab === 'agenda' && (
        <Link to="/panel/personalizar/reservas" className="small muted" style={{ margin: '0 4px', textDecoration: 'none' }}>
          {auto ? 'Las reservas con mesa libre se confirman solas.' : 'Confirmas tú cada reserva.'} <span style={{ textDecoration: 'underline', fontWeight: 700 }}>Cambiar</span>
        </Link>
      )}
      {tab === 'agenda' && <Agenda {...props} />}
      {tab === 'sala' && <Hall {...props} />}
      {tab === 'clientes' && <Customers orders={orders} business={business} />}
      {tab === 'datos' && <Stats bookings={bookings} settings={settings} />}
      {tab === 'comandas' && <Orders comandasOnly />}
      {moving && <ChangeTableSheet order={moving} settings={settings} business={business} onClose={() => setMoving(null)} onDone={(o, items) => setData((list) => list.map((x) => (x.id === o.id ? { ...x, items } : x)))} />}
      <OwnerBookingSheet open={!!adding} initial={adding} onClose={() => setAdding(null)} business={business} settings={settings} onSaved={reload} />
    </div>
  );
}
