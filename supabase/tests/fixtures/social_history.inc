-- Dedicated fixtures; every mutation rolls back, including permission changes.
CREATE TEMP TABLE social_fixture AS SELECT
 '00000000-0000-4000-8000-000000000001'::uuid AS a,
 '00000000-0000-4000-8000-000000000002'::uuid AS b,
 '00000000-0000-4000-8000-000000000003'::uuid AS c;
GRANT SELECT ON social_fixture TO authenticated;
INSERT INTO public.friendships(requester_account_id,addressee_account_id,status)
SELECT a,b,'accepted' FROM social_fixture;
INSERT INTO public.game_sessions(id,owner_account_id,join_code,state,started_at,completed_at)
SELECT ('28000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,CASE WHEN n=4 THEN b ELSE a END,
 CASE WHEN n=5 THEN 'IMP-social-zero' ELSE lpad(n::text,6,'0') END,
 CASE WHEN n=6 THEN 'in_progress'::public.session_state ELSE 'completed'::public.session_state END,
 '2026-10-01T12:00Z'::timestamptz,
 CASE WHEN n=6 THEN NULL ELSE '2026-10-01T13:00Z'::timestamptz + n*interval '1 day' END
FROM social_fixture CROSS JOIN generate_series(1,6) n;
INSERT INTO public.participants(session_id,account_id,display_name,membership_type,current_drink_total)
SELECT ('28000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,account,'Recorded name','registered',drinks
FROM social_fixture CROSS JOIN LATERAL (VALUES (1,a,4),(1,b,2),(2,a,2),(2,b,4),(3,a,6),(4,b,3),(5,a,90),(5,b,90),(6,a,90),(6,b,90)) x(n,account,drinks)
ON CONFLICT(session_id,account_id) WHERE account_id IS NOT NULL DO UPDATE SET current_drink_total=excluded.current_drink_total,display_name=excluded.display_name;
UPDATE public.participants SET left_at='2026-10-01T12:30Z' WHERE session_id='28000000-0000-4000-8000-000000000002' AND account_id=(SELECT a FROM social_fixture);
