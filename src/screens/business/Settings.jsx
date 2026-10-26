import { useEffect, useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import QRCode from 'qrcode';
import Icon from '../../components/Icon.jsx';
import { Mono, PageHeader, Ring, Sheet, useToast } from '../../components/ui.jsx';
import { PanelPrefs } from '../../components/Shell.jsx';
import ContactTeam from '../../components/ContactTeam.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { safeSlug, updateBusiness, uploadPublicFile } from '../../lib/data.js';
import { kindOf } from '../../lib/categories.js';
import { businessUrl } from '../../lib/qr.js';
import { normalize, toneFor } from '../../lib/format.js';
import { profileProgress, RESTAURANT_SECTIONS, sectionProgress } from '../../lib/questionnaire.js';

const MAX_IMAGE_MB = 8;

function BusinessQrSheet({ open, onClose, business }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    if (open) QRCode.toDataURL(businessUrl(business.name), { margin: 1, width: 440 }).then(setSrc);
  }, [open, business.name]);
  return (
    <Sheet open={open} onClose={onClose} title="QR de tu negocio">
      <div className="stack printable" style={{ alignItems: 'center', textAlign: 'center' }}>
        <div className="qr-box">{src ? <img src={src} alt="Código QR de tu negocio" /> : <div className="spinner" />}</div>
        <strong style={{ fontSize: 22 }}>Reserva en {business.name}</strong>
        <span className="small muted">Escanea para ver {kindOf(business) === 'restaurant' ? 'la carta y reservar mesa' : 'nuestros servicios y reservar'}</span>
      </div>
      <button className="btn primary block" style={{ marginTop: 14 }} onClick={() => window.print()}><Icon name="printer" size={18} /> Imprimir</button>
    </Sheet>
  );
}

