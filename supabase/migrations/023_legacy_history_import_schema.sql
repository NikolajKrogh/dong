-- 023_legacy_history_import_schema.sql
-- Private ledger, helper functions, and public RPC wrapper for one-time legacy history import.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private
FROM PUBLIC,
    anon,
    authenticated;
GRANT USAGE ON SCHEMA private TO authenticated,
    service_role;
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'legacy_history_import_state'
) THEN CREATE TYPE legacy_history_import_state AS ENUM (
    'in_progress',
    'completed',
    'failed'
);
END IF;
IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'legacy_history_import_session_state'
) THEN CREATE TYPE legacy_history_import_session_state AS ENUM (
    'pending',
    'imported',
    'skipped',
    'failed',
    'conflict'
);
END IF;
END;
$$;
CREATE TABLE IF NOT EXISTS private.legacy_history_import_state (
    account_id uuid PRIMARY KEY REFERENCES public.accounts(id) ON DELETE CASCADE,
    claimed_local_participant_id text NOT NULL,
    claimed_local_participant_name text NOT NULL,
    state legacy_history_import_state NOT NULL DEFAULT 'in_progress',
    started_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz,
    failed_at timestamptz,
    last_error text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'private.legacy_history_import_state'::regclass
        AND conname = 'chk_legacy_history_import_state_completed_at'
) THEN
ALTER TABLE private.legacy_history_import_state
ADD CONSTRAINT chk_legacy_history_import_state_completed_at CHECK (
        (
            state = 'completed'
            AND completed_at IS NOT NULL
        )
        OR (state != 'completed')
    );
END IF;
IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'private.legacy_history_import_state'::regclass
        AND conname = 'chk_legacy_history_import_state_failed_at'
) THEN
ALTER TABLE private.legacy_history_import_state
ADD CONSTRAINT chk_legacy_history_import_state_failed_at CHECK (
        (
            state = 'failed'
            AND failed_at IS NOT NULL
        )
        OR (state != 'failed')
    );
END IF;
END;
$$;
CREATE TABLE IF NOT EXISTS private.legacy_history_import_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    source_fingerprint text NOT NULL,
    source_local_session_id text NOT NULL,
    claimed_local_participant_id text NOT NULL,
    cloud_session_id uuid REFERENCES public.game_sessions(id) ON DELETE
    SET NULL,
        state legacy_history_import_session_state NOT NULL DEFAULT 'pending',
        error_message text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (account_id, source_fingerprint)
);
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'private.legacy_history_import_sessions'::regclass
        AND conname = 'chk_legacy_history_import_sessions_imported_cloud_session'
) THEN
ALTER TABLE private.legacy_history_import_sessions
ADD CONSTRAINT chk_legacy_history_import_sessions_imported_cloud_session CHECK (
        (
            state = 'imported'
            AND cloud_session_id IS NOT NULL
        )
        OR (state != 'imported')
    );
END IF;
IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'private.legacy_history_import_sessions'::regclass
        AND conname = 'chk_legacy_history_import_sessions_failed_message'
) THEN
ALTER TABLE private.legacy_history_import_sessions
ADD CONSTRAINT chk_legacy_history_import_sessions_failed_message CHECK (
        (
            state IN ('failed', 'conflict')
            AND error_message IS NOT NULL
        )
        OR (state NOT IN ('failed', 'conflict'))
    );
END IF;
END;
$$;
CREATE INDEX IF NOT EXISTS idx_legacy_history_import_sessions_account_id ON private.legacy_history_import_sessions (account_id);
CREATE INDEX IF NOT EXISTS idx_legacy_history_import_sessions_cloud_session_id ON private.legacy_history_import_sessions (cloud_session_id)
WHERE cloud_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_legacy_history_import_sessions_state ON private.legacy_history_import_sessions (state);
CREATE OR REPLACE FUNCTION private.try_parse_timestamptz(p_value text) RETURNS timestamptz LANGUAGE plpgsql STABLE
SET search_path = '' AS $$ BEGIN IF p_value IS NULL
    OR btrim(p_value) = '' THEN RETURN NULL;
