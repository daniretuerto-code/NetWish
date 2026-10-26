import { useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import { Empty, PageHeader, Skeleton, useToast } from '../../components/ui.jsx';
import SectionTabs from '../../components/SectionTabs.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import useAsync from '../../hooks/useAsync.js';
import { businessOrders, campaignsOf, customerNotes, sendCampaign, STATUS } from '../../lib/data.js';
import { customersFrom, whatsappLink } from '../../lib/agenda.js';
import { todayISO } from '../../lib/format.js';

const CAME = [STATUS.DONE, STATUS.SEATED];
const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const shiftISO = (iso, days) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); };

// The same groups the database uses to send (start_campaign).
const SEGMENTS = [
  { id: 'todos', label: 'Todos', sub: 'Quien ha venido alguna vez' },
  { id: 'echamos', label: 'Te echamos de menos', sub: 'Más de 2 meses sin venir' },
  { id: 'habituales', label: 'Habituales', sub: '3 visitas o más, o VIP' },
  { id: 'nuevos', label: 'Vinieron una vez', sub: 'Para que repitan' },
];

function inSegment(c, segment, notes, today) {
  const visits = c.bookings.filter((o) => CAME.includes(o.status));
  if (!visits.length) return false;
  if (segment === 'echamos') {
    const booked = c.bookings.some((o) => [STATUS.PENDING, STATUS.CONFIRMED].includes(o.status) && o.date >= today);
    return !booked && c.last < shiftISO(today, -60);
  }
  if (segment === 'habituales') return visits.length >= 3 || (notes[c.key]?.tags || []).some((t) => t === 'VIP' || t === 'Habitual');
  if (segment === 'nuevos') return visits.length === 1;
  return true;
}

// Ready-made ideas: the quietest day of the week comes from the restaurant's own numbers.
function ideasFor(business, quiet) {
  return [
    quiet && {
      id: 'flojo', segment: 'todos', title: `Llena tus ${WEEKDAYS[quiet]}`,
      subject: `Este ${WEEKDAYS[quiet]} te guardamos mesa`,
      body: `Hola {nombre},\n\nlos ${WEEKDAYS[quiet]} en ${business.name} son más tranquilos, perfectos para venir sin prisas. Si reservas para este ${WEEKDAYS[quiet]}, te tratamos como en casa.\n\n¡Te esperamos!`,
      offer: `Este ${WEEKDAYS[quiet]}: café o postre de regalo`,
    },
    {
      id: 'echamos', segment: 'echamos', title: 'Te echamos de menos',
      subject: `Hace tiempo que no te vemos por ${business.name}`,
      body: 'Hola {nombre},\n\nhace un tiempo que no vienes y nos acordamos de ti. Tenemos platos nuevos que creemos que te van a gustar.\n\nReserva cuando quieras, te guardamos la mejor mesa.',
      offer: '',
    },
    {
      id: 'novedad', segment: 'habituales', title: 'Novedad en la carta',
      subject: `Novedades en ${business.name}`,
      body: 'Hola {nombre},\n\nqueríamos que fueras de los primeros en saberlo: hemos estrenado [plato o menú nuevo].\n\nComo eres de la casa, te avisamos antes que a nadie.',
      offer: '',
    },
    {
      id: 'evento', segment: 'todos', title: 'Evento o fecha especial',
      subject: `[Evento] en ${business.name}`,
      body: 'Hola {nombre},\n\nel [día] celebramos [evento]: [qué habrá]. Las plazas son limitadas, así que si te apetece, reserva pronto.',
      offer: '',
    },
  ].filter(Boolean);
}

