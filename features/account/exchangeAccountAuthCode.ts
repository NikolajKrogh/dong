import { getSupabaseClient } from '../../lib/supabase';

export const exchangeAccountAuthCode = (code: string) =>
  getSupabaseClient().auth.exchangeCodeForSession(code);
