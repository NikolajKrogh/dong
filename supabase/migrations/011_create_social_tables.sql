-- 011_create_social_tables.sql
-- Add the minimal social and settings tables required for RLS-backed access control.
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'friendship_status'
) THEN CREATE TYPE friendship_status AS ENUM ('pending', 'accepted', 'declined', 'canceled');
END IF;
END;
$$;
CREATE TABLE IF NOT EXISTS public.profiles (
    account_id uuid PRIMARY KEY REFERENCES public.accounts(id) ON DELETE CASCADE,
    display_name text NOT NULL,
    avatar_url text,
    bio text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_profiles_display_name_nonempty CHECK (length(btrim(display_name)) > 0)
);
CREATE TABLE IF NOT EXISTS public.settings (
    account_id uuid PRIMARY KEY REFERENCES public.accounts(id) ON DELETE CASCADE,
    settings_data jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.friendships (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    addressee_account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    status friendship_status NOT NULL DEFAULT 'pending',
    requested_at timestamptz NOT NULL DEFAULT now(),
    responded_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);