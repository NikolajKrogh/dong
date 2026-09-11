-- 042_server_authoritative_gameplay.sql: canonical active-game commands,
-- guest participation, provider provenance, replay safety, and completion locks.
BEGIN;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(62);

CREATE TEMP TABLE results (name text PRIMARY KEY, passed boolean NOT NULL, detail text);
GRANT SELECT, INSERT ON TABLE results TO authenticated, anon, service_role;

INSERT INTO auth.users (
  id, aud, role, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
) VALUES
  ('00000000-0000-4800-8000-000000000101', 'authenticated', 'authenticated', 'gameplay-host@test.local', now(), now(), now(), '{"provider":"email"}'::jsonb, '{}'::jsonb, false, false),
  ('00000000-0000-4800-8000-000000000102', 'authenticated', 'authenticated', 'gameplay-member@test.local', now(), now(), now(), '{"provider":"email"}'::jsonb, '{}'::jsonb, false, false),
  ('00000000-0000-4800-8000-000000000103', 'authenticated', 'authenticated', 'gameplay-outsider@test.local', now(), now(), now(), '{"provider":"email"}'::jsonb, '{}'::jsonb, false, false);

INSERT INTO public.accounts (id, preferred_display_name) VALUES
  ('00000000-0000-4800-8000-000000000101', 'Gameplay Host'),
  ('00000000-0000-4800-8000-000000000102', 'Gameplay Member'),
  ('00000000-0000-4800-8000-000000000103', 'Gameplay Outsider');

INSERT INTO public.game_sessions (id, owner_account_id, join_code, state)
VALUES (
  '00000000-0000-4800-8000-000000000201',
  '00000000-0000-4800-8000-000000000101',
  'GAMEPLAY1',
  'in_progress'::public.session_state
);

UPDATE public.participants
SET id = '00000000-0000-4800-8000-000000000301', display_name = 'Gameplay Host'
WHERE session_id = '00000000-0000-4800-8000-000000000201'
  AND account_id = '00000000-0000-4800-8000-000000000101';

INSERT INTO public.participants (
  id, session_id, account_id, display_name, membership_type, session_role,
  current_drink_total, guest_rejoin_token_hash
) VALUES
  ('00000000-0000-4800-8000-000000000302', '00000000-0000-4800-8000-000000000201', '00000000-0000-4800-8000-000000000102', 'Gameplay Member', 'registered'::public.participant_membership_type, 'member'::public.participant_session_role, 0, NULL),
  ('00000000-0000-4800-8000-000000000303', '00000000-0000-4800-8000-000000000201', NULL, 'Gameplay Guest', 'guest'::public.participant_membership_type, 'member'::public.participant_session_role, 0, encode(extensions.digest('gameplay-guest-token', 'sha256'), 'hex'));

INSERT INTO public.matches (
  id, session_id, source_provider, source_match_id, home_team_name, away_team_name,
  home_score, away_score, source_league_code, kickoff_at
) VALUES
  ('00000000-0000-4800-8000-000000000401', '00000000-0000-4800-8000-000000000201', 'manual', 'manual-1', 'Manual Home', 'Manual Away', 0, 0, NULL, NULL),
  ('00000000-0000-4800-8000-000000000402', '00000000-0000-4800-8000-000000000201', 'espn', 'espn-1', 'Provider Home', 'Provider Away', 0, 0, 'eng.1', '2026-09-03T18:00:00Z'),
  ('00000000-0000-4800-8000-000000000403', '00000000-0000-4800-8000-000000000201', 'espn', 'espn-legacy', 'Legacy Home', 'Legacy Away', 0, 0, NULL, '2026-09-03T20:00:00Z');

INSERT INTO public.assignments (session_id, participant_id, match_id)
VALUES
  ('00000000-0000-4800-8000-000000000201', '00000000-0000-4800-8000-000000000301', '00000000-0000-4800-8000-000000000401'),
  ('00000000-0000-4800-8000-000000000201', '00000000-0000-4800-8000-000000000302', '00000000-0000-4800-8000-000000000401'),
  ('00000000-0000-4800-8000-000000000201', '00000000-0000-4800-8000-000000000303', '00000000-0000-4800-8000-000000000401');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4800-8000-000000000102', true);

