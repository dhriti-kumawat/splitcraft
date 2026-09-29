import { createClient } from 'npm:@supabase/supabase-js@2';

// Service role client for server-side use only. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
// are provided to every Edge Function by Supabase; never ship this key to a browser.
export const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
);

export const functionsUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1`;
