# Making changes

Use the Node version in `package.json` (`engines.node`) and dependencies in `package-lock.json`. CI reads the same Node version. Install with `npm ci`.

Routes compose feature screens. Account, Friends, and History export their public API through `features/<name>/index.ts`; another feature imports that API, not internal files. Screens use repositories/hooks, not raw Supabase transport. Repositories parse server responses and accept the typed transport from `lib/supabase.ts`. Platform-specific connectivity and visibility stay behind `platform/` adapters. ESLint enforces these boundaries for the migrated features.

Zustand owns local games and preferences. TanStack Query owns in-memory cloud History and Friends data under `['account', accountId, ...]`. Auth identity changes synchronously advance a generation, cancel and remove old private queries, and fence delayed results. Same-account token refresh preserves its generation. Do not persist this private cache or queue social mutations offline. Reuse an operation UUID after an uncertain outcome; a confirmed completion or conflict ends that intent.

Create migrations with `npm run db:new-migration -- <slug>`. Never change an applied migration. Use the existing `db:start`, `db:reset` and `db:test` commands against the local Supabase stack. After a schema change, run `npm run db:types` against the tested local stack, then `npm run db:types:check` and `npm run typecheck`. Generated files are not manually maintained.

Run `npm run test:unit`, `npm run lint`, `npm run typecheck`, and `npm run check:unused` for client changes. ESLint rejects every warning; Knip rejects every unused-code issue without a baseline exemption. Its entry points include routes, platform variants, scripts, Edge Functions, BDD steps and the generated database contract. Jest factories require runtime module resolution, and Metro assets use `require()`. Narrow, explained exceptions cover optional platform module loading and external lifecycle synchronization; do not disable rules to hide application defects.

The normal constitution also requires pgTAP, relevant E2E coverage and platform validation. Feature 027 has an explicit user exception: only unit tests and static checks are executed in this implementation session. SQL authorization/races, web/Android runtime, accessibility and performance remain unverified. This exception does not establish production readiness or change the general testing policy.

Deploy schema and client together only after inspecting linked migration history and reviewing `supabase db push --dry-run`. Deploy a changed Edge Function explicitly. Do not reset hosted data, fetch remote migration history into the working checkout, or infer hosted parity from local generated types. Recover hosted failures through a new corrective migration; recover disposable local state by rebuilding its separate stack.

Edge type checking uses `--no-lock` to avoid a generated root `deno.lock`.
