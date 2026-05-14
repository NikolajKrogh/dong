-- 024_host_auth_accounts.sql
-- Host account onboarding and access controls.
REVOKE ALL ON TABLE public.accounts
FROM PUBLIC,
    anon,
    authenticated;
GRANT SELECT,
    INSERT,
    UPDATE ON TABLE public.accounts TO authenticated;
GRANT SELECT,
    INSERT,
    UPDATE,
    DELETE ON TABLE public.accounts TO service_role;

ALTER TABLE public.accounts
DROP CONSTRAINT IF EXISTS chk_accounts_preferred_display_name_nonempty;
ALTER TABLE public.accounts
ADD CONSTRAINT chk_accounts_preferred_display_name_nonempty CHECK (
        preferred_display_name IS NULL
        OR length(btrim(preferred_display_name)) > 0
    );

DROP POLICY IF EXISTS accounts_owner_select ON public.accounts;
CREATE POLICY accounts_owner_select ON public.accounts FOR
SELECT TO authenticated USING (
        id = (
            SELECT auth.uid()
        )
    );
DROP POLICY IF EXISTS accounts_owner_insert ON public.accounts;
CREATE POLICY accounts_owner_insert ON public.accounts FOR
INSERT TO authenticated WITH CHECK (
        id = (
            SELECT auth.uid()
        )
    );
DROP POLICY IF EXISTS accounts_owner_update ON public.accounts;
CREATE POLICY accounts_owner_update ON public.accounts FOR
UPDATE TO authenticated USING (
        id = (
            SELECT auth.uid()
        )
    ) WITH CHECK (
        id = (
            SELECT auth.uid()
        )
    );

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;