END IF;
RETURN p_value::timestamptz;
EXCEPTION
WHEN OTHERS THEN RETURN NULL;
END;
$$;
CREATE OR REPLACE FUNCTION private.compute_legacy_history_fingerprint(p_session jsonb) RETURNS text LANGUAGE sql IMMUTABLE
SET search_path = '' AS $$
SELECT encode(
        extensions.digest(
            jsonb_build_object(
                'sourceLocalSessionId',
                p_session->>'sourceLocalSessionId',
                'savedAt',
                p_session->>'savedAt',
                'commonMatchId',
                p_session->>'commonMatchId',
                'matchesPerPlayer',
                COALESCE((p_session->>'matchesPerPlayer')::integer, 0),
                'players',
                COALESCE(
                    (
                        SELECT jsonb_agg(
                                jsonb_build_object(
                                    'id',
                                    player_entry->>'id',
                                    'name',
                                    player_entry->>'name',
                                    'drinksTaken',
                                    CASE
                                        WHEN player_entry ? 'drinksTaken' THEN to_jsonb((player_entry->>'drinksTaken')::numeric)
                                        ELSE 'null'::jsonb
                                    END
                                )
                                ORDER BY player_entry->>'id'
                            )
                        FROM jsonb_array_elements(COALESCE(p_session->'players', '[]'::jsonb)) AS player_entry
                    ),
                    '[]'::jsonb
                ),
                'matches',
                COALESCE(
                    (
                        SELECT jsonb_agg(
                                jsonb_build_object(
                                    'id',
                                    match_entry->>'id',
                                    'homeTeam',
                                    match_entry->>'homeTeam',
                                    'awayTeam',
                                    match_entry->>'awayTeam',
                                    'homeGoals',
                                    COALESCE((match_entry->>'homeGoals')::integer, 0),
                                    'awayGoals',
                                    COALESCE((match_entry->>'awayGoals')::integer, 0),
                                    'startTime',
                                    match_entry->>'startTime'
                                )
                                ORDER BY match_entry->>'id'
                            )
                        FROM jsonb_array_elements(COALESCE(p_session->'matches', '[]'::jsonb)) AS match_entry
                    ),
                    '[]'::jsonb
                ),
                'playerAssignments',
                COALESCE(
                    (
                        SELECT jsonb_object_agg(
                                assignment_entry.player_id,
                                assignment_entry.match_ids
                            )
                        FROM (
                                SELECT assignment.key AS player_id,
                                    COALESCE(
                                        (
                                            SELECT jsonb_agg(
                                                    match_id
                                                    ORDER BY match_id
                                                )
                                            FROM jsonb_array_elements_text(assignment.value) AS match_id
                                        ),
                                        '[]'::jsonb
                                    ) AS match_ids
                                FROM jsonb_each(
                                        COALESCE(p_session->'playerAssignments', '{}'::jsonb)
                                    ) AS assignment
                                ORDER BY assignment.key
                            ) AS assignment_entry
                    ),
                    '{}'::jsonb
                )
            )::text,
            'sha256'
        ),
        'hex'
    );
$$;
CREATE OR REPLACE FUNCTION private.import_legacy_history(
        p_claimed_local_participant_id text,
        p_sessions jsonb
    ) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '' AS $$
DECLARE v_account_id uuid := auth.uid();
v_import_state private.legacy_history_import_state %ROWTYPE;
v_existing_session private.legacy_history_import_sessions %ROWTYPE;
v_session jsonb;
v_player jsonb;
v_match jsonb;
v_claimed_name text;
v_session_claimed_local_participant_id text;
v_session_claimed_name text;
v_session_local_id text;
v_source_fingerprint text;
v_session_saved_at timestamptz;
v_cloud_session_id uuid;
v_participant_id uuid;
v_claimed_participant_id uuid;
v_match_id uuid;
v_common_match_id uuid;
v_participant_map jsonb;
v_match_map jsonb;
v_assignment_key text;
v_assignment_value jsonb;
v_local_match_id text;
v_results jsonb := '[]'::jsonb;
v_imported_count integer := 0;
v_skipped_count integer := 0;
v_failed_count integer := 0;
v_any_failure boolean := FALSE;
v_last_error text;
BEGIN IF v_account_id IS NULL THEN RAISE EXCEPTION 'authenticated account required';
END IF;
IF jsonb_typeof(COALESCE(p_sessions, '[]'::jsonb)) <> 'array' THEN RAISE EXCEPTION 'sessions payload must be a JSON array';
END IF;
PERFORM 1
FROM public.accounts
WHERE id = v_account_id;
IF NOT FOUND THEN RAISE EXCEPTION 'account not found for authenticated user %',
v_account_id;
END IF;
SELECT player_entry->>'name' INTO v_claimed_name
FROM jsonb_array_elements(COALESCE(p_sessions, '[]'::jsonb)) AS session_entry,
    LATERAL jsonb_array_elements(
        COALESCE(session_entry->'players', '[]'::jsonb)
    ) AS player_entry
