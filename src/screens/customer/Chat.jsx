import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import { BackButton, Empty, Mono, Spinner, useToast } from '../../components/ui.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import useAsync from '../../hooks/useAsync.js';
import { conversation, findBusiness, sendMessage, subscribe } from '../../lib/data.js';
import { sameName } from '../../lib/format.js';

export default function Chat() {
  const { name } = useParams();
  const { user, displayName, avatar } = useAuth();
  const toast = useToast();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const logRef = useRef(null);

  const { data, loading, setData } = useAsync(async () => {
    if (!user) return null;
    const biz = await findBusiness(name);
    const bizName = biz?.name || name;
    return { biz, bizName, messages: await conversation(bizName, user.id) };
  }, [name, user?.id]);

  useEffect(() => {
    if (!data || !user) return undefined;
    return subscribe('messages', (payload) => {
      const m = payload.new;
      if (!m || payload.eventType !== 'INSERT' || !sameName(m.business_name, data.bizName)) return;
      setData({ ...data, messages: data.messages.some((x) => x.id === m.id) ? data.messages : [...data.messages, m] });
    }, `customer_id=eq.${user.id}`);
  }, [data, user, setData]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [data?.messages?.length]);

  if (!user) {
    return (
      <div className="page" style={{ maxWidth: 640 }}>
        <div className="row"><BackButton /></div>
        <div className="widget">
          <Empty icon="chat" title={`Inicia sesión para escribir a ${name}`}>
            <Link to="/cuenta" className="btn primary" style={{ marginTop: 8 }}>Entrar o crear cuenta</Link>
          </Empty>
        </div>
      </div>
    );
  }

  if (loading && !data) return <Spinner />;
  const { biz, bizName, messages } = data;

  const send = async (e) => {
    e.preventDefault();
    const body = text.trim().slice(0, 2000);
    if (!body) return;
    setSending(true);
    try {
      await sendMessage({ businessName: bizName, customerId: user.id, customerName: displayName, senderType: 'customer', text: body, avatarUrl: avatar });
      setText('');
      setData({ ...data, messages: await conversation(bizName, user.id) });
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="page" style={{ maxWidth: 720 }}>
      <div className="row">
        <BackButton />
        <Mono name={bizName} image={biz?.image} />
        <span className="grow stack" style={{ gap: 0 }}>
          <strong style={{ fontSize: 17 }}>{bizName}</strong>
          <span className="small muted">Suele responder en el día</span>
        </span>
      </div>

      <div className="widget stack">
        <div className="chat-log" ref={logRef} aria-live="polite">
          {messages.length === 0 && <Empty icon="chat" title="Empieza la conversación">Pregunta por un producto, una reserva o lo que necesites.</Empty>}
          {messages.map((m) => (
            <div key={m.id} className={`bubble ${m.sender_type === 'customer' ? 'mine' : ''}`}>
              {m.text}
              <div className="small" style={{ opacity: 0.55, marginTop: 2, textAlign: 'right' }}>
                {new Date(m.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          ))}
        </div>
        <form className="row" onSubmit={send}>
          <input className="input grow" placeholder="Escribe un mensaje" value={text} onChange={(e) => setText(e.target.value)} aria-label="Mensaje" />
          <button className="icon-btn" style={{ background: 'var(--ink)', color: 'var(--accent)', width: 50, height: 50 }} disabled={sending || !text.trim()} aria-label="Enviar">
            <Icon name="send" size={20} />
          </button>
        </form>
      </div>
    </div>
  );
}
