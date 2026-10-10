# Making changes

Use the Node version in `package.json` (`engines.node`) and dependencies in `package-lock.json`. CI reads the same Node version. Install with `npm ci`.

Routes compose feature screens. Account, Friends, and History export their public API through `features/<name>/index.ts`; another feature imports that API, not internal files. Screens use repositories/hooks, not raw Supabase transport. Repositories parse server responses and accept the typed transport from `lib/supabase.ts`. Platform-specific connectivity and visibility stay behind `platform/` adapters. ESLint enforces these boundaries for the migrated features.

Zustand owns local games and preferences. TanStack Query owns in-memory cloud History and Friends data under `['account', accountId, ...]`. Auth identity changes synchronously advance a generation, cancel and remove old private queries, and fence delayed results. Same-account token refresh preserves its generation. Do not persist this private cache or queue social mutations offline. Reuse an operation UUID after an uncertain outcome; a confirmed completion or conflict ends that intent.

Create migrations with `npm run db:new-migration -- <slug>`. Never change an applied migration. Use the existing `db:start`, `db:reset` and `db:test` commands against the local Supabase stack. After a schema change, run `npm run db:types` against the tested local stack, then `npm run db:types:check` and `npm run typecheck`. Generated files are not manually maintained.

Run `npm run test:unit`, `npm run lint`, `npm run typecheck`, and `npm run check:unused` for client changes. ESLint rejects every warning; Knip rejects every unused-code issue without a baseline exemption. Its entry points include routes, platform variants, scripts, Edge Functions, BDD steps and the generated database contract. Jest factories require runtime module resolution, and Metro assets use `require()`. Narrow, explained exceptions cover optional platform module loading and external lifecycle synchronization; do not disable rules to hide application defects.

The normal constitution also requires pgTAP, relevant E2E coverage and platform validation. The Feature 027 implementation session recorded a user-approved exception to run only unit tests and static checks; SQL authorization/races, web/Android runtime, accessibility and performance were unverified in that session. That historical exception applies only to Feature 027 and does not change the general testing policy. See each feature's quickstart for its own validation evidence and limits.

Deploy schema and client together only after inspecting linked migration history and reviewing `supabase db push --dry-run`. Deploy a changed Edge Function explicitly. Do not reset hosted data, fetch remote migration history into the working checkout, or infer hosted parity from local generated types. Recover hosted failures through a new corrective migration; recover disposable local state by rebuilding its separate stack.

Edge type checking uses `--no-lock` to avoid a generated root `deno.lock`.

## Feature 028 shared history

`SOCIAL_MIGRATION = supabase/migrations/20261009192736_shared_history_comparisons.sql`. Online eligibility requires completed/start/completion timestamps, a six-digit online code and no legacy-import event/match markers. Migration preflight stops and lists up to 20 unknown/conflicting origin records; investigate without changing recorded results. The private projection derives from canonical completed participants and preserved numeric departure totals, excluding pending/local/imported data from social aggregates.

The four public RPCs are authenticated invoker wrappers over restricted private reads. Friend/block checks run for each bundle or page. Overall friend stats return aggregates only; underlying separate-game RLS is unchanged. Social query observers use account keys and fresh authorization on open/refresh/return/foreground. Hide cached payload while checking or after failure; confirmed friendship mutations invalidate these views immediately. Never persist this private cache or replace a failed read with local history.

Regenerate/check types from the tested schema. For a separate disposable local database, `DONG_DB_URL` explicitly selects `--db-url`; unset it to retain normal `--local` behavior. Read feature 028 quickstart for the clean/seeded-upgrade evidence and pgTAP fixtures. Schema-first rollout requires linked history review and dry-run; recovery revokes new RPC access and uses a forward migration without resetting hosted results.

Feature 028 has a user-approved exception removing all E2E authoring/execution. Unit/component/hook/repository, static checks and local pgTAP passed. Physical-device, authenticated runtime/second-device parity, visual accessibility/layout and per-platform timing remain unverified. Local SQL timing is not proof of the two-second client goal.
