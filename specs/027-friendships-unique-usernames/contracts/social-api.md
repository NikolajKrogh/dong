# Social and Account Interface Contracts

Proposed interfaces for implementation; not deployed endpoints. Public RPC wrappers use the authenticated caller; none accepts a trusted actor ID. SQL implementations and exact generated names are created by migrations, then reflected by generated TypeScript types.

## Account

`set_account_username(username: text)` → `{ account_id, username, updated_at }`.

Owner-only, server normalization, atomic unique claim. After surrounding-space trimming and NFC normalization, require 3–30 Unicode letters, numbers, or underscores as specified in the data model. Null/invalid/taken input returns a stable domain error; current account remains unchanged. Repeating the same username is safe. No canonical key returned as editable data. Authentication bootstrap may leave username null; social operations require a completed username.

## Reads

| Operation | Input | Result |
|---|---|---|
| `search_accounts_by_username_prefix` | Raw username prefix, minimum 3 normalized characters | Zero to 20 `{ account_id, username, relationship, request_id? }`; hide self, blocked pair, missing/ineligible account |
| `list_social_relationships` | List kind: incoming/outgoing/friends; bounded cursor/page size | Authorized items with counterpart ID/current username, request ID, status, direction, server timestamps |
| `list_account_blocks` | Bounded cursor/page size | Owner-only `{ block_id, account_id, username, created_at }` |

Lists default to 50 and cap at 100 records; stable keyset ordering by `(created/requested timestamp, UUID)` with an opaque or validated cursor. Invalid list kinds/cursors are validation errors. Search has no pagination: filter self, eligibility, and blocked pairs before limiting to 20 results ordered by canonical username key. Match the prefix literally, including underscores. Measure the three-character minimum after display normalization, before lowercase key derivation. Search returns no private profile fields. Invalid or shorter-than-three-character input returns an empty result with local validation guidance; users refine the prefix to narrow matches. A failed network/database read is an error, not an empty list.

## Mutations

| Operation | Required inputs | Behavior |
|---|---|---|
| `send_friend_request` | target_account_id, expected_username, operation_id | Confirm selected current username; create/return pending under pair lock, or current permitted relationship. After decline, a fresh operation from either participant immediately creates a new pending generation if unblocked; replay never creates one |
| `respond_friend_request` | target_account_id, request_id, decision accept/decline, operation_id | Recipient-only current-generation transition |
| `cancel_friendship` | target_account_id, request_id, expected_status pending/accepted, operation_id | Cancel request: requester-only pending. Unfriend: either participant accepted. Require matching generation and expected status; stale pending cancellation cannot unfriend an accepted relationship. Revoke friendship-only access without blocking |
| `block_account` | target_account_id, operation_id | Upsert own directional block, atomically cancel pending/accepted relationship |
| `unblock_account` | target_account_id, block_id, operation_id | Remove only own current block generation; never restore friendship |

Mutation return: `{ operation_id, replayed, disposition, current_relationship, request_id?, own_block_id? }`. The current relationship is a caller-permitted projection and does not disclose another user's private block. A replay reports the original disposition but reads current authorized relationship state, so an old accept replay cannot appear as a revived friendship after blocking.

Operation IDs are generated once per user intent and reused after timeout/uncertain outcome. New intents use new IDs. Reuse with different operation/target/input conflicts. Server effects and successful receipts commit together; failed transactions leave neither effects nor successful receipts. UI does not automatically queue or retry mutations offline.

`expected_username` is a confirmation aid, not identity or authorization. If the selected account was renamed before sending, return `target_changed` with only the permitted current target projection and require reconfirmation. Never retarget by old name.

## Errors

Stable domain codes: `authentication_required`, `username_required`, `invalid_username`, `username_unavailable`, `target_unavailable`, `target_changed`, `request_conflict`, `request_not_allowed`, `idempotency_conflict`, `invalid_input`. Map constraint errors to domain codes without exposing SQL internals. Blocked versus missing target uses the same generic unavailable response where disclosure would reveal private blocks. Retryable transport errors remain distinct from domain denial.

No client-provided account/role metadata authorizes operations. service_role credentials stay outside the public client.

## Client Data Access Contract

UI entry contract: existing Settings → Profile & username → Friends. Home receives no layout or navigation changes. Friends has Friends/Requests tabs and username search; Blocked accounts opens from the header overflow menu. Row overflow contains applicable person actions. Follow [v4 workflow notes](../mockups/README.md) and preserve accessible focus restoration for menus/dialogs. These navigation decisions do not add new server capabilities.

- Routes import feature public APIs; screens do not call raw `.from()` or `.rpc()`.
- Repositories accept the typed Supabase client and an AbortSignal where cancellable; query functions throw returned errors.
- Keys include authenticated account ID and every request input; for example `['account', id, 'friends', listKind, cursor]` and `['account', id, 'history']`.
- Private queries are disabled while identity is unresolved. Auth transitions immediately stop rendering old scope, cancel/remove old queries, clear sensitive mutation state, and fence late completion callbacks.
- Token refresh for the same account need not discard valid data; logout, deletion, external expiry, and changed account identity do. Every request uses current session credentials through the client, never credentials stored inside cached data.
- No cached social authorization: the server always rechecks at mutation time. Confirmed mutations invalidate affected lists/search; uncertain results trigger authoritative reads before presenting success.

- Friends reads run on opening, returning to the screen (including app foreground return while active), and manual refresh, regardless of cache freshness. Confirmed local mutations refresh the initiating view. No social live subscriptions, polling, or request indicators elsewhere.

## Future Change Contract

A feature change includes its migration, generated contract update, repository/domain changes, tests, and documentation in the same review. Database-only changes trigger contract generation and client typecheck. Existing applied migrations are immutable; fixtures and application data changes are explicit. New dependencies require a decision ledger entry and a named replacement/use case.
