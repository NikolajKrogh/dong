-- 020_history_read_models_lifetime.sql
-- Lifetime player stats derived from completed-session participant rollups.
CREATE OR REPLACE VIEW public.lifetime_player_stats WITH (security_invoker = true) AS
SELECT participants.account_id,
    COALESCE(
        MAX(participants.account_display_name),
        MAX(participants.display_name)
    ) AS display_name,
    count(DISTINCT participants.session_id)::integer AS games_played,
    COALESCE(sum(participants.current_drink_total), 0)::numeric AS total_drinks,
    CASE
        WHEN count(DISTINCT participants.session_id) > 0 THEN COALESCE(sum(participants.current_drink_total), 0)::numeric / count(DISTINCT participants.session_id)
        ELSE 0
    END AS average_per_game
FROM private._history_participant_session_rollups participants
WHERE participants.account_id IS NOT NULL
GROUP BY participants.account_id
ORDER BY total_drinks DESC,
    average_per_game DESC,
    account_id ASC;
REVOKE ALL ON TABLE public.lifetime_player_stats
FROM PUBLIC,
    anon,
    authenticated;
GRANT SELECT ON TABLE public.lifetime_player_stats TO authenticated,
    service_role;