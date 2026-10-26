import { supabaseRest } from './_lib.js';
import { sendReminder, sendReviewRequest, sendWaitlistNotice } from './_emails.js';

// Called every hour by Supabase (pg_cron) and right away when a booking is cancelled.
// The key comes from the database and goes straight back to it, which checks it.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  const key = String(req.headers['x-cron-key'] || '');
  if (!key) return res.status(401).json({ error: 'No autorizado' });

  try {
    const jobs = await supabaseRest('rpc/cron_jobs', { method: 'POST', body: { p_key: key } });
    const count = async (list, send) => (await Promise.all((list || []).map((x) => send(x).catch(() => false)))).filter(Boolean).length;
    const out = {
      expired: jobs.expired || 0,
      reminders: await count(jobs.reminders, sendReminder),
      reviews: await count(jobs.reviews, (o) => sendReviewRequest(o, o.review_url)),
      waitlist: await count(jobs.waitlist, sendWaitlistNotice),
    };
    return res.status(200).json(out);
  } catch (error) {
    console.error('cron', error);
    return res.status(error.message === 'No autorizado' ? 401 : 500).json({ error: error.message });
  }
}
