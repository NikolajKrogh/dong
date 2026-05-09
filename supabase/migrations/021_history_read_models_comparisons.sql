-- 021_history_read_models_comparisons.sql
-- Comparison read-model functions for registered users and session-scoped guest participants.
CREATE OR REPLACE FUNCTION public.compare_registered_players(
        left_account_id uuid,
        right_account_id uuid
    ) RETURNS TABLE (
        player1_id uuid,
        player2_id uuid,
        player1_name text,
        player2_name text,
        player1_games_played integer,
        player2_games_played integer,
        player1_total_drinks numeric,
        player2_total_drinks numeric,
        player1_average_per_game numeric,
        player2_average_per_game numeric,
        games_played_together integer,
        player1_wins_count integer,
        player2_wins_count integer,
        tied_games_count integer,
        player1_max_in_a_game numeric,
        player2_max_in_a_game numeric,
        player1_common_match_count integer,
        player2_common_match_count integer,
        player1_efficiency numeric,
        player2_efficiency numeric,
        player1_top_drinker_count integer,
        player2_top_drinker_count integer,
        player1_avg_with_player2 numeric,
        player1_avg_without_player2 numeric,
        player2_avg_with_player1 numeric,
        player2_avg_without_player1 numeric,
        timeline_data jsonb
    ) LANGUAGE sql STABLE AS $$ WITH left_games AS (
        SELECT participants.session_id,
            participants.completed_at,
            participants.current_drink_total,
            participants.common_match_id,
            participants.session_match_count,
            participants.is_top_drinker
        FROM private._history_participant_session_rollups participants
        WHERE participants.account_id = left_account_id
    ),
    right_games AS (
        SELECT participants.session_id,
            participants.completed_at,
            participants.current_drink_total,
            participants.common_match_id,
            participants.session_match_count,
            participants.is_top_drinker
        FROM private._history_participant_session_rollups participants
        WHERE participants.account_id = right_account_id
    ),
    shared_games AS (
        SELECT left_games.session_id,
            left_games.completed_at,
            left_games.current_drink_total AS player1_drinks,
            right_games.current_drink_total AS player2_drinks
        FROM left_games
            INNER JOIN right_games USING (session_id)
    ),
    left_without_games AS (
        SELECT left_games.*
        FROM left_games
            LEFT JOIN shared_games USING (session_id)
        WHERE shared_games.session_id IS NULL
    ),
    right_without_games AS (
        SELECT right_games.*
        FROM right_games
            LEFT JOIN shared_games USING (session_id)
        WHERE shared_games.session_id IS NULL
    ),
    left_totals AS (
        SELECT count(*)::integer AS games_played,
            COALESCE(sum(current_drink_total), 0)::numeric AS total_drinks,
            COALESCE(sum(session_match_count), 0)::integer AS total_matches,
            COALESCE(max(current_drink_total), 0)::numeric AS max_in_a_game,
            COALESCE(
                count(*) FILTER (
                    WHERE common_match_id IS NOT NULL
                ),
                0
            )::integer AS common_match_count,
            COALESCE(
                count(*) FILTER (
                    WHERE is_top_drinker
                ),
                0
            )::integer AS top_drinker_count
        FROM left_games
    ),
    right_totals AS (
        SELECT count(*)::integer AS games_played,
            COALESCE(sum(current_drink_total), 0)::numeric AS total_drinks,
            COALESCE(sum(session_match_count), 0)::integer AS total_matches,
            COALESCE(max(current_drink_total), 0)::numeric AS max_in_a_game,
            COALESCE(
                count(*) FILTER (
                    WHERE common_match_id IS NOT NULL
                ),
                0
            )::integer AS common_match_count,
            COALESCE(
                count(*) FILTER (
                    WHERE is_top_drinker
                ),
                0
            )::integer AS top_drinker_count
        FROM right_games
    )