SELECT is(
  public.change_manual_score(
    '00000000-0000-4800-8000-000000000201',
    '00000000-0000-4800-8000-000000000401', 'home', 1,
    '00000000-0000-4800-8000-000000000501'
  ) -> 'homeScore',
  '1'::jsonb,
  'an active registered participant can score a manual match'
);
SELECT is(
  (SELECT home_score FROM public.matches WHERE id = '00000000-0000-4800-8000-000000000401'),
  1,
  'manual score is persisted canonically'
);
SELECT is(
  (SELECT count(*)::integer FROM public.gameplay_events WHERE session_id = '00000000-0000-4800-8000-000000000201' AND event_type = 'manual_score_changed'),
  1,
  'manual score appends one immutable event'
);
SELECT is(
  public.change_manual_score(
    '00000000-0000-4800-8000-000000000201',
    '00000000-0000-4800-8000-000000000401', 'home', 1,
    '00000000-0000-4800-8000-000000000501'
  ) -> 'replayed',
  'true'::jsonb,
  'retry returns the original result'
);
SELECT is(
  (SELECT home_score FROM public.matches WHERE id = '00000000-0000-4800-8000-000000000401'),
  1,
  'retry does not apply a second score'
);

DO $$ BEGIN
  BEGIN
    PERFORM public.change_manual_score(
      '00000000-0000-4800-8000-000000000201',
      '00000000-0000-4800-8000-000000000401', 'away', 1,
      '00000000-0000-4800-8000-000000000501'
    );
    INSERT INTO results VALUES ('score_conflict', false, 'no error');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO results VALUES ('score_conflict', SQLERRM = 'idempotency_conflict', SQLERRM);
  END;
END $$;
SELECT ok((SELECT passed FROM results WHERE name = 'score_conflict'), 'same key with different intent is rejected');

SELECT set_config('request.jwt.claim.sub', NULL, true);
SELECT is(
  public.change_manual_score_as_guest(
    'gameplay-guest-token',
    '00000000-0000-4800-8000-000000000401', 'away', 1,
    '00000000-0000-4800-8000-000000000502'
  ) -> 'awayScore',
  '1'::jsonb,
  'a guest can score a manual match'
);
SELECT is(
  public.change_participant_drink_as_guest(
    'gameplay-guest-token',
    '00000000-0000-4800-8000-000000000302', 1,
    '00000000-0000-4800-8000-000000000503'
  ) -> 'currentDrinkTotal',
  '0.5'::jsonb,
  'a guest can adjust another active participant drink total'
);

DO $$ BEGIN
  BEGIN
    PERFORM public.change_participant_drink_as_guest(
      'gameplay-guest-token',
      '00000000-0000-4800-8000-000000000302', -1,
      '00000000-0000-4800-8000-000000000504'
    );
    PERFORM public.change_participant_drink_as_guest(
      'gameplay-guest-token',
      '00000000-0000-4800-8000-000000000302', -1,
      '00000000-0000-4800-8000-00000000050a'
    );
    INSERT INTO results VALUES ('negative_drink', false, 'no error');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO results VALUES ('negative_drink', SQLERRM = 'negative_result', SQLERRM);
  END;
END $$;
SELECT ok((SELECT passed FROM results WHERE name = 'negative_drink'), 'drink totals never become negative');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4800-8000-000000000102', true);
DO $$ BEGIN
  BEGIN
    PERFORM public.change_manual_score(
      '00000000-0000-4800-8000-000000000201',
      '00000000-0000-4800-8000-000000000402', 'home', 1,
      '00000000-0000-4800-8000-000000000505'
    );
    INSERT INTO results VALUES ('provider_manual', false, 'no error');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO results VALUES ('provider_manual', SQLERRM = 'provider_score_required', SQLERRM);
  END;
END $$;
SELECT ok((SELECT passed FROM results WHERE name = 'provider_manual'), 'provider matches reject participant score edits');

