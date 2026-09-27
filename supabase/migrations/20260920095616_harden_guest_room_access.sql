-- #191: additive guest grant schema. The migration stays forward-compatible with
-- old guest RPC signatures while clients roll out.

-- The data backfills below fire deferred participant/owner constraints. Run
-- these checks immediately during this migration so pending trigger events do
-- not block subsequent ALTER TABLE statements in the same transaction.
SET CONSTRAINTS ALL IMMEDIATE;

-- Legacy history imports used a deterministic placeholder hash based only on
-- source IDs. The same history may be imported by multiple accounts. These
-- completed-room guests have no usable bearer, so replace the placeholders
-- with distinct, non-derivable hashes before enforcing global uniqueness.
UPDATE public.participants p
SET guest_rejoin_token_hash = encode(extensions.gen_random_bytes(32), 'hex')
FROM public.game_sessions gs
WHERE p.session_id = gs.id
  AND p.membership_type = 'guest'::public.participant_membership_type
  AND gs.join_code LIKE 'IMP-%'
  AND gs.state = 'completed'::public.session_state;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.participants p
    WHERE p.membership_type = 'guest'::public.participant_membership_type
      AND p.guest_rejoin_token_hash IS NOT NULL
    GROUP BY p.guest_rejoin_token_hash
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'duplicate_guest_token_hash_preflight';
  END IF;
END $$;

ALTER TABLE public.participants
  ADD COLUMN guest_grant_issued_at timestamptz,
  ADD COLUMN guest_grant_expires_at timestamptz,
  ADD COLUMN guest_grant_previous_hash text,
  ADD COLUMN guest_grant_rotation_id uuid,
  ADD COLUMN guest_grant_retry_until timestamptz;

-- Backfill once, using the migration's server time rather than an old device
-- clock. Historical departed guests remain denied and need no new grant.
UPDATE public.participants p
SET guest_grant_issued_at = now(),
    guest_grant_expires_at = now() + interval '48 hours'
WHERE p.membership_type = 'guest'::public.participant_membership_type
  AND p.left_at IS NULL;

ALTER TABLE public.participants
  ADD CONSTRAINT chk_guest_grant_timestamps CHECK (
    (membership_type = 'registered'::public.participant_membership_type
      AND guest_grant_issued_at IS NULL
      AND guest_grant_expires_at IS NULL
      AND guest_grant_previous_hash IS NULL
      AND guest_grant_rotation_id IS NULL
      AND guest_grant_retry_until IS NULL)
    OR
    (membership_type = 'guest'::public.participant_membership_type
      AND (left_at IS NOT NULL OR
        (guest_grant_issued_at IS NOT NULL AND guest_grant_expires_at IS NOT NULL))
      AND (guest_grant_expires_at IS NULL OR
        (guest_grant_issued_at IS NOT NULL
          AND guest_grant_expires_at > guest_grant_issued_at
          AND guest_grant_expires_at <= guest_grant_issued_at + interval '48 hours'))
      AND ((guest_grant_previous_hash IS NULL AND guest_grant_rotation_id IS NULL
            AND guest_grant_retry_until IS NULL)
        OR (guest_grant_previous_hash IS NOT NULL AND guest_grant_rotation_id IS NOT NULL
            AND guest_grant_retry_until IS NOT NULL)))
  );

CREATE UNIQUE INDEX ux_participants_guest_token_global
  ON public.participants (guest_rejoin_token_hash)
  WHERE membership_type = 'guest'::public.participant_membership_type
    AND guest_rejoin_token_hash IS NOT NULL;

CREATE INDEX idx_participants_guest_previous_hash
  ON public.participants (guest_grant_previous_hash)
  WHERE guest_grant_previous_hash IS NOT NULL;

-- Existing room-member RLS allowed authenticated callers to SELECT * from
-- participants, including every guest verifier. Keep ordinary member reads,
-- but narrow direct column privileges to non-credential fields.
REVOKE SELECT ON public.participants FROM authenticated;
GRANT SELECT (
  id, session_id, account_id, display_name, membership_type,
  current_drink_total, created_at, session_role, left_at
) ON public.participants TO authenticated;

