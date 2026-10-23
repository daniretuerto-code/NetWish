import { useEffect, useRef, useState } from 'react';
import Icon from '../../components/Icon.jsx';
import { BackButton, Empty, Mono, PageHeader, Spinner, useToast } from '../../components/ui.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import useAsync from '../../hooks/useAsync.js';
import { businessInbox, markThreadRead, sendMessage, subscribe } from '../../lib/data.js';
import { sameName, timeAgo } from '../../lib/format.js';

function Thread({ thread, business, onBack, onSent }) {
  const toast = useToast();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const logRef = useRef(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [thread.messages.length]);

  const send = async (e) => {
    e.preventDefault();
    const body = text.trim().slice(0, 2000);
    if (!body) return;
    setSending(true);
    try {
      await sendMessage({ businessName: business.name, customerId: thread.customerId, customerName: thread.name, senderType: 'business', text: body });
      setText('');
      onSent();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="widget stack">
      <div className="row">
        <span className="hide-wide"><BackButton onClick={onBack} label="Volver a la bandeja" /></span>
        <Mono name={thread.name} image={thread.avatar} />
        <strong className="grow" style={{ fontSize: 17 }}>{thread.name}</strong>
      </div>
      <div className="chat-log" ref={logRef} aria-live="polite">
        {thread.messages.map((m) => (
          <div key={m.id} className={`bubble ${m.sender_type === 'business' ? 'mine' : ''}`} style={m.sender_type === 'business' ? undefined : { background: 'var(--bg)' }}>
            {m.text}
            <div className="small" style={{ opacity: 0.55, marginTop: 2, textAlign: 'right' }}>{timeAgo(m.created_at)}</div>
          </div>
        ))}
      </div>
      {thread.customerId ? (
        <form className="row" onSubmit={send}>
          <input className="input grow" placeholder={`Responder a ${thread.name}`} value={text} onChange={(e) => setText(e.target.value)} aria-label="Respuesta" />
          <button className="icon-btn" style={{ background: 'var(--ink)', color: 'var(--accent)', width: 50, height: 50 }} disabled={sending || !text.trim()} aria-label="Enviar">
            <Icon name="send" size={20} />
          </button>
        </form>
      ) : (
        <p className="small muted" style={{ margin: 0 }}>Conversación de la versión anterior de NetWish. Cuando este cliente vuelva a escribir podrás responderle aquí.</p>
      )}
    </div>
  );
}

export default function Messages() {
  const { business } = useAuth();
  const [openKey, setOpenKey] = useState(null);
  const { data, loading, reload } = useAsync(() => businessInbox(business.name), [business.name]);

  useEffect(() => subscribe('messages', (p) => {
    if (sameName(p.new?.business_name, business.name)) reload();
  }), [business.name, reload]);

  const threads = data || [];
  const open = threads.find((t) => t.key === openKey);

  useEffect(() => {
    if (open?.unread && open.customerId) markThreadRead(business.name, open.customerId).then(reload);
  }, [open?.key, open?.unread, open?.customerId, business.name, reload]);

  if (loading && !data) return <Spinner />;

  return (
    <div className="page">
      <PageHeader eyebrow={business.name} title="Mensajes" />
      {threads.length === 0 ? (
        <div className="widget"><Empty icon="chat" title="Sin mensajes todavía">Cuando un cliente te escriba desde tu ficha, lo verás aquí.</Empty></div>
      ) : (
        <div className="two-col inbox">
          <div className={`widget ${open ? 'hide-narrow' : ''}`} style={{ paddingBottom: 4 }}>
            {threads.map((t) => (
              <button key={t.key} className="list-row" onClick={() => setOpenKey(t.key)} aria-current={t.key === openKey}>
                <Mono name={t.name} image={t.avatar} />
                <span className="grow stack" style={{ gap: 1, minWidth: 0 }}>
                  <span className="row between"><span className="t">{t.name}</span><span className="small muted">{timeAgo(t.last.created_at)}</span></span>
                  <span className="s" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: t.unread ? 700 : 400, color: t.unread ? 'var(--ink)' : undefined }}>{t.last.text}</span>
                </span>
                {t.unread > 0 && <span className="count-badge accent">{t.unread}</span>}
              </button>
            ))}
          </div>
          <div className={open ? '' : 'hide-narrow'}>
            {open ? (
              <Thread thread={open} business={business} onBack={() => setOpenKey(null)} onSent={reload} />
            ) : (
              <div className="widget"><Empty icon="chat" title="Elige una conversación" /></div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
