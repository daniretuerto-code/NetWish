import { Link, Navigate, useParams } from 'react-router-dom';
import { PageHeader } from '../../components/ui.jsx';
import { LEGAL } from '../../lib/legal.js';

const L = LEGAL;
const who = `${L.titular}${L.nif ? ` (NIF ${L.nif})` : ''}, con domicilio en ${L.domicilio} y correo ${L.email}`;

const DOCS = {
  aviso: {
    title: 'Aviso legal',
    body: [
      ['Titular', `Este sitio web (${L.web}) es de ${who}.`],
      ['Qué es NetWish', 'NetWish es una plataforma que permite a comercios de Palencia mostrar su negocio y recibir reservas y pedidos. Cada negocio es responsable de la información que publica (precios, horarios, carta, servicios) y de prestar el servicio reservado.'],
      ['Uso', 'Te comprometes a usar la web de buena fe, sin hacer reservas falsas ni dar datos de otra persona. Podemos bloquear cuentas que lo hagan.'],
      ['Propiedad', 'El diseño, la marca y el código de NetWish son nuestros. Las fotos y textos de cada negocio son de ese negocio.'],
      ['Responsabilidad', 'Trabajamos para que la web funcione siempre, pero no podemos garantizar que no haya cortes. No respondemos de lo que pase en el local del negocio.'],
      ['Ley aplicable', 'Se aplica la ley española. Para cualquier conflicto, los juzgados de Palencia, salvo que la ley de consumidores diga otra cosa.'],
    ],
  },
  privacidad: {
    title: 'Política de privacidad',
    body: [
      ['Responsable', `El responsable de tus datos de cuenta es ${who}. Cuando reservas o pides en un negocio, ese negocio es el responsable de los datos de tu reserva y NetWish los trata por encargo suyo.`],
      ['Qué datos', 'Nombre, correo, teléfono, tus reservas y pedidos, las notas que escribas (por ejemplo alergias) y tu valoración después de la visita.'],
      ['Para qué', 'Para gestionar tu reserva o pedido, mandarte la confirmación y el recordatorio, y pedirte tu opinión. Solo si lo aceptas, el negocio puede mandarte ofertas; puedes darte de baja con un clic en cualquier correo.'],
      ['Base legal', 'La ejecución de la reserva que pides (art. 6.1.b RGPD) y tu consentimiento para las ofertas (art. 6.1.a).'],
      ['Con quién', 'Con el negocio donde reservas. Usamos proveedores que guardan los datos en la Unión Europea o con garantías: Supabase (base de datos, Irlanda), Vercel (web) y Resend (correos). No vendemos datos a nadie.'],
      ['Cuánto tiempo', 'Mientras tengas cuenta o el negocio lo necesite para su historial, y como máximo 3 años desde tu última reserva.'],
      ['Tus derechos', `Puedes ver, corregir, borrar o llevarte tus datos, y oponerte a su uso, escribiendo a ${L.email}. Desde Cuenta puedes borrar tu cuenta tú mismo. Si no te atendemos bien, puedes reclamar ante la Agencia Española de Protección de Datos (aepd.es).`],
    ],
  },
  cookies: {
    title: 'Cookies',
    body: [
      ['Qué usamos', 'Solo cookies y almacenamiento técnicos, necesarios para que la web funcione: mantener tu sesión iniciada, recordar tus datos para la próxima reserva y tus preferencias del panel.'],
      ['Sin publicidad', 'No usamos cookies de publicidad ni de seguimiento de terceros. Por eso no hace falta aceptarlas.'],
      ['Cómo borrarlas', 'Puedes borrarlas desde los ajustes de tu navegador. Si lo haces, tendrás que volver a iniciar sesión.'],
    ],
  },
  negocios: {
    title: 'Condiciones para negocios',
    body: [
      ['El servicio', 'NetWish da a tu negocio una página propia, reservas o pedidos online, avisos a tus clientes y un panel para gestionarlo.'],
      ['Precio', 'El primer mes es gratis. Después se paga la cuota mensual de tu plan, sin comisión por reserva. Puedes darte de baja cuando quieras, sin permanencia.'],
      ['Tu información', 'Eres responsable de que tu carta, precios, alérgenos, horarios y fotos sean ciertos y de que puedas usarlos.'],
      ['Datos de tus clientes', 'Tú eres el responsable de los datos de tus clientes y NetWish es tu encargado del tratamiento (art. 28 RGPD): solo los usamos para darte el servicio, los guardamos con seguridad, no los cedemos y te los devolvemos o borramos si te vas. Al darte de alta aceptas este encargo.'],
      ['Ofertas a clientes', 'Solo puedes mandar campañas a clientes que lo hayan aceptado. Cada correo lleva un enlace de baja.'],
      ['Baja', `Escríbenos a ${L.email} y desactivamos tu página. Te mandamos tus datos si los quieres.`],
    ],
  },
};

export const LEGAL_LINKS = [['aviso', 'Aviso legal'], ['privacidad', 'Privacidad'], ['cookies', 'Cookies'], ['negocios', 'Condiciones para negocios']];

export default function Legal() {
  const { doc } = useParams();
  const page = DOCS[doc];
  if (!page) return <Navigate to="/legal/aviso" replace />;
  return (
    <div className="page stack">
      <PageHeader eyebrow="Legal" title={page.title} back />
      <div className="widget stack" style={{ gap: 14 }}>
        {page.body.map(([h, t]) => (
          <section key={h} className="stack" style={{ gap: 4 }}>
            <strong>{h}</strong>
            <p className="small" style={{ margin: 0, lineHeight: 1.55 }}>{t}</p>
          </section>
        ))}
        <span className="small muted">Actualizado el {L.updated}.</span>
      </div>
      <div className="row wrap" style={{ gap: 8 }}>
        {LEGAL_LINKS.filter(([k]) => k !== doc).map(([k, label]) => <Link key={k} className="chip" to={`/legal/${k}`}>{label}</Link>)}
      </div>
    </div>
  );
}

// Small line of legal links for the bottom of the account page and forms.
export function LegalLinks() {
  return (
    <p className="small muted" style={{ margin: 0, textAlign: 'center' }}>
      {LEGAL_LINKS.map(([k, label], i) => (
        <span key={k}>{i > 0 && ' · '}<Link to={`/legal/${k}`} style={{ color: 'inherit' }}>{label}</Link></span>
      ))}
    </p>
  );
}

// One line under every booking form: what happens with the data, with the link.
export function PrivacyNote({ name }) {
  return (
    <p className="small muted" style={{ margin: '0 4px', fontSize: 12 }}>
      Al confirmar aceptas la <Link to="/legal/privacidad" target="_blank" style={{ color: 'inherit' }}>política de privacidad</Link>.
      {name ? ` ${name} puede mandarte alguna oferta; te das de baja con un clic.` : ''}
    </p>
  );
}
