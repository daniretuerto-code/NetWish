// Where did this customer come from? Instagram, Google, a QR on the table, the
// restaurant's own website… Kept for this visit and stamped on the booking, so the
// business sees in its numbers what NetWish brings in.
const KEY = 'netwish.via';

const FROM_REFERRER = [
  [/instagram\./, 'instagram'], [/facebook\.|fb\./, 'facebook'], [/google\./, 'google'], [/whatsapp|wa\.me/, 'whatsapp'],
  [/tiktok\./, 'tiktok'], [/t\.co$|twitter\.|x\.com/, 'twitter'], [/bing\./, 'google'],
];

export function captureChannel() {
  try {
    const params = new URLSearchParams(window.location.search);
    let via = params.get('via') || params.get('utm_source') || (params.get('embed') ? 'web' : '');
    if (!via && document.referrer) {
      const host = new URL(document.referrer).hostname;
      if (host && host !== window.location.hostname) via = FROM_REFERRER.find(([re]) => re.test(host))?.[1] || 'web';
    }
    via = String(via || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 30);
    if (via.length >= 2 && !sessionStorage.getItem(KEY)) sessionStorage.setItem(KEY, via);
  } catch { /* storage unavailable */ }
}

export function currentChannel() {
  try { return sessionStorage.getItem(KEY) || 'netwish'; } catch { return 'netwish'; }
}

export const CHANNEL_LABELS = {
  netwish: 'NetWish', instagram: 'Instagram', google: 'Google', facebook: 'Facebook', whatsapp: 'WhatsApp', qr: 'Código QR',
  web: 'Tu web', tiktok: 'TikTok', twitter: 'X / Twitter', directo: 'Sin dato', telefono: 'Teléfono',
};
export const channelLabel = (c) => CHANNEL_LABELS[c] || c;