SET LOCAL ROLE postgres;
SELECT ok(
  to_regprocedure('public.accept_provider_score(uuid,uuid,text,text,integer,integer,timestamptz,uuid)') IS NULL,
  'no client-facing provider score mutation exists'
);
SELECT ok(
  NOT has_function_privilege('anon', 'public.claim_provider_score_refresh(uuid,uuid,uuid)', 'EXECUTE'),
  'anon cannot claim provider refresh work'
);
SELECT ok(
  NOT has_function_privilege('authenticated', 'public.claim_provider_score_refresh(uuid,uuid,uuid)', 'EXECUTE'),
  'authenticated clients cannot claim provider refresh work directly'
);
SELECT ok(
  NOT has_function_privilege('authenticated', 'public.accept_provider_score_batch_from_edge(uuid,uuid,uuid,jsonb)', 'EXECUTE'),
  'authenticated clients cannot commit provider observations directly'
);
SELECT ok(
  NOT has_function_privilege('authenticated', 'private.claim_provider_score_refresh(uuid,uuid,uuid)', 'EXECUTE'),
  'authenticated clients cannot execute the private lease implementation'
);
SELECT ok(
  NOT has_function_privilege('anon', 'private.accept_provider_score_batch_from_edge(uuid,uuid,uuid,jsonb)', 'EXECUTE'),
  'anon cannot execute the private provider mutation implementation'
);
SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc procedure
    JOIN pg_catalog.pg_namespace namespace ON namespace.oid = procedure.pronamespace
    CROSS JOIN LATERAL pg_catalog.aclexplode(
      COALESCE(
        procedure.proacl,
        pg_catalog.acldefault('f', procedure.proowner)
      )
    ) privilege
    WHERE namespace.nspname = 'public'
      AND procedure.proname = 'claim_provider_score_refresh'
      AND privilege.grantee = 0
      AND privilege.privilege_type = 'EXECUTE'
  ),
  'PUBLIC has no provider refresh privilege'
);
SELECT ok(
  has_function_privilege('service_role', 'public.claim_provider_score_refresh(uuid,uuid,uuid)', 'EXECUTE'),
  'service role can claim provider refresh work'
);

SET LOCAL ROLE service_role;
DO $$ BEGIN
  BEGIN
    PERFORM public.claim_provider_score_refresh(
      '00000000-0000-4800-8000-000000000999',
      '00000000-0000-4800-8000-000000000102',
      '00000000-0000-4000-8000-000000000599'
    );
    INSERT INTO results VALUES ('missing_provider_room', false, 'no error');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO results VALUES ('missing_provider_room', SQLERRM = 'room_not_found', SQLERRM);
  END;
END $$;
SELECT ok((SELECT passed FROM results WHERE name = 'missing_provider_room'), 'provider claims reject nonexistent rooms');

DO $$ BEGIN
  BEGIN
    PERFORM public.claim_provider_score_refresh(
      '00000000-0000-4800-8000-000000000201',
      NULL,
      '00000000-0000-4000-8000-000000000598'
    );
    INSERT INTO results VALUES ('guest_provider_claim', false, 'no error');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO results VALUES ('guest_provider_claim', SQLERRM = 'invalid_provider_refresh', SQLERRM);
  END;
END $$;
SELECT ok((SELECT passed FROM results WHERE name = 'guest_provider_claim'), 'guests cannot claim provider work without a registered account');

