# Implementation Plan: Reduce ESPN Requests with Shared Match Data
  
**Branch**: `190-reduce-espn-requests` | **Date**: 2026-10-25 | **Spec**: [spec.md](spec.md)

**Input**: `specs/030-reduce-espn-requests/spec.md`

## Summary

Replace independent Java discovery, solo ESPN polling, and room-triggered acquisition with one Match Catalog module. Store compact individual match facts once, coordinate shared league/date requests in Postgres, and run a bounded authenticated Edge worker awakened by a database-only 15-second Cron check only when work is due. Live provider polling remains 60 seconds. Monitoring begins at known kickoff and continues for eligible multiplayer rooms with every client closed. Existing room gameplay applies accepted observations with durable progress and explicit provider provenance; solo configuration and consequences stay local.

League codes, curated display names, categories and defaults come from one release-controlled `constants/leagueCatalog.json`. The app bundles them for immediate offline setup; the ESPN transport imports the same catalog for resource validation. Postgres retains seeded identities and metadata for match relationships and discovery admission. `check:league-catalog` verifies identity/metadata migration snapshots against the release catalog in CI; its `--sql` mode generates metadata values. Catalog changes require an intentional release and migration, with the check targeting the new snapshot rather than editing applied migrations. Java keeps no independent list. There is no league metadata request/cache/bootstrap; existing user selections, including intentionally empty selections, take precedence over bundled defaults.

Retain match identity, accepted gameplay evidence, compact goals, rosters/participation, and final scalar team statistics within a measured Free-tier allowance. Raw archives, notifications, new statistics screens, a provider-family migration, and another scheduler platform are excluded.

## Technical Context

**User-directed verification scope (2026-10-25)**: No new E2E tests and no E2E runs. The exception in [validation/user-exceptions.md](validation/user-exceptions.md) supersedes Playwright/BDD/device-journey work below. Retain unit/component, real-Postgres and owned-transport integration checks; do not claim E2E/device acceptance from them.

**Language/Version**: TypeScript 5.9 / Node 26.3.1 tooling; Expo SDK 57, React 19.2, React Native 0.86; Deno Edge runtime with repository Deno 2.9.6 check tooling; PostgreSQL 17 SQL/PLpgSQL. Java 17 / Spring Boot 3.5.3 remains where deployed compatibility requires it.

**Primary Dependencies**: Existing Supabase JS 2.114, Supabase server authentication adapter, TanStack Query 5, Zustand 5, Expo platform adapters, pg_cron, pg_net, Vault. Retain currently verified ESPN Site v2 and explicit request headers. No paid infrastructure or generic provider framework.

**Storage**: Supabase Postgres for shared compact facts and coordination; existing AsyncStorage/Zustand ownership for local solo games. Provider feature initially targets 100 MB including indexes/disposable data, reserving capacity for other application data. No new Storage bucket.

Downloaded solo detail is retained as self-contained private local history values. The bounded saved-only `history` projection may capture held roster/final metrics on completion or ordinary later access; it does not acquire provider data or create server retention pins. Uncaptured expired detail is explicitly unavailable. Server history protection applies to retained multiplayer references.

**Testing**: Jest/Jest Expo, pgTAP plus real-Postgres concurrency verification, controlled provider fixtures, Playwright BDD for affected discovery/recovery journeys, Maven checks when compatibility changes. ARTEMIS exploration precedes authored mobile interaction tests. Android runtime evidence is distinct from browser evidence.

**Target Platform**: Expo web and Android clients; hosted Supabase Postgres and Edge Functions. No iOS acceptance scope.

**Project Type**: Existing polyglot mobile/web application with a tier-spanning Match Catalog module; no new project or parallel CRUD backend.

**Performance Goals**: At most five routine acquisitions per normal refresh window for 100 rooms sharing five request groups; fresh overlapping consumers add zero attempts. Zero recurring pre-kickoff score requests. Healthy, budget-available first check and at least 95% of provider-visible updates within 90 seconds. Authorized saved-room recovery within five seconds of successful connection in the controlled environment.

**Constraints**: Supabase Free; bounded HTTP/CPU/batch work; global budgets/cooldowns; no read-triggered fetch; no participant impersonation; unchanged room correction/baseline rules; protected referenced history; explicit unavailable/partial states; no live ESPN calls in routine automated tests.

**Scale/Scope**: Acceptance workload is 100 overlapping rooms plus 100 solo/discovery consumers over five request groups. Unique match count is capacity-admitted, not unbounded. Source traffic scales by eligible request groups; room consequences and authorized client traffic still scale by rooms.

## Constitution Check

*Gate evaluated before Phase 0 closes on 2026-10-25; repeated after Phase 1 below.*

