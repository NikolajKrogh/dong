-- 015_settings_rls.sql
-- Owner-only settings access.
DROP POLICY IF EXISTS settings_owner_select ON public.settings;
CREATE POLICY settings_owner_select ON public.settings FOR
SELECT TO authenticated USING (
        account_id = (
            SELECT auth.uid()
        )
    );
DROP POLICY IF EXISTS settings_owner_insert ON public.settings;
CREATE POLICY settings_owner_insert ON public.settings FOR
INSERT TO authenticated WITH CHECK (
        account_id = (
            SELECT auth.uid()
        )
    );
DROP POLICY IF EXISTS settings_owner_update ON public.settings;
CREATE POLICY settings_owner_update ON public.settings FOR
UPDATE TO authenticated USING (
        account_id = (
            SELECT auth.uid()
        )
    ) WITH CHECK (
        account_id = (
            SELECT auth.uid()
        )
    );