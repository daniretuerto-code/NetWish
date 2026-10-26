import { useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext, useSearchParams } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import BookingCard, { StatusChip, useBookingActions } from '../../components/BookingCard.jsx';
import OwnerBookingSheet from '../../components/OwnerBookingSheet.jsx';
import { busyTables, DEFAULT_TABLES } from '../../components/ReserveSheet.jsx';
import { Empty, PageHeader, Sheet, Spinner, useToast } from '../../components/ui.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import useAsync from '../../hooks/useAsync.js';
import { businessOrders, customerNotes, reservationsOn, saveCustomerNote, saveRestaurantSettings, setOrderItems, STATUS, subscribe } from '../../lib/data.js';
import { blockFor, ACTIVE_BOOKING, bookingsOf, byTime, customerKey, customersFrom, dayLabel, guestsOf, parseTableBooking, shiftOf, telLink, whatsappLink } from '../../lib/agenda.js';
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
  const move = async (t) => {
    const label = `Mesa ${t.table_number} (${t.zone || 'Sala Principal'})`;
    const items = /Mesa \d+/.test(order.items)
      ? order.items.replace(/Mesa \d+( \([^)]*\))?/, label)
      : order.items.replace(/(\d+\s*pax)/i, `$1 — ${label}`);
    try {
      await setOrderItems(order.id, items);
      toast(`Pasada a la mesa ${t.table_number}`);
      onDone(order, items);
      onClose();
    } catch (e) {
      toast(e.message, 'error');
    }
  };
  return (
    <Sheet open onClose={onClose} title={`Cambiar mesa · ${order.customer}`}>
      <p className="small muted" style={{ marginTop: 0 }}>{b.guests} personas · {b.start}. Ahora en la mesa {b.table || '?'}.</p>
      {!busyList ? <Spinner /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))', gap: 8 }}>
          {tables.filter((t) => Number(t.table_number) !== Number(b.table)).map((t) => {
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

function Agenda({ bookings, history, actions, settings, business, onAdd, onChangeTable, reloadSettings }) {
  const today = todayISO();
  const [day, setDay] = useState(today);
  const [showOld, setShowOld] = useState(false);
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
    </>
  );
}

function Hall({ bookings, settings, actions, history, business, onAdd, onChangeTable }) {
  const today = todayISO();
  const tables = settings?.tables?.length ? settings.tables : DEFAULT_TABLES;
  const zones = [...new Set(tables.map((t) => t.zone || 'Sala Principal'))];
  const shiftTimes = [settings.lunch_start, settings.dinner_start].filter(Boolean);
  const [at, setAt] = useState(nowHHMM());
  const [open, setOpen] = useState(null);
  const todays = bookings.filter((o) => o.date === today && ACTIVE_BOOKING.includes(o.status));

  const stateOf = (t) => {
    const m = timeToMinutes(at);
    const hits = todays.filter((o) => {
      const b = parseTableBooking(o);
      if (Number(b.table) !== Number(t.table_number)) return false;
      const s = timeToMinutes(b.start);
      const e = b.end ? timeToMinutes(b.end) : s + (settings.turn_duration_min || 90);
      return s - 30 <= m && m < (o.status === STATUS.SEATED ? e + 60 : e);
    });
    return hits.find((o) => o.status === STATUS.SEATED) || hits[0] || null;
  };
  const current = open && todays.find((o) => o.id === open);

  return (
    <>
      <div className="chips">
        <button className={`chip ${at === nowHHMM() ? 'on' : ''}`} onClick={() => setAt(nowHHMM())}>Ahora</button>
        {shiftTimes.flatMap((t) => [t, minutesToTime(timeToMinutes(t) + 60)]).sort().map((t) => <button key={t} className={`chip ${at === t ? 'on' : ''}`} onClick={() => setAt(t)}>{t}</button>)}
      </div>
      <div className="row" style={{ gap: 14, flexWrap: 'wrap', padding: '0 4px' }}>
        {[['var(--surface)', 'Libre'], ['var(--ink)', 'Reservada'], ['#2F5D46', 'Ocupada']].map(([c, l]) => (
          <span key={l} className="row small" style={{ gap: 6, fontWeight: 600 }}><span style={{ width: 14, height: 14, borderRadius: 4, background: c, boxShadow: 'inset 0 0 0 1px var(--line)' }} />{l}</span>
        ))}
      </div>
      {zones.map((z) => (
        <section key={z} className="widget stack" style={{ gap: 10 }}>
          <h2 className="title-md">{z}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 10 }}>
            {tables.filter((t) => (t.zone || 'Sala Principal') === z).map((t) => {
              const o = stateOf(t);
              const seated = o?.status === STATUS.SEATED;
              return (
                <button key={t.table_number} onClick={() => (o ? setOpen(o.id) : onAdd({ walkIn: true, table: t.table_number }))}
                  className="stack" aria-label={`Mesa ${t.table_number}${o ? `, ${o.customer}` : ', libre'}`}
                  style={{ gap: 2, alignItems: 'flex-start', minHeight: 92, padding: 12, borderRadius: 20, border: 0, textAlign: 'left', background: o ? (seated ? '#2F5D46' : 'var(--ink)') : 'var(--bg)', color: o ? '#fff' : 'var(--ink)' }}>
                  <span style={{ fontSize: 22, fontWeight: 800 }}>{t.table_number}</span>
                  <span className="small" style={{ opacity: 0.7 }}>{t.capacity} plazas</span>
                  {o && <span className="small" style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{parseTableBooking(o).start} {o.customer}</span>}
                </button>
              );
            })}
          </div>
        </section>
      ))}
      <p className="small muted" style={{ margin: '0 4px' }}>Toca una mesa libre para sentar a alguien que llega sin reserva. Las mesas se cambian en Mesas y QR.</p>
      <Sheet open={!!current} onClose={() => setOpen(null)} title={current ? `Mesa ${parseTableBooking(current).table}` : ''}>
        {current && <BookingCard order={current} history={history.get(customerKey(current))} busy={actions.busy === current.id} onMove={(o, s) => { actions.move(o, s); setOpen(null); }} onChangeTable={(o) => { setOpen(null); onChangeTable(o); }} businessName={business.name} />}
      </Sheet>
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
    ['agenda', 'Agenda'], ['sala', 'Sala'], ['clientes', 'Clientes'],
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
      {tab === 'comandas' && <Orders comandasOnly />}
      {moving && <ChangeTableSheet order={moving} settings={settings} business={business} onClose={() => setMoving(null)} onDone={(o, items) => setData((list) => list.map((x) => (x.id === o.id ? { ...x, items } : x)))} />}
      <OwnerBookingSheet open={!!adding} initial={adding} onClose={() => setAdding(null)} business={business} settings={settings} onSaved={reload} />
    </div>
  );
}
