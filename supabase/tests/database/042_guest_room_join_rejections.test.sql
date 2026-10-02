BEGIN;
\ir guest_abuse_setup.inc
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(7);
CREATE TEMP TABLE guest_room_rejection_context AS WITH host_auth AS (
    INSERT INTO auth.users (
            id,
            aud,
            role,
            email,
            email_confirmed_at,
            created_at,
            updated_at,
            raw_app_meta_data,
            raw_user_meta_data,
            is_sso_user,
            is_anonymous
        )
    VALUES (
            gen_random_uuid(),
            'authenticated',
            'authenticated',
            'guest-room-rejections@test.local',
            now(),
            now(),
            now(),
            '{"provider":"email","providers":["email"]}'::jsonb,
            '{}'::jsonb,
            FALSE,
            FALSE
        )
    RETURNING id
),
host_account AS (
    INSERT INTO public.accounts (id, username)
    SELECT id,
        'Guest_Room_Rejections_Host'
    FROM host_auth
    RETURNING id
),
joinable_session AS (
    INSERT INTO public.game_sessions (owner_account_id, join_code)
    SELECT id,
        'ROOM42'
    FROM host_account
    RETURNING id
),
closed_session AS (
    INSERT INTO public.game_sessions (owner_account_id, join_code, state)
    SELECT id,
        'CLOSE1',
        'in_progress'::public.session_state
    FROM host_account
    RETURNING id
),
completed_session AS (
    INSERT INTO public.game_sessions (owner_account_id, join_code, state)
    SELECT id, 'DONE42', 'completed'::public.session_state
    FROM host_account RETURNING id
),
truly_closed_session AS (
    INSERT INTO public.game_sessions (owner_account_id, join_code, state)
    SELECT id, 'CLOSE2', 'closed'::public.session_state
    FROM host_account RETURNING id
)
SELECT (
        SELECT id
        FROM joinable_session
    ) AS joinable_session_id,
    (
        SELECT id
        FROM closed_session
    ) AS closed_session_id,
    (SELECT id FROM completed_session) AS completed_session_id,
    (SELECT id FROM truly_closed_session) AS truly_closed_session_id;
CREATE TEMP TABLE guest_room_rejection_results (
    name text PRIMARY KEY,
    actual text NOT NULL
);
CREATE TEMP TABLE guest_room_failure_shapes (name text PRIMARY KEY, payload jsonb);
GRANT SELECT,
    INSERT ON TABLE guest_room_rejection_results TO service_role;
GRANT SELECT, INSERT ON TABLE guest_room_failure_shapes TO service_role;
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.role', 'service_role', true);
SELECT set_config('request.jwt.claim.role', 'service_role', true);
DO $$ BEGIN
INSERT INTO guest_room_rejection_results VALUES
  ('invalid_room', public.join_room_as_guest('NOPE42', 'Casey', 'guest-token-invalid-room')->>'code'),
  ('closed_room', public.join_room_as_guest('CLOSE1', 'Casey', 'guest-token-closed-room')->>'code'),
  ('blank_name', public.join_room_as_guest('ROOM42', '   ', 'guest-token-blank-name')->>'code');
INSERT INTO guest_room_rejection_results
VALUES ('expired_token', public.get_guest_room_snapshot('missing-guest-token')->>'code');
INSERT INTO guest_room_failure_shapes VALUES
  ('unknown', public.join_room_as_guest('NOPE43','Casey',repeat('1',64))),
  ('started', public.join_room_as_guest('CLOSE1','Casey',repeat('2',64))),
  ('completed', public.join_room_as_guest('DONE42','Casey',repeat('3',64))),
  ('closed', public.join_room_as_guest('CLOSE2','Casey',repeat('4',64)));
END;
$$;
RESET ROLE;
SELECT is(
        (
            SELECT actual
            FROM guest_room_rejection_results
            WHERE name = 'invalid_room'
        ),
        'room_unavailable',
        'unknown room returns the same public unavailable code'
    );
SELECT is(
        (
            SELECT actual
            FROM guest_room_rejection_results
            WHERE name = 'closed_room'
        ),
        'room_unavailable',
        'non-joinable room returns the same public unavailable code'
    );
SELECT is((SELECT payload FROM guest_room_failure_shapes WHERE name='unknown'),
  (SELECT payload FROM guest_room_failure_shapes WHERE name='started'),
  'unknown and in-progress room failures have identical public shape');
SELECT is((SELECT payload FROM guest_room_failure_shapes WHERE name='unknown'),
  (SELECT payload FROM guest_room_failure_shapes WHERE name='completed'),
  'unknown and completed room failures have identical public shape');
SELECT is((SELECT payload FROM guest_room_failure_shapes WHERE name='unknown'),
  (SELECT payload FROM guest_room_failure_shapes WHERE name='closed'),
  'unknown and closed room failures have identical public shape');
SELECT is(
        (
            SELECT actual
            FROM guest_room_rejection_results
            WHERE name = 'blank_name'
        ),
        'invalid_request',
        'guest join rejects blank guest names without a room lookup'
    );
SELECT is(
        (
            SELECT actual
            FROM guest_room_rejection_results
            WHERE name = 'expired_token'
        ),
        'guest_access_lost',
        'guest snapshot rejects unknown or expired guest tokens'
    );
SELECT *
FROM finish();
ROLLBACK;