SELECT left_account_id AS player1_id,
    right_account_id AS player2_id,
    COALESCE(
        (
            SELECT preferred_display_name
            FROM private._history_account_display_names
            WHERE account_id = left_account_id
        ),
        left_account_id::text
    ) AS player1_name,
    COALESCE(
        (
            SELECT preferred_display_name
            FROM private._history_account_display_names
            WHERE account_id = right_account_id
        ),
        right_account_id::text
    ) AS player2_name,
    left_totals.games_played AS player1_games_played,
    right_totals.games_played AS player2_games_played,
    left_totals.total_drinks AS player1_total_drinks,
    right_totals.total_drinks AS player2_total_drinks,
    CASE
        WHEN left_totals.games_played > 0 THEN left_totals.total_drinks / left_totals.games_played
        ELSE 0
    END AS player1_average_per_game,
    CASE
        WHEN right_totals.games_played > 0 THEN right_totals.total_drinks / right_totals.games_played
        ELSE 0
    END AS player2_average_per_game,
    COALESCE(
        (
            SELECT count(*)::integer
            FROM shared_games
        ),
        0
    ) AS games_played_together,
    COALESCE(
        (
            SELECT count(*)::integer
            FROM shared_games
            WHERE player1_drinks > player2_drinks
        ),
        0
    ) AS player1_wins_count,
    COALESCE(
        (
            SELECT count(*)::integer
            FROM shared_games
            WHERE player2_drinks > player1_drinks
        ),
        0
    ) AS player2_wins_count,
    COALESCE(
        (
            SELECT count(*)::integer
            FROM shared_games
            WHERE player1_drinks = player2_drinks
        ),
        0
    ) AS tied_games_count,
    left_totals.max_in_a_game AS player1_max_in_a_game,
    right_totals.max_in_a_game AS player2_max_in_a_game,
    left_totals.common_match_count AS player1_common_match_count,
    right_totals.common_match_count AS player2_common_match_count,
    CASE
        WHEN left_totals.total_matches > 0 THEN left_totals.total_drinks / left_totals.total_matches
        ELSE 0
    END AS player1_efficiency,
    CASE
        WHEN right_totals.total_matches > 0 THEN right_totals.total_drinks / right_totals.total_matches
        ELSE 0
    END AS player2_efficiency,
    left_totals.top_drinker_count AS player1_top_drinker_count,
    right_totals.top_drinker_count AS player2_top_drinker_count,
    COALESCE(
        (
            SELECT CASE
                    WHEN count(*) > 0 THEN sum(player1_drinks) / count(*)
                    ELSE 0
                END
            FROM shared_games
        ),
        0
    ) AS player1_avg_with_player2,
    COALESCE(
        (
            SELECT CASE
                    WHEN count(*) > 0 THEN sum(current_drink_total) / count(*)
                    ELSE 0
                END
            FROM left_without_games
        ),
        0
    ) AS player1_avg_without_player2,
    COALESCE(
        (
            SELECT CASE
                    WHEN count(*) > 0 THEN sum(player2_drinks) / count(*)
                    ELSE 0
                END
            FROM shared_games
        ),
        0
    ) AS player2_avg_with_player1,
    COALESCE(
        (
            SELECT CASE
                    WHEN count(*) > 0 THEN sum(current_drink_total) / count(*)
                    ELSE 0
                END
            FROM right_without_games
        ),
        0
    ) AS player2_avg_without_player1,
    COALESCE(
        (
            SELECT jsonb_agg(
                    jsonb_build_object(
                        'date',
                        completed_at::text,
                        'player1Drinks',
                        player1_drinks,
                        'player2Drinks',
                        player2_drinks
                    )
                    ORDER BY completed_at,
                        session_id
                )
            FROM shared_games
        ),
        '[]'::jsonb
    ) AS timeline_data
FROM left_totals,
    right_totals;
$$;
REVOKE ALL ON FUNCTION public.compare_registered_players(uuid, uuid)
FROM PUBLIC,
    anon,
    authenticated;
GRANT EXECUTE ON FUNCTION public.compare_registered_players(uuid, uuid) TO authenticated,
    service_role;
