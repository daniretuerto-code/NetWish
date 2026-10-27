import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import { BackButton, Empty, Spinner } from '../../components/ui.jsx';
import ReserveSheet from '../../components/ReserveSheet.jsx';
import ServiceBooking from '../../components/ServiceBooking.jsx';
import ShopFront from '../../components/ShopFront.jsx';
import ClassesFront from '../../components/ClassesFront.jsx';
import TaxiFront from '../../components/TaxiFront.jsx';
import { nounsOf } from '../../lib/businessTypes.js';
import { typeFacts } from '../../lib/typeQuestions.js';
import useAsync from '../../hooks/useAsync.js';
import { findBusiness, getRestaurantSettings, listProducts } from '../../lib/data.js';
import { categoryOf, kindOf } from '../../lib/categories.js';
import { initials, money, todayISO, toneFor } from '../../lib/format.js';
import { modulesFor, publicFacts } from '../../lib/questionnaire.js';
import { eventDay, upcomingEvents } from '../../lib/events.js';
import { mapsUrl, openState, shiftsOf, weekHours } from '../../lib/hours.js';
import { isClosed } from '../../lib/booking.js';

function Hero({ biz, state, sub }) {
  return (
    <header className="hero" style={{ background: toneFor(biz.name) }}>
      {biz.cover_url ? (
        <>
          <img className="cover-img" src={biz.cover_url} alt="" />
          <span className="cover-shade" />
        </>
      ) : (
        <span className="ghost" aria-hidden="true">{initials(biz.name)}</span>
      )}
      <div className="hero-actions">
        <BackButton glass />
      </div>
      {biz.demo && <span className="demo-pill" style={{ alignSelf: 'flex-start', marginBottom: 8 }}>Negocio de ejemplo</span>}
      <span className="eyebrow">{biz.category || categoryOf(biz).label}</span>
      <h1>{biz.name}</h1>
      {(state || sub) && (
        <div className="hero-meta">
          {state && <span className={`open-pill${state.open ? (state.soon ? ' closing' : '') : ' closed'}`}><span className="dot" />{state.label}</span>}
          {sub && <span className="sub">{sub}</span>}
        </div>
      )}
    </header>
  );
}

function AudioPreview({ src, playing, onToggle, name }) {
  return (
    <button className="icon-btn" style={{ background: playing ? 'var(--ink)' : 'var(--bg)', color: playing ? 'var(--accent)' : 'var(--ink)', width: 40, height: 40 }} onClick={onToggle} aria-label={playing ? `Pausar ${name}` : `Escuchar ${name}`} disabled={!src}>
      <Icon name={playing ? 'pause' : 'play'} size={16} fill="currentColor" stroke={0} />
    </button>
  );
}