WHERE player_entry->>'id' = p_claimed_local_participant_id
LIMIT 1;
IF v_claimed_name IS NULL THEN RAISE EXCEPTION 'claimed local participant % not found in submitted sessions',
p_claimed_local_participant_id;
END IF;
SELECT * INTO v_import_state
FROM private.legacy_history_import_state
WHERE account_id = v_account_id FOR
UPDATE;
IF FOUND THEN IF v_import_state.claimed_local_participant_name <> v_claimed_name THEN RETURN jsonb_build_object(
    'accountId',
    v_account_id::text,
    'importState',
    'failed',
    'claimedLocalParticipantId',
    v_import_state.claimed_local_participant_id,
    'summary',
    jsonb_build_object(
        'importedCount',
        0,
        'skippedCount',
        0,
        'failedCount',
        1
    ),
    'sessions',
    jsonb_build_array(
        jsonb_build_object(
            'sourceLocalSessionId',
            NULL,
            'sourceFingerprint',
            NULL,
            'state',
            'conflict',
            'errorMessage',
            'Claimed local participant name does not match the existing import state.'
        )
    )
);
END IF;
IF v_import_state.state = 'completed' THEN RETURN jsonb_build_object(
    'accountId',
    v_account_id::text,
    'importState',
    'completed',
    'claimedLocalParticipantId',
    v_import_state.claimed_local_participant_id,
    'summary',
    jsonb_build_object(
        'importedCount',
        0,
        'skippedCount',
        0,
        'failedCount',
        0
    ),
    'sessions',
    '[]'::jsonb
);
END IF;
UPDATE private.legacy_history_import_state
SET claimed_local_participant_name = v_claimed_name,
    state = 'in_progress',
    failed_at = NULL,
    last_error = NULL,
    updated_at = now()
WHERE account_id = v_account_id;
ELSE
INSERT INTO private.legacy_history_import_state (
        account_id,
        claimed_local_participant_id,
        claimed_local_participant_name,
        state,
        started_at,
        created_at,
        updated_at
    )
VALUES (
        v_account_id,
        p_claimed_local_participant_id,
        v_claimed_name,
        'in_progress',
        now(),
        now(),
        now()
    );
END IF;
FOR v_session IN
SELECT value
FROM jsonb_array_elements(COALESCE(p_sessions, '[]'::jsonb)) LOOP v_session_local_id := COALESCE(v_session->>'sourceLocalSessionId', '');
v_session_claimed_local_participant_id := COALESCE(
    NULLIF(v_session->>'claimedLocalParticipantId', ''),
    p_claimed_local_participant_id
);
SELECT player_entry->>'name' INTO v_session_claimed_name
FROM jsonb_array_elements(COALESCE(v_session->'players', '[]'::jsonb)) AS player_entry
WHERE player_entry->>'id' = v_session_claimed_local_participant_id
LIMIT 1;
v_source_fingerprint := private.compute_legacy_history_fingerprint(v_session);
SELECT * INTO v_existing_session
FROM private.legacy_history_import_sessions
WHERE account_id = v_account_id
    AND source_fingerprint = v_source_fingerprint FOR
UPDATE;
IF FOUND
AND v_existing_session.claimed_local_participant_id <> v_session_claimed_local_participant_id THEN
UPDATE private.legacy_history_import_sessions
SET state = 'conflict',
    error_message = 'Claimed local participant does not match the existing imported fingerprint.',
    updated_at = now()
WHERE account_id = v_account_id
    AND source_fingerprint = v_source_fingerprint;
v_results := v_results || jsonb_build_array(
    jsonb_build_object(
        'sourceLocalSessionId',
        v_session_local_id,
        'sourceFingerprint',
        v_source_fingerprint,
        'state',
        'conflict',
        'errorMessage',
        'Claimed local participant does not match the existing imported fingerprint.'
    )
);
v_failed_count := v_failed_count + 1;
v_any_failure := TRUE;
CONTINUE;
END IF;
IF FOUND
AND v_existing_session.state = 'imported'
AND v_existing_session.cloud_session_id IS NOT NULL THEN v_results := v_results || jsonb_build_array(
    jsonb_build_object(
        'sourceLocalSessionId',
        v_existing_session.source_local_session_id,
        'sourceFingerprint',
        v_source_fingerprint,
        'state',
        'skipped',
        'cloudSessionId',
        v_existing_session.cloud_session_id::text
    )
);
v_skipped_count := v_skipped_count + 1;
CONTINUE;
END IF;
INSERT INTO private.legacy_history_import_sessions (
        account_id,
        source_fingerprint,
        source_local_session_id,
        claimed_local_participant_id,
        state,
        error_message,
        created_at,
        updated_at
    )
