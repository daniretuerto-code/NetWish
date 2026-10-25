// Understands every QR format NetWish has printed so far.
export function parseNetWishQR(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;

  if (/^https?:\/\//i.test(text)) {
    try {
      const url = new URL(text);
      const biz = url.searchParams.get('biz');
      const table = url.searchParams.get('table');
      if (biz && table) return { type: 'table', business: biz, table: parseInt(table, 10) || 1 };
      if (biz) return { type: 'business', business: biz };
      const pay = url.searchParams.get('pay');
      if (pay) return { type: 'business', business: pay };
      const page = /^\/negocio\/([^/]+)\/?$/.exec(url.pathname);
      if (page && url.origin === window.location.origin) return { type: 'business', business: decodeURIComponent(page[1]) };
    } catch {
      return null;
    }
    return null;
  }

  const [prefix, a, b] = text.split(':');
  if (prefix === 'NETWISH_TABLE' && a) return { type: 'table', business: a, table: parseInt(b, 10) || 1 };
  if ((prefix === 'NETWISH_PAY' || prefix === 'NETWISH_BUSINESS') && a) return { type: 'business', business: a };
  return null;
}

export const tableUrl = (business, table) =>
  `${window.location.origin}/?biz=${encodeURIComponent(business)}&table=${table}`;

export const businessUrl = (business) =>
  `${window.location.origin}/negocio/${encodeURIComponent(business)}`;
