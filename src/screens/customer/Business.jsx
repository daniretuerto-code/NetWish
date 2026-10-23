import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import { BackButton, Empty, Spinner, Stepper } from '../../components/ui.jsx';
import ReserveSheet from '../../components/ReserveSheet.jsx';
import { useCart } from '../../context/CartContext.jsx';
import useAsync from '../../hooks/useAsync.js';
import { findBusiness, getRestaurantSettings, listProducts } from '../../lib/data.js';
import { categoryOf, kindOf } from '../../lib/categories.js';
import { initials, money, toneFor } from '../../lib/format.js';

function Hero({ biz }) {
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

function ProductList({ biz, products, music }) {
  const cart = useCart();
  const current = cart.cartFor(biz.name);
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
    return <div className="widget"><Empty icon="book" title="Aún no hay productos">Este comercio todavía no ha publicado su catálogo.</Empty></div>;
  }

  return sections.map(([section, items]) => (
    <section key={section} className="widget" style={{ paddingBottom: 4 }}>
      <h2 className="title-lg" style={{ marginBottom: 4 }}>{section}</h2>
      {items.map((p) => (
        <div key={p.id} className="list-row">
          {music && <AudioPreview src={p.audio_url} name={p.name} playing={playing === p.id} onToggle={() => toggle(p)} />}
          <span className="grow stack" style={{ gap: 1 }}>
            <span className="t">{p.name}</span>
            {p.description && <span className="s">{p.description}</span>}
            <span className="s price" style={{ color: 'var(--ink-2)' }}>{money(p.price)}</span>
          </span>
          <Stepper qty={current.qtyOf(p.id)} onAdd={() => cart.add(biz.name, p)} onRemove={() => cart.remove(biz.name, p)} />
        </div>
      ))}
    </section>
  ));
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

export default function Business() {
  const { name } = useParams();
  const navigate = useNavigate();
  const cart = useCart();
  const [tab, setTab] = useState('carta');
  const [reserveOpen, setReserveOpen] = useState(false);

  const { data, loading } = useAsync(async () => {
    const biz = await findBusiness(name);
    if (!biz) return { biz: null };
    const kind = kindOf(biz);
    const [products, settings] = await Promise.all([
      listProducts(biz.name),
      kind === 'restaurant' ? getRestaurantSettings(biz.name) : Promise.resolve(null),
    ]);
    return { biz, kind, products, settings };
  }, [name]);

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
  const current = cart.cartFor(biz.name);
  const isRestaurant = kind === 'restaurant';

  return (
    <div className="page flush-top" style={{ paddingBottom: current.count ? 120 : undefined }}>
      <Hero biz={biz} />

      <div className="overlap stack">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
          {isRestaurant ? (
            <button className="widget tight stack" style={{ border: 0, textAlign: 'left', gap: 8, boxShadow: 'var(--shadow)' }} onClick={() => setReserveOpen(true)}>
              <span className="small muted">Mesa</span>
              <span style={{ fontSize: 16, fontWeight: 800 }}>Reservar</span>
            </button>
          ) : (
            <Link to={`/pagar/${encodeURIComponent(biz.name)}`} className="widget tight stack" style={{ textDecoration: 'none', gap: 8, boxShadow: 'var(--shadow)' }}>
              <span className="small muted">Importe libre</span>
              <span style={{ fontSize: 16, fontWeight: 800 }}>Pagar</span>
            </Link>
          )}
          {biz.telefono ? (
            <a href={`tel:${biz.telefono}`} className="widget tight stack" style={{ textDecoration: 'none', gap: 8, boxShadow: 'var(--shadow)' }}>
              <span className="small muted">Teléfono</span>
              <span style={{ fontSize: 16, fontWeight: 800 }}>Llamar</span>
            </a>
          ) : (
            <a href={`https://www.google.com/maps/search/${encodeURIComponent(`${biz.name} Palencia`)}`} target="_blank" rel="noreferrer" className="widget tight stack" style={{ textDecoration: 'none', gap: 8, boxShadow: 'var(--shadow)' }}>
              <span className="small muted">Mapa</span>
              <span style={{ fontSize: 16, fontWeight: 800 }}>Cómo llegar</span>
            </a>
          )}
          <Link to={`/chat/${encodeURIComponent(biz.name)}`} className="widget dark tight stack" style={{ textDecoration: 'none', gap: 8, boxShadow: 'var(--shadow)' }}>
            <span className="small muted">Chat</span>
            <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--accent)' }}>Escribir</span>
          </Link>
        </div>

        {isRestaurant && (
          <div className="segmented" role="tablist" aria-label="Secciones">
            <button role="tab" aria-selected={tab === 'carta'} onClick={() => setTab('carta')}>Carta</button>
            <button role="tab" aria-selected={tab === 'menu'} onClick={() => setTab('menu')}>Menú del día</button>
            <button role="tab" aria-selected={tab === 'info'} onClick={() => setTab('info')}>Horario</button>
          </div>
        )}

        {(!isRestaurant || tab === 'carta') && <ProductList biz={biz} products={products} music={kind === 'music'} />}
        {isRestaurant && tab === 'menu' && <DailyMenu menu={settings?.daily_menu} />}
        {isRestaurant && tab === 'info' && (
          <div className="widget stack">
            <div className="list-row"><span className="grow t">Comidas</span><span className="s">{settings.lunch_start} – {settings.lunch_end}</span></div>
            <div className="list-row"><span className="grow t">Cenas</span><span className="s">{settings.dinner_start} – {settings.dinner_end}</span></div>
            <button className="btn primary block" onClick={() => setReserveOpen(true)}>Reservar mesa</button>
          </div>
        )}
      </div>

      {current.count > 0 && (
        <button className="cta-bar" onClick={() => navigate(`/negocio/${encodeURIComponent(biz.name)}/pedido`)}>
          <span style={{ fontSize: 17, fontWeight: 800 }}>
            {money(current.total)} <span style={{ fontWeight: 400, opacity: 0.6 }}>· {current.count} {current.count === 1 ? 'producto' : 'productos'}</span>
          </span>
          <span className="go">Pedir</span>
        </button>
      )}

      {isRestaurant && <ReserveSheet open={reserveOpen} onClose={() => setReserveOpen(false)} biz={biz} settings={settings} />}
    </div>
  );
}