VALUES (
        v_account_id,
        v_source_fingerprint,
        v_session_local_id,
        v_session_claimed_local_participant_id,
        'pending',
        NULL,
        now(),
        now()
    ) ON CONFLICT (account_id, source_fingerprint) DO
UPDATE
SET source_local_session_id = EXCLUDED.source_local_session_id,
    claimed_local_participant_id = EXCLUDED.claimed_local_participant_id,
    state = 'pending',
    error_message = NULL,
    updated_at = now();
BEGIN IF v_session_claimed_name IS NULL THEN RAISE EXCEPTION 'claimed participant % is missing from source session %',
v_session_claimed_local_participant_id,
v_session_local_id;
END IF;
IF v_session_claimed_name <> v_claimed_name THEN RAISE EXCEPTION 'claimed participant name % does not match selected claimant name % for source session %',
v_session_claimed_name,
v_claimed_name,
v_session_local_id;
END IF;
v_session_saved_at := COALESCE(
    private.try_parse_timestamptz(v_session->>'savedAt'),
    now()
);
v_participant_map := '{}'::jsonb;
v_match_map := '{}'::jsonb;
v_claimed_participant_id := NULL;
v_common_match_id := NULL;
INSERT INTO public.game_sessions (
        host_account_id,
        join_code,
        state,
        created_at,
        started_at,
        completed_at
    )
VALUES (
        v_account_id,
        format(
            'IMP-%s-%s',
            left(v_source_fingerprint, 12),
            replace(extensions.gen_random_uuid()::text, '-', '')
        ),
        'in_progress',
        v_session_saved_at,
        v_session_saved_at,
        NULL
    )
RETURNING id INTO v_cloud_session_id;
FOR v_player IN
SELECT value
FROM jsonb_array_elements(COALESCE(v_session->'players', '[]'::jsonb)) LOOP
INSERT INTO public.participants (
        session_id,
        account_id,
        display_name,
        membership_type,
        current_drink_total,
        guest_rejoin_token_hash,
        created_at
    )
VALUES (
        v_cloud_session_id,
        CASE
            WHEN v_player->>'id' = v_session_claimed_local_participant_id THEN v_account_id
            ELSE NULL
        END,
        COALESCE(v_player->>'name', 'Unknown Player'),
        CASE
            WHEN v_player->>'id' = v_session_claimed_local_participant_id THEN 'registered'::public.participant_membership_type
            ELSE 'guest'::public.participant_membership_type
        END,
        COALESCE((v_player->>'drinksTaken')::numeric, 0),
        CASE
            WHEN v_player->>'id' = v_session_claimed_local_participant_id THEN NULL
            ELSE encode(
                extensions.digest(
                    concat(
                        v_session_local_id,
                        ':',
                        COALESCE(v_player->>'id', ''),
                        ':guest'
                    ),
                    'sha256'
                ),
                'hex'
            )
        END,
        v_session_saved_at
    )
RETURNING id INTO v_participant_id;
v_participant_map := v_participant_map || jsonb_build_object(
    v_player->>'id',
    v_participant_id::text
);
IF v_player->>'id' = v_session_claimed_local_participant_id THEN v_claimed_participant_id := v_participant_id;
END IF;
END LOOP;
IF v_claimed_participant_id IS NULL THEN RAISE EXCEPTION 'claimed participant % could not be created for source session %',
v_session_claimed_local_participant_id,
v_session_local_id;
END IF;
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
        v_cloud_session_id,
        public.allocate_event_sequence(v_cloud_session_id),
        v_claimed_participant_id,
        'session_created',
        'legacy-import:session-created',
        jsonb_build_object(
            'sourceLocalSessionId',
            v_session_local_id,
            'sourceFingerprint',
            v_source_fingerprint,
            'imported',
            TRUE
        ),
        v_session_saved_at
    );