SELECT is(
  public.claim_provider_score_refresh(
    '00000000-0000-4800-8000-000000000201',
    '00000000-0000-4800-8000-000000000102',
    '00000000-0000-4000-8000-000000000506'
  ) -> 'status',
  '"claimed"'::jsonb,
  'an active registered actor can claim the room refresh lease'
);
SELECT is(
  public.claim_provider_score_refresh(
    '00000000-0000-4800-8000-000000000201',
    '00000000-0000-4800-8000-000000000102',
    '00000000-0000-4000-8000-000000000507'
  ) #> '{matches,0,sourceMatchId}',
  NULL,
  'a concurrent claimant receives no provider metadata while the lease is active'
);
SELECT is(
  (SELECT request_id FROM private.provider_score_refresh_leases WHERE session_id = '00000000-0000-4800-8000-000000000201'),
  '00000000-0000-4000-8000-000000000506'::uuid,
  'a not-due claim does not replace the winning request'
);
SELECT is(
  public.claim_provider_score_refresh(
    '00000000-0000-4800-8000-000000000201',
    '00000000-0000-4800-8000-000000000102',
    '00000000-0000-4000-8000-000000000507'
  ) -> 'status',
  '"not_due"'::jsonb,
  'concurrent claims produce one winner during the lease window'
);

DO $$ BEGIN
  BEGIN
    PERFORM public.accept_provider_score_batch_from_edge(
      '00000000-0000-4800-8000-000000000201',
      '00000000-0000-4800-8000-000000000102',
      '00000000-0000-4000-8000-000000000506',
      '[{"matchId":"00000000-0000-4800-8000-000000000401","sourceMatchId":"manual-1","sourceLeagueCode":"eng.1","homeScore":1,"awayScore":0}]'::jsonb
    );
    INSERT INTO results VALUES ('manual_provider_batch', false, 'no error');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO results VALUES ('manual_provider_batch', SQLERRM = 'provider_match_mismatch', SQLERRM);
  END;
END $$;
SELECT ok((SELECT passed FROM results WHERE name = 'manual_provider_batch'), 'provider batches reject manual matches');

DO $$ BEGIN
  BEGIN
    PERFORM public.accept_provider_score_batch_from_edge(
      '00000000-0000-4800-8000-000000000201',
      '00000000-0000-4800-8000-000000000102',
      '00000000-0000-4000-8000-000000000506',
      '[{"matchId":"00000000-0000-4800-8000-000000000402","sourceMatchId":"espn-1","sourceLeagueCode":"eng.1","homeScore":2,"awayScore":1},{"matchId":"00000000-0000-4800-8000-000000000402","sourceMatchId":"espn-1","sourceLeagueCode":"eng.1","homeScore":2,"awayScore":1}]'::jsonb
    );
    INSERT INTO results VALUES ('duplicate_provider_batch', false, 'no error');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO results VALUES ('duplicate_provider_batch', SQLERRM = 'duplicate_provider_observation', SQLERRM);
  END;
END $$;
SELECT ok((SELECT passed FROM results WHERE name = 'duplicate_provider_batch'), 'provider batches reject duplicate match IDs');

DO $$ BEGIN
  BEGIN
    PERFORM public.accept_provider_score_batch_from_edge(
      '00000000-0000-4800-8000-000000000201',
      '00000000-0000-4800-8000-000000000102',
      '00000000-0000-4000-8000-000000000506',
      '[{"matchId":"00000000-0000-4800-8000-000000000402","sourceMatchId":"espn-1","sourceLeagueCode":"eng.1","homeScore":-1,"awayScore":0}]'::jsonb
    );
    INSERT INTO results VALUES ('negative_provider_score', false, 'no error');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO results VALUES ('negative_provider_score', SQLERRM = 'invalid_provider_score', SQLERRM);
  END;
END $$;
SELECT ok((SELECT passed FROM results WHERE name = 'negative_provider_score'), 'provider batches reject negative scores');

DO $$ BEGIN
  BEGIN
    PERFORM public.accept_provider_score_batch_from_edge(
      '00000000-0000-4800-8000-000000000201',
      '00000000-0000-4800-8000-000000000102',
      '00000000-0000-4000-8000-000000000506',
      '[{"matchId":"00000000-0000-4800-8000-000000000402","sourceMatchId":"espn-1","sourceLeagueCode":"eng.1","homeScore":1.5,"awayScore":0}]'::jsonb
    );
    INSERT INTO results VALUES ('fractional_provider_score', false, 'no error');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO results VALUES ('fractional_provider_score', SQLERRM = 'invalid_provider_score', SQLERRM);
  END;
