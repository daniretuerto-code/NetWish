import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import { Empty, Spinner, useToast } from '../../components/ui.jsx';
import { rateVisit } from '../../lib/data.js';

const FACES = ['', 'Mal', 'Regular', 'Bien', 'Muy bien', 'Genial'];

// netwish.es/opinion/:token?n=4 — the survey e-mail. The number tapped in the e-mail is saved
// on arrival; 4 or 5 goes on to Google, 1 to 3 stays with the restaurant.
export default function Opinion() {
  const { token } = useParams();
  const [params] = useSearchParams();
  const toast = useToast();
  const [visit, setVisit] = useState(undefined);
  const [comment, setComment] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const n = Number(params.get('n'));
    rateVisit(token, n >= 1 && n <= 5 ? n : null).then(setVisit).catch(() => setVisit(null));
  }, [token]);

  const rate = async (n, text = null) => {
    setBusy(true);
    try {
      setVisit(await rateVisit(token, n, text));
      if (text) setSent(true);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  if (visit === undefined) return <Spinner />;
  if (!visit) return <div className="page"><Empty icon="heart" title="No encontramos esta visita">Puede que el enlace esté incompleto.</Empty></div>;

  const n = visit.rating;
  return (
    <div className="page" style={{ maxWidth: 560 }}>
      <div className="widget dark stack" style={{ gap: 6 }}>
        <span className="eyebrow" style={{ color: 'var(--accent)' }}>Tu opinión</span>
        <h1 className="title-xl" style={{ color: '#fff' }}>{visit.business_name}</h1>
        <span className="small" style={{ opacity: 0.7 }}>¿Qué tal fue, {visit.customer}?</span>
      </div>

      <div className="widget stack" style={{ gap: 12 }}>
        <div className="row" style={{ gap: 8, justifyContent: 'center' }}>
          {[1, 2, 3, 4, 5].map((k) => (
            <button key={k} className="btn" disabled={busy} aria-pressed={n === k} onClick={() => rate(k)}
              style={{ width: 52, height: 52, padding: 0, fontSize: 20, fontWeight: 800, borderRadius: 16, background: n === k ? 'var(--ink)' : 'var(--bg)', color: n === k ? 'var(--accent)' : 'var(--ink)' }}>
              {k}
            </button>
          ))}
        </div>
        {n ? <strong style={{ textAlign: 'center' }}>{FACES[n]}. ¡Gracias!</strong> : <span className="small muted" style={{ textAlign: 'center' }}>Toca una nota del 1 al 5</span>}
      </div>

      {n >= 4 && visit.review_url && (
        <div className="widget stack" style={{ gap: 10, alignItems: 'center', textAlign: 'center' }}>
          <h2 className="title-lg">¿Nos ayudas con una reseña?</h2>
          <p className="muted" style={{ margin: 0 }}>A {visit.business_name} le cambia el mes que la gente cuente que le gustó. Te lleva 30 segundos.</p>
          <a className="btn primary block" href={visit.review_url} target="_blank" rel="noreferrer"><Icon name="google" size={18} /> Dejar reseña en Google</a>
        </div>
      )}

      {n > 0 && n <= 3 && (
        sent || visit.comment ? (
          <div className="widget stack" style={{ alignItems: 'center', textAlign: 'center' }}>
            <h2 className="title-lg">Gracias por contárnoslo</h2>
            <p className="muted" style={{ margin: 0 }}>Se lo hemos pasado a {visit.business_name}. Puede que se pongan en contacto contigo.</p>
          </div>
        ) : (
          <form className="widget stack" style={{ gap: 10 }} onSubmit={(e) => { e.preventDefault(); if (comment.trim()) rate(n, comment.trim()); }}>
            <h2 className="title-md">¿Qué podemos mejorar?</h2>
            <p className="small muted" style={{ margin: 0 }}>Solo lo leerá el restaurante, no se publica.</p>
            <textarea className="input" rows={4} maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Cuéntanos qué pasó" aria-label="Comentario" />
            <button className="btn primary block" disabled={busy || !comment.trim()}>Enviar</button>
          </form>
        )
      )}

      <Link to={`/negocio/${encodeURIComponent(visit.business_name)}`} className="btn soft block">Ver {visit.business_name}</Link>
    </div>
  );
}
