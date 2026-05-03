-- 005_create_matches.sql
-- Create matches table
CREATE TABLE IF NOT EXISTS public.matches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id uuid NOT NULL REFERENCES public.game_sessions(id),
    source_provider text NOT NULL,
    source_match_id text NULL,
    home_team_name text NOT NULL,
    away_team_name text NOT NULL,
    kickoff_at timestamptz NULL,
    home_score integer NOT NULL DEFAULT 0,
    away_score integer NOT NULL DEFAULT 0,
    created_at timestamptz DEFAULT now()
);
ALTER TABLE public.matches
ADD CONSTRAINT chk_matches_scores_nonnegative CHECK (
        home_score >= 0
        AND away_score >= 0
    ),
    ADD CONSTRAINT uq_matches_session_id_id UNIQUE (session_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_matches_session_source_match ON public.matches (session_id, source_provider, source_match_id)
WHERE source_match_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_matches_session_id ON public.matches (session_id);