import { useEffect, useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import QRCode from 'qrcode';
import Icon from '../../components/Icon.jsx';
import { Mono, PageHeader, Ring, Sheet, useToast } from '../../components/ui.jsx';
import { PanelPrefs } from '../../components/Shell.jsx';
import ContactTeam from '../../components/ContactTeam.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { safeSlug, updateBusiness, uploadPublicFile } from '../../lib/data.js';
import { supabase } from '../../lib/supabase.js';
import { kindOf } from '../../lib/categories.js';
import { businessUrl } from '../../lib/qr.js';
import { normalize, toneFor } from '../../lib/format.js';
import { profileProgress, sectionProgress } from '../../lib/questionnaire.js';
import { sectionsFor } from '../../lib/typeQuestions.js';
import { typeOf } from '../../lib/businessTypes.js';
import { canInstall, disablePush, enablePush, isInstalled, promptInstall, pushState } from '../../lib/push.js';

const MAX_IMAGE_MB = 8;

// Notifications on this phone or computer for every new booking or order, even with the panel closed.
function PushRow({ business }) {
  const toast = useToast();
  const [state, setState] = useState('…');
  useEffect(() => { pushState().then(setState).catch(() => setState('unsupported')); }, []);
  const flip = async () => {
    try {
      if (state === 'on') { await disablePush(); setState('off'); toast('Avisos desactivados en este dispositivo'); }
      else { await enablePush(business.name); setState('on'); toast('Listo: te avisaremos aquí de cada reserva nueva'); }
    } catch (e) {
      toast(e.message, 'error');
    }
  };
  const sub = state === 'on' ? 'Activados: te llega un aviso aunque el panel esté cerrado.'
    : state === 'denied' ? 'Bloqueados en el navegador. Actívalos en sus ajustes.'
      : state === 'unsupported' ? 'En iPhone: Compartir → Añadir a pantalla de inicio, y ábrelo desde ahí.'
        : 'Recibe un aviso en este móvil con cada reserva o pedido nuevo.';
  return (
    <button className="list-row" onClick={flip} disabled={state === 'unsupported' || state === '…'}>
      <span className="mono" style={{ background: state === 'on' ? 'var(--accent)' : 'var(--bg)', color: 'var(--ink)' }}><Icon name="bell" size={20} /></span>
      <span className="grow stack" style={{ gap: 1 }}><span className="t">Avisos en este dispositivo</span><span className="s">{sub}</span></span>
      <span className="small" style={{ fontWeight: 700 }}>{state === 'on' ? 'Quitar' : state === 'off' ? 'Activar' : ''}</span>
    </button>
  );
}

// Put the panel on the home screen like an app (Android/Chrome; on iPhone, from Share).
function InstallRow() {
  const [ready, setReady] = useState(canInstall());
  useEffect(() => {
    const on = () => setReady(true);
    window.addEventListener('netwish-installable', on);
    return () => window.removeEventListener('netwish-installable', on);
  }, []);
  if (isInstalled()) return null;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (!ready && !ios) return null;
  return (
    <button className="list-row" onClick={() => (ready ? promptInstall().then(() => setReady(false)) : null)} disabled={!ready}>
      <span className="mono" style={{ background: 'var(--bg)', color: 'var(--ink)' }}><Icon name="download" size={20} /></span>
      <span className="grow stack" style={{ gap: 1 }}>
        <span className="t">Instalar NetWish en este dispositivo</span>
        <span className="s">{ready ? 'Se abre como una app, a pantalla completa.' : 'En Safari: botón Compartir → "Añadir a pantalla de inicio".'}</span>
      </span>
      {ready && <span className="small" style={{ fontWeight: 700 }}>Instalar</span>}
    </button>
  );
}

// Waiters, front desk or the team: they enter with their own account and see the panel.
function TeamAccess({ business }) {
  const toast = useToast();
  const [list, setList] = useState(null);
  const [email, setEmail] = useState('');
  useEffect(() => {
    supabase.from('businesses').select('staff_emails').eq('username', business.username).maybeSingle()
      .then(({ data, error }) => setList(error ? null : data?.staff_emails || []));
  }, [business.username]);
  if (list === null) return null;
  const save = async (next) => {
    try {
      await updateBusiness(business.username, { staff_emails: next });
      setList(next);
    } catch (e) {
      toast(e.message, 'error');
    }
  };
  const add = (e) => {
    e.preventDefault();
    const m = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(m)) return toast('Escribe un correo válido', 'error');
    if (list.includes(m)) return setEmail('');
    save([...list, m].slice(0, 20)).then(() => { setEmail(''); toast(`Listo. ${m} entra en netwish.es/negocios con ese correo.`); });
  };
  return (
    <section className="widget stack" style={{ gap: 10 }}>
      <h2 className="title-lg">Personas con acceso al panel</h2>
      <span className="small muted">Añade el correo de cada persona. Entran en netwish.es/negocios con su propia cuenta y ven reservas, clientes y carta. Los datos del negocio y estos ajustes solo los cambias tú.</span>
      {list.map((m) => (
        <div key={m} className="row" style={{ gap: 10 }}>
          <Icon name="person" size={18} />
          <span className="grow small" style={{ fontWeight: 600 }}>{m}</span>
          <button type="button" className="btn ghost sm" onClick={() => save(list.filter((x) => x !== m))}>Quitar</button>
        </div>
      ))}
      <form className="row" style={{ gap: 8 }} onSubmit={add}>
        <input className="input grow" type="email" placeholder="correo@ejemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Correo de la persona del equipo" />
        <button className="btn soft">Añadir</button>
      </form>
    </section>
  );
}

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
        <span className="small muted">Escanea para ver {kindOf(business) === 'restaurant' ? 'la carta y reservar mesa' : kindOf(business) === 'shop' ? 'la tienda y reservar para recoger' : 'nuestros servicios y reservar'}</span>
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
  const allSections = sectionsFor(business);
  const pct = profileProgress(answers, allSections);
  const sections = allSections.filter((x) => !x.when || x.when(answers));
  const type = typeOf(business);
  const yours = isRestaurant ? 'Tu restaurante' : kind === 'shop' ? 'Tu tienda' : kind === 'taxi' ? 'Tu taxi' : kind === 'classes' ? 'Tu centro' : 'Tu negocio';

  // Every setting as one row, so the search finds it by name or by any of its questions.
  const rows = [
    { group: 'Tu negocio', icon: 'store', label: 'Dirección, teléfono y correo de avisos', keys: 'datos direccion telefono correo email avisos', run: toForm, searchOnly: true },
    ...sections.map((x) => {
      const p = sectionProgress(x, answers);
      return {
        group: yours, label: x.title, sub: x.intro, to: x.onboarding ? '/panel/empezar' : `/panel/personalizar/${x.key}`,
        keys: x.questions.map((qq) => `${qq.label} ${qq.help || ''}`).join(' '),
        badge: p.done >= p.total ? 'check' : `${p.done}/${p.total}`,
      };
    }),
    ...(isRestaurant && (modules?.reservas || modules?.pedidosQr) ? [{ group: 'Tu restaurante', icon: 'grid', label: 'Tu sala', sub: 'Plano, zonas, mesas, terraza y QR de cada mesa', keys: 'sala mesas plano zonas terraza qr decorado', to: '/panel/mesas' }] : []),
    ...(kind === 'beauty' ? [{ group: yours, icon: 'calendar', label: 'Horario y equipo', keys: 'horario equipo profesionales', to: '/panel/horario' }] : []),
    ...(kind === 'shop' || kind === 'classes' || kind === 'taxi' ? [{ group: yours, icon: 'clock', label: 'Horario', sub: 'Horas de apertura y días que cierras', keys: 'horario apertura cierre dias', to: '/panel/horario' }] : []),
    ...(type.shop?.daily ? [{ group: yours, icon: 'flame', label: 'Mostrador de hoy y hornadas', sub: 'Lo que queda hoy, agotados y horas de horno', keys: 'stock mostrador hornadas agotado', to: '/panel/stock' }] : []),
    ...(kind === 'classes' ? [{ group: yours, icon: 'dumbbell', label: 'Horario de clases', keys: 'clases horario plazas profesores', to: '/panel/clases' }] : []),
    ...(!isRestaurant ? [
      { group: 'Compartir', icon: 'qr', label: 'QR para el escaparate o el mostrador', keys: 'qr imprimir', run: () => setPayOpen(true) },
      ...(business.username ? [{ group: 'Compartir', icon: 'link', label: kind === 'shop' ? 'Copiar el enlace de mi tienda' : 'Copiar mi enlace de reservas', keys: 'enlace link', run: () => navigator.clipboard?.writeText(`${window.location.origin}/r/${business.username}`).then(() => toast('Enlace de reservas copiado')) }] : []),
    ] : []),
    { group: 'Cuenta', icon: 'chat', label: 'Ayuda y primeros pasos', sub: 'Guía rápida, preguntas frecuentes y contacto', keys: 'ayuda soporte dudas whatsapp contacto guia', to: '/panel/ayuda' },
    { group: 'Cuenta', icon: 'store', label: 'Ver mi página como cliente', keys: 'pagina publica', href: businessUrl(business.name) },
    { group: 'Cuenta', icon: 'logout', label: 'Cerrar sesión', keys: 'salir', run: () => signOut().then(() => navigate('/negocios')), plain: true },
  ];
  const device = 'Este dispositivo';
  const deviceKeys = normalize('modo noche oscuro sonido aviso avisos notificaciones push atril tablet pantalla');
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
        {g === yours && !query && (
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
      <div className="widget" style={{ paddingTop: 4, paddingBottom: 4 }}><InstallRow /><PushRow business={business} /><PanelPrefs prefs={prefs} setPref={setPref} /></div>
    </section>
  );

  // Staff only get their device settings; the business data is the owner's.
  if (business.staff) {
    return (
      <div className="page" style={{ maxWidth: 820 }}>
        <PageHeader eyebrow={business.name} title="Ajustes" />
        <div className="widget"><span className="small">Entras como parte del equipo de {business.name}. Los datos del negocio solo los cambia el dueño.</span></div>
        {deviceBlock}
        <button className="btn block" onClick={() => signOut().then(() => navigate('/negocios'))}><Icon name="logout" size={18} /> Cerrar sesión</button>
      </div>
    );
  }

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
              <label htmlFor="s-mail">Correo para avisos de reservas y pedidos</label>
              <input id="s-mail" className="input" type="email" value={form.notification_email} onChange={set('notification_email')} placeholder="reservas@tunegocio.es" />
            </div>
            <button className="btn primary block" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
          </form>
          <TeamAccess business={business} />
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
