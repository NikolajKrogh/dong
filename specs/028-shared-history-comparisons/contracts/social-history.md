# Social History Contracts

Proposed Supabase RPC names. Actor always derives from auth.uid(); never input. Private definer implementations enforce eligible actor and current target/relationship/blocks on every invocation, including direct private calls. Public invoker wrappers, empty search_path, qualified objects, explicit restricted EXECUTE. Preserve underlying game/table RLS.

## get_social_history(target_account_id uuid, page_size integer=20)

Distinct accepted friend, no bilateral block. Within this pair response, owner access means the viewer projection; self-target pair reads remain invalid. The separate actor-only personal endpoint is `get_personal_history_stats()` and is specified below. Returns {scope:'all_time_completed_online', viewer:AccountStats, target:AccountStats, shared:SharedStats, games:{items:SharedGame[],next_cursor:string|null}}. No separate-game IDs/dates/participants/links/timeline. Complete aggregates across all eligible records, independent of pages. Zero shared games succeeds with overall stats and empty shared items/null averages.

## list_social_shared_games(target_account_id uuid, cursor text=null, page_size integer=20)

Same per-call authorization. Returns {items:SharedGame[],next_cursor}. Stable descending (completed_at,session_id), page size 1–50. Invalid size/cursor returns invalid_input. Cursor is not authorization; deduplicate session IDs. New completions reconcile on refresh, no cross-request snapshot claim.

## list_social_shared_timeline(target_account_id uuid, cursor text=null, page_size integer=50)

Same authorization; {items:TimelinePoint[],next_cursor}, descending tuple, max 100. Lazy More statistics loads pages; explicitly label partial chart while more remain, sort fetched points chronologically. Full summary does not derive from timeline pages.

## get_history_coplayer_context(target_account_ids uuid[])

At most 100 distinct registered targets, each evidenced in viewer-authorized online personal history, including valid departure records where necessary for Players discovery. Return minimal CoPlayerContext/action fields. Unproven IDs cannot disclose profile information; guests/local keys never submitted. Batch visible rows rather than per-row reads. Nonfriends receive existing permitted actions, blocked/unavailable targets none.

## Errors and parsing

authentication_required, username_required, invalid_input, target_unavailable, comparison_not_allowed. Unknown/deleted/nonfriend/blocked errors never disclose payload or block direction. Transport failures map to connection message/Retry; invalid JSON/IDs/numbers/scope/cursors fail closed. No partial stale data fallback. Bundle authorization/aggregates share a statement snapshot; pages reauthorize.

Test anonymous/function grants, forged inputs, direct private invocation, guessed IDs/cursors, bilateral block, revocation between pages, deleted actor with stale JWT, and raw separate-game access. Friend aggregate permission never broadens underlying detail access.


## Personal totals and Stats presentation — 2026-10-10

get_personal_history_stats() accepts no arguments and returns the AccountStats shape for auth.uid() only. It uses the same canonical completed-online eligibility and preserved departures as the viewer aggregate in get_social_history. Zero games returns count/total zero and null average. No friendship is required; anonymous access is denied. Separate-game records are never returned.

History → Stats consumes the owner aggregate independently of accepted-friend reads, loads friend summaries automatically and expands aligned overall/shared totals inline. Games/timeline APIs remain compatible with the existing direct route; the primary Stats dashboard does not display individual games or timelines. Friend payloads remain hidden pending each fresh permission check or after read failure.
