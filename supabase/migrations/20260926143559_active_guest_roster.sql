-- Keep the shared room snapshot's roster aligned with room membership. Migration
-- 038 redefined this builder for player-pick support but dropped the existing
-- left_at predicate from the participant aggregate, so departed members reappear
-- to both hosts and guests after the next snapshot.
CREATE OR REPLACE FUNCTION private.build_guest_room_snapshot(p_session_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = '' AS $$
SELECT jsonb_build_object(
        'sessionId', game_sessions.id::text,
        'joinCode', game_sessions.join_code,
        'state', game_sessions.state::text,
        'commonMatchId', game_sessions.common_match_id::text,
        'assignmentMode', game_sessions.assignment_mode::text,
        'participants',
        COALESCE(
            (
                SELECT jsonb_agg(
                        jsonb_build_object(
                            'id', participants.id::text,
                            'displayName', participants.display_name,
                            'membershipType', participants.membership_type::text,
                            'sessionRole', participants.session_role::text,
                            'currentDrinkTotal', participants.current_drink_total
                        )
                        ORDER BY participants.created_at, participants.id
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
                            'id', matches.id::text,
                            'sourceProvider', matches.source_provider,
                            'sourceMatchId', matches.source_match_id,
                            'homeTeamName', matches.home_team_name,
                            'awayTeamName', matches.away_team_name,
                            'kickoffAt', matches.kickoff_at,
                            'homeScore', matches.home_score,
                            'awayScore', matches.away_score
                        )
                        ORDER BY matches.created_at, matches.id
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
                            'participantId', assignments.participant_id::text,
                            'matchId', assignments.match_id::text
                        )
                        ORDER BY assignments.participant_id, assignments.match_id
                    )
                FROM public.assignments assignments
                WHERE assignments.session_id = game_sessions.id
            ),
            '[]'::jsonb
        ),
        'picks',
        COALESCE(
            (
                SELECT jsonb_agg(
                        jsonb_build_object(
                            'participantId', assignment_picks.participant_id::text,
                            'matchId', assignment_picks.match_id::text
                        )
                        ORDER BY assignment_picks.participant_id, assignment_picks.match_id
                    )
                FROM public.assignment_picks assignment_picks
                WHERE assignment_picks.session_id = game_sessions.id
            ),
            '[]'::jsonb
        ),
        'assignmentPlan', private.compute_room_assignment_plan(game_sessions.id)
    )
FROM public.game_sessions game_sessions
WHERE game_sessions.id = p_session_id;
$$;

REVOKE ALL ON FUNCTION private.build_guest_room_snapshot(uuid)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.build_guest_room_snapshot(uuid)
    TO service_role;

NOTIFY pgrst, 'reload schema';
