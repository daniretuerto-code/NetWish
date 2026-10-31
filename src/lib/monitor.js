// Errors from people's phones reach us (api/report-error → Telegram), so we hear about a
// failure before the business does. At most 5 per page load, never the same one twice.
const seen = new Set();

export function reportError(error, extra = {}) {
  try {
    const message = String(error?.message || error || '').slice(0, 500);
    if (!message || seen.has(message) || seen.size >= 5) return;
    // Noise from browser extensions and cancelled requests.
    if (/ResizeObserver|extension:\/\/|AbortError|Load failed$/i.test(message)) return;
    seen.add(message);
    const body = JSON.stringify({ message, stack: String(error?.stack || '').slice(0, 1500), path: window.location.pathname, ua: navigator.userAgent.slice(0, 200), ...extra });
    if (navigator.sendBeacon) navigator.sendBeacon('/api/report-error', new Blob([body], { type: 'application/json' }));
    else fetch('/api/report-error', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
  } catch { /* never break the page while reporting */ }
}

export function watchErrors() {
  window.addEventListener('error', (e) => reportError(e.error || e.message));
  window.addEventListener('unhandledrejection', (e) => reportError(e.reason));
}
