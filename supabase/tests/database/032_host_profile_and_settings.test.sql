BEGIN;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(8);
SELECT ok(
        NOT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
                AND table_name = 'accounts'
                AND column_name = 'username'
        ),
        'accounts does not expose a username column'
    );
SELECT ok(
        NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conrelid = 'public.accounts'::regclass
                AND conname = 'chk_accounts_username_nonempty'
        ),
        'accounts no longer enforces username validation'
    );
CREATE TEMP TABLE host_profile_settings_context AS WITH owner_auth AS (
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
            'host-profile-owner@test.local',
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
bootstrap_auth AS (
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
            'host-profile-bootstrap@test.local',
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
            'host-profile-stranger@test.local',
            now(),
            now(),
            now(),
            '{"provider":"email","providers":["email"]}'::jsonb,
            '{}'::jsonb,
            FALSE,
            FALSE
        )
    RETURNING id
)
SELECT (
        SELECT id
        FROM owner_auth
    ) AS owner_account_id,
    (
        SELECT id
        FROM bootstrap_auth
    ) AS bootstrap_account_id,
    (
        SELECT id
        FROM stranger_auth
    ) AS stranger_account_id;
GRANT SELECT ON TABLE host_profile_settings_context TO authenticated;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config(
        'request.jwt.claim.sub',
        (
            SELECT owner_account_id::text
            FROM host_profile_settings_context
        ),
        true
    );
WITH inserted_owner_account AS (
    INSERT INTO public.accounts (id, preferred_display_name)
    VALUES (
            (
                SELECT owner_account_id
                FROM host_profile_settings_context
            ),
            'Host Profile Owner'
        )
    RETURNING preferred_display_name
)
SELECT is(
        (
            SELECT preferred_display_name
            FROM inserted_owner_account
        ),
        'Host Profile Owner',
        'owner can insert their display name'
    );
WITH updated_owner_account AS (
    UPDATE public.accounts
    SET preferred_display_name = 'Host Profile Owner Updated',
        updated_at = now()
    WHERE id = (
            SELECT owner_account_id
            FROM host_profile_settings_context
        )
    RETURNING preferred_display_name
)
SELECT is(
        (
            SELECT preferred_display_name
            FROM updated_owner_account
        ),
        'Host Profile Owner Updated',
        'owner can update their display name'
    );
SELECT set_config(
        'request.jwt.claim.sub',
        (
            SELECT bootstrap_account_id::text
            FROM host_profile_settings_context
        ),
        true
    );
WITH bootstrapped_account AS (
    INSERT INTO public.accounts (id)
    VALUES (
            (
                SELECT bootstrap_account_id
                FROM host_profile_settings_context
            )
        )
    RETURNING preferred_display_name
)
SELECT ok(
        (
            SELECT preferred_display_name IS NULL
            FROM bootstrapped_account
        ),
        'bootstrap inserts can omit preferred_display_name'
    );
SELECT set_config(
        'request.jwt.claim.sub',
        (
            SELECT owner_account_id::text
            FROM host_profile_settings_context
        ),
        true
    );
WITH inserted_settings AS (
    INSERT INTO public.settings (account_id, settings_data)
    VALUES (
            (
                SELECT owner_account_id
                FROM host_profile_settings_context
            ),
            '{"theme":"dark","soundEnabled":false,"commonMatchNotificationsEnabled":true,"configuredLeagues":[{"code":"eng.1","name":"Premier League","category":"Europe"}],"defaultSelectedLeagues":[{"code":"eng.1","name":"Premier League","category":"Europe"}]}'::jsonb
        )
    RETURNING settings_data
)
SELECT is(
        (
            SELECT settings_data->>'theme'
            FROM inserted_settings
        ),
        'dark',
        'owner can insert the synced settings payload'
    );
WITH updated_settings AS (
    UPDATE public.settings
    SET settings_data = '{"theme":"light","soundEnabled":true,"commonMatchNotificationsEnabled":false,"configuredLeagues":[],"defaultSelectedLeagues":[]}'::jsonb,
        updated_at = now()
    WHERE account_id = (
            SELECT owner_account_id
            FROM host_profile_settings_context
        )
    RETURNING settings_data
)
SELECT is(
        (
            SELECT settings_data->>'commonMatchNotificationsEnabled'
            FROM updated_settings
        ),
        'false',
        'owner can update the synced settings payload'
    );
SELECT set_config(
        'request.jwt.claim.sub',
        (
            SELECT stranger_account_id::text
            FROM host_profile_settings_context
        ),
        true
    );
SELECT is(
        (
            SELECT count(*)::text
            FROM public.settings
            WHERE account_id = (
                    SELECT owner_account_id
                    FROM host_profile_settings_context
                )
        ),
        '0',
        'unrelated users cannot read another account settings row'
    );
RESET ROLE;
SELECT *
FROM finish();
ROLLBACK;