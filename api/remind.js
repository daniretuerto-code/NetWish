import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseRest } from './_lib.js';
import { sendReminder, sendReviewRequest } from './_emails.js';

// Day-before reminders. The hourly /api/cron sends them too; the owner's panel calls this as a
// fallback. The database hands out each booking once, so calling it again sends nothing new.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  const auth = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization : null;
  if (!auth) return res.status(401).json({ error: 'Inicia sesión' });

  try {
    // The business comes from the session, never from the request body.
    const user = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: auth },
    }).then((r) => (r.ok ? r.json() : null));
    if (!user?.id) return res.status(401).json({ error: 'Sesión no válida' });
    const [biz] = await supabaseRest(`businesses?select=name&owner_id=eq.${user.id}`, { authorization: auth });
    if (!biz) return res.status(200).json({ sent: 0 });

    const due = await supabaseRest('rpc/claim_reminders', { method: 'POST', body: { p_business: biz.name }, authorization: auth });
    let sent = 0;
    for (const row of due || []) {
      if (await sendReminder(row.claim_reminders || row)) sent += 1;
    }

    // Yesterday's customers: the one-minute survey (the database skips it if the restaurant turned it off).
    // Until the survey columns exist, only restaurants with a Google link ask, as before.
    const [settings] = await supabaseRest(`restaurant_settings?select=profile&business_name=ilike.${encodeURIComponent(biz.name)}`, { authorization: auth });
    const reviewUrl = /^https:\/\//.test(String(settings?.profile?.google_resenas || '').trim()) ? settings.profile.google_resenas.trim() : '';
    const survey = await supabaseRest('orders?select=rating&limit=1', { authorization: auth }).then(() => true, () => false);
    let asked = 0;
    if (survey || reviewUrl) {
      const reviews = await supabaseRest('rpc/claim_review_requests', { method: 'POST', body: { p_business: biz.name }, authorization: auth });
      for (const row of reviews || []) {
        if (await sendReviewRequest({ review_url: reviewUrl, ...(row.claim_review_requests || row) })) asked += 1;
      }
    }
    return res.status(200).json({ sent, reviews: asked });
  } catch (error) {
    console.error('remind', error);
    return res.status(500).json({ error: 'No se pudieron enviar los recordatorios' });
  }
}
