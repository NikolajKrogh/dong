-- 270_end_running_game.test.sql
-- 040_end_running_game.sql: end_game_session, and leave_room_as_host during a
-- running game.
--
-- The bug being pinned: nothing could move a room out of `in_progress`.
-- start_game_session put it there and leave_room_as_host refused anything that
-- was not `joinable`, so a started room stayed "active" forever — Home kept
-- offering to return to it, and the join-conflict escape called the very RPC
-- that refused it.
BEGIN;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(10);

CREATE TEMP TABLE results (name text PRIMARY KEY, passed boolean NOT NULL, detail text);
GRANT SELECT, INSERT ON TABLE results TO authenticated, anon;

-- =============================================================================
-- Two rooms: r1 is in_progress with a member who could inherit it, r2 is still
-- joinable. An outsider account never joins either.
-- =============================================================================
CREATE TEMP TABLE ctx AS
WITH h AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','erg-h@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
m AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','erg-m@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
o AS (
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (gen_random_uuid(),'authenticated','authenticated','erg-o@test.local',now(),now(),now(),'{"provider":"email"}'::jsonb,'{}'::jsonb,false,false) RETURNING id
),
acc AS (
    INSERT INTO public.accounts (id, preferred_display_name)
    SELECT id, 'ERG Host' FROM h
    UNION ALL SELECT id, 'ERG Member' FROM m
    UNION ALL SELECT id, 'ERG Outsider' FROM o
    RETURNING id
),
r1 AS (
    INSERT INTO public.game_sessions (id, owner_account_id, join_code, state)
    SELECT gen_random_uuid(), (SELECT id FROM h), 'ERG00001', 'in_progress'::public.session_state
    RETURNING id
),
r2 AS (
    INSERT INTO public.game_sessions (id, owner_account_id, join_code, state)
    SELECT gen_random_uuid(), (SELECT id FROM h), 'ERG00002', 'joinable'::public.session_state
    RETURNING id
),
r1_host AS (
    INSERT INTO public.participants (id, session_id, account_id, display_name, membership_type, session_role)
    SELECT gen_random_uuid(), (SELECT id FROM r1), (SELECT id FROM h), 'ERG Host',
           'registered'::public.participant_membership_type, 'owner'::public.participant_session_role
    RETURNING id
),
r1_member AS (
    INSERT INTO public.participants (id, session_id, account_id, display_name, membership_type, session_role)
    SELECT gen_random_uuid(), (SELECT id FROM r1), (SELECT id FROM m), 'ERG Member',
           'registered'::public.participant_membership_type, 'member'::public.participant_session_role
    RETURNING id
),
r2_host AS (
    INSERT INTO public.participants (id, session_id, account_id, display_name, membership_type, session_role)
    SELECT gen_random_uuid(), (SELECT id FROM r2), (SELECT id FROM h), 'ERG Host',
           'registered'::public.participant_membership_type, 'owner'::public.participant_session_role
    RETURNING id
)
SELECT (SELECT id FROM h) AS host, (SELECT id FROM m) AS member, (SELECT id FROM o) AS outsider,
       (SELECT id FROM r1) AS r1, (SELECT id FROM r2) AS r2,
       (SELECT id FROM r1_member) AS r1_member_p;
GRANT SELECT ON TABLE ctx TO authenticated, anon;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',true);

-- =============================================================================
-- end_game_session guards
-- =============================================================================
SELECT set_config('request.jwt.claim.sub', (SELECT outsider::text FROM ctx), true);
DO $$ BEGIN
  BEGIN
    PERFORM public.end_game_session((SELECT r1 FROM ctx));
    INSERT INTO results VALUES ('end_not_host', FALSE, 'no error raised');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO results VALUES ('end_not_host', SQLERRM = 'not_host', SQLERRM);
  END;
END $$;

SELECT set_config('request.jwt.claim.sub', (SELECT host::text FROM ctx), true);

-- A room that never started has nothing to end; leaving it is the right verb.
DO $$ BEGIN
  BEGIN
    PERFORM public.end_game_session((SELECT r2 FROM ctx));
    INSERT INTO results VALUES ('end_joinable', FALSE, 'no error raised');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO results VALUES ('end_joinable', SQLERRM = 'game_not_in_progress', SQLERRM);
  END;
END $$;

SELECT is(
  (SELECT state::text FROM public.game_sessions WHERE id = (SELECT r1 FROM ctx)),
  'in_progress',
  'a rejected end leaves the room untouched'
);

-- =============================================================================
-- The happy path
-- =============================================================================
SELECT is(
  public.end_game_session((SELECT r1 FROM ctx)) -> 'status',
  '"completed"'::jsonb,
  'the host can end a running game'
);

SELECT is(
  (SELECT state::text FROM public.game_sessions WHERE id = (SELECT r1 FROM ctx)),
  'completed',
  'the room reaches completed, not closed - it was played, not abandoned'
);

-- The whole point: the room must stop counting as the account's active room, or
-- Home keeps offering to return to it and bounces the host back into the game.
-- Asserted through the RPC the client actually calls, not the private helper --
-- that one is revoked from `authenticated` by design.
SELECT is(
  public.get_my_active_room() -> 'sessionId',
  to_jsonb((SELECT r2::text FROM ctx)),
  'the ended room is no longer the active room (the still-joinable one is)'
);

SELECT is(
  (SELECT count(*)::int FROM public.gameplay_events
    WHERE session_id = (SELECT r1 FROM ctx) AND event_type = 'session_completed'),
  1,
  'ending is recorded in the room history'
);

-- A double tap, or two of the host's devices racing, must not raise.
SELECT is(
  public.end_game_session((SELECT r1 FROM ctx)) -> 'status',
  '"completed"'::jsonb,
  'ending an already-ended game is idempotent'
);

-- =============================================================================
-- leave_room_as_host during a running game -- the guard this migration widened.
-- Before 040 this raised room_not_joinable, which is what made the join-conflict
-- "leave current room & switch" escape unusable on a started room.
-- =============================================================================
-- Re-arm as postgres: `authenticated` holds no UPDATE grant on game_sessions,
-- which is exactly why the state transitions all live behind RPCs.
SET LOCAL ROLE postgres;
UPDATE public.game_sessions SET state = 'in_progress'::public.session_state
WHERE id = (SELECT r1 FROM ctx);
SET LOCAL ROLE authenticated;

SELECT is(
  public.leave_room_as_host((SELECT r1 FROM ctx), (SELECT r1_member_p FROM ctx)) -> 'status',
  '"transferred"'::jsonb,
  'the host can hand a running game to a successor'
);

SELECT is(
  (SELECT owner_account_id FROM public.game_sessions WHERE id = (SELECT r1 FROM ctx)),
  (SELECT member FROM ctx),
  'ownership actually moved, and the game keeps running for everyone else'
);

-- =============================================================================
-- Report
-- =============================================================================
SELECT ok((SELECT passed FROM results WHERE name = 'end_not_host'),
          'end_game_session rejects a non-host');
SELECT ok((SELECT passed FROM results WHERE name = 'end_joinable'),
          'end_game_session refuses a room that never started');

SELECT * FROM finish();
ROLLBACK;
