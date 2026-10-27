import { escapeHtml, SITE_URL, supabaseRest } from './_lib.js';

// Link previews (WhatsApp, Instagram, Google…) for a business page. Crawlers don't run the app,
// so vercel.json sends them here and we hand back the page with its own title, text and photo.
export default async function handler(req, res) {
  const path = String(req.query?.path || '/');
  const slug = decodeURIComponent((/^\/(?:negocio|r)\/([^/?#]+)/.exec(path) || [])[1] || '').trim();
  let html;
  try {
    html = await fetch(`${SITE_URL}/index.html`).then((r) => r.text());
  } catch {
    return res.redirect(302, path);
  }
  try {
    if (slug && slug.length <= 80) {
      const like = encodeURIComponent(slug.replace(/[\\%_*,()]/g, ''));
      const cols = 'name,category,address,cover_url,image,username';
      const list = await supabaseRest(`businesses?select=${cols}&status=eq.approved&or=(name.ilike.${like},username.ilike.${like})&limit=1`);
      const biz = list?.[0];
      if (biz) {
        const restaurant = /rest|bar|caf/i.test(biz.category || '');
        const title = `${biz.name} · ${restaurant ? 'Carta y reservas' : biz.category || 'Palencia'} | NetWish`;
        const text = restaurant
          ? `Mira la carta de ${biz.name} y reserva mesa online en segundos${biz.address ? `. ${biz.address}, Palencia` : ' en Palencia'}.`
          : `${biz.name}${biz.address ? `, ${biz.address}` : ''} en Palencia. Escríbeles o reserva en NetWish.`;
        const image = biz.cover_url || biz.image || `${SITE_URL}/icon-512.png`;
        const url = `${SITE_URL}/negocio/${encodeURIComponent(biz.name)}`;
        const meta = [
          `<meta property="og:type" content="website">`,
          `<meta property="og:site_name" content="NetWish">`,
          `<meta property="og:title" content="${escapeHtml(title)}">`,
          `<meta property="og:description" content="${escapeHtml(text)}">`,
          `<meta property="og:image" content="${escapeHtml(image)}">`,
          `<meta property="og:url" content="${escapeHtml(url)}">`,
          `<meta name="twitter:card" content="${biz.cover_url ? 'summary_large_image' : 'summary'}">`,
          `<link rel="canonical" href="${escapeHtml(url)}">`,
        ].join('\n  ');
        html = html
          .replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(title)}</title>`)
          .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${escapeHtml(text)}">`)
          .replace('</head>', `  ${meta}\n</head>`);
      }
    }
  } catch (error) {
    console.error('preview', error);
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=86400');
  return res.status(200).send(html);
}
