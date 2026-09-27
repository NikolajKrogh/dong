BEGIN;
\ir guest_abuse_setup.inc
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(24);

CREATE TEMP TABLE matrix_room AS
WITH host AS (
  INSERT INTO auth.users
    (id, aud, role, email, email_confirmed_at, created_at, updated_at,
     raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
  VALUES (gen_random_uuid(), 'authenticated', 'authenticated',
    'matrix-host@test.local', now(), now(), now(),
    '{"provider":"email"}'::jsonb, '{}'::jsonb, false, false)
  RETURNING id
), account AS (
  INSERT INTO public.accounts (id, preferred_display_name)
  SELECT id, 'Matrix Host' FROM host RETURNING id
), room AS (
  INSERT INTO public.game_sessions (owner_account_id, join_code)
  SELECT id, 'MATRIX' FROM account RETURNING id
)
SELECT id FROM room;

CREATE TEMP TABLE matrix_join AS
SELECT public.join_room_as_guest('MATRIX', 'Matrix Guest', repeat('a',64)) AS payload;
SELECT is((SELECT payload->>'ok' FROM matrix_join), NULL::text,
  'join success preserves the historical payload shape');
SELECT ok((SELECT payload->>'participantId' FROM matrix_join) IS NOT NULL,
  'current bearer identifies one participant');
SELECT is((public.rotate_guest_room_grant(repeat('a',64), repeat('b',64),
  '00000000-0000-4000-8000-000000000306')->>'ok'), 'true',
  'rotation succeeds with current bearer');

SELECT is((public.get_guest_room_snapshot(repeat('a',64))->>'code'),
  'guest_access_lost', 'replaced bearer cannot read');
SELECT is((public.get_guest_room_snapshot(repeat('b',64))->>'sessionId'),
  (SELECT id::text FROM matrix_room), 'replacement bearer reads only its room');
SELECT throws_ok(
  format('SELECT public.set_my_room_picks_as_guest(%L, NULL::uuid[])', repeat('a',64)),
  'P0001', 'guest_token_expired', 'replaced bearer cannot submit picks');

UPDATE public.game_sessions SET state='in_progress'::public.session_state
WHERE id=(SELECT id FROM matrix_room);
SELECT throws_ok(
  format('SELECT public.change_manual_score_as_guest(%L, %L::uuid, %L, 1, %L::uuid)',
    repeat('a',64), gen_random_uuid(), 'home', gen_random_uuid()),
  'P0001', 'guest_token_expired', 'replaced bearer cannot change a score');
SELECT throws_ok(
  format('SELECT public.change_participant_drink_as_guest(%L, %L::uuid, 1, %L::uuid)',
    repeat('a',64), gen_random_uuid(), gen_random_uuid()),
  'P0001', 'guest_token_expired', 'replaced bearer cannot change drinks');
SELECT is((public.leave_room_as_guest(repeat('b',64))->>'code'),
  'not_permitted', 'in-progress leave does not falsely revoke');

UPDATE public.game_sessions SET state='completed'::public.session_state
WHERE id=(SELECT id FROM matrix_room);
SELECT is((public.get_guest_room_snapshot(repeat('b',64))->>'finalOnly'),
  'true', 'completed room allows final-only read');
SELECT throws_ok(
  format('SELECT public.change_participant_drink_as_guest(%L, %L::uuid, 1, %L::uuid)',
    repeat('b',64), gen_random_uuid(), gen_random_uuid()),
  'P0001', 'guest_token_expired', 'completed room denies mutation');

UPDATE public.game_sessions SET state='closed'::public.session_state
WHERE id=(SELECT id FROM matrix_room);
SELECT is((public.get_guest_room_snapshot(repeat('b',64))->>'code'),
  'guest_access_lost', 'closed room denies final read');
SELECT ok(NOT has_function_privilege('anon',
  'private.change_manual_score_as_guest(text,uuid,text,integer,uuid)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated',
  'private.change_participant_drink_as_guest(text,uuid,integer,uuid)', 'EXECUTE'),
  'API roles cannot bypass command wrappers through private functions');
SELECT ok(NOT has_table_privilege('anon', 'private.guest_abuse_windows', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'private.guest_abuse_config', 'UPDATE'),
  'API roles cannot inspect counters or change thresholds');
SELECT ok(NOT has_column_privilege('authenticated', 'public.participants',
  'guest_rejoin_token_hash', 'SELECT'),
  'signed-in API role cannot read bearer hashes');
SELECT ok(
  has_function_privilege('authenticated', 'public.get_room_snapshot(uuid)', 'EXECUTE')
  AND has_function_privilege('authenticated',
    'public.change_manual_score(uuid,uuid,text,integer,uuid)', 'EXECUTE')
  AND has_function_privilege('authenticated',
    'public.change_participant_drink(uuid,uuid,integer,uuid)', 'EXECUTE'),
  'registered snapshot and gameplay command wrappers remain available');
SELECT ok(NOT EXISTS (
  SELECT 1 FROM public.gameplay_events e WHERE e.session_id=(SELECT id FROM matrix_room)
    AND (e.payload::text LIKE '%' || repeat('a',64) || '%'
      OR e.payload::text LIKE '%' || repeat('b',64) || '%'
      OR e.payload::text LIKE '%MATRIX%')
), 'immutable events contain no raw bearer or full join code');
SELECT is((SELECT count(*)::text FROM public.gameplay_events e
  WHERE e.session_id=(SELECT id FROM matrix_room)
    AND e.event_type='participant_joined'), '1',
  'rotation and denied commands preserve one join event');

CREATE TEMP TABLE matrix_room_two AS
WITH room AS (
  INSERT INTO public.game_sessions (owner_account_id, join_code)
  SELECT gs.owner_account_id, 'MTRX02' FROM public.game_sessions gs
  WHERE gs.id=(SELECT id FROM matrix_room)
  RETURNING id
)
SELECT id FROM room;
SELECT public.join_room_as_guest('MTRX02', 'Replaced', repeat('c',64));
SELECT public.join_room_as_guest('MTRX02', 'Expired', repeat('d',64));
SELECT public.join_room_as_guest('MTRX02', 'Left', repeat('e',64));
SELECT public.join_room_as_guest('MTRX02', 'Current', repeat('f',64));
SELECT public.rotate_guest_room_grant(repeat('c',64), repeat('1',64),
  '00000000-0000-4000-8000-000000000307');
UPDATE public.participants SET
  guest_grant_issued_at=now()-interval '49 hours',
  guest_grant_expires_at=now()-interval '1 hour'
WHERE session_id=(SELECT id FROM matrix_room_two)
  AND guest_rejoin_token_hash=encode(extensions.digest(repeat('d',64),'sha256'),'hex');
SELECT public.leave_room_as_guest(repeat('e',64));

CREATE FUNCTION pg_temp.guest_invalid_entrypoints(p_token text) RETURNS boolean
LANGUAGE plpgsql AS $$
DECLARE v_id uuid := gen_random_uuid();
BEGIN
  IF public.get_guest_room_snapshot(p_token)->>'code' <> 'guest_access_lost'
     OR public.rotate_guest_room_grant(p_token, repeat('2',64), v_id)->>'code' <> 'guest_access_lost'
     OR public.leave_room_as_guest(p_token)->>'status' <> 'already_invalid' THEN
    RETURN false;
  END IF;
  BEGIN
    PERFORM public.set_my_room_picks_as_guest(p_token, NULL::uuid[]);
    RETURN false;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'guest_token_expired' THEN RETURN false; END IF;
  END;
  BEGIN
    PERFORM public.change_manual_score_as_guest(p_token, v_id, 'home', 1, gen_random_uuid());
    RETURN false;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'guest_token_expired' THEN RETURN false; END IF;
  END;
  BEGIN
    PERFORM public.change_participant_drink_as_guest(p_token, v_id, 1, gen_random_uuid());
    RETURN false;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'guest_token_expired' THEN RETURN false; END IF;
  END;
  RETURN true;
END;
$$;
SELECT ok(pg_temp.guest_invalid_entrypoints(repeat('c',64)),
  'replaced bearer is denied by every read, write, renewal, and leave entry point');
SELECT ok(pg_temp.guest_invalid_entrypoints(repeat('d',64)),
  'expired bearer is denied by every guest entry point');
SELECT ok(pg_temp.guest_invalid_entrypoints(repeat('e',64)),
  'left bearer is denied by every guest entry point');
SELECT ok(pg_temp.guest_invalid_entrypoints(repeat('9',64)),
  'unknown bearer is denied by every guest entry point');
SELECT is((public.get_guest_room_snapshot(repeat('f',64))->>'sessionId'),
  (SELECT id::text FROM matrix_room_two),
  'current unaffected bearer still reads its own room');

-- Simulate an internal snapshot fault inside this rolled-back test only. A
-- transient server failure must not masquerade as a revoked credential.
CREATE OR REPLACE FUNCTION private.get_guest_room_snapshot(p_guest_token text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'snapshot_internal_fault';
END;
$$;
SELECT throws_ok(
  format('SELECT public.get_guest_room_snapshot(%L)', repeat('f',64)),
  'P0001', 'snapshot_internal_fault',
  'internal snapshot failures are not mislabeled as invalid guest grants');

SELECT * FROM finish();
ROLLBACK;
