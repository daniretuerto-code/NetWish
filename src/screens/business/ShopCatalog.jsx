import { useMemo, useRef, useState } from 'react';
import Icon from '../../components/Icon.jsx';
import { Empty, PageHeader, Sheet, Skeleton, useToast } from '../../components/ui.jsx';
import SectionTabs from '../../components/SectionTabs.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import useAsync from '../../hooks/useAsync.js';
import { createProduct, deleteProduct, listProducts, safeSlug, updateProduct, uploadPublicFile } from '../../lib/data.js';
import { typeOf } from '../../lib/businessTypes.js';
import { normalize } from '../../lib/format.js';
import { availability, priceText, UNITS, variantKey, variantLabel } from '../../lib/shop.js';

const MAX_PHOTOS = 6;
const list = (s) => [...new Set(String(s || '').split(',').map((x) => x.trim()).filter(Boolean))].slice(0, 20);
const num = (v) => (v === '' || v === null || v === undefined ? null : Number(String(v).replace(',', '.')));

// Phone photos are 4–12 MB: shrink them to 1400 px JPEG before uploading.
async function shrink(file) {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1400 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.82));
    return blob ? new File([blob], 'foto.jpg', { type: 'image/jpeg' }) : file;
  } catch {
    return file;
  }
}

const blank = (section) => ({
  name: '', section: section || '', price: '', old_price: '', description: '', unit: 'ud',
  track: false, stock: '', daily_qty: '', preorder_days: '0', featured: false, hidden: false, sold_out: false,
  sizes: '', colors: '', vstock: {}, images: [],
});

const formOf = (p) => ({
  name: p.name || '', section: p.section || '', price: String(p.price ?? ''), old_price: p.old_price ? String(p.old_price) : '',
  description: p.description || '', unit: p.unit || 'ud',
  track: p.stock !== null && p.stock !== undefined, stock: p.stock ?? '', daily_qty: p.daily_qty ?? '',
  preorder_days: String(p.preorder_days || 0), featured: !!p.featured, hidden: !!p.hidden, sold_out: !!p.sold_out,
  sizes: (p.variants?.sizes || []).join(', '), colors: (p.variants?.colors || []).join(', '), vstock: { ...(p.variants?.stock || {}) },
  images: (p.images?.length ? p.images : [p.image_url]).filter(Boolean),
});

