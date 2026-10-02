# Data Model and State Ownership

Design only. All database changes are new migrations; applied migration history remains intact.

## Accounts

Retain `accounts.id` and its existing authentication/ownership relationship. Rename `preferred_display_name` to `username` throughout SQL consumers and application contracts. Add `username_key text COLLATE "C"` with a unique constraint. Null username/key means incomplete onboarding; no social access. Both must be null together. Existing non-null account usernames cannot be cleared to bypass eligibility or release a name accidentally.

A private BEFORE-write trigger normalizes username display spelling and always derives the key, including direct writes. Reject invalid values, enforce normalized display length 3–30 code points containing only Unicode letters, numbers, and underscores, and permit same-account capitalization changes. The unique constraint arbitrates concurrent claims; map conflicts to `username_unavailable`. A derived key may exceed the username length limit after lowercase conversion. Ordinary clients must not update account IDs, created timestamps, or the derived key; narrow column grants or use the username command. Account bootstrap may insert only its own identity with no username.

### Exact normalization contract

1. Reject Unicode control characters U+0000–001F and U+007F–009F, including tabs/newlines. No line-breaking names.
2. Trim surrounding Unicode space separators from this explicit set: U+0020, U+00A0, U+1680, U+2000–200A, U+202F, U+205F, U+3000. Internal spaces remain invalid; no collapsing into a valid name.
3. Normalize display spelling to NFC; preserve capitalization. Require 3–30 Unicode code points, each in Unicode general category Letter (L), Number (N), or literal underscore. Reject other punctuation, remaining combining marks, controls, line separators, and format characters including joiners, zero-width space, and BOM. Validate display spelling before deriving the lowercase key; key expansion is not user input.
4. Key = NFC(concatenation of each display code point independently lowercased with explicit ICU root collation `pg_catalog."und-x-icu"`)). This avoids word-context casing changing a prefix. Store/compare the key bytewise. Prefix search calls the same private function; measure the 3-character minimum before deriving the key. Prefer PostgreSQL `starts_with` for literal prefix matching; use escaped LIKE only if query-plan evidence justifies it. Filter self, eligibility, and both block directions before limiting to 20 results ordered by canonical key. Verify the query plan.
5. Frontend validation is advisory. Send raw user input; derive server identity/availability only from the committed response. Cache keys may include raw search input; duplicate equivalent search cache entries are harmless. Never implement a competing JavaScript security decision.

| Inputs | Expected |
|---|---|
| `Nikolaj`, ` nikolaj `, `NIKOLAJ` | One key |
| `Anne  Marie`, `Anne Marie`, `Anne-Marie`, `Anne!` | Reject |
| `søren_7` | Valid |
| `Åse`, decomposed A + ring + se | One key |
| `SØREN`, `søren` | One key |
| `Soren`, `Søren` | Distinct |
| `Straße`, `STRASSE` | Distinct: lowercase is not full casefold |
| `İda`, `ida` | Distinct under root lowercase (`İ` lowers to i + combining dot) |
| `Σaa`, `σaa`, `ςaa` | First two share a key; final sigma `ς` is distinct; lowercase each code point independently |
| Greek prefix `ΑΒΣ` and username `ΑΒΣΑ` | Prefix matches; no whole-word final-sigma conversion |
| `Ⅷ`, `²`, `٧` within a valid-length name | Accept Number categories Nl, No, Nd |
| 3 or 30 allowed code points | Valid |
| empty, spaces only, tabs/newlines, 2 or 31 code points | Reject |

Exact L/N validation uses generated, version-pinned UnicodeData.txt category ranges as private read-only reference data in the migration. A build-time generator expands First/Last ranges, merges adjacent allowed code points, and records source URL, version, checksum, and license. Pin Unicode 16.0.0 for this initial artifact; newer releases require an explicit reviewed migration. Validate server code points against those ranges, not locale-dependent POSIX alnum. Include supplementary-plane letters and all three Number categories in tests. Regeneration from the pinned source must produce no diff. No runtime download, database extension, or application framework is needed.

UTF8 encoding, ICU availability, and collation version are setup gates. Run this corpus on local and target environments. Database/ICU upgrades require collision analysis and canonical-key recomputation. No silent fallback to a different algorithm.

## Friendship

Reuse the existing relationship foundation, adding request-generation identity instead of inventing separate pending/accepted tables.

| Field | Meaning |
|---|---|
| `id` | Stable pair-record UUID |
| `requester_account_id`, `addressee_account_id` | UUID foreign keys to accounts; distinct |
| `status` | Existing pending / accepted / declined / canceled values |
| `request_id` | UUID identifying the current request generation; changes only for a fresh request |
| `requested_at`, `responded_at`, timestamps | Server-authored transition timestamps |

