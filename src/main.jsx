import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { CartProvider } from './context/CartContext.jsx';
import { ToastProvider } from './components/ui.jsx';
import { readAccessParam } from './lib/launch.js';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { watchErrors } from './lib/monitor.js';
import { registerServiceWorker } from './lib/push.js';
import { captureChannel } from './lib/channel.js';
import './styles.css';

readAccessParam();
watchErrors();
registerServiceWorker();
captureChannel();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <CartProvider>
            <App />
          </CartProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
);
