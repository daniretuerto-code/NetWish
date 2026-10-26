import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useOutletContext, useSearchParams } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import BookingCard, { StatusChip, useBookingActions } from '../../components/BookingCard.jsx';
import OwnerBookingSheet from '../../components/OwnerBookingSheet.jsx';
import { busyTables, DEFAULT_TABLES } from '../../components/ReserveSheet.jsx';
import { Empty, PageHeader, Sheet, Skeleton, Spinner, useToast } from '../../components/ui.jsx';
import SectionTabs from '../../components/SectionTabs.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import useAsync from '../../hooks/useAsync.js';
import { businessOrders, businessWaitlist, customerNotes, reservationsOn, setWaitlistStatus, saveCustomerNote, saveRestaurantSettings, setOrderItems, STATUS, subscribe } from '../../lib/data.js';
import FloorPlan from '../../components/FloorPlan.jsx';
import { joinPairs, placeTables, zoneHeight, zoneOf, zonesOf } from '../../lib/floor.js';
import { tableLabel, blockFor, ACTIVE_BOOKING, bookingsOf, byTime, customerKey, customersFrom, dayLabel, guestsOf, parseTableBooking, shiftOf, telLink, whatsappLink } from '../../lib/agenda.js';
import { nextDays } from '../../lib/booking.js';
import { CUSTOMER_TAGS, isAllergyTag } from '../../lib/tags.js';
import { minutesToTime, normalize, timeToMinutes, todayISO } from '../../lib/format.js';
import { netwishNumbers } from '../../lib/insights.js';
import { money } from '../../lib/format.js';

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
          style={{ minWidth: 0, height: 32, background: block[k] ? 'var(--danger-soft)' : 'var(--bg)', color: block[k] ? 'var(--danger-ink)' : 'var(--ink)' }}>
          {block[k] ? `${label}: completo` : `${label}: abiertas`}
        </button>
      ))}
    </div>
  );
}

// The booking text with its table swapped: "Reserva 4 pax — Mesa 3 (Terraza)".
const itemsWithTable = (order, t, other) => {
  const label = tableLabel(other ? [t.table_number, other.table_number] : [t.table_number], zoneOf(t));
  return /Mesas? \d+/.test(order.items)
    ? order.items.replace(/Mesas? [\d+]+( \([^)]*\))?/, label)
    : order.items.replace(/(\d+\s*pax)/i, `$1 — ${label}`);
};

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
    const items = itemsWithTable(order, t, other);
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
            {closedAhead.map((d) => <button key={d} className="chip" style={{ background: 'var(--danger-soft)' }} onClick={() => reopen(d)} aria-label={`Abrir el ${d}`}>{new Date(`${d}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })} ✕</button>)}
          </div>
        </div>
      )}
    </Sheet>
  );
}

export function Waitlist({ day, business, title, framed }) {
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
    <div className={framed ? 'widget stack' : 'stack'} style={{ gap: 8 }}>
      {title || <span className="eyebrow">Lista de espera · {list.length}</span>}
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

// "Tenía una mesa a nombre de…": every booking, past or ahead, by name, phone or e-mail.
function BookingSearch({ bookings, card }) {
  const [q, setQ] = useState('');
  const term = normalize(q.trim());
  const digits = q.replace(/\D/g, '');
  const found = term.length < 2 ? [] : bookings
    .filter((o) => normalize(`${o.customer} ${o.customer_email || ''}`).includes(term) || (digits.length >= 3 && String(o.phone || '').replace(/\D/g, '').includes(digits)))
    .sort((a, b) => {
      const today = todayISO();
      const ahead = (o) => (o.date >= today ? 0 : 1);
      return ahead(a) - ahead(b) || (a.date >= today ? `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`) : `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`));
    })
    .slice(0, 20);
  return (
    <>
      <label className="search">
        <Icon name="search" size={18} />
        <input type="search" placeholder="Buscar por nombre o teléfono" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar reserva" />
        {q && <button className="btn ghost sm" style={{ height: 30, padding: '0 6px' }} onClick={() => setQ('')} aria-label="Borrar búsqueda"><Icon name="close" size={16} /></button>}
      </label>
      {term.length >= 2 && (
        <section className="widget stack" style={{ gap: 10 }}>
          <span className="eyebrow">{found.length ? `${found.length} ${found.length === 1 ? 'reserva' : 'reservas'}` : 'Nada con ese nombre o teléfono'}</span>
          {found.map((o) => card(o, dayLabel(o.date, todayISO())))}
        </section>
      )}
    </>
  );
}

function Agenda({ day, bookings, history, actions, settings, business, onAdd, onChangeTable, reloadSettings, profiles }) {
  const today = todayISO();
  const [showOld, setShowOld] = useState(false);
  const [closing, setClosing] = useState(false);
  const pending = bookings.filter((o) => o.status === STATUS.PENDING && o.date >= today).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  const ofDay = bookings.filter((o) => o.date === day).sort(byTime);
  const active = ofDay.filter((o) => ACTIVE_BOOKING.includes(o.status));
  const closed = ofDay.filter((o) => !ACTIVE_BOOKING.includes(o.status));
  const shifts = ['comida', 'cena'].map((s) => ({ key: s, list: active.filter((o) => shiftOf(o, settings) === s) })).filter((s) => s.list.length);
  const card = (o, showDate) => (
    <BookingCard key={o.id} order={o} history={history.get(customerKey(o))} profile={profiles?.[customerKey(o)]} busy={actions.busy === o.id} onMove={actions.move} onChangeTable={onChangeTable} businessName={business.name} showDate={showDate} />
  );

  return (
    <>
      <BookingSearch bookings={bookings} card={card} />
      {pending.length > 0 && (
        <section className="widget stack" style={{ gap: 10, boxShadow: '0 0 0 3px var(--accent)' }}>
          <div className="row between">
            <h2 className="title-md">Por confirmar</h2>
            <span className="count-badge accent">{pending.length}</span>
          </div>
          {pending.map((o) => card(o, o.date === today ? 'Hoy' : new Date(`${o.date}T12:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })))}
        </section>
      )}

      <section className="widget stack" style={{ gap: 10 }}>
        <div className="row between" style={{ alignItems: 'flex-start' }}>
          <span className="stack" style={{ gap: 0 }}>
            <h2 className="title-lg">{dayLabel(day, today)}</h2>
            <span className="small muted">{active.length} {active.length === 1 ? 'reserva' : 'reservas'} · {guestsOf(active)} personas</span>
          </span>
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

