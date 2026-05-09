-- 012_social_constraints_and_indexes.sql
-- Add supporting constraints and indexes for profile, settings, and friendship access paths.
ALTER TABLE public.friendships
ADD CONSTRAINT chk_friendships_distinct_accounts CHECK (requester_account_id <> addressee_account_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_friendships_account_pair ON public.friendships (
    LEAST(requester_account_id, addressee_account_id),
    GREATEST(requester_account_id, addressee_account_id)
);
CREATE INDEX IF NOT EXISTS idx_friendships_requester_status_addressee ON public.friendships (
    requester_account_id,
    status,
    addressee_account_id
);
CREATE INDEX IF NOT EXISTS idx_friendships_addressee_status_requester ON public.friendships (
    addressee_account_id,
    status,
    requester_account_id
);