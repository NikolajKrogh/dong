# View-state model

No new persisted server entity, schema, migration or backfill. Existing game/session/guest/account/history entities remain canonical.

## Route view state

| Projection | Fields | Validation/lifetime |
| --- | --- | --- |
| Solo setup | step: players/matches/common/assign | Validate after local hydration and on explicit entry; prerequisites remain existing game rules |
| Registered lobby setup | sessionId; step: room/matches/common/assign | Existing auth/member/phase checks; polling must not force step changes while editing |
| History | tab; friendId; gameId; sort; direction | Normalize enums/identities, resolve data under current account; no private payloads |
| Friends | tab: friends/requests | Preserve caller tab through child return; only a view choice, not server data |

Defaults/canonicalization are in contracts/navigation.md. Parameters express desired state, never permissions.

## Return context

The real navigator stack is the primary caller record. Fallback parents apply only when no usable caller exists. Local tab/query text can remain in the existing mounted caller; if remounting is unavoidable, preserve only bounded view state and fence it by account. Do not create an extra persisted navigation store.

## Overlay lifecycle

Closed → open (retain underlying task, register scoped dismissal) → closing → closed (one navigation effect, cleanup, focus restore). Browser Back, header/Close and Escape converge on the same close operation. A repeat close during closing is idempotent. Refresh does not resurrect a transient sort/actions panel; a gameId restores a resolvable detail view. Forward may restore a route-backed detail, but not a stale unmounted listener.

## Game context invariants

Solo configuration retains local roster/matches. Multiplayer configuration/status retains existing room/participant identity, role and guest grant; safe Home does not run Leave/End. Terminal or access-lost state uses existing recovery. Session changes remain server commands/events, not effects of view parsing.

## Account boundary

On account/target change, keep current private-cache cancellation/fencing and account-keyed content behavior. Resolve friend/detail identifiers only after current authorization. Revocation or missing data produces unavailable/recovery state, not cached disclosure. Local-only completed-game IDs may be valid on one device only; links to them must explain unavailability elsewhere.
