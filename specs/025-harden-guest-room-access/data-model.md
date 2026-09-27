# Phase 1 Data Model

## Existing canonical records

`public.game_sessions` supplies room identity, join code and state. `public.participants` supplies guest identity, current `guest_rejoin_token_hash`, and `left_at`. `public.gameplay_events` already records joins/leaves and remains append-only. Do not move game state to a new store.

## Participant grant columns (additive migration)

| Column | Meaning / invariant |
|---|---|
| `guest_grant_issued_at timestamptz` | Present for active guest hash; set by join/backfill/rotation. |
| `guest_grant_expires_at timestamptz` | At most issued + 48 hours; server time is authoritative. |
| `guest_grant_previous_hash text` | Prior hash for retry confirmation only; never accepted by resolver for reads/writes. |
| `guest_grant_rotation_id uuid` | Last rotation operation identifier; checked with previous and current hashes. |
| `guest_grant_retry_until timestamptz` | Bounds previous-hash retry confirmation to five minutes. |

Existing `guest_rejoin_token_hash` remains the current bearer hash. Current hash is unique globally for guest rows, not merely `(session_id, hash)`; preflight duplicates before creating the partial unique index. Hash lookup and previous-hash retry lookup need partial indexes. Guest columns stay null for registered members. Add checks for timestamp ordering and guest-only use. `left_at` revokes the grant; expiry and room closure deny use without writing a per-read event. Rotation updates one participant row transactionally and never changes participant ID.

**Migration**: Backfill existing, not-left guest rows with `issued_at = migration timestamp`, `expires_at = migration timestamp + 48 hours`; left rows are already denied. Preserve raw token hashes as-is, and do not insert new join events. A migration-time `SELECT` detects duplicate hashes before unique index creation; deployment halts on duplicates. Keep old fields for rollback and client compatibility; do not backfill a longer grant on subsequent deploys. If a room is closed, the validator denies it regardless of backfill.

## Private abuse windows

`private.guest_abuse_windows(kind text, key_digest text, window_start timestamptz, count integer, expires_at timestamptz, last_reason text, primary key(kind, key_digest, window_start))`.

- `key_digest` is HMAC over a canonical, type-prefixed caller address, normalized submitted code, or token hash using a secret loaded only by trusted database code from Vault. No raw code, IP, or token is stored in this table. HMAC secret rotation needs a deliberate key-version/overlap policy; old windows can expire rather than being rewritten.
- Fixed windows use server time. Atomic `INSERT ... ON CONFLICT DO UPDATE ... RETURNING count` provides concurrent threshold enforcement. The admission function checks all relevant dimensions before joining or returning a snapshot. Increment accepted and rejected attempts; return a typed limit response so the counter transaction commits.
- Index `expires_at` for housekeeping; purge past seven days with an authorized scheduled cleanup or an operational maintenance command. No RLS/client grants on `private` table. Ensure HMAC secret is installed in local and hosted environments before enabling quotas.
- Proposed defaults are documented in research R5. Store configurable thresholds via server-controlled config/GUC, not request fields. Hard caps prevent zero/unbounded settings.

## State transitions

| State | Join | Snapshot / final view | Mutation | Rotate | Leave |
|---|---|---|---|---|---|
| Joinable + current/unexpired | same participant on retry | allowed | lobby-permitted actions | allowed | confirmed and revoke |
| In progress + current/unexpired | no new guest | allowed | existing permitted game commands only | allowed | not permitted under #165 scope |
| Completed + current/unexpired | no new guest | final-result read only | denied | not needed/denied | revoke if existing leave semantics permit; otherwise expiry/closure |
| Closed | denied | denied | denied | denied | already invalid |
| Expired, replaced, left, unknown | denied (unless new token and room joinable) | denied | denied | only exact bounded retry confirmation for replaced token | already invalid or pending transport |

Room closure and revocation win races with renewal/commands by consistent row lock order. Every authorized mutation keeps existing immutable gameplay event and command idempotency behavior. Failed validation leaves no partial participant or gameplay writes.

## Derived live-roster projection (2026-09-26 amendment)

No table or persisted participant column is added for live-roster eligibility.
The shared room snapshot returns two intentionally distinct arrays:

| Snapshot field | Meaning | Expiry behavior |
|---|---|---|
| participants | Existing not-confirmed-left room participants, retained as the compatible game-state/history projection. | Unchanged by grant expiry. This remains the input to game hydration and started-game assignments. |
| activeRoster | Derived current lobby roster and, while joinable, the eligible participant set for the next game. | Registered participants not marked left plus guests not marked left whose current grant hash exists and whose grant expiry is later than server time. |

One private server-side eligibility helper is used by the assignment
feasibility count, host-assignment validation, and the participant IDs locked by
start_game_session. The server remains authoritative; the client does not
compute grant expiry from local time. Grant expiration does not set left_at,
append a participant_left event, delete participant/assignment/pick/event
records, or reset private.guest_abuse_windows. After a game starts, the
settled participant list and game records continue to use participants even
when activeRoster later omits an expired guest.

## Client credential record

`{ guestToken, participantId, sessionId, joinCode, displayName, expiresAt, pendingRotation?: { oldToken, newToken, operationId, startedAt }, pendingLeave?: { requestedAt } }` is stored in SecureStore (native) or sessionStorage (web). When possible, move non-secret display fields outside the protected record, but keep the bearer and pending new bearer together for crash recovery. Legacy AsyncStorage grant is read once and removed immediately, then held only in memory for server validation before a protected/session write. An offline or invalid upgrade may lose automatic restore; do not re-persist the plaintext. Never log this record or include tokens in URLs, analytics, crash contexts, or gameplay events.