CREATE OR REPLACE FUNCTION public.compare_session_participants(
        p_session_id uuid,
        p_left_participant_id uuid,
        p_right_participant_id uuid
    ) RETURNS TABLE (
        player1_id uuid,
        player2_id uuid,
        player1_name text,
        player2_name text,
        player1_games_played integer,
        player2_games_played integer,
        player1_total_drinks numeric,
        player2_total_drinks numeric,
        player1_average_per_game numeric,
        player2_average_per_game numeric,
        games_played_together integer,
        player1_wins_count integer,
        player2_wins_count integer,
        tied_games_count integer,
        player1_max_in_a_game numeric,
        player2_max_in_a_game numeric,
        player1_common_match_count integer,
        player2_common_match_count integer,
        player1_efficiency numeric,
        player2_efficiency numeric,
        player1_top_drinker_count integer,
        player2_top_drinker_count integer,
        player1_avg_with_player2 numeric,
        player1_avg_without_player2 numeric,
        player2_avg_with_player1 numeric,
        player2_avg_without_player1 numeric,
        timeline_data jsonb
    ) LANGUAGE plpgsql STABLE AS $$ BEGIN IF NOT EXISTS (
        SELECT 1
        FROM private._history_participant_session_rollups participants
        WHERE participants.session_id = p_session_id
            AND participants.participant_id = p_left_participant_id
    )
    OR NOT EXISTS (
        SELECT 1
        FROM private._history_participant_session_rollups participants
        WHERE participants.session_id = p_session_id
            AND participants.participant_id = p_right_participant_id
    ) THEN RAISE EXCEPTION 'participants must belong to the same completed session %',
    p_session_id;
