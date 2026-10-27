import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import { Empty, Sheet, useToast } from './ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { createPickupOrder } from '../lib/data.js';
import { typeOf } from '../lib/businessTypes.js';
import { typeFacts } from '../lib/typeQuestions.js';
import { money, todayISO } from '../lib/format.js';
import { readGuest, rememberPickup, saveGuest } from '../lib/guest.js';
import {
  availability, byWeight, colorsOf, hasVariants, ONLINE_PAYMENTS, PAYMENTS, perUnit, pickupDays, pickupTimes,
  priceText, sizesOf, variantKey, variantLabel, variantStock,
} from '../lib/shop.js';

const dayLabel = (iso) => {
  if (iso === todayISO()) return 'hoy';
  const s = new Date(`${iso}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  return `el ${s}`;
};

function Badge({ a }) {
  if (a.soldOut) return <span className="p-badge out">Agotado</span>;
  if (a.preorder) return <span className="p-badge">Por encargo · {a.preorder} {a.preorder === 1 ? 'día' : 'días'}</span>;
  if (a.low) return <span className="p-badge warn">{a.left === 1 ? 'Queda 1' : `Quedan ${a.left}`}</span>;
  if (a.sale) return <span className="p-badge sale">−{a.sale} %</span>;
  return null;
}

function ProductCard({ p, onOpen, tall }) {
  const a = availability(p);
  return (
    <button className={`p-card${a.soldOut ? ' out' : ''}`} onClick={() => onOpen(p)}>
      <span className={`p-img${tall ? ' tall' : ''}`}>
        {p.image_url ? <img src={p.image_url} alt="" loading="lazy" /> : <Icon name="image" size={28} stroke={1.6} />}
        <Badge a={a} />
      </span>
      <span className="p-body">
        <span className="p-name">{p.name}</span>
        <span className="p-price">
          <strong>{priceText(p)}</strong>
          {a.sale > 0 && <s>{money(p.old_price)}</s>}
        </span>
      </span>
    </button>
  );
}

// One product: photos, size and colour, how many, and into the basket.
function ProductSheet({ biz, product, canOrder, onClose }) {
  const cart = useCart();
  const toast = useToast();
  const sizes = sizesOf(product);
  const colors = colorsOf(product);
  const photos = [product.image_url, ...(product.images || [])].filter(Boolean);
  const [photo, setPhoto] = useState(0);
  const [size, setSize] = useState(sizes.length === 1 ? sizes[0] : '');
  const [color, setColor] = useState(colors.length === 1 ? colors[0] : '');
  const [qty, setQty] = useState(1);
  const a = availability(product);
  const key = variantKey(sizes.length ? size : '', colors.length ? color : '');
  const ready = (!sizes.length || size) && (!colors.length || color);
  const left = ready && hasVariants(product) ? variantStock(product, key) : a.left;
  const outNow = a.soldOut || left === 0;
  // A size is greyed out when no colour of it is left (or that exact colour, once one is picked).
  const sizeLeft = (s) => {
    const keys = colors.length ? (color ? [variantKey(s, color)] : colors.map((c) => variantKey(s, c))) : [variantKey(s, '')];
    const counted = keys.map((k) => variantStock(product, k)).filter((n) => n !== null);
    return counted.length ? counted.reduce((x, n) => x + n, 0) : null;
  };
  const colorLeft = (c) => {
    const keys = sizes.length ? (size ? [variantKey(size, c)] : sizes.map((s) => variantKey(s, c))) : [variantKey('', c)];
    const counted = keys.map((k) => variantStock(product, k)).filter((n) => n !== null);
    return counted.length ? counted.reduce((x, n) => x + n, 0) : null;
  };
  const max = left === null ? 20 : left;

  const add = () => {
    cart.add(biz.name, { ...product, variant: key || null }, Math.min(qty, max));
    toast(`${product.name} en tu cesta`);
    onClose();
  };

  return (
    <Sheet open onClose={onClose} title={product.name}>
      <div className="stack">
        {photos.length > 0 && (
          <div className="p-gallery">
            <img src={photos[photo]} alt={product.name} />
            {photos.length > 1 && (
              <div className="p-thumbs">
                {photos.map((src, i) => <button key={src} aria-pressed={i === photo} onClick={() => setPhoto(i)}><img src={src} alt="" /></button>)}
              </div>
            )}
          </div>
        )}
        <div className="row between" style={{ alignItems: 'baseline' }}>
          <span className="title-lg price">{priceText(product)}</span>
          {a.sale > 0 && <span className="small muted"><s>{money(product.old_price)}</s> · −{a.sale} %</span>}
        </div>
        {product.description && <p className="muted" style={{ margin: 0 }}>{product.description}</p>}
        {byWeight(product) && <p className="small muted" style={{ margin: 0 }}>Precio{perUnit(product.unit)}. Se pesa en la tienda y pagas lo que pese.</p>}
        {a.preorder > 0 && <p className="small" style={{ margin: 0, fontWeight: 700 }}>Se encarga con {a.preorder} {a.preorder === 1 ? 'día' : 'días'} de antelación.</p>}

        {sizes.length > 0 && (
          <div className="stack" style={{ gap: 8 }}>
            <span className="eyebrow">Talla</span>
            <div className="size-pick">
              {sizes.map((s) => {
                const n = sizeLeft(s);
                return <button key={s} aria-pressed={size === s} disabled={n === 0} onClick={() => { setSize(s); setQty(1); }}>{s}</button>;
              })}
            </div>
          </div>
        )}
        {colors.length > 0 && (
          <div className="stack" style={{ gap: 8 }}>
            <span className="eyebrow">Color</span>
            <div className="chips">
              {colors.map((c) => {
                const n = colorLeft(c);
                return <button key={c} className={`chip ${color === c ? 'on' : ''}`} style={{ background: color === c ? undefined : 'var(--surface)' }} disabled={n === 0} aria-pressed={color === c} onClick={() => { setColor(c); setQty(1); }}>{c}{n === 0 ? ' · agotado' : ''}</button>;
              })}
            </div>
          </div>
        )}
        {ready && left !== null && left > 0 && left <= 3 && <span className="small" style={{ fontWeight: 700, color: 'var(--warn)' }}>{left === 1 ? '¡Solo queda 1!' : `Solo quedan ${left}`}{key ? ` en ${variantLabel(key)}` : ''}</span>}

        {canOrder ? (
          outNow ? (
            <div className="widget" style={{ textAlign: 'center' }}><strong>Agotado{key && hasVariants(product) ? ` en ${variantLabel(key)}` : ''}</strong><p className="small muted" style={{ margin: '4px 0 0' }}>Pregunta a {biz.name} si les va a llegar más.</p></div>
          ) : (
            <div className="row" style={{ gap: 10 }}>
              <span className="qty">
                <button onClick={() => setQty((n) => Math.max(1, n - 1))} aria-label="Uno menos"><Icon name="minus" size={18} stroke={2.6} /></button>
                <span>{qty}</span>
                <button onClick={() => setQty((n) => Math.min(max, n + 1))} aria-label="Uno más" disabled={qty >= max}><Icon name="plus" size={18} stroke={2.6} /></button>
              </span>
              <button className="btn primary grow" disabled={!ready} onClick={add}>
                {ready ? `Añadir · ${money(Number(product.price) * qty)}` : sizes.length && !size ? 'Elige tu talla' : 'Elige el color'}
              </button>
            </div>
          )
        ) : (
          <Link to={`/chat/${encodeURIComponent(biz.name)}`} className="btn soft block"><Icon name="chat" size={18} /> Preguntar a {biz.name}</Link>
        )}
      </div>
    </Sheet>
  );
}

// The basket: when to pick it up, how to pay, and who you are.
function CheckoutSheet({ biz, settings, products, onClose }) {
  const { user, displayName } = useAuth();
  const cart = useCart();
  const toast = useToast();
  const basket = cart.cartFor(biz.name);
  const profile = settings?.profile || {};
  const type = typeOf(biz);
  const prep = Number(profile.prep_min) || type.shop?.prep || 30;
  const byId = new Map(products.map((p) => [p.id, p]));
  const ahead = Math.max(0, ...basket.items.map((l) => Number(byId.get(l.pid)?.preorder_days) || 0));
  const days = useMemo(() => pickupDays(settings, ahead, 21, prep), [settings, ahead, prep]);
  const [date, setDate] = useState(() => days.find((d) => !d.closed)?.iso || '');
  const times = pickupTimes(settings, date, prep);
  const [time, setTime] = useState('');
  const methods = (profile.pagos?.length ? profile.pagos : ['tarjeta', 'efectivo']).filter((m) => PAYMENTS[m] && m !== 'online');
  const [payment, setPayment] = useState(methods[0]);
  const [guest, setGuest] = useState(() => {
    const g = readGuest();
    return { name: user ? displayName || g.name : g.name, email: user?.email || g.email, phone: g.phone };
  });
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const weight = basket.items.some((l) => byWeight(l));

  useEffect(() => { if (!times.includes(time)) setTime(times[0] || ''); }, [date]);

  const submit = async (e) => {
    e.preventDefault();
    if (!date || !time) { toast('Elige cuándo vas a recogerlo', 'error'); return; }
    setBusy(true);
    try {
      const res = await createPickupOrder({ business: biz.name, lines: basket.items, date, time, payment, name: guest.name.trim(), email: guest.email.trim(), phone: guest.phone.trim(), note: note.trim() });
      saveGuest({ name: guest.name.trim(), email: guest.email.trim(), phone: guest.phone.trim() });
      rememberPickup({ id: res.id, code: res.code, business_name: biz.name, date, time, total: res.total, items: basket.items.map((l) => `${l.qty}x ${l.name}${l.variant ? ` (${variantLabel(l.variant)})` : ''}`).join(', ') });
      cart.clear(biz.name);
      setDone({ ...res, date, time });
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <Sheet open onClose={onClose} title="¡Pedido hecho!">
        <div className="stack" style={{ alignItems: 'center', textAlign: 'center' }}>
          <span className="eyebrow">Tu código de recogida</span>
          <span className="pickup-code">{done.code}</span>
          <p style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Recógelo {dayLabel(done.date)} a partir de las {done.time}</p>
          <p className="muted" style={{ margin: 0 }}>{biz.name} ya lo tiene apartado. Te escribiremos a {guest.email} cuando esté listo. Pagas al recogerlo{payment ? ` (${PAYMENTS[payment].short.toLowerCase()})` : ''}.</p>
          {biz.address && <span className="small muted">{biz.address}</span>}
          <Link to="/reservas" className="btn primary block" onClick={onClose}>Ver mis pedidos</Link>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet open onClose={onClose} title="Tu cesta">
      <form className="stack" onSubmit={submit}>
        <div className="widget" style={{ paddingTop: 4, paddingBottom: 4 }}>
          {basket.items.map((l) => (
            <div key={l.id} className="list-row" style={{ gap: 12 }}>
              <span className="p-thumb">{l.image ? <img src={l.image} alt="" /> : <Icon name="bag" size={18} />}</span>
              <span className="grow stack" style={{ gap: 0, minWidth: 0 }}>
                <span className="t">{l.name}</span>
                <span className="s">{l.variant ? `${variantLabel(l.variant)} · ` : ''}{money(l.price)}{perUnit(l.unit)}</span>
              </span>
              <span className="qty sm">
                <button type="button" onClick={() => cart.remove(biz.name, { id: l.pid, variant: l.variant })} aria-label="Uno menos"><Icon name="minus" size={16} stroke={2.6} /></button>
                <span>{l.qty}</span>
                <button type="button" onClick={() => cart.add(biz.name, { id: l.pid, variant: l.variant, name: l.name, price: l.price, image_url: l.image, unit: l.unit })} aria-label="Uno más"><Icon name="plus" size={16} stroke={2.6} /></button>
              </span>
            </div>
          ))}
          <div className="row between" style={{ padding: '12px 0 10px' }}>
            <strong>Total{weight ? ' aproximado' : ''}</strong>
            <strong className="price" style={{ fontSize: 18 }}>{money(basket.total)}</strong>
          </div>
        </div>

        <div className="widget stack" style={{ gap: 10 }}>
          <span className="eyebrow">¿Cuándo lo recoges?</span>
          {ahead > 0 && <span className="small muted">Hay productos por encargo: el primer día posible es {dayLabel(days[0]?.iso || todayISO())}.</span>}
          <div className="day-strip">
            {days.map((d) => (
              <button type="button" key={d.iso} className="day-pill" disabled={d.closed} aria-pressed={date === d.iso} onClick={() => setDate(d.iso)}>
                <span className="wd">{d.weekday}</span><span className="dn">{d.day}</span>
              </button>
            ))}
          </div>
          {times.length ? (
            <div className="time-grid">
              {times.map((t) => <button type="button" key={t} className="time-pill" aria-pressed={time === t} onClick={() => setTime(t)}>{t}</button>)}
            </div>
          ) : <span className="small muted">Ese día no abre. Elige otro.</span>}
        </div>

        <div className="widget stack" style={{ gap: 10 }}>
          <span className="eyebrow">¿Cómo pagas?</span>
          <div className="stack" style={{ gap: 8 }}>
            {methods.map((m) => (
              <button type="button" key={m} className={`pay-opt${payment === m ? ' on' : ''}`} aria-pressed={payment === m} onClick={() => setPayment(m)}>
                <Icon name={PAYMENTS[m].icon} size={20} /> <span className="grow">{PAYMENTS[m].label}</span>
                {payment === m && <Icon name="check" size={18} stroke={3} />}
              </button>
            ))}
            {!ONLINE_PAYMENTS && (
              <button type="button" className="pay-opt" disabled>
                <Icon name="lock" size={20} /> <span className="grow">Pagar ahora con tarjeta</span><span className="small">Pronto</span>
              </button>
            )}
          </div>
          <span className="small muted">No se cobra nada ahora. Pagas cuando lo recojas.</span>
        </div>

        <div className="widget stack" style={{ gap: 10 }}>
          <span className="eyebrow">Tus datos</span>
          <div className="field"><label htmlFor="co-name">Nombre</label><input id="co-name" className="input" required minLength={2} maxLength={60} value={guest.name} onChange={(e) => setGuest({ ...guest, name: e.target.value })} /></div>
          {!user && <div className="field"><label htmlFor="co-mail">Correo (te avisamos cuando esté listo)</label><input id="co-mail" className="input" type="email" required value={guest.email} onChange={(e) => setGuest({ ...guest, email: e.target.value })} /></div>}
          <div className="field"><label htmlFor="co-tel">Teléfono (opcional)</label><input id="co-tel" className="input" type="tel" maxLength={20} value={guest.phone} onChange={(e) => setGuest({ ...guest, phone: e.target.value })} /></div>
          <div className="field"><label htmlFor="co-note">Algo que deba saber la tienda (opcional)</label><textarea id="co-note" className="input" rows={2} maxLength={240} value={note} onChange={(e) => setNote(e.target.value)} placeholder={type.key === 'panaderia' ? 'Ej.: la barra poco hecha, el nombre en la tarta…' : type.key === 'floristeria' ? 'Ej.: texto para la tarjeta' : 'Ej.: es para regalo'} /></div>
        </div>

        <button className="btn primary block" disabled={busy || !basket.count || !time}>{busy ? 'Enviando…' : `Hacer pedido · ${money(basket.total)}`}</button>
        <span className="small muted" style={{ textAlign: 'center' }}>Lo apartamos al momento. Si al final no puedes ir, avísales.</span>
      </form>
    </Sheet>
  );
}

// "Pan recién hecho a las 7:30, 12:00 y 18:30" with the next one highlighted.
function Batches({ list }) {
  if (!list?.length) return null;
  const now = new Date().toTimeString().slice(0, 5);
  const next = list.find((b) => b.time > now);
  return (
    <div className="widget stack" style={{ gap: 10 }}>
      <div className="row between">
        <span className="stack" style={{ gap: 0 }}>
          <span className="eyebrow">Hornadas de hoy</span>
          <strong style={{ fontSize: 17 }}>{next ? `Próxima a las ${next.time}` : 'Ya ha salido la última del día'}</strong>
        </span>
        <span className="mono" style={{ background: 'var(--accent)', color: 'var(--ink)' }}><Icon name="flame" size={20} /></span>
      </div>
      <div className="chips">
        {list.map((b) => (
          <span key={b.time} className="fact" style={{ background: b === next ? 'var(--ink)' : 'var(--bg)', color: b === next ? '#fff' : undefined }}>
            {b.time}{b.label ? ` · ${b.label}` : ''}
          </span>
        ))}
      </div>
    </div>
  );
}

export function shopFacts(biz, settings) {
  const p = settings?.profile || {};
  const pay = (p.pagos || []).map((m) => PAYMENTS[m]?.short).filter(Boolean);
  return [
    p.recogida && 'Compra online y recoge en tienda',
    pay.length && `Pago: ${pay.join(', ').toLowerCase()}`,
    ...typeFacts(biz, p),
  ].filter(Boolean);
}

export default function ShopFront({ biz, products, settings }) {
  const cart = useCart();
  const type = typeOf(biz);
  const profile = settings?.profile || {};
  const canOrder = profile.recogida === true;
  const [open, setOpen] = useState(null);
  const [checkout, setCheckout] = useState(false);
  const [section, setSection] = useState('');
  const visible = products.filter((p) => !p.hidden);
  const sections = [...new Set(visible.map((p) => p.section || 'Productos'))];
  const featured = visible.filter((p) => p.featured && !availability(p).soldOut);
  const shown = section ? visible.filter((p) => (p.section || 'Productos') === section) : visible;
  const basket = cart.cartFor(biz.name);
  const facts = shopFacts(biz, settings);
  const tall = type.key === 'moda';
  const photos = visible.some((p) => p.image_url);

  if (!visible.length) {
    return <div className="widget"><Empty icon="bag" title="Aún no hay productos">{biz.name} todavía no ha subido su catálogo. Puedes escribirle por el chat.</Empty></div>;
  }

  // Grouped by section when nothing is filtered, so the counter reads like the shop's shelves.
  const groups = section ? [[section, shown]] : sections.map((s) => [s, visible.filter((p) => (p.section || 'Productos') === s)]);

  return (
    <>
      {facts.length > 0 && <div className="widget" style={{ padding: 14 }}><div className="facts">{facts.map((f) => <span key={f} className="fact">{f}</span>)}</div></div>}
      {type.shop?.batches && <Batches list={profile.hornadas} />}
      {profile.cambios && <p className="small muted" style={{ margin: '0 4px' }}>{profile.cambios}</p>}

      {photos && !section && featured.length > 1 && (
        <section className="stack" style={{ gap: 8 }}>
          <h2 className="title-lg" style={{ margin: '0 4px' }}>{type.shop?.daily ? 'Hoy en el mostrador' : 'Destacados'}</h2>
          <div className="p-rail">{featured.map((p) => <ProductCard key={p.id} p={p} onOpen={setOpen} tall={tall} />)}</div>
        </section>
      )}

      {sections.length > 1 && (
        <div className="chips" role="tablist" aria-label="Secciones">
          <button role="tab" aria-selected={!section} className={`chip ${!section ? 'on' : ''}`} onClick={() => setSection('')}>Todo</button>
          {sections.map((s) => <button key={s} role="tab" aria-selected={section === s} className={`chip ${section === s ? 'on' : ''}`} onClick={() => setSection(s)}>{s}</button>)}
        </div>
      )}

      {photos ? groups.map(([name, list]) => (
        <section key={name} className="stack" style={{ gap: 8 }} id="catalogo">
          {groups.length > 1 && <h2 className="title-lg" style={{ margin: '4px 4px 0' }}>{name}</h2>}
          <div className="p-grid">{list.map((p) => <ProductCard key={p.id} p={p} onOpen={setOpen} tall={tall} />)}</div>
        </section>
      )) : (
        // Without photos the catalogue reads better as a list, like a price board.
        <div className="menu-grid" id="catalogo">
          {groups.map(([name, list]) => (
            <section key={name} className="widget" style={{ paddingBottom: 4 }}>
              <h2 className="title-lg" style={{ marginBottom: 4 }}>{name}</h2>
              {list.map((p) => {
                const a = availability(p);
                return (
                  <button key={p.id} className="list-row" onClick={() => setOpen(p)} style={{ textAlign: 'left', opacity: a.soldOut ? 0.55 : 1 }}>
                    <span className="grow stack" style={{ gap: 1 }}>
                      <span className="t">{p.name}</span>
                      {p.description && <span className="s">{p.description}</span>}
                      {(a.soldOut || a.low || a.preorder > 0) && <span className="s" style={{ fontWeight: 700, color: a.soldOut ? 'var(--danger)' : 'var(--warn)' }}>{a.soldOut ? 'Agotado' : a.preorder ? `Por encargo · ${a.preorder} ${a.preorder === 1 ? 'día' : 'días'}` : `Quedan ${a.left}`}</span>}
                    </span>
                    <span className="price" style={{ fontSize: 15, fontWeight: 700 }}>{priceText(p)}</span>
                  </button>
                );
              })}
            </section>
          ))}
        </div>
      )}

      {canOrder && basket.count > 0 && (
        <button className="cta-bar" onClick={() => setCheckout(true)}>
          <span className="stack" style={{ gap: 0, textAlign: 'left' }}>
            <span style={{ fontSize: 16, fontWeight: 800 }}>Tu cesta · {basket.count} {basket.count === 1 ? 'artículo' : 'artículos'}</span>
            <span className="small" style={{ opacity: 0.65, fontWeight: 600 }}>{money(basket.total)} · recoges en tienda</span>
          </span>
          <span className="go">Ver cesta</span>
        </button>
      )}

      {open && <ProductSheet biz={biz} product={open} canOrder={canOrder} onClose={() => setOpen(null)} />}
      {checkout && <CheckoutSheet biz={biz} settings={settings} products={products} onClose={() => setCheckout(false)} />}
    </>
  );
}
