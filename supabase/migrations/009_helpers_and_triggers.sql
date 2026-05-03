-- 009_helpers_and_triggers.sql
-- Helper function to atomically allocate next event sequence and a trigger to block writes on completed sessions
CREATE OR REPLACE FUNCTION public.allocate_event_sequence(p_session_id uuid) RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE v_new_seq bigint;
BEGIN
UPDATE public.game_sessions
SET last_event_sequence = last_event_sequence + 1
WHERE id = p_session_id
RETURNING last_event_sequence INTO v_new_seq;
IF v_new_seq IS NULL THEN RAISE EXCEPTION 'session not found: %',
p_session_id;
END IF;
RETURN v_new_seq;
END;
$$;
-- Trigger function to prevent event inserts for completed sessions
CREATE OR REPLACE FUNCTION public.prevent_events_on_completed() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM 1
FROM public.game_sessions
WHERE id = NEW.session_id
    AND state = 'completed';
IF FOUND THEN RAISE EXCEPTION 'cannot insert events for completed session %',
NEW.session_id;
END IF;
RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_prevent_events_on_completed ON public.gameplay_events;
CREATE TRIGGER trg_prevent_events_on_completed BEFORE
INSERT ON public.gameplay_events FOR EACH ROW EXECUTE FUNCTION public.prevent_events_on_completed();