-- 006_add_common_match_fk.sql
-- Add the nullable FK from game_sessions.common_match_id to matches.id

ALTER TABLE public.game_sessions
  ADD CONSTRAINT fk_game_sessions_common_match FOREIGN KEY (id, common_match_id) REFERENCES public.matches(session_id, id);
