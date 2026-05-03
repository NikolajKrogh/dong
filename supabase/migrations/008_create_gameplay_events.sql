-- 008_create_gameplay_events.sql
-- Create gameplay_events table with uniqueness and idempotency constraints
CREATE TABLE IF NOT EXISTS public.gameplay_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id uuid NOT NULL REFERENCES public.game_sessions(id),
    sequence_number bigint NOT NULL,
    actor_participant_id uuid NOT NULL,
    event_type text NOT NULL,
    idempotency_key text NOT NULL,
    payload jsonb NOT NULL,
    created_at timestamptz DEFAULT now()
);
-- Uniqueness per session
CREATE UNIQUE INDEX IF NOT EXISTS ux_gameplay_events_session_sequence ON public.gameplay_events (session_id, sequence_number);
CREATE UNIQUE INDEX IF NOT EXISTS ux_gameplay_events_session_idempotency ON public.gameplay_events (session_id, idempotency_key);
-- Composite FK to ensure actor_participant belongs to the same session
ALTER TABLE public.gameplay_events
ADD CONSTRAINT fk_gameplay_events_actor_participant FOREIGN KEY (session_id, actor_participant_id) REFERENCES public.participants(session_id, id);
CREATE INDEX IF NOT EXISTS idx_gameplay_events_session_sequence ON public.gameplay_events (session_id, sequence_number);
CREATE INDEX IF NOT EXISTS idx_gameplay_events_actor ON public.gameplay_events (actor_participant_id);