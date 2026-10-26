import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Empty, Mono, PageHeader, Spinner, useToast } from '../../components/ui.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import useAsync from '../../hooks/useAsync.js';
import { adminOverview, isAdmin, setBusinessStatus } from '../../lib/data.js';
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
    return adminOverview();
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

  const pending = data.pending.filter((b) => b.status === 'pending');
  const rejected = data.pending.filter((b) => b.status === 'rejected');

  return (
    <div className="page" style={{ maxWidth: 900 }}>
      <PageHeader eyebrow="NetWish" title="Administración" right={<Link to="/" className="btn soft sm">Ir a la app</Link>} />

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

      <section className="widget" style={{ paddingBottom: 4 }}>
        <h2 className="title-lg">Solicitudes y mensajes</h2>
        {data.requests.length === 0 && <p className="small muted">Todavía no hay ninguna.</p>}
        {data.requests.map((r) => (
          <div key={r.id} className="list-row" style={{ alignItems: 'flex-start' }}>
            <span className="grow stack" style={{ gap: 2, minWidth: 0 }}>
              <span className="row between" style={{ gap: 8 }}>
                <strong>{r.name}</strong>
                <span className="pill" style={{ background: r.kind === 'otro' ? 'var(--accent)' : 'var(--bg)', height: 26, fontSize: 12 }}>{KIND_LABEL[r.kind] || r.kind}</span>
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