END $$;
SELECT ok((SELECT passed FROM results WHERE name = 'fractional_provider_score'), 'provider batches reject non-integer scores');

DO $$ BEGIN
  BEGIN
    PERFORM public.accept_provider_score_batch_from_edge(
      '00000000-0000-4800-8000-000000000201',
      '00000000-0000-4800-8000-000000000102',
      '00000000-0000-4000-8000-000000000506',
      '[{"matchId":"00000000-0000-4800-8000-000000000402","sourceMatchId":"wrong-source","sourceLeagueCode":"eng.1","homeScore":1,"awayScore":0}]'::jsonb
    );
    INSERT INTO results VALUES ('provider_source_mismatch', false, 'no error');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO results VALUES ('provider_source_mismatch', SQLERRM = 'provider_match_mismatch', SQLERRM);
  END;
END $$;
SELECT ok((SELECT passed FROM results WHERE name = 'provider_source_mismatch'), 'provider batches reject source identity mismatches');

DO $$ BEGIN
  BEGIN
    PERFORM public.accept_provider_score_batch_from_edge(
      '00000000-0000-4800-8000-000000000201',
      '00000000-0000-4800-8000-000000000102',
      '00000000-0000-4000-8000-000000000506',
      '[{"matchId":"00000000-0000-4800-8000-000000000402","sourceMatchId":"espn-1","homeScore":1,"awayScore":0}]'::jsonb
    );
    INSERT INTO results VALUES ('missing_provider_league', false, 'no error');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO results VALUES ('missing_provider_league', SQLERRM = 'invalid_provider_score', SQLERRM);
  END;
END $$;
SELECT ok((SELECT passed FROM results WHERE name = 'missing_provider_league'), 'provider batches reject missing league metadata');

UPDATE public.participants SET left_at = now()
WHERE id = '00000000-0000-4800-8000-000000000302';
DO $$ BEGIN
  BEGIN
    PERFORM public.accept_provider_score_batch_from_edge(
      '00000000-0000-4800-8000-000000000201',
      '00000000-0000-4800-8000-000000000102',
      '00000000-0000-4000-8000-000000000506',
      '[]'::jsonb
    );
    INSERT INTO results VALUES ('inactive_provider_actor', false, 'no error');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO results VALUES ('inactive_provider_actor', SQLERRM = 'not_room_participant', SQLERRM);
  END;
END $$;
SELECT ok((SELECT passed FROM results WHERE name = 'inactive_provider_actor'), 'inactive registered actors cannot commit provider observations');
UPDATE public.participants SET left_at = NULL
WHERE id = '00000000-0000-4800-8000-000000000302';

DO $$ BEGIN
  BEGIN
    PERFORM public.accept_provider_score_batch_from_edge(
      '00000000-0000-4800-8000-000000000201',
      '00000000-0000-4800-8000-000000000102',
      '00000000-0000-4000-8000-000000000506',
      '[{"matchId":"00000000-0000-4800-8000-000000000402","sourceMatchId":"espn-1","sourceLeagueCode":"eng.1","homeScore":3,"awayScore":2},{"matchId":"00000000-0000-4800-8000-000000000499","sourceMatchId":"unknown","sourceLeagueCode":"eng.1","homeScore":1,"awayScore":0}]'::jsonb
    );
    INSERT INTO results VALUES ('atomic_provider_batch', false, 'no error');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO results VALUES ('atomic_provider_batch', SQLERRM = 'match_not_in_room', SQLERRM);
  END;
END $$;
SELECT ok((SELECT passed FROM results WHERE name = 'atomic_provider_batch'), 'an invalid observation rejects the whole provider batch');
SELECT is(
  (SELECT home_score + away_score FROM public.matches WHERE id = '00000000-0000-4800-8000-000000000402'),
  0,
  'provider batch rejection is atomic'
);

