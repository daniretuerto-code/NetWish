import { useEffect, useState } from 'react';
import { businessReviews } from '../lib/data.js';

const stars = (n) => '★★★★★'.slice(0, Math.round(n)) + '☆☆☆☆☆'.slice(0, 5 - Math.round(n));

// The average from the survey sent after each visit, and the last good comments.
// Shows nothing until a place has at least 3 ratings.
export default function Reviews({ biz }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    let alive = true;
    businessReviews(biz.name).then((d) => alive && setData(d)).catch(() => {});
    return () => { alive = false; };
  }, [biz.name]);
  if (!data?.rating) return null;
  const { rating, reviews } = data;
  return (
    <section className="widget stack" style={{ gap: 10 }} aria-label="Opiniones">
      <div className="row" style={{ gap: 12 }}>
        <span style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1 }}>{String(rating.rating).replace('.', ',')}</span>
        <span className="stack" style={{ gap: 0 }}>
          <span style={{ color: '#E8A21B', letterSpacing: 2 }} aria-hidden="true">{stars(rating.rating)}</span>
          <span className="small muted">{rating.reviews} opiniones de clientes que fueron con NetWish</span>
        </span>
      </div>
      {reviews.slice(0, 3).map((r, i) => (
        <blockquote key={i} style={{ margin: 0, padding: '10px 14px', background: 'var(--bg)', borderRadius: 16 }}>
          <p className="small" style={{ margin: 0 }}>“{r.comment}”</p>
          <span className="small muted">{r.name} · {'★'.repeat(r.rating)}</span>
        </blockquote>
      ))}
    </section>
  );
}
