-- 260_batch_room_matches.test.sql
-- 039_batch_room_matches.sql: add_room_matches / remove_room_matches.
--
-- These exist because the client looped the singular RPCs, paying a room-row lock
-- and a full snapshot refresh per fixture and — because the caller resets its
-- error slot every call — hiding any failure that was not the last one. What is
-- worth testing here is therefore not "does it insert" but the batch semantics:
-- the guards abort everything, a duplicate degrades to a skip rather than an
-- abort, and removal still cascades exactly as the singular form does.
--
-- Result-table pattern and the `request.jwt.claim.sub` impersonation follow
-- 250_player_picked_mode.test.sql.
BEGIN;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(11);

CREATE TEMP TABLE results (name text PRIMARY KEY, passed boolean NOT NULL, detail text);
GRANT SELECT, INSERT ON TABLE results TO authenticated, anon;

-- =============================================================================
-- Fixture: a host, an outsider, and one joinable room.
-- =============================================================================
CREATE TEMP TABLE ctx AS
WITH h AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','brm-h@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
o AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','brm-o@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
acc AS (
    INSERT INTO public.accounts (id, preferred_display_name)
    SELECT id, 'BRM Host' FROM h
    UNION ALL SELECT id, 'BRM Outsider' FROM o
    RETURNING id
),
room AS (
    INSERT INTO public.game_sessions (id, owner_account_id, join_code, state)
    SELECT gen_random_uuid(), (SELECT id FROM h), 'BRM00001', 'joinable'::public.session_state
    RETURNING id
),
owner_p AS (
    INSERT INTO public.participants (id, session_id, account_id, display_name, membership_type, session_role)
    SELECT gen_random_uuid(), (SELECT id FROM room), (SELECT id FROM h), 'BRM Host',
           'registered'::public.participant_membership_type,
           'owner'::public.participant_session_role
    RETURNING id
)
SELECT (SELECT id FROM h) AS host,
       (SELECT id FROM o) AS outsider,
       (SELECT id FROM room) AS room,
       (SELECT id FROM owner_p) AS host_p;
GRANT SELECT ON TABLE ctx TO authenticated, anon;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',true);

-- =============================================================================
-- Authorisation: both guards abort the entire batch.
-- =============================================================================
SELECT set_config('request.jwt.claim.sub', (SELECT outsider::text FROM ctx), true);
DO $$ BEGIN
  BEGIN
    PERFORM public.add_room_matches((SELECT room FROM ctx),
      '[{"sourceProvider":"espn","sourceMatchId":"x1","homeTeamName":"A","awayTeamName":"B","kickoffAt":null}]'::jsonb);
    INSERT INTO results VALUES ('add_not_host', FALSE, 'no error raised');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO results VALUES ('add_not_host', SQLERRM = 'not_host', SQLERRM);
  END;
END $$;

DO $$ BEGIN
  BEGIN
    PERFORM public.remove_room_matches((SELECT room FROM ctx), ARRAY[gen_random_uuid()]);
    INSERT INTO results VALUES ('remove_not_host', FALSE, 'no error raised');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO results VALUES ('remove_not_host', SQLERRM = 'not_host', SQLERRM);
  END;
END $$;

-- Nothing may have landed from the rejected batch.
SELECT is(
  (SELECT count(*)::int FROM public.matches WHERE session_id = (SELECT room FROM ctx)),
  0,
  'a batch rejected by the host guard inserts nothing'
);

-- =============================================================================
-- The happy path, as the host.
-- =============================================================================
SELECT set_config('request.jwt.claim.sub', (SELECT host::text FROM ctx), true);

SELECT is(
  public.add_room_matches((SELECT room FROM ctx), '[
    {"sourceProvider":"espn","sourceMatchId":"e1","homeTeamName":"Alpha","awayTeamName":"Beta","kickoffAt":"2026-08-22T11:30:00Z"},
    {"sourceProvider":"espn","sourceMatchId":"e2","homeTeamName":"Gamma","awayTeamName":"Delta","kickoffAt":"2026-08-22T14:00:00Z"},
    {"sourceProvider":"manual","sourceMatchId":null,"homeTeamName":"Local","awayTeamName":"Rovers","kickoffAt":null}
  ]'::jsonb),
  '{"added": 3, "skipped": 0}'::jsonb,
  'a fresh batch reports every fixture as added'
);

