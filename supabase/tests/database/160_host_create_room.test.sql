BEGIN;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(5);

CREATE TEMP TABLE host_create_room_context AS
WITH host_auth AS (
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
            'host-create-room@test.local',
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
        'Test Room Host'
    FROM host_auth
    RETURNING id,
        preferred_display_name
)
SELECT host_auth.id AS auth_id,
    host_account.preferred_display_name
FROM host_auth
JOIN host_account ON host_account.id = host_auth.id;

GRANT SELECT ON TABLE host_create_room_context TO authenticated;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config(
        'request.jwt.claim.sub',
        (
            SELECT auth_id::text
            FROM host_create_room_context
        ),
        true
    );

CREATE TEMP TABLE create_room_first_result AS
SELECT public.create_room_as_host() AS payload;

CREATE TEMP TABLE create_room_second_result AS
SELECT public.create_room_as_host() AS payload;

-- Force DEFERRABLE constraint triggers (e.g. assert_session_owner_participant on
-- game_sessions) to fire now instead of at COMMIT, so this rollback-based test
-- actually exercises the committed-insert path. Guards against the 025 trigger bug.
SET CONSTRAINTS ALL IMMEDIATE;

RESET ROLE;

-- Test 1: join code is exactly 6 digits
SELECT ok(
        (
            SELECT payload->>'joinCode' ~ '^[0-9]{6}$'
            FROM create_room_first_result
        ),
        'join code is a 6-digit numeric string'
    );

-- Test 2: game_sessions row has state=joinable and correct owner_account_id
SELECT is(
        (
            SELECT gs.state::text || ':' || (gs.owner_account_id = ctx.auth_id)::text
            FROM public.game_sessions gs,
                host_create_room_context ctx
            WHERE gs.id = (
                    SELECT (payload->>'sessionId')::uuid
                    FROM create_room_first_result
                )
        ),
        'joinable:true',
        'game_sessions row has state=joinable and correct owner_account_id'
    );

-- Test 3: participants row has session_role=owner, membership_type=registered, and display_name from accounts
SELECT is(
        (
            SELECT p.session_role::text || ':' || p.membership_type::text || ':' || p.display_name
            FROM public.participants p
            WHERE p.id = (
                    SELECT (payload->>'hostParticipantId')::uuid
                    FROM create_room_first_result
                )
        ),
        'owner:registered:Test Room Host',
        'host participant has session_role=owner, membership_type=registered, and correct display_name'
    );

-- Test 4: second call returns same sessionId (existing-room redirect, no second insert)
SELECT is(
        (
            SELECT payload->>'sessionId'
            FROM create_room_second_result
        ),
        (
            SELECT payload->>'sessionId'
            FROM create_room_first_result
        ),
        'second call for same authenticated host returns the same sessionId'
    );

-- Test 5: unauthenticated caller raises not_authenticated
SELECT set_config('request.jwt.claim.sub', '', true);
SET LOCAL ROLE authenticated;

CREATE TEMP TABLE not_authenticated_result (passed boolean NOT NULL);

DO $$
BEGIN
    BEGIN
        PERFORM public.create_room_as_host();
        INSERT INTO not_authenticated_result
        VALUES (FALSE);
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLERRM = 'not_authenticated' THEN
                INSERT INTO not_authenticated_result
                VALUES (TRUE);
            ELSE
                INSERT INTO not_authenticated_result
                VALUES (FALSE);
            END IF;
    END;
END;
$$;

RESET ROLE;

SELECT ok(
        (
            SELECT passed
            FROM not_authenticated_result
        ),
        'caller with null auth.uid() raises not_authenticated'
    );

SELECT *
FROM finish();

ROLLBACK;