| Principle / constraint | Pre-research result and design obligation |
| --- | --- |
| I. Cross-platform first | PASS: web/Android consume the same facts/freshness; platform adapters preserve visibility/network behavior. No new navigation. |
| II. Server-authoritative state | PASS: private Postgres operations own demand, budgets, claims, acceptance, and room progress; clients cannot submit trusted observations. |
| III. Event-backed history | PASS: accepted observations and existing room events preserve replay; latest projections do not replace evidence. |
| IV. Supabase first | PASS: Postgres/Cron/Edge are the durable path; Java may forward for compatibility but cannot retain independent acquisition policy. |
| V. Required coverage | PASS: story-level unit, SQL/access/concurrency, transport, and recovery checks required before merge; mobile tests follow ARTEMIS exploration. |
| VI. Skills first | PASS: speckit-plan, codebase-design, naming-analyzer, Supabase/Postgres, Database Design Expert, and expo-data-fetching guidance applied; prior simplify review retained. |
| Identity and guest rules | PASS: existing authenticated-host/scoped-guest rules remain; public facts/solo tracking introduce no new room identities. |
| Persistence and recovery | PASS: reviewed migrations, indexes, RLS/grants, generated contracts, schema assertions, non-destructive linking and cutover required. |
| Free-tier constraint | PASS: measured compact retention, bounded logs/admission, and operating reserves; no paid dependency. |

No constitution exception is needed. PASS validates the proposed design, not unimplemented runtime behavior.

## Project Structure

### Documentation (this feature)

```text
specs/030-reduce-espn-requests/
  spec.md
  plan.md
  research.md
  data-model.md
  contracts/
    match-catalog.md
    worker-and-room-processing.md
  quickstart.md
  architecture.md
  naming-review.md
  supabase-review.md
  free-tier-storage.md
  storage-design.md             # historical rejected archive alternative
  checklists/requirements.md
```

`tasks.md` belongs to the later `/speckit-tasks` command and is not generated here.

### Source Code (repository root)

```text
 types/footballMatch.ts
 utils/footballMatchService.ts
 hooks/useMatchData.ts
 hooks/useLiveScores.ts
 hooks/useActiveGameRoomSync.ts
 hooks/useGameProgressController.ts
 types/matchScores.ts            # null-aware existing goal/stat display contract
 components/gameProgress/MatchQuickActionsModal/  # preserve existing details
 store/                        # additive linkage; existing solo ownership
 supabase/functions/_shared/football-matches/
   footballMatchService.ts
   espnHttpClient.ts
   espnMatchNormalizer.ts
   postgresFootballMatchRepository.ts
 supabase/functions/discover-matches/index.ts
 supabase/functions/solo-match-tracking/index.ts
 supabase/functions/run-match-monitor/index.ts
 supabase/functions/refresh-provider-scores/  # temporary read/replay adapter
 supabase/migrations/           # CLI-generated during implementation
 supabase/tests/database/
 __tests__/
 e2e/features/
 e2e/steps/
 command-api/src/               # discovery forwarder; old owner retirement
 docs/production-hosting.md
```

**Structure Decision**: Private SQL owns durable invariants; one Edge HTTP adapter owns ESPN. Client operations are `discoverMatches`, `readSavedMatches`, and `replaceSoloTracking`. Dedicated solo ingress protects anonymous mutation admission. Keep helpers cohesive; no per-table repository classes, workflow engine, or new app scaffolding.

The dedicated solo ingress is a bounded transport adapter over the same module, not another acquisition implementation. Public saved reads use a sanitized RPC; the worker uses named server-secret authentication and private backend-only operations.

## Phase 0: Research

Resolve identity/migration mapping, room provider provenance, kickoff/lifecycle scheduling, global budgets/claims, anonymous solo admission, read/discovery transport, bounded dispatch, and ownership cutover. [research.md](research.md) records decisions, rationale, alternatives, source evidence, and initial settings. Reuse existing ESPN samples without new requests. Required runtime measurements are release gates, not unresolved design choices.

## Phase 1: Data Model and Contracts

[data-model.md](data-model.md) defines entities, constraints, indexes, transitions, retention, room integration, and capacity admission. [Consumer contracts](contracts/match-catalog.md) and [worker/room contracts](contracts/worker-and-room-processing.md) define operations, access, errors, timing, and compatibility. These artifacts resolve the earlier illustrative proposals; the superseded archive model adds no implementation scope.

## Delivery Slices and Verification Ownership

