-- 010_constrain_gameplay_events.sql
-- Add the missing gameplay event value checks for existing remote/local schemas.
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.gameplay_events'::regclass
        AND conname = 'chk_gameplay_events_sequence_number_positive'
) THEN
ALTER TABLE public.gameplay_events
ADD CONSTRAINT chk_gameplay_events_sequence_number_positive CHECK (sequence_number > 0);
END IF;
END;
$$;
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.gameplay_events'::regclass
        AND conname = 'chk_gameplay_events_event_type'
) THEN
ALTER TABLE public.gameplay_events
ADD CONSTRAINT chk_gameplay_events_event_type CHECK (
        event_type IN (
            'session_created',
            'participant_joined',
            'participant_reclaimed',
            'match_added',
            'common_match_selected',
            'assignment_replaced',
            'score_changed',
            'drink_changed',
            'session_started',
            'session_completed'
        )
    );
END IF;
END;
$$;