SELECT is(
  public.accept_provider_score_batch_from_edge(
    '00000000-0000-4800-8000-000000000201',
    '00000000-0000-4800-8000-000000000102',
    '00000000-0000-4000-8000-000000000506',
    '[{"matchId":"00000000-0000-4800-8000-000000000402","sourceMatchId":"espn-1","sourceLeagueCode":"eng.1","homeScore":2,"awayScore":1}]'::jsonb
  ) #> '{results,0,origin}',
  '"provider"'::jsonb,
  'trusted Edge observations carry provider provenance'
);
SELECT is(
  (SELECT home_score + away_score FROM public.matches WHERE id = '00000000-0000-4800-8000-000000000402'),
  3,
  'provider score is canonicalized on the room match'
);
SELECT is(
  (SELECT count(*)::integer FROM public.gameplay_events WHERE session_id = '00000000-0000-4800-8000-000000000201' AND event_type = 'provider_score_changed'),
  1,
  'provider update is audited without a manual goal event'
);
SELECT is(
  public.accept_provider_score_batch_from_edge(
    '00000000-0000-4800-8000-000000000201',
    '00000000-0000-4800-8000-000000000102',
    '00000000-0000-4000-8000-000000000506',
    '[{"matchId":"00000000-0000-4800-8000-000000000402","sourceMatchId":"espn-1","sourceLeagueCode":"eng.1","homeScore":2,"awayScore":1}]'::jsonb
  ) #> '{results,0,replayed}',
  'true'::jsonb,
  'same request and derived match key replay exactly once'
);

DO $$ BEGIN
  BEGIN
    PERFORM public.accept_provider_score_batch_from_edge(
      '00000000-0000-4800-8000-000000000201',
      '00000000-0000-4800-8000-000000000102',
      '00000000-0000-4000-8000-000000000506',
      '[{"matchId":"00000000-0000-4800-8000-000000000402","sourceMatchId":"espn-1","sourceLeagueCode":"eng.1","homeScore":9,"awayScore":9}]'::jsonb
    );
    INSERT INTO results VALUES ('provider_payload_conflict', false, 'no error');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO results VALUES ('provider_payload_conflict', SQLERRM = 'idempotency_conflict', SQLERRM);
  END;
END $$;
SELECT ok((SELECT passed FROM results WHERE name = 'provider_payload_conflict'), 'altering an accepted request payload conflicts');

DO $$ BEGIN
  BEGIN
    PERFORM public.claim_provider_score_refresh(
      '00000000-0000-4800-8000-000000000201',
      '00000000-0000-4800-8000-000000000103',
      '00000000-0000-4000-8000-000000000508'
    );
    INSERT INTO results VALUES ('outsider_provider_claim', false, 'no error');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO results VALUES ('outsider_provider_claim', SQLERRM = 'not_room_participant', SQLERRM);
  END;
END $$;
SELECT ok((SELECT passed FROM results WHERE name = 'outsider_provider_claim'), 'cross-room actors cannot claim provider work');

UPDATE private.provider_score_refresh_leases SET not_before = now() - interval '1 second'
WHERE session_id = '00000000-0000-4800-8000-000000000201';
SELECT is(
  public.claim_provider_score_refresh(
    '00000000-0000-4800-8000-000000000201',
    '00000000-0000-4800-8000-000000000102',
    '00000000-0000-4000-8000-000000000509'
  ) -> 'status',
  '"claimed"'::jsonb,
  'a crashed refresh becomes claimable after lease expiry'
);
DO $$ BEGIN
  BEGIN
    PERFORM public.accept_provider_score_batch_from_edge(
      '00000000-0000-4800-8000-000000000201',
      '00000000-0000-4800-8000-000000000102',
      '00000000-0000-4000-8000-000000000506',
      '[]'::jsonb
    );
    INSERT INTO results VALUES ('stale_provider_commit', false, 'no error');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO results VALUES ('stale_provider_commit', SQLERRM = 'stale_provider_refresh', SQLERRM);
  END;
