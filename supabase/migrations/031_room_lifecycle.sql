-- 031_room_lifecycle.sql
-- Foundational lifecycle changes for live lobby presence + handover + expiry (spec 017).
-- NOTE: 'closed' enum value is ADDED here but only REFERENCED from 032+ (separate
-- transactions) to avoid "unsafe use of new enum value in the same transaction".

-- New terminal state, distinct from 'completed' (host left with no successor, or expired).
ALTER TYPE public.session_state ADD VALUE IF NOT EXISTS 'closed';

-- Inactivity expiry clock.
ALTER TABLE public.game_sessions
ADD COLUMN IF NOT EXISTS last_activity_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_game_sessions_active_last_activity
ON public.game_sessions (state, last_activity_at);

-- Soft-leave marker. We cannot hard-delete participants because gameplay_events has a
-- NOT NULL composite FK to participants (and we keep the audit trail). Leaving sets
-- left_at; the roster filters left_at IS NULL. This is also forward-compatible with the
-- future in-progress leave story (#165), which must preserve participation.
ALTER TABLE public.participants
ADD COLUMN IF NOT EXISTS left_at timestamptz NULL;

-- Allow the new lobby/handover/closure event types.
ALTER TABLE public.gameplay_events
DROP CONSTRAINT IF EXISTS chk_gameplay_events_event_type;
ALTER TABLE public.gameplay_events
ADD CONSTRAINT chk_gameplay_events_event_type CHECK (
    event_type IN (
        'session_created',
        'participant_joined',
        'participant_reclaimed',
        'participant_left',
        'host_transferred',
        'room_closed',
        'match_added',
        'common_match_selected',
        'assignment_replaced',
        'score_changed',
        'drink_changed',
        'session_started',
        'session_completed'
    )
);

-- Bump last_activity_at on any recorded room event (covers join/leave/handover/gameplay).
CREATE OR REPLACE FUNCTION private.bump_room_last_activity() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE public.game_sessions
  SET last_activity_at = now()
  WHERE id = NEW.session_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bump_room_last_activity ON public.gameplay_events;
CREATE TRIGGER bump_room_last_activity
AFTER INSERT ON public.gameplay_events
FOR EACH ROW EXECUTE FUNCTION private.bump_room_last_activity();

-- Redefine the shared room snapshot to exclude soft-left participants from the roster.
-- (Same shape as 026; only the participants subquery gains `AND left_at IS NULL`.)
CREATE OR REPLACE FUNCTION private.build_guest_room_snapshot(p_session_id uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = '' AS $$
SELECT jsonb_build_object(
        'sessionId',
        game_sessions.id::text,
        'joinCode',
        game_sessions.join_code,
        'state',
        game_sessions.state::text,
        'commonMatchId',
        game_sessions.common_match_id::text,
        'participants',
        COALESCE(
            (
                SELECT jsonb_agg(
                        jsonb_build_object(
                            'id',
                            participants.id::text,
                            'displayName',
                            participants.display_name,
                            'membershipType',
                            participants.membership_type::text,
                            'sessionRole',
                            participants.session_role::text,
                            'currentDrinkTotal',
                            participants.current_drink_total
                        )
                        ORDER BY participants.created_at,
                            participants.id
                    )
                FROM public.participants participants
                WHERE participants.session_id = game_sessions.id
                    AND participants.left_at IS NULL
            ),
            '[]'::jsonb
        ),
        'matches',
        COALESCE(
            (
                SELECT jsonb_agg(
                        jsonb_build_object(
                            'id',
                            matches.id::text,
                            'sourceProvider',
                            matches.source_provider,
                            'sourceMatchId',
                            matches.source_match_id,
                            'homeTeamName',
                            matches.home_team_name,
                            'awayTeamName',
                            matches.away_team_name,
                            'kickoffAt',
                            matches.kickoff_at,
                            'homeScore',
                            matches.home_score,
                            'awayScore',
                            matches.away_score
                        )
                        ORDER BY matches.created_at,
                            matches.id
                    )
                FROM public.matches matches
                WHERE matches.session_id = game_sessions.id
            ),
            '[]'::jsonb
        ),
        'assignments',
        COALESCE(
            (
                SELECT jsonb_agg(
                        jsonb_build_object(
                            'participantId',
                            assignments.participant_id::text,
                            'matchId',
                            assignments.match_id::text
                        )
                        ORDER BY assignments.participant_id,
                            assignments.match_id
                    )
                FROM public.assignments assignments
                WHERE assignments.session_id = game_sessions.id
            ),
            '[]'::jsonb
        )
    )
FROM public.game_sessions game_sessions
WHERE game_sessions.id = p_session_id;
$$;
