import { useEffect, useState } from 'react';
import { joinLaunchList } from '../../lib/data.js';

const DONE_KEY = 'netwish_avisame';

// The public face of netwish.es until launch: what is coming and a field to be told when it opens.
export default function ComingSoon() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState(() => {
    try { return localStorage.getItem(DONE_KEY) ? 'done' : 'idle'; } catch { return 'idle'; }
  });
  const [error, setError] = useState('');

  // Black status bar while this screen is up.
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    const before = meta?.getAttribute('content');
    meta?.setAttribute('content', '#0B0B0A');
    document.body.classList.add('soon-body');
    return () => { if (before) meta?.setAttribute('content', before); document.body.classList.remove('soon-body'); };
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) { setError('Escribe un correo válido'); return; }
    setState('sending');
    try {
      const source = new URLSearchParams(window.location.search).get('utm_source') || (document.referrer ? new URL(document.referrer).hostname : '');
      await joinLaunchList(email.trim(), source);
      try { localStorage.setItem(DONE_KEY, '1'); } catch { /* storage unavailable */ }
      setState('done');
    } catch (err) {
      setError(err.message || 'No se pudo guardar. Prueba otra vez.');
      setState('idle');
    }
  };

  return (
    <main className="soon">
      <div className="soon-glow" aria-hidden="true" />
      <header className="soon-top">
        <img src="/logo-blanco.svg" alt="NetWish" className="soon-logo" />
        <span className="soon-badge"><span className="soon-dot" />Muy pronto</span>
      </header>

      <section className="soon-hero">
        <p className="soon-eyebrow">Palencia · 2026</p>
        <h1 className="soon-title">Tu ciudad,<br />a un toque.</h1>
        <p className="soon-lead">Reserva mesa en tus restaurantes, cita en tu peluquería y descubre los comercios de Palencia. Todo en un mismo sitio, sin llamadas ni esperas.</p>

        {state === 'done' ? (
          <div className="soon-done" role="status">
            <span className="soon-check" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="20" height="20"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
            <span><strong>Estás dentro.</strong><br />Te escribiremos el día que abramos.</span>
          </div>
        ) : (
          <form className="soon-form" onSubmit={submit} noValidate>
            <label className="sr-only" htmlFor="soon-email">Tu correo</label>
            <input
              id="soon-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="Tu correo electrónico"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={state === 'sending'}
            />
            <button type="submit" disabled={state === 'sending'}>{state === 'sending' ? 'Guardando…' : 'Avísame'}</button>
          </form>
        )}
        {error && <p className="soon-error" role="alert">{error}</p>}
        {state !== 'done' && <p className="soon-note">Solo un correo, el día del lanzamiento. Nada de spam.</p>}
      </section>

      <ul className="soon-chips" aria-label="Lo que podrás hacer">
        <li><span>🍽️</span>Restaurantes</li>
        <li><span>✂️</span>Peluquerías</li>
        <li><span>🛍️</span>Comercios</li>
      </ul>

      <footer className="soon-foot">
        <a href="https://instagram.com/netwish.palencia" target="_blank" rel="noreferrer">@netwish.palencia</a>
      </footer>
    </main>
  );
}