END $$;
SELECT ok((SELECT passed FROM results WHERE name = 'stale_provider_commit'), 'a previous claimant cannot commit after a newer claim');
SELECT is(
  public.accept_provider_score_batch_from_edge(
    '00000000-0000-4800-8000-000000000201',
    '00000000-0000-4800-8000-000000000102',
    '00000000-0000-4000-8000-000000000509',
    '[{"matchId":"00000000-0000-4800-8000-000000000402","sourceMatchId":"espn-1","sourceLeagueCode":"eng.1","homeScore":2,"awayScore":2}]'::jsonb
  ) #> '{results,0,homeScore}',
  '2'::jsonb,
  'a new request key accepts a provider correction'
);

UPDATE private.provider_score_refresh_leases SET not_before = now() - interval '1 second'
WHERE session_id = '00000000-0000-4800-8000-000000000201';
SELECT is(
  public.claim_provider_score_refresh(
    '00000000-0000-4800-8000-000000000201',
    '00000000-0000-4800-8000-000000000102',
    '00000000-0000-4000-8000-00000000050a'
  ) -> 'status',
  '"claimed"'::jsonb,
  'another expired lease can be reclaimed'
);
SELECT is(
  public.accept_provider_score_batch_from_edge(
    '00000000-0000-4800-8000-000000000201',
    '00000000-0000-4800-8000-000000000102',
    '00000000-0000-4000-8000-00000000050a',
    '[{"matchId":"00000000-0000-4800-8000-000000000402","sourceMatchId":"espn-1","sourceLeagueCode":"eng.1","homeScore":2,"awayScore":1}]'::jsonb
  ) #> '{results,0,awayScore}',
  '1'::jsonb,
  'new request keys permit a score to return to an earlier value'
);

