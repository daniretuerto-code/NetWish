import { useEffect, useState } from 'react';
import { Empty, PageHeader, Skeleton, Spinner, useToast } from '../../components/ui.jsx';
import SectionTabs from '../../components/SectionTabs.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import useAsync from '../../hooks/useAsync.js';
import { closeTableSession, kitchenSessions, subscribe } from '../../lib/data.js';
import { money, sameName, timeAgo } from '../../lib/format.js';

const grouped = (items) => {
  const map = new Map();
  for (const i of items || []) {
    const prev = map.get(i.name) || 0;
    map.set(i.name, prev + (Number(i.qty) || 1));
  }
  return [...map.entries()];
};

export default function Kitchen() {
  const { business } = useAuth();
  const toast = useToast();
  const [closing, setClosing] = useState(null);
  const [, tick] = useState(0);
  const { data, loading, reload, setData } = useAsync(() => kitchenSessions(business.name), [business.name]);

  useEffect(() => subscribe('table_sessions', (p) => {
    if (sameName(p.new?.business_name || p.old?.business_name, business.name)) reload();
  }), [business.name, reload]);

  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30000);
    return () => clearInterval(id);
  }, []);

  if (loading && !data) return <Skeleton />;
  const sessions = data || [];

  const close = async (s) => {
    setClosing(s.id);
    try {
      await closeTableSession(s.id);
      setData(sessions.filter((x) => x.id !== s.id));
      toast(`Mesa ${s.table_number} liberada`);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setClosing(null);
    }
  };

  return (
    <div className="page">
      <PageHeader eyebrow="En directo" title="Cocina" right={<span className="row small" style={{ gap: 6, fontWeight: 600 }}><span className="status-dot" /> {sessions.length} mesas</span>} />
      <SectionTabs />

      {sessions.length === 0 ? (
        <div className="widget"><Empty icon="flame" title="No hay mesas abiertas">Las comandas que envíen tus clientes desde el QR de la mesa aparecerán aquí.</Empty></div>
      ) : (
        <div className="cards-grid">
          {sessions.map((s) => {
            const paid = s.status === 'paid';
            return (
              <article key={s.id} className={`widget stack ${paid ? '' : 'dark'}`} style={{ gap: 12 }}>
                <div className="row between" style={{ alignItems: 'flex-start' }}>
                  <span className="stack" style={{ gap: 0 }}>
                    <span className="eyebrow" style={paid ? undefined : { color: 'rgba(255,255,255,.6)' }}>Abierta {timeAgo(s.created_at)}</span>
                    <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.03em' }}>Mesa {s.table_number}</span>
                  </span>
                  <span className="status lg" style={{ background: paid ? 'var(--accent)' : 'rgba(255,255,255,.14)', color: paid ? 'var(--ink)' : '#fff' }}>
                    {paid ? 'Cerrada' : money(s.remaining_amount)}
                  </span>
                </div>
                <div className="stack" style={{ gap: 6 }}>
                  {grouped(s.items).map(([name, qty]) => (
                    <div key={name} className="row" style={{ gap: 10, fontSize: 17 }}>
                      <span className="count-badge" style={paid ? undefined : { background: 'var(--accent)', color: 'var(--ink)' }}>{qty}</span>
                      <span style={{ fontWeight: 600 }}>{name}</span>
                    </div>
                  ))}
                </div>
                <div className="row between">
                  <span className="small" style={{ opacity: 0.7 }}>Total {money(s.total_amount)}</span>
                  <button className={`btn sm ${paid ? 'primary' : 'accent'}`} disabled={closing === s.id} onClick={() => close(s)}>
                    {paid ? 'Liberar mesa' : 'Cerrar y liberar'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
