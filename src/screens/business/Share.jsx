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
// A ready-to-print poster (A5 portrait) or table sticker (square) with the QR, as a PNG.
async function makePoster({ qr, name, kind }) {
  const sticker = kind === 'sticker';
  const W = sticker ? 1200 : 1748;
  const H = sticker ? 1200 : 2480;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  await document.fonts?.ready;
  g.fillStyle = '#0B0B0A'; g.fillRect(0, 0, W, H);
  const font = (w, px) => `${w} ${px}px Inter, -apple-system, "Segoe UI", Arial, sans-serif`;
  g.textAlign = 'center';
  g.fillStyle = '#D4F25C';
  g.font = font(800, sticker ? 64 : 96);
  g.fillText(sticker ? 'Reserva aquí' : 'Reserva tu mesa', W / 2, sticker ? 140 : 300);
  g.fillStyle = '#FFFFFF';
  let size = sticker ? 54 : 84;
  g.font = font(700, size);
  while (g.measureText(name).width > W * 0.86 && size > 30) { size -= 4; g.font = font(700, size); }
  g.fillText(name, W / 2, sticker ? 220 : 430);
  const img = new Image();
  img.src = qr;
  await img.decode();
  const q = sticker ? 760 : 1180;
  const x = (W - q) / 2;
  const y = sticker ? 290 : 620;
  g.fillStyle = '#FFFFFF';
  const pad = sticker ? 36 : 56;
  g.beginPath(); g.roundRect(x - pad, y - pad, q + pad * 2, q + pad * 2, sticker ? 40 : 64); g.fill();
  g.drawImage(img, x, y, q, q);
  g.fillStyle = 'rgba(255,255,255,.75)';
  g.font = font(600, sticker ? 38 : 58);
  g.fillText('Apunta con la cámara del móvil', W / 2, y + q + pad + (sticker ? 80 : 150));
  if (!sticker) {
    g.font = font(500, 46);
    g.fillText('Sin llamadas · Confirmación al momento', W / 2, y + q + pad + 240);
  }
  g.fillStyle = '#D4F25C';
  g.font = font(800, sticker ? 34 : 54);
  g.fillText('netwish.es', W / 2, H - (sticker ? 50 : 120));
  return c.toDataURL('image/png');
}

function ShareGuide({ business }) {
  const toast = useToast();
  // Each place gets its own tag, so "Números" shows where bookings come from.
  const url = bookingLink(business);
  const tagged = (via) => `${url}?via=${via}`;
  const [qr, setQr] = useState('');
  const [making, setMaking] = useState(null);
  useEffect(() => {
    QRCode.toDataURL(tagged('qr'), { margin: 1, width: 720 }).then(setQr);
  }, [url]);
  const poster = async (kind) => {
    setMaking(kind);
    try {
      const png = await makePoster({ qr, name: business.name, kind });
      const a = document.createElement('a');
      a.href = png;
      a.download = `${kind === 'sticker' ? 'pegatina-mesa' : 'cartel-a5'}-${business.username}.png`;
      a.click();
    } catch {
      toast('No se pudo crear el cartel en este navegador', 'error');
    } finally {
      setMaking(null);
    }
  };
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
        <button className="btn soft sm" onClick={() => copy(tagged('google'), 'Enlace')}><Icon name="link" size={16} /> Copiar enlace</button>
      </section>
      <section className="widget stack" style={{ gap: 10 }}>
        <h3 className="title-md">Instagram</h3>
        {step(1, 'Editar perfil → Enlaces', 'Añade un enlace externo con tu enlace de reservas y ponle de título "Reservar mesa".')}
        {step(2, 'En tus historias', 'Usa el sticker "Enlace" con el mismo enlace cuando publiques un plato o un evento.')}
        <button className="btn soft sm" onClick={() => copy(tagged('instagram'), 'Enlace')}><Icon name="link" size={16} /> Copiar enlace</button>
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
        <div className="row" style={{ gap: 8, width: '100%' }}>
          <button className="btn primary sm" style={{ flex: 1 }} disabled={!qr || !!making} onClick={() => poster('a5')}>{making === 'a5' ? 'Creando…' : 'Cartel A5 listo para imprimir'}</button>
          <button className="btn soft sm" style={{ flex: 1 }} disabled={!qr || !!making} onClick={() => poster('sticker')}>{making === 'sticker' ? 'Creando…' : 'Pegatina de mesa'}</button>
        </div>
      </section>
      <section className="widget stack" style={{ gap: 10 }}>
        <h3 className="title-md">WhatsApp</h3>
        {step(1, 'Mensaje automático', 'En WhatsApp Business → Herramientas → Mensaje de bienvenida, pega tu enlace: "¡Hola! Reserva aquí en un momento: …".')}
        <button className="btn soft sm" onClick={() => copy(tagged('whatsapp'), 'Enlace')}><Icon name="link" size={16} /> Copiar enlace</button>
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
