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
