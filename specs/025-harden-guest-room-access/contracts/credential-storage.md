# Credential Storage and Client State Contract

## Platform adapter

`platform/guestCredential` exposes `generateToken()`, `read()`, `write()`, `clear()`, and `stageRotation()` with typed failure modes. Native implementation uses asynchronous Expo Crypto and SecureStore; web uses secure-context Web Crypto and `sessionStorage`. The shared hook never imports platform-sensitive modules directly. No insecure fallback is permitted. On web, browser-session/tab restoration is best effort; browser session cloning and same-origin script access remain residual risks and should be explained in user-facing help.

## Restore and migration

1. Read protected/session record, including pending rotation or leave. If pending rotation, retry exact operation before attempting snapshot with either token. If pending leave, retry leave before displaying a joined room.
2. If no record, read old AsyncStorage key once and **remove it immediately**, before any network wait. Hold the parsed grant only in memory while validating via current snapshot RPC. Only on confirmed validity write it to protected/session storage. On rejection or transient network failure, do not persist the plaintext again or treat it as validated; show rejoin/access-lost guidance. An offline upgrade may sacrifice automatic restore, which is safer than leaving the old bearer in unprotected storage.
3. On confirmed expired/revoked/closed response clear local bearer; on transport error retain protected bearer for retry without misreporting access as revoked.

## Renewal and leave

- Renew proactively before expiry while online, not on every refresh. Save new token + operation ID as pending before RPC. After confirmed response, atomically promote local current token; on uncertain response keep pending record and retry. A confirmed invalid old/new combination clears grant and explains recovery. Never allow the hook to poll with the old token after confirmation.
- Leave stops normal room interaction immediately. If server confirms revocation or already-invalid status, clear local bearer and show departed/access-lost state. If offline, retain bearer only in protected/session pending-leave storage to retry; do not show room data as if still joined or call it revoked. A browser closed before retry may lose pending state, with 48-hour expiry as the bounded fallback.
- Client error messages contain codes/copy only, never raw bearer or full code. Scrub request payloads from logging and crash reporting.

## Unit contract

Test absent crypto, rejected secure-store writes, browser close/new session, AsyncStorage migration success/invalid/offline, pending rotation crash/restart/uncertain response, pending leave success/offline/restart, expiry, and no snapshot-on-old-token after rotation. Native module presence must be tested in an installed build, not inferred from Jest mocks.
