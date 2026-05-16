-- Remove the redundant username column now that display name is the only host profile field.
ALTER TABLE public.accounts DROP CONSTRAINT IF EXISTS chk_accounts_username_nonempty;
ALTER TABLE public.accounts DROP COLUMN IF EXISTS username;