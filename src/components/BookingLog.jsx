import { useEffect, useState } from 'react';
import { bookingHistory } from '../lib/data.js';
import { channelLabel } from '../lib/channel.js';

// Who created, confirmed, moved or cancelled this booking, and when.
export default function BookingLog({ order }) {
  const [list, setList] = useState(null);
  useEffect(() => {
    let alive = true;
    bookingHistory(order.id).then((l) => alive && setList(l));
    return () => { alive = false; };
  }, [order.id, order.status, order.time, order.date]);
  const from = order.source && order.source !== 'app' ? channelLabel(order.source === 'telefono' ? 'telefono' : order.source) : order.channel ? channelLabel(order.channel) : null;
  if (!list?.length && !from) return null;
  return (
    <details className="widget" style={{ marginTop: 10, padding: '10px 14px' }}>
      <summary className="small" style={{ fontWeight: 700, cursor: 'pointer' }}>Historial{from ? ` · llegó por ${from}` : ''}</summary>
      <div className="stack" style={{ gap: 4, marginTop: 8 }}>
        {(list || []).map((e, i) => (
          <span key={i} className="small">
            <span className="muted">{new Date(e.at).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · {e.actor}:</span> {e.what}
          </span>
        ))}
      </div>
    </details>
  );
}
