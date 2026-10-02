BEGIN;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(22);

SELECT is(private.normalize_username(chr(160) || 'Cafe' || chr(769) || chr(12288)),
  'Café', 'explicit surrounding Unicode spaces trim and NFC composes');
SELECT ok(private.username_is_valid('abc'), 'three letters are valid');
SELECT ok(NOT private.username_is_valid('ab'), 'two characters are invalid');
SELECT ok(private.username_is_valid(repeat('a', 30)), '30 code points are valid');
SELECT ok(NOT private.username_is_valid(repeat('a', 31)), '31 code points are invalid');
SELECT ok(private.username_is_valid('A_1'), 'literal underscore and decimal number are valid');
SELECT ok(private.username_is_valid('東京123'), 'non-Latin letters are valid');
SELECT ok(private.username_is_valid('𝔘nicode'), 'supplementary letter is valid');
SELECT ok(private.username_is_valid('A²B'), 'Unicode Other Number is valid');
SELECT ok(private.username_is_valid('AⅣB'), 'Unicode Letter Number is valid');
SELECT ok(NOT private.username_is_valid('A B'), 'internal space is invalid');
SELECT ok(NOT private.username_is_valid('Ab' || chr(10) || 'C'), 'control is invalid');
SELECT ok(NOT private.username_is_valid('A' || chr(769) || 'B'), 'standalone combining mark is invalid');
SELECT ok(NOT private.username_is_valid('A' || chr(8203) || 'B'), 'format character is invalid');
SELECT is(private.username_lookup_key('ΑΒΣΑ'), 'αβσα', 'per-code-point Greek lowercasing preserves prefix');
SELECT is(private.username_lookup_key('Σaa'), private.username_lookup_key('σaa'),
  'capital and small initial sigma share a key');
SELECT isnt(private.username_lookup_key('ςaa'), private.username_lookup_key('σaa'),
  'final sigma has a distinct key');
SELECT ok(NOT has_column_privilege('authenticated', 'public.accounts', 'username', 'UPDATE'),
  'authenticated users cannot bypass RPC by updating the column');
SELECT ok(NOT has_function_privilege('anon', 'public.set_account_username(text)', 'EXECUTE'),
  'anonymous callers cannot claim usernames');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
SELECT is((SELECT username FROM public.set_account_username(' SCOUT001 ')), 'SCOUT001',
  'owner can change case and surrounding spaces normalize');
SELECT throws_ok(
  $$UPDATE public.accounts SET username = 'Bypass' WHERE id = '00000000-0000-4000-8000-000000000001'$$,
  '42501', 'permission denied for table accounts', 'direct account update is denied');
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
SELECT throws_ok($$SELECT * FROM public.set_account_username('scout001')$$,
  'P0001', 'username_unavailable', 'equivalent claim has one owner');
SELECT * FROM finish();
ROLLBACK;
