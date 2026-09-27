BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(6);
SELECT is((SELECT count(*)::integer FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname IN ('join_room_as_guest','get_guest_room_snapshot',
    'leave_room_as_guest','rotate_guest_room_grant','set_my_room_picks_as_guest',
    'change_manual_score_as_guest','change_participant_drink_as_guest')
  AND (has_function_privilege('anon',p.oid,'EXECUTE') OR has_function_privilege('authenticated',p.oid,'EXECUTE'))),
  0, 'API roles cannot invoke any guest RPC overload');
SELECT ok(has_function_privilege('service_role','public.join_room_as_guest(text,text,text)','EXECUTE'),
  'trusted server may invoke join');
SELECT set_config('request.jwt.claims','{"role":"anon"}',true);
SELECT set_config('request.headers','{"x-dong-guest-caller":"203.0.113.10","x-forwarded-for":"198.51.100.1"}',true);
SELECT is(private.guest_caller_identity(),NULL::text,'forged trusted header from anonymous role is ignored');
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
SELECT is(private.guest_caller_identity(),'203.0.113.10','server caller header wins over forged XFF');
SELECT set_config('request.headers','{"x-forwarded-for":"198.51.100.1"}',true);
SELECT is(private.guest_caller_identity(),NULL::text,'no forwarding-header fallback');
SELECT set_config('request.headers','{"x-dong-guest-caller":"203.0.113.10,198.51.100.1"}',true);
SELECT is(private.guest_caller_identity(),NULL::text,'address lists fail closed');
SELECT * FROM finish();
ROLLBACK;
