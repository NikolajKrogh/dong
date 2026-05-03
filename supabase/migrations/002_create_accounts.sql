-- 002_create_accounts.sql
-- Create the public.accounts table mapped to auth.users

CREATE TABLE IF NOT EXISTS public.accounts (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  preferred_display_name text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
