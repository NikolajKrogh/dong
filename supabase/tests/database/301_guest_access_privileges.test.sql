BEGIN;
\ir guest_abuse_setup.inc
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(9);

SELECT ok(NOT has_function_privilege('anon', 'private.join_room_as_guest(text,text,text)', 'EXECUTE'),
  'anonymous callers cannot directly execute private join');
SELECT ok(NOT has_function_privilege('authenticated', 'private.join_room_as_guest(text,text,text)', 'EXECUTE'),
  'signed-in callers cannot directly execute private join');
SELECT ok(NOT has_function_privilege('anon', 'private.leave_room_as_guest(text)', 'EXECUTE'),
  'anonymous callers cannot directly execute private leave');
SELECT ok(NOT has_function_privilege('anon', 'private.set_my_room_picks_as_guest(text,uuid[])', 'EXECUTE'),
  'anonymous callers cannot directly execute private picks');
SELECT ok(NOT has_function_privilege('anon', 'private.resolve_guest_participant(text)', 'EXECUTE'),
  'anonymous callers cannot directly execute the shared resolver');
SELECT ok(NOT has_column_privilege('anon', 'public.participants', 'guest_rejoin_token_hash', 'SELECT'),
  'anonymous callers cannot select guest token hashes');
SELECT ok(NOT has_function_privilege('anon', 'public.join_room_as_guest(text,text,text)', 'EXECUTE'),
  'the public guest join wrapper is server-only');
SELECT ok(NOT has_function_privilege('anon', 'public.get_guest_room_snapshot(text)', 'EXECUTE'),
  'the public guest snapshot wrapper is server-only');
SELECT ok(has_function_privilege('authenticated', 'public.get_room_snapshot(uuid)', 'EXECUTE'),
  'the registered snapshot wrapper is server-only');

SELECT * FROM finish();
ROLLBACK;