UPDATE private.provider_score_refresh_leases SET not_before = now() - interval '1 second'
WHERE session_id = '00000000-0000-4800-8000-000000000201';
SELECT is(
  public.claim_provider_score_refresh(
    '00000000-0000-4800-8000-000000000201',
    '00000000-0000-4800-8000-000000000102',
    '00000000-0000-4000-8000-00000000050b'
  ) -> 'status',
  '"claimed"'::jsonb,
  'legacy provider rows remain eligible for bounded resolution'
);
SELECT is(
  public.accept_provider_score_batch_from_edge(
    '00000000-0000-4800-8000-000000000201',
    '00000000-0000-4800-8000-000000000102',
    '00000000-0000-4000-8000-00000000050b',
    '[{"matchId":"00000000-0000-4800-8000-000000000403","sourceMatchId":"espn-legacy","sourceLeagueCode":"den.1","homeScore":1,"awayScore":0}]'::jsonb
  ) #> '{results,0,changed}',
  'true'::jsonb,
  'a uniquely resolved legacy observation is accepted'
);
SELECT is(
  (SELECT source_league_code FROM public.matches WHERE id = '00000000-0000-4800-8000-000000000403'),
  'den.1',
  'a validated legacy observation backfills its league'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4800-8000-000000000102', true);

SELECT is(
  public.get_room_snapshot('00000000-0000-4800-8000-000000000201') -> 'ownerParticipantId',
  '"00000000-0000-4800-8000-000000000301"'::jsonb,
  'registered snapshots expose the current owner participant'
);
SELECT ok(
  (public.get_room_snapshot('00000000-0000-4800-8000-000000000201') ->> 'lastEventSequence')::bigint >= 4,
  'snapshots expose a monotonic event fence'
);
SELECT is(
  (public.get_room_snapshot('00000000-0000-4800-8000-000000000201') #>> '{matches,1,sourceProvider}'),
  'espn',
  'snapshots retain provider source identity'
);
SELECT is(
  (SELECT item->>'sourceLeagueCode'
   FROM jsonb_array_elements(public.get_room_snapshot('00000000-0000-4800-8000-000000000201')->'matches') item
   WHERE item->>'id' = '00000000-0000-4800-8000-000000000402'),
  'eng.1',
  'snapshots retain provider league identity'
);

SELECT set_config('request.jwt.claim.sub', '00000000-0000-4800-8000-000000000103', true);
DO $$ BEGIN
  BEGIN
    PERFORM public.change_participant_drink(
      '00000000-0000-4800-8000-000000000201',
      '00000000-0000-4800-8000-000000000302', 1,
      '00000000-0000-4800-8000-000000000507'
    );
    INSERT INTO results VALUES ('outsider_write', false, 'no error');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO results VALUES ('outsider_write', SQLERRM = 'not_room_participant', SQLERRM);
  END;
END $$;
SELECT ok((SELECT passed FROM results WHERE name = 'outsider_write'), 'outsiders cannot submit gameplay commands');
DO $$ BEGIN
  BEGIN
    PERFORM public.get_room_snapshot('00000000-0000-4800-8000-000000000201');
    INSERT INTO results VALUES ('outsider_read', false, 'no error');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO results VALUES ('outsider_read', SQLERRM = 'forbidden', SQLERRM);
  END;
END $$;
SELECT ok((SELECT passed FROM results WHERE name = 'outsider_read'), 'outsiders cannot read active snapshots');

SET LOCAL ROLE anon;
SELECT is(
  public.get_guest_room_snapshot('gameplay-guest-token') -> 'state',
  '"in_progress"'::jsonb,
  'guest snapshots are available with the room token'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4800-8000-000000000101', true);
SELECT is(
  public.end_game_session('00000000-0000-4800-8000-000000000201') -> 'status',
  '"completed"'::jsonb,
  'the host can complete the canonical room'
);
SET LOCAL ROLE service_role;
DO $$ BEGIN
  BEGIN
    PERFORM public.claim_provider_score_refresh(
      '00000000-0000-4800-8000-000000000201',
      '00000000-0000-4800-8000-000000000101',
      '00000000-0000-4000-8000-00000000050c'
    );
    INSERT INTO results VALUES ('completed_provider_claim', false, 'no error');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO results VALUES ('completed_provider_claim', SQLERRM = 'invalid_room_state', SQLERRM);
  END;
END $$;
SELECT ok((SELECT passed FROM results WHERE name = 'completed_provider_claim'), 'completed rooms reject provider refresh claims');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4800-8000-000000000101', true);
DO $$ BEGIN
  BEGIN
    PERFORM public.change_manual_score(
      '00000000-0000-4800-8000-000000000201',
      '00000000-0000-4800-8000-000000000401', 'home', 1,
      '00000000-0000-4800-8000-000000000508'
    );
    INSERT INTO results VALUES ('post_complete_score', false, 'no error');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO results VALUES ('post_complete_score', SQLERRM = 'invalid_room_state', SQLERRM);
  END;
END $$;
SELECT ok((SELECT passed FROM results WHERE name = 'post_complete_score'), 'completed rooms reject new score commands');
DO $$ BEGIN
  BEGIN
    PERFORM public.change_participant_drink(
      '00000000-0000-4800-8000-000000000201',
      '00000000-0000-4800-8000-000000000302', 1,
      '00000000-0000-4800-8000-000000000509'
    );
    INSERT INTO results VALUES ('post_complete_drink', false, 'no error');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO results VALUES ('post_complete_drink', SQLERRM = 'invalid_room_state', SQLERRM);
  END;
END $$;
SELECT ok((SELECT passed FROM results WHERE name = 'post_complete_drink'), 'completed rooms reject new drink commands');
SELECT is(
  public.end_game_session('00000000-0000-4800-8000-000000000201') -> 'status',
  '"completed"'::jsonb,
  'completion is safe to repeat'
);
SELECT is(
  (SELECT count(*)::integer FROM public.gameplay_events WHERE session_id = '00000000-0000-4800-8000-000000000201' AND event_type = 'session_completed'),
  1,
  'completion creates one lifecycle event'
);
SELECT ok(
  (SELECT bool_and(actor_participant_id IS NOT NULL) FROM public.gameplay_events WHERE session_id = '00000000-0000-4800-8000-000000000201'),
  'every retained gameplay event has an actor'
);
SET LOCAL ROLE postgres;
SELECT ok(
  (SELECT count(*) FROM public.gameplay_command_results WHERE session_id = '00000000-0000-4800-8000-000000000201') >= 4,
  'accepted commands retain replay results'
);

SELECT * FROM finish();
ROLLBACK;
