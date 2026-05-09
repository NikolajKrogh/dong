-- 022_history_read_models_leaderboard.sql
-- Ranked leaderboard built from lifetime stats.
CREATE OR REPLACE VIEW public.leaderboard_entries WITH (security_invoker = true) AS
SELECT row_number() OVER (
        ORDER BY lifetime_stats.total_drinks DESC,
            lifetime_stats.average_per_game DESC,
            lifetime_stats.account_id ASC
    )::integer AS rank,
    lifetime_stats.account_id,
    lifetime_stats.display_name,
    lifetime_stats.total_drinks,
    lifetime_stats.games_played,
    lifetime_stats.average_per_game
FROM public.lifetime_player_stats lifetime_stats
ORDER BY lifetime_stats.total_drinks DESC,
    lifetime_stats.average_per_game DESC,
    lifetime_stats.account_id ASC;
REVOKE ALL ON TABLE public.leaderboard_entries
FROM PUBLIC,
    anon,
    authenticated;
GRANT SELECT ON TABLE public.leaderboard_entries TO authenticated,
    service_role;