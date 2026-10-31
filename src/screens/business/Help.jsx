import { Link } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import { PageHeader } from '../../components/ui.jsx';
import ContactTeam from '../../components/ContactTeam.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { kindOf } from '../../lib/categories.js';
import { LEGAL } from '../../lib/legal.js';

// First steps in three minutes, answers to the usual doubts, and a way to reach a person.
export default function Help() {
  const { business } = useAuth();
  const restaurant = kindOf(business) === 'restaurant';
  const steps = [
    ['Completa tu página', 'Foto de portada, logo, dirección y horario. Con eso ya te pueden encontrar.', '/panel/ajustes'],
    [restaurant ? 'Sube la carta' : 'Añade lo que ofreces', restaurant ? 'Con precio, foto y alérgenos. Toca un plato para cambiarlo; "Agotado" lo tacha al momento.' : 'Servicios, productos o tarifas, con su precio.', '/panel/carta'],
    ...(restaurant ? [['Dibuja tu sala', 'Mesas, zonas y terraza. Así NetWish sabe qué mesas quedan libres y confirma solo.', '/panel/mesas']] : []),
    ['Comparte tu enlace', 'Pégalo en Google Maps, Instagram y WhatsApp, e imprime el cartel con el QR.', '/panel/compartir'],
    ['Activa los avisos en tu móvil', 'En Ajustes → Este dispositivo → Avisos. Te llega cada reserva aunque el panel esté cerrado.', '/panel/ajustes'],
  ];
  const faq = [
    ['¿Cuánto cuesta?', 'El primer mes es gratis. Después, una cuota fija al mes sin comisión por reserva. Sin permanencia.'],
    ['¿Y si un cliente no viene?', 'Márcalo como "No vino". Si falla varias veces, NetWish deja de confirmarle automáticamente y te pide permiso.'],
    ['¿Los clientes reciben recordatorio?', 'Sí, por correo el día antes, con un botón para confirmar o cancelar. Si cancela, la mesa se libera y avisamos a la lista de espera.'],
    ['¿Puedo apuntar reservas que me hacen por teléfono?', 'Sí, con "+ Reserva" en Hoy o en Reservas. Quedan en la misma agenda.'],
    ['¿Cómo saco mis datos?', 'En Clientes y en Tus números tienes el botón "Excel".'],
    ['¿Quién ve los datos de mis clientes?', 'Solo tú. NetWish los guarda por encargo tuyo y no los cede a nadie.'],
  ];
  const wa = LEGAL.whatsapp ? `https://wa.me/${LEGAL.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola, soy de ${business.name} (NetWish).`)}` : null;
  return (
    <div className="page" style={{ maxWidth: 760 }}>
      <PageHeader eyebrow={business.name} title="Ayuda" back />
      <section className="widget stack" style={{ gap: 12 }}>
        <span className="eyebrow">Primeros pasos</span>
        {steps.map(([t, d, to], i) => (
          <Link key={t} to={to} className="row" style={{ gap: 12, alignItems: 'flex-start', textDecoration: 'none', color: 'inherit' }}>
            <span className="mono" style={{ width: 30, height: 30, background: 'var(--accent)', color: 'var(--ink)', fontWeight: 800, flex: 'none' }}>{i + 1}</span>
            <span className="stack grow" style={{ gap: 2 }}><strong>{t}</strong><span className="small muted">{d}</span></span>
            <Icon name="chevron" size={18} />
          </Link>
        ))}
      </section>
      <section className="widget stack" style={{ gap: 4 }}>
        <span className="eyebrow">Preguntas frecuentes</span>
        {faq.map(([q, a]) => (
          <details key={q} style={{ padding: '8px 0', borderTop: '1px solid var(--line)' }}>
            <summary style={{ fontWeight: 700, cursor: 'pointer' }}>{q}</summary>
            <p className="small muted" style={{ margin: '6px 0 0' }}>{a}</p>
          </details>
        ))}
      </section>
      {wa && <a className="btn primary block" href={wa} target="_blank" rel="noreferrer"><Icon name="chat" size={18} /> Hablar con NetWish por WhatsApp</a>}
      <ContactTeam />
      <a className="btn ghost block" href={`mailto:${LEGAL.email}`}><Icon name="mail" size={18} /> {LEGAL.email}</a>
    </div>
  );
}
