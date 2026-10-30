# Contract: Match Discovery Cache and Picker

## Existing hosted boundary

The maintained client continues to invoke Supabase `discover-matches` through `FootballMatchService`. There is no Java API dependency, new endpoint or hosted payload change in this phase.

Request remains `{ leagueCodes: string[], date: string }`. Preserve existing validation: canonical source date, supported league identities, selection limit 128, batches of at most 16, 4 KiB request body and server UTC today ±7-day horizon. Batch only keys for the same source date. Do not enlarge provider concurrency, acquire provider leases client-side, or call ESPN directly.

The existing response contains:

| Part | Required retained facts |
|---|---|
| `groups[]` | `leagueCode`, `date`, `availability`, `lastSuccessfulCheckAt`, `isStale`, `reason`, `retryAfterSeconds` |
| `matches[]` | Existing validated public `SavedMatch` facts; pass through the existing normalization adapter before retention |
| aggregate | `availability` and `retryAfterSeconds`; preserve retry guidance but do not let aggregate partial status erase a valid league's individual result |

Validate the whole response through the existing schema, then check request/group correspondence. A transport failure or structurally invalid body fails all keys in that submitted batch; retain their previous fixtures and accept no new facts from the rejected body. Do not weaken the parser or salvage malformed rows.

Within a schema-valid response, missing/duplicate/wrong-date group correspondence fails only the affected key. Valid corresponding groups and valid per-league availability statuses can be handled independently. Separately submitted batches also settle independently. Only a uniquely matching available group can establish a checked empty schedule. A returned fixture is assigned by requested league and source group, not its kickoff date.

## Service compatibility boundary

Introduce optional `followUpPending` configuration on the football-match service factories; default is true. The picker obtains a service with `followUpPending: false`, so each query operation returns the first validated response without waiting 15 seconds for another check. Existing callers and factory injection remain supported when configuration is omitted.

Required regression: the default service still performs its existing bounded follow-ups, and `useLiveScores` legacy-identity recovery and saved-score reads are unchanged. Do not remove shared parsing, normalization, size limits, abort/error handling or batching utilities. The compatibility `MatchDiscoveryApiClient` remains unchanged.

## Picker-facing module interface

`useMatchData({ date, leagueCodes, active })` is the sole picker-facing discovery interface. All three inputs are required. There is no omitted-leagues fallback to all configured leagues. `active` expresses picker route activity; the implementation combines it with existing application visibility/connectivity facts. Only the existing shared caller and hook tests need the changed input shape.

| Returned fact/action | Meaning |
|---|---|
| `apiData` | Existing grouped fixture projection, restricted to current date and selected codes; retained usable rows remain included during pending/error states |
| `teamsData` | Existing team projection derived from those fixtures; separate from the manual team directory |
| `leagueStates` | One state per current selected league, with `leagueCode`, `status`, client-safe `message` and nullable `retryAt` |
| `isInitialLoading` | Initial discovery work is active without any usable retained result; independent of manual-team work |
| `isUpdating` | Discovery refresh work is in flight while retained results remain usable; informational, never a blanket disable flag |
| `retry()` | One guarded action for the current selection; caller does not reset counters, calculate cooldowns or configure refetch |

Per-league `status` is one of `initial`, `available`, `empty`, `updating`, `partial`, `pending`, `deferred`, `outdated`, `offline` or `error`. `available` means recent fixture information under FR-007, not authoritative live scores. `empty` requires a complete, matching, reuse-fresh zero-fixture schedule. Other statuses may coexist with retained rows in `apiData`; the caller displays both. `message` communicates waiting/exhaustion/failure without exposing internal errors; `retryAt` describes an applicable cooldown without making the caller responsible for enforcing it.

`retry()` joins equivalent work, honors cooldown and the active selection, and starts a new permitted cycle only inside the implementation. It resolves after the requested one-check operations settle, or without dispatch when waiting/inactive. Expected transport failures are reflected in returned league states rather than unhandled rejections. Pending follow-ups are not an instruction for the caller to await, schedule or repeat Retry.

Do not expose raw Query results, source projections, cycle fields or query options to picker callers. Metadata-only entries before the first valid response still project to an initial/pending state, never a successful-empty state. Data from a previously selected date is not placeholder content for the new date. Time-window filters remain local to the picker.

Configured chooser options stay owned by existing configuration outside this interface, independently of retrieved results. The existing picker supplies selected eligible codes; the implementation canonicalizes them but does not reach into a global configuration store. League identity is its canonical code; names are labels. A custom manual team remains independent of fixture discovery.

## Composition and test seam