FOR v_player IN
SELECT value
FROM jsonb_array_elements(COALESCE(v_session->'players', '[]'::jsonb)) LOOP
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
        v_cloud_session_id,
        public.allocate_event_sequence(v_cloud_session_id),
        COALESCE(
            (v_participant_map->>(v_player->>'id'))::uuid,
            v_claimed_participant_id
        ),
        'participant_joined',
        concat('legacy-import:participant:', v_player->>'id'),
        jsonb_build_object(
            'localParticipantId',
            v_player->>'id',
            'displayName',
            COALESCE(v_player->>'name', 'Unknown Player'),
            'membershipType',
            CASE
                WHEN v_player->>'id' = v_session_claimed_local_participant_id THEN 'registered'
                ELSE 'guest'
            END,
            'currentDrinkTotal',
            COALESCE((v_player->>'drinksTaken')::numeric, 0)
        ),
        v_session_saved_at
    );
END LOOP;
FOR v_match IN
SELECT value
FROM jsonb_array_elements(COALESCE(v_session->'matches', '[]'::jsonb)) LOOP
INSERT INTO public.matches (
        session_id,
        source_provider,
        source_match_id,
        home_team_name,
        away_team_name,
        kickoff_at,
        home_score,
        away_score,
        created_at
    )
VALUES (
        v_cloud_session_id,
        'legacy_import',
        NULLIF(v_match->>'id', ''),
        COALESCE(v_match->>'homeTeam', 'Unknown Home Team'),
        COALESCE(v_match->>'awayTeam', 'Unknown Away Team'),
        private.try_parse_timestamptz(v_match->>'startTime'),
        COALESCE((v_match->>'homeGoals')::integer, 0),
        COALESCE((v_match->>'awayGoals')::integer, 0),
        v_session_saved_at
    )
RETURNING id INTO v_match_id;
v_match_map := v_match_map || jsonb_build_object(
    v_match->>'id',
    v_match_id::text
);
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
        v_cloud_session_id,
        public.allocate_event_sequence(v_cloud_session_id),
        v_claimed_participant_id,
        'match_added',
        concat('legacy-import:match:', v_match->>'id'),
        jsonb_build_object(
            'localMatchId',
            v_match->>'id',
            'homeTeam',
            COALESCE(v_match->>'homeTeam', 'Unknown Home Team'),
            'awayTeam',
            COALESCE(v_match->>'awayTeam', 'Unknown Away Team'),
            'homeGoals',
            COALESCE((v_match->>'homeGoals')::integer, 0),
            'awayGoals',
            COALESCE((v_match->>'awayGoals')::integer, 0),
            'startTime',
            v_match->>'startTime'
        ),
        v_session_saved_at
    );
END LOOP;
FOR v_assignment_key,
v_assignment_value IN
SELECT key,
    value
FROM jsonb_each(
        COALESCE(v_session->'playerAssignments', '{}'::jsonb)
    ) LOOP FOR v_local_match_id IN
SELECT value
FROM jsonb_array_elements_text(COALESCE(v_assignment_value, '[]'::jsonb)) LOOP IF (v_participant_map->>v_assignment_key) IS NOT NULL
    AND (v_match_map->>v_local_match_id) IS NOT NULL THEN
INSERT INTO public.assignments (
        session_id,
        participant_id,
        match_id,
        created_at
    )
VALUES (
        v_cloud_session_id,
        (v_participant_map->>v_assignment_key)::uuid,
        (v_match_map->>v_local_match_id)::uuid,
        v_session_saved_at
    ) ON CONFLICT (session_id, participant_id, match_id) DO NOTHING;
END IF;
END LOOP;
END LOOP;
IF EXISTS (
    SELECT 1
    FROM jsonb_each(
            COALESCE(v_session->'playerAssignments', '{}'::jsonb)
        )
) THEN
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
        v_cloud_session_id,
        public.allocate_event_sequence(v_cloud_session_id),
        v_claimed_participant_id,
        'assignment_replaced',
        'legacy-import:assignments',
        jsonb_build_object(
            'assignments',
            COALESCE(v_session->'playerAssignments', '{}'::jsonb)
        ),
        v_session_saved_at
    );
END IF;
IF NULLIF(v_session->>'commonMatchId', '') IS NOT NULL THEN v_common_match_id := (v_match_map->>(v_session->>'commonMatchId'))::uuid;
IF v_common_match_id IS NOT NULL THEN
UPDATE public.game_sessions
SET common_match_id = v_common_match_id
WHERE id = v_cloud_session_id;
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
        v_cloud_session_id,
        public.allocate_event_sequence(v_cloud_session_id),
        v_claimed_participant_id,
        'common_match_selected',
        'legacy-import:common-match',
        jsonb_build_object(
            'localMatchId',
            v_session->>'commonMatchId',
            'cloudMatchId',
            v_common_match_id::text
        ),
        v_session_saved_at
    );
