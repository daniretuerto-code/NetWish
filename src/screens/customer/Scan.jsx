import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import jsQR from 'jsqr';
import Icon from '../../components/Icon.jsx';
import { PageHeader, useToast } from '../../components/ui.jsx';
import { parseNetWishQR } from '../../lib/qr.js';

const routeFor = (qr) => {
  const biz = encodeURIComponent(qr.business);
  if (qr.type === 'table') return `/mesa/${biz}/${qr.table}`;
  if (qr.type === 'pay') return `/pagar/${biz}`;
  return `/negocio/${biz}`;
};

export default function Scan() {
  const navigate = useNavigate();
  const toast = useToast();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [state, setState] = useState('starting');
  const [manual, setManual] = useState('');

  useEffect(() => {
    let stream;
    let frame;
    let stopped = false;
    let lastBad = '';

    const tick = () => {
      if (stopped) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        const w = video.videoWidth;
        const h = video.videoHeight;
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(video, 0, 0, w, h);
        const code = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' });
        if (code?.data) {
          const qr = parseNetWishQR(code.data);
          if (qr) {
            stopped = true;
            navigator.vibrate?.(40);
            navigate(routeFor(qr), { replace: true });
            return;
          }
          if (code.data !== lastBad) {
            lastBad = code.data;
            toast('Este código no es de NetWish', 'error');
          }
        }
      }
      frame = requestAnimationFrame(tick);
    };

    if (!navigator.mediaDevices?.getUserMedia) {
      setState('unsupported');
      return undefined;
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((s) => {
        if (stopped) { s.getTracks().forEach((t) => t.stop()); return; }
        stream = s;
        const video = videoRef.current;
        video.srcObject = s;
        video.setAttribute('playsinline', 'true');
        return video.play().then(() => {
          setState('scanning');
          frame = requestAnimationFrame(tick);
        });
      })
      .catch(() => setState('denied'));

    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [navigate, toast]);

  const submitManual = (e) => {
    e.preventDefault();
    const value = manual.trim();
    if (!value) return;
    const qr = parseNetWishQR(value);
    navigate(qr ? routeFor(qr) : `/explorar?q=${encodeURIComponent(value)}`);
  };

  return (
    <div className="page" style={{ maxWidth: 560 }}>
      <PageHeader eyebrow="Mesa, pago o comercio" title="Escanear" />

      <div className="widget dark stack" style={{ padding: 12 }}>
        <div style={{ position: 'relative' }}>
          <video ref={videoRef} className="scan-video" muted playsInline aria-label="Cámara" />
          <canvas ref={canvasRef} hidden />
          <div aria-hidden="true" style={{ position: 'absolute', inset: '18%', border: '3px solid var(--accent)', borderRadius: 28, boxShadow: '0 0 0 999px rgba(0,0,0,.35)' }} />
          {state !== 'scanning' && (
            <div className="stack" style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 24, color: '#fff' }}>
              <Icon name="scan" size={36} />
              <strong>
                {state === 'starting' && 'Abriendo la cámara…'}
                {state === 'denied' && 'No podemos usar la cámara'}
                {state === 'unsupported' && 'Tu navegador no permite usar la cámara'}
              </strong>
              {state === 'denied' && <span className="small" style={{ opacity: 0.7 }}>Dale permiso en los ajustes del navegador o escribe el código abajo.</span>}
            </div>
          )}
        </div>
        <p className="small" style={{ textAlign: 'center', opacity: 0.7, margin: 0 }}>Apunta al código QR de la mesa o del mostrador.</p>
      </div>

      <form className="widget stack" onSubmit={submitManual}>
        <label className="eyebrow" htmlFor="manual-code">¿No funciona la cámara?</label>
        <div className="row">
          <input id="manual-code" className="input grow" placeholder="Nombre del comercio o código" value={manual} onChange={(e) => setManual(e.target.value)} />
          <button className="btn primary">Ir</button>
        </div>
      </form>
    </div>
  );
}