-- Covers legacy join paths during the client transition, including their
-- existing raw-token input format. The new client supplies a 256-bit token.
CREATE FUNCTION private.initialize_guest_grant() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  -- New imports still use the old placeholder generator. Replace its output
  -- at insertion time; imported guests must never acquire a usable bearer.
  IF NEW.membership_type = 'guest'::public.participant_membership_type
     AND EXISTS (
       SELECT 1 FROM public.game_sessions gs
       WHERE gs.id = NEW.session_id AND gs.join_code LIKE 'IMP-%'
     ) THEN
    NEW.guest_rejoin_token_hash := encode(extensions.gen_random_bytes(32), 'hex');
  END IF;
  IF NEW.membership_type = 'guest'::public.participant_membership_type
     AND NEW.left_at IS NULL THEN
    NEW.guest_grant_issued_at := coalesce(NEW.guest_grant_issued_at, now());
    NEW.guest_grant_expires_at := coalesce(
      NEW.guest_grant_expires_at,
      NEW.guest_grant_issued_at + interval '48 hours'
    );
  END IF;
  RETURN NEW;
END;
$$;

-- A replacement is committed only after the current grant, room, and exact
-- operation tuple have been checked under the same room/participant locks.
CREATE FUNCTION private.rotate_guest_room_grant(
  p_old_token text, p_new_token text, p_operation_id uuid
) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_old_hash text;
  v_new_hash text;
  v_session_id uuid;
  v_room public.game_sessions;
  v_guest public.participants;
BEGIN
  IF p_old_token !~ '^[0-9a-fA-F]{64}$'
     OR p_new_token !~ '^[0-9a-fA-F]{64}$'
     OR p_operation_id IS NULL
     OR p_old_token = p_new_token THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_request');
  END IF;
  v_old_hash := encode(extensions.digest(p_old_token, 'sha256'), 'hex');
  v_new_hash := encode(extensions.digest(p_new_token, 'sha256'), 'hex');

  -- Serialize any join/rotation that proposes this hash before either takes a
  -- room lock. The unique current-hash index remains the final backstop.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_new_hash, 0));

  SELECT p.session_id INTO v_session_id FROM public.participants p
  WHERE p.membership_type = 'guest'::public.participant_membership_type
    AND (p.guest_rejoin_token_hash = v_old_hash
         OR p.guest_grant_previous_hash = v_old_hash);
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'guest_access_lost');
  END IF;

  SELECT gs.* INTO v_room FROM public.game_sessions gs
  WHERE gs.id = v_session_id FOR UPDATE;
  IF NOT FOUND OR v_room.state NOT IN (
    'joinable'::public.session_state, 'in_progress'::public.session_state
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'room_unavailable');
  END IF;

  SELECT p.* INTO v_guest FROM public.participants p
  WHERE p.session_id = v_session_id
    AND p.membership_type = 'guest'::public.participant_membership_type
    AND (p.guest_rejoin_token_hash = v_old_hash
         OR p.guest_grant_previous_hash = v_old_hash)
  FOR UPDATE;
  IF NOT FOUND OR v_guest.left_at IS NOT NULL
     OR v_guest.guest_grant_expires_at <= now() THEN
    RETURN jsonb_build_object('ok', false, 'code', 'guest_access_lost');
  END IF;

  IF v_guest.guest_rejoin_token_hash = v_old_hash THEN
    IF EXISTS (
      SELECT 1 FROM public.participants p
      WHERE p.membership_type = 'guest'::public.participant_membership_type
        AND (p.guest_rejoin_token_hash = v_new_hash
             OR p.guest_grant_previous_hash = v_new_hash)
    ) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'guest_access_lost');
    END IF;
    UPDATE public.participants p SET
      guest_grant_previous_hash = v_old_hash,
      guest_rejoin_token_hash = v_new_hash,
      guest_grant_rotation_id = p_operation_id,
      guest_grant_retry_until = now() + interval '5 minutes',
      guest_grant_issued_at = now(),
      guest_grant_expires_at = now() + interval '48 hours'
    WHERE p.id = v_guest.id
    RETURNING p.* INTO v_guest;
    RETURN jsonb_build_object(
      'ok', true, 'participantId', v_guest.id::text,
      'grantExpiresAt', v_guest.guest_grant_expires_at,
      'replayed', false
    );
  END IF;

  IF v_guest.guest_grant_previous_hash = v_old_hash
     AND v_guest.guest_rejoin_token_hash = v_new_hash
     AND v_guest.guest_grant_rotation_id = p_operation_id
     AND v_guest.guest_grant_retry_until >= now() THEN
    RETURN jsonb_build_object(
      'ok', true, 'participantId', v_guest.id::text,
      'grantExpiresAt', v_guest.guest_grant_expires_at,
      'replayed', true
    );
  END IF;
  RETURN jsonb_build_object('ok', false, 'code', 'guest_access_lost');