END IF;
END IF;
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
        v_cloud_session_id,
        public.allocate_event_sequence(v_cloud_session_id),
        v_claimed_participant_id,
        'session_completed',
        'legacy-import:session-completed',
        jsonb_build_object(
            'sourceFingerprint',
            v_source_fingerprint,
            'imported',
            TRUE
        ),
        v_session_saved_at
    );
UPDATE public.game_sessions
SET state = 'completed',
    started_at = v_session_saved_at,
    completed_at = v_session_saved_at
WHERE id = v_cloud_session_id;
UPDATE private.legacy_history_import_sessions
SET cloud_session_id = v_cloud_session_id,
    state = 'imported',
    error_message = NULL,
    updated_at = now()
WHERE account_id = v_account_id
    AND source_fingerprint = v_source_fingerprint;
v_results := v_results || jsonb_build_array(
    jsonb_build_object(
        'sourceLocalSessionId',
        v_session_local_id,
        'sourceFingerprint',
        v_source_fingerprint,
        'state',
        'imported',
        'cloudSessionId',
        v_cloud_session_id::text
    )
);
v_imported_count := v_imported_count + 1;
EXCEPTION
WHEN OTHERS THEN v_last_error := SQLERRM;
UPDATE private.legacy_history_import_sessions
SET cloud_session_id = NULL,
    state = 'failed',
    error_message = v_last_error,
    updated_at = now()
WHERE account_id = v_account_id
    AND source_fingerprint = v_source_fingerprint;
v_results := v_results || jsonb_build_array(
    jsonb_build_object(
        'sourceLocalSessionId',
        v_session_local_id,
        'sourceFingerprint',
        v_source_fingerprint,
        'state',
        'failed',
        'errorMessage',
        v_last_error
    )
);
v_failed_count := v_failed_count + 1;
v_any_failure := TRUE;
END;
END LOOP;
IF v_any_failure THEN
UPDATE private.legacy_history_import_state
SET state = 'failed',
    failed_at = now(),
    completed_at = NULL,
    last_error = COALESCE(
        v_last_error,
        'One or more legacy sessions failed to import.'
    ),
    updated_at = now()
WHERE account_id = v_account_id;
ELSE
UPDATE private.legacy_history_import_state
SET state = 'completed',
    completed_at = now(),
    failed_at = NULL,
    last_error = NULL,
    updated_at = now()
WHERE account_id = v_account_id;
END IF;
RETURN jsonb_build_object(
    'accountId',
    v_account_id::text,
    'importState',
    CASE
        WHEN v_any_failure THEN 'failed'
        ELSE 'completed'
    END,
    'claimedLocalParticipantId',
    p_claimed_local_participant_id,
    'summary',
    jsonb_build_object(
        'importedCount',
        v_imported_count,
        'skippedCount',
        v_skipped_count,
        'failedCount',
        v_failed_count
    ),
    'sessions',
    v_results
);
END;
$$;
REVOKE ALL ON FUNCTION private.try_parse_timestamptz(text)
FROM PUBLIC,
    anon;
GRANT EXECUTE ON FUNCTION private.try_parse_timestamptz(text) TO authenticated,
    service_role;
REVOKE ALL ON FUNCTION private.compute_legacy_history_fingerprint(jsonb)
FROM PUBLIC,
    anon;
GRANT EXECUTE ON FUNCTION private.compute_legacy_history_fingerprint(jsonb) TO authenticated,
    service_role;
REVOKE ALL ON FUNCTION private.import_legacy_history(text, jsonb)
FROM PUBLIC,
    anon;
GRANT EXECUTE ON FUNCTION private.import_legacy_history(text, jsonb) TO authenticated,
    service_role;
CREATE OR REPLACE FUNCTION public.import_legacy_history(
        claimed_local_participant_id text,
        sessions jsonb
    ) RETURNS jsonb LANGUAGE sql VOLATILE
SET search_path = '' AS $$
SELECT private.import_legacy_history(claimed_local_participant_id, sessions);
$$;
REVOKE ALL ON FUNCTION public.import_legacy_history(text, jsonb)
FROM PUBLIC,
    anon;
GRANT EXECUTE ON FUNCTION public.import_legacy_history(text, jsonb) TO authenticated,
    service_role;