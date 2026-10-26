import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { marketingUnsubscribe } from '../../lib/data.js';

// netwish.es/baja — the "no quiero recibir más" link at the foot of a restaurant's e-mails.
export default function Unsubscribe() {
  const [params] = useSearchParams();
  const business = params.get('n') || '';
  const [state, setState] = useState('ask');
  const go = async () => {
    setState('busy');
    try {
      await marketingUnsubscribe(business, params.get('e') || '', params.get('s') || '');
      setState('done');
    } catch {
      setState('error');
    }
  };
  return (
    <div className="page" style={{ maxWidth: 560 }}>
      <div className="widget stack" style={{ gap: 10, alignItems: 'center', textAlign: 'center' }}>
        {state === 'done' ? (
          <>
            <h1 className="title-lg">Hecho</h1>
            <p className="muted" style={{ margin: 0 }}>No recibirás más novedades de {business}. Los avisos de tus reservas te seguirán llegando.</p>
          </>
        ) : state === 'error' ? (
          <>
            <h1 className="title-lg">El enlace no es válido</h1>
            <p className="muted" style={{ margin: 0 }}>Abre otra vez el enlace desde el correo, sin cambiarlo, o pide al restaurante que te quite de su lista.</p>
          </>
        ) : (
          <>
            <h1 className="title-lg">¿Dejar de recibir correos de {business}?</h1>
            <p className="muted" style={{ margin: 0 }}>Solo dejarás de recibir sus novedades y ofertas. Los avisos de tus reservas te seguirán llegando.</p>
            <button className="btn primary block" disabled={state === 'busy'} onClick={go}>Sí, darme de baja</button>
          </>
        )}
      </div>
    </div>
  );
}
