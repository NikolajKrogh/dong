# Foundation checkpoint — local only

M1: `20261025191037_match_catalog_core.sql`. Applied from scratch using the isolated `dong-feature030` profile on port 58322; acquisition remains disabled and budgets unset by default. Public database types were regenerated from that schema with no semantic diff. No hosted schema or function deployment occurred.

- Core pgTAP: 40 assertions passed. Before application, missing identity/observation/reservation relations failed the new test. Coverage includes private grants, disabled/configured admission, conservative rolling/daily reservations, duplicate ownership, null/wrong generation rejection, meaningful immutable versions, corrections, unknown fields and cross-resource ordering.
- Full database suite: 59 files, 889 assertions passed. The CLI's external-directory runner omitted sibling `.inc` fixtures. The installed `public.ecr.aws/supabase/pg_prove:3.36` runner succeeded with all `supabase/tests` mounted read-only, pgTAP bootstrapped as the CLI normally does, and only the disposable network/database selected. This is backend verification, not E2E.
- Provider/composition Jest: 10 tests passed using injected responses, including timeout during body reading, streamed byte cap, explicit headers, access/throttle scope, no retries/probes, denied claims, deadline admission and independent peer commits.
- TypeScript and Deno checks passed for compact contracts, pure normalization, HTTP adapter, acquisition composition and parameterized Postgres adapter.
- Existing Java discovery baseline: 17 tests passed outside the sandbox. The initial sandboxed run stalled in its attach helper and was stopped; this was not treated as a behavioral failure.
- Lint and generated-type drift checks are recorded with their final results in the implementation log; no unrun gate is implied here.

The server driver is pinned to Postgres.js 3.4.9. A dedicated server-only database login should inherit `match_catalog_backend`; public/JWT roles cannot execute acquisition functions or inspect internal rows. Its login provisioning and named-secret ingress remain release/story work. Four pooled connections, disabled prepared statements and bounded connection/statement times are explicit; claims commit before HTTP and results are fenced by generation/group/worker lease.

These checks do not prove the full 100-room workload, worker timing, optional enrichment, client migration, device acceptance or deployment. They remain later tasks. No ESPN endpoint was called by these automated checks.
