BEGIN;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(4);
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
    INSERT INTO public.accounts (id, preferred_display_name)
    SELECT id,
        'Guest Room Rejections Host'
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
)
SELECT (
        SELECT id
        FROM joinable_session
    ) AS joinable_session_id,
    (
        SELECT id
        FROM closed_session
    ) AS closed_session_id;
CREATE TEMP TABLE guest_room_rejection_results (
    name text PRIMARY KEY,
    actual text NOT NULL
);
GRANT SELECT,
    INSERT ON TABLE guest_room_rejection_results TO anon;
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.role', 'anon', true);
DO $$ BEGIN BEGIN PERFORM public.join_room_as_guest('NOPE42', 'Casey', 'guest-token-invalid-room');
INSERT INTO guest_room_rejection_results
VALUES ('invalid_room', 'no_error');
EXCEPTION
WHEN OTHERS THEN
INSERT INTO guest_room_rejection_results
VALUES ('invalid_room', SQLERRM);
END;
BEGIN PERFORM public.join_room_as_guest('CLOSE1', 'Casey', 'guest-token-closed-room');
INSERT INTO guest_room_rejection_results
VALUES ('closed_room', 'no_error');
EXCEPTION
WHEN OTHERS THEN
INSERT INTO guest_room_rejection_results
VALUES ('closed_room', SQLERRM);
END;
BEGIN PERFORM public.join_room_as_guest('ROOM42', '   ', 'guest-token-blank-name');
INSERT INTO guest_room_rejection_results
VALUES ('blank_name', 'no_error');
EXCEPTION
WHEN OTHERS THEN
INSERT INTO guest_room_rejection_results
VALUES ('blank_name', SQLERRM);
END;
BEGIN PERFORM public.get_guest_room_snapshot('missing-guest-token');
INSERT INTO guest_room_rejection_results
VALUES ('expired_token', 'no_error');
EXCEPTION
WHEN OTHERS THEN
INSERT INTO guest_room_rejection_results
VALUES ('expired_token', SQLERRM);
END;
END;
$$;
RESET ROLE;
SELECT is(
        (
            SELECT actual
            FROM guest_room_rejection_results
            WHERE name = 'invalid_room'
        ),
        'room_not_found',
        'guest join rejects an unknown room code'
    );
SELECT is(
        (
            SELECT actual
            FROM guest_room_rejection_results
            WHERE name = 'closed_room'
        ),
        'room_not_joinable',
        'guest join rejects rooms that are no longer joinable'
    );
SELECT is(
        (
            SELECT actual
            FROM guest_room_rejection_results
            WHERE name = 'blank_name'
        ),
        'guest_name_required',
        'guest join rejects blank guest names'
    );
SELECT is(
        (
            SELECT actual
            FROM guest_room_rejection_results
            WHERE name = 'expired_token'
        ),
        'guest_token_expired',
        'guest snapshot rejects unknown or expired guest tokens'
    );
SELECT *
FROM finish();
ROLLBACK;