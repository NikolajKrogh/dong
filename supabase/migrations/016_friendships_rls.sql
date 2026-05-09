-- 016_friendships_rls.sql
-- Bilateral friendship visibility plus later lifecycle transitions.
DROP POLICY IF EXISTS friendships_participants_select ON public.friendships;
CREATE POLICY friendships_participants_select ON public.friendships FOR
SELECT TO authenticated USING (
        requester_account_id = (
            SELECT auth.uid()
        )
        OR addressee_account_id = (
            SELECT auth.uid()
        )
    );
DROP POLICY IF EXISTS friendships_requester_insert ON public.friendships;
CREATE POLICY friendships_requester_insert ON public.friendships FOR
INSERT TO authenticated WITH CHECK (
        requester_account_id = (
            SELECT auth.uid()
        )
        AND requester_account_id <> addressee_account_id
        AND status = 'pending'
        AND responded_at IS NULL
    );
DROP POLICY IF EXISTS friendships_requester_cancel_pending ON public.friendships;
CREATE POLICY friendships_requester_cancel_pending ON public.friendships FOR
UPDATE TO authenticated USING (
        requester_account_id = (
            SELECT auth.uid()
        )
        AND status = 'pending'
    ) WITH CHECK (
        requester_account_id = (
            SELECT auth.uid()
        )
        AND status = 'canceled'
        AND responded_at IS NOT NULL
    );
DROP POLICY IF EXISTS friendships_addressee_respond_pending ON public.friendships;
CREATE POLICY friendships_addressee_respond_pending ON public.friendships FOR
UPDATE TO authenticated USING (
        addressee_account_id = (
            SELECT auth.uid()
        )
        AND status = 'pending'
    ) WITH CHECK (
        addressee_account_id = (
            SELECT auth.uid()
        )
        AND status IN ('accepted', 'declined')
        AND responded_at IS NOT NULL
    );
DROP POLICY IF EXISTS friendships_participants_cancel_accepted ON public.friendships;
CREATE POLICY friendships_participants_cancel_accepted ON public.friendships FOR
UPDATE TO authenticated USING (
        status = 'accepted'
        AND (
            requester_account_id = (
                SELECT auth.uid()
            )
            OR addressee_account_id = (
                SELECT auth.uid()
            )
        )
    ) WITH CHECK (
        status = 'canceled'
        AND responded_at IS NOT NULL
        AND (
            requester_account_id = (
                SELECT auth.uid()
            )
            OR addressee_account_id = (
                SELECT auth.uid()
            )
        )
    );