// The day every view shows, picked once at the top: list, timeline and floor plan stay in step.
function DayStrip({ day, onDay, bookings }) {
  return (
    <div className="chips" role="tablist" aria-label="Día">
      {nextDays(21).map((d) => {
        const n = guestsOf(bookings.filter((o) => o.date === d.iso && ACTIVE_BOOKING.includes(o.status)));
        const on = day === d.iso;
        return (
          <button key={d.iso} role="tab" aria-selected={on} onClick={() => onDay(d.iso)} className="stack"
            style={{ gap: 0, alignItems: 'center', justifyContent: 'center', minWidth: 58, height: 70, borderRadius: 20, border: 0, background: on ? 'var(--ink)' : 'var(--surface)', color: on ? 'var(--on-ink)' : 'var(--ink)', flex: '0 0 auto' }}>
            <span className="small" style={{ fontWeight: 700, opacity: 0.7 }}>{d.weekday}</span>
            <span style={{ fontSize: 20, fontWeight: 800 }}>{d.day}</span>
            <span style={{ fontSize: 11, fontWeight: 800, color: on ? 'var(--accent)' : n ? 'var(--ink)' : 'var(--muted)' }}>{n ? `${n} p.` : '·'}</span>
          </button>
        );
      })}
    </div>
  );
}

const PX_MIN = 2.2;

