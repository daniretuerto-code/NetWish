import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import Icon from '../../components/Icon.jsx';
import { PageHeader, Sheet, Spinner, useToast } from '../../components/ui.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import useAsync from '../../hooks/useAsync.js';
import { getRestaurantSettings, saveRestaurantSettings } from '../../lib/data.js';
import { tableUrl } from '../../lib/qr.js';
import { tableMin } from '../../lib/agenda.js';
import { placeTables, zonesOf } from '../../lib/floor.js';
import FloorEditor from './FloorEditor.jsx';

function QrImage({ text, size = 440 }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(text, { margin: 1, width: size, errorCorrectionLevel: 'M' }).then((url) => alive && setSrc(url));
    return () => { alive = false; };
  }, [text, size]);
  return src ? <img src={src} alt={`Código QR: ${text}`} /> : <div className="spinner" />;
}

function QrSheet({ table, business, onClose }) {
  if (!table) return null;
  const url = tableUrl(business.name, table.table_number);
  return (
    <Sheet open onClose={onClose} title={`Mesa ${table.table_number}`}>
      <div className="stack printable" style={{ alignItems: 'center', textAlign: 'center' }}>
        <div className="qr-box"><QrImage text={url} /></div>
        <strong style={{ fontSize: 22 }}>{business.name} · Mesa {table.table_number}</strong>
        <span className="small muted">Escanea para ver la carta y pedir desde tu móvil</span>
      </div>
      <div className="row" style={{ marginTop: 14 }}>
        <button className="btn primary grow" onClick={() => window.print()}><Icon name="printer" size={18} /> Imprimir</button>
        <a className="btn soft grow" href={url} target="_blank" rel="noreferrer">Probar</a>
      </div>
    </Sheet>
  );
}