END;
$$;

REVOKE ALL ON FUNCTION private.rotate_guest_room_grant(text, text, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.rotate_guest_room_grant(text, text, uuid)
  TO service_role;

CREATE FUNCTION public.rotate_guest_room_grant(
  old_token text, new_token text, operation_id uuid
) RETURNS jsonb
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
SELECT private.rotate_guest_room_grant(old_token, new_token, operation_id);
$$;
REVOKE ALL ON FUNCTION public.rotate_guest_room_grant(text, text, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rotate_guest_room_grant(text, text, uuid)
  TO anon, authenticated;

REVOKE ALL ON FUNCTION private.initialize_guest_grant() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER initialize_guest_grant_before_insert
  BEFORE INSERT ON public.participants
  FOR EACH ROW EXECUTE FUNCTION private.initialize_guest_grant();

CREATE OR REPLACE FUNCTION private.resolve_guest_participant(p_guest_token text)
RETURNS public.participants
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_hash text;
  v_participant public.participants;
BEGIN
  IF btrim(coalesce(p_guest_token, '')) = ''
     OR length(p_guest_token) > 128 THEN
    RAISE EXCEPTION 'guest_token_expired';
  END IF;

  v_hash := encode(extensions.digest(btrim(p_guest_token), 'sha256'), 'hex');
  SELECT p.* INTO v_participant
  FROM public.participants p
  JOIN public.game_sessions gs ON gs.id = p.session_id
  WHERE p.guest_rejoin_token_hash = v_hash
    AND p.membership_type = 'guest'::public.participant_membership_type
    AND p.left_at IS NULL
    AND p.guest_grant_expires_at > now()
    AND gs.state <> 'closed'::public.session_state;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'guest_token_expired';
  END IF;
  RETURN v_participant;
END;
$$;

REVOKE ALL ON FUNCTION private.resolve_guest_participant(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.resolve_guest_participant(text) TO service_role;

-- Mutating guest commands acquire the room lock before the participant lock.
-- Re-check after both locks: a rotation/leave/closure that won the race must
-- invalidate the token before any command can make a shared-state write.
CREATE FUNCTION private.lock_guest_participant(
  p_guest_token text,
  p_allowed_states public.session_state[]
) RETURNS public.participants
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_hash text;
  v_session_id uuid;
  v_room public.game_sessions;
  v_participant public.participants;
BEGIN
  IF btrim(coalesce(p_guest_token, '')) = ''
     OR length(p_guest_token) > 128 THEN
    RAISE EXCEPTION 'guest_token_expired';
  END IF;
  v_hash := encode(extensions.digest(btrim(p_guest_token), 'sha256'), 'hex');

  SELECT p.session_id INTO v_session_id
  FROM public.participants p
  WHERE p.guest_rejoin_token_hash = v_hash
    AND p.membership_type = 'guest'::public.participant_membership_type;
  IF NOT FOUND THEN RAISE EXCEPTION 'guest_token_expired'; END IF;

  SELECT gs.* INTO v_room FROM public.game_sessions gs
  WHERE gs.id = v_session_id FOR UPDATE;
  IF NOT FOUND OR NOT (v_room.state = ANY(p_allowed_states)) THEN
    RAISE EXCEPTION 'guest_token_expired';
  END IF;

  SELECT p.* INTO v_participant FROM public.participants p
  WHERE p.session_id = v_session_id
    AND p.guest_rejoin_token_hash = v_hash
    AND p.membership_type = 'guest'::public.participant_membership_type
    AND p.left_at IS NULL
    AND p.guest_grant_expires_at > now()
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'guest_token_expired'; END IF;
  RETURN v_participant;
END;
$$;

REVOKE ALL ON FUNCTION private.lock_guest_participant(text, public.session_state[])
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.lock_guest_participant(text, public.session_state[])
  TO service_role;

-- Earlier migrations explicitly granted these helpers to API roles. Keep the
-- narrow public entry points, but remove the direct privileged paths.
REVOKE ALL ON FUNCTION private.join_room_as_guest(text, text, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.get_guest_room_snapshot(text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.leave_room_as_guest(text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.set_my_room_picks_as_guest(text, uuid[])
  FROM PUBLIC, anon, authenticated;

-- The old join wrapper was SECURITY INVOKER and relied on the above grant.
-- Promote the wrapper to a pinned-path definer, as the other guest wrappers
-- already are, so a denied private helper does not break invited joins.
ALTER FUNCTION public.join_room_as_guest(text, text, text) SECURITY DEFINER;
REVOKE ALL ON FUNCTION public.join_room_as_guest(text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.join_room_as_guest(text, text, text)
  TO anon, authenticated;

CREATE OR REPLACE FUNCTION private.join_room_as_guest(
  p_join_code text, p_guest_name text, p_guest_token text
) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_code text := upper(btrim(coalesce(p_join_code, '')));
  v_name text := btrim(coalesce(p_guest_name, ''));
  v_token text := btrim(coalesce(p_guest_token, ''));
  v_hash text;
  v_bound public.participants;
  v_room public.game_sessions;
  v_guest public.participants;
BEGIN
  IF v_code = '' OR v_name = '' OR v_token = ''
     OR length(v_code) > 64 OR length(v_name) > 80
     OR length(v_token) > 128 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_request');
  END IF;
  v_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_hash, 0));

  -- A replaced hash is still bound to its original identity and cannot be
  -- recycled into another room. The global index backs current-hash races.
  SELECT p.* INTO v_bound FROM public.participants p
  WHERE (p.guest_rejoin_token_hash = v_hash
     OR p.guest_grant_previous_hash = v_hash)
    AND p.membership_type = 'guest'::public.participant_membership_type;

  SELECT gs.* INTO v_room FROM public.game_sessions gs
  WHERE gs.join_code = v_code FOR UPDATE;
  IF NOT FOUND OR v_room.state = 'closed'::public.session_state THEN
    RETURN jsonb_build_object('ok', false, 'code', 'room_unavailable');
  END IF;

  IF v_bound.id IS NOT NULL THEN
    SELECT p.* INTO v_guest FROM public.participants p
    WHERE p.id = v_bound.id FOR UPDATE;
    IF v_guest.session_id <> v_room.id OR v_guest.left_at IS NOT NULL
       OR v_guest.guest_rejoin_token_hash <> v_hash
       OR v_guest.guest_grant_expires_at <= now() THEN
      RETURN jsonb_build_object('ok', false, 'code', 'room_unavailable');
    END IF;
    RETURN jsonb_build_object(
      'participantId', v_guest.id::text,
      'sessionId', v_room.id::text,
      'guestToken', v_token,
      'joinCode', v_room.join_code,
      'displayName', v_guest.display_name,
      'grantExpiresAt', v_guest.guest_grant_expires_at,
      'snapshot', private.authoritative_snapshot(v_room.id)
    );
  END IF;

  IF v_room.state <> 'joinable'::public.session_state THEN
    RETURN jsonb_build_object('ok', false, 'code', 'room_unavailable');
  END IF;

  BEGIN
    INSERT INTO public.participants (
      session_id, account_id, display_name, membership_type, session_role,
      current_drink_total, guest_rejoin_token_hash, created_at
    ) VALUES (
      v_room.id, NULL, v_name, 'guest'::public.participant_membership_type,
      'member'::public.participant_session_role, 0, v_hash, now()
    ) RETURNING * INTO v_guest;
  EXCEPTION WHEN unique_violation THEN
    -- A concurrent reuse of the token in another room must not surface an
    -- index error or create a second identity. Same-room requests serialize
    -- on the room row and are resolved by the branch above.
    RETURN jsonb_build_object('ok', false, 'code', 'room_unavailable');
  END;

  INSERT INTO public.gameplay_events (
    session_id, sequence_number, actor_participant_id, event_type,
    idempotency_key, payload, created_at
  ) VALUES (
    v_room.id, public.allocate_event_sequence(v_room.id), v_guest.id,
    'participant_joined', concat('guest-join:', v_guest.id::text),
    jsonb_build_object(
      'participantId', v_guest.id::text,
      'displayName', v_guest.display_name,
      'membershipType', 'guest', 'sessionRole', 'member', 'replayed', false
    ), now()
  );

  RETURN jsonb_build_object(
    'participantId', v_guest.id::text,
    'sessionId', v_room.id::text,
    'guestToken', v_token,
    'joinCode', v_room.join_code,
    'displayName', v_guest.display_name,
    'grantExpiresAt', v_guest.guest_grant_expires_at,
    'snapshot', private.authoritative_snapshot(v_room.id)
  );
END;
$$;

CREATE OR REPLACE FUNCTION private.leave_room_as_guest(p_guest_token text)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_hash text;
  v_session_id uuid;
  v_room public.game_sessions;
  v_guest public.participants;
BEGIN
  IF btrim(coalesce(p_guest_token, '')) = ''
     OR length(p_guest_token) > 128 THEN
    RETURN jsonb_build_object('ok', true, 'status', 'already_invalid');
  END IF;
  v_hash := encode(extensions.digest(btrim(p_guest_token), 'sha256'), 'hex');
  SELECT p.session_id INTO v_session_id FROM public.participants p
  WHERE p.guest_rejoin_token_hash = v_hash
    AND p.membership_type = 'guest'::public.participant_membership_type;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true, 'status', 'already_invalid');
  END IF;

  SELECT gs.* INTO v_room FROM public.game_sessions gs
  WHERE gs.id = v_session_id FOR UPDATE;
  IF NOT FOUND OR v_room.state = 'closed'::public.session_state THEN
    RETURN jsonb_build_object('ok', true, 'status', 'already_invalid');
  END IF;
  SELECT p.* INTO v_guest FROM public.participants p
  WHERE p.session_id = v_session_id
    AND p.guest_rejoin_token_hash = v_hash
    AND p.membership_type = 'guest'::public.participant_membership_type
  FOR UPDATE;
  IF NOT FOUND OR v_guest.left_at IS NOT NULL
     OR v_guest.guest_grant_expires_at <= now() THEN
    RETURN jsonb_build_object('ok', true, 'status', 'already_invalid');
  END IF;

  IF v_room.state <> 'joinable'::public.session_state THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_permitted');
  END IF;

  UPDATE public.participants p SET left_at = now()
  WHERE p.id = v_guest.id AND p.left_at IS NULL;
  INSERT INTO public.gameplay_events (
    session_id, sequence_number, actor_participant_id, event_type,
    idempotency_key, payload, created_at
  ) VALUES (
    v_session_id, public.allocate_event_sequence(v_session_id), v_guest.id,
    'participant_left', concat('guest-left:', v_guest.id::text),
    jsonb_build_object('participantId', v_guest.id::text, 'membershipType', 'guest'),
    now()
  );
  RETURN jsonb_build_object('ok', true, 'status', 'confirmed');
END;
$$;

REVOKE ALL ON FUNCTION private.leave_room_as_guest(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.leave_room_as_guest(text) TO service_role;

CREATE OR REPLACE FUNCTION private.get_guest_room_snapshot(p_guest_token text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_guest public.participants;
  v_room public.game_sessions;
  v_snapshot jsonb;
BEGIN
  v_guest := private.resolve_guest_participant(p_guest_token);
  SELECT gs.* INTO v_room FROM public.game_sessions gs WHERE gs.id = v_guest.session_id;
  IF NOT FOUND OR v_room.state = 'closed'::public.session_state THEN
    RAISE EXCEPTION 'guest_token_expired';
  END IF;
  v_snapshot := private.authoritative_snapshot(v_guest.session_id)
    || jsonb_build_object('grantExpiresAt', v_guest.guest_grant_expires_at);
  IF v_room.state = 'completed'::public.session_state THEN
    -- Keep score/assignment results, but not mutable pick or start controls.
    v_snapshot := jsonb_set(v_snapshot, '{picks}', '[]'::jsonb, true);
    v_snapshot := jsonb_set(v_snapshot, '{assignmentPlan,startable}', 'false'::jsonb, true);
    RETURN v_snapshot || jsonb_build_object('finalOnly', true);
  END IF;
  RETURN v_snapshot || jsonb_build_object('finalOnly', false);
END;
$$;

-- US3 will add quota writes; switch the wrapper volatility ahead of that.
ALTER FUNCTION public.get_guest_room_snapshot(text) VOLATILE;

CREATE OR REPLACE FUNCTION private.set_my_room_picks_as_guest(
  p_guest_token text, p_match_ids uuid[]
) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_guest public.participants;
  v_room public.game_sessions;
BEGIN
  v_guest := private.lock_guest_participant(
    p_guest_token, ARRAY['joinable'::public.session_state]);
  SELECT gs.* INTO v_room FROM public.game_sessions gs WHERE gs.id = v_guest.session_id;
  IF v_room.assignment_mode <> 'player_picked'::public.assignment_mode THEN
    RAISE EXCEPTION 'room_not_player_picked';
  END IF;
  PERFORM private.write_room_picks(
    v_guest.session_id, v_guest.id, p_match_ids,
    v_room.common_match_id, v_room.matches_per_player);
END;
$$;

CREATE OR REPLACE FUNCTION private.change_manual_score_as_guest(
  p_guest_token text, p_match_id uuid, p_team text,
  p_delta_goals integer, p_idempotency_key uuid
) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_guest public.participants;
BEGIN
  v_guest := private.lock_guest_participant(
    p_guest_token, ARRAY['in_progress'::public.session_state]);
  RETURN private.change_manual_score_for_participant(
    v_guest.session_id, v_guest.id, p_match_id, p_team,
    p_delta_goals, p_idempotency_key);
END;
$$;

CREATE OR REPLACE FUNCTION private.change_participant_drink_as_guest(
  p_guest_token text, p_target_participant_id uuid,
  p_delta_half_drinks integer, p_idempotency_key uuid
) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_guest public.participants;
BEGIN
  v_guest := private.lock_guest_participant(
    p_guest_token, ARRAY['in_progress'::public.session_state]);
  RETURN private.change_participant_drink_for_actor(
    v_guest.session_id, v_guest.id, p_target_participant_id,
    p_delta_half_drinks, p_idempotency_key);
END;
$$;

REVOKE ALL ON FUNCTION private.get_guest_room_snapshot(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.set_my_room_picks_as_guest(text, uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.change_manual_score_as_guest(text, uuid, text, integer, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.change_participant_drink_as_guest(text, uuid, integer, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.get_guest_room_snapshot(text) TO service_role;
GRANT EXECUTE ON FUNCTION private.set_my_room_picks_as_guest(text, uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION private.change_manual_score_as_guest(text, uuid, text, integer, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION private.change_participant_drink_as_guest(text, uuid, integer, uuid) TO service_role;

-- Caller/code/token dimensions are never stored in plaintext. The Vault key
-- must be provisioned separately; a missing key fails closed at admission.
CREATE TABLE private.guest_abuse_windows (
  kind text NOT NULL,
  key_digest text NOT NULL,
  window_start timestamptz NOT NULL,
  count integer NOT NULL CHECK (count > 0),
  expires_at timestamptz NOT NULL,
  last_reason text,
  PRIMARY KEY (kind, key_digest, window_start)
);
CREATE INDEX idx_guest_abuse_windows_expiry ON private.guest_abuse_windows (expires_at);
REVOKE ALL ON TABLE private.guest_abuse_windows FROM PUBLIC, anon, authenticated;

CREATE TABLE private.guest_abuse_config (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  join_caller_limit integer NOT NULL DEFAULT 20 CHECK (join_caller_limit BETWEEN 1 AND 100),
  join_code_limit integer NOT NULL DEFAULT 40 CHECK (join_code_limit BETWEEN 1 AND 200),
  invalid_caller_limit integer NOT NULL DEFAULT 20 CHECK (invalid_caller_limit BETWEEN 1 AND 100),
  invalid_token_limit integer NOT NULL DEFAULT 5 CHECK (invalid_token_limit BETWEEN 1 AND 50),
  valid_grant_limit integer NOT NULL DEFAULT 90 CHECK (valid_grant_limit BETWEEN 1 AND 300),
  valid_caller_limit integer NOT NULL DEFAULT 600 CHECK (valid_caller_limit BETWEEN 1 AND 2000)
);
INSERT INTO private.guest_abuse_config (singleton) VALUES (true);
REVOKE ALL ON TABLE private.guest_abuse_config FROM PUBLIC, anon, authenticated;

CREATE FUNCTION private.guest_caller_identity() RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_headers jsonb; v_address inet;
BEGIN
  v_headers := nullif(current_setting('request.headers', true), '')::jsonb;
  v_address := btrim(split_part(v_headers->>'x-forwarded-for', ',', 1))::inet;
  RETURN host(v_address);
EXCEPTION WHEN invalid_text_representation OR invalid_parameter_value OR null_value_not_allowed THEN
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION private.guest_caller_identity() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.guest_caller_identity() TO service_role;

CREATE FUNCTION private.take_guest_quota(
  p_kind text, p_value text, p_limit integer, p_window_seconds integer
) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_secret text;
  v_digest text;
  v_window timestamptz;
  v_count integer;
  v_retry integer;
BEGIN
  IF p_kind NOT IN ('join_caller','join_code','invalid_caller','invalid_token',
                    'valid_caller','valid_grant')
     OR p_value IS NULL OR p_value = ''
     OR p_limit < 1 OR p_limit > 2000
     OR p_window_seconds NOT IN (60, 300) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'rate_limited', 'retryAfterSeconds', 60);
  END IF;
  SELECT s.decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets s WHERE s.name = 'dong_guest_abuse_hmac_v1';
  IF v_secret IS NULL OR length(v_secret) < 32 THEN
    RAISE EXCEPTION 'guest_abuse_key_unavailable';
  END IF;
  v_digest := encode(extensions.hmac(
    convert_to(p_kind || ':' || p_value, 'UTF8'),
    convert_to(v_secret, 'UTF8'), 'sha256'), 'hex');
  v_window := to_timestamp(
    floor(extract(epoch FROM clock_timestamp()) / p_window_seconds) * p_window_seconds);
  INSERT INTO private.guest_abuse_windows AS w
    (kind, key_digest, window_start, count, expires_at, last_reason)
  VALUES (p_kind, v_digest, v_window, 1, v_window + interval '7 days', p_kind)
  ON CONFLICT (kind, key_digest, window_start)
  DO UPDATE SET count = w.count + 1, last_reason = p_kind
  RETURNING count INTO v_count;
  v_retry := greatest(1, ceil(extract(epoch FROM
    (v_window + make_interval(secs => p_window_seconds) - clock_timestamp())))::integer);
  IF v_count > p_limit THEN
    RETURN jsonb_build_object('ok', false, 'code', 'rate_limited',
      'retryAfterSeconds', least(v_retry, p_window_seconds));
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;
REVOKE ALL ON FUNCTION private.take_guest_quota(text, text, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.take_guest_quota(text, text, integer, integer)
  TO service_role;

CREATE OR REPLACE FUNCTION public.join_room_as_guest(
  join_code text, guest_name text, guest_token text
) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_caller text;
  v_config private.guest_abuse_config;
  v_caller_limit jsonb;
  v_code_limit jsonb;
BEGIN
  v_caller := private.guest_caller_identity();
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'rate_limited', 'retryAfterSeconds', 60);
  END IF;
  SELECT c.* INTO v_config FROM private.guest_abuse_config c WHERE c.singleton;
  v_caller_limit := private.take_guest_quota('join_caller', v_caller,
    v_config.join_caller_limit, 300);
  IF v_caller_limit->>'ok' = 'false' THEN RETURN v_caller_limit; END IF;
  IF length(coalesce(join_code, '')) > 64
     OR length(coalesce(guest_name, '')) > 80
     OR length(coalesce(guest_token, '')) > 128 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_request');
  END IF;
  v_code_limit := private.take_guest_quota('join_code',
    upper(btrim(coalesce(join_code, ''))), v_config.join_code_limit, 300);
  IF v_code_limit->>'ok' = 'false' THEN RETURN v_code_limit; END IF;
  RETURN private.join_room_as_guest(join_code, guest_name, guest_token);
END;
$$;
REVOKE ALL ON FUNCTION public.join_room_as_guest(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.join_room_as_guest(text, text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_guest_room_snapshot(guest_token text)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_caller text;
  v_config private.guest_abuse_config;
  v_guest public.participants;
  v_hash text;
  v_caller_limit jsonb;
  v_token_limit jsonb;
BEGIN
  v_caller := private.guest_caller_identity();
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'rate_limited', 'retryAfterSeconds', 60);
  END IF;
  SELECT c.* INTO v_config FROM private.guest_abuse_config c WHERE c.singleton;
  IF btrim(coalesce(guest_token, '')) <> ''
     AND length(guest_token) <= 128 THEN
    v_hash := encode(extensions.digest(btrim(guest_token), 'sha256'), 'hex');
    BEGIN
      v_guest := private.resolve_guest_participant(guest_token);
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM <> 'guest_token_expired' THEN RAISE; END IF;
      v_guest := NULL;
    END;
  END IF;
  IF v_guest.id IS NULL THEN
    v_caller_limit := private.take_guest_quota('invalid_caller', v_caller,
      v_config.invalid_caller_limit, 60);
    v_token_limit := private.take_guest_quota('invalid_token',
      coalesce(v_hash, 'blank_or_oversized'), v_config.invalid_token_limit, 60);
  ELSE
    v_caller_limit := private.take_guest_quota('valid_caller', v_caller,
      v_config.valid_caller_limit, 60);
    v_token_limit := private.take_guest_quota('valid_grant',
      v_guest.id::text, v_config.valid_grant_limit, 60);
  END IF;
  IF v_caller_limit->>'ok' = 'false' THEN RETURN v_caller_limit; END IF;
  IF v_token_limit->>'ok' = 'false' THEN RETURN v_token_limit; END IF;
  IF v_guest.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'guest_access_lost');
  END IF;
  BEGIN
    RETURN private.get_guest_room_snapshot(guest_token);
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'guest_token_expired' THEN RAISE; END IF;
    RETURN jsonb_build_object('ok', false, 'code', 'guest_access_lost');
  END;
END;
$$;
REVOKE ALL ON FUNCTION public.get_guest_room_snapshot(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_guest_room_snapshot(text) TO anon, authenticated;
