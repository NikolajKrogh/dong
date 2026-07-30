-- 039_batch_room_matches.sql
-- Batch counterparts to add_room_match / remove_room_match (035).
--
-- The client's bulk "Add Matches" issued one RPC *per fixture*, and every one of
-- them went through the same wrapper that refreshes the room snapshot afterwards.
-- Adding eleven fixtures therefore cost eleven inserts — each taking the room
-- row's FOR UPDATE lock — plus eleven full snapshot reads, with the busy flag
-- flickering eleven times. "Clear all" had exactly the same shape.
--
-- Worse than the cost was the failure mode: the client's error slot is reset at
-- the start of each call, so a failure partway through a loop was overwritten by
-- the calls that followed it and the host saw nothing at all — just a pool that
-- was quietly short. One call per gesture removes that by construction.
--
-- Both functions are plpgsql, so each runs in a single transaction: the room
-- guards below abort the whole batch, and nothing half-lands. A fixture that is
-- already in the pool is *not* an abort — it is counted as skipped, matching the
-- single-add version's deliberate no-op on unique_violation (035 line ~36).

-- ---------------------------------------------------------------------------
-- private/public.add_room_matches
--
-- p_matches is a jsonb array of objects shaped like add_room_match's arguments:
--   [{"sourceProvider": "espn", "sourceMatchId": "401...", "homeTeamName": "...",
--     "awayTeamName": "...", "kickoffAt": "2026-08-22T11:30:00Z"}, ...]
-- camelCase because the payload is forwarded verbatim from the client's
-- AddRoomMatchRequest; translating it here keeps the client from having to build
-- a second, snake_cased shape purely for this call.
--
-- Returns {"added": n, "skipped": n} so the caller can report a partial outcome
-- ("added 8, 3 already in the room") instead of silently landing fewer rows than
-- the host selected.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.add_room_matches(
    p_session_id uuid,
    p_matches jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_account uuid := auth.uid();
  v_room public.game_sessions %ROWTYPE;
  v_match jsonb;
  v_added int := 0;
  v_skipped int := 0;
BEGIN
  IF v_account IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO v_room FROM public.game_sessions gs WHERE gs.id = p_session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'room_not_found'; END IF;
  IF v_room.owner_account_id <> v_account THEN RAISE EXCEPTION 'not_host'; END IF;
  IF v_room.state <> 'joinable'::public.session_state THEN RAISE EXCEPTION 'room_not_joinable'; END IF;

  -- An empty array is a no-op success rather than an error: the client can hand
  -- over whatever the filters produced without pre-checking it.
  IF p_matches IS NULL OR jsonb_typeof(p_matches) <> 'array' THEN
    RETURN jsonb_build_object('added', 0, 'skipped', 0);
  END IF;

  FOR v_match IN SELECT * FROM jsonb_array_elements(p_matches) LOOP
    BEGIN
      INSERT INTO public.matches (
        session_id, source_provider, source_match_id,
        home_team_name, away_team_name, kickoff_at
      ) VALUES (
        p_session_id,
        v_match->>'sourceProvider',
        v_match->>'sourceMatchId',
        v_match->>'homeTeamName',
        v_match->>'awayTeamName',
        (v_match->>'kickoffAt')::timestamptz
      );
      v_added := v_added + 1;
    EXCEPTION WHEN unique_violation THEN
      -- Already in this room's pool (ux_matches_session_source_match, 005). The
      -- single-add RPC treats a repeat as success; so does this. Note the index
      -- is partial (WHERE source_match_id IS NOT NULL), so hand-entered fixtures
      -- with a null source id are never deduped here — same as add_room_match.
      v_skipped := v_skipped + 1;
    END;
  END LOOP;

  RETURN jsonb_build_object('added', v_added, 'skipped', v_skipped);
END;
$$;
REVOKE ALL ON FUNCTION private.add_room_matches(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.add_room_matches(uuid, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.add_room_matches(
    session_id uuid, matches jsonb
) RETURNS jsonb
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
SELECT private.add_room_matches(session_id, matches);
$$;
REVOKE ALL ON FUNCTION public.add_room_matches(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_room_matches(uuid, jsonb) TO authenticated;

-- ---------------------------------------------------------------------------
-- private/public.remove_room_matches
--
-- Delegates per id to private.remove_room_match rather than reimplementing its
-- body, so the cascade stays defined in exactly one place: it deletes the match's
-- assignments, nulls the room's common_match_id when the removed match was it,
-- and then deletes the row (035 lines ~88-92). assignment_picks follows by FK
-- (038 lines 43-52). Re-checking the room guards per id is redundant but cheap,
-- and it keeps this function honest if remove_room_match's guards ever change.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.remove_room_matches(
    p_session_id uuid,
    p_match_ids uuid[]
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_account uuid := auth.uid();
  v_room public.game_sessions %ROWTYPE;
  v_match_id uuid;
BEGIN
  IF v_account IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO v_room FROM public.game_sessions gs WHERE gs.id = p_session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'room_not_found'; END IF;
  IF v_room.owner_account_id <> v_account THEN RAISE EXCEPTION 'not_host'; END IF;
  IF v_room.state <> 'joinable'::public.session_state THEN RAISE EXCEPTION 'room_not_joinable'; END IF;

  IF p_match_ids IS NULL THEN RETURN; END IF;

  FOREACH v_match_id IN ARRAY p_match_ids LOOP
    PERFORM private.remove_room_match(p_session_id, v_match_id);
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION private.remove_room_matches(uuid, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.remove_room_matches(uuid, uuid[]) TO service_role;

CREATE OR REPLACE FUNCTION public.remove_room_matches(
    session_id uuid, match_ids uuid[]
) RETURNS void
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
SELECT private.remove_room_matches(session_id, match_ids);
$$;
REVOKE ALL ON FUNCTION public.remove_room_matches(uuid, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.remove_room_matches(uuid, uuid[]) TO authenticated;
