import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import { Empty, Mono, PageHeader, Spinner, useToast } from '../../components/ui.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import useAsync from '../../hooks/useAsync.js';
import { adminOverview, announceLaunch, demoBusinesses, isAdmin, launchSignups, setBusinessStatus, setDemoAs, setDemoVisibility } from '../../lib/data.js';
import { typeOf } from '../../lib/businessTypes.js';
import { grantAccess } from '../../lib/launch.js';
import { timeAgo } from '../../lib/format.js';

const KIND_LABEL = { alta: 'Quiere entrar', otro: 'No encaja en los tipos', contacto: 'Quiere más', nuevo: 'Alta', listo: 'Listo para publicar' };

// netwish.es/admin: only NetWish's own team. The database refuses everyone else.
export default function Admin() {
  const { ready, user } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(null);
  const { data, loading, reload } = useAsync(async () => {
    if (!user) return null;
    if (!(await isAdmin())) return { denied: true };
    // The admin always sees the real app on this device, even before launch.
    grantAccess();
    const [overview, signups, demos] = await Promise.all([adminOverview(), launchSignups().catch(() => null), demoBusinesses().catch(() => [])]);
    return { ...overview, signups, demos };
  }, [user?.id]);

  if (!ready || (loading && !data)) return <Spinner />;
  if (!user) {
    return <div className="page"><Empty icon="lock" title="Entra con tu cuenta"><Link to="/cuenta" className="btn primary" style={{ marginTop: 8 }}>Iniciar sesión</Link></Empty></div>;
  }
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
      <PageHeader eyebrow="NetWish" title="Administración" right={<Link to="/" className="btn soft sm">Ir a la app</Link>} />

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
