-- 026_guest_room_join.sql
-- Add guest-room join and snapshot RPCs with replay-safe guest token handling.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private
FROM PUBLIC,
    anon,
    authenticated;
GRANT USAGE ON SCHEMA private TO anon,
    authenticated,
    service_role;
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
REVOKE ALL ON FUNCTION private.build_guest_room_snapshot(uuid)
FROM PUBLIC,
    anon,
    authenticated;
GRANT EXECUTE ON FUNCTION private.build_guest_room_snapshot(uuid) TO service_role;
CREATE OR REPLACE FUNCTION private.join_room_as_guest(
        p_join_code text,
        p_guest_name text,
        p_guest_token text
    ) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '' AS $$
DECLARE v_join_code text := upper(btrim(COALESCE(p_join_code, '')));
v_guest_name text := btrim(COALESCE(p_guest_name, ''));
v_guest_token text := btrim(COALESCE(p_guest_token, ''));
v_token_hash text;
v_room public.game_sessions %ROWTYPE;
v_existing_participant public.participants %ROWTYPE;
v_participant public.participants %ROWTYPE;
BEGIN IF v_guest_name = '' THEN RAISE EXCEPTION 'guest_name_required';
END IF;
IF v_guest_token = '' THEN RAISE EXCEPTION 'guest_token_required';
END IF;
SELECT * INTO v_room
FROM public.game_sessions game_sessions
WHERE game_sessions.join_code = v_join_code FOR
UPDATE;
IF NOT FOUND THEN RAISE EXCEPTION 'room_not_found';
END IF;
IF v_room.state <> 'joinable'::public.session_state THEN RAISE EXCEPTION 'room_not_joinable';
END IF;
v_token_hash := encode(
    extensions.digest(v_guest_token, 'sha256'),
    'hex'
);
SELECT * INTO v_existing_participant
FROM public.participants participants
WHERE participants.session_id = v_room.id
    AND participants.guest_rejoin_token_hash = v_token_hash
LIMIT 1;
IF FOUND THEN RETURN jsonb_build_object(
    'participantId',
    v_existing_participant.id::text,
    'sessionId',
    v_room.id::text,
    'guestToken',
    v_guest_token,
    'joinCode',
    v_room.join_code,
    'displayName',
    v_existing_participant.display_name,
    'snapshot',
    private.build_guest_room_snapshot(v_room.id)
);
END IF;
BEGIN
INSERT INTO public.participants (
        session_id,
        account_id,
        display_name,
        membership_type,
        session_role,
        current_drink_total,
        guest_rejoin_token_hash,
        created_at
    )
VALUES (
        v_room.id,
        NULL,
        v_guest_name,
        'guest'::public.participant_membership_type,
        'member'::public.participant_session_role,
        0,
        v_token_hash,
        now()
    )
RETURNING * INTO v_participant;
EXCEPTION
WHEN unique_violation THEN
SELECT * INTO v_existing_participant
FROM public.participants participants
WHERE participants.session_id = v_room.id
    AND participants.guest_rejoin_token_hash = v_token_hash
LIMIT 1;
IF FOUND THEN RETURN jsonb_build_object(
    'participantId',
    v_existing_participant.id::text,
    'sessionId',
    v_room.id::text,
    'guestToken',
    v_guest_token,
    'joinCode',
    v_room.join_code,
    'displayName',
    v_existing_participant.display_name,
    'snapshot',
    private.build_guest_room_snapshot(v_room.id)
);
END IF;
RAISE;
END;
INSERT INTO public.gameplay_events (
        session_id,
        sequence_number,
        actor_participant_id,
        event_type,
        idempotency_key,
        payload,
        created_at
    )
VALUES (
        v_room.id,
        public.allocate_event_sequence(v_room.id),
        v_participant.id,
        'participant_joined',
        concat('guest-join:', v_token_hash),
        jsonb_build_object(
            'participantId',
            v_participant.id::text,
            'displayName',
            v_participant.display_name,
            'membershipType',
            'guest',
            'sessionRole',
            'member',
            'replayed',
            FALSE
        ),
        now()
    );
RETURN jsonb_build_object(
    'participantId',
    v_participant.id::text,
    'sessionId',
    v_room.id::text,
    'guestToken',
    v_guest_token,
    'joinCode',
    v_room.join_code,
    'displayName',
    v_participant.display_name,
    'snapshot',
    private.build_guest_room_snapshot(v_room.id)
);
END;
$$;
REVOKE ALL ON FUNCTION private.join_room_as_guest(text, text, text)
FROM PUBLIC,
    anon,
    authenticated;
GRANT EXECUTE ON FUNCTION private.join_room_as_guest(text, text, text) TO anon,
    authenticated,
    service_role;
CREATE OR REPLACE FUNCTION private.get_guest_room_snapshot(p_guest_token text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '' AS $$
DECLARE v_guest_token text := btrim(COALESCE(p_guest_token, ''));
v_token_hash text;
v_participant public.participants %ROWTYPE;
BEGIN IF v_guest_token = '' THEN RAISE EXCEPTION 'guest_token_expired';
END IF;
v_token_hash := encode(
    extensions.digest(v_guest_token, 'sha256'),
    'hex'
);
SELECT * INTO v_participant
FROM public.participants participants
WHERE participants.guest_rejoin_token_hash = v_token_hash
    AND participants.membership_type = 'guest'::public.participant_membership_type
ORDER BY participants.created_at DESC
LIMIT 1;
IF NOT FOUND THEN RAISE EXCEPTION 'guest_token_expired';
END IF;
RETURN private.build_guest_room_snapshot(v_participant.session_id);
END;
$$;
REVOKE ALL ON FUNCTION private.get_guest_room_snapshot(text)
FROM PUBLIC,
    anon,
    authenticated;
GRANT EXECUTE ON FUNCTION private.get_guest_room_snapshot(text) TO anon,
    authenticated,
    service_role;
CREATE OR REPLACE FUNCTION public.join_room_as_guest(
        join_code text,
        guest_name text,
        guest_token text
    ) RETURNS jsonb LANGUAGE sql VOLATILE
SET search_path = '' AS $$
SELECT private.join_room_as_guest(join_code, guest_name, guest_token);
$$;
REVOKE ALL ON FUNCTION public.join_room_as_guest(text, text, text)
FROM PUBLIC,
    anon,
    authenticated;
GRANT EXECUTE ON FUNCTION public.join_room_as_guest(text, text, text) TO anon,
    authenticated,
    service_role;
CREATE OR REPLACE FUNCTION public.get_guest_room_snapshot(guest_token text) RETURNS jsonb LANGUAGE sql STABLE
SET search_path = '' AS $$
SELECT private.get_guest_room_snapshot(guest_token);
$$;
REVOKE ALL ON FUNCTION public.get_guest_room_snapshot(text)
FROM PUBLIC,
    anon,
    authenticated;
GRANT EXECUTE ON FUNCTION public.get_guest_room_snapshot(text) TO anon,
    authenticated,
    service_role;