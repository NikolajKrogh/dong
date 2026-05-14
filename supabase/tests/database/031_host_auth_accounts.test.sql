BEGIN;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(9);
SELECT ok(
        EXISTS (
            SELECT 1
            FROM pg_class
            WHERE oid = 'public.accounts'::regclass
                AND relrowsecurity
        ),
        'accounts has row-level security enabled'
    );
SELECT ok(
        EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conrelid = 'public.accounts'::regclass
                AND conname = 'chk_accounts_preferred_display_name_nonempty'
        ),
        'accounts rejects blank display names'
    );
SELECT ok(
        has_table_privilege('authenticated', 'public.accounts', 'SELECT'),
        'authenticated can select accounts'
    );
SELECT ok(
        has_table_privilege('authenticated', 'public.accounts', 'INSERT'),
        'authenticated can insert accounts'
    );
SELECT ok(
        has_table_privilege('authenticated', 'public.accounts', 'UPDATE'),
        'authenticated can update accounts'
    );
CREATE TEMP TABLE host_auth_context AS WITH owner_auth AS (
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
            'host-auth-owner@test.local',
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
            'host-auth-bootstrap@test.local',
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
blank_auth AS (
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
            'host-auth-blank@test.local',
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
other_auth AS (
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
            'host-auth-other@test.local',
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
        'Host Owner'
    FROM owner_auth
    RETURNING id,
        preferred_display_name
),
other_account AS (
    INSERT INTO public.accounts (id, preferred_display_name)
    SELECT id,
        'Other Host'
    FROM other_auth
    RETURNING id
),
bootstrap_context AS (
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
            FROM blank_auth
        ) AS blank_account_id,
        (
            SELECT id
            FROM other_auth
        ) AS other_account_id
)
SELECT *
FROM bootstrap_context;
GRANT SELECT ON TABLE host_auth_context TO authenticated;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config(
        'request.jwt.claim.sub',
        (
            SELECT owner_account_id::text
            FROM host_auth_context
        ),
        true
    );
SELECT is(
        (
            SELECT preferred_display_name
            FROM public.accounts
            WHERE id = (
                    SELECT owner_account_id
                    FROM host_auth_context
                )
        ),
        'Host Owner',
        'owner can read their own account row'
    );
WITH updated_account AS (
    UPDATE public.accounts
    SET preferred_display_name = 'Renamed Host',
        updated_at = now()
    WHERE id = (
            SELECT owner_account_id
            FROM host_auth_context
        )
    RETURNING preferred_display_name
)
SELECT is(
        (
            SELECT preferred_display_name
            FROM updated_account
        ),
        'Renamed Host',
        'owner can update their own account row'
    );
SELECT is(
        (
            SELECT count(*)::text
            FROM public.accounts
            WHERE id = (
                    SELECT other_account_id
                    FROM host_auth_context
                )
        ),
        '0',
        'owner cannot read another account row'
    );
SELECT set_config(
        'request.jwt.claim.sub',
        (
            SELECT bootstrap_account_id::text
            FROM host_auth_context
        ),
        true
    );
WITH bootstrapped_account AS (
    INSERT INTO public.accounts (id)
    VALUES (
            (
                SELECT bootstrap_account_id
                FROM host_auth_context
            )
        )
    RETURNING id
)
SELECT is(
        (
            SELECT count(*)::text
            FROM bootstrapped_account
        ),
        '1',
        'authenticated users can bootstrap their own account row without a display name'
    );
SELECT set_config(
        'request.jwt.claim.sub',
        (
            SELECT blank_account_id::text
            FROM host_auth_context
        ),
        true
    );
CREATE TEMP TABLE blank_display_name_results (
    name text PRIMARY KEY,
    passed boolean NOT NULL
);
DO $$ BEGIN BEGIN
INSERT INTO public.accounts (id, preferred_display_name)
VALUES (
        (
            SELECT blank_account_id
            FROM host_auth_context
        ),
        '   '
    );
INSERT INTO blank_display_name_results
VALUES ('blank_display_name_rejected', FALSE);
EXCEPTION
WHEN check_violation THEN
INSERT INTO blank_display_name_results
VALUES ('blank_display_name_rejected', TRUE);
END;
END;
$$;
SELECT ok(
        (
            SELECT passed
            FROM blank_display_name_results
            WHERE name = 'blank_display_name_rejected'
        ),
        'blank display names are rejected'
    );
SELECT *
FROM finish();
ROLLBACK;