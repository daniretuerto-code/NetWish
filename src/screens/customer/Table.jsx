import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { BackButton, Empty, Spinner, Stepper, useToast } from '../../components/ui.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useCart } from '../../context/CartContext.jsx';
import useAsync from '../../hooks/useAsync.js';
import { addItemsToTable, findBusiness, getRestaurantSettings, listProducts, openTableSession, subscribe } from '../../lib/data.js';
import { modulesFor } from '../../lib/questionnaire.js';
import { money, sameName } from '../../lib/format.js';

export default function Table() {
  const { name, table: tableParam } = useParams();
  const table = parseInt(tableParam, 10) || 1;
  const { displayName } = useAuth();
  const cart = useCart();
  const toast = useToast();
  const [session, setSession] = useState(null);
  const [sending, setSending] = useState(false);
  const cartaRef = useRef(null);

  const { data, loading } = useAsync(async () => {
    const biz = await findBusiness(name);
    const bizName = biz?.name || name;
    const [products, open, settings] = await Promise.all([listProducts(bizName), openTableSession(bizName, table), getRestaurantSettings(bizName)]);
    return { biz, bizName, products, open, canOrder: modulesFor(settings.profile).pedidosQr };
  }, [name, table]);

  useEffect(() => {
    if (data) setSession(data.open || null);
  }, [data]);

  useEffect(() => {
    if (!data) return undefined;
    return subscribe('table_sessions', (payload) => {
      const row = payload.new;
      if (row && sameName(row.business_name, data.bizName) && Number(row.table_number) === table) {
        setSession(row.status === 'closed' ? null : row);
      }
    }, `table_number=eq.${table}`);
  }, [data, table]);

  const roundKey = `${data?.bizName || name}#mesa${table}`;
  const round = cart.cartFor(roundKey);

  const bill = useMemo(() => {
    const map = new Map();
    for (const i of session?.items || []) {
      const k = i.name;
      const prev = map.get(k) || { name: i.name, qty: 0, total: 0 };
      prev.qty += Number(i.qty) || 1;
      prev.total += (Number(i.price) || 0) * (Number(i.qty) || 1);
      map.set(k, prev);
    }
    return [...map.values()];
  }, [session]);

  if (loading) return <Spinner />;
  const { bizName, products, canOrder } = data;

  const send = async () => {
    setSending(true);
    try {
      const updated = await addItemsToTable(bizName, table, round.items, displayName);
      setSession(updated);
      cart.clear(roundKey);
      toast('¡Comanda enviada a cocina!');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setSending(false);
    }
  };

  const total = Number(session?.total_amount) || 0;
  const paid = Number(session?.paid_amount) || 0;
  const remaining = Number(session?.remaining_amount) || 0;
  const status = !session ? 'Mesa libre' : session.status === 'paid' ? 'Cuenta cerrada' : 'En cocina';
  const step = !session ? 0 : session.status === 'paid' ? 3 : 2;

  return (
    <div className="page" style={{ paddingBottom: round.count || remaining > 0 ? 120 : undefined }}>
      <div className="row">
        <BackButton to="/" />
        <div className="stack" style={{ gap: 0 }}>
          <span className="eyebrow">{bizName}</span>
          <h1 className="title-xl">Mesa {table}</h1>
        </div>
      </div>

      <div className="two-col">
        <div className="stack">
          <div className="widget dark stack" style={{ gap: 14 }}>
            <div className="row between" style={{ alignItems: 'flex-start' }}>
              <span className="stack" style={{ gap: 2 }}>
                <span className="eyebrow">Tu mesa</span>
                <span style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em' }}>{status}</span>
              </span>
              {session && <span className="price" style={{ color: 'var(--accent)', fontSize: 15 }}>{money(total)}</span>}
            </div>
            <div className="progress-steps">
              {[1, 2, 3].map((n) => <span key={n} className={step >= n ? 'on' : ''} />)}
            </div>
            <div className="progress-steps small" style={{ color: 'rgba(255,255,255,.6)' }}>
              <span style={{ background: 'none', height: 'auto' }}>Pedido</span>
              <span style={{ background: 'none', height: 'auto', color: step === 2 ? '#fff' : undefined, fontWeight: step === 2 ? 700 : 400 }}>En cocina</span>
              <span style={{ background: 'none', height: 'auto', color: step === 3 ? '#fff' : undefined, fontWeight: step === 3 ? 700 : 400 }}>Cuenta</span>
            </div>
          </div>

          {session && (
            <div className="widget" style={{ paddingBottom: 4 }}>
              <h2 className="title-lg">Cuenta</h2>
              {bill.map((l) => (
                <div key={l.name} className="list-row">
                  <span className="grow" style={{ fontSize: 15 }}>{l.qty} × {l.name}</span>
                  <span className="price" style={{ fontSize: 15 }}>{money(l.total)}</span>
                </div>
              ))}
              {(session.payers || []).map((p, i) => (
                <div key={i} className="list-row">
                  <span className="grow small muted">Pagado por {p.name} · {p.time}</span>
                  <span className="price small" style={{ color: 'var(--ok)' }}>−{money(p.amount)}</span>
                </div>
              ))}
              <div className="row between" style={{ padding: '10px 0' }}>
                <span className="muted">{paid > 0 ? 'Pendiente' : 'Total mesa'}</span>
                <span className="title-md price">{money(remaining)}</span>
              </div>
            </div>
          )}
        </div>

        <div className="stack" ref={cartaRef}>
          <div className="widget" style={{ paddingBottom: 4 }}>
            <h2 className="title-lg">{canOrder ? 'Pedir' : 'Carta'}</h2>
            {!canOrder && <p className="small muted" style={{ margin: '4px 0 0' }}>Pide al camarero cuando quieras.</p>}
            {products.length === 0 ? (
              <Empty icon="book" title="La carta aún no está disponible" />
            ) : products.map((p) => (
              <div key={p.id} className="list-row">
                <span className="grow stack" style={{ gap: 1 }}>
                  <span className="t">{p.name}</span>
                  <span className="s price">{money(p.price)}</span>
                </span>
                {canOrder ? <Stepper qty={round.qtyOf(p.id)} onAdd={() => cart.add(roundKey, p)} onRemove={() => cart.remove(roundKey, p)} /> : null}
              </div>
            ))}
          </div>
        </div>
      </div>

      {round.count > 0 ? (
        <button className="cta-bar" onClick={send} disabled={sending}>
          <span style={{ fontSize: 15, opacity: 0.7 }}>{round.count} · {money(round.total)}</span>
          <span className="go">{sending ? 'Enviando…' : 'Enviar a cocina'}</span>
        </button>
      ) : remaining > 0 ? (
        <div className="cta-bar" role="status">
          <span style={{ fontSize: 15, opacity: 0.7 }}>Total {money(remaining)}</span>
          <span className="go">Pide la cuenta al camarero</span>
        </div>
      ) : null}
    </div>
  );
}
