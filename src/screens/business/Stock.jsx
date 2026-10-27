import { useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import { Empty, PageHeader, Skeleton, useToast } from '../../components/ui.jsx';
import SectionTabs from '../../components/SectionTabs.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import useAsync from '../../hooks/useAsync.js';
import { listProducts, saveRestaurantSettings, updateProduct } from '../../lib/data.js';
import { longDate, todayISO } from '../../lib/format.js';
import { availability, hasVariants } from '../../lib/shop.js';

// Bakeries and food shops: what is on the counter today, with one tap per sale or new tray.
export default function Stock() {
  const { business } = useAuth();
  const toast = useToast();
  const { settings, reloadSettings } = useOutletContext();
  const { data, loading, setData } = useAsync(() => listProducts(business.name), [business.name]);
  const [busy, setBusy] = useState(false);
  const [batches, setBatches] = useState(null);
  const profile = settings?.profile || {};
  const hornadas = batches ?? profile.hornadas ?? [];

  if ((loading && !data) || !settings) return <Skeleton />;
  const products = (data || []).filter((p) => !p.hidden && !hasVariants(p));
  const started = profile.stock_dia === todayISO();

  const patch = async (p, change) => {
    setData((data || []).map((x) => (x.id === p.id ? { ...x, ...change } : x)));
    try {
      await updateProduct(p.id, change);
    } catch (e) {
      toast(e.message, 'error');
    }
  };
  const bump = (p, n) => {
    const left = Math.max(0, (Number(p.stock) || 0) + n);
    patch(p, { stock: left, sold_out: left === 0 ? p.sold_out : false });
  };

  const startDay = async () => {
    setBusy(true);
    try {
      const daily = products.filter((p) => p.daily_qty !== null && p.daily_qty !== undefined);
      await Promise.all(daily.map((p) => updateProduct(p.id, { stock: p.daily_qty, sold_out: false })));
      await saveRestaurantSettings(business.name, { profile: { ...profile, stock_dia: todayISO() } });
      setData((data || []).map((p) => (daily.some((d) => d.id === p.id) ? { ...p, stock: p.daily_qty, sold_out: false } : p)));
      reloadSettings?.();
      toast(daily.length ? `Mostrador listo: ${daily.length} productos con su cantidad del día.` : 'Pon en cada producto cuántas sacas al día y se rellenará solo.');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const saveBatches = async () => {
    const clean = hornadas.filter((h) => /^\d{2}:\d{2}$/.test(h.time)).map((h) => ({ time: h.time, label: String(h.label || '').trim().slice(0, 60) }))
      .sort((a, b) => a.time.localeCompare(b.time));
    try {
      await saveRestaurantSettings(business.name, { profile: { ...profile, hornadas: clean } });
      setBatches(clean);
      reloadSettings?.();
      toast('Hornadas guardadas. Tus clientes las ven en tu página.');
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const counted = products.filter((p) => p.stock !== null && p.stock !== undefined);
  const out = products.filter((p) => availability(p).soldOut).length;

  return (
    <div className="page">
      <PageHeader eyebrow={longDate()} title="Mostrador de hoy" />
      <SectionTabs />

      <div className="bento">
        <div className={`widget ${started ? '' : 'dark'} span-2 stack`} style={{ gap: 8 }}>
          <span className="eyebrow">{started ? 'Día empezado' : 'Antes de abrir'}</span>
          <span className="title-lg">{started ? `${counted.length} productos a la venta · ${out} agotados` : 'Rellena el mostrador con un toque'}</span>
          <span className="small" style={{ opacity: 0.75 }}>Pone a cada producto la cantidad que sacas cada día y quita los "agotado" de ayer.</span>
          <button className={`btn ${started ? 'soft' : 'accent'}`} style={{ alignSelf: 'flex-start' }} disabled={busy} onClick={startDay}>{busy ? 'Un momento…' : started ? 'Volver a empezar el día' : 'Empezar el día'}</button>
        </div>
      </div>

      {products.length === 0 ? (
        <div className="widget"><Empty icon="basket" title="Aún no hay productos">Añade tu pan, bollería o género en <Link to="/panel/carta">Productos</Link> y aquí podrás llevar lo que queda.</Empty></div>
      ) : (
        <section className="widget" style={{ paddingBottom: 4 }}>
          <h2 className="title-lg" style={{ marginBottom: 4 }}>Lo que queda</h2>
          {products.map((p) => {
            const a = availability(p);
            const counting = p.stock !== null && p.stock !== undefined;
            return (
              <div key={p.id} className="list-row" style={{ gap: 10 }}>
                {p.image_url ? <img src={p.image_url} alt="" width={44} height={44} style={{ borderRadius: 10, objectFit: 'cover', flex: 'none' }} /> : <span className="mono" style={{ background: 'var(--bg)' }}><Icon name="basket" size={18} /></span>}
                <span className="grow stack" style={{ gap: 1, minWidth: 0 }}>
                  <span className="t">{p.name}</span>
                  <span className="s" style={{ color: a.soldOut ? 'var(--danger)' : a.low ? 'var(--warn)' : undefined }}>
                    {a.soldOut ? 'Agotado' : counting ? `Quedan ${a.left}` : 'Sin contar'}{p.daily_qty ? ` · salen ${p.daily_qty}/día` : ''}
                  </span>
                </span>
                {counting ? (
                  <span className="qty sm">
                    <button aria-label={`Una menos de ${p.name}`} onClick={() => bump(p, -1)}>−</button>
                    <span className="stock-num">{p.stock}</span>
                    <button aria-label={`Una más de ${p.name}`} onClick={() => bump(p, 1)}>+</button>
                  </span>
                ) : (
                  <button className="btn sm soft" onClick={() => patch(p, { stock: p.daily_qty || 10, sold_out: false })}>Contar</button>
                )}
                <button className={`btn sm ${p.sold_out ? 'accent' : 'ghost'}`} onClick={() => patch(p, { sold_out: !p.sold_out })}>{p.sold_out ? 'Hay' : 'Agotado'}</button>
              </div>
            );
          })}
        </section>
      )}

      <section className="widget stack" style={{ gap: 10 }}>
        <div className="row between">
          <h2 className="title-lg">Hornadas</h2>
          <button className="btn sm ghost" onClick={() => setBatches([...hornadas, { time: '', label: '' }])}><Icon name="plus" size={14} /> Añadir</button>
        </div>
        <p className="small muted" style={{ margin: 0 }}>A qué horas sale pan recién hecho. Se ve en tu página, para que la gente sepa cuándo pasar.</p>
        {hornadas.map((h, i) => (
          <div key={i} className="row" style={{ gap: 8 }}>
            <input className="input" type="time" aria-label="Hora" style={{ width: 120 }} value={h.time} onChange={(e) => setBatches(hornadas.map((x, j) => (j === i ? { ...x, time: e.target.value } : x)))} />
            <input className="input grow" aria-label="Qué sale" maxLength={60} value={h.label} placeholder="Pan del día, empanadas…" onChange={(e) => setBatches(hornadas.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
            <button className="btn sm ghost" aria-label="Quitar" onClick={() => setBatches(hornadas.filter((_, j) => j !== i))}><Icon name="trash" size={16} /></button>
          </div>
        ))}
        {batches && <button className="btn primary" style={{ alignSelf: 'flex-start' }} onClick={saveBatches}>Guardar hornadas</button>}
      </section>
    </div>
  );
}