function ProductEditor({ product, business, type, sections, onClose, onSaved }) {
  const toast = useToast();
  const fileRef = useRef(null);
  const opts = type.shop || {};
  const [form, setForm] = useState(() => (product?.id ? formOf(product) : blank(product?.section)));
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const sizes = list(form.sizes);
  const colors = list(form.colors);
  const combos = sizes.length || colors.length
    ? (sizes.length ? sizes : ['']).flatMap((s) => (colors.length ? colors : ['']).map((c) => variantKey(s, c)))
    : [];

  const addPhotos = async (files) => {
    const picked = [...files].slice(0, MAX_PHOTOS - form.images.length);
    if (!picked.length) return;
    setUploading(true);
    try {
      const urls = [];
      for (const f of picked) {
        const small = await shrink(f);
        if (small.size > 8 * 1024 * 1024) throw new Error('La foto pesa demasiado (máx. 8 MB)');
        urls.push(await uploadPublicFile('public-images', `${safeSlug(business.name)}/producto_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.jpg`, small));
      }
      setForm((f) => ({ ...f, images: [...f.images, ...urls].slice(0, MAX_PHOTOS) }));
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const movePhoto = (i, dir) => setForm((f) => {
    const imgs = [...f.images];
    const j = i + dir;
    if (j < 0 || j >= imgs.length) return f;
    [imgs[i], imgs[j]] = [imgs[j], imgs[i]];
    return { ...f, images: imgs };
  });

  const submit = async (e) => {
    e.preventDefault();
    const price = num(form.price);
    if (!form.name.trim() || !(price >= 0)) {
      toast('Revisa el nombre y el precio', 'error');
      return;
    }
    const vstock = {};
    for (const k of combos) if (form.vstock[k] !== '' && form.vstock[k] !== undefined) vstock[k] = Math.max(0, parseInt(form.vstock[k], 10) || 0);
    const row = {
      name: form.name.trim().slice(0, 120),
      section: form.section.trim().slice(0, 60) || null,
      price,
      old_price: num(form.old_price) > price ? num(form.old_price) : null,
      description: form.description.trim().slice(0, 800) || null,
      unit: form.unit === 'ud' ? null : form.unit,
      image_url: form.images[0] || null,
      images: form.images,
      stock: form.track && !combos.length ? Math.max(0, parseInt(form.stock, 10) || 0) : null,
      daily_qty: opts.daily && form.daily_qty !== '' ? Math.max(0, parseInt(form.daily_qty, 10) || 0) : null,
      preorder_days: Math.max(0, parseInt(form.preorder_days, 10) || 0),
      featured: form.featured,
      hidden: form.hidden,
      sold_out: form.sold_out,
      variants: combos.length ? { sizes, colors, ...(Object.keys(vstock).length ? { stock: vstock } : {}) } : null,
    };
    setBusy(true);
    try {
      if (product?.id) await updateProduct(product.id, row);
      else await createProduct({ ...row, business_id: business.name });
      toast(product?.id ? 'Guardado' : 'Producto añadido a tu tienda');
      onSaved();
      onClose();
    } catch (err) {
      toast(/column/.test(err.message) ? 'Falta actualizar la base de datos (el archivo SQL de tiendas).' : err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    try {
      await deleteProduct(product.id);
      toast('Producto eliminado');
      onSaved();
      onClose();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const placeholders = {
    moda: { name: 'Camisa de lino', section: 'Camisas, Vestidos, Rebajas…', sizes: 'XS, S, M, L, XL', colors: 'Blanco, Azul' },
    panaderia: { name: 'Hogaza de masa madre', section: 'Pan, Bollería, Tartas…' },
    alimentacion: { name: 'Chuletillas de lechazo', section: 'Lechazo, Embutido, Quesos…' },
    floristeria: { name: 'Ramo de temporada', section: 'Ramos, Plantas, Bodas…' },
  }[type.key] || { name: 'Nombre del producto', section: 'Sección' };

  return (
    <Sheet open onClose={onClose} title={product?.id ? 'Editar producto' : 'Nuevo producto'}>
      <form className="stack" onSubmit={submit}>
        <div className="stack" style={{ gap: 8 }}>
          <span className="eyebrow">Fotos {form.images.length ? `(${form.images.length}/${MAX_PHOTOS}) · la primera es la portada` : ''}</span>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            {form.images.map((src, i) => (
              <div key={src} className="p-thumb" style={{ position: 'relative', width: 84, height: 84 }}>
                <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 12 }} />
                <span className="row" style={{ position: 'absolute', inset: 'auto 4px 4px 4px', gap: 2, justifyContent: 'space-between' }}>
                  <button type="button" className="btn sm soft" style={{ minHeight: 26, padding: '0 6px' }} aria-label="Mover a la izquierda" onClick={() => movePhoto(i, -1)} disabled={i === 0}>‹</button>
                  <button type="button" className="btn sm soft" style={{ minHeight: 26, padding: '0 6px' }} aria-label="Quitar foto" onClick={() => setForm((f) => ({ ...f, images: f.images.filter((x) => x !== src) }))}><Icon name="close" size={12} /></button>
                  <button type="button" className="btn sm soft" style={{ minHeight: 26, padding: '0 6px' }} aria-label="Mover a la derecha" onClick={() => movePhoto(i, 1)} disabled={i === form.images.length - 1}>›</button>
                </span>
              </div>
            ))}
            {form.images.length < MAX_PHOTOS && (
              <button type="button" className="p-thumb" onClick={() => fileRef.current?.click()} disabled={uploading}
                style={{ width: 84, height: 84, borderRadius: 12, border: '2px dashed var(--line, #ddd)', background: 'var(--bg)', display: 'grid', placeItems: 'center', color: 'var(--muted)' }}>
                {uploading ? '…' : <span className="stack" style={{ gap: 2, alignItems: 'center', fontSize: 12, fontWeight: 700 }}><Icon name="camera" size={22} />Añadir</span>}
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => addPhotos(e.target.files || [])} />
          <span className="small muted">Haz la foto con el móvil: con luz natural y fondo liso se vende mucho más.</span>
        </div>

        <div className="field"><label htmlFor="sp-name">Nombre</label><input id="sp-name" className="input" required maxLength={120} value={form.name} onChange={set('name')} placeholder={placeholders.name} /></div>
        <div className="bento">
          <div className="field"><label htmlFor="sp-price">Precio (€)</label><input id="sp-price" className="input" inputMode="decimal" required value={form.price} onChange={set('price')} placeholder="0,00" /></div>
          <div className="field">
            <label htmlFor="sp-unit">Se vende por</label>
            <select id="sp-unit" className="input" value={form.unit} onChange={set('unit')}>
              {UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
            </select>
          </div>
        </div>
        <div className="bento">
          <div className="field">
            <label htmlFor="sp-section">Sección</label>
            <input id="sp-section" className="input" list="sp-sections" value={form.section} onChange={set('section')} placeholder={placeholders.section} />
            <datalist id="sp-sections">{sections.map((s) => <option key={s} value={s} />)}</datalist>
          </div>
          <div className="field"><label htmlFor="sp-old">Precio antes (rebaja)</label><input id="sp-old" className="input" inputMode="decimal" value={form.old_price} onChange={set('old_price')} placeholder="Opcional" /></div>
        </div>
        <div className="field"><label htmlFor="sp-desc">Descripción</label><textarea id="sp-desc" className="input" rows={3} maxLength={800} value={form.description} onChange={set('description')} placeholder={type.key === 'moda' ? 'Tejido, cómo sienta, cuidados…' : type.key === 'panaderia' ? 'Ingredientes, alérgenos, peso…' : 'Qué es, de dónde viene, alérgenos…'} /></div>

        {(opts.variants || form.sizes || form.colors) && (
          <div className="widget stack" style={{ gap: 10, background: 'var(--bg)' }}>
            <span className="eyebrow">Tallas y colores</span>
            <div className="field"><label htmlFor="sp-sizes">Tallas (separadas por comas)</label><input id="sp-sizes" className="input" value={form.sizes} onChange={set('sizes')} placeholder={placeholders.sizes || 'S, M, L'} /></div>
            <div className="field"><label htmlFor="sp-colors">Colores (separados por comas)</label><input id="sp-colors" className="input" value={form.colors} onChange={set('colors')} placeholder={placeholders.colors || 'Opcional'} /></div>
            {combos.length > 0 && (
              <div className="stack" style={{ gap: 6 }}>
                <span className="small muted">¿Cuántas te quedan de cada una? Déjalo vacío si no las cuentas.</span>
                <div className="p-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
                  {combos.map((k) => (
                    <label key={k} className="stock-row" style={{ background: 'var(--surface)', borderRadius: 12, padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="grow small" style={{ fontWeight: 700 }}>{variantLabel(k)}</span>
                      <input className="input" style={{ width: 58, minHeight: 36, padding: '0 8px' }} inputMode="numeric" aria-label={`Unidades de ${variantLabel(k)}`} value={form.vstock[k] ?? ''} onChange={(e) => setForm((f) => ({ ...f, vstock: { ...f.vstock, [k]: e.target.value.replace(/\D/g, '') } }))} />
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="widget stack" style={{ gap: 10, background: 'var(--bg)' }}>
          <span className="eyebrow">Stock</span>
          {!combos.length && (
            <>
              <label className="row between" style={{ fontWeight: 600, minHeight: 40 }}>
                Contar unidades (se descuentan al reservar)
                <input type="checkbox" checked={form.track} onChange={set('track')} style={{ width: 22, height: 22 }} />
              </label>
              {form.track && <div className="field"><label htmlFor="sp-stock">Unidades ahora</label><input id="sp-stock" className="input" inputMode="numeric" value={form.stock} onChange={set('stock')} /></div>}
            </>
          )}
          {opts.daily && (
            <div className="field"><label htmlFor="sp-daily">Cuántas sacas cada día (para "Empezar el día")</label><input id="sp-daily" className="input" inputMode="numeric" value={form.daily_qty} onChange={set('daily_qty')} placeholder="Ej.: 40" /></div>
          )}
          <label className="row between" style={{ fontWeight: 600, minHeight: 40 }}>
            Agotado ahora
            <input type="checkbox" checked={form.sold_out} onChange={set('sold_out')} style={{ width: 22, height: 22 }} />
          </label>
          {(opts.preorder || Number(form.preorder_days)) ? (
            <div className="field">
              <label htmlFor="sp-pre">Por encargo</label>
              <select id="sp-pre" className="input" value={form.preorder_days} onChange={set('preorder_days')}>
                <option value="0">No, se lleva en el día</option>
                {[1, 2, 3, 5, 7, 14].map((d) => <option key={d} value={d}>Encargar con {d} {d === 1 ? 'día' : 'días'} de antelación</option>)}
              </select>
            </div>
          ) : null}
        </div>

        <label className="row between" style={{ fontWeight: 600, minHeight: 40 }}>
          Destacado (sale arriba, en "Lo más pedido")
          <input type="checkbox" checked={form.featured} onChange={set('featured')} style={{ width: 22, height: 22 }} />
        </label>
        <label className="row between" style={{ fontWeight: 600, minHeight: 40 }}>
          Ocultar de la tienda
          <input type="checkbox" checked={form.hidden} onChange={set('hidden')} style={{ width: 22, height: 22 }} />
        </label>

        <button className="btn primary block" disabled={busy || uploading}>{busy ? 'Guardando…' : product?.id ? 'Guardar cambios' : 'Añadir a la tienda'}</button>
        {product?.id && <button type="button" className={`btn block ${confirmDelete ? 'danger' : 'ghost'}`} onClick={remove} onBlur={() => setConfirmDelete(false)}>{confirmDelete ? 'Pulsa otra vez para eliminar' : 'Eliminar producto'}</button>}
      </form>
    </Sheet>
  );
}

// Shops: the catalogue as the customer sees it, with photos, stock and quick switches.
export default function ShopCatalog() {
  const { business } = useAuth();
  const toast = useToast();
  const type = typeOf(business);
  const [editing, setEditing] = useState(null);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const { data, loading, reload, setData } = useAsync(() => listProducts(business.name), [business.name]);
  const products = useMemo(() => data || [], [data]);
  const sections = [...new Set(products.map((p) => p.section).filter(Boolean))];

  if (loading && !data) return <Skeleton />;

  const flip = async (p, patch, msg) => {
    try {
      await updateProduct(p.id, patch);
      setData(products.map((x) => (x.id === p.id ? { ...x, ...patch } : x)));
      toast(msg);
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const shown = products.filter((p) => {
    const a = availability(p);
    if (q && !normalize(`${p.name} ${p.section || ''}`).includes(normalize(q))) return false;
    if (filter === 'out') return a.soldOut;
    if (filter === 'low') return a.low;
    if (filter === 'hidden') return p.hidden;
    if (filter === 'nophoto') return !p.image_url;
    return true;
  });
  const groups = new Map();
  for (const p of shown) {
    const key = p.section || 'Sin sección';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }
  const counts = {
    out: products.filter((p) => availability(p).soldOut).length,
    low: products.filter((p) => availability(p).low).length,
    hidden: products.filter((p) => p.hidden).length,
    nophoto: products.filter((p) => !p.image_url).length,
  };

  return (
    <div className="page">
      <PageHeader eyebrow={business.name} title={type.shop?.noun || 'Catálogo'} right={<button className="btn primary sm" onClick={() => setEditing({})}><Icon name="plus" size={16} /> Añadir</button>} />
      <SectionTabs />

      {products.length === 0 ? (
        <div className="widget">
          <Empty icon="camera" title="Sube tu primer producto">
            <span>Una foto, el nombre y el precio. En un minuto ya se puede reservar para recoger en tu tienda.</span>
            <button className="btn primary" style={{ marginTop: 8 }} onClick={() => setEditing({})}>Añadir producto</button>
          </Empty>
        </div>
      ) : (
        <>
          <input className="input" aria-label="Buscar producto" value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Buscar entre ${products.length} productos`} />
          <div className="chips">
            {[['all', 'Todos', products.length], ['out', 'Agotados', counts.out], ['low', 'Quedan pocos', counts.low], ['hidden', 'Ocultos', counts.hidden], ['nophoto', 'Sin foto', counts.nophoto]]
              .filter(([k, , n]) => k === 'all' || n).map(([k, label, n]) => (
                <button key={k} className={`chip ${filter === k ? 'on' : ''}`} aria-pressed={filter === k} onClick={() => setFilter(k)}>{label} · {n}</button>
              ))}
          </div>

          {[...groups.entries()].map(([section, items]) => (
            <section key={section} className="stack" style={{ gap: 10 }}>
              <div className="row between">
                <h2 className="title-md">{section}</h2>
                <button className="btn sm ghost" onClick={() => setEditing({ section: section === 'Sin sección' ? '' : section })}><Icon name="plus" size={14} /> Añadir aquí</button>
              </div>
              <div className="p-grid">
                {items.map((p) => {
                  const a = availability(p);
                  return (
                    <div key={p.id} className={`p-card ${a.soldOut || p.hidden ? 'out' : ''}`}>
                      <button type="button" onClick={() => setEditing(p)} style={{ border: 0, padding: 0, background: 'none', textAlign: 'left', color: 'inherit' }} aria-label={`Editar ${p.name}`}>
                        <div className="p-img">
                          {p.image_url ? <img src={p.image_url} alt="" loading="lazy" /> : <span className="stack" style={{ alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700 }}><Icon name="camera" size={26} />Añade una foto</span>}
                          {p.hidden ? <span className="p-badge">Oculto</span> : a.soldOut ? <span className="p-badge out">Agotado</span> : a.low ? <span className="p-badge warn">Quedan {a.left}</span> : a.sale ? <span className="p-badge sale">−{a.sale} %</span> : p.featured ? <span className="p-badge">Destacado</span> : null}
                        </div>
                        <div className="p-body">
                          <span className="p-name">{p.name}</span>
                          <span className="p-price">{priceText(p)}</span>
                          <span className="small muted">{a.left === null ? 'Sin contar stock' : `${a.left} en tienda`}{a.preorder ? ` · encargo ${a.preorder} d` : ''}</span>
                        </div>
                      </button>
                      <div className="row" style={{ gap: 6, padding: '0 10px 10px' }}>
                        <button className="btn sm soft" style={{ flex: 1, fontSize: 13 }} onClick={() => flip(p, { sold_out: !p.sold_out }, p.sold_out ? 'Vuelve a estar disponible' : 'Marcado como agotado')}>{p.sold_out ? 'Hay de nuevo' : 'Agotado'}</button>
                        <button className="btn sm soft" style={{ padding: '0 10px' }} aria-label={p.hidden ? 'Mostrar' : 'Ocultar'} title={p.hidden ? 'Mostrar en la tienda' : 'Ocultar de la tienda'} onClick={() => flip(p, { hidden: !p.hidden }, p.hidden ? 'Visible en tu tienda' : 'Oculto')}><Icon name="eye" size={16} /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
          {shown.length === 0 && <p className="small muted">No hay productos con ese filtro.</p>}
        </>
      )}

      {editing && <ProductEditor product={editing} business={business} type={type} sections={sections} onClose={() => setEditing(null)} onSaved={reload} />}
    </div>
  );
}
