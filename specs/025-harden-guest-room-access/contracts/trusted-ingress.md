# Trusted guest ingress — 2026-09-26 amendment

User approved replacing spoofable direct admission with a trusted server entry point.

## Boundary

All seven guest operations use POST `/functions/v1/guest-room-access` with
`{ operation: <existing RPC name>, args: <existing RPC arguments> }`.
The function allows only those seven names and exact argument keys. It forwards
only freshly constructed service authentication and a server-set caller header;
never incoming Authorization, forwarding headers, or arbitrary RPC names.

Hosted caller identity is exclusively `CF-Connecting-IP`, provided on the managed
Supabase Cloudflare route. Missing, malformed, or multi-address identity fails
closed. No X-Forwarded-For, X-Real-IP, body identity, or local fallback is accepted.
The 2026-09-26 hosted diagnostic observed a real identity for normal/forged-XFF
requests and gateway HTTP 403 for forged CF-Connecting-IP. This is specific to
the managed deployment, not a guarantee for self-hosted/custom proxy routes.

The existing join/snapshot quotas stay atomic in Postgres. Database caller lookup
accepts only the server-set header and service_role JWT claim. Every overload of
the seven public guest functions loses PUBLIC/anon/authenticated execution and
is executable only by service_role (and administrators). Private guest validators
continue enforcing bearer, participant scope, room state and command idempotency.
Registered endpoints remain unchanged. The service key remains exclusively in
the Edge runtime; the dispatcher is not a generic privileged proxy.

## Input, errors and compatibility

Bound request bodies to 8 KiB, reject unexpected keys/operations, and do not log
request bodies, caller addresses, bearer values, or upstream error bodies.
Preserve successful RPC data and safe denial codes. Upstream infrastructure
failures produce a generic retryable failure, never a false access-loss result.
Responses use no-store and CORS for existing native/web clients.

No direct RPC fallback in the updated client. Old clients require an upgrade;
retaining old guest RPC grants would preserve the security bypass.

Confirmed guest leave in a joinable or in-progress room revokes the grant,
marks `left_at`, and appends one `participant_left` event without changing
settled gameplay. Host completion revokes all guest grants while preserving the
completed roster and event stream; a retry after revocation returns
`already_invalid`.

## Deployment and verification

Create a forward migration (do not edit the already-deployed migration), test
role permissions and identity selection, deploy the function, then apply grants
and ship the client. Verify forged XFF/real-IP cannot create new caller buckets,
CF spoof attempts are denied, the 21st join is limited, and all seven direct RPC
paths reject API roles. Never reset existing hosted data. Continue the outstanding
second-origin, valid-eight-guest, native and broader acceptance gates separately.

Sources: https://developers.cloudflare.com/fundamentals/reference/http-headers/
and https://supabase.com/docs/guides/database/debugging-performance .

## Friendly termination outcome

After existing quotas, snapshot returns exactly { "ok": false, "code": "room_ended" } for the current token of a guest valid at host completion/closure. No room data or authorization is returned. Unknown, replaced, previously expired and left tokens retain generic denial. Direct API-role execution remains revoked; existing trusted ingress forwards the envelope. A nullable guest_revocation_reason on the participant uses the existing current token hash; no new bearer, receipt or backfill. History and quotas remain intact.