Create one internal discovery implementation per supplied QueryClient. Its composition factory accepts `{ queryClient, discoverOnce }`; it does not import a global client or construct a hidden network dependency. `discoverOnce` accepts an explicit source date/league selection and returns the existing normalized discovery result, including group metadata. The production adapter uses `createMatchDiscoveryApiClient(getFootballMatchService({ followUpPending: false }))` and translates the date to the existing request shape. A controlled adapter supplies the same facts in tests. No extra provider hierarchy or transport stack is added.

The internal module interface supplies selection query options/projection and guarded selection Retry to the hook. Query policy, batch reservations and cycle data remain behind that seam. Module tests exercise the same interface with isolated real QueryClients and controlled discovery; fake clocks also control Query's clock/timers. Assert on returned fixtures/states and discovery calls, not private fields or helper exports. Hook tests cover view-model/activity wiring and avoid duplicating the entire policy suite.

## Query and batch boundary

- Query key: `['match-discovery', date, leagueCode]`; one retained source of public fixture and cycle data per key in the existing QueryClient.
- The new `features/football-matches/matchDiscoveryQueries.ts` owns options, freshness decisions, synchronous check reservations and transient same-turn batching. It uses the existing service, not a parallel transport stack.
- Queue eligible checks by source date and flush together up to the existing batch limit. Concurrent A/B and B/C demand performs at most one in-flight check for B. Resolve valid leagues independently; a later split-batch completion cannot delay earlier usable data.
- Each query function performs one check. No query retry or service-level pending loop runs underneath it. Set `retry: false` explicitly for this namespace.
- Query deduplicates equivalent work before enqueueing; reserve the shared cycle allowance synchronously at dispatch before transport. Pending intervals and manual Retry must recheck allowance, active demand, cooldown and in-flight state at dispatch. A second observer's timer cannot create check 4.
- Manual Retry must join rather than replace ongoing Query work: use `refetch({ cancelRefetch: false })` or the equivalent deduplicating QueryClient operation after domain guards. Do not use the default cancel-and-restart behavior.
- Use `gcTime: 30 minutes`, conditional pending-only `refetchInterval`, `refetchIntervalInBackground: false`, and `refetchOnReconnect: false`. The fixed source-check +60-second fixture-reuse deadline replaces the global receipt-based default for these queries only. Partial/server-stale or invalid-timing results cannot gain that eligibility; per-match scheduling is not inferred.
- Use stale-on-mount/focus activity behavior only for eligible current keys. When an observer joins an ongoing or exhausted pending cycle, it cannot reset that cycle. Exhaustion/long delay/error has no autonomous retry timer.
- An active request may complete after a consumer leaves. Do not connect an individual observer's abort to a multi-key batch, call broad `cancelQueries` on detach, or write results into whichever selection happens to be current.

See [data-model.md](../data-model.md) for exact freshness, partial merging and cycle transitions.

## Picker UI boundary

| State | Required behavior |
|---|---|
| No selected leagues | Explain that a league must be selected; no discovery request; all configured eligible choices remain visible |
| No usable snapshot, initial work active | Existing jumping-football artwork; accessible loading status and static reduced-motion equivalent |
| Some usable rows or checked-empty groups | Display/use those results immediately, including Add Matches for available rows; name unfinished leagues |
| Retained stale rows refreshing | Keep rows and actions usable; nonblocking updating/outdated status |
| Checked empty | Describe no fixtures only for the successfully resolved group/current local filter; do not infer global emptiness from partial data |
| Pending exhausted or long deferred | Keep available rows; identify pending leagues, Retry and any remaining wait |
| Offline/error without content | Explicit offline/error state and Retry; do not label it an empty schedule |
| Offline/error with content | Retained rows remain usable with warning and Retry |

`useTeamData` loading/failure pertains to manual team suggestions and cannot disable fixture date/time controls, ready fixture actions, or the configured league chooser. Preserve the current layout, date/time interpretation and animation library. Do not add a second loading renderer or change the splash.

Screen focus plus application interactivity controls discovery activity. The wizard unmounts inactive step content; a still-mounted route below another screen must deactivate its queries. Existing `QueryLifecycle`, visibility and connectivity adapters remain the platform boundary.

## Activity and privacy invariants

Completed results get no periodic timer. Reopen/mount, date/league changes, foreground return and manual Retry re-evaluate current keys; fresh entries are reused. Time-only edits, rendering, result receipt, and completed-result reconnect do not request again. A pending initial request paused by connectivity may resume as the same reserved check.

Discovery contains only public fixtures/status. Room IDs, participant details, access tokens, tracking grants and saved private drafts never enter the namespace or cache key. Host/guest permission outcomes, fixed selections, save/start eligibility, live scores and game history remain governed by existing paths.
