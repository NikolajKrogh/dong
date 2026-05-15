BEGIN;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(6);
CREATE TEMP TABLE guest_room_join_context AS WITH host_auth AS (
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
            'guest-room-host@test.local',
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
        'Guest Room Host'
    FROM host_auth
    RETURNING id
),
session_row AS (
    INSERT INTO public.game_sessions (owner_account_id, join_code)
    SELECT id,
        'ROOM42'
    FROM host_account
    RETURNING id,
        join_code
)
SELECT *
FROM session_row;
GRANT SELECT ON TABLE guest_room_join_context TO anon;
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.role', 'anon', true);
CREATE TEMP TABLE guest_room_join_first_result AS
SELECT public.join_room_as_guest(' room42 ', 'Guest Player', 'guest-token-1') AS payload;
CREATE TEMP TABLE guest_room_join_replay_result AS
SELECT public.join_room_as_guest('ROOM42', 'Guest Player', 'guest-token-1') AS payload;
CREATE TEMP TABLE guest_room_join_duplicate_name_result AS
SELECT public.join_room_as_guest('ROOM42', 'Guest Player', 'guest-token-2') AS payload;
CREATE TEMP TABLE guest_room_join_snapshot_result AS
SELECT public.get_guest_room_snapshot('guest-token-1') AS payload;
RESET ROLE;
SELECT is(
        (
            SELECT payload->>'joinCode'
            FROM guest_room_join_first_result
        ),
        'ROOM42',
        'guest join normalizes the room code before lookup'
    );
SELECT is(
        (
            SELECT jsonb_array_length(payload->'snapshot'->'participants')::text
            FROM guest_room_join_first_result
        ),
        '2',
        'first guest join returns the owner and the new guest in the lobby snapshot'
    );
SELECT is(
        (
            SELECT payload->>'participantId'
            FROM guest_room_join_replay_result
        ),
        (
            SELECT payload->>'participantId'
            FROM guest_room_join_first_result
        ),
        'replaying the same guest token returns the original participant'
    );
SELECT is(
        (
            SELECT count(*)::text
            FROM public.participants
            WHERE session_id = (
                    SELECT id
                    FROM guest_room_join_context
                )
                AND guest_rejoin_token_hash = encode(
                    extensions.digest('guest-token-1', 'sha256'),
                    'hex'
                )
        ),
        '1',
        'replaying the same guest token does not create a duplicate participant row'
    );
SELECT isnt(
        (
            SELECT payload->>'participantId'
            FROM guest_room_join_duplicate_name_result
        ),
        (
            SELECT payload->>'participantId'
            FROM guest_room_join_first_result
        ),
        'duplicate guest display names are accepted when the guest token changes'
    );
SELECT is(
        (
            SELECT jsonb_array_length(payload->'participants')::text
            FROM guest_room_join_snapshot_result
        ),
        '3',
        'guest snapshot retrieval returns the latest room membership after a second guest joins'
    );
SELECT *
FROM finish();
ROLLBACK;