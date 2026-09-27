# Guest access #191: local validation and rollout

This is an operational checklist, not a release approval. Work in `C:\src\dong` on `187-harden-guest-room-access`. Preserve unrelated local changes. See [verification](verification.md) for evidence and blockers.

**2026-09-26:** Trusted ingress and direct guest RPC revocation are deployed to the explicitly authorized pre-release project. The demonstrated bypass is fixed on the tested origin. T049's fresh local install, full pgTAP run, and PostgREST direct-RPC checks have passed; remaining hosted release gates are in verification.md. Old guest clients must upgrade.

## Before implementation

1. Inspect `git status --short --branch` and latest guest SQL/functions. Confirm the exact Supabase target before any database action. Do not reset this existing local stack or a linked database; use a separately verified disposable stack for fresh migration validation.
2. Verify current Expo 57-compatible `expo-crypto` / `expo-secure-store` versions and rebuild the native development client after installing native modules. A Metro reload does not add native modules to an existing APK.
   This repo uses dynamic `app.config.ts`, so `expo-secure-store` is registered manually in its `plugins` array. After adding these modules, rebuild the Android/iOS development client; do not interpret a JavaScript-only reload as native validation.
3. Inventory all `public.*_as_guest`, guest snapshot, and old overloads plus grants; the migration must cover every callable path. Preflight duplicate current token hashes and stale/closed guest data before creating unique indexes.
4. Install one HMAC key named `dong_guest_abuse_hmac_v1` in Supabase Vault separately for local and hosted environments; never commit or print it. The admission RPCs fail closed while it is absent. An administrator can generate it inside the database with `SELECT vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'), 'dong_guest_abuse_hmac_v1');` after checking that name does not exist. Keep exactly one active secret under that name. Vault key rotation rekeys future counter identities (resetting effective quota history); use an approved maintenance window, monitor traffic, and do not reuse the old key. The hosted seven-day retention rule also requires a daily administrator job running `DELETE FROM private.guest_abuse_windows WHERE expires_at <= now();`. This job is not yet provisioned; complete T070 only after explicit user approval. Use Supabase Cron's Dashboard or `cron.schedule(...)`; do not insert or update `cron.job` directly.

## Local implementation gates

```powershell
npm run db:start
npm run db:test
npm run test:ci -- --runInBand
npm run lint
npx tsc --noEmit
```

`db:reset` is intentionally omitted: it is destructive. T049's fresh-install rehearsal has passed in a separate disposable CLI workdir using hash-matched current migrations/tests; the existing local stacks were not reset. The full run passed 50 pgTAP files / 721 assertions, and the fresh PostgREST stack denied direct execution of all seven guest RPCs. Independent local database sessions also verified quota concurrency, rotation replay, and the terminal-room race; hosted concurrency/performance remains open. The whole-repo TypeScript check has recorded typing failures; do not treat Jest/lint success as a clean typecheck.

The existing #191 web E2E scenario uses desktop/phone-sized Chromium mocks to check join, same-tab restore, completed final read, confirmed leave, expiry, access-loss copy, and browser-secret placement; it does not prove hosted authorization. It is historical coverage and was not run for the 2026-09-27 amendment, per the user's instruction. That amendment uses the manual browser/Android checks in T051 and T074, including timing the convergence/home-navigation checks against the five-second target. Before authoring mobile test code, explore the installed app with ARTEMIS as required by `AGENTS.md`.

## Hosted security and performance gates

