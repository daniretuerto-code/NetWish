import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import { BackButton, Empty, Spinner } from '../../components/ui.jsx';
import ReserveSheet from '../../components/ReserveSheet.jsx';
import ServiceBooking from '../../components/ServiceBooking.jsx';
import useAsync from '../../hooks/useAsync.js';
import { findBusiness, getRestaurantSettings, listProducts } from '../../lib/data.js';
import { categoryOf, kindOf } from '../../lib/categories.js';
import { initials, money, todayISO, toneFor } from '../../lib/format.js';
import { modulesFor, publicFacts } from '../../lib/questionnaire.js';
import { eventDay, upcomingEvents } from '../../lib/events.js';
import { mapsUrl, openState, shiftsOf, weekHours } from '../../lib/hours.js';
import { isClosed } from '../../lib/booking.js';

async function shareBiz(biz) {
  const url = window.location.href.split('?')[0];
  try {
    if (navigator.share) await navigator.share({ title: biz.name, text: `${biz.name} en NetWish`, url });
    else await navigator.clipboard.writeText(url);
  } catch {
    // Closed the share sheet.
  }
}

// Restaurants: a tall cover with what matters now in one line and the one thing to do, Reservar.
function CoverHero({ biz, eyebrow, line, children }) {
  return (
    <header className="hero tall" style={{ background: toneFor(biz.name) }}>
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
      <span className="eyebrow">{eyebrow}</span>
      <h1>{biz.name}</h1>
      {line && <span className="hero-line">{line}</span>}
      {children}
    </header>
  );
}

// Llamar · Cómo llegar · Escribir · Compartir, as quiet text links under the cover.
function TextActions({ biz }) {
  return (
    <nav className="text-actions" aria-label="Acciones">
      {biz.telefono && <a href={`tel:${biz.telefono}`}>Llamar</a>}
      <a href={mapsUrl(biz)} target="_blank" rel="noreferrer">Cómo llegar</a>
      <Link to={`/chat/${encodeURIComponent(biz.name)}`}>Escribir</Link>
      <button onClick={() => shareBiz(biz)}>Compartir</button>
    </nav>
  );
}

// Today's set menu told in one paragraph, with the full menu one tap away.
function TodayCard({ menu, onCarta, showCarta }) {
  const lower = (t) => t.charAt(0).toLowerCase() + t.slice(1);
  const line = (list) => {
    if (!list?.length) return '';
    const items = list.map((d, i) => (i ? lower(d) : d));
    return `${items.length > 1 ? `${items.slice(0, -1).join(', ')} o ${items[items.length - 1]}` : items[0]}.`;
  };
  return (
    <section className="widget stack" style={{ gap: 10, padding: 18 }}>
      <div className="row between" style={{ alignItems: 'baseline' }}>
        <h2 className="title-lg">Hoy</h2>
        {Number(menu.price) > 0 && <span className="price" style={{ fontSize: 18 }}>{money(menu.price)}</span>}
      </div>
      <p style={{ fontSize: 15, lineHeight: 1.45, color: 'var(--ink-2)' }}>
        {[line(menu.first_courses), line(menu.second_courses)].filter(Boolean).join(' ')}
        {menu.includes ? ` Incluye ${lower(menu.includes)}.` : ''}
      </p>
      <button className="link-btn" onClick={onCarta} aria-expanded={showCarta}>{showCarta ? 'Ocultar la carta' : 'Ver la carta completa'}</button>
    </section>
  );
}

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
      <span className="eyebrow">{biz.category || categoryOf(biz).label}</span>
      <h1>{biz.name}</h1>
      {(state || sub) && (
        <div className="hero-meta">
          {state && <span className={`open-pill${state.open ? (state.soon ? ' soon' : '') : ' closed'}`}><span className="dot" />{state.label}</span>}
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

function Actions({ biz, booksService }) {
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
      {booksService && <a className="action dark" href="#servicios"><Icon name="calendar" size={22} />Pedir cita</a>}
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

export default function Business() {
  const { name } = useParams();
  const [showCarta, setShowCarta] = useState(false);
  // The floating Reservar bar shows only once the cover's button has scrolled away.
  const heroBook = useRef(null);
  const [heroVisible, setHeroVisible] = useState(true);
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
      kind === 'restaurant' || kind === 'beauty' ? getRestaurantSettings(biz.name, kind) : Promise.resolve(null),
    ]);
    return { biz, kind, products, settings };
  }, [name]);

  useEffect(() => {
    if (!data?.biz) return undefined;
    const prev = document.title;
    document.title = `${data.biz.name} · ${data.kind === 'restaurant' ? 'Carta y reservas' : data.biz.category || 'Palencia'} | NetWish`;
    return () => { document.title = prev; };
  }, [data?.biz?.name]);

  useEffect(() => {
    const el = heroBook.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(([e]) => setHeroVisible(e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
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
  const state = isRestaurant || isBeauty ? openState(settings) : null;
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
    return (
      <div className="page flush-top" style={{ paddingBottom: isBeauty ? 120 : undefined }}>
        <Hero biz={biz} state={state} />
        <div className="overlap stack">
          <Actions biz={biz} booksService={isBeauty} />
          {isBeauty ? (
            <>
              <ServiceBooking biz={biz} services={products} settings={settings} />
              <Hours settings={settings} />
            </>
          ) : (
            <>
              <ProductList biz={biz} products={products} music={kind === 'music'} />
              {!products.length && (biz.address || biz.telefono) && <InfoCard biz={biz} settings={{}} />}
            </>
          )}
        </div>
      </div>
    );
  }

  const lineNow = [state?.label, menuToday && Number(menu.price) > 0 && `Menú del día ${money(menu.price)}`].filter(Boolean).join(' · ');
  const carta = !menuToday || showCarta;
  return (
    <div className="page flush-top" style={{ paddingBottom: canBook ? 120 : undefined }}>
      <CoverHero biz={biz} eyebrow={[biz.category || categoryOf(biz).label, biz.address].filter(Boolean).join(' · ')} line={lineNow}>
        {canBook && <button ref={heroBook} className="hero-book" onClick={() => book()}>Reservar mesa</button>}
      </CoverHero>

      <div className="biz-layout" style={{ marginTop: 6 }}>
        <div className="biz-main">
          <TextActions biz={biz} />
          {menuToday && <TodayCard menu={menu} showCarta={showCarta} onCarta={() => setShowCarta((v) => !v)} />}
          {carta && <ProductList biz={biz} products={products} compact />}
          {eventsCard}
          <div className="wide-hide-flex">
            <InfoCard biz={biz} settings={settings} extra={(
              <>
                {badges && <div style={{ marginTop: 6 }}>{badges}</div>}
                {settings.profile?.para_llevar && biz.telefono && <a className="btn soft block" href={`tel:${biz.telefono}`}>Llamar para pedir para llevar</a>}
              </>
            )} />
          </div>
        </div>

        <aside className="biz-aside">
          {canBook && <BookCard biz={biz} settings={settings} onBook={book} />}
          <div className="only-wide" style={{ flexDirection: 'column' }}><InfoCard biz={biz} settings={settings} extra={badges && <div style={{ marginTop: 6 }}>{badges}</div>} /></div>
        </aside>
      </div>

      {canBook && !heroVisible && (
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
