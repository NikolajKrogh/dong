BEGIN;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(9);
CREATE TEMP TABLE friendships_rls_context AS WITH requester_auth AS (
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
            'friendships-requester@test.local',
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
addressee_auth AS (
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
            'friendships-addressee@test.local',
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
outsider_auth AS (
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
            'friendships-outsider@test.local',
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
fourth_auth AS (
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
            'friendships-fourth@test.local',
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
requester_account AS (
    INSERT INTO public.accounts (id, preferred_display_name)
    SELECT id,
        'Friendship Requester'
    FROM requester_auth
    RETURNING id
),
addressee_account AS (
    INSERT INTO public.accounts (id, preferred_display_name)
    SELECT id,
        'Friendship Addressee'
    FROM addressee_auth
    RETURNING id
),
outsider_account AS (
    INSERT INTO public.accounts (id, preferred_display_name)
    SELECT id,
        'Friendship Outsider'
    FROM outsider_auth
    RETURNING id
),
fourth_account AS (
    INSERT INTO public.accounts (id, preferred_display_name)
    SELECT id,
        'Friendship Fourth'
    FROM fourth_auth
    RETURNING id
),
pending_friendship AS (
    INSERT INTO public.friendships (
            requester_account_id,
            addressee_account_id,
            status
        )
    SELECT requester_account.id,
        addressee_account.id,
        'pending'
    FROM requester_account,
        addressee_account
    RETURNING id
),
unrelated_friendship AS (
    INSERT INTO public.friendships (
            requester_account_id,
            addressee_account_id,
            status,
            responded_at
        )
    SELECT outsider_account.id,
        fourth_account.id,
        'accepted',
        now()
    FROM outsider_account,
        fourth_account
    RETURNING id
),
requester_pending_to_fourth AS (
    INSERT INTO public.friendships (
            requester_account_id,
            addressee_account_id,
            status
        )
    SELECT requester_account.id,
        fourth_account.id,
        'pending'
    FROM requester_account,
        fourth_account
    RETURNING id
)
SELECT (
        SELECT id
        FROM requester_account
    ) AS requester_account_id,
    (
        SELECT id
        FROM addressee_account
    ) AS addressee_account_id,
    (
        SELECT id
        FROM outsider_account
    ) AS outsider_account_id,
    (
        SELECT id
        FROM pending_friendship
    ) AS pending_friendship_id,
    (
        SELECT id
        FROM unrelated_friendship
    ) AS unrelated_friendship_id,
    (
        SELECT id
        FROM requester_pending_to_fourth
    ) AS requester_pending_to_fourth_id;
GRANT SELECT ON TABLE friendships_rls_context TO authenticated;
CREATE TEMP TABLE friendships_rls_results (
    name text PRIMARY KEY,
    passed boolean NOT NULL
);
GRANT SELECT,
    INSERT ON TABLE friendships_rls_results TO authenticated;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config(
        'request.jwt.claim.sub',
        (
            SELECT requester_account_id::text
            FROM friendships_rls_context
        ),
        true
    );
SELECT is(
        (
            SELECT status::text
            FROM public.friendships
            WHERE id = (
                    SELECT pending_friendship_id
                    FROM friendships_rls_context
                )
        ),
        'pending',
        'requester can read the friendship row'
    );
SELECT is(
        (
            SELECT count(*)::text
            FROM public.friendships
            WHERE id = (
                    SELECT unrelated_friendship_id
                    FROM friendships_rls_context
                )
        ),
        '0',
        'requester cannot read unrelated friendship rows'
    );
WITH inserted_friendship AS (
    INSERT INTO public.friendships (
            requester_account_id,
            addressee_account_id,
            status
        )
    VALUES (
            (
                SELECT requester_account_id
                FROM friendships_rls_context
            ),
            (
                SELECT outsider_account_id
                FROM friendships_rls_context
            ),
            'pending'
        )
    RETURNING status::text
)
SELECT is(
        (
            SELECT status
            FROM inserted_friendship
        ),
        'pending',
        'requester can insert a pending friendship row'
    );
DO $$ BEGIN BEGIN
UPDATE public.friendships
SET status = 'accepted',
    responded_at = now()
WHERE id = (
        SELECT requester_pending_to_fourth_id
        FROM friendships_rls_context
    );
INSERT INTO friendships_rls_results
VALUES ('requester_cannot_accept_own_pending', FALSE);
EXCEPTION
WHEN insufficient_privilege THEN
INSERT INTO friendships_rls_results
VALUES ('requester_cannot_accept_own_pending', TRUE);
END;
END;
$$;
SELECT set_config(
        'request.jwt.claim.sub',
        (
            SELECT addressee_account_id::text
            FROM friendships_rls_context
        ),
        true
    );
SELECT is(
        (
            SELECT status::text
            FROM public.friendships
            WHERE id = (
                    SELECT pending_friendship_id
                    FROM friendships_rls_context
                )
        ),
        'pending',
        'addressee can read the friendship row'
    );
WITH accepted_friendship AS (
    UPDATE public.friendships
    SET status = 'accepted',
        responded_at = now()
    WHERE id = (
            SELECT pending_friendship_id
            FROM friendships_rls_context
        )
    RETURNING status::text
)
SELECT is(
        (
            SELECT status
            FROM accepted_friendship
        ),
        'accepted',
        'addressee can accept a pending friendship row'
    );
SELECT set_config(
        'request.jwt.claim.sub',
        (
            SELECT requester_account_id::text
            FROM friendships_rls_context
        ),
        true
    );
WITH canceled_friendship AS (
    UPDATE public.friendships
    SET status = 'canceled',
        responded_at = now()
    WHERE id = (
            SELECT pending_friendship_id
            FROM friendships_rls_context
        )
    RETURNING status::text
)
SELECT is(
        (
            SELECT status
            FROM canceled_friendship
        ),
        'canceled',
        'requester can cancel an accepted friendship row'
    );
SELECT ok(
        (
            SELECT passed
            FROM friendships_rls_results
            WHERE name = 'requester_cannot_accept_own_pending'
        ),
        'requester cannot accept a friendship they initiated'
    );
SELECT set_config(
        'request.jwt.claim.sub',
        (
            SELECT outsider_account_id::text
            FROM friendships_rls_context
        ),
        true
    );
SELECT is(
        (
            SELECT count(*)::text
            FROM public.friendships
            WHERE id = (
                    SELECT pending_friendship_id
                    FROM friendships_rls_context
                )
        ),
        '0',
        'third-party accounts cannot read unrelated friendship rows'
    );
WITH outsider_update AS (
    UPDATE public.friendships
    SET status = 'declined',
        responded_at = now()
    WHERE id = (
            SELECT pending_friendship_id
            FROM friendships_rls_context
        )
    RETURNING id
)
SELECT is(
        (
            SELECT count(*)::text
            FROM outsider_update
        ),
        '0',
        'third-party accounts cannot update unrelated friendship rows'
    );
RESET ROLE;
SELECT *
FROM finish();
ROLLBACK;