1. Use a staging/throwaway project, or the explicitly user-authorized existing pre-release DONG target. After setting `SUPABASE_ANON_KEY` to the current project publishable key in the process environment, run `scripts/test-guest-caller-provenance.ps1 -StagingSupabaseUrl <explicit HTTPS URL> -ConfirmStaging -TrustedIngress` from the available authorized network origin. For the authorized existing target use `-ConfirmPreReleaseProject` instead of `-ConfirmStaging`. The script sends only nonexistent codes, changes forged forwarding headers each time, and outputs only response codes/counts. This validates header attribution from one origin; it does not assert network diversity. Check the quota configuration, gateway logs, and actual origin attribution as well; a threshold-shaped result alone is not proof. **If caller provenance fails or remains unverifiable, stop release**; the deployed trusted Edge ingress and direct-RPC revocation must remain in place.
2. Verify 21st join from one caller within five minutes is limited, and the 41st attempt against one normalized code is limited, without creating a participant. Verify unknown/closed/in-progress codes yield identical public result shape. Do not hammer production rooms.
3. Verify invalid snapshot spray is limited; eight invited guests can join; a valid guest polling once per second for at least two minutes remains below its quota. Load-test normal and unrelated limited traffic and record p95 join/refresh latency; require ≤5 seconds.
4. Sample client/server diagnostics and persisted events for raw bearer/full code leakage. Check all old RPC signatures and grants from the hosted API role, not only local SQL.
5. Inspect a physical Android install: confirm `ExpoCrypto` and SecureStore native modules load; join/reopen works; bearer is absent from AsyncStorage/ordinary unprotected app data. Use direct device evidence, not web-only tests. Check web `sessionStorage` restore and absence from `localStorage`/persistent AsyncStorage; document same-origin XSS limit.

## Rollout and recovery

- Run migration dry run and duplicate-hash preflight; deploy additive SQL first, then a canary client, then broad client rollout. Monitor `room_unavailable`, `guest_access_lost`, `rate_limited`, join/refresh latency, and legacy migration failures without storing credentials or full codes.
- Keep SQL signatures for internal dispatch only; direct guest API grants are revoked. Require a client upgrade. Never restore public execute grants as an old-client compatibility workaround.
- If canary breaks, prefer a forward SQL/client fix. Never roll back by restoring a replaced, expired, or left token. Existing event history remains untouched. Affected guest may rejoin only if room still accepts guests; otherwise explain access loss. Review pending leave records and expiry horizon before any database-level reversal.

## Expiry-aware roster delta

- Create the forward migration with supabase migration new guest_active_roster; do not edit the already-applied grant, trusted-ingress, completed-exit, or active-roster history migrations. It must add activeRoster without changing the existing participants payload.
- Run the focused pgTAP case for registered, valid guest, expired guest, and left guest in both host and guest snapshots. Verify the private eligibility helper is not client-callable, assignment feasibility and game start exclude only the expired guest, and an over-limit attempt stays limited after expiry. Verify a started game's participant list, assignments, scores, events, and caller/code abuse-window counts remain unchanged after expiry.
- Run the snapshot conversion and lobby component tests, then the web guest-room scenario. Confirm lobby roster and pre-start allocation lists consume activeRoster, while roomSnapshotToGameState continues consuming participants.
- For physical Android verification, use a fresh test room on the already-approved pre-release Supabase project, expire only that test guest grant, and confirm the next successful refresh removes the guest from the lobby roster without recording a leave. Do not run a traffic/abuse load probe as part of this roster check.
- Complete local migration dry-run and targeted pgTAP/Jest checks plus manual browser/Android verification before any hosted migration. Record the exact target and test-room cleanup state in verification.md; never substitute a browser mock for hosted authorization or device evidence.

## Migration compatibility and recovery

- Run the global duplicate-hash preflight against the exact target before deploy. Historical `IMP-` completed-room placeholders are re-randomized by the migration and future legacy imports by the insertion trigger; real duplicate active bearers still abort migration. Verify existing imported history and signed-in room reads after deployment.
- Deploy additive SQL first, provision the Vault key, reload PostgREST schema cache if necessary, then canary the upgraded client. Older clients calling original guest RPCs now fail closed. Deploy the `guest-room-access` function and upgraded client; require an app upgrade.
- If a rollout breaks, use a forward SQL/client fix. Never restore an expired, replaced, or revoked bearer. Affected guests may rejoin only while the room is joinable. Preserve immutable gameplay history and inspect pending leave/rotation records before any recovery action.

## Friendly room-ended acceptance

Use the Room-ended manual checklist in ../024-server-authoritative-gameplay/quickstart.md. Android is user-confirmed working; unreported subcases and browser timing remain pending. Detection and the five-second explanation are separate measurements. No E2E tests or agent manual tests were run.