// The day as a timeline: tables down the side, hours across. Drag a booking up or down to change its table.
function Timeline({ day, bookings, settings, actions, history, business, onAdd, onChangeTable, profiles, onItems }) {
  const toast = useToast();
  const today = todayISO();
  const shifts = [['comida', 'Comidas', settings.lunch_start, settings.lunch_end], ['cena', 'Cenas', settings.dinner_start, settings.dinner_end]].filter((x) => x[2]);
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const [shift, setShift] = useState(() => (shifts.length > 1 && nowMin >= timeToMinutes(shifts[1][2]) - 90 ? shifts[1][0] : shifts[0]?.[0]));
  const [open, setOpen] = useState(null);
  const [drag, setDrag] = useState(null);
  const turn = settings.turn_duration_min || 90;
  const cur = shifts.find((x) => x[0] === shift) || shifts[0];
  const from = Math.floor((timeToMinutes(cur[2]) - 30) / 30) * 30;
  const to = timeToMinutes(cur[3] || minutesToTime(timeToMinutes(cur[2]) + 180)) + 30;
  const width = (to - from) * PX_MIN;
  const tables = (settings.tables?.length ? settings.tables : DEFAULT_TABLES).slice()
    .sort((a, b) => String(zoneOf(a)).localeCompare(String(zoneOf(b))) || Number(a.table_number) - Number(b.table_number));
  const ofDay = bookings.filter((o) => o.date === day && ACTIVE_BOOKING.includes(o.status) && shiftOf(o, settings) === cur[0]);
  const span = (o) => {
    const b = parseTableBooking(o);
    const s0 = timeToMinutes(b.start);
    return { b, s0, e0: b.end ? timeToMinutes(b.end) : s0 + turn };
  };
  const unassigned = ofDay.filter((o) => !parseTableBooking(o).tables.length);
  const rowH = 52;
  const color = (o) => (o.status === STATUS.SEATED ? { background: 'var(--seated)', color: '#fff' } : o.status === STATUS.PENDING ? { background: 'var(--accent)', color: '#111' } : { background: 'var(--ink)', color: 'var(--on-ink)' });

  const startDrag = (e, o) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDrag({ id: o.id, y0: e.clientY, dy: 0, moved: false });
  };
  const moveDrag = (e) => {
    if (!drag) return;
    const dy = e.clientY - drag.y0;
    setDrag({ ...drag, dy, moved: drag.moved || Math.abs(dy) > 6 });
  };
  const endDrag = async (o) => {
    if (!drag) return;
    const d = drag;
    setDrag(null);
    if (!d.moved) { setOpen(o.id); return; }
    const { b } = span(o);
    const fromRow = tables.findIndex((t) => Number(t.table_number) === b.tables[0]);
    const target = tables[Math.max(0, Math.min(tables.length - 1, fromRow + Math.round(d.dy / rowH)))];
    if (!target || Number(target.table_number) === b.tables[0]) return;
    const others = ofDay.filter((x) => x.id !== o.id);
    if (busyTables(others, b.start, span(o).e0 - span(o).s0).has(Number(target.table_number))) return toast(`La mesa ${target.table_number} está ocupada a esa hora`, 'error');
    if (Number(target.capacity) < b.guests) toast(`Ojo: la mesa ${target.table_number} es de ${target.capacity} y son ${b.guests}`);
    try {
      const items = itemsWithTable(o, target);
      await setOrderItems(o.id, items);
      onItems(o, items);
      navigator.vibrate?.(10);
      toast(`${o.customer} pasa a la mesa ${target.table_number}`);
    } catch (err) {
      toast(err.message, 'error');
    }
  };
  const current = open && ofDay.find((o) => o.id === open);
  const hourMarks = [];
  for (let m = Math.ceil(from / 30) * 30; m <= to; m += 30) hourMarks.push(m);

  return (
    <>
      {shifts.length > 1 && (
        <div className="segmented" role="tablist" aria-label="Turno">
          {shifts.map(([k, l]) => <button key={k} role="tab" aria-selected={cur[0] === k} onClick={() => setShift(k)}>{l} · {guestsOf(bookings.filter((o) => o.date === day && ACTIVE_BOOKING.includes(o.status) && shiftOf(o, settings) === k))} p.</button>)}
        </div>
      )}
      <div className="timeline">
        <div className="timeline-grid" style={{ width: width + 78 }}>
          <div className="tl-hours">
            <div className="tl-head" style={{ height: 30 }} />
            <div className="tl-lane">
              {hourMarks.map((m) => m % 60 === 0 && <span key={m} className="tl-hour" style={{ left: (m - from) * PX_MIN }}>{minutesToTime(m)}</span>)}
            </div>
          </div>
          {tables.map((t) => {
            const list = ofDay.filter((o) => parseTableBooking(o).tables.includes(Number(t.table_number)));
            return (
              <div key={t.table_number} className="tl-row">
                <div className="tl-head">Mesa {t.table_number}<small>{t.capacity} pl.{zoneOf(t) ? ` · ${zoneOf(t)}` : ''}</small></div>
                <div className="tl-lane" onDoubleClick={() => onAdd({ date: day, table: t.table_number })}>
                  {hourMarks.map((m) => <span key={m} className="tl-line" style={{ left: (m - from) * PX_MIN, opacity: m % 60 ? 0.5 : 1 }} />)}
                  {day === today && nowMin >= from && nowMin <= to && <span className="tl-now" style={{ left: (nowMin - from) * PX_MIN }} />}
                  {list.map((o) => {
                    const { b, s0, e0 } = span(o);
                    const dragging = drag?.id === o.id;
                    const allergy = (profiles?.[customerKey(o)]?.tags || []).some(isAllergyTag);
                    return (
                      <button key={o.id} className={`tl-bar${dragging && drag.moved ? ' dragging' : ''}`}
                        style={{ ...color(o), left: (s0 - from) * PX_MIN, width: Math.max(40, (e0 - s0) * PX_MIN - 3), transform: dragging ? `translateY(${drag.dy}px)` : undefined, boxShadow: allergy ? 'inset 0 0 0 2px #FF3B30' : undefined }}
                        onPointerDown={(e) => startDrag(e, o)} onPointerMove={moveDrag} onPointerUp={() => endDrag(o)} onPointerCancel={() => setDrag(null)}
                        aria-label={`${o.customer}, ${b.guests} personas, ${b.start}`}>
                        <span>{allergy ? '⚠︎ ' : ''}{o.customer}</span>
                        <span style={{ opacity: 0.75, fontWeight: 600 }}>{b.start} · {b.guests} p.{b.tables.length > 1 ? ` · ${b.tables.join('+')}` : ''}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {unassigned.length > 0 && (
        <section className="widget stack" style={{ gap: 8 }}>
          <span className="eyebrow">Sin mesa · {unassigned.length}</span>
          {unassigned.map((o) => <BookingCard key={o.id} order={o} history={history.get(customerKey(o))} profile={profiles?.[customerKey(o)]} busy={actions.busy === o.id} onMove={actions.move} onChangeTable={onChangeTable} businessName={business.name} />)}
        </section>
      )}
      <p className="small muted" style={{ margin: '0 4px' }}>Arrastra una reserva arriba o abajo para cambiarla de mesa. Tócala para ver sus datos. Doble toque en un hueco para apuntar una reserva.</p>
      <Sheet open={!!current} onClose={() => setOpen(null)} title={current ? current.customer : ''}>
        {current && <BookingCard order={current} history={history.get(customerKey(current))} profile={profiles?.[customerKey(current)]} busy={actions.busy === current.id} onMove={(o, st) => { actions.move(o, st); setOpen(null); }} onChangeTable={(o) => { setOpen(null); onChangeTable(o); }} businessName={business.name} />}
      </Sheet>
    </>
  );
}

function Hall({ day, bookings, settings, actions, history, business, onAdd, onChangeTable, profiles }) {
  const zones = zonesOf({ ...settings, tables: settings?.tables?.length ? settings.tables : DEFAULT_TABLES });
  const items = settings?.floor?.items || [];
  const tables = placeTables(settings?.tables?.length ? settings.tables : DEFAULT_TABLES, zones, items);
  const shiftTimes = [settings.lunch_start, settings.dinner_start].filter(Boolean);
  const [at, setAt] = useState(nowHHMM());
  // The slider runs from half an hour before lunch to the end of dinner.
  const dayFrom = timeToMinutes(settings.lunch_start || settings.dinner_start || '12:00') - 30;
  const dayTo = timeToMinutes(settings.dinner_end || settings.lunch_end || '23:30');
  const [open, setOpen] = useState(null);
  const [zoneName, setZoneName] = useState(null);
  const [zoom, setZoom] = useState(1);
  const zone = zones.find((z) => z.name === zoneName) || zones[0];
  const todays = bookings.filter((o) => o.date === day && ACTIVE_BOOKING.includes(o.status));

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
    const allergy = (profiles?.[customerKey(o)]?.tags || []).some(isAllergyTag);
    return { ring: color, badge: `${allergy ? '⚠︎ ' : ''}${parseTableBooking(o).start} ${o.customer.split(' ')[0]}`, badgeBg: allergy ? '#C0392B' : color, badgeFg: '#fff' };
  };
  const zoneCount = (z) => tables.filter((t) => zoneOf(t) === z.name && stateOf(t)).length;

  return (
    <>
      <section className="widget stack" style={{ gap: 6, padding: '12px 16px' }}>
        <div className="row between">
          <span className="stack" style={{ gap: 0 }}>
            <span className="eyebrow">La sala a las</span>
            <span className="title-lg" style={{ fontVariantNumeric: 'tabular-nums' }}>{at}</span>
          </span>
          <div className="row" style={{ gap: 6 }}>
            {shiftTimes.map((t) => <button key={t} className={`pill ${at === t ? 'on' : ''}`} style={{ minWidth: 0 }} onClick={() => setAt(t)}>{t}</button>)}
            <button className={`pill ${at === nowHHMM() ? 'on' : ''}`} style={{ minWidth: 0 }} onClick={() => setAt(nowHHMM())}>Ahora</button>
          </div>
        </div>
        <input className="range" type="range" min={dayFrom} max={dayTo} step={15} value={Math.min(dayTo, Math.max(dayFrom, timeToMinutes(at)))}
          onChange={(e) => setAt(minutesToTime(Number(e.target.value)))} aria-label="Hora" />
      </section>
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
        {[['var(--surface)', 'Libre'], ['var(--pending)', 'Por confirmar'], ['var(--ink)', 'Reservada'], ['var(--seated)', 'Sentados']].map(([c, l]) => (
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
      <p className="small muted" style={{ margin: '0 4px' }}>Toca una mesa libre para sentar a alguien que llega sin reserva. El plano se dibuja en <Link to="/panel/mesas">Ajustes › Tu sala</Link>.</p>
      <Sheet open={!!current} onClose={() => setOpen(null)} title={current ? tableLabel(parseTableBooking(current).tables) : ''}>
        {current && <BookingCard order={current} history={history.get(customerKey(current))} profile={profiles?.[customerKey(current)]} busy={actions.busy === current.id} onMove={(o, s) => { actions.move(o, s); setOpen(null); }} onChangeTable={(o) => { setOpen(null); onChangeTable(o); }} businessName={business.name} />}
      </Sheet>
    </>
  );
}

const WEEKDAYS_LONG = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

const CAME = [STATUS.DONE, STATUS.SEATED, STATUS.CONFIRMED];
const shiftISO = (iso, days) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); };

// The figures of one period: who came, who didn't, where bookings came from.
function periodNumbers(bookings, from, to) {
  const past = bookings.filter((o) => o.date >= from && o.date < to);
  const came = past.filter((o) => CAME.includes(o.status));
  const noShow = past.filter((o) => o.status === STATUS.NOSHOW).length;
  const customers = customersFrom(past);
  return {
    past,
    came,
    diners: guestsOf(came),
    noShow,
    noShowPct: came.length + noShow ? Math.round((noShow / (came.length + noShow)) * 100) : 0,
    cancelled: past.filter((o) => o.status === STATUS.CANCELLED).length,
    onlinePct: past.length ? Math.round((past.filter((o) => !o.source || o.source === 'app').length / past.length) * 100) : 0,
    customers: customers.length,
    returning: customers.filter((c) => c.bookings.filter((o) => CAME.includes(o.status)).length > 1).length,
  };
}

function Delta({ now, before, invert }) {
  if (!before) return null;
  const pct = Math.round(((now - before) / before) * 100);
  if (!pct) return <span className="small muted">igual que antes</span>;
  const good = invert ? pct < 0 : pct > 0;
  return <span className="small" style={{ fontWeight: 800, color: good ? 'var(--seated)' : 'var(--danger)' }}>{pct > 0 ? '▲' : '▼'} {Math.abs(pct)} %</span>;
}

// Numbers for a period, compared with the one before: diners, no-shows, occupancy and busy hours.
export function Stats({ bookings, settings }) {
  const [days, setDays] = useState(30);
  const today = todayISO();
  const from = shiftISO(today, -days);
  const cur = periodNumbers(bookings, from, today);
  const prev = periodNumbers(bookings, shiftISO(from, -days), from);
  const tables = settings?.tables?.length ? settings.tables : DEFAULT_TABLES;
  const seats = tables.reduce((n, t) => n + Number(t.capacity || 0), 0);
  // Open services in the period, one per shift and open day.
  const openDays = Array.from({ length: days }, (_, i) => shiftISO(from, i)).filter((d) => !(settings.closed_days || []).includes(new Date(`${d}T12:00:00`).getDay()));
  const occupancy = [['comida', 'Comidas', settings.lunch_start], ['cena', 'Cenas', settings.dinner_start]].filter((x) => x[2]).map(([k, label]) => {
    const services = openDays.filter((d) => !blockFor(settings, d)[k]).length;
    const diners = guestsOf(cur.came.filter((o) => shiftOf(o, settings) === k));
    return { k, label, diners, pct: services && seats ? Math.min(100, Math.round((diners / (services * seats)) * 100)) : 0, perService: services ? (diners / services).toFixed(0) : 0 };
  });
  const byDay = WEEKDAYS_LONG.map((label, i) => ({ label, n: guestsOf(cur.came.filter((o) => new Date(`${o.date}T12:00:00`).getDay() === i)) }));
  const top = Math.max(1, ...byDay.map((d) => d.n));
  const order = [1, 2, 3, 4, 5, 6, 0].filter((i) => !(settings.closed_days || []).includes(i));
  // Arrivals by half hour.
  const hours = new Map();
  cur.came.forEach((o) => {
    const m = timeToMinutes(parseTableBooking(o).start);
    if (Number.isNaN(m)) return;
    const k = minutesToTime(Math.floor(m / 30) * 30);
    hours.set(k, (hours.get(k) || 0) + parseTableBooking(o).guests);
  });
  const peak = [...hours.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const peakTop = Math.max(1, ...peak.map((p) => p[1]));
  const tile = (label, value, sub, delta, tone) => (
    <div className="widget tight stack" style={{ gap: 2, background: tone }}>
      <span className="eyebrow">{label}</span>
      <span className="title-lg">{value}</span>
      <span className="row" style={{ gap: 6, flexWrap: 'wrap' }}>{sub && <span className="small muted">{sub}</span>}{delta}</span>
    </div>
  );
  return (
    <>
      <div className="segmented" role="tablist" aria-label="Periodo">
        {[[7, '7 días'], [30, '30 días'], [90, '3 meses'], [365, '1 año']].map(([n, l]) => <button key={n} role="tab" aria-selected={days === n} onClick={() => setDays(n)}>{l}</button>)}
      </div>
      {!cur.past.length ? <div className="widget"><Empty icon="chart" title="Aún no hay datos">En cuanto tengas reservas verás aquí tus números.</Empty></div> : (
        <>
          {(() => {
            const n = netwishNumbers(bookings, from, today, settings.profile);
            return (
              <section className="widget stack" style={{ gap: 6, background: 'var(--accent)', color: '#111' }}>
                <span className="eyebrow" style={{ color: '#111' }}>Lo que NetWish te ha traído</span>
                <span className="row" style={{ alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1 }}>{n.diners} comensales</span>
                  <span style={{ fontWeight: 700 }}>≈ {money(n.money)} · {n.online} {n.online === 1 ? 'reserva' : 'reservas'}</span>
                </span>
                <span className="small" style={{ fontWeight: 600 }}>
                  {[`${n.night} con el local cerrado`, `${n.confirmed} confirmaron desde el recordatorio`, `${n.newCustomers} clientes nuevos`, n.rating && `nota media ${n.rating} / 5 (${n.ratings})`].filter(Boolean).join(' · ')}
                </span>
                <span className="small" style={{ opacity: 0.7 }}>Comensales que reservaron por NetWish y vinieron × {money(n.ticket)} de gasto medio (lo cambias en Ajustes › Tu cocina).</span>
              </section>
            );
          })()}
          <p className="small muted" style={{ margin: '0 4px' }}>Comparado con los {days === 365 ? '12 meses' : `${days} días`} anteriores</p>
          <div className="bento wide">
            {tile('Comensales', cur.diners, `${cur.came.length} ${cur.came.length === 1 ? 'reserva' : 'reservas'}`, <Delta now={cur.diners} before={prev.diners} />)}
            {tile('Por mesa', cur.came.length ? (cur.diners / cur.came.length).toFixed(1) : '0', 'personas', <Delta now={cur.came.length ? cur.diners / cur.came.length : 0} before={prev.came.length ? prev.diners / prev.came.length : 0} />)}
            {tile('No vinieron', `${cur.noShowPct} %`, `${cur.noShow} ${cur.noShow === 1 ? 'reserva' : 'reservas'}`, <Delta now={cur.noShow} before={prev.noShow} invert />, cur.noShow ? 'var(--danger-soft)' : undefined)}
            {tile('Cancelaron', cur.cancelled, 'con aviso', <Delta now={cur.cancelled} before={prev.cancelled} invert />)}
            {tile('Por NetWish', `${cur.onlinePct} %`, 'del total')}
            {tile('Repiten', cur.customers ? `${Math.round((cur.returning / cur.customers) * 100)} %` : '0 %', `${cur.returning} de ${cur.customers}`)}
          </div>
          {seats > 0 && occupancy.length > 0 && (
            <section className="widget stack" style={{ gap: 10 }}>
              <h2 className="title-md">Ocupación por turno</h2>
              {occupancy.map((x) => (
                <div key={x.k} className="stack" style={{ gap: 4 }}>
                  <span className="row between"><strong>{x.label}</strong><span className="small"><strong>{x.pct} %</strong> · {x.perService} pers. de media de {seats} plazas</span></span>
                  <span style={{ background: 'var(--bg)', borderRadius: 8, height: 12, overflow: 'hidden' }}>
                    <span style={{ display: 'block', height: '100%', width: `${x.pct}%`, background: x.pct >= 80 ? 'var(--ink)' : 'var(--accent)', borderRadius: 8 }} />
                  </span>
                </div>
              ))}
              <span className="small muted">Cuenta una vuelta por turno. Si das dos turnos de cena, puedes pasar del 100 % real.</span>
            </section>
          )}
          <div className="two-col">
            <section className="widget stack" style={{ gap: 8 }}>
              <h2 className="title-md">Comensales por día</h2>
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
            {peak.length > 0 && (
              <section className="widget stack" style={{ gap: 8 }}>
                <h2 className="title-md">Horas punta</h2>
                <div className="row" style={{ alignItems: 'flex-end', gap: 4, height: 140 }}>
                  {peak.map(([h, n]) => (
                    <span key={h} className="grow stack" style={{ gap: 4, alignItems: 'center', justifyContent: 'flex-end', height: '100%' }} title={`${h}: ${n} personas`}>
                      <span className="small" style={{ fontWeight: 800, fontSize: 11 }}>{n}</span>
                      <span style={{ width: '100%', maxWidth: 34, height: `${(n / peakTop) * 100}%`, minHeight: 4, borderRadius: 6, background: n === peakTop ? 'var(--ink)' : 'var(--accent)' }} />
                      <span className="small muted" style={{ fontSize: 10 }}>{h}</span>
                    </span>
                  ))}
                </div>
                <span className="small muted">Personas que llegan en cada media hora.</span>
              </section>
            )}
          </div>
        </>
      )}
    </>
  );
}

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const birthdayLabel = (b) => (/^\d{2}-\d{2}$/.test(b || '') ? `${Number(b.slice(3))} de ${MONTHS[Number(b.slice(0, 2)) - 1]}` : '');

// Day and month only (stored "MM-DD"): the year is nobody's business.
function BirthdayInput({ id, value, onChange }) {
  const [m, d] = /^\d{2}-\d{2}$/.test(value || '') ? value.split('-').map(Number) : [0, 0];
  const set = (mm, dd) => onChange(mm && dd ? `${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}` : '');
  return (
    <div className="row" style={{ gap: 8 }}>
      <select id={id} className="input" style={{ width: 90 }} value={d || ''} onChange={(e) => set(m || 1, Number(e.target.value))} aria-label="Día">
        <option value="">Día</option>
        {Array.from({ length: 31 }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
      </select>
      <select className="input grow" value={m || ''} onChange={(e) => set(Number(e.target.value), d || 1)} aria-label="Mes">
        <option value="">Mes</option>
        {MONTHS.map((x, i) => <option key={x} value={i + 1}>{x}</option>)}
      </select>
      {value && <button type="button" className="btn ghost sm" onClick={() => onChange('')}>Quitar</button>}
    </div>
  );
}

// The customer at a glance: since when, how many people, which day, what they thought.
function CustomerFacts({ customer }) {
  const came = customer.bookings.filter((o) => [STATUS.DONE, STATUS.SEATED].includes(o.status));
  if (!came.length) return null;
  const first = came.map((o) => o.date).sort()[0];
  const avg = (came.reduce((n, o) => n + parseTableBooking(o).guests, 0) / came.length).toFixed(1).replace('.0', '');
  const days = [0, 0, 0, 0, 0, 0, 0];
  came.forEach((o) => { days[new Date(`${o.date}T12:00:00`).getDay()] += 1; });
  const fav = days.indexOf(Math.max(...days));
  const rated = customer.bookings.filter((o) => o.rating).sort((a, b) => String(b.rated_at).localeCompare(String(a.rated_at)));
  const fact = (label, value) => <div className="list-row" style={{ minHeight: 0, padding: '6px 0' }}><span className="grow s">{label}</span><strong className="small">{value}</strong></div>;
  return (
    <div className="stack" style={{ gap: 0 }}>
      {fact('Cliente desde', new Date(`${first}T12:00:00`).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }))}
      {fact('Suele venir', `${avg} personas · ${came.length > 1 ? `los ${WEEKDAYS_LONG[fav].toLowerCase()}` : WEEKDAYS_LONG[fav].toLowerCase()}`)}
      {customer.cancelled > 0 && fact('Canceló con aviso', `${customer.cancelled} ${customer.cancelled === 1 ? 'vez' : 'veces'}`)}
      {rated[0] && fact('Su última nota', `${rated[0].rating} / 5${rated[0].rating_comment ? ` · «${rated[0].rating_comment}»` : ''}`)}
    </div>
  );
}

export function Customers({ orders, business, profiles: notes, setProfiles: setNotes }) {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [open, setOpen] = useState(null);
  const [note, setNote] = useState('');
  const [tags, setTags] = useState([]);
  const [custom, setCustom] = useState('');
  const [birthday, setBirthday] = useState('');
  const list = useMemo(() => customersFrom(orders)
    .map((c) => ({ ...c, latest: c.bookings.map((o) => o.date).sort().pop() }))
    .sort((a, b) => String(b.latest).localeCompare(String(a.latest))), [orders]);
  const shown = list.filter((c) => (!q || normalize(`${c.name} ${c.phone || ''} ${c.email || ''}`).includes(normalize(q)))
    && (!tagFilter || (notes?.[c.key]?.tags || []).includes(tagFilter)));
  const usedTags = [...new Set(Object.values(notes || {}).flatMap((n) => n.tags || []))];
  const allTags = [...new Set([...CUSTOMER_TAGS, ...usedTags])];
  const current = open && list.find((c) => c.key === open);

  const exportCsv = () => {
    const rated = (c) => c.bookings.filter((o) => o.rating).map((o) => o.rating);
    const rows = [['Nombre', 'Teléfono', 'Correo', 'Visitas', 'No vino', 'Cancelaciones', 'Última visita', 'Cumpleaños (día-mes)', 'Nota media', 'Etiquetas', 'Nota'], ...list.map((c) => [c.name, c.phone || '', c.email || '', c.visits, c.noShows, c.cancelled, c.last, birthdayLabel(notes?.[c.key]?.birthday), rated(c).length ? (rated(c).reduce((a, b) => a + b, 0) / rated(c).length).toFixed(1) : '', (notes?.[c.key]?.tags || []).join(', '), notes?.[c.key]?.note || ''])];
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
      const value = { note: note.trim().slice(0, 500), tags, birthday: /^\d{2}-\d{2}$/.test(birthday) ? birthday : '' };
      await saveCustomerNote(business.name, current.key, value);
      setNotes({ ...(notes || {}), [current.key]: value });
      toast('Guardado');
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  if (list.length === 0) return <div className="widget"><Empty icon="users" title="Aún no tienes clientes">Cada persona que reserve, por NetWish o por teléfono, aparecerá aquí con sus visitas.</Empty></div>;

  return (
    <>
      <div className="row" style={{ gap: 8 }}>
        <input className="input grow" type="search" placeholder="Buscar por nombre o teléfono" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar cliente" />
        <button className="btn soft sm" onClick={exportCsv}><Icon name="download" size={16} /> Excel</button>
      </div>
      {usedTags.length > 0 && (
        <div className="chips">
          <button className={`chip ${!tagFilter ? 'on' : ''}`} onClick={() => setTagFilter('')}>Todos</button>
          {usedTags.map((t) => <button key={t} className={`chip ${tagFilter === t ? 'on' : ''}`} onClick={() => setTagFilter(tagFilter === t ? '' : t)}>{t}</button>)}
        </div>
      )}
      <div className="widget" style={{ paddingBottom: 4 }}>
        <p className="small muted" style={{ margin: '0 0 4px' }}>{list.length} clientes. Son tuyos: puedes descargarlos cuando quieras.</p>
        {shown.map((c) => (
          <button key={c.key} className="list-row" onClick={() => { setOpen(c.key); setNote(notes?.[c.key]?.note || ''); setTags(notes?.[c.key]?.tags || []); setBirthday(notes?.[c.key]?.birthday || ''); setCustom(''); }}>
            <span className="grow stack" style={{ gap: 3, minWidth: 0 }}>
              <span className="t">{c.name}</span>
              <span className="s">{[c.phone, c.email].filter(Boolean).join(' · ') || 'Sin contacto'}{notes?.[c.key]?.note ? ` · ${notes[c.key].note}` : ''}</span>
              {(notes?.[c.key]?.tags || []).length > 0 && (
                <span className="row" style={{ gap: 4, flexWrap: 'wrap' }}>
                  {notes[c.key].tags.map((t) => <span key={t} className={`tag${isAllergyTag(t) ? ' alert' : t === 'VIP' ? ' vip' : ''}`} style={{ background: isAllergyTag(t) || t === 'VIP' ? undefined : 'var(--bg)' }}>{t}</span>)}
                </span>
              )}
            </span>
            <span className="stack" style={{ gap: 1, alignItems: 'flex-end' }}>
              <span className="small" style={{ fontWeight: 800 }}>{c.visits} {c.visits === 1 ? 'visita' : 'visitas'}</span>
              {c.noShows > 0 && <span className="small" style={{ fontWeight: 700, color: 'var(--danger-ink)' }}>No vino {c.noShows}</span>}
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
              <div className="widget tight stack" style={{ gap: 0, background: current.noShows ? 'var(--danger-soft)' : 'var(--bg)' }}><span className="eyebrow">No vino</span><span className="title-lg">{current.noShows}</span></div>
            </div>
            <CustomerFacts customer={current} />
            <div className="field">
              <label htmlFor="cn-bday">Cumpleaños</label>
              <BirthdayInput id="cn-bday" value={birthday} onChange={setBirthday} />
              <span className="small muted">Si activas las felicitaciones en Campañas, le escribimos una semana antes para que lo celebre aquí.</span>
            </div>
            <div className="stack" style={{ gap: 6 }}>
              <span className="eyebrow">Etiquetas</span>
              <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                {allTags.map((t) => {
                  const on = tags.includes(t);
                  return (
                    <button key={t} type="button" className="pill" aria-pressed={on} onClick={() => setTags(on ? tags.filter((x) => x !== t) : [...tags, t])}
                      style={{ minWidth: 0, background: on ? (isAllergyTag(t) ? 'var(--danger)' : 'var(--ink)') : 'var(--surface)', color: on ? (isAllergyTag(t) ? '#fff' : 'var(--on-ink)') : 'var(--ink)' }}>
                      {t}
                    </button>
                  );
                })}
              </div>
              <form className="row" style={{ gap: 6 }} onSubmit={(e) => { e.preventDefault(); const t = custom.trim().slice(0, 30); if (t && !tags.includes(t)) setTags([...tags, t]); setCustom(''); }}>
                <input className="input grow" style={{ height: 40 }} value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Otra etiqueta (ej.: alergia a frutos secos)" aria-label="Nueva etiqueta" />
                <button className="btn soft sm" disabled={!custom.trim()}>Añadir</button>
              </form>
              <span className="small muted">Las alergias e intolerancias salen en rojo en cada reserva de este cliente y en el plano. Con "No admitir", sus reservas nunca se confirman solas.</span>
            </div>
            <div className="field">
              <label htmlFor="cn-note">Nota privada (solo la ves tú)</label>
              <textarea id="cn-note" className="input" rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej.: alergia al marisco, prefiere terraza" />
            </div>
            <button className="btn primary block" onClick={saveNote}>Guardar</button>
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
  const { settings, reloadSettings } = useOutletContext();
  const [params, setParams] = useSearchParams();
  const [moving, setMoving] = useState(null);
  const [day, setDay] = useState(todayISO());
  const tab = params.get('ver') || 'agenda';
  const [adding, setAdding] = useState(null);
  const { data, loading, reload, setData } = useAsync(() => businessOrders(business.name), [business.name]);
  const orders = data || [];
  const actions = useBookingActions((order, status) => setData((list) => (list || []).map((o) => (o.id === order.id ? { ...o, status } : o))));

  useEffect(() => subscribe('orders', () => reload()), [reload]);

  const { data: profiles } = useAsync(() => customerNotes(business.name), [business.name]);
  const bookings = bookingsOf(orders);
  const history = useMemo(() => new Map(customersFrom(orders).map((c) => [c.key, c])), [orders]);
  // Customers, figures and QR orders have their own pages now; old links land there.
  const moved = { clientes: '/panel/clientes', datos: '/panel/numeros', comandas: '/panel/comandas' }[tab];
  if (moved) return <Navigate to={moved} replace />;
  if ((loading && !data) || !settings) return <Skeleton rows={4} />;

  // A new table text makes the stored columns stale until the next load, so the card reads the text.
  const onItems = (o, items) => setData((list) => list.map((x) => (x.id === o.id ? { ...x, items, guests: null } : x)));
  const tabs = [['agenda', 'Lista'], ['linea', 'Línea'], ['sala', 'Plano']];
  const props = { day, bookings, history, actions, settings, business, onAdd: setAdding, onChangeTable: setMoving, reloadSettings, profiles, onItems };
  const auto = settings.profile?.auto_confirm !== false;

  return (
    <div className="page">
      <PageHeader eyebrow={business.name} title="Reservas"
        right={(
          <span className="row" style={{ gap: 8 }}>
            <button className="btn soft sm" onClick={() => setAdding({ walkIn: true })} aria-label="Llega sin reserva"><Icon name="users" size={16} /><span className="wide-only">Sin reserva</span></button>
            <button className="btn primary sm" onClick={() => setAdding({ date: day })} aria-label="Apuntar reserva"><Icon name="plus" size={16} /><span className="wide-only">Reserva</span></button>
          </span>
        )} />
      <SectionTabs />
      <DayStrip day={day} onDay={setDay} bookings={bookings} />
      <div className="segmented" role="tablist" aria-label="Vista">
        {tabs.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setParams(k === 'agenda' ? {} : { ver: k }, { replace: true })}>{l}</button>)}
      </div>
      {tab === 'agenda' && (
        <Link to="/panel/personalizar/reservas" className="small muted" style={{ margin: '0 4px', textDecoration: 'none' }}>
          {auto ? 'Las reservas con mesa libre se confirman solas.' : 'Confirmas tú cada reserva.'} <span style={{ textDecoration: 'underline', fontWeight: 700 }}>Cambiar</span>
        </Link>
      )}
      {tab === 'agenda' && <Agenda {...props} />}
      {tab === 'linea' && <Timeline {...props} />}
      {tab === 'sala' && <Hall {...props} />}
      {moving && <ChangeTableSheet order={moving} settings={settings} business={business} onClose={() => setMoving(null)} onDone={onItems} />}
      <OwnerBookingSheet open={!!adding} initial={adding} onClose={() => setAdding(null)} business={business} settings={settings} onSaved={reload} />
    </div>
  );
}