| Slice | Deliverable | Distinct evidence |
| --- | --- | --- |
| Shared foundation | Compact schema/normalization, settings, atomic claims/budgets, saved reads | Unit fixtures; pgTAP access/constraints; concurrent transactions; actual row/index sizing |
| US1: shared acquisition | Discovery/solo/room reuse; maintained clients use catalog; independent paths fenced | Cold/warm overlap counts; zero attempts on reads/reconnects; discovery compatibility/partial results |
| US2: autonomous rooms | Atomic lifecycle demand, due-only scheduler, trusted source application, replay | Zero-client kickoff; score jumps; host departure; interrupted/obsolete work; no duplicate consequences |
| US3: bounded failures | Persistent backoff/budgets, freshness, safe cutover/recovery, diagnostics | 403/429/5xx/malformed fixtures; exhausted quotas; restart; partial failures; web/Android re-entry |
| US4: useful compact history | Goals, roster participation, final stats, bounded enrichment/retention | Null/unused-substitute semantics; corrections; two-attempt cap; protected vs disposable data; capacity load |

No UI redesign is planned. Preserve existing solo goalscorer/current-stat controls through compact saved fields and null-aware types/presentation. Exercise existing discovery/start/re-entry flows; add BDD coverage if integration materially changes those journeys. Update event/history consumers for explicit provider actor kind and nullable participant attribution, preserving all existing participant history and controls. Replace obsolete polling assertions where module coverage proves equivalent behavior; retain distinct concurrency, access, transport, and device checks.

## Migration, Cutover, and Recovery

Use additive schema/nullable linkage first. Link valid existing provider room matches without changing scores, baselines, assignments, immutable history, or room UUIDs. Report ambiguous/missing metadata; do not sweep leagues. Preserve current solo source IDs and add catalog identity separately. No historical provider backfill.

Keep acquisition disabled while deploying schema, protected transports, worker, compatibility forwarding, and maintained client changes. Use one database-controlled ownership mode to fence old authoritative backends before enabling the catalog. Java/Edge can be fenced centrally; already-shipped solo clients directly calling ESPN cannot. Require a documented refresh/update compatibility gate, and scope consolidation claims to migrated clients until evidence supports broader adoption.

Activate one owned job after credential, policy, capacity, and controlled cutover checks. Rollback pauses new acquisition first and preserves observations/progress for replay and saved reads. Never restart a legacy fetcher concurrently. Prefer forward recovery; code rollback does not undo accepted history or justify dropping tables. Database pushes and Edge deployments are separate verified actions.

## Validation and Release Gates

[quickstart.md](quickstart.md) supplies local validation steps. Map SC-001 through SC-010 to controlled runs with measured counts/timings/bytes and explicit platform/deployment limits. An explicitly bounded live smoke may supplement fixtures after cutover; repeated live traffic is not a test strategy.

Verify migrations, generated types, hard-coded schema assertions, grants/RLS, authentication, browser CORS, and query plans. Measure actual rows/indexes, scheduler/log overhead, protected growth/reserves, Edge CPU/duration, aggregate invocations, Realtime traffic and egress. Record repository baseline failures separately from new regressions.

## Post-design Constitution Check

Re-evaluated on 2026-10-25 after research, model, both contracts, and validation guide were drafted:

| Gate | Result / concrete evidence |
| --- | --- |
| Cross-platform and local ownership | PASS: consumer contract keeps shared facts separate from private local solo state; quickstart requires web and Android re-entry evidence. |
| Server authority and access | PASS: private atomic claims/budgets, two authenticated entrances, constrained provider provenance, grant versions, explicit grants and sanitized reads. |
| Auditable history and recovery | PASS: immutable meaningful observations, composite room progress references, current-score reconciliation, transition cutoffs and non-destructive safe mode. No new subtractive multiplayer baseline. |
| Supabase-first and Free | PASS: existing platform only; compact model, indexed due-only scheduling, reserved live capacity, bounded diagnostics/retention/admission, measured resource gates. |
| Required coverage | PASS: each story maps to distinct unit/SQL/concurrency/transport evidence; SC-001–SC-010 mapped in quickstart, with real device limitations and ARTEMIS requirement explicit. |
| Skills and migration governance | PASS: relevant skills applied; additive migrations/types/schema assertions, separately verified deployments, legacy-owner fencing/adoption limits and rollback documented. |

No unresolved design choices or unjustified gate failures remain. Runtime tuning, capacity forecasts, queue grants and supported-client adoption are release checks with selected policies, not claims of implementation or verified production acceptance.

The five agreed analysis findings are resolved in [analysis-remediation.md](analysis-remediation.md): supported-client consolidation scope, group/provider failure scope, solo local history retention, issuance-bound grants and committed pending-command outcomes. The 40-item focused requirements checklist remains open for T001; these documentation changes do not claim runtime acceptance.

## Complexity Tracking

No constitution violations. Temporary Java/legacy Edge forwarding serves deployed consumers, has no independent acquisition policy, and is removed when compatibility evidence permits. Private coordination and observation/room progress are required by concurrency and recovery, not optional framework layers.
