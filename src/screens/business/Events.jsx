import { useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import { Empty, PageHeader, Skeleton, useToast } from '../../components/ui.jsx';
import SectionTabs from '../../components/SectionTabs.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { saveRestaurantSettings } from '../../lib/data.js';
import { money, todayISO } from '../../lib/format.js';
import { upcomingEvents } from '../../lib/events.js';

const blank = () => ({ date: todayISO(), title: '', text: '', price: '' });

// Events and news (live music, a tasting, the San Antolín menu…). They show on the restaurant's
// page and in "Hoy en Palencia" the week they happen. Stored in restaurant_settings.profile.eventos.
export default function Events() {
  const { business } = useAuth();
  const { settings, reloadSettings, modules } = useOutletContext();
  const toast = useToast();
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);
  const all = settings?.profile?.eventos || [];
  const upcoming = upcomingEvents(all);
  if (!settings) return <Skeleton rows={3} />;

  const save = async (eventos) => {
    setBusy(true);
    try {
      await saveRestaurantSettings(business.name, { profile: { ...(settings.profile || {}), eventos } });
      await reloadSettings();
      return true;
    } catch (e) {
      toast(e.message, 'error');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const add = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.date) return;
    const event = { id: Date.now().toString(36), date: form.date, title: form.title.trim().slice(0, 80), text: form.text.trim().slice(0, 400), price: Number(form.price) > 0 ? Number(form.price) : null };
    // Old events are dropped as new ones come in.
    if (await save([...upcomingEvents(all), event].sort((a, b) => a.date.localeCompare(b.date)).slice(-20))) {
      setForm(blank());
      toast('Publicado. Ya sale en tu página y en "Hoy en Palencia"');
    }
  };

  return (
    <div className="page">
      <PageHeader eyebrow={business.name} title="Eventos y novedades" />
      <SectionTabs />
      <p className="muted" style={{ margin: '0 4px' }}>Música en directo, una cata, el menú de fiestas… Sale en tu página y en "Hoy en Palencia" la semana que toca, con el botón de reservar.</p>

      {modules.menuDia && (
        <Link to="/panel/carta" className="widget link row" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <span className="mono" style={{ background: 'var(--accent)', color: 'var(--ink)' }}><Icon name="book" /></span>
          <span className="grow stack" style={{ gap: 0 }}>
            <strong>Menú del día</strong>
            <span className="small muted">{settings.daily_menu?.active !== false && settings.daily_menu?.first_courses?.length ? 'Publicado hoy. Cámbialo desde la carta.' : 'Publícalo desde la carta y sal arriba del todo en "Hoy en Palencia".'}</span>
          </span>
          <Icon name="chevron" size={18} />
        </Link>
      )}

      <form className="widget stack" style={{ gap: 10 }} onSubmit={add}>
        <h2 className="title-md">Nuevo evento</h2>
        <div className="field">
          <label htmlFor="ev-title">¿Qué es?</label>
          <input id="ev-title" className="input" maxLength={80} required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ej.: Jazz en directo" />
        </div>
        <div className="row" style={{ gap: 8 }}>
          <div className="field grow">
            <label htmlFor="ev-date">Día</label>
            <input id="ev-date" className="input" type="date" min={todayISO()} required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
          <div className="field" style={{ width: 120 }}>
            <label htmlFor="ev-price">Precio (opcional)</label>
            <input id="ev-price" className="input" type="number" min="0" step="0.5" inputMode="decimal" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="€" />
          </div>
        </div>
        <div className="field">
          <label htmlFor="ev-text">Cuéntalo en una frase (opcional)</label>
          <textarea id="ev-text" className="input" rows={2} maxLength={400} value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} placeholder="Ej.: Trío de jazz a partir de las 21:30. Menú especial." />
        </div>
        <button className="btn primary block" disabled={busy || !form.title.trim()}><Icon name="plus" size={18} /> Publicar</button>
      </form>

      <section className="widget stack" style={{ gap: 4 }}>
        <h2 className="title-md">Próximos</h2>
        {upcoming.length === 0 ? <Empty icon="calendar" title="Nada publicado">Un evento a la semana da a tus clientes un motivo para volver.</Empty> : upcoming.map((ev) => (
          <div key={ev.id} className="list-row">
            <span className="stack" style={{ gap: 0, minWidth: 52, alignItems: 'center' }}>
              <strong style={{ fontSize: 20 }}>{new Date(`${ev.date}T12:00:00`).getDate()}</strong>
              <span className="small muted">{new Date(`${ev.date}T12:00:00`).toLocaleDateString('es-ES', { month: 'short' })}</span>
            </span>
            <span className="grow stack" style={{ gap: 0, minWidth: 0 }}>
              <span className="t">{ev.title}{ev.price ? ` · ${money(ev.price)}` : ''}</span>
              {ev.text && <span className="s">{ev.text}</span>}
            </span>
            <button className="icon-btn" aria-label={`Quitar ${ev.title}`} disabled={busy} onClick={() => save(all.filter((x) => x.id !== ev.id))}><Icon name="trash" size={18} /></button>
          </div>
        ))}
      </section>
    </div>
  );
}
