BEGIN;
\ir guest_abuse_setup.inc
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(19);

CREATE TEMP TABLE roster_ctx AS
WITH host AS (
  INSERT INTO auth.users
    (id, aud, role, email, email_confirmed_at, created_at, updated_at,
     raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
  VALUES (gen_random_uuid(), 'authenticated', 'authenticated',
    'active-roster-host@test.local', now(), now(), now(),
    '{"provider":"email"}'::jsonb, '{}'::jsonb, false, false)
  RETURNING id
), account AS (
  INSERT INTO public.accounts (id, preferred_display_name)
  SELECT id, 'Active Roster Host' FROM host RETURNING id
), room AS (
  INSERT INTO public.game_sessions (owner_account_id, join_code)
  SELECT id, 'ROSTER1' FROM account RETURNING id
)
SELECT (SELECT id FROM host) AS host_id, (SELECT id FROM room) AS room_id;

CREATE TEMP TABLE roster_matches (id uuid PRIMARY KEY, label text);
WITH inserted AS (
  INSERT INTO public.matches (session_id, source_provider, home_team_name, away_team_name)
  SELECT room_id, 'espn', label, label || ' Away'
  FROM roster_ctx
  CROSS JOIN (VALUES ('Common'), ('Match 1'), ('Match 2'), ('Match 3'), ('Match 4'), ('Match 5'))
    AS names(label)
  RETURNING id, home_team_name
)
INSERT INTO roster_matches
SELECT id, home_team_name FROM inserted;

UPDATE public.game_sessions
SET common_match_id = (SELECT id FROM roster_matches WHERE label = 'Common'),
    matches_per_player = 1,
    shared_matches_per_pair = 0
WHERE id = (SELECT room_id FROM roster_ctx);

CREATE TEMP TABLE roster_join_results (kind text PRIMARY KEY, payload jsonb);
INSERT INTO roster_join_results VALUES
  ('current', public.join_room_as_guest('ROSTER1', 'Current Guest', repeat('c', 64))),
  ('expired', public.join_room_as_guest('ROSTER1', 'Expired Guest', repeat('e', 64))),
  ('left', public.join_room_as_guest('ROSTER1', 'Left Guest', repeat('d', 64)));

UPDATE public.participants
SET guest_grant_issued_at = now() - interval '2 hours',
    guest_grant_expires_at = now() - interval '1 hour'
WHERE guest_rejoin_token_hash =
  encode(extensions.digest(repeat('e', 64), 'sha256'), 'hex');
UPDATE public.participants
SET left_at = now()
WHERE guest_rejoin_token_hash =
  encode(extensions.digest(repeat('d', 64), 'sha256'), 'hex');

SELECT set_config('request.jwt.claim.sub', (SELECT host_id::text FROM roster_ctx), true);
CREATE TEMP TABLE host_before_start AS
SELECT public.get_room_snapshot((SELECT room_id FROM roster_ctx)) AS snapshot;
CREATE TEMP TABLE guest_before_start AS
SELECT public.get_guest_room_snapshot(repeat('c', 64)) AS snapshot;

SELECT ok(
  to_regprocedure('private.is_active_room_roster_member(text,timestamp with time zone,text,timestamp with time zone)') IS NOT NULL
  AND NOT coalesce(has_function_privilege('anon',
    to_regprocedure('private.is_active_room_roster_member(text,timestamp with time zone,text,timestamp with time zone)'),
    'EXECUTE'), false)
  AND NOT coalesce(has_function_privilege('authenticated',
    to_regprocedure('private.is_active_room_roster_member(text,timestamp with time zone,text,timestamp with time zone)'),
    'EXECUTE'), false),
  'private roster eligibility helper exists and is not client-callable');
SELECT is(jsonb_array_length((SELECT snapshot->'activeRoster' FROM host_before_start)), 2,
  'host snapshot shows registered host and current guest only');
SELECT is(
  (SELECT count(*)::integer
   FROM host_before_start h
   CROSS JOIN LATERAL jsonb_array_elements(h.snapshot->'activeRoster') p
   WHERE p->>'displayName' = 'Current Guest'),
  1, 'current guest remains in the active roster');
SELECT is(
  (SELECT count(*)::integer
   FROM host_before_start h
   CROSS JOIN LATERAL jsonb_array_elements(h.snapshot->'activeRoster') p
   WHERE p->>'displayName' = 'Expired Guest'),
  0, 'expired guest is absent from host live roster');
SELECT is(
  (SELECT count(*)::integer
   FROM host_before_start h
   CROSS JOIN LATERAL jsonb_array_elements(h.snapshot->'activeRoster') p
   WHERE p->>'displayName' = 'Left Guest'),
  0, 'confirmed-left guest is absent from host live roster');
SELECT is(jsonb_array_length((SELECT snapshot->'participants' FROM host_before_start)), 3,
  'existing participants projection retains expired guest identity but omits confirmed leave');
SELECT is((SELECT snapshot->'assignmentPlan'->>'participantCount' FROM host_before_start),
  '2', 'assignment feasibility counts only the active roster');
SELECT is((SELECT snapshot->'activeRoster' FROM guest_before_start),
  (SELECT snapshot->'activeRoster' FROM host_before_start),
  'guest and registered host snapshots share the same live roster');
SELECT is((SELECT snapshot->'participants' FROM guest_before_start),
  (SELECT snapshot->'participants' FROM host_before_start),
  'guest and registered host snapshots preserve the same participant projection');
SELECT is((SELECT snapshot->'assignmentPlan'->>'participantCount' FROM guest_before_start),
  '2', 'guest snapshot reports feasibility for the same active roster');

SELECT throws_ok(
  format(
    'SELECT public.set_room_assignments(%L::uuid, %L::jsonb)',
    (SELECT room_id::text FROM roster_ctx),
    jsonb_build_array(jsonb_build_object(
      'participantId', (SELECT id::text FROM public.participants
        WHERE guest_rejoin_token_hash = encode(extensions.digest(repeat('e',64), 'sha256'), 'hex')),
      'matchId', (SELECT id::text FROM roster_matches WHERE label = 'Match 1')
    ))::text
  ),
  'P0001', 'invalid_assignment',
  'host cannot allocate a match to a grant-expired guest');

CREATE TEMP TABLE roster_started AS
SELECT public.start_game_session(
  (SELECT room_id FROM roster_ctx), gen_random_uuid(), false
) AS result;
SELECT is((SELECT result->>'status' FROM roster_started), 'started',
  'host can start with the eligible active roster');
SELECT ok(NOT EXISTS (
  SELECT 1 FROM public.assignments a
  WHERE a.session_id = (SELECT room_id FROM roster_ctx)
    AND a.participant_id = (SELECT id FROM public.participants
      WHERE guest_rejoin_token_hash = encode(extensions.digest(repeat('e',64), 'sha256'), 'hex'))
), 'game start excludes the expired guest from settled assignments');

CREATE TEMP TABLE started_snapshot AS
SELECT public.get_room_snapshot((SELECT room_id FROM roster_ctx)) AS snapshot;
CREATE TEMP TABLE started_event_count AS
SELECT count(*)::integer AS count FROM public.gameplay_events
WHERE session_id = (SELECT room_id FROM roster_ctx);

UPDATE public.participants
SET guest_grant_issued_at = now() - interval '2 hours',
    guest_grant_expires_at = now() - interval '1 hour'
WHERE guest_rejoin_token_hash =
  encode(extensions.digest(repeat('c', 64), 'sha256'), 'hex');

CREATE TEMP TABLE after_expiry_snapshot AS
SELECT public.get_room_snapshot((SELECT room_id FROM roster_ctx)) AS snapshot;
SELECT is(jsonb_array_length((SELECT snapshot->'activeRoster' FROM after_expiry_snapshot)), 1,
  'after-start expiry changes only the derived active roster');
SELECT is((SELECT snapshot->'participants' FROM after_expiry_snapshot),
  (SELECT snapshot->'participants' FROM started_snapshot),
  'after-start expiry leaves the settled participant projection unchanged');
SELECT is((SELECT snapshot->'assignments' FROM after_expiry_snapshot),
  (SELECT snapshot->'assignments' FROM started_snapshot),
  'after-start expiry leaves settled assignments unchanged');
SELECT is((SELECT snapshot->'matches' FROM after_expiry_snapshot),
  (SELECT snapshot->'matches' FROM started_snapshot),
  'after-start expiry leaves score-bearing match state unchanged');
SELECT is((SELECT count(*)::integer FROM public.gameplay_events
    WHERE session_id = (SELECT room_id FROM roster_ctx)),
  (SELECT count FROM started_event_count),
  'expiry does not fabricate a leave or other gameplay event');
SELECT ok(EXISTS (
  SELECT 1 FROM public.participants
  WHERE guest_rejoin_token_hash =
    encode(extensions.digest(repeat('c', 64), 'sha256'), 'hex')
    AND left_at IS NULL AND guest_grant_expires_at <= now()
), 'expired identity remains stored without being marked as a confirmed leave');

SELECT * FROM finish();
ROLLBACK;