export default function Settings() {
  const { business, refreshBusiness, signOut } = useAuth();
  const { settings, modules, prefs, setPref } = useOutletContext();
  const toast = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    address: business.address || '',
    telefono: business.telefono || '',
    notification_email: business.notification_email || '',
  });
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(null);
  const [payOpen, setPayOpen] = useState(false);
  const [q, setQ] = useState('');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value.slice(0, 160) }));
  const kind = kindOf(business);
  const isRestaurant = kind === 'restaurant';

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await updateBusiness(business.username, {
        address: form.address.trim() || null,
        telefono: form.telefono.trim() || null,
        notification_email: form.notification_email.trim() || null,
      });
      await refreshBusiness();
      toast('Datos guardados');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const uploadImage = (field) => async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast('Elige una imagen', 'error'); return; }
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) { toast(`La imagen no puede pasar de ${MAX_IMAGE_MB} MB`, 'error'); return; }
    setUploading(field);
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
      const url = await uploadPublicFile('public-images', `${safeSlug(business.name)}/${field}_${Date.now()}.${ext}`, file);
      await updateBusiness(business.username, { [field]: url });
      await refreshBusiness();
      toast(field === 'cover_url' ? 'Portada actualizada' : 'Logo actualizado');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setUploading(null);
    }
  };

  const toForm = () => { setQ(''); setTimeout(() => document.getElementById('s-addr')?.focus(), 50); };
  const answers = settings?.profile || {};
  const pct = isRestaurant ? profileProgress(answers) : 100;
  const sections = isRestaurant ? RESTAURANT_SECTIONS.filter((x) => !x.when || x.when(answers)) : [];

  // Every setting as one row, so the search finds it by name or by any of its questions.
  const rows = [
    { group: 'Tu negocio', icon: 'store', label: 'Dirección, teléfono y correo de avisos', keys: 'datos direccion telefono correo email avisos', run: toForm, searchOnly: true },
    ...sections.map((x) => {
      const p = sectionProgress(x, answers);
      return {
        group: 'Tu restaurante', label: x.title, sub: x.intro, to: x.onboarding ? '/panel/empezar' : `/panel/personalizar/${x.key}`,
        keys: x.questions.map((qq) => `${qq.label} ${qq.help || ''}`).join(' '),
        badge: p.done >= p.total ? 'check' : `${p.done}/${p.total}`,
      };
    }),
    ...(isRestaurant && (modules?.reservas || modules?.pedidosQr) ? [{ group: 'Tu restaurante', icon: 'grid', label: 'Tu sala', sub: 'Plano, zonas, mesas, terraza y QR de cada mesa', keys: 'sala mesas plano zonas terraza qr decorado', to: '/panel/mesas' }] : []),
    ...(kind === 'beauty' ? [{ group: 'Tu negocio', icon: 'calendar', label: 'Horario y equipo', keys: 'horario equipo profesionales', to: '/panel/horario' }] : []),
    ...(!isRestaurant ? [
      { group: 'Compartir', icon: 'qr', label: 'QR para el escaparate o el mostrador', keys: 'qr imprimir', run: () => setPayOpen(true) },
      ...(business.username ? [{ group: 'Compartir', icon: 'link', label: 'Copiar mi enlace de reservas', keys: 'enlace link', run: () => navigator.clipboard?.writeText(`${window.location.origin}/r/${business.username}`).then(() => toast('Enlace de reservas copiado')) }] : []),
    ] : []),
    { group: 'Cuenta', icon: 'store', label: 'Ver mi página como cliente', keys: 'pagina publica', href: businessUrl(business.name) },
    { group: 'Cuenta', icon: 'logout', label: 'Cerrar sesión', keys: 'salir', run: () => signOut().then(() => navigate('/negocios')), plain: true },
  ];
  const device = 'Este dispositivo';
  const deviceKeys = normalize('modo noche oscuro sonido aviso atril tablet pantalla');
  const query = normalize(q.trim());
  const hits = query ? rows.filter((r) => normalize(`${r.group} ${r.label} ${r.sub || ''} ${r.keys || ''}`).includes(query)) : rows;
  const groups = [...new Set(hits.map((r) => r.group))];
  const showDevice = !query || deviceKeys.includes(query) || normalize(device).includes(query);

  const row = (r) => {
    const inner = (
      <>
        {r.badge ? (
          <span className="mono" style={{ background: r.badge === 'check' ? 'var(--accent)' : 'var(--bg)', color: 'var(--ink)', fontSize: 13 }}>
            {r.badge === 'check' ? <Icon name="check" size={18} stroke={3} /> : r.badge}
          </span>
        ) : <span className="mono" style={{ background: 'var(--bg)', color: 'var(--ink)' }}><Icon name={r.icon} size={20} /></span>}
        <span className="grow stack" style={{ gap: 1 }}>
          <span className="t">{r.label}</span>
          {r.sub && <span className="s">{r.sub}</span>}
        </span>
        {!r.plain && <Icon name="chevron" size={18} />}
      </>
    );
    if (r.to) return <Link key={r.label} to={r.to} className="list-row">{inner}</Link>;
    if (r.href) return <a key={r.label} className="list-row" href={r.href} target="_blank" rel="noreferrer">{inner}</a>;
    return <button key={r.label} className="list-row" onClick={r.run}>{inner}</button>;
  };

  // The business details form is on screen already; its row only shows up in a search.
  const renderGroup = (g) => {
    const list = hits.filter((r) => r.group === g && (query || !r.searchOnly));
    if (!list.length) return null;
    return (
      <section key={g} className="stack" style={{ gap: 6 }}>
        <span className="eyebrow" style={{ padding: '0 6px' }}>{g}</span>
        {g === 'Tu restaurante' && !query && (
          <div className="widget dark row" style={{ gap: 16 }}>
            <Ring value={pct / 100} color="var(--accent)" label={`Perfil completado al ${pct} %`} />
            <span className="stack" style={{ gap: 2 }}>
              <span style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em' }}>Tu perfil, al {pct} %</span>
              <span className="small" style={{ opacity: 0.7 }}>Cada respuesta ajusta tu panel o lo que ven tus clientes.</span>
            </span>
          </div>
        )}
        <div className="widget" style={{ paddingTop: 4, paddingBottom: 4 }}>{list.map(row)}</div>
      </section>
    );
  };
  const deviceBlock = showDevice && prefs && (
    <section className="stack" style={{ gap: 6 }}>
      <span className="eyebrow" style={{ padding: '0 6px' }}>{device}</span>
      <div className="widget" style={{ paddingTop: 4, paddingBottom: 4 }}><PanelPrefs prefs={prefs} setPref={setPref} /></div>
    </section>
  );

  return (
    <div className="page" style={{ maxWidth: 820 }}>
      <PageHeader eyebrow={business.name} title="Ajustes" />
      <input className="input" type="search" placeholder="Buscar un ajuste: terraza, alergias, horario…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar en ajustes" />

      {!query && (
        <>
          <div className="cover" style={{ minHeight: 190, background: toneFor(business.name) }}>
            {business.cover_url && <img className="cover-img" src={business.cover_url} alt="" />}
            <span className="cover-shade" />
            <div className="row between" style={{ position: 'relative', marginTop: 'auto', padding: 18, alignItems: 'flex-end' }}>
              <span className="row" style={{ gap: 12 }}>
                <Mono name={business.name} image={business.image} size="lg" />
                <span style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em', textShadow: '0 1px 12px rgba(0,0,0,.35)' }}>{business.name}</span>
              </span>
            </div>
          </div>

          <div className="bento">
            <label className="widget link stack" style={{ gap: 14, cursor: 'pointer' }}>
              <Icon name="image" size={24} />
              <strong>{uploading === 'cover_url' ? 'Subiendo…' : 'Cambiar portada'}</strong>
              <input type="file" accept="image/*" hidden onChange={uploadImage('cover_url')} />
            </label>
            <label className="widget link stack" style={{ gap: 14, cursor: 'pointer' }}>
              <Icon name="upload" size={24} />
              <strong>{uploading === 'image' ? 'Subiendo…' : 'Cambiar logo'}</strong>
              <input type="file" accept="image/*" hidden onChange={uploadImage('image')} />
            </label>
          </div>

          <form className="widget stack" onSubmit={save}>
            <h2 className="title-lg">Datos del negocio</h2>
            <span className="small muted">Tipo de negocio: <strong style={{ color: 'var(--ink)' }}>{business.category || 'Sin tipo'}</strong></span>
            <div className="field"><label htmlFor="s-addr">Dirección</label><input id="s-addr" className="input" value={form.address} onChange={set('address')} placeholder="Calle Mayor 1, Palencia" /></div>
            <div className="field"><label htmlFor="s-tel">Teléfono</label><input id="s-tel" className="input" type="tel" value={form.telefono} onChange={set('telefono')} /></div>
            <div className="field">
              <label htmlFor="s-mail">Correo para avisos de reservas</label>
              <input id="s-mail" className="input" type="email" value={form.notification_email} onChange={set('notification_email')} placeholder="reservas@tunegocio.es" />
            </div>
            <button className="btn primary block" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
          </form>
        </>
      )}

      {query && hits.length === 0 && !showDevice && <p className="muted" style={{ margin: '8px 4px' }}>No hay ningún ajuste con «{q.trim()}».</p>}

      {groups.filter((g) => g !== 'Cuenta').map(renderGroup)}
      {deviceBlock}
      {groups.includes('Cuenta') && renderGroup('Cuenta')}
      

      {!query && <ContactTeam />}
      <BusinessQrSheet open={payOpen} onClose={() => setPayOpen(false)} business={business} />
    </div>
  );
}
