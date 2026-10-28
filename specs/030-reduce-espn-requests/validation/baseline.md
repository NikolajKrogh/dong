# Implementation baseline — 2026-10-25

- Jest: 144 suites, 909 tests passed with `npm run test:ci -- --runInBand --silent --cacheDirectory=.supabase/jest-cache`. Initial default-cache run failed before tests with sandbox EPERM; workspace cache resolved it. Jest reports existing open handles after completion.
- TypeScript: `npm run typecheck` passed.
- ESLint: `npm run lint` passed before adding the disposable-profile ignore.
- Edge: `npm run typecheck:edge` passed with `DENO_DIR` in ignored `.supabase/deno-cache`; default sandbox cache was inaccessible.
- Unused code: baseline found only the newly added, not-yet-connected `types/footballMatch.ts`.
- Java discovery baseline: 17 tests passed in the unsandboxed runner. The sandboxed attach helper stalled and was stopped; no code failure was inferred.
- Database: Docker recovered after supported Desktop force-stop/restart. A stale-socket rename failed, and the subsequent guarded removal refused because Docker had restarted; no socket or database data was deleted. The isolated stack runs on 58321/58322. Full compatibility checks after M1: 59 files/889 assertions passed with complete fixtures; see foundation.md.
- No E2E creation, generation or execution.
