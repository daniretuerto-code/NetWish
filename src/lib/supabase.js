import { createClient } from '@supabase/supabase-js';

// The publishable key is public by design: access is controlled by RLS policies in the database.
const url = import.meta.env.VITE_SUPABASE_URL || 'https://gamjjnyomhnyswbxlhgq.supabase.co';
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_096WH9RGLik4I_DsDR5iBg_QEKxC7bK';

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