export default function Tables() {
  const { business } = useAuth();
  const toast = useToast();
  const [qrTable, setQrTable] = useState(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [view, setView] = useState('plano');
  const { data, loading, setData } = useAsync(() => getRestaurantSettings(business.name), [business.name]);

  if (loading && !data) return <Spinner />;
  const floorZones = zonesOf(data);
  const items = data.floor?.items || [];
  const tables = placeTables(data.tables || [], floorZones, items);
  const zones = [...new Set([...floorZones.map((z) => z.name), 'Terraza'])];

  const change = (patch) => { setData({ ...data, ...patch }); setDirty(true); };
  const setTable = (i, patch) => change({ tables: tables.map((t, j) => (j === i ? { ...t, ...patch } : t)) });
  const addTable = () => {
    const next = tables.reduce((m, t) => Math.max(m, Number(t.table_number) || 0), 0) + 1;
    change({ tables: [...tables, { id: next, table_number: next, capacity: 4, zone: floorZones[0].name }] });
  };
  const removeTable = (i) => change({ tables: tables.filter((_, j) => j !== i) });

  const save = async () => {
    const numbers = tables.map((t) => Number(t.table_number));
    if (new Set(numbers).size !== numbers.length) {
      toast('Hay dos mesas con el mismo número', 'error');
      return;
    }
    setBusy(true);
    try {
      const { lunch_start, lunch_end, dinner_start, dinner_end, turn_duration_min } = data;
      await saveRestaurantSettings(business.name, {
        lunch_start, lunch_end, dinner_start, dinner_end,
        turn_duration_min: Number(turn_duration_min) || 90,
        tables: tables.map((t) => {
          const capacity = Number(t.capacity) || 2;
          return {
            ...t,
            table_number: Number(t.table_number),
            capacity,
            min: Math.min(capacity, Math.max(1, Number(t.min) || tableMin({ capacity }))),
            join: (t.join || []).map(Number).filter((n) => numbers.includes(n)),
          };
        }),
        floor: { zones: zonesOf({ ...data, tables }), items },
      });
      setDirty(false);
      toast('Sala guardada');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const time = (k, label) => (
    <div className="field">
      <label htmlFor={`h-${k}`}>{label}</label>
      <input id={`h-${k}`} className="input" type="time" value={data[k] || ''} onChange={(e) => change({ [k]: e.target.value })} />
    </div>
  );

  return (
    <div className="page" style={{ paddingBottom: dirty ? 200 : undefined }}>
      <PageHeader eyebrow={business.name} title="Tu sala" right={view === 'lista' ? <button className="btn primary sm" onClick={addTable}><Icon name="plus" size={16} /> Mesa</button> : null} />

      <div className="segmented" role="tablist" aria-label="Vista">
        <button role="tab" aria-selected={view === 'plano'} onClick={() => setView('plano')}>Plano</button>
        <button role="tab" aria-selected={view === 'lista'} onClick={() => setView('lista')}>Lista, QR y horario</button>
      </div>

      {view === 'plano' && (
        <FloorEditor tables={tables} zones={floorZones} items={items} onQr={setQrTable} dirty={dirty} onSave={save} busy={busy}
          onChange={(next) => change({ tables: next.tables, floor: { zones: next.zones, items: next.items } })} />
      )}

      {view === 'lista' && (<>
      <p className="small muted" style={{ margin: '0 4px' }}>Cada mesa se ofrece solo a grupos de su tamaño: así una pareja no ocupa la mesa de 6. Desmarca "online" en las mesas que guardas para quien llega sin reservar.</p>
      <div className="table-grid">
        {tables.map((t, i) => (
          <div key={`${t.id}-${i}`} className="widget stack" style={{ gap: 10, padding: 16 }}>
            <div className="row between">
              <span className="row" style={{ gap: 4 }}>
                <span className="small muted">Mesa</span>
                <input className="input" aria-label="Número de mesa" style={{ width: 64, height: 40, fontWeight: 800, fontSize: 18 }} inputMode="numeric" value={t.table_number} onChange={(e) => setTable(i, { table_number: e.target.value.replace(/\D/g, '') })} />
              </span>
              <button className="icon-btn" onClick={() => removeTable(i)} aria-label={`Quitar mesa ${t.table_number}`}><Icon name="trash" size={18} /></button>
            </div>
            <div className="row" style={{ gap: 6 }}>
              <label className="small muted" htmlFor={`min-${i}`}>De</label>
              <input id={`min-${i}`} className="input" style={{ height: 40, width: 54, padding: '0 4px', textAlign: 'center', fontWeight: 800 }} type="number" min={1} max={t.capacity} value={t.min ?? tableMin(t)} onChange={(e) => setTable(i, { min: e.target.value })} aria-label={`Mínimo de personas en la mesa ${t.table_number}`} />
              <label className="small muted" htmlFor={`cap-${i}`}>a</label>
              <input id={`cap-${i}`} className="input" style={{ height: 40, width: 54, padding: '0 4px', textAlign: 'center', fontWeight: 800 }} type="number" min={1} max={30} value={t.capacity} onChange={(e) => setTable(i, { capacity: e.target.value })} aria-label={`Máximo de personas en la mesa ${t.table_number}`} />
            </div>
            <label className="row small" style={{ gap: 8, fontWeight: 600, cursor: 'pointer' }}>
              <input type="checkbox" checked={t.online !== false} onChange={(e) => setTable(i, { online: e.target.checked })} style={{ width: 20, height: 20, accentColor: 'var(--ink)' }} />
              Se puede reservar online
            </label>
            <select className="input" style={{ height: 40 }} aria-label="Zona" value={t.zone || 'Sala Principal'} onChange={(e) => setTable(i, { zone: e.target.value })}>
              {zones.map((z) => <option key={z}>{z}</option>)}
            </select>
            <button className="btn soft sm" onClick={() => setQrTable(t)}><Icon name="qr" size={16} /> Ver QR</button>
          </div>
        ))}
      </div>

      <div className="widget stack">
        <h2 className="title-lg">Horario de reservas</h2>
        <div className="bento">{time('lunch_start', 'Comidas desde')}{time('lunch_end', 'Comidas hasta')}</div>
        <div className="bento">{time('dinner_start', 'Cenas desde')}{time('dinner_end', 'Cenas hasta')}</div>
        <div className="field">
          <label htmlFor="turn">Duración de cada turno (minutos)</label>
          <input id="turn" className="input" type="number" min={30} max={240} step={15} value={data.turn_duration_min} onChange={(e) => change({ turn_duration_min: e.target.value })} />
        </div>
      </div>
      </>)}

      {dirty && (
        <button className="cta-bar above-tabs" onClick={save} disabled={busy}>
          <span style={{ fontSize: 14, opacity: 0.7 }}>Cambios sin guardar</span>
          <span className="go">{busy ? 'Guardando…' : 'Guardar'}</span>
        </button>
      )}

      <QrSheet table={qrTable} business={business} onClose={() => setQrTable(null)} />
    </div>
  );
}
