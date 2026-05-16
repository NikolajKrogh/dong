-- 027_host_profile_and_settings.sql
-- Add host profile username support while reusing the existing synced settings row.
ALTER TABLE public.accounts
ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE public.accounts DROP CONSTRAINT IF EXISTS chk_accounts_username_nonempty;
ALTER TABLE public.accounts
ADD CONSTRAINT chk_accounts_username_nonempty CHECK (
		username IS NULL
		OR length(btrim(username)) > 0
	);