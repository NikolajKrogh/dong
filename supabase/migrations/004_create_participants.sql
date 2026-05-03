-- 004_create_participants.sql
-- Create participants table

CREATE TABLE IF NOT EXISTS public.participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.game_sessions(id),
  account_id uuid NULL REFERENCES public.accounts(id),
  display_name text NOT NULL,
  membership_type participant_membership_type NOT NULL,
  current_drink_total numeric(6,1) NOT NULL DEFAULT 0,
  guest_rejoin_token_hash text NULL,
  created_at timestamptz DEFAULT now()
);

-- uniqueness constraints and check constraints
ALTER TABLE public.participants
  ADD CONSTRAINT chk_participants_drink_total_nonnegative CHECK (current_drink_total >= 0),
  ADD CONSTRAINT uq_participants_session_id_id UNIQUE (session_id, id);

CREATE UNIQUE INDEX IF NOT EXISTS ux_participants_session_account ON public.participants (session_id, account_id) WHERE account_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_participants_session_guest_token ON public.participants (session_id, guest_rejoin_token_hash) WHERE guest_rejoin_token_hash IS NOT NULL;

ALTER TABLE public.participants
  ADD CONSTRAINT chk_participants_membership_type_consistency CHECK (
    (membership_type = 'registered' AND account_id IS NOT NULL AND guest_rejoin_token_hash IS NULL)
    OR
    (membership_type = 'guest' AND account_id IS NULL AND guest_rejoin_token_hash IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS idx_participants_session_id ON public.participants (session_id);
CREATE INDEX IF NOT EXISTS idx_participants_account_id ON public.participants (account_id);
