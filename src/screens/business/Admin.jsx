import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import { Empty, Mono, PageHeader, Spinner, useToast } from '../../components/ui.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import useAsync from '../../hooks/useAsync.js';
import {
  adminBusinesses, adminCreateBusiness, adminLock, adminOverview, adminStatus, adminUnlock,
  announceLaunch, demoBusinesses, isAdmin, launchSignups, setBusinessStatus, setDemoAs, setDemoVisibility,
} from '../../lib/data.js';
import { BUSINESS_TYPES, typeOf } from '../../lib/businessTypes.js';
import { grantAccess } from '../../lib/launch.js';
import { timeAgo } from '../../lib/format.js';
import { AuthForms } from '../customer/Account.jsx';
import OwnerForm from '../../components/OwnerForm.jsx';

const KIND_LABEL = { alta: 'Quiere entrar', otro: 'No encaja en los tipos', contacto: 'Quiere más', nuevo: 'Alta', listo: 'Listo para publicar' };

// netwish.es/admin: the admin account signs in and then types its own admin key.
// Without the key the database treats nobody as admin; anyone else is sent home.
export default function Admin() {
  const { ready, user } = useAuth();
  const { data: status, loading, reload } = useAsync(async () => (user ? adminStatus() : null), [user?.id]);

  if (!ready || (user && loading && status === undefined)) return <Spinner />;
  if (!user) {
    return (
      <div className="page" style={{ maxWidth: 440 }}>
        <PageHeader eyebrow="NetWish" title="Administración" />
        <AuthForms next="/admin" simple />
      </div>
    );
  }
  if (loading && !status) return <Spinner />;
  // Before the admin key exists in the database, the old check (account only) still applies.
  if (status === null) return <AdminHome />;
  if (!status.account) return <Navigate to="/" replace />;
  if (!status.unlocked) return <AdminKey hasKey={status.has_key} onDone={reload} />;
  return <AdminHome onLock={async () => { await adminLock(); reload(); }} />;
}

function AdminKey({ hasKey, onDone }) {
  const toast = useToast();
  const { signOut } = useAuth();
  const [key, setKey] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!hasKey && key !== again) { toast('Las dos claves no coinciden', 'error'); return; }
    setBusy(true);
    try {
      await adminUnlock(key);
      onDone();
    } catch (err) {
      toast(err.message, 'error');
      setBusy(false);
    }
  };
  return (
    <div className="page" style={{ maxWidth: 440 }}>
      <PageHeader eyebrow="NetWish" title="Administración" />
      <form className="widget stack" onSubmit={submit}>
        <span className="mono" style={{ background: 'var(--ink)', color: 'var(--accent)' }}><Icon name="lock" size={20} /></span>
        <h2 className="title-lg" style={{ margin: 0 }}>{hasKey ? 'Clave de administración' : 'Crea tu clave de administración'}</h2>
        <p className="small muted" style={{ margin: 0 }}>
          {hasKey
            ? 'Además de tu cuenta, hace falta esta clave. Vale 12 horas en este dispositivo.'
            : 'Es una segunda contraseña solo para esta zona, distinta de la de tu cuenta. Mínimo 8 caracteres. Apúntala bien.'}
        </p>
        <div className="field">
          <label htmlFor="ad-key">Clave</label>
          <input id="ad-key" className="input" type="password" required minLength={hasKey ? undefined : 8} value={key} onChange={(e) => setKey(e.target.value)} autoComplete={hasKey ? 'current-password' : 'new-password'} autoFocus />
        </div>
        {!hasKey && (
          <div className="field">
            <label htmlFor="ad-key2">Repite la clave</label>
            <input id="ad-key2" className="input" type="password" required value={again} onChange={(e) => setAgain(e.target.value)} autoComplete="new-password" />
          </div>
        )}
        <button className="btn primary block" disabled={busy}>{busy ? 'Comprobando…' : hasKey ? 'Entrar' : 'Guardar clave y entrar'}</button>
        <button type="button" className="btn ghost block" onClick={signOut}>Cerrar sesión</button>
      </form>
    </div>
  );
}