export default function Campaigns() {
  const { business } = useAuth();
  const { settings } = useOutletContext();
  const toast = useToast();
  const { data, loading, reload } = useAsync(async () => {
    const [orders, notes, sent] = await Promise.all([businessOrders(business.name), customerNotes(business.name), campaignsOf(business.name).catch(() => ({ campaigns: [], optouts: new Set() }))]);
    return { orders, notes, ...sent };
  }, [business.name]);
  const [segment, setSegment] = useState('todos');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [offer, setOffer] = useState('');
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);
  const today = todayISO();

  const customers = useMemo(() => (data ? customersFrom(data.orders) : []), [data]);
  // Quietest open day over the last 90 days.
  const quiet = useMemo(() => {
    if (!data) return null;
    const closed = settings?.closed_days || [];
    const from = shiftISO(today, -90);
    const count = [0, 0, 0, 0, 0, 0, 0];
    data.orders.filter((o) => o.date >= from && o.date < today && CAME.includes(o.status)).forEach((o) => { count[new Date(`${o.date}T12:00:00`).getDay()] += 1; });
    if (count.every((n) => !n)) return null;
    const open = [1, 2, 3, 4, 5, 6, 0].filter((d) => !closed.includes(d));
    return open.sort((a, b) => count[a] - count[b])[0] ?? null;
  }, [data, settings]);

  if (loading && !data) return <Skeleton rows={4} />;
  const notes = data.notes || {};
  const group = customers.filter((c) => inSegment(c, segment, notes, today));
  const byMail = group.filter((c) => c.email && !data.optouts.has(c.email.toLowerCase()));
  const byPhone = group.filter((c) => !c.email && c.phone);
  const birthdays = Object.values(notes).filter((n) => n.birthday).length;
  const cumple = settings?.profile?.campana_cumple === true;
  const lastSent = data.campaigns[0];
  const sentToday = lastSent && Date.now() - new Date(lastSent.created_at).getTime() < 20 * 3600 * 1000;
  const preview = (name) => body.replace(/\{nombre\}/gi, name || 'Ana');
  const ready = subject.trim().length >= 3 && body.trim().length >= 10 && byMail.length > 0;

  const pickIdea = (idea) => {
    setSegment(idea.segment);
    setSubject(idea.subject);
    setBody(idea.body);
    setOffer(idea.offer);
    setSure(false);
    document.getElementById('campana-form')?.scrollIntoView({ behavior: 'smooth' });
  };

  const send = async () => {
    if (!sure) { setSure(true); return; }
    setBusy(true);
    try {
      const out = await sendCampaign({ segment, subject: subject.trim(), body: body.trim(), offer: offer.trim() });
      toast(`Enviada a ${out.sent} ${out.sent === 1 ? 'cliente' : 'clientes'}`);
      setSubject(''); setBody(''); setOffer(''); setSure(false);
      reload();
    } catch (e) {
      toast(e.message, 'error');
      setSure(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <PageHeader eyebrow={business.name} title="Campañas" />
      <SectionTabs />
      <p className="muted" style={{ margin: '0 4px' }}>Escribe a tus clientes para llenar los días flojos. Les llega un correo con tu mensaje y un botón para reservar.</p>

      {customers.length === 0 ? (
        <div className="widget"><Empty icon="mail" title="Aún no tienes clientes">Cuando la gente reserve y venga, podrás escribirles desde aquí.</Empty></div>
      ) : (
        <>
          <section className="stack" style={{ gap: 8 }}>
            <span className="eyebrow" style={{ margin: '0 4px' }}>Ideas listas para enviar</span>
            <div className="bento">
              {ideasFor(business, quiet).map((idea) => (
                <button key={idea.id} className="widget link stack" onClick={() => pickIdea(idea)} style={{ border: 0, textAlign: 'left', gap: 6, minHeight: 96, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'space-between', background: idea.id === 'flojo' ? 'var(--accent)' : undefined }}>
                  <Icon name={idea.id === 'flojo' ? 'chart' : idea.id === 'echamos' ? 'heart' : idea.id === 'novedad' ? 'book' : 'calendar'} size={20} />
                  <strong style={{ fontSize: 16 }}>{idea.title}</strong>
                </button>
              ))}
            </div>
          </section>

          <section id="campana-form" className="widget stack" style={{ gap: 12 }}>
            <h2 className="title-md">Nueva campaña</h2>
            <div className="stack" style={{ gap: 6 }}>
              <span className="eyebrow">¿A quién?</span>
              <div className="chips" style={{ flexWrap: 'wrap' }}>
                {SEGMENTS.map((s) => {
                  const n = customers.filter((c) => inSegment(c, s.id, notes, today)).length;
                  return <button key={s.id} className={`chip ${segment === s.id ? 'on' : ''}`} onClick={() => { setSegment(s.id); setSure(false); }}>{s.label} · {n}</button>;
                })}
              </div>
              <span className="small muted">{SEGMENTS.find((s) => s.id === segment).sub}. {byMail.length} con correo{byPhone.length ? `, ${byPhone.length} solo con teléfono` : ''}.</span>
            </div>
            <div className="field">
              <label htmlFor="cp-subject">Asunto</label>
              <input id="cp-subject" className="input" maxLength={120} value={subject} onChange={(e) => { setSubject(e.target.value); setSure(false); }} placeholder="Ej.: Este martes te guardamos mesa" />
            </div>
            <div className="field">
              <label htmlFor="cp-body">Mensaje</label>
              <textarea id="cp-body" className="input" rows={6} maxLength={2000} value={body} onChange={(e) => { setBody(e.target.value); setSure(false); }} placeholder="Escribe {nombre} y pondremos el nombre de cada cliente." />
            </div>
            <div className="field">
              <label htmlFor="cp-offer">Oferta destacada (opcional)</label>
              <input id="cp-offer" className="input" maxLength={200} value={offer} onChange={(e) => setOffer(e.target.value)} placeholder="Ej.: 10 % de descuento de lunes a jueves" />
            </div>
            {body.trim() && (
              <div className="stack" style={{ gap: 6, background: 'var(--bg)', borderRadius: 18, padding: 14 }}>
                <span className="eyebrow">Así lo verá {byMail[0]?.name || 'tu cliente'}</span>
                <strong>{subject || 'Sin asunto'}</strong>
                <span className="small" style={{ whiteSpace: 'pre-line' }}>{preview(byMail[0]?.name)}</span>
                {offer.trim() && <span style={{ background: 'var(--accent)', color: '#111', borderRadius: 14, padding: '10px 12px', fontWeight: 800 }}>{offer}</span>}
                <span className="btn primary sm" style={{ alignSelf: 'flex-start', pointerEvents: 'none' }}>Reservar mesa</span>
              </div>
            )}
            <button className={`btn block ${sure ? 'accent' : 'primary'}`} disabled={!ready || busy || sentToday} onClick={send}>
              <Icon name="send" size={18} /> {busy ? 'Enviando…' : sentToday ? 'Podrás enviar otra mañana' : sure ? `Sí, enviar a ${byMail.length}` : `Enviar a ${byMail.length} ${byMail.length === 1 ? 'cliente' : 'clientes'}`}
            </button>
            <span className="small muted">Una campaña al día como mucho, para no cansar. Cada correo lleva un enlace para darse de baja{data.optouts.size ? ` (${data.optouts.size} ya lo hicieron)` : ''}.</span>
          </section>

          {byPhone.length > 0 && body.trim() && (
            <section className="widget stack" style={{ gap: 6 }}>
              <h2 className="title-md">Sin correo: por WhatsApp</h2>
              <span className="small muted">Estos clientes solo dejaron teléfono. Toca para abrir WhatsApp con el mensaje ya escrito.</span>
              {byPhone.slice(0, 50).map((c) => (
                <div key={c.key} className="list-row">
                  <span className="grow stack" style={{ gap: 0 }}><span className="t">{c.name}</span><span className="s">{c.phone}</span></span>
                  <a className="btn soft sm" href={whatsappLink(c.phone, `${preview(c.name)}${offer.trim() ? `\n\n${offer.trim()}` : ''}`)} target="_blank" rel="noreferrer"><Icon name="chat" size={15} /> WhatsApp</a>
                </div>
              ))}
            </section>
          )}
        </>
      )}

      <Link to="/panel/personalizar/fidelizar" className="widget link row" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <span className="mono" style={{ background: cumple ? 'var(--accent)' : 'var(--bg)', color: 'var(--ink)' }}><Icon name="heart" /></span>
        <span className="grow stack" style={{ gap: 0 }}>
          <strong>Felicitaciones de cumpleaños {cumple ? 'activadas' : 'apagadas'}</strong>
          <span className="small muted">{birthdays} {birthdays === 1 ? 'cliente tiene' : 'clientes tienen'} la fecha apuntada. Se la añades en su ficha, en Reservas → Clientes.</span>
        </span>
        <Icon name="chevron" size={18} />
      </Link>

      {data.campaigns.length > 0 && (
        <section className="widget stack" style={{ gap: 4 }}>
          <h2 className="title-md">Enviadas</h2>
          {data.campaigns.map((c) => (
            <div key={c.id} className="list-row">
              <span className="grow stack" style={{ gap: 0 }}>
                <span className="t">{c.subject}</span>
                <span className="s">{new Date(c.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} · {SEGMENTS.find((s) => s.id === c.segment)?.label || c.segment}</span>
              </span>
              <span className="small" style={{ fontWeight: 800 }}>{c.sent} correos</span>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
