-- Local pgTAP fixture only: make a per-transaction Vault key if none exists.
-- The secret is generated in the database and rolled back with the test.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name='dong_guest_abuse_hmac_v1') THEN
    PERFORM vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'), 'dong_guest_abuse_hmac_v1');
  END IF;
END $$;
SELECT set_config('request.headers', '{"x-dong-guest-caller":"192.0.2.10"}', true);
SELECT set_config('request.jwt.claim.role', 'service_role', true);
