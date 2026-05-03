-- 003_create_game_sessions.sql
-- Create game_sessions table without the common_match_id FK (added later)

CREATE TABLE IF NOT EXISTS public.game_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_account_id uuid NOT NULL REFERENCES public.accounts(id),
  join_code text NOT NULL,
  state session_state NOT NULL DEFAULT 'joinable',
  common_match_id uuid NULL,
  last_event_sequence bigint NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz
);

-- partial unique index for active join codes
CREATE UNIQUE INDEX IF NOT EXISTS ux_game_sessions_join_code_active ON public.game_sessions (join_code) WHERE state != 'completed';

-- check constraint for completed_at / state consistency
ALTER TABLE public.game_sessions
  ADD CONSTRAINT chk_game_sessions_completed_state CHECK (completed_at IS NULL OR state = 'completed');

-- performance indexes
CREATE INDEX IF NOT EXISTS idx_game_sessions_host_account_id ON public.game_sessions (host_account_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_state ON public.game_sessions (state);