END IF;
RETURN QUERY WITH left_games AS (
    SELECT participants.session_id,
        participants.completed_at,
        participants.current_drink_total,
        participants.common_match_id,
        participants.session_match_count,
        participants.is_top_drinker,
        participants.display_name
    FROM private._history_participant_session_rollups participants
    WHERE participants.session_id = p_session_id
        AND participants.participant_id = p_left_participant_id
),
right_games AS (
    SELECT participants.session_id,
        participants.completed_at,
        participants.current_drink_total,
        participants.common_match_id,
        participants.session_match_count,
        participants.is_top_drinker,
        participants.display_name
    FROM private._history_participant_session_rollups participants
    WHERE participants.session_id = p_session_id
        AND participants.participant_id = p_right_participant_id
),
shared_games AS (
    SELECT left_games.session_id,
        left_games.completed_at,
        left_games.current_drink_total AS player1_drinks,
        right_games.current_drink_total AS player2_drinks
    FROM left_games
        INNER JOIN right_games USING (session_id)
),
left_without_games AS (
    SELECT left_games.*
    FROM left_games
        LEFT JOIN shared_games USING (session_id)
    WHERE shared_games.session_id IS NULL
),
right_without_games AS (
    SELECT right_games.*
    FROM right_games
        LEFT JOIN shared_games USING (session_id)
    WHERE shared_games.session_id IS NULL
),
left_totals AS (
    SELECT count(*)::integer AS games_played,
        COALESCE(sum(current_drink_total), 0)::numeric AS total_drinks,
        COALESCE(sum(session_match_count), 0)::integer AS total_matches,
        COALESCE(max(current_drink_total), 0)::numeric AS max_in_a_game,
        COALESCE(
            count(*) FILTER (
                WHERE common_match_id IS NOT NULL
            ),
            0
        )::integer AS common_match_count,
        COALESCE(
            count(*) FILTER (
                WHERE is_top_drinker
            ),
            0
        )::integer AS top_drinker_count
    FROM left_games
),
right_totals AS (
    SELECT count(*)::integer AS games_played,
        COALESCE(sum(current_drink_total), 0)::numeric AS total_drinks,
        COALESCE(sum(session_match_count), 0)::integer AS total_matches,
        COALESCE(max(current_drink_total), 0)::numeric AS max_in_a_game,
        COALESCE(
            count(*) FILTER (
                WHERE common_match_id IS NOT NULL
            ),
            0
        )::integer AS common_match_count,
        COALESCE(
            count(*) FILTER (
                WHERE is_top_drinker
            ),
            0
        )::integer AS top_drinker_count
    FROM right_games
)
SELECT p_left_participant_id AS player1_id,
    p_right_participant_id AS player2_id,
    (
        SELECT display_name
        FROM left_games
        LIMIT 1
    ) AS player1_name,
    (
        SELECT display_name
        FROM right_games
        LIMIT 1
    ) AS player2_name,
    left_totals.games_played AS player1_games_played,
    right_totals.games_played AS player2_games_played,
    left_totals.total_drinks AS player1_total_drinks,
    right_totals.total_drinks AS player2_total_drinks,
    CASE
        WHEN left_totals.games_played > 0 THEN left_totals.total_drinks / left_totals.games_played
        ELSE 0
    END AS player1_average_per_game,
    CASE
        WHEN right_totals.games_played > 0 THEN right_totals.total_drinks / right_totals.games_played
        ELSE 0
    END AS player2_average_per_game,
    COALESCE(
        (
            SELECT count(*)::integer
            FROM shared_games
        ),
        0
    ) AS games_played_together,
    COALESCE(
        (
            SELECT count(*)::integer
            FROM shared_games
            WHERE player1_drinks > player2_drinks
        ),
        0
    ) AS player1_wins_count,
    COALESCE(
        (
            SELECT count(*)::integer
            FROM shared_games
            WHERE player2_drinks > player1_drinks
        ),
        0
    ) AS player2_wins_count,
    COALESCE(
        (
            SELECT count(*)::integer
            FROM shared_games
            WHERE player1_drinks = player2_drinks
        ),
        0
    ) AS tied_games_count,
    left_totals.max_in_a_game AS player1_max_in_a_game,
    right_totals.max_in_a_game AS player2_max_in_a_game,
    left_totals.common_match_count AS player1_common_match_count,
    right_totals.common_match_count AS player2_common_match_count,
    CASE
        WHEN left_totals.total_matches > 0 THEN left_totals.total_drinks / left_totals.total_matches
        ELSE 0
    END AS player1_efficiency,
    CASE
        WHEN right_totals.total_matches > 0 THEN right_totals.total_drinks / right_totals.total_matches
        ELSE 0
    END AS player2_efficiency,
    left_totals.top_drinker_count AS player1_top_drinker_count,
    right_totals.top_drinker_count AS player2_top_drinker_count,
    COALESCE(
        (
            SELECT CASE
                    WHEN count(*) > 0 THEN sum(player1_drinks) / count(*)
                    ELSE 0
                END
            FROM shared_games
        ),
        0
    ) AS player1_avg_with_player2,
    COALESCE(
        (
            SELECT CASE
                    WHEN count(*) > 0 THEN sum(current_drink_total) / count(*)
                    ELSE 0
                END
            FROM left_without_games
        ),
        0
    ) AS player1_avg_without_player2,
    COALESCE(
        (
            SELECT CASE
                    WHEN count(*) > 0 THEN sum(player2_drinks) / count(*)
                    ELSE 0
                END
            FROM shared_games
        ),
        0
    ) AS player2_avg_with_player1,
    COALESCE(
        (
            SELECT CASE
                    WHEN count(*) > 0 THEN sum(current_drink_total) / count(*)
                    ELSE 0
                END
            FROM right_without_games
        ),
        0
    ) AS player2_avg_without_player1,
    COALESCE(
        (
            SELECT jsonb_agg(
                    jsonb_build_object(
                        'date',
                        completed_at::text,
                        'player1Drinks',
                        player1_drinks,
                        'player2Drinks',
                        player2_drinks
                    )
                    ORDER BY completed_at,
                        session_id
                )
            FROM shared_games
        ),
        '[]'::jsonb
    ) AS timeline_data
FROM left_totals,
    right_totals;
END;
$$;
REVOKE ALL ON FUNCTION public.compare_session_participants(uuid, uuid, uuid)
FROM PUBLIC,
    anon,
    authenticated;
GRANT EXECUTE ON FUNCTION public.compare_session_participants(uuid, uuid, uuid) TO authenticated,
    service_role;