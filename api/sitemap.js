import { escapeHtml, SITE_URL, supabaseRest } from './_lib.js';

// netwish.es/sitemap.xml: every published business, so Google finds and lists them.
export default async function handler(req, res) {
  let list = [];
  try {
    list = await supabaseRest('businesses?select=name,created_at&status=eq.approved&demo=is.false&preview=is.false&order=name');
  } catch (error) {
    console.error('sitemap', error);
  }
  const urls = [
    `${SITE_URL}/`, `${SITE_URL}/explorar`, `${SITE_URL}/eventos`,
    ...(list || []).map((b) => `${SITE_URL}/negocio/${encodeURIComponent(b.name)}`),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${escapeHtml(u)}</loc></url>`).join('\n')}
</urlset>`;
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  return res.status(200).send(xml);
}
