-- 038_player_picked_mode.sql
-- US5.6 (#185): player-picked assignment mode -- each participant picks their
-- own matches from the host's pool, on their own device, and the server keeps
-- every pick and fills the remainder at start.
--
-- Builds on 037 (assignment_mode enum + column, mode-aware
-- compute_room_assignment_plan/set_room_assignment_settings, host-assigned
-- settlement branch), 035 (set_room_assignments, remove_room_match,
-- set_common_match), 032 (leave_room_as_member/_as_guest -- the identity-split
-- precedent), 026 (guest room-scoped token hashing), 017/013 (room RLS and
-- grants).
--
-- Scope is the #185 slice of specs/020-canonical-assignment-generation/spec.md
-- (Delivery Slices table): User Story 6. Mid-game reassignment (#186) is out of
-- scope. The `player_picked` enum value already exists (037), so no ALTER TYPE
-- is needed here -- only the client's mode selector was withholding it.
--
-- Design notes live in specs/022-player-picked-mode/: research.md R1 (why a new
-- table rather than reusing public.assignments as #184 did), R2 (why
-- replace-all + FOR UPDATE), R3 (the two identity kinds), R4 (RLS), R5 (why the
-- participant cascade is defensive only -- leaves are soft), R6 (why settlement
-- is not host-assigned's shape), R16 (the lowered-cap seed bound).

-- ---------------------------------------------------------------------------
-- public.assignment_picks (NEW) -- a participant's own pre-start intention.
--
-- Deliberately shaped identically to public.assignments (007_create_assignments)
-- so settlement's seed is a plain INSERT ... SELECT with no shape translation.
-- Separate from that table because player-picked mode introduces a *second,
-- non-host* writer: sharing one table would let the host's replace-all
-- set_room_assignments silently destroy every participant's picks, and would
-- leave no way to tell whose intent a row represented (research.md R1).
--
-- Both FKs cascade. The match cascade is load-bearing: private.remove_room_match
-- (035, line ~92) HARD-deletes the match row, and explicitly deletes dependent
-- public.assignments rows first because that table has no cascade. Declaring the
-- cascade here means a host removing a picked match cannot hit an FK violation,
-- and leaves remove_room_match byte-for-byte unchanged. The participant cascade
-- is defensive only -- nothing in this codebase hard-deletes a participant; all
-- three leave paths soft-leave via left_at, which is why FR-041a is satisfied by
-- settlement's roster filter and NOT by this cascade (research.md R5).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.assignment_picks (
    session_id uuid NOT NULL,
    participant_id uuid NOT NULL,
    match_id uuid NOT NULL,
    created_at timestamptz DEFAULT now(),
    PRIMARY KEY (session_id, participant_id, match_id),
    CONSTRAINT fk_assignment_picks_participant FOREIGN KEY (session_id, participant_id)
        REFERENCES public.participants(session_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_assignment_picks_match FOREIGN KEY (session_id, match_id)
        REFERENCES public.matches(session_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_assignment_picks_session_id ON public.assignment_picks (session_id);
CREATE INDEX IF NOT EXISTS idx_assignment_picks_participant_id ON public.assignment_picks (participant_id);
CREATE INDEX IF NOT EXISTS idx_assignment_picks_match_id ON public.assignment_picks (match_id);

-- ---------------------------------------------------------------------------
-- Grants and RLS, mirroring public.assignments exactly (013_enable_rls_and_grants,
-- 017_room_read_rls). The constitution's "persistent schema changes MUST ship
-- with migrations, indexes, and RLS updates" clause binds here for the first
-- time in this delivery line -- #184 added no table (research.md R4).
--
-- SELECT only for `authenticated`, scoped by private.can_access_session. There
-- is deliberately NO insert/update/delete policy: every write goes through the
-- SECURITY DEFINER RPCs below, which resolve the acting participant from the
-- caller's own credential. Guests are the `anon` role and get no table grant at
-- all -- they read picks through private.build_guest_room_snapshot, which is
-- SECURITY DEFINER and bypasses RLS, exactly as they already read participants
-- and matches.
-- ---------------------------------------------------------------------------
REVOKE ALL ON TABLE public.assignment_picks
FROM anon,
    authenticated;

GRANT SELECT ON TABLE public.assignment_picks TO authenticated;

GRANT SELECT,
    INSERT,
    UPDATE,
    DELETE ON TABLE public.assignment_picks TO service_role;

ALTER TABLE public.assignment_picks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS assignment_picks_room_members_select ON public.assignment_picks;

CREATE POLICY assignment_picks_room_members_select ON public.assignment_picks FOR
SELECT TO authenticated USING (
        private.can_access_session(public.assignment_picks.session_id)
    );

-- ---------------------------------------------------------------------------
-- private.write_room_picks -- the shared normalise/validate/write body behind
-- both pick RPCs (contracts/room-rpcs.md §1-§2).
--
-- Factored out deliberately: the two RPCs differ ONLY in how they establish who
-- is calling (auth.uid() vs. room-scoped token hash). Everything after that --
-- the Common-Match strip, the COALESCE'd cap comparison, pool confinement, and
-- the replace-all write -- is security-relevant and identical, so sharing it is
-- what stops the guest path from drifting from the member path.
--
-- The caller is responsible for having taken the room's FOR UPDATE lock and for
-- checking room state/mode, because the two RPCs raise those errors in a
-- different order (a guest's token resolution precedes them; a member's follows
-- them) -- see the contract's precondition tables.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.write_room_picks(
    p_session_id uuid,
    p_participant_id uuid,
    p_match_ids uuid[],
    p_common_match_id uuid,
    p_cap int
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_picks uuid[];
  v_count int;
  v_in_pool int;
BEGIN
  -- Normalise before validating: NULL becomes an explicit "release everything",
  -- duplicates collapse, and the Common Match is stripped rather than rejected
  -- (FR-040a -- picking or releasing it is a no-op, and it never counts toward
  -- the cap). The `p_common_match_id IS NULL OR` guard matters: `x <> NULL` is
  -- NULL, which WHERE would discard, silently dropping every pick in a room
  -- with no Common Match designated yet.
  SELECT COALESCE(array_agg(DISTINCT x), '{}'::uuid[]) INTO v_picks
  FROM unnest(COALESCE(p_match_ids, '{}'::uuid[])) AS x
  WHERE p_common_match_id IS NULL OR x <> p_common_match_id;

  -- COALESCE is required, not cosmetic: array_length('{}'::uuid[], 1) returns
  -- NULL, not 0, so an unwrapped comparison would make the legitimate
  -- release-everything path either pass or raise depending purely on how this
  -- guard were phrased (contracts/room-rpcs.md §1 precondition 7).
  v_count := COALESCE(array_length(v_picks, 1), 0);

  IF v_count > p_cap THEN
    RAISE EXCEPTION 'pick_limit_exceeded';
  END IF;

  -- FR-039: every pick must be in *this room's* pool. Players never reach the
  -- wider match catalogue.
  IF v_count > 0 THEN
    SELECT count(*) INTO v_in_pool FROM public.matches m
    WHERE m.session_id = p_session_id AND m.id = ANY (v_picks);

    IF v_in_pool <> v_count THEN
      RAISE EXCEPTION 'match_not_found';
    END IF;
  END IF;

  -- Replace-all for this participant only (research.md R2): idempotent, and the
  -- submitted array *is* the resulting count, so the cap cannot be raced.
  DELETE FROM public.assignment_picks ap
  WHERE ap.session_id = p_session_id
    AND ap.participant_id = p_participant_id;

  IF v_count > 0 THEN
    INSERT INTO public.assignment_picks (session_id, participant_id, match_id, created_at)
    SELECT p_session_id, p_participant_id, x, now()
    FROM unnest(v_picks) AS x;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION private.write_room_picks(uuid, uuid, uuid[], uuid, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.write_room_picks(uuid, uuid, uuid[], uuid, int) TO service_role;

-- ---------------------------------------------------------------------------
-- private/public.set_my_room_picks (NEW, FR-038, FR-038a, FR-039, FR-040)
-- contracts/room-rpcs.md §1.
--
-- Replaces the CALLING participant's own picks. Note what is absent: there is
-- no p_participant_id parameter, so FR-039's "MUST NOT be able to change
-- another participant's picks" is structural rather than merely checked -- there
-- is no argument through which to name someone else. And there is no
-- owner_account_id check: the host is an ordinary participant of their own room
-- and picks their own matches like anyone else (research.md R3).
--
-- FOR UPDATE on the room row is for mutual exclusion with start_game_session,
-- which takes the same lock -- without it a pick could land between
-- settlement's roster lock and its seed-from-picks read and be silently lost
-- (research.md R2). It is NOT needed for the cap; replace-all handles that.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.set_my_room_picks(
    p_session_id uuid,
    p_match_ids uuid[]
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_account uuid := auth.uid();
  v_room public.game_sessions %ROWTYPE;
  v_participant_id uuid;
BEGIN
  IF v_account IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO v_room FROM public.game_sessions gs WHERE gs.id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'room_not_found'; END IF;
  IF v_room.state <> 'joinable'::public.session_state THEN RAISE EXCEPTION 'room_not_joinable'; END IF;
  IF v_room.assignment_mode <> 'player_picked'::public.assignment_mode THEN
    RAISE EXCEPTION 'room_not_player_picked';
  END IF;

  SELECT p.id INTO v_participant_id FROM public.participants p
  WHERE p.session_id = p_session_id
    AND p.account_id = v_account
    AND p.membership_type = 'registered'::public.participant_membership_type
    AND p.left_at IS NULL
  LIMIT 1;
  IF v_participant_id IS NULL THEN RAISE EXCEPTION 'not_a_participant'; END IF;

  PERFORM private.write_room_picks(
    p_session_id,
    v_participant_id,
    p_match_ids,
    v_room.common_match_id,
    v_room.matches_per_player
  );
END;
$$;
REVOKE ALL ON FUNCTION private.set_my_room_picks(uuid, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.set_my_room_picks(uuid, uuid[]) TO service_role;

CREATE OR REPLACE FUNCTION public.set_my_room_picks(
    session_id uuid, match_ids uuid[]
) RETURNS void
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
SELECT private.set_my_room_picks(session_id, match_ids);
$$;
REVOKE ALL ON FUNCTION public.set_my_room_picks(uuid, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_my_room_picks(uuid, uuid[]) TO authenticated;

-- ---------------------------------------------------------------------------
-- private/public.set_my_room_picks_as_guest (NEW, FR-038, FR-038a)
-- contracts/room-rpcs.md §2.
--
-- The guest counterpart. Session-scoped guests have no auth.uid(), so identity
-- comes from the room-scoped token hash -- the pattern established by
-- 026_guest_room_join.sql and reused by leave_room_as_guest
-- (032_room_membership_rpcs.sql). The session is derived from the resolved
-- participant, so a guest names neither a room nor a participant.
--
-- Split from set_my_room_picks rather than merged behind an optional token
-- argument: a single function whose authorisation path depends on which
-- argument is NULL is the shape most likely to be got wrong later, and it would
-- need an anon grant on a function registered members also call. The repo
-- already splits exactly this way for leaving (research.md R3).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.set_my_room_picks_as_guest(
    p_guest_token text,
    p_match_ids uuid[]
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_token text := btrim(COALESCE(p_guest_token, ''));
  v_hash text;
  v_participant public.participants %ROWTYPE;
  v_room public.game_sessions %ROWTYPE;
BEGIN
  IF v_token = '' THEN RAISE EXCEPTION 'guest_token_expired'; END IF;

  v_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');

  SELECT * INTO v_participant FROM public.participants p
  WHERE p.guest_rejoin_token_hash = v_hash
    AND p.membership_type = 'guest'::public.participant_membership_type
    AND p.left_at IS NULL
  LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'guest_token_expired'; END IF;

  SELECT * INTO v_room FROM public.game_sessions gs
  WHERE gs.id = v_participant.session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'room_not_found'; END IF;
  IF v_room.state <> 'joinable'::public.session_state THEN RAISE EXCEPTION 'room_not_joinable'; END IF;
  IF v_room.assignment_mode <> 'player_picked'::public.assignment_mode THEN
    RAISE EXCEPTION 'room_not_player_picked';
  END IF;

  PERFORM private.write_room_picks(
    v_participant.session_id,
    v_participant.id,
    p_match_ids,
    v_room.common_match_id,
    v_room.matches_per_player
  );
END;
$$;
REVOKE ALL ON FUNCTION private.set_my_room_picks_as_guest(text, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.set_my_room_picks_as_guest(text, uuid[]) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.set_my_room_picks_as_guest(
    guest_token text, match_ids uuid[]
) RETURNS void
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
SELECT private.set_my_room_picks_as_guest(guest_token, match_ids);
$$;
REVOKE ALL ON FUNCTION public.set_my_room_picks_as_guest(text, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_my_room_picks_as_guest(text, uuid[]) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- build_guest_room_snapshot: add the 'picks' key (FR-042).
-- contracts/room-rpcs.md §3.
--
-- Additive only -- no existing key removed, renamed, reordered, or retyped, and
-- the signature is unchanged, so 026's REVOKE/GRANT carry over and no
-- DROP FUNCTION is needed.
--
-- This ONE edit serves all three client surfaces, because both snapshot RPCs
-- delegate here: private.get_room_snapshot (032, line ~74) for the host and
-- registered members, and private.get_guest_room_snapshot (026, line ~269) for
-- session-scoped guests. That is what lets pick progress ride the poll every
-- client already runs, with no new fetch (research.md R7) -- the same precedent
-- #184 set with 'assignmentMode'.
--
-- Picks belonging to participants who have left are included (leaves are soft);
-- clients render progress against the roster they already hold, so a departed
-- participant's picks are naturally not displayed.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.build_guest_room_snapshot(p_session_id uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = '' AS $$
SELECT jsonb_build_object(
        'sessionId',
        game_sessions.id::text,
        'joinCode',
        game_sessions.join_code,
        'state',
        game_sessions.state::text,
        'commonMatchId',
        game_sessions.common_match_id::text,
        'assignmentMode',
        game_sessions.assignment_mode::text,
        'participants',
        COALESCE(
            (
                SELECT jsonb_agg(
                        jsonb_build_object(
                            'id',
                            participants.id::text,
                            'displayName',
                            participants.display_name,
                            'membershipType',
                            participants.membership_type::text,
                            'sessionRole',
                            participants.session_role::text,
                            'currentDrinkTotal',
                            participants.current_drink_total
                        )
                        ORDER BY participants.created_at,
                            participants.id
                    )
                FROM public.participants participants
                WHERE participants.session_id = game_sessions.id
            ),
            '[]'::jsonb
        ),
        'matches',
        COALESCE(
            (
                SELECT jsonb_agg(
                        jsonb_build_object(
                            'id',
                            matches.id::text,
                            'sourceProvider',
                            matches.source_provider,
                            'sourceMatchId',
                            matches.source_match_id,
                            'homeTeamName',
                            matches.home_team_name,
                            'awayTeamName',
                            matches.away_team_name,
                            'kickoffAt',
                            matches.kickoff_at,
                            'homeScore',
                            matches.home_score,
                            'awayScore',
                            matches.away_score
                        )
                        ORDER BY matches.created_at,
                            matches.id
                    )
                FROM public.matches matches
                WHERE matches.session_id = game_sessions.id
            ),
            '[]'::jsonb
        ),
        'assignments',
        COALESCE(
            (
                SELECT jsonb_agg(
                        jsonb_build_object(
                            'participantId',
                            assignments.participant_id::text,
                            'matchId',
                            assignments.match_id::text
                        )
                        ORDER BY assignments.participant_id,
                            assignments.match_id
                    )
                FROM public.assignments assignments
                WHERE assignments.session_id = game_sessions.id
            ),
            '[]'::jsonb
        ),
        'picks',
        COALESCE(
            (
                SELECT jsonb_agg(
                        jsonb_build_object(
                            'participantId',
                            assignment_picks.participant_id::text,
                            'matchId',
                            assignment_picks.match_id::text
                        )
                        ORDER BY assignment_picks.participant_id,
                            assignment_picks.match_id
                    )
                FROM public.assignment_picks assignment_picks
                WHERE assignment_picks.session_id = game_sessions.id
            ),
            '[]'::jsonb
        ),
        'assignmentPlan',
        private.compute_room_assignment_plan(game_sessions.id)
    )
FROM public.game_sessions game_sessions
WHERE game_sessions.id = p_session_id;
$$;
-- Signature unchanged -- existing REVOKE/GRANT carry over.


-- ---------------------------------------------------------------------------
-- start_game_session: add the player_picked settlement branch (FR-041, FR-041a).
-- contracts/room-rpcs.md §4, research.md R6 and R16.
--
-- Same three-argument signature as 037 -- CREATE OR REPLACE suffices, no
-- DROP FUNCTION, and existing REVOKE/GRANT carry over.
--
-- UNCHANGED from 037: all five pre-existing guards, the retry/idempotency
-- handling, the room FOR UPDATE lock, the roster lock, the automatic and relaxed
-- branches, the host_assigned branch, both gameplay_events inserts, and the
-- return shape.
--
-- Three things change, all confined to how public.assignments gets seeded:
--
--  1. The delete step: player_picked takes the FULL delete (the automatic path),
--     NOT host_assigned's selective one. Host-assigned preserves rows because
--     its drafts live in public.assignments itself; picks live in
--     public.assignment_picks, so there is nothing there worth keeping. This is
--     why this branch is not a parameterisation of the host-assigned one
--     (research.md R6).
--
--  2. A new seed step copies picks into public.assignments, filtered three ways
--     and bounded per participant -- see the comments on that block.
--
--  3. The count-and-fill loop's guard widens from host_assigned to
--     "host_assigned OR player_picked". The loop BODY is untouched: both modes
--     want exactly "top each participant up to effectivePerPlayer from the pool,
--     excluding the Common Match and anything already held".
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.start_game_session(
    p_session_id uuid,
    p_idempotency_key uuid,
    p_relax_constraints boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_account uuid := auth.uid();
  v_room public.game_sessions %ROWTYPE;
  v_host_participant_id uuid;
  v_participant_count int;
  v_match_count int;
  v_plan jsonb;
  v_effective_per_player int;
  v_shared_per_pair int;
  v_relaxed_floor int;
  v_feasible boolean;
  v_participant_ids uuid[];
  v_pool_ids uuid[];
  v_pool_cursor int := 1;
  v_p int; -- active participant count, as an array bound
  v_i int;
  v_j int;
  v_kk int;
  v_needed int;
  v_held int;
  v_match_id uuid;
  v_assignments_created int;
  v_filled_participant_ids uuid[] := '{}'::uuid[];
BEGIN
  IF v_account IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO v_room FROM public.game_sessions gs WHERE gs.id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'room_not_found'; END IF;
  IF v_room.owner_account_id <> v_account THEN RAISE EXCEPTION 'not_host'; END IF;
  IF v_room.state <> 'joinable'::public.session_state THEN RAISE EXCEPTION 'invalid_room_state'; END IF;

  SELECT count(*) INTO v_participant_count FROM public.participants
  WHERE session_id = p_session_id AND left_at IS NULL;
  IF v_participant_count = 0 THEN RAISE EXCEPTION 'empty_participants'; END IF;

  SELECT count(*) INTO v_match_count FROM public.matches WHERE session_id = p_session_id;
  IF v_match_count = 0 THEN RAISE EXCEPTION 'empty_matches'; END IF;

  IF v_room.common_match_id IS NULL THEN RAISE EXCEPTION 'missing_common_match'; END IF;
  PERFORM 1 FROM public.matches WHERE id = v_room.common_match_id AND session_id = p_session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid_common_match'; END IF;

  v_plan := private.compute_room_assignment_plan(p_session_id);
  v_effective_per_player := (v_plan->>'effectivePerPlayer')::int;
  v_shared_per_pair := (v_plan->>'sharedMatchesPerPair')::int;
  v_relaxed_floor := (v_plan->>'relaxedFloor')::int;
  v_feasible := (v_plan->>'feasible')::boolean;

  -- FR-017: the arithmetic floor is never overridable, relaxed or not, in any mode.
  IF v_match_count < v_relaxed_floor THEN
    RAISE EXCEPTION 'insufficient_match_pool';
  END IF;

  -- FR-013: a satisfiable-but-under-configured pool pauses on the host's
  -- explicit choice rather than starting silently or rejecting outright.
  -- Outside automatic mode, compute_room_assignment_plan sets
  -- requiredPoolSize = relaxedFloor, so v_feasible is trivially true once the
  -- floor check above passes -- this branch never fires for host_assigned.
  IF NOT v_feasible AND NOT p_relax_constraints THEN
    RAISE EXCEPTION 'assignment_constraints_unsatisfiable';
  END IF;

  -- FR-005/FR-006: roster and pool are locked/fixed as of this point (the
  -- FOR UPDATE above), and both are shuffled here for a varied arrangement.
  SELECT array_agg(id ORDER BY random()) INTO v_participant_ids
  FROM public.participants WHERE session_id = p_session_id AND left_at IS NULL;
  v_p := array_length(v_participant_ids, 1);

  SELECT array_agg(id ORDER BY random()) INTO v_pool_ids
  FROM public.matches WHERE session_id = p_session_id AND id <> v_room.common_match_id;

  IF v_room.assignment_mode = 'host_assigned'::public.assignment_mode THEN
    -- FR-022 still holds, but selectively: only rows belonging to a
    -- participant no longer on the locked active roster are superseded here.
    -- Rows for active participants are the host's allocations and are kept.
    DELETE FROM public.assignments a
    WHERE a.session_id = p_session_id
      AND a.participant_id <> ALL (v_participant_ids);
  ELSE
    DELETE FROM public.assignments WHERE session_id = p_session_id;
  END IF;

  IF v_room.assignment_mode = 'player_picked'::public.assignment_mode THEN
    -- FR-041: seed the settled set from each participant's own picks, keeping
    -- every one of them, then let the shared fill loop below top up the
    -- remainder. Four conditions, each load-bearing:
    --
    --  * participant_id = ANY (v_participant_ids) -- FR-041a. Leaves are SOFT
    --    (left_at), so a departed participant's pick rows still exist; this
    --    filter, not an FK cascade, is what implements "their picks leave with
    --    them" (research.md R5).
    --  * match_id <> common_match_id -- FR-040a. Also covers the case where a
    --    picked match was later PROMOTED to Common Match by set_common_match:
    --    the pick drops out here, the participant is one short, and the fill
    --    loop tops them up -- correct, since they hold the Common Match anyway
    --    (research.md R8).
    --  * still present in public.matches -- belt-and-braces alongside the FK
    --    cascade, and it keeps the invariant local to the settlement code.
    --  * rn <= v_effective_per_player -- the cap (FR-003). Reachable only via an
    --    ordering the pick RPC cannot prevent: the host LOWERS
    --    matches_per_player after participants have picked. Cap 3 -> pick 3 ->
    --    host sets 2 would otherwise seed all 3, and the fill loop computes
    --    v_needed := 2 - 3 = -1, which is not > 0, so it neither fills NOR
    --    trims -- leaving that participant holding 3 while everyone else holds
    --    2. host_assigned never needed this because its allocations are
    --    deliberately uncapped (FR-034); player_picked has a hard cap (FR-040),
    --    so an over-hold is not a reachable intended state (research.md R16).
    --    ORDER BY random() rather than created_at: which picks survive a shrunk
    --    cap is arbitrary, and ordering by insertion would imply a fairness
    --    guarantee the spec does not make.
    INSERT INTO public.assignments (session_id, participant_id, match_id, created_at)
    SELECT p_session_id, ranked.participant_id, ranked.match_id, now()
    FROM (
      SELECT ap.participant_id,
             ap.match_id,
             row_number() OVER (
               PARTITION BY ap.participant_id ORDER BY random()
             ) AS rn
      FROM public.assignment_picks ap
      WHERE ap.session_id = p_session_id
        AND ap.participant_id = ANY (v_participant_ids)
        AND ap.match_id <> v_room.common_match_id
        AND EXISTS (
          SELECT 1 FROM public.matches m
          WHERE m.session_id = p_session_id AND m.id = ap.match_id
        )
    ) ranked
    WHERE ranked.rn <= v_effective_per_player;
  END IF;

  IF v_room.assignment_mode IN (
       'host_assigned'::public.assignment_mode,
       'player_picked'::public.assignment_mode
     ) THEN
    -- FR-036 (host_assigned) / FR-041 (player_picked): keep every match already
    -- held -- the host's allocations, or the picks seeded just above -- and fill
    -- each participant's shortfall from the pool. The loop body is shared
    -- verbatim between the two modes: both want "top up to effectivePerPlayer,
    -- excluding the Common Match and anything already held".
    --
    -- FR-036: keep every match the host allocated, fill each participant's
    -- shortfall from the pool. A row equal to (participant, common_match_id)
    -- does not count toward their held additional matches (User Story 5's
    -- Common-Match-allocated-explicitly edge case is a no-op here; the
    -- ON CONFLICT DO NOTHING below is what makes it safe to have allocated).
    FOR v_i IN 1..v_p LOOP
      SELECT count(*) INTO v_held FROM public.assignments a
      WHERE a.session_id = p_session_id
        AND a.participant_id = v_participant_ids[v_i]
        AND a.match_id <> v_room.common_match_id;

      v_needed := v_effective_per_player - v_held;
      IF v_needed > 0 THEN
        INSERT INTO public.assignments (session_id, participant_id, match_id, created_at)
        SELECT p_session_id, v_participant_ids[v_i], m.id, now()
        FROM public.matches m
        WHERE m.session_id = p_session_id
          AND m.id <> v_room.common_match_id
          AND NOT EXISTS (
            SELECT 1 FROM public.assignments a2
            WHERE a2.session_id = p_session_id
              AND a2.participant_id = v_participant_ids[v_i]
              AND a2.match_id = m.id
          )
        ORDER BY random()
        LIMIT v_needed;

        v_filled_participant_ids := array_append(v_filled_participant_ids, v_participant_ids[v_i]);
      END IF;
    END LOOP;
  ELSIF v_feasible THEN
    -- Constrained generation (specs/020 research.md R3): deal K shared
    -- matches to every pair, then top up each participant to the effective
    -- per-player count with private matches.
    FOR v_i IN 1..(v_p - 1) LOOP
      FOR v_j IN (v_i + 1)..v_p LOOP
        FOR v_kk IN 1..v_shared_per_pair LOOP
          v_match_id := v_pool_ids[v_pool_cursor];
          v_pool_cursor := v_pool_cursor + 1;
          INSERT INTO public.assignments (session_id, participant_id, match_id, created_at)
          VALUES (p_session_id, v_participant_ids[v_i], v_match_id, now()),
                 (p_session_id, v_participant_ids[v_j], v_match_id, now());
        END LOOP;
      END LOOP;
    END LOOP;

    v_needed := v_effective_per_player - v_shared_per_pair * GREATEST(v_p - 1, 0);
    FOR v_i IN 1..v_p LOOP
      FOR v_kk IN 1..v_needed LOOP
        v_match_id := v_pool_ids[v_pool_cursor];
        v_pool_cursor := v_pool_cursor + 1;
        INSERT INTO public.assignments (session_id, participant_id, match_id, created_at)
        VALUES (p_session_id, v_participant_ids[v_i], v_match_id, now());
      END LOOP;
    END LOOP;
  ELSE
    -- Relaxed generation (FR-015): each participant independently draws
    -- effective_per_player matches at random from the pool minus the Common
    -- Match; overlap between participants is unconstrained.
    FOR v_i IN 1..v_p LOOP
      INSERT INTO public.assignments (session_id, participant_id, match_id, created_at)
      SELECT p_session_id, v_participant_ids[v_i], m.id, now()
      FROM public.matches m
      WHERE m.session_id = p_session_id AND m.id <> v_room.common_match_id
      ORDER BY random()
      LIMIT v_effective_per_player;
    END LOOP;
  END IF;

  -- FR-002: every active participant also holds the Common Match. ON
  -- CONFLICT DO NOTHING because host-assigned mode may have already inserted
  -- it explicitly for some participants (the no-op edge case above).
  INSERT INTO public.assignments (session_id, participant_id, match_id, created_at)
  SELECT p_session_id, unnest(v_participant_ids), v_room.common_match_id, now()
  ON CONFLICT (session_id, participant_id, match_id) DO NOTHING;

  SELECT count(*) INTO v_assignments_created FROM public.assignments WHERE session_id = p_session_id;

  SELECT id INTO v_host_participant_id FROM public.participants
  WHERE session_id = p_session_id AND account_id = v_account
    AND session_role = 'owner'::public.participant_session_role
  LIMIT 1;

  -- FR-023: settlement recorded in the room's auditable history.
  INSERT INTO public.gameplay_events (
    session_id, sequence_number, actor_participant_id, event_type, idempotency_key, payload, created_at
  ) VALUES (
    p_session_id, public.allocate_event_sequence(p_session_id), v_host_participant_id,
    'assignment_replaced', concat('canonical-start-assignments:', p_idempotency_key::text),
    jsonb_build_object(
      'assignments',
      (SELECT jsonb_agg(jsonb_build_object('participantId', a.participant_id::text, 'matchId', a.match_id::text))
       FROM public.assignments a WHERE a.session_id = p_session_id)
    ),
    now()
  );

  UPDATE public.game_sessions SET state = 'in_progress'::public.session_state, started_at = now()
  WHERE id = p_session_id;

  -- FR-016: the relaxation flag is carried in the start event's payload.
  INSERT INTO public.gameplay_events (
    session_id, sequence_number, actor_participant_id, event_type, idempotency_key, payload, created_at
  ) VALUES (
    p_session_id, public.allocate_event_sequence(p_session_id), v_host_participant_id,
    'session_started', concat('start-game:', p_idempotency_key::text),
    jsonb_build_object(
      'startedAt', now(),
      'relaxedConstraints', (NOT v_feasible AND p_relax_constraints),
      'filledInParticipantIds', COALESCE(
        (SELECT jsonb_agg(x::text) FROM unnest(v_filled_participant_ids) AS x),
        '[]'::jsonb
      )
    ),
    now()
  );

  -- research.md R5: which participants the server filled in, for the
  -- room's auditable history (FR-023) and for pgTAP, which calls this RPC
  -- directly. NOT surfaced to the client via the start-game HTTP response --
  -- the Java command-api's CommandResponse deliberately does not forward RPC
  -- internals (same boundary relaxedConstraints already lives behind). The
  -- host-facing echo of FR-037 is satisfied pre-start, in the lobby, from the
  -- same per-participant shortfall data the "still short" indicator already
  -- computes.
  RETURN jsonb_build_object(
    'status', 'started',
    'sessionId', p_session_id::text,
    'relaxedConstraints', (NOT v_feasible AND p_relax_constraints),
    'assignmentsCreated', v_assignments_created,
    'filledInParticipantIds', COALESCE(
      (SELECT jsonb_agg(x::text) FROM unnest(v_filled_participant_ids) AS x),
      '[]'::jsonb
    )
  );
END;
$$;
-- Signature unchanged from 036 -- existing REVOKE/GRANT carry over.
