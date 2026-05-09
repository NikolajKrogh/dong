BEGIN;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(10);
CREATE TEMP TABLE profile_settings_rls_context AS WITH owner_auth AS (
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
            'profile-owner@test.local',
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
friend_auth AS (
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
            'profile-friend@test.local',
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
stranger_auth AS (
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
            'profile-stranger@test.local',
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
owner_account AS (
    INSERT INTO public.accounts (id, preferred_display_name)
    SELECT id,
        'Profile Owner'
    FROM owner_auth
    RETURNING id
),
friend_account AS (
    INSERT INTO public.accounts (id, preferred_display_name)
    SELECT id,
        'Profile Friend'
    FROM friend_auth
    RETURNING id
),
stranger_account AS (
    INSERT INTO public.accounts (id, preferred_display_name)
    SELECT id,
        'Profile Stranger'
    FROM stranger_auth
    RETURNING id
),
owner_profile AS (
    INSERT INTO public.profiles (account_id, display_name, bio)
    SELECT id,
        'Owner Profile',
        'Owner bio'
    FROM owner_account
    RETURNING account_id
),
owner_settings AS (
    INSERT INTO public.settings (account_id, settings_data)
    SELECT id,
        '{"theme":"classic"}'::jsonb
    FROM owner_account
    RETURNING account_id
),
accepted_friendship AS (
    INSERT INTO public.friendships (
            requester_account_id,
            addressee_account_id,
            status,
            responded_at
        )
    SELECT owner_account.id,
        friend_account.id,
        'accepted',
        now()
    FROM owner_account,
        friend_account
    RETURNING id
)
SELECT (
        SELECT id
        FROM owner_account
    ) AS owner_account_id,
    (
        SELECT id
        FROM friend_account
    ) AS friend_account_id,
    (
        SELECT id
        FROM stranger_account
    ) AS stranger_account_id,
    (
        SELECT id
        FROM accepted_friendship
    ) AS friendship_id;
GRANT SELECT ON TABLE profile_settings_rls_context TO authenticated;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config(
        'request.jwt.claim.sub',
        (
            SELECT owner_account_id::text
            FROM profile_settings_rls_context
        ),
        true
    );
SELECT is(
        (
            SELECT display_name
            FROM public.profiles
            WHERE account_id = (
                    SELECT owner_account_id
                    FROM profile_settings_rls_context
                )
        ),
        'Owner Profile',
        'owner can read the profile row'
    );
WITH updated_profile AS (
    UPDATE public.profiles
    SET bio = 'Owner bio updated'
    WHERE account_id = (
            SELECT owner_account_id
            FROM profile_settings_rls_context
        )
    RETURNING bio
)
SELECT is(
        (
            SELECT bio
            FROM updated_profile
        ),
        'Owner bio updated',
        'owner can update the profile row'
    );
SELECT set_config(
        'request.jwt.claim.sub',
        (
            SELECT friend_account_id::text
            FROM profile_settings_rls_context
        ),
        true
    );
WITH inserted_friend_profile AS (
    INSERT INTO public.profiles (account_id, display_name, bio)
    VALUES (
            (
                SELECT friend_account_id
                FROM profile_settings_rls_context
            ),
            'Friend Profile',
            'Friend bio'
        )
    RETURNING display_name
)
SELECT is(
        (
            SELECT display_name
            FROM inserted_friend_profile
        ),
        'Friend Profile',
        'authenticated owner can insert their own profile row'
    );
SELECT is(
        (
            SELECT display_name
            FROM public.profiles
            WHERE account_id = (
                    SELECT owner_account_id
                    FROM profile_settings_rls_context
                )
        ),
        'Owner Profile',
        'accepted friend can read the owner profile row'
    );
SELECT set_config(
        'request.jwt.claim.sub',
        (
            SELECT stranger_account_id::text
            FROM profile_settings_rls_context
        ),
        true
    );
SELECT is(
        (
            SELECT count(*)::text
            FROM public.profiles
            WHERE account_id = (
                    SELECT owner_account_id
                    FROM profile_settings_rls_context
                )
        ),
        '0',
        'unrelated user cannot read the owner profile row'
    );
SELECT set_config(
        'request.jwt.claim.sub',
        (
            SELECT owner_account_id::text
            FROM profile_settings_rls_context
        ),
        true
    );
SELECT is(
        (
            SELECT settings_data->>'theme'
            FROM public.settings
            WHERE account_id = (
                    SELECT owner_account_id
                    FROM profile_settings_rls_context
                )
        ),
        'classic',
        'owner can read the settings row'
    );
WITH updated_settings AS (
    UPDATE public.settings
    SET settings_data = '{"theme":"night"}'::jsonb
    WHERE account_id = (
            SELECT owner_account_id
            FROM profile_settings_rls_context
        )
    RETURNING settings_data->>'theme' AS theme
)
SELECT is(
        (
            SELECT theme
            FROM updated_settings
        ),
        'night',
        'owner can update the settings row'
    );
SELECT set_config(
        'request.jwt.claim.sub',
        (
            SELECT friend_account_id::text
            FROM profile_settings_rls_context
        ),
        true
    );
WITH inserted_friend_settings AS (
    INSERT INTO public.settings (account_id, settings_data)
    VALUES (
            (
                SELECT friend_account_id
                FROM profile_settings_rls_context
            ),
            '{"volume":5}'::jsonb
        )
    RETURNING settings_data->>'volume' AS volume
)
SELECT is(
        (
            SELECT volume
            FROM inserted_friend_settings
        ),
        '5',
        'authenticated owner can insert their own settings row'
    );
SELECT is(
        (
            SELECT count(*)::text
            FROM public.settings
            WHERE account_id = (
                    SELECT owner_account_id
                    FROM profile_settings_rls_context
                )
        ),
        '0',
        'accepted friend cannot read the owner settings row'
    );
SELECT set_config(
        'request.jwt.claim.sub',
        (
            SELECT stranger_account_id::text
            FROM profile_settings_rls_context
        ),
        true
    );
SELECT is(
        (
            SELECT count(*)::text
            FROM public.settings
            WHERE account_id = (
                    SELECT owner_account_id
                    FROM profile_settings_rls_context
                )
        ),
        '0',
        'unrelated user cannot read the owner settings row'
    );
RESET ROLE;
SELECT *
FROM finish();
ROLLBACK;