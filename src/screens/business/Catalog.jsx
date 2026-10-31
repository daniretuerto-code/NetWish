import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import { Empty, PageHeader, Sheet, Skeleton, Spinner, useToast } from '../../components/ui.jsx';
import SectionTabs from '../../components/SectionTabs.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import useAsync from '../../hooks/useAsync.js';
import { createProduct, deleteProduct, getRestaurantSettings, listProducts, safeSlug, saveRestaurantSettings, updateProduct, uploadPublicFile } from '../../lib/data.js';
import { ALLERGENS, allergenInfo } from '../../lib/allergens.js';
import { kindOf } from '../../lib/categories.js';
import { nounsOf } from '../../lib/businessTypes.js';
import { duration, money } from '../../lib/format.js';

const DURATIONS = [15, 20, 30, 45, 60, 75, 90, 105, 120, 150, 180, 210, 240];
const EXTRA_LONG = [0, 15, 30, 45, 60];

const MAX_AUDIO_MB = 25;

const MAX_PHOTO_MB = 8;

const formOf = (p, sections) => (p ? {
  name: p.name || '', description: p.description || '', price: String(p.price ?? '').replace('.', ','), section: p.section || '',
  finished: !!p.is_finished_beat, duration: String(p.duration_min || 30), extra: String(p.extra_long_min || 0), from: !!p.price_from,
  allergens: p.allergens || [], image_url: p.image_url || '',
} : { name: '', description: '', price: '', section: sections[0] || '', finished: false, duration: '30', extra: '0', from: false, allergens: [], image_url: '' });