SELECT is(
  (SELECT count(*)::int FROM public.matches WHERE session_id = (SELECT room FROM ctx)),
  3,
  'all three fixtures are in the pool'
);

SELECT is(
  (SELECT kickoff_at FROM public.matches
    WHERE session_id = (SELECT room FROM ctx) AND source_match_id = 'e1'),
  '2026-08-22T11:30:00Z'::timestamptz,
  'the ISO kickoff survives the jsonb round trip'
);

-- A repeat is a skip, not an abort -- the singular RPC's deliberate no-op on
-- unique_violation, preserved per row.
SELECT is(
  public.add_room_matches((SELECT room FROM ctx), '[
    {"sourceProvider":"espn","sourceMatchId":"e1","homeTeamName":"Alpha","awayTeamName":"Beta","kickoffAt":"2026-08-22T11:30:00Z"},
    {"sourceProvider":"espn","sourceMatchId":"e3","homeTeamName":"Eps","awayTeamName":"Zeta","kickoffAt":null}
  ]'::jsonb),
  '{"added": 1, "skipped": 1}'::jsonb,
  'a duplicate is counted as skipped while its neighbours still land'
);

-- An empty array is a no-op success so the client need not pre-check.
SELECT is(
  public.add_room_matches((SELECT room FROM ctx), '[]'::jsonb),
  '{"added": 0, "skipped": 0}'::jsonb,
  'an empty batch succeeds without touching the pool'
);

-- =============================================================================
-- Removal cascades exactly as the singular form does.
-- =============================================================================
SELECT public.set_common_match(
  (SELECT room FROM ctx),
  (SELECT id FROM public.matches WHERE session_id = (SELECT room FROM ctx) AND source_match_id = 'e1')
);

-- Seeded as postgres: `authenticated` deliberately holds no INSERT grant on
-- public.assignments (every write goes through a SECURITY DEFINER RPC), so
-- seeding the row to be cascaded has to step outside that role briefly.
SET LOCAL ROLE postgres;
INSERT INTO public.assignments (session_id, participant_id, match_id, created_at)
SELECT (SELECT room FROM ctx), (SELECT host_p FROM ctx), id, now()
FROM public.matches
WHERE session_id = (SELECT room FROM ctx) AND source_match_id = 'e2';
-- The jwt claim GUC is transaction-local and survives the role switch, so the
-- host impersonation set above is still in effect here.
SET LOCAL ROLE authenticated;

SELECT public.remove_room_matches(
  (SELECT room FROM ctx),
  ARRAY(SELECT id FROM public.matches
         WHERE session_id = (SELECT room FROM ctx)
           AND source_match_id IN ('e1', 'e2'))
);

SELECT is(
  (SELECT count(*)::int FROM public.matches WHERE session_id = (SELECT room FROM ctx)),
  2,
  'both named fixtures are gone and the rest are untouched'
);

SELECT is(
  (SELECT common_match_id FROM public.game_sessions WHERE id = (SELECT room FROM ctx)),
  NULL,
  'removing the Common Match nulls the room pointer'
);

SELECT is(
  (SELECT count(*)::int FROM public.assignments WHERE session_id = (SELECT room FROM ctx)),
  0,
  'assignments for a removed fixture are cascaded away'
);

-- =============================================================================
-- Report
-- =============================================================================
SELECT ok(
  (SELECT passed FROM results WHERE name = 'add_not_host'),
  'add_room_matches rejects a non-host'
);
SELECT ok(
  (SELECT passed FROM results WHERE name = 'remove_not_host'),
  'remove_room_matches rejects a non-host'
);

SELECT * FROM finish();
ROLLBACK;