function AdminHome({ onLock }) {
  const { user } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(null);
  const { data, loading, reload } = useAsync(async () => {
    if (!(await isAdmin())) return { denied: true };
    // The admin always sees the real app on this device, even before launch.
    grantAccess();
    const [overview, signups, demos, real] = await Promise.all([
      adminOverview(), launchSignups().catch(() => null), demoBusinesses().catch(() => []), adminBusinesses().catch(() => null),
    ]);
    return { ...overview, signups, demos, real };
  }, [user?.id]);

  if (loading && !data) return <Spinner />;
  if (data?.denied) return <div className="page"><Empty icon="lock" title="Esta página es solo para el equipo de NetWish" /></div>;

  const decide = async (b, status) => {
    setBusy(b.username);
    try {
      await setBusinessStatus(b.username, status);
      toast(status === 'approved' ? `${b.name} ya es público` : `${b.name} rechazado`);
      reload();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const real = data.pending.filter((b) => !String(b.username || '').startsWith('demo-'));
  const pending = real.filter((b) => b.status === 'pending');
  const rejected = real.filter((b) => b.status === 'rejected');

  return (
    <div className="page" style={{ maxWidth: 900 }}>
      <PageHeader
        eyebrow="NetWish"
        title="Administración"
        right={(
          <div className="row" style={{ gap: 6 }}>
            <Link to="/" className="btn soft sm">Ir a la app</Link>
            {onLock && <button className="btn ghost sm" onClick={onLock}>Bloquear</button>}
          </div>
        )}
      />

      <RealBusinesses list={data.real} reload={reload} />

      <DemoList demos={data.demos} reload={reload} />

      <section className="widget stack">
        <h2 className="title-lg">Negocios por aprobar</h2>
        {pending.length === 0 && <p className="small muted" style={{ margin: 0 }}>No hay altas pendientes.</p>}
        {pending.map((b) => (
          <div key={b.username} className="order-card">
            <div className="row" style={{ gap: 12 }}>
              <Mono name={b.name} image={b.image} />
              <span className="grow stack" style={{ gap: 1, minWidth: 0 }}>
                <strong>{b.name}</strong>
                <span className="small muted">{b.category} · {timeAgo(b.created_at)}</span>
              </span>
            </div>
            <span className="small">{[b.address, b.telefono, b.notification_email].filter(Boolean).join(' · ') || 'Sin datos de contacto'}</span>
            <div className="row" style={{ gap: 8 }}>
              <a className="btn soft sm" style={{ flex: 1 }} href={`/negocio/${encodeURIComponent(b.name)}`} target="_blank" rel="noreferrer">Ver página</a>
              <button className="btn primary sm" style={{ flex: 1 }} disabled={busy === b.username} onClick={() => decide(b, 'approved')}>Aprobar</button>
              <button className="btn ghost sm" style={{ flex: 1 }} disabled={busy === b.username} onClick={() => decide(b, 'rejected')}>Rechazar</button>
            </div>
          </div>
        ))}
        {rejected.length > 0 && (
          <details>
            <summary className="small muted" style={{ cursor: 'pointer' }}>{rejected.length} rechazados</summary>
            {rejected.map((b) => (
              <div key={b.username} className="list-row">
                <span className="grow t">{b.name}</span>
                <button className="btn soft sm" disabled={busy === b.username} onClick={() => decide(b, 'approved')}>Aprobar</button>
              </div>
            ))}
          </details>
        )}
      </section>

      <LaunchList signups={data.signups} reload={reload} />

      <section className="widget" style={{ paddingBottom: 4 }}>
        <h2 className="title-lg">Solicitudes y mensajes</h2>
        {data.requests.length === 0 && <p className="small muted">Todavía no hay ninguna.</p>}
        {data.requests.map((r) => (
          <div key={r.id} className="list-row" style={{ alignItems: 'flex-start' }}>
            <span className="grow stack" style={{ gap: 2, minWidth: 0 }}>
              <span className="row between" style={{ gap: 8 }}>
                <strong>{r.name}</strong>
                <span className="status" style={{ background: r.kind === 'otro' ? 'var(--accent)' : 'var(--bg)' }}>{KIND_LABEL[r.kind] || r.kind}</span>
              </span>
              <span className="small muted">{[r.category, r.email, r.phone].filter(Boolean).join(' · ')} · {timeAgo(r.created_at)}</span>
              {r.description && <span style={{ fontSize: 15, whiteSpace: 'pre-wrap' }}>{r.description}</span>}
            </span>
          </div>
        ))}
      </section>
    </div>
  );
}

// One example business of each type, to see the customer page and open its panel.
function DemoList({ demos, reload }) {
  const toast = useToast();
  const navigate = useNavigate();
  const { refreshBusiness } = useAuth();
  const [busy, setBusy] = useState(false);
  if (!demos?.length) {
    return (
      <section className="widget stack">
        <h2 className="title-lg">Negocios de ejemplo</h2>
        <p className="small muted" style={{ margin: 0 }}>Aún no están creados. Pega en Supabase el archivo SQL «tiendas-y-mas-tipos.sql» y pulsa Run: aparecerán aquí.</p>
      </section>
    );
  }
  const visible = demos.some((b) => b.status === 'approved');
  const open = async (b) => {
    setDemoAs(b.username);
    await refreshBusiness();
    navigate('/panel');
  };
  const toggle = async () => {
    setBusy(true);
    try {
      await setDemoVisibility(!visible);
      toast(visible ? 'Ejemplos ocultos de la app' : 'Ejemplos visibles en la app');
      reload();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="widget stack" style={{ paddingBottom: 4 }}>
      <div className="row between" style={{ gap: 10 }}>
        <h2 className="title-lg">Negocios de ejemplo</h2>
        <button className="btn soft sm" disabled={busy} onClick={toggle}>{visible ? 'Ocultar de la app' : 'Mostrar en la app'}</button>
      </div>
      <p className="small muted" style={{ margin: 0 }}>{visible ? 'Se ven en la app con la etiqueta «Ejemplo».' : 'Ocultos: solo los ves desde aquí.'} «Abrir panel» entra en su panel con tu cuenta; para volver, pulsa «Salir» arriba.</p>
      {demos.map((b) => {
        const t = typeOf(b);
        return (
          <div key={b.username} className="list-row" style={{ gap: 10, flexWrap: 'wrap' }}>
            <span className="mono" style={{ background: 'var(--accent)', color: 'var(--ink)', flex: 'none' }}><Icon name={t.icon} size={18} /></span>
            <span className="grow stack" style={{ gap: 1, minWidth: 140 }}>
              <span className="t">{b.name}</span>
              <span className="s">{t.label}</span>
            </span>
            <a className="btn soft sm" href={`/negocio/${encodeURIComponent(b.name)}`} target="_blank" rel="noreferrer">Ver como cliente</a>
            <button className="btn primary sm" onClick={() => open(b)}>Abrir panel</button>
          </div>
        );
      })}
    </section>
  );
}

const LAUNCH_TEXT = 'Hola:\n\nNos pediste que te avisáramos y aquí estamos: NetWish ya está abierto. Reserva mesa en restaurantes, cita en peluquerías y descubre los comercios de Palencia, todo desde un mismo sitio.\n\nGracias por esperar.\nEl equipo de NetWish';

// People who left their e-mail on the "Muy pronto" screen, and the launch e-mail to all of them.
function LaunchList({ signups, reload }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState('NetWish ya está abierto en Palencia');
  const [body, setBody] = useState(LAUNCH_TEXT);
  const [sure, setSure] = useState(false);
  const [sending, setSending] = useState(false);

  if (!signups) {
    return (
      <section className="widget stack">
        <h2 className="title-lg">Lista de espera</h2>
        <p className="small muted" style={{ margin: 0 }}>Falta crear la tabla en Supabase (lista-lanzamiento.sql).</p>
      </section>
    );
  }

  const pending = signups.filter((s) => !s.notified_at).length;
  const today = signups.filter((s) => new Date(s.created_at).toDateString() === new Date().toDateString()).length;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(signups.map((s) => s.email).join(', '));
      toast('Correos copiados');
    } catch {
      toast('No se pudo copiar', 'error');
    }
  };

  const download = () => {
    const rows = [['correo', 'fecha', 'origen', 'avisado'], ...signups.map((s) => [s.email, s.created_at, s.source || '', s.notified_at || ''])];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
    a.download = 'netwish-lista-de-espera.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const send = async () => {
    if (!sure) { setSure(true); return; }
    setSending(true);
    try {
      const out = await announceLaunch({ subject, body });
      toast(`Enviado a ${out.sent} de ${out.total}`);
      setOpen(false);
      reload();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setSending(false);
      setSure(false);
    }
  };

  return (
    <section className="widget stack">
      <div className="row between" style={{ gap: 8 }}>
        <h2 className="title-lg" style={{ margin: 0 }}>Lista de espera</h2>
        <a className="btn soft sm" href="/?muypronto=1" target="_blank" rel="noreferrer">Ver pantalla</a>
      </div>
      <p className="small muted" style={{ margin: 0 }}>
        {signups.length === 1 ? '1 persona apuntada' : `${signups.length} personas apuntadas`}
        {today > 0 && ` · ${today} hoy`}
        {signups.length > 0 && ` · ${pending} sin avisar`}
      </p>
      {signups.length > 0 && (
        <>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn soft sm" style={{ flex: 1 }} onClick={copy}>Copiar correos</button>
            <button className="btn soft sm" style={{ flex: 1 }} onClick={download}>Descargar Excel (CSV)</button>
          </div>
          <details>
            <summary className="small muted" style={{ cursor: 'pointer' }}>Ver la lista</summary>
            {signups.map((s) => (
              <div key={s.email} className="list-row">
                <span className="grow t" style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.email}</span>
                <span className="small muted">{s.notified_at ? 'Avisado' : timeAgo(s.created_at)}</span>
              </div>
            ))}
          </details>
          {pending > 0 && !open && (
            <button className="btn primary" onClick={() => setOpen(true)}>Avisar a todos de que ya está abierto</button>
          )}
          {open && (
            <div className="stack" style={{ gap: 8 }}>
              <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="Asunto" />
              <textarea className="input" rows={7} value={body} onChange={(e) => setBody(e.target.value)} aria-label="Mensaje" />
              <div className="row" style={{ gap: 8 }}>
                <button className="btn ghost" style={{ flex: 1 }} onClick={() => { setOpen(false); setSure(false); }}>Cancelar</button>
                <button className="btn primary" style={{ flex: 2 }} disabled={sending} onClick={send}>
                  {sending ? 'Enviando…' : sure ? `Sí, enviar a ${pending}` : `Enviar a ${pending} personas`}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

// Real businesses of Palencia that NetWish sets up itself and later hands to their owner.
function RealBusinesses({ list, reload }) {
  const toast = useToast();
  const navigate = useNavigate();
  const { refreshBusiness } = useAuth();
  const types = BUSINESS_TYPES.filter((t) => !t.hidden && !t.other);
  const [form, setForm] = useState({ name: '', type: types[0]?.key || '', phone: '', address: '' });
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [owner, setOwner] = useState(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  if (!list) {
    return (
      <section className="widget stack">
        <h2 className="title-lg">Negocios reales</h2>
        <p className="small muted" style={{ margin: 0 }}>Falta pegar en Supabase el archivo SQL «negocios-reales.sql» y pulsar Run.</p>
      </section>
    );
  }

  const open = async (username) => {
    setDemoAs(username);
    await refreshBusiness();
    navigate('/panel');
  };
  const create = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const type = types.find((t) => t.key === form.type);
      const out = await adminCreateBusiness({ name: form.name, category: type?.category || '', phone: form.phone, address: form.address });
      toast(`${out.name} creado. Ahora móntale el panel.`);
      await open(out.username);
    } catch (err) {
      toast(err.message, 'error');
      setBusy(false);
    }
  };

  return (
    <section className="widget stack" style={{ paddingBottom: 4 }}>
      <div className="row between" style={{ gap: 10 }}>
        <h2 className="title-lg" style={{ margin: 0 }}>Negocios reales</h2>
        {!adding && <button className="btn primary sm" onClick={() => setAdding(true)}><Icon name="plus" size={16} /> Nuevo negocio</button>}
      </div>
      <p className="small muted" style={{ margin: 0 }}>Los que montas tú salen en la app como «Aún no conectado»: se puede probar a reservar, pero no se guarda nada. Cuando le asignas el dueño, pasa a funcionar de verdad.</p>
      {adding && (
        <form className="stack" style={{ gap: 10, padding: '6px 0 12px' }} onSubmit={create}>
          <div className="field"><label htmlFor="nb-name">Nombre</label><input id="nb-name" className="input" required value={form.name} onChange={set('name')} autoFocus /></div>
          <div className="field">
            <label htmlFor="nb-type">Tipo</label>
            <select id="nb-type" className="input" value={form.type} onChange={set('type')}>
              {types.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </div>
          <div className="field"><label htmlFor="nb-phone">Teléfono</label><input id="nb-phone" className="input" type="tel" value={form.phone} onChange={set('phone')} /></div>
          <div className="field"><label htmlFor="nb-address">Dirección</label><input id="nb-address" className="input" value={form.address} onChange={set('address')} placeholder="Calle Mayor 12, Palencia" /></div>
          <div className="row" style={{ gap: 8 }}>
            <button type="button" className="btn ghost" style={{ flex: 1 }} onClick={() => setAdding(false)}>Cancelar</button>
            <button className="btn primary" style={{ flex: 2 }} disabled={busy}>{busy ? 'Creando…' : 'Crear y montar su panel'}</button>
          </div>
        </form>
      )}
      {list.length === 0 && !adding && <p className="small muted" style={{ margin: 0 }}>Aún no hay ninguno.</p>}
      {list.filter((b) => b.status !== 'rejected').map((b) => (
        <div key={b.username} className="stack" style={{ gap: 8, padding: '10px 0', borderTop: '1px solid var(--bg)' }}>
          <div className="row" style={{ gap: 10 }}>
            <Mono name={b.name} />
            <span className="grow stack" style={{ gap: 1, minWidth: 0 }}>
              <span className="t" style={{ fontWeight: 700 }}>{b.name}</span>
              <span className="s small muted">{typeOf(b).label}</span>
            </span>
            <OwnerTag b={b} />
          </div>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <a className="btn soft sm" style={{ flex: 1 }} href={`/negocio/${encodeURIComponent(b.name)}`} target="_blank" rel="noreferrer">Ver como cliente</a>
            <button className="btn soft sm" style={{ flex: 1 }} onClick={() => setOwner(owner === b.username ? null : b.username)}>Dueño</button>
            <button className="btn primary sm" style={{ flex: 1 }} onClick={() => open(b.username)}>Abrir panel</button>
          </div>
          {owner === b.username && <OwnerForm business={b} onDone={() => { setOwner(null); reload(); }} />}
        </div>
      ))}
    </section>
  );
}

function OwnerTag({ b }) {
  if (b.owner_email) return <span className="status" style={{ background: 'var(--accent)' }}>Conectado</span>;
  if (b.pending_owner_email) return <span className="status" style={{ background: 'var(--bg)' }}>Esperando registro</span>;
  return <span className="status" style={{ background: 'var(--bg)' }}>Sin conectar</span>;
}
