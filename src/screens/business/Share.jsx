import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import Icon from '../../components/Icon.jsx';
import { Empty, PageHeader, useToast } from '../../components/ui.jsx';
import SectionTabs from '../../components/SectionTabs.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { businessUrl } from '../../lib/qr.js';

const bookingLink = (business) => `${window.location.origin}/r/${business.username}`;

// The short booking link, to paste on Google, Instagram and WhatsApp.
function LinkCard({ business }) {
  const toast = useToast();
  const url = bookingLink(business);
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: business.name, text: `Reserva mesa en ${business.name}`, url });
      else { await navigator.clipboard.writeText(url); toast('Enlace copiado'); }
    } catch { /* cancelled */ }
  };
  return (
    <section className="widget dark stack" style={{ gap: 8 }}>
      <span className="eyebrow" style={{ color: 'var(--accent)' }}>Tu enlace de reservas</span>
      <strong style={{ fontSize: 22, wordBreak: 'break-all' }}>{url.replace(/^https?:\/\//, '')}</strong>
      <span className="small" style={{ opacity: 0.7 }}>Quien lo abra reserva directo, sin comisiones, y la reserva entra en tu panel con su recordatorio.</span>
      <div className="row" style={{ gap: 8 }}>
        <button className="btn accent sm" style={{ flex: 1 }} onClick={() => navigator.clipboard?.writeText(url).then(() => toast('Enlace copiado'))}><Icon name="link" size={16} /> Copiar</button>
        <button className="btn soft sm" style={{ flex: 1 }} onClick={share}><Icon name="share" size={16} /> Compartir</button>
      </div>
    </section>
  );
}

// Where to put the booking button: Google, Instagram, the restaurant's website and a printed QR.
function ShareGuide({ business }) {
  const toast = useToast();
  const url = bookingLink(business);
  const [qr, setQr] = useState('');
  useEffect(() => {
    QRCode.toDataURL(url, { margin: 1, width: 720 }).then(setQr);
  }, [url]);
  const code = `<script src="${window.location.origin}/reservar.js" data-negocio="${business.username}" async></script>`;
  const copy = (text, what) => navigator.clipboard?.writeText(text).then(() => toast(`${what} copiado`));
  const step = (n, title, body) => (
    <div className="row" style={{ gap: 12, alignItems: 'flex-start' }}>
      <span className="mono" style={{ width: 30, height: 30, background: 'var(--accent)', color: 'var(--ink)', fontWeight: 800, flex: 'none' }}>{n}</span>
      <span className="stack" style={{ gap: 2 }}><strong>{title}</strong><span className="small muted">{body}</span></span>
    </div>
  );
  return (
    <div className="stack" style={{ gap: 14 }}>
      <p className="small muted" style={{ margin: '0 4px' }}>Cuantas más reservas entren por tu enlace, menos llamadas y menos mesas vacías. Y todas quedan en tu panel con sus recordatorios.</p>
      <section className="widget stack" style={{ gap: 10 }}>
        <h3 className="title-md">Google Maps</h3>
        {step(1, 'Abre tu Perfil de Empresa', 'Busca tu restaurante en Google, entra en "Editar perfil".')}
        {step(2, 'Enlaces de reservas', 'En "Reservas" o "Enlaces de pedidos y reservas", pega tu enlace.')}
        <button className="btn soft sm" onClick={() => copy(url, 'Enlace')}><Icon name="link" size={16} /> Copiar enlace</button>
      </section>
      <section className="widget stack" style={{ gap: 10 }}>
        <h3 className="title-md">Instagram</h3>
        {step(1, 'Editar perfil → Enlaces', 'Añade un enlace externo con tu enlace de reservas y ponle de título "Reservar mesa".')}
        {step(2, 'En tus historias', 'Usa el sticker "Enlace" con el mismo enlace cuando publiques un plato o un evento.')}
        <button className="btn soft sm" onClick={() => copy(url, 'Enlace')}><Icon name="link" size={16} /> Copiar enlace</button>
      </section>
      <section className="widget stack" style={{ gap: 10 }}>
        <h3 className="title-md">Tu página web</h3>
        <span className="small muted">Pega esta línea antes de &lt;/body&gt; (o en "Código personalizado" si usas Wix, WordPress o Squarespace). Sale un botón "Reservar mesa" abajo a la derecha que abre la reserva sin salir de tu web.</span>
        <code style={{ display: 'block', background: 'var(--bg)', borderRadius: 12, padding: 10, fontSize: 12, wordBreak: 'break-all' }}>{code}</code>
        <button className="btn soft sm" onClick={() => copy(code, 'Código')}><Icon name="link" size={16} /> Copiar código</button>
      </section>
      <section className="widget stack printable" style={{ gap: 8, alignItems: 'center', textAlign: 'center' }}>
        <h3 className="title-md">QR para mesas, carta y escaparate</h3>
        <div className="qr-box">{qr ? <img src={qr} alt="QR para reservar" /> : <div className="spinner" />}</div>
        <strong>Reserva en {business.name}</strong>
        <div className="row" style={{ gap: 8, width: '100%' }}>
          {qr && <a className="btn soft sm" style={{ flex: 1 }} href={qr} download={`qr-reservas-${business.username}.png`}><Icon name="download" size={16} /> Descargar</a>}
          <button className="btn soft sm" style={{ flex: 1 }} onClick={() => window.print()}><Icon name="printer" size={16} /> Imprimir</button>
        </div>
      </section>
    </div>
  );
}

export default function Share() {
  const { business } = useAuth();
  return (
    <div className="page" style={{ maxWidth: 820 }}>
      <PageHeader eyebrow={business.name} title="Compartir" />
      <SectionTabs />
      {business.username ? (
        <>
          <LinkCard business={business} />
          <ShareGuide business={business} />
        </>
      ) : <div className="widget"><Empty icon="link" title="Tu enlace está casi listo">En cuanto revisemos tu negocio tendrás aquí tu enlace corto de reservas.</Empty></div>}
      <a className="widget link row" href={businessUrl(business.name)} target="_blank" rel="noreferrer" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <span className="mono" style={{ background: 'var(--bg)', color: 'var(--ink)' }}><Icon name="store" /></span>
        <strong className="grow">Ver mi página como cliente</strong>
        <Icon name="chevron" size={18} />
      </a>
    </div>
  );
}
