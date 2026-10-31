import { Component } from 'react';
import { reportError } from '../lib/monitor.js';

// If a screen crashes, show a friendly way out instead of a blank page.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    reportError(error, { where: 'pantalla', stack: info?.componentStack?.slice(0, 1500) });
  }

  render() {
    if (!this.state.error) return this.props.children;
    // A new deploy renamed the code files: reloading picks up the new ones.
    const stale = /dynamically imported module|Loading chunk|Importing a module script failed/i.test(String(this.state.error?.message));
    return (
      <div className="page" style={{ minHeight: '70vh', display: 'grid', placeItems: 'center' }}>
        <div className="widget stack" style={{ maxWidth: 420, textAlign: 'center', alignItems: 'center', padding: '28px 22px' }}>
          <h2 className="title-lg" style={{ margin: 0 }}>{stale ? 'Hay una versión nueva' : 'Algo ha fallado'}</h2>
          <p className="muted" style={{ margin: 0 }}>{stale ? 'Recarga para verla.' : 'No es culpa tuya. Ya nos ha llegado el aviso. Prueba otra vez.'}</p>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn primary" onClick={() => window.location.reload()}>Reintentar</button>
            <a className="btn soft" href="/">Ir al inicio</a>
          </div>
        </div>
      </div>
    );
  }
}