function ProductList({ biz, products, music, compact }) {
  const audio = useRef(null);
  const [playing, setPlaying] = useState(null);

  useEffect(() => () => audio.current?.pause(), []);

  const toggle = (p) => {
    if (playing === p.id) {
      audio.current?.pause();
      setPlaying(null);
      return;
    }
    audio.current?.pause();
    audio.current = new Audio(p.audio_url);
    audio.current.onended = () => setPlaying(null);
    audio.current.play().then(() => setPlaying(p.id)).catch(() => setPlaying(null));
  };

  const sections = useMemo(() => {
    const map = new Map();
    for (const p of products) {
      const key = music ? (p.is_finished_beat ? 'Beats terminados' : 'Beats') : (p.section || 'Carta');
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(p);
    }
    return [...map.entries()];
  }, [products, music]);

  if (!products.length) {
    return <div className="widget"><Empty icon="book" title={compact ? 'La carta llegará pronto' : 'Aún no hay productos'}>{compact ? `${biz.name} todavía no ha subido su carta. Puedes preguntarle por el chat.` : 'Este comercio todavía no ha publicado su catálogo.'}</Empty></div>;
  }

  // Restaurants: the whole menu in one card, with the sections to jump to on top.
  if (compact) {
    const jump = (i) => document.getElementById(`carta-${i}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return (
      <section className="widget" aria-label="Carta">
        {sections.length > 1 && (
          <div className="menu-nav" role="navigation" aria-label="Secciones de la carta">
            {sections.map(([section], i) => <button key={section} onClick={() => jump(i)}>{section}</button>)}
          </div>
        )}
        {sections.map(([section, items], i) => (
          <div key={section} className="menu-section">
            <h2 id={`carta-${i}`}>{section}</h2>
            {items.map((p) => (
              <div key={p.id} className="dish">
                <span className="grow" style={{ minWidth: 0 }}>
                  <span className="t" style={{ display: 'block' }}>{p.name}</span>
                  {p.description && <span className="s" style={{ display: 'block' }}>{p.description}</span>}
                </span>
                {Number(p.price) > 0 && <span className="price">{money(p.price)}</span>}
              </div>
            ))}
          </div>
        ))}
      </section>
    );
  }

  return (
    <>
      {music && <p className="small muted" style={{ margin: '0 4px' }}>¿Te gusta alguno? Escríbele por el chat a {biz.name} para comprarlo.</p>}
      <div className="menu-grid">{sections.map(([section, items]) => (
        <section key={section} className="widget" style={{ paddingBottom: 4 }}>
          <h2 className="title-lg" style={{ marginBottom: 4 }}>{section}</h2>
          {items.map((p) => (
            <div key={p.id} className="list-row">
              {music && <AudioPreview src={p.audio_url} name={p.name} playing={playing === p.id} onToggle={() => toggle(p)} />}
              <span className="grow stack" style={{ gap: 1 }}>
                <span className="t">{p.name}</span>
                {p.description && <span className="s">{p.description}</span>}
              </span>
              <span className="price" style={{ fontSize: 15, fontWeight: 700 }}>{money(p.price)}</span>
            </div>
          ))}
        </section>
      ))}</div>
    </>
  );
}

function Hours({ settings }) {
  const days = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const closed = (settings.closed_days || []).map((d) => days[d]);
  return (
    <div className="widget stack" style={{ gap: 0 }}>
      <h2 className="title-lg" style={{ marginBottom: 4 }}>Horario</h2>
      <div className="list-row"><span className="grow t">Mañanas</span><span className="s">{settings.lunch_start} – {settings.lunch_end}</span></div>
      <div className="list-row"><span className="grow t">Tardes</span><span className="s">{settings.dinner_start} – {settings.dinner_end}</span></div>
      {closed.length > 0 && <div className="list-row"><span className="grow t">Cerrado</span><span className="s">{closed.join(', ')}</span></div>}
    </div>
  );
}

function DailyMenu({ menu }) {
  if (!menu || menu.active === false) {
    return <div className="widget"><Empty icon="utensils" title="Hoy no hay menú del día publicado" /></div>;
  }
  const block = (title, list) => (list?.length ? (
    <div className="stack" style={{ gap: 4 }}>
      <span className="eyebrow">{title}</span>
      {list.map((d) => <span key={d} style={{ fontSize: 16, fontWeight: 600 }}>{d}</span>)}
    </div>
  ) : null);
  return (
    <section className="widget stack" style={{ gap: 14 }}>
      <div className="row between">
        <h2 className="title-lg">Menú del día</h2>
        <span className="title-lg price">{money(menu.price)}</span>
      </div>
      {block('Primeros', menu.first_courses)}
      {block('Segundos', menu.second_courses)}
      {menu.includes && <span className="small muted">Incluye: {menu.includes}</span>}
    </section>
  );
}

function Actions({ biz, booksService, bookLabel = 'Pedir cita' }) {
  const share = async () => {
    const url = window.location.href.split('?')[0];
    try {
      if (navigator.share) await navigator.share({ title: biz.name, text: `${biz.name} en NetWish`, url });
      else await navigator.clipboard.writeText(url);
    } catch {
      // Closed the share sheet.
    }
  };
  return (
    <div className="actions">
      {booksService && <a className="action dark" href={booksService === true ? '#servicios' : booksService}><Icon name="calendar" size={22} />{bookLabel}</a>}
      {biz.telefono && <a className="action" href={`tel:${biz.telefono}`}><Icon name="phone" size={22} />Llamar</a>}
      <a className="action" href={mapsUrl(biz)} target="_blank" rel="noreferrer"><Icon name="pin" size={22} />Cómo llegar</a>
      <Link className="action" to={`/chat/${encodeURIComponent(biz.name)}`}><Icon name="chat" size={22} />Escribir</Link>
      <button className="action" onClick={share}><Icon name="share" size={22} />Compartir</button>
    </div>
  );
}

// Week hours, address and phone: everything to plan the visit in one card.
function InfoCard({ biz, settings, extra }) {
  return (
    <section className="widget stack" style={{ gap: 8 }}>
      <h2 className="title-lg">{shiftsOf(settings).length ? 'Horario' : 'Dónde está'}</h2>
      {shiftsOf(settings).length > 0 && (
        <div>
          {weekHours(settings).map((d) => (
            <div key={d.day} className={`hours-row${d.today ? ' today' : ''}`}><span>{d.day}{d.today && <span className="now">HOY</span>}</span><span>{d.text}</span></div>
          ))}
        </div>
      )}
      <a className="list-row" href={mapsUrl(biz)} target="_blank" rel="noreferrer" style={{ marginTop: 4 }}>
        <span className="mono" style={{ background: 'var(--bg)', color: 'var(--ink)' }}><Icon name="pin" size={20} /></span>
        <span className="grow stack" style={{ gap: 0 }}>
          <span className="t">{biz.address || 'Ver en el mapa'}</span>
          <span className="s">Abrir en Google Maps</span>
        </span>
        <Icon name="chevron" size={18} style={{ color: 'var(--muted)' }} />
      </a>
      {biz.telefono && (
        <a className="list-row" href={`tel:${biz.telefono}`}>
          <span className="mono" style={{ background: 'var(--bg)', color: 'var(--ink)' }}><Icon name="phone" size={20} /></span>
          <span className="grow stack" style={{ gap: 0 }}>
            <span className="t">{biz.telefono}</span>
            <span className="s">Llamar</span>
          </span>
          <Icon name="chevron" size={18} style={{ color: 'var(--muted)' }} />
        </a>
      )}
      {extra}
    </section>
  );
}

// Desktop: the booking box stays in view next to the menu.
function BookCard({ biz, settings, onBook }) {
  const [pax, setPax] = useState(2);
  const auto = settings?.profile?.auto_confirm !== false;
  return (
    <section className="widget stack only-wide" style={{ gap: 12 }}>
      <span className="stack" style={{ gap: 2 }}>
        <span className="eyebrow">{auto ? 'Confirmación al momento' : 'Te confirma el restaurante'}</span>
        <h2 className="title-lg">Reserva tu mesa</h2>
      </span>
      <span className="small muted" style={{ fontWeight: 600 }}>¿Cuántos sois?</span>
      <div className="guest-pick">
        {[1, 2, 3, 4, 5].map((n) => <button key={n} aria-pressed={pax === n} onClick={() => setPax(n)}>{n === 5 ? '5+' : n}</button>)}
      </div>
      <button className="btn primary block" onClick={() => onBook(pax)}>Ver horas libres</button>
      <span className="small muted">Gratis y sin registrarte. {biz.name} recibe tu reserva al instante.</span>
    </section>
  );
}

function MenuTeaser({ menu, onOpen }) {
  return (
    <button className="widget menu-teaser" onClick={onOpen}>
      <span className="mono" style={{ background: 'var(--accent)', color: 'var(--ink)' }}><Icon name="utensils" size={20} /></span>
      <span className="grow stack" style={{ gap: 1, minWidth: 0 }}>
        <span className="row between" style={{ gap: 8 }}>
          <strong style={{ fontSize: 16 }}>Menú del día</strong>
          {Number(menu.price) > 0 && <strong className="price" style={{ fontSize: 16 }}>{money(menu.price)}</strong>}
        </span>
        <span className="small muted" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{[...(menu.first_courses || []), ...(menu.second_courses || [])].slice(0, 4).join(' · ')}</span>
      </span>
      <Icon name="chevron" size={18} style={{ color: 'var(--muted)' }} />
    </button>
  );
}

export default function Business() {
  const { name } = useParams();
  const [tab, setTab] = useState('carta');
  const [params, setParams] = useSearchParams();
  // The restaurant's short link (netwish.es/r/…) and the waiting-list e-mail (…&dia=&pax=) land here with the booking sheet open.
  const [reserveOpen, setReserveOpen] = useState(params.get('reservar') === '1');
  const [pax, setPax] = useState(params.get('pax'));

  const { data, loading } = useAsync(async () => {
    const biz = await findBusiness(name);
    if (!biz) return { biz: null };
    const kind = kindOf(biz);
    const [products, settings] = await Promise.all([
      listProducts(biz.name),
      kind === 'music' ? Promise.resolve(null) : getRestaurantSettings(biz.name, kind),
    ]);
    return { biz, kind, products, settings };
  }, [name]);

  useEffect(() => {
    if (!data?.biz) return undefined;
    const prev = document.title;
    document.title = `${data.biz.name} · ${data.kind === 'restaurant' ? 'Carta y reservas' : data.biz.category || 'Palencia'} | NetWish`;
    return () => { document.title = prev; };
  }, [data?.biz?.name]);

  if (loading) return <Spinner />;
  if (!data?.biz) {
    return (
      <div className="page">
        <BackButton />
        <Empty icon="store" title="No encontramos este comercio">Puede que haya cambiado de nombre.</Empty>
      </div>
    );
  }

  const { biz, kind, products, settings } = data;
  const isRestaurant = kind === 'restaurant';
  const isBeauty = kind === 'beauty';
  const mods = modulesFor(isRestaurant ? settings?.profile : {});
  const canBook = isRestaurant && mods.reservas;
  const facts = isRestaurant ? publicFacts(settings?.profile) : { headline: '', badges: [] };
  const state = kind !== 'music' && settings ? openState(settings) : null;
  const menu = settings?.daily_menu;
  const menuToday = isRestaurant && mods.menuDia && menu && menu.active !== false && (menu.first_courses?.length || menu.second_courses?.length) && !isClosed(settings, todayISO());
  const events = isRestaurant ? upcomingEvents(settings?.profile?.eventos) : [];
  const book = (guests) => {
    if (guests) setPax(String(guests));
    setReserveOpen(true);
  };
  const tileLabel = { fontSize: 16, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };

  const badges = facts.badges.length > 0 && (
    <div className="facts">
      {facts.badges.map((b) => <span key={b} className="fact">{b}</span>)}
    </div>
  );

  const eventsCard = events.length > 0 && (
    <div className="widget stack" style={{ gap: 4 }}>
      <span className="eyebrow">Próximamente</span>
      {events.slice(0, 4).map((ev) => {
        // An event on a day the restaurant closes can't be booked online.
        const bookable = canBook && !isClosed(settings, ev.date);
        return (
          <button key={ev.id} className="list-row" disabled={!bookable} onClick={() => { setParams({ reservar: '1', dia: ev.date }, { replace: true }); setReserveOpen(true); }}>
            <span className="stack" style={{ gap: 0, minWidth: 56, alignItems: 'center' }}>
              <strong style={{ fontSize: 14 }}>{eventDay(ev.date)}</strong>
            </span>
            <span className="grow stack" style={{ gap: 0, minWidth: 0 }}>
              <span className="t">{ev.title}{ev.price ? ` · ${money(ev.price)}` : ''}</span>
              {ev.text && <span className="s">{ev.text}</span>}
            </span>
            {bookable ? <span className="small" style={{ fontWeight: 800 }}>Reservar</span> : biz.telefono ? <span className="small muted">Llama</span> : null}
          </button>
        );
      })}
    </div>
  );

  if (!isRestaurant) {
    const shop = kind === 'shop';
    const bottom = isBeauty || kind === 'taxi' || (shop && settings?.profile?.recogida) ? 120 : undefined;
    const hasHours = kind !== 'music' && settings && (settings.lunch_start || settings.dinner_start);
    return (
      <div className="page flush-top" style={{ paddingBottom: bottom }}>
        <Hero biz={biz} state={state} />
        <div className="overlap stack">
          <Actions biz={biz} booksService={isBeauty ? true : kind === 'classes' ? '#clases' : false} bookLabel={kind === 'classes' ? 'Reservar clase' : nounsOf(biz).book} />
          {isBeauty && (
            <>
              {typeFacts(biz, settings?.profile).length > 0 && <div className="widget" style={{ padding: 14 }}><div className="facts">{typeFacts(biz, settings?.profile).map((f) => <span key={f} className="fact">{f}</span>)}</div></div>}
              <ServiceBooking biz={biz} services={products} settings={settings} />
              <Hours settings={settings} />
            </>
          )}
          {shop && <ShopFront biz={biz} products={products} settings={settings} />}
          {kind === 'classes' && <ClassesFront biz={biz} products={products} settings={settings} />}
          {kind === 'taxi' && <TaxiFront biz={biz} products={products} settings={settings} />}
          {kind === 'music' && <ProductList biz={biz} products={products} music />}
          {!isBeauty && (hasHours || biz.address || biz.telefono) && <InfoCard biz={biz} settings={kind === 'taxi' || !hasHours ? {} : settings} />}
        </div>
      </div>
    );
  }

  return (
    <div className="page flush-top" style={{ paddingBottom: canBook ? 120 : undefined }}>
      <Hero biz={biz} state={state} sub={facts.headline} />

      <div className="overlap stack">
        <Actions biz={biz} />

        <div className="biz-layout">
          <div className="biz-main">
            {badges && <div className="widget" style={{ padding: 14 }}>{badges}</div>}
            {menuToday && tab !== 'menu' && <MenuTeaser menu={menu} onOpen={() => setTab('menu')} />}
            {eventsCard}

            <div className="segmented" role="tablist" aria-label="Secciones">
              <button role="tab" aria-selected={tab === 'carta'} onClick={() => setTab('carta')}>Carta</button>
              {mods.menuDia && <button role="tab" aria-selected={tab === 'menu'} onClick={() => setTab('menu')}>Menú del día</button>}
              <button role="tab" aria-selected={tab === 'info'} onClick={() => setTab('info')}>Horario y mapa</button>
            </div>

            {tab === 'carta' && <ProductList biz={biz} products={products} compact />}
            {mods.menuDia && tab === 'menu' && <DailyMenu menu={menu} />}
            {tab === 'info' && (
              <InfoCard biz={biz} settings={settings} extra={settings.profile?.para_llevar && biz.telefono && <a className="btn soft block" href={`tel:${biz.telefono}`}>Llamar para pedir para llevar</a>} />
            )}
          </div>

          <aside className="biz-aside">
            {canBook && <BookCard biz={biz} settings={settings} onBook={book} />}
            {tab !== 'info' && <div className="only-wide" style={{ flexDirection: 'column' }}><InfoCard biz={biz} settings={settings} /></div>}
          </aside>
        </div>
      </div>

      {canBook && (
        <button className="cta-bar wide-hide" onClick={() => book()}>
          <span className="stack" style={{ gap: 0, textAlign: 'left', minWidth: 0 }}>
            <span style={tileLabel}>Reserva tu mesa</span>
            <span className="small" style={{ opacity: 0.65, fontWeight: 600 }}>{settings.profile?.auto_confirm !== false ? 'Confirmación al momento' : 'Gratis, sin registrarte'}</span>
          </span>
          <span className="go">Reservar</span>
        </button>
      )}

      {canBook && <ReserveSheet open={reserveOpen} onClose={() => setReserveOpen(false)} biz={biz} settings={settings} initial={{ date: params.get('dia'), guests: pax }} />}
    </div>
  );
}
