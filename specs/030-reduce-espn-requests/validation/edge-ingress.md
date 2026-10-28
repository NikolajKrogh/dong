# Edge ingress implementation

Implemented on 2026-10-26. No deployment, live ESPN request, Android run or E2E test occurred.

- `discover-matches` and `solo-match-tracking` accept only an exact configured project public key through `apikey`. Legacy anonymous keys and named publishable keys work together; a user JWT alone or worker secret gives no public-ingress authority. Both routes lazily construct the same Match Catalog implementation.
- Requests have a 4,096-byte streaming body cap, a five-second whole-body read deadline, strict JSON fields and bounded identifiers. Malformed input is 400, oversized input 413, and a stalled stream is cancelled with a safe 408 response before any database/module initialization. Discovery validates calendar dates before a database cast. Solo creation/replacement authority remains mutually exclusive. Unknown fields cannot request source URLs, force refreshes, timing, or budget overrides.
- `run-match-monitor` uses pinned `@supabase/server@1.9.2` with `auth: 'secret:match-monitor'`, then accepts only a server-issued UUID dispatch token and positive safe generation. The database/module validates live dispatch ownership. Its ingress supplies a 35-second deadline; callers cannot extend it.
- CORS covers successful responses, preflight, safe domain errors and SDK authentication errors. Production `https://dongthegame.com` plus explicit local origins are allowed, with optional configured additions. Responses have `Cache-Control: no-store`. No request body, bearer grant, secret, SQL error or upstream body is logged/reflected.
- The old registered-user `refresh-provider-scores` route reads `get_room_snapshot` through the authenticated user's client for actual room authorization and returns compatible `not_due`, `refreshedAt: null`, empty results/warnings. It no longer imports/acquires ESPN, claims work, accepts caller scores or advances provider-success time. The earlier `provider.ts` header fix remains untouched; retiring that unused parser waits for the coordinator's source audit.
- `MATCH_CATALOG_DATABASE_URL` is a server-only login granted `match_catalog_backend`, separate from JWT/public keys. Signing config (`MATCH_CATALOG_SIGNING_KEY_ID`, `MATCH_CATALOG_SIGNING_KEYS`) is only required by solo creation/recovery; missing keys cannot prevent saved/discovery reads. `MATCH_CATALOG_FIXTURES_ONLY=true` refuses outbound source requests. Automated checks inject fixture dependencies directly rather than overriding a source URL.

Verification:

- Focused ingress Jest suite: 12 tests passed. Cases include public/worker authority separation, origin rejection, malformed/mixed input, content-length spoofing/stream limits, cancelled stalled-body timeout, safe errors/retry headers, worker body/deadline restrictions and legacy authorized no-op behavior.
- `npm run typecheck:edge`: all six configured entrypoints passed Deno 2.9.6 checking, including actual pinned SDK and Postgres imports.
- Changed ingress/runtime/entrypoint/test ESLint: passed with zero warnings.
- An ignored Deno smoke script `.supabase/feature030/edge-auth-smoke.ts` exercised the actual monitor entrypoint and real pinned SDK with synthetic keys, all outbound networking denied. A publishable key and a different/default secret returned 401; the named monitor key reached body validation (400 for the intentionally empty dispatch). CORS was present on each response and outbound count stayed zero. This validates SDK wiring, not a live SQL dispatch or hosted deployment.
- Added Jest module/test exclusions for ignored `.supabase/` runtime caches. This removes Haste duplicate-package collisions after both old/new SDK versions were cached without suppressing repository test files.

Current Supabase docs checked: [API key migration](https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys), including named secret modes, JSON key environment variables and `apikey` transport; changelog index checked 2026-10-26. No relevant breaking change was found for these ingress contracts.

Integrated dispatch/concurrency acceptance and the legacy SQL ownership fence remain coordinator-owned checks. Entry-point typechecking does not establish those behaviors.