Retain unordered-pair uniqueness and participant/status indexes. There is one pair record regardless of request direction. Both participants must currently exist and have completed name setup. Requests and decisions operate on account IDs, not usernames.

| Current state | Actor/action | Result |
|---|---|---|
| Absent | Either sends, no block | Pending, actor is requester, fresh request ID |
| Pending | Requester sends again | Same pending request |
| Pending | Recipient sends | Same incoming pending request; no implicit acceptance |
| Pending | Recipient accepts/declines with matching request ID | Accepted/declined |
| Pending | Requester cancels matching request ID | Canceled |
| Accepted | Either sends | Existing friendship; no new request |
| Accepted | Either unfriends matching request ID | Canceled; revoke friendship-only access without blocking |
| Declined | Either sends a fresh operation, no block | New pending generation immediately; actor is requester |
| Canceled | Either sends, no block | New pending generation |
| Any | Either blocks | Actor-owned block exists; pending/accepted becomes canceled |
| Any | Owner removes own matching block generation | Block removed; no relationship restoration |

Identical retried decisions return their recorded disposition without applying again. Different decisions or request generations cannot overwrite newer state. Include Cancel request on outgoing pending entries and Unfriend on accepted entries. The shared cancellation command checks expected status as well as request ID: a pending cancellation racing with acceptance must conflict if acceptance wins, rather than silently unfriend. Either action permits a subsequent fresh request when unblocked.

## Directional Block

`account_blocks` has `(blocker_account_id, blocked_account_id)` primary key, a unique `block_id` UUID for the current block generation, and server `created_at`. Foreign keys cascade on deletion; self-blocks are rejected. Both directions can coexist. Removing a block requires its current `block_id`, preventing a delayed first-time unblock from deleting a newer reblock.

The owner can read their blocks and the minimal target name needed to manage them. The target cannot inspect the block or its owner through social lookup. Applying a protective block is allowed even if the opposite block already exists; the prohibition on blocked interaction refers to friendship/search/acceptance, not the right to create one's own block or manage it.

## Private Social Operation Receipts

`private.social_operation_receipts` holds actor UUID, operation UUID, operation name, target UUID, canonical input payload, and completed outcome. Primary key `(actor_account_id, operation_id)`. No client reads or direct writes. Actor/target deletion cleans dependent receipts. Do not store email, tokens, or raw transport credentials.

Reserve/check the operation ID inside the same transaction, then take the shared pair lock, reread state, authorize, mutate, and complete the receipt. Concurrent duplicates wait on the unique receipt row. Any error rolls back both reservation and effects, so there are no committed half-finished receipts to recover. Changed input with a reused key is an idempotency conflict. Successful replay returns `replayed=true` with the original disposition and freshly authorized current relationship projection; it never reexecutes the mutation or restores stale state. Clients refetch current lists after success.

This small ledger is scoped to social mutations, not shared with Java gameplay commands. Keep receipts for the lifetime of the involved accounts in v1; cleanup/expiry would require a separately specified retry horizon.

## Transaction and Access Boundaries

- Use the same transaction-scoped advisory lock for the canonical sorted account pair for send, respond, cancel, block, and unblock. A namespaced stable hash collision only serializes unrelated work; it must never substitute for authorization. Document lock order and avoid multi-pair transactions.
- Re-read existence, current identity, both block directions, and relationship state after locking. Database foreign keys/locks also make account deletion races fail atomically.
- Deny anonymous and authenticated direct writes to friendship/block/receipt tables. Do not leave old permissive update grants or policies as an alternate path.
- Expose minimal authenticated wrappers; privileged implementation functions live in a private schema with fixed empty search_path and qualified references. Restrict EXECUTE independently of table RLS.
- Keep accounts owner-readable rather than broadening SELECT for search. Narrow discovery and social-list functions return only their specified projections.
- One private `are_accounts_friends` predicate means accepted AND no block in either direction; use it for all friend-only reads. Session membership remains an independent authorization route for game history.

## Removed Objects and State

Remove unused `profiles` and its policies/grants after full dependency inspection. No parallel editable name survives. Remove active legacy import functions/state/ledger and `get_history_import_links` only after the current history repository no longer calls them; retain original migration files. Test-data imported records need not be backfilled for production, but the cleanup migration must handle their dependencies explicitly rather than using blind CASCADE drops.

Historical participant-name fields remain snapshots. Audit every `preferred_display_name` reference: current account projections become username; captured historical payload fields are not globally text-replaced.

## Client Ownership

- Auth provider: resolved identity/session and an identity generation; triggers shared private-cache lifecycle.
- Query: in-memory account-scoped cloud history and social data. Pass cancellation through all requests/pages. Late mutations are fenced to their starting generation.
- Zustand: local gameplay, local history, preferences. No duplicate authoritative friends list or cloud cache.
- Features: reusable repositories and pure domain transformations; UI only renders state and invokes named operations.
