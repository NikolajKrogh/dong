-- 014_profiles_rls.sql
-- Owner-managed profile access plus accepted-friend profile visibility.
DROP POLICY IF EXISTS profiles_owner_or_friend_select ON public.profiles;
CREATE POLICY profiles_owner_or_friend_select ON public.profiles FOR
SELECT TO authenticated USING (
        account_id = (
            SELECT auth.uid()
        )
        OR EXISTS (
            SELECT 1
            FROM public.friendships
            WHERE status = 'accepted'
                AND (
                    (
                        requester_account_id = public.profiles.account_id
                        AND addressee_account_id = (
                            SELECT auth.uid()
                        )
                    )
                    OR (
                        addressee_account_id = public.profiles.account_id
                        AND requester_account_id = (
                            SELECT auth.uid()
                        )
                    )
                )
        )
    );
DROP POLICY IF EXISTS profiles_owner_insert ON public.profiles;
CREATE POLICY profiles_owner_insert ON public.profiles FOR
INSERT TO authenticated WITH CHECK (
        account_id = (
            SELECT auth.uid()
        )
    );
DROP POLICY IF EXISTS profiles_owner_update ON public.profiles;
CREATE POLICY profiles_owner_update ON public.profiles FOR
UPDATE TO authenticated USING (
        account_id = (
            SELECT auth.uid()
        )
    ) WITH CHECK (
        account_id = (
            SELECT auth.uid()
        )
    );