import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  'https://ysdqptwesmwrcwxnkajz.supabase.co';
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  'sb_publishable_xmBw91PkZ_irvQ0xxiwRZQ_nidNWwQH';

export const createClient = () => createBrowserClient(supabaseUrl, supabaseKey);
