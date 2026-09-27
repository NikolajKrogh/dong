import { createGuestIngress } from './handler.ts';

// Explicit project-public-key authentication supports publishable keys and
// signed-in clients without relying on the legacy gateway JWT verifier.
// This key admits requests, not room access: the guest bearer is still required.
const publishedKeys = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') ?? '{}');
Deno.serve(createGuestIngress({
  url: Deno.env.get('SUPABASE_URL') ?? '',
  serviceKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  publicKeys: [Deno.env.get('SUPABASE_ANON_KEY') ?? '', ...Object.values(publishedKeys).filter((key): key is string => typeof key === 'string')],
  fetch,
}));