function ProductSheet({ open, onClose, business, music, beauty, food, sections, onSaved, editing }) {
  const toast = useToast();
  const empty = formOf(null, sections);
  const [form, setForm] = useState(empty);
  const [photo, setPhoto] = useState(null);
  const [lastEditing, setLastEditing] = useState(null);
  if (open && editing !== lastEditing) {
    setLastEditing(editing);
    setForm(formOf(editing, sections));
    setPhoto(null);
  }
  const [preview, setPreview] = useState(null);
  const [master, setMaster] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const upload = (file, kind) => {
    if (file.size > MAX_AUDIO_MB * 1024 * 1024) throw new Error(`El audio no puede pasar de ${MAX_AUDIO_MB} MB`);
    const ext = (file.name.split('.').pop() || 'mp3').toLowerCase().replace(/[^a-z0-9]/g, '');
    return uploadPublicFile('beats', `${safeSlug(business.name)}/${kind}_${Date.now()}_${safeSlug(form.name)}.${ext}`, file);
  };

  const submit = async (e) => {
    e.preventDefault();
    const price = Number(String(form.price).replace(',', '.'));
    if (!form.name.trim() || !(price >= 0)) {
      toast('Revisa el nombre y el precio', 'error');
      return;
    }
    setBusy(true);
    try {
      const product = {
        business_id: business.name,
        name: form.name.trim().slice(0, 120),
        description: form.description.trim().slice(0, 500) || null,
        price,
        section: form.section.trim().slice(0, 60) || null,
      };
      if (beauty) {
        product.duration_min = Number(form.duration) || 30;
        product.extra_long_min = Number(form.extra) || 0;
        product.price_from = form.from;
      }
      if (music) {
        product.is_finished_beat = form.finished;
        if (preview) product.audio_url = await upload(preview, 'preview');
        if (master) product.full_audio_url = await upload(master, 'master');
      }
      if (!music && !beauty) {
        if (photo) {
          if (photo.size > MAX_PHOTO_MB * 1024 * 1024) throw new Error(`La foto no puede pasar de ${MAX_PHOTO_MB} MB`);
          const ext = (photo.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
          product.image_url = await uploadPublicFile('public-images', `${safeSlug(business.name)}/plato_${Date.now()}_${safeSlug(form.name)}.${ext}`, photo);
        } else if (editing) product.image_url = form.image_url || null;
      }
      if (food) product.allergens = form.allergens;
      if (editing) {
        delete product.business_id;
        await updateProduct(editing.id, product);
      } else await createProduct(product);
      toast(editing ? 'Cambios guardados' : beauty ? 'Servicio añadido' : 'Producto añadido');
      setForm(empty);
      setPhoto(null);
      setPreview(null);
      setMaster(null);
      onSaved();
      onClose();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={editing ? `Editar ${editing.name}` : music ? 'Nuevo beat' : beauty ? 'Nuevo servicio' : food ? 'Nuevo plato' : 'Nuevo producto'}>
      <form className="stack" onSubmit={submit}>
        <div className="field"><label htmlFor="p-name">Nombre</label><input id="p-name" className="input" required value={form.name} onChange={set('name')} /></div>
        <div className="bento">
          <div className="field"><label htmlFor="p-price">Precio (€)</label><input id="p-price" className="input" inputMode="decimal" required value={form.price} onChange={set('price')} placeholder="0,00" /></div>
          <div className="field">
            <label htmlFor="p-section">Sección</label>
            <input id="p-section" className="input" list="sections" value={form.section} onChange={set('section')} placeholder={music ? 'Trap, Drill…' : beauty ? 'Mujer, Hombre, Color…' : 'Entrantes, Bebidas…'} />
            <datalist id="sections">{sections.map((s) => <option key={s} value={s} />)}</datalist>
          </div>
        </div>
        {beauty && (
          <>
            <div className="bento">
              <div className="field">
                <label htmlFor="p-dur">Duración</label>
                <select id="p-dur" className="input" value={form.duration} onChange={set('duration')}>
                  {DURATIONS.map((m) => <option key={m} value={m}>{duration(m)}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="p-extra">Más tiempo si el pelo es largo</label>
                <select id="p-extra" className="input" value={form.extra} onChange={set('extra')}>
                  {EXTRA_LONG.map((m) => <option key={m} value={m}>{m ? `+${duration(m)}` : 'No cambia'}</option>)}
                </select>
              </div>
            </div>
            <label className="row" style={{ gap: 10, fontWeight: 600 }}>
              <input type="checkbox" checked={form.from} onChange={set('from')} style={{ width: 20, height: 20 }} />
              El precio es "desde" (puede variar)
            </label>
          </>
        )}
        <div className="field"><label htmlFor="p-desc">Descripción</label><textarea id="p-desc" className="input" value={form.description} onChange={set('description')} /></div>
        {!music && !beauty && (
          <div className="field">
            <label htmlFor="p-photo">Foto (opcional)</label>
            <div className="row" style={{ gap: 10 }}>
              {(photo || form.image_url) && <img src={photo ? URL.createObjectURL(photo) : form.image_url} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 12 }} />}
              <input id="p-photo" className="input grow" style={{ paddingTop: 12 }} type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] || null)} />
              {!photo && form.image_url && <button type="button" className="btn ghost sm" onClick={() => setForm((f) => ({ ...f, image_url: '' }))}>Quitar</button>}
            </div>
          </div>
        )}
        {food && (
          <div className="field">
            <label>Alérgenos (obligatorio por ley si los lleva)</label>
            <div className="row wrap" style={{ gap: 6 }}>
              {ALLERGENS.map(([k, label, icon]) => {
                const on = form.allergens.includes(k);
                return (
                  <button type="button" key={k} className={`chip ${on ? 'on' : ''}`} style={{ height: 34, padding: '0 12px', fontSize: 13, background: on ? undefined : 'var(--bg)' }} aria-pressed={on}
                    onClick={() => setForm((f) => ({ ...f, allergens: on ? f.allergens.filter((x) => x !== k) : [...f.allergens, k] }))}>
                    <span aria-hidden="true">{icon}</span> {label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {music && (
          <>
            <div className="field">
              <label htmlFor="p-preview">Preview (se escucha en la tienda)</label>
              <input id="p-preview" className="input" style={{ paddingTop: 12 }} type="file" accept="audio/*" onChange={(e) => setPreview(e.target.files?.[0] || null)} />
            </div>
            <div className="field">
              <label htmlFor="p-master">Archivo completo (se entrega al comprar)</label>
              <input id="p-master" className="input" style={{ paddingTop: 12 }} type="file" accept="audio/*" onChange={(e) => setMaster(e.target.files?.[0] || null)} />
            </div>
            <label className="row" style={{ gap: 10, fontWeight: 600 }}>
              <input type="checkbox" checked={form.finished} onChange={set('finished')} style={{ width: 20, height: 20 }} />
              Canción terminada (no beat)
            </label>
          </>
        )}
        <button className="btn primary block" disabled={busy}>{busy ? 'Guardando…' : editing ? 'Guardar cambios' : 'Añadir'}</button>
      </form>
    </Sheet>
  );
}

function DailyMenuEditor({ business }) {
  const toast = useToast();
  const { data, loading, setData } = useAsync(() => getRestaurantSettings(business.name), [business.name]);
  const [busy, setBusy] = useState(false);
  if (loading && !data) return <Skeleton />;
  const menu = data.daily_menu || { active: false, price: 0, first_courses: [], second_courses: [], includes: '' };
  const update = (patch) => setData({ ...data, daily_menu: { ...menu, ...patch } });
  const lines = (k) => (e) => update({ [k]: e.target.value.split('\n') });

  const save = async () => {
    setBusy(true);
    try {
      const clean = {
        ...menu,
        price: Number(String(menu.price).replace(',', '.')) || 0,
        first_courses: (menu.first_courses || []).map((s) => s.trim()).filter(Boolean),
        second_courses: (menu.second_courses || []).map((s) => s.trim()).filter(Boolean),
      };
      await saveRestaurantSettings(business.name, { daily_menu: clean });
      setData({ ...data, daily_menu: clean });
      toast(clean.active ? 'Menú del día publicado' : 'Menú guardado (oculto)');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="widget stack">
      <label className="row between" style={{ fontWeight: 700, minHeight: 44 }}>
        Publicar menú del día
        <input type="checkbox" checked={!!menu.active} onChange={(e) => update({ active: e.target.checked })} style={{ width: 22, height: 22 }} />
      </label>
      <div className="field"><label htmlFor="m-price">Precio (€)</label><input id="m-price" className="input" inputMode="decimal" value={menu.price} onChange={(e) => update({ price: e.target.value })} /></div>
      <div className="bento">
        <div className="field"><label htmlFor="m-first">Primeros (uno por línea)</label><textarea id="m-first" className="input" rows={5} value={(menu.first_courses || []).join('\n')} onChange={lines('first_courses')} /></div>
        <div className="field"><label htmlFor="m-second">Segundos (uno por línea)</label><textarea id="m-second" className="input" rows={5} value={(menu.second_courses || []).join('\n')} onChange={lines('second_courses')} /></div>
      </div>
      <div className="field"><label htmlFor="m-inc">Incluye</label><input id="m-inc" className="input" placeholder="Pan, bebida y postre o café" value={menu.includes || ''} onChange={(e) => update({ includes: e.target.value })} /></div>
      <button className="btn primary block" disabled={busy} onClick={save}>{busy ? 'Guardando…' : 'Guardar menú'}</button>
    </div>
  );
}

export default function Catalog() {
  const { business } = useAuth();
  const toast = useToast();
  const kind = kindOf(business);
  const music = kind === 'music';
  const beauty = kind === 'beauty';
  const { modules } = useOutletContext() || {};
  const [tab, setTab] = useState('carta');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const food = kind === 'restaurant';
  const { data, loading, reload, setData } = useAsync(() => listProducts(business.name), [business.name]);

  if (loading && !data) return <Skeleton />;
  const products = data || [];
  const sections = [...new Set(products.map((p) => p.section).filter(Boolean))];
  const groups = new Map();
  for (const p of products) {
    const key = p.section || 'Sin sección';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }

  const remove = async (p) => {
    if (confirmId !== p.id) {
      setConfirmId(p.id);
      return;
    }
    try {
      await deleteProduct(p.id);
      setData(products.filter((x) => x.id !== p.id));
      toast('Producto eliminado');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setConfirmId(null);
    }
  };

  // "Agotado hoy": one tap, and the customer sees it struck through.
  const toggleSoldOut = async (p) => {
    const next = !p.sold_out;
    setData(products.map((x) => (x.id === p.id ? { ...x, sold_out: next } : x)));
    try {
      await updateProduct(p.id, { sold_out: next });
      toast(next ? `${p.name}: agotado` : `${p.name}: disponible otra vez`);
    } catch (e) {
      setData(products);
      toast(e.message, 'error');
    }
  };

  return (
    <div className="page">
      <PageHeader
        eyebrow={business.name}
        title={kind === 'restaurant' ? 'Carta' : kind === 'classes' ? 'Tarifas' : kind === 'taxi' ? 'Precios' : nounsOf(business).list}
        right={tab === 'carta' && <button className="btn primary sm" onClick={() => setAdding(true)}><Icon name="plus" size={16} /> Añadir</button>}
      />
      <SectionTabs />

      {kind === 'restaurant' && modules?.menuDia !== false && (
        <div className="segmented" role="tablist">
          <button role="tab" aria-selected={tab === 'carta'} onClick={() => setTab('carta')}>Carta</button>
          <button role="tab" aria-selected={tab === 'menu'} onClick={() => setTab('menu')}>Menú del día</button>
        </div>
      )}

      {tab === 'menu' ? <DailyMenuEditor business={business} /> : products.length === 0 ? (
        <div className="widget">
          <Empty icon={beauty ? 'scissors' : 'book'} title={beauty ? 'Añade tus servicios' : 'Tu catálogo está vacío'}>
            {beauty && <span>Corte, tinte, mechas… con su duración, para que la agenda sepa cuánto ocupa cada cita.</span>}
            <button className="btn primary" style={{ marginTop: 8 }} onClick={() => setAdding(true)}>Añadir el primero</button>
          </Empty>
        </div>
      ) : (
        <div className="cards-grid">
          {[...groups.entries()].map(([section, items]) => (
            <section key={section} className="widget" style={{ paddingBottom: 4 }}>
              <div className="row between"><h2 className="title-md">{section}</h2><span className="count-badge">{items.length}</span></div>
              {items.map((p) => (
                <div key={p.id} className="list-row" style={p.sold_out ? { opacity: 0.6 } : undefined}>
                  {p.image_url && <img src={p.image_url} alt="" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 10, flex: 'none' }} />}
                  <button type="button" className="grow stack" style={{ gap: 1, minWidth: 0, background: 'none', border: 0, padding: 0, textAlign: 'left', color: 'inherit', font: 'inherit', cursor: 'pointer' }} onClick={() => setEditing(p)} aria-label={`Editar ${p.name}`}>
                    <span className="t">{p.name}{p.sold_out ? ' · agotado' : ''}</span>
                    <span className="s">
                      {beauty && `${duration(p.duration_min || 30)}${p.extra_long_min ? ` (+${p.extra_long_min} pelo largo)` : ''} · `}
                      <span className="price">{beauty && p.price_from ? 'desde ' : ''}{money(p.price)}</span>
                      {music && (p.full_audio_url ? ' · con archivo' : ' · sin archivo')}
                      {food && (p.allergens?.length ? ` · ${p.allergens.map((a) => allergenInfo(a).icon).join(' ')}` : ' · sin alérgenos marcados')}
                    </span>
                  </button>
                  {!music && !beauty && (
                    <button type="button" className={`btn sm ${p.sold_out ? 'primary' : 'soft'}`} onClick={() => toggleSoldOut(p)} aria-pressed={!!p.sold_out}>
                      {p.sold_out ? 'Agotado' : 'Hay'}
                    </button>
                  )}
                  {music && p.audio_url && <audio src={p.audio_url} controls preload="none" style={{ height: 32, maxWidth: 140 }} />}
                  <button className={`btn sm ${confirmId === p.id ? 'danger' : 'ghost'}`} onClick={() => remove(p)} onBlur={() => setConfirmId(null)} aria-label={`Eliminar ${p.name}`}>
                    {confirmId === p.id ? '¿Eliminar?' : <Icon name="trash" size={18} />}
                  </button>
                </div>
              ))}
            </section>
          ))}
        </div>
      )}

      <ProductSheet open={adding || !!editing} onClose={() => { setAdding(false); setEditing(null); }} business={business} music={music} beauty={beauty} food={food} sections={sections} onSaved={reload} editing={editing} />
    </div>
  );
}
