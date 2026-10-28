# Local quality gates, 2026-10-26

All checks use the existing repository and the disposable `dong-feature030` profile. No E2E test was created or executed; Android testing was skipped at the user's request. No feature deployment occurred.

| Gate | Actual result |
| --- | --- |
| Full Jest (`test:ci`, workspace cache) | 156 suites, 980 tests passed |
| Full Java Maven verify / coverage | 87 tests passed; JaCoCo gate passed |
| Client TypeScript | Passed |
| All six Edge entrypoints, Deno 2.9.6 | Passed |
| ESLint, zero warnings | Passed |
| Knip | Passed, zero findings |
| Clean M1–M5 migration application and seed | Passed |
| Full pgTAP | 68 files, 1,123 assertions passed |
| Generated database contracts | Regenerated; `db:types:check` matched the isolated schema |
| Actual adapter overlap / concurrent issuance | Passed; five source calls, 100 grants despite 101 creation calls |
| Timed closed-client module driver | Passed; see [US2](us2.md) for exact run/scope |
| Persisted storage and query measurements | Passed; representative insertion and rollback verified |
| Git whitespace checks | Passed |

The first complete Jest run correctly exposed fixture modules being collected as tests; the dedicated fixture directory is now excluded while actual tests remain included. The real adapter harness exposed double JSON encoding, and failing fake-clock tests exposed unbounded dependency waits. Both were fixed and rerun. A migration syntax failure was repaired before the final successful clean rebuild; unseeded-run foreign-key failures were runner state, not a change to account behavior.

Superseded Java ESPN/Caffeine code, direct solo parsing/types and the legacy Edge HTTP implementation were removed only after maintained callers migrated. Their obsolete tests were replaced by source normalization, transport, ingress, saved-state, access, and integration coverage. The new sole ESPN adapter retains the original explicit Accept/User-Agent behavior. The compatibility Edge entrypoint remains authorized and performs no source HTTP.

The final literal endpoint audit also found and removed `useLeagueLogo`'s decorative scoreboard fetch. Bundled and already cached logos remain; uncached leagues use their existing placeholder. Its replacement regression verifies zero network acquisition, and the complete suite was rerun. The only maintained scoreboard/summary endpoint now resides in the owned ESPN adapter.

Ignored logs live under `.supabase/feature030/`. Local module timings and CPU/RSS do not establish deployed Supavisor/TLS, actual Edge quotas, Realtime delivery, billed egress or authenticated device recovery. Those remain release verification; no unavailable gate is reported as passed.

The registered `after_implement` Git commit hook is optional and was left unrun. No mandatory post-hook is registered. Unrelated concurrent Home/E2E/skill workspace changes were preserved rather than included in a commit or treated as this implementation's test work.
