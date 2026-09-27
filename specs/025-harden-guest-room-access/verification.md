# #191 verification — 2026-09-20

**Prior #191 closeout (2026-09-27):** The original task set was closed at the user's direction. T041, T053, and T055 were user-confirmed; this does not claim Codex independently reran the hosted canary, collected p95 latency figures, or issued a release certification. The later guest-departure amendment has T071–T073 implemented and T074 still open for manual browser/Android verification. Network-origin diversity remains outside T040 scope. Historical evidence below retains the scope and status recorded when each check was performed.

## 2026-09-26 expiry-aware roster regression (open baseline repro)

- **Platform**: Jest/react-test-renderer component coverage; not yet a physical-device result.
- **Repro**: Render GuestJoinLobby with Expired Guest present in snapshot.participants but absent from snapshot.activeRoster.
- **Expected**: The live guest roster omits Expired Guest while the participant projection remains available for game/history hydration.
- **Actual**: GuestJoinLobby renders “Expired Guest · guest” from participants, ignoring the activeRoster field.
- **Evidence**: The targeted Jest run fails at __tests__/components/guestJoin/GuestJoinLobby.platform.test.tsx on the assertion that the expired guest is absent. The companion snapshot test also fails because roomSnapshotToActiveRoster has not been implemented yet. This is the expected pre-fix baseline; resolve after implementation and keep physical Android evidence separate.
- **Database baseline**: The targeted local pgTAP run reports 8/19 failures in 309_guest_active_roster.test.sql: the helper/projection are absent, assignmentPlan counts 3 rather than 2, expired allocation does not raise invalid_assignment, and game start retains assignments for the expired guest. The independent 310_guest_expiry_quota_preservation.test.sql passes 8/8, confirming expiry currently does not reset caller/code counters.

## 2026-09-26 trusted-ingress correction

- User approved the replacement boundary and changes to the existing pre-release project. Deployed forward migration `20260926124005_trusted_guest_ingress.sql` after a dry run showing only that migration, and `guest-room-access` Edge function version 3. No reset or deletion.
- All seven guest operations now use an allowlisted, size-bounded gateway. It validates the project public API key, uses only managed `CF-Connecting-IP`, and creates fresh server-authenticated database headers. SQL accepts caller identity only under `service_role`; all overloads of the seven guest RPCs deny direct anon/authenticated execution. Missing identity fails closed; no forwarding-header fallback.
- Hosted: 22 requests with independently forged X-Forwarded-For, X-Real-IP and X-Dong-Guest-Caller values shared exactly one caller bucket with count 22. Requests 1–20 returned `room_unavailable`; 21–22 returned `rate_limited`. Forged CF-Connecting-IP was rejected by the managed route with HTTP 403. Direct HTTP calls to each of the seven guest RPCs returned HTTP 401 / PostgreSQL 42501. Counts remained 21 participants and 57 gameplay events.
- Version 3 accepts the current publishable key with the client's Bearer header: invalid-token snapshot returns the safe `guest_access_lost` result. Missing public key returns 401. Unknown upstream errors are redacted; known gameplay errors remain actionable; successful empty pick-write responses remain successful.
- At trusted-ingress deployment time: **105 Jest suites / 610 tests passed; 48 database files / 687 assertions passed**. The later lifecycle and roster assertions are included in the updated database result below. These results do not replace hosted multi-guest canary/performance testing.
- Old installed clients that call guest RPCs directly now fail closed and require the updated client. No application release, git commit or push was performed.
- Browser gateway regression: **20/20 guest scenarios passed** (10 phone-sized + 10 desktop Chromium, one worker, 2.2 minutes). The first rerun exposed a missing mock gateway route; wiring it to the existing operation handlers corrected that fixture defect. Final helper unit rerun: 10/10. These scenarios exercise the new envelope through mocks, not a hosted device journey.

The following deployment narrative records the initial failure that prompted this correction, not the current implementation.

## 2026-09-26 continuation and hosted deployment

- Target verified: DONG `qccvlhblytuedgmlqfef`, healthy PostgreSQL 17.6, migrations 001–042 before deployment. Preflight: 13 rooms (7 closed, 4 completed, 2 in progress), 21 participants, 7 guest rows without `left_at`, zero duplicate guest-hash groups. No reset or deletion was performed.
- CLI deployment preview contained only `20260920095616_harden_guest_room_access.sql`. A full transactional rehearsal initially failed with PostgreSQL 55006 (pending deferred participant constraint events before ALTER TABLE). Added `SET CONSTRAINTS ALL IMMEDIATE` to run those checks during the backfills. The second rehearsal succeeded and rolled back; the new table remained absent and all 21 participants remained.
- Provisioned exactly one database-generated Vault HMAC secret without printing it. Applied the migration through the linked CLI successfully. Post-deploy checks: 21 participants, 57 gameplay events, zero unbackfilled active guests, zero API-role execute grants on private guest helpers, and no authenticated SELECT access to the guest verifier column.
- **T040 failed conclusively from the first origin:** 22 anonymous join probes with distinct forged forwarding addresses all returned `room_unavailable`, never `rate_limited`. A server-side HMAC comparison, returning counts only, confirmed 22 caller buckets matching the 22 forged `198.51.100.2`–`.23` addresses, each counted once. Thus the first forwarded address is client-controlled in this deployment. A second origin cannot turn this demonstrated bypass into a pass. No probe created a participant.
- **Required next design:** trusted ingress for anonymous admission, with direct public RPC bypass revoked and clients routed through that ingress. Do not merely select another forwarding-header position without proof. T040, FR-011/012, and release acceptance remain failed. The deployed credential expiry/rotation/storage work does not establish effective caller quotas.
- Android build: backed up generated native source and package/config files to `C:\Users\nikol\AppData\Local\Temp\dong-native-191-20260926-142948`. Expo regenerated Android; file-hash comparison found only `app/src/main/AndroidManifest.xml` changed and no backed-up source files missing. Gradle `:app:assembleDebug` succeeded in 4m32s. The APK was later installed in place and the physical smoke passed; see the 2026-09-26 retest below.
- Corrected asynchronous token mocks and typed module mocks in the guest hook tests. Focused rerun: 2 suites / 24 tests passed. Whole-repo TypeScript check still fails; no clean typecheck claim.
- Optional pre/post Spec Kit commit hooks were skipped; nothing was committed or pushed to Git. Hosted daily quota cleanup is not yet provisioned.

## Evidence obtained

| Surface | Result | Boundary of evidence |
| --- | --- | --- |
| Local Supabase | `npx supabase test db`: 48 files, 694 assertions passed. The focused lifecycle test passed 18 assertions, including departed-guest roster exclusion. `npx supabase db lint --local --schema public,private --level error --fail-on error` previously reported no errors. Coverage includes grant foundation, join retry, rotation, previous-hash cross-room reuse denial, lifecycle, quotas, identical unknown/started/completed/closed failure shapes, bounded malformed input, an expanded invalid/replaced/expired/left access matrix, registered wrapper preservation, internal-fault propagation, eight guests sharing one caller, and 60 valid refreshes inside a configured minute bucket. | The test ran on the existing local database; migration history was not a fresh-install rehearsal. This was not a true concurrent burst. Hosted Vault provisioning is separate. |
| Jest | `npm run test:ci -- --runInBand --silent`: 104 suites, 597 tests passed. | Adapter tests mock native modules; they do not establish that the installed APK contains ExpoCrypto/SecureStore. |
| Web browser mocks | Guest feature: 20 desktop/phone-sized Chromium cases passed, including join, restore, browser-session storage, renewal, expiry, confirmed leave, completed/closed read behavior, and generic unavailable copy. | Playwright routes simulate RPCs and room transitions. No hosted server authorization is inferred. |
| Lint | `npm run lint`: exit 0, 0 errors, 398 warnings across the repository. | Warnings remain; no auto-fix was run. |
| TypeScript | `npx tsc --noEmit --pretty false`: fails in test typing (including modified guest hook tests) and non-guest `supabaseClient.ts` RPC `.overrideTypes` signatures. No diagnostics were found in the new production guest paths in the scoped check. | Whole-repo typecheck is not green; not all test-file errors have been isolated against the baseline. |
| Physical Android | Huawei CLT-L29 (`WCR0218C11000221`): rebuilt APK installed in place; joined a hosted test room; dismissed/reopened the active guest room; verified AES-encrypted SecureStore and no plaintext/AsyncStorage bearer; expiry removed local access and showed recovery copy; confirmed leave revoked the grant; cold relaunch returned Home without a guest session and preserved the existing 2-player/12-match local game. | One physical device and the pre-release hosted project only. Screenshots and hosted data are recorded in `android-verification.md`. |

Two attempts at the default full `npm run test:e2e` suite were inconclusive: the local Expo/Node web server became unresponsive under default parallelism, then showed a V8 memory crash around the midpoint with two workers. A one-worker desktop run passed 58 cases before the same server failure; the remaining ten failed at `page.goto` with `ERR_CONNECTION_RESET`/`ERR_CONNECTION_REFUSED`, not guest assertions. Retrying those ten against a fresh server passed all ten. The phone profile passed 40 app-shell/configuration/host cases, ten isolated guest cases, and 18 remaining cases across fresh-server batches. Thus **all 68 desktop and all 68 phone-profile cases passed across batches**, but the default combined command is not healthy in this environment. These are browser mocks, not hosted two-device or native evidence.

## 2026-09-26 physical retest and active roster correction

- Reproduced a mismatch between `leave_room_as_guest` and the shared snapshot: a successfully departed guest remained in the host and guest participant lists. The live hosted `private.build_guest_room_snapshot` definition had lost its `left_at IS NULL` predicate when migration 038 rebuilt it for player-picked support.
- Added forward migration `20260926143559_active_guest_roster.sql` and an 18th lifecycle assertion. The assertion failed against the old local function (2 roster entries instead of the host-only 1), then passed after applying the correction. Full local database run: **48 files / 694 assertions passed**.
- Dry run listed only `20260926143559_active_guest_roster.sql`; it was deployed to the same pre-release project. Hosted snapshot and web host then omitted all test guests with `left_at` set. Function execution remains denied to `anon` and `authenticated`, and allowed to `service_role`.
- Physical smoke T052 passed: Android successfully left a completed room without changing its seven events; joined the fresh room as Android191; expiry showed the recovery message and removed its protected credential; rejoined, closed the guest card, and reopened the same active identity from Home as ReopenTest; then confirmed leave set `left_at`, revoked the grant, and removed the protected credential. A normal app relaunch after departure returned Home without a guest session while preserving the unrelated local 2-player/12-match game. SecureStore held AES ciphertext only; AsyncStorage held no guest credential entries.
- The roster correction filters departed guests. The deliberately expired Android191 test participant had no `left_at` because expiry was simulated directly, so it remains in the roster; behavior for expiry-only participants is still a product-policy question. No unrelated participant data was edited.
- At the time of this physical retest, T049 remained open because the database run used the existing local database. The later disposable fresh-install rehearsal now closes T049 (see the T049 section below). T053, T055, and the hosted security/release gates remain open.

## Security audit samples

- Local privilege inventory found no `anon`/`authenticated` execute grants on guest `private.*` helpers and no API-role access to `private.guest_abuse_windows` or `private.guest_abuse_config`. The access-matrix test found and closed an inherited `authenticated SELECT *` grant on `public.participants`; direct signed-in reads now have only non-credential columns. Existing registered snapshot tests still pass. Historic non-guest private account/history grants remain as pre-existing scope.
- pgTAP inspects immutable `participant_joined` event payloads for raw old/new bearer values and the full test code; none appeared. Rotation does not echo the new raw bearer. The client test injects a server error containing both bearer and code across all seven guest RPC methods and verifies the resulting error does not contain either. Browser assertions check URL, durable local storage, and visible page against the session bearer. These are local samples, not a hosted log/crash-report audit.
- The security/error-handling review removed broad snapshot exception swallowing. A rolled-back pgTAP fault injection confirms an internal server fault is propagated rather than mislabeled as an invalid grant (which would otherwise clear valid local access). The same review bounded untrusted join/snapshot inputs while keeping caller admission for malformed joins. SQL uses bound PL/pgSQL values, with no dynamic user-input execution; guest UI uses ordinary React text rendering rather than raw HTML injection.
- Abuse counter keys are HMAC-SHA256 digests under a Vault-held key; local assertions reject plaintext caller/code/token and exercise a committed over-limit counter. Thresholds are bounded in `private.guest_abuse_config`; rows have a seven-day expiry marker and index. The current local stack has no `cron` schema, so actual deletion requires the administrator maintenance job documented in [quickstart](quickstart.md) and is not yet proven to meet the retention bound.
- Legacy imported completed rooms previously reused deterministic synthetic guest hashes across accounts. The migration re-randomizes existing `IMP-` completed-room placeholders before the global-uniqueness preflight and the insert trigger does so for future imports; the full legacy import suite passes again. Genuine duplicate active guest hashes still abort migration.

## Unproved or incomplete gates (historical snapshot before user closeout)

1. **Caller provenance (T040 complete at user-approved scope):** The original forwarded-address bypass was reproduced and corrected as recorded above. One hosted network origin passed forged-header and direct-RPC checks after trusted-ingress deployment. The user removed the independent second-network check from T040; network diversity is not verified or claimed. Keep the managed Cloudflare route as a deployment prerequisite; revalidate any custom-domain/proxy change.
2. **Concurrency and fresh migration:** Independent local database sessions have verified the atomic over-limit counter, copied-token rotation replay, and room-close/rotation serialization (see the local multi-session evidence below). T049's fresh migration rehearsal and PostgREST schema-cache/direct-RPC check are now complete on a separately verified disposable stack (see below); hosted traffic concurrency remains part of T041/T053. The existing local stacks were not reset.
3. **Hosted traffic/performance:** No canary eight-guest traffic, 1 Hz polling over time, invalid spray, gateway log/diagnostic inspection, or p95 join/refresh latency measurement. SC-006/007 remain unproved hosted.
   Provision and verify the daily abuse-window cleanup job there as well; an expiry timestamp alone does not delete records.
4. **Old-client rollout:** Direct guest RPC execution is revoked. Old binaries must upgrade to the gateway client; there is deliberately no insecure compatibility fallback. Validate the upgrade experience before release.

FR-001–010, FR-013–019 have local automated coverage in varying depth, but are not accepted as end-to-end release results until the gates above pass. FR-011/012 caller provenance passed from one hosted origin; network diversity is not part of the revised task scope. Hosted canary/performance evidence for SC-005/007 and the remaining release gates are still open, so SC-001–010 are not all satisfied. Never mark this feature release-ready from local green tests alone.

## 2026-09-26 physical expiry-aware roster verification (T069)

- On the approved pre-release room, a newly joined Android guest appeared in the host's live roster and in both snapshot projections before expiry (`participants`: 4; `activeRoster`: 3).
- After simulating expiry for only that test participant, the host's next refresh omitted it. The hosted snapshot still retained all 4 `participants` but exposed only 2 `activeRoster` entries; the expired test guest remained in participant history with `left_at` null. Its event history had one join, no leave, and the room retained 7 gameplay events. The room remained joinable.
- The physical Huawei displayed the expected expired-access recovery copy after refresh. Screenshot: [android-expired-active-roster-20260926.png](evidence/android-expired-active-roster-20260926.png). This is direct physical-device evidence, separate from browser mocks.
- During diagnosis, ADB text injection of R-key sequences caused an Expo development-client reload (`ReactHostImpl.getOrCreateReloadTask`) without a fatal exception. A no-R guest name remained stable and completed the join, isolating the earlier Home return to the dev-client/ADB input path rather than guest authorization. Details are in [android-verification.md](android-verification.md).
- T069 is complete. This does not close the independent-origin, true-concurrency, hosted canary/performance, cleanup-job, or old-client rollout gates listed above.

## 2026-09-26 local expiry-aware roster regression closure (T062–T068)

- The source checkout and isolated database-test workspace matched across all 98 migration and database-test SQL/include files; the existing isolated stack was not reset.
- Full local pgTAP suite: **50 files / 721 assertions passed**, including atomic-window and access-matrix security regressions (T033, T042), plus active-roster and expiry/quota-preservation regressions (T062–T063).
- Focused Jest: **2 suites / 11 tests passed** for snapshot projection and guest live-roster behavior (T064).
- Focused Playwright acceptance: **2 passed**, phone-sized and desktop Chromium profiles, covering host/guest refresh, hiding the expired guest from both live rosters, and preserving the history/game projection (T065).
- Local migration dry-run reported the database up to date with no pending migrations. T066–T068 are complete for this local slice.
- The existing redacted event/error samples and privilege inventory in the security-audit section, together with the passing matrix tests, close T048 locally; this does not claim hosted log/crash-report inspection.
- At the time of this T062–T068 slice, these results did not establish a fresh-install rehearsal or true multi-connection race behavior. T049 and the local multi-session race checks are now documented below; a second independent hosted origin, hosted traffic/performance, retention-job execution, and old-client rollout remain open. Release status remains not approved.

## 2026-09-26 local multi-session guest security checks

- Added `scripts/test-guest-concurrency.mjs`, restricted to a loopback PostgreSQL connection and the DONG guest-access migration. It runs independent `psql` sessions and cleans its temporary fixture, HMAC quota rows, and local-only Vault key.
- Concurrent quota burst: **24 sessions** against one caller bucket produced exactly **5 accepted / 19 limited**; the committed counter was **24**.
- Copied-token rotation: a second independent session was observed waiting on the advisory lock; after the first rotation committed, it returned an exact replay. The participant retained one join event and exactly the expected current/previous hash tuple.
- Terminal race: a separate renewal session was observed waiting on the room row lock while the room moved to `closed`; after commit, renewal returned `room_unavailable` and did not replace the current grant.
- T020, T021, and T032 are complete for the tested local cases. The local concurrency portion of T041 is covered, but T041 remains open for the hosted eight-guest canary and sustained 1 Hz refresh/latency checks.
- Post-run local cleanup check found no probe auth user, room, abuse-window row, or temporary Vault key. This does not substitute for hosted concurrency or performance evidence.

## 2026-09-26 disposable fresh-install and PostgREST verification (T049)

- Created an isolated Supabase CLI workdir at `C:\Users\nikol\AppData\Local\Temp\codex-dong-guest-fresh-20260926` with project ID `dong-guest-fresh-20260926` and unused local ports. No linked-project metadata was copied; neither existing DONG stack was reset or modified.
- Copied the current checkout's 47 migration files and 51 Supabase test/include files into that workdir and SHA-256 compared each copy; zero mismatches. A first `supabase start` created a fresh PostgreSQL 17.6.1.171 database and applied migrations 001–042 plus all five timestamped guest-access migrations in order. `supabase migration list --local` showed all 47 migrations applied.
- Ran `npm run db:test -- --db-url postgresql://postgres:postgres@127.0.0.1:56322/postgres?sslmode=disable` against the isolated database: **50 pgTAP files / 721 assertions passed**.
- PostgREST returned HTTP 200 with an OpenAPI 2.0 document from `/rest/v1/`. Using the local anonymous key, direct requests to all seven guest RPC endpoints returned HTTP 401 / PostgreSQL `42501` (`insufficient_privilege`): join, snapshot, leave, rotation, picks, score, and drink. This confirms the freshly migrated API schema resolves the endpoints while preserving the direct-RPC authorization boundary. No key or bearer was recorded.
- **T049 complete.** This proves fresh local migration and local PostgREST behavior only; it does not close the second hosted origin, hosted canary/performance, retention scheduler, or old-client rollout gates.

## 2026-09-26 current-checkout regression run

- `npm run test:ci -- --runInBand --silent`: **106 Jest suites / 613 tests passed**, including guest ingress, credential storage, session lifecycle, client RPC, and roster projection coverage.
- `npm run db:test` against the repository's currently running local `dong` stack ran 50 files / 721 assertions but **failed 8 assertions in `309_guest_active_roster.test.sql`**. Failures show the active-roster helper/projection is absent from that database; other database files passed.
- Read-only migration inspection confirmed the five timestamped guest-access migrations are still pending on this local stack, and `supabase db push --local --dry-run` listed exactly those five. No migration was applied and the existing local database was not reset or modified.
- This is a stale local-schema verification failure, not evidence that the new migrations pass on that stack. The separately created, hash-matched disposable fresh database remains the authoritative full migration result for T049 (**50 files / 721 assertions passed**). Re-run `db:test` against a fresh/migrated disposable database; do not reset or migrate the existing local stack solely to make this check green.

## 2026-09-27 guest hook typecheck follow-up

- Fixed TypeScript narrowing in the two guest hook tests by capturing the render result with a definite-assignment test variable, and gave guest RPC mocks their exact method signatures plus typed defaults for intentionally partial RPC stubs.
- Focused guest hook rerun: **2 suites / 24 tests passed**. Full `npm run test:ci -- --runInBand --silent`: **106 suites / 613 tests passed**.
- `npm run lint`: exit 0, **0 errors / 399 warnings**.
- `npx tsc --noEmit --pretty false` still exits 2 with **102 repository-wide diagnostics**. The focused audit now finds no diagnostics in `__tests__/hooks/useGuestRoomJoin.test.ts`, `__tests__/hooks/useGuestRoomSession.test.ts`, `hooks/useGuestRoomSession.ts`, or `utils/guestRoom.ts`.
- The remaining guest-ingress file diagnostics are from running the Expo root TypeScript config over Deno code: the root config includes all `**/*.ts` files but does not provide Deno globals or allow `.ts` import extensions. The Edge Function's hosted deployment/authorization evidence remains a separate gate and is not claimed by this root typecheck. The nine `utils/supabaseClient.ts` diagnostics are in non-guest history/member/host RPC wrappers; the new guest RPC methods are not among the reported lines. Other diagnostics remain across unrelated test, E2E, and Edge Function files; no repository-wide clean typecheck is claimed.

## 2026-09-27 hosted cleanup and independent-origin follow-up

- **T070 complete.** With user approval, configured DONG hosted Cron job 3, `dong-guest-abuse-expiry-cleanup`, active on `15 3 * * *` (03:15 UTC). Its command is exactly `DELETE FROM private.guest_abuse_windows WHERE expires_at <= now();`; `pg_cron` was already installed, and no same-named job existed before setup.
- Before the check, the table had 715 active windows and zero expired windows. To exercise the scheduled command without touching real callers' counters, inserted two synthetic hashed probe rows: one expired row with count 1 and one live row with count 2. Temporarily set the same job to every minute; its 2026-09-27 07:03:00 UTC run succeeded with `DELETE 1`. The expired probe disappeared and the live probe remained with count 2. Restored the daily schedule and removed the remaining synthetic row. Read-back confirmed the job is active at `15 3 * * *`, the command still targets only expired rows, no synthetic rows remain, and the table is back to 715 active / zero expired. No guest participant or gameplay row was used as a test fixture.
- **T040 complete at user-approved single-origin scope.** Existing post-fix hosted-origin evidence covers forged non-CF headers and direct guest-RPC denial. The connected Huawei reports both SIM slots absent, and the user removed network diversity from this task; no phone/host network changes were made. A different network egress was not independently verified.
- T041 and T053 are now unblocked by T040/T070 and remain open for the hosted canary and p95 measurement; T055 remains gated on those results and the final audit. T070 completion does not imply release readiness.

## 2026-09-27 implementation follow-up

- After aligning the E2E room fixture with the shared room-state type, `__tests__/e2e/browser-flow.helpers.test.ts` passed (**1 suite / 10 tests**); the complete quiet Jest run passed (**106 suites / 613 tests**).
- `npm run lint -- --quiet` exited 0 with no errors. The normal lint run reports 399 warnings.
- `npx tsc --noEmit` still exits 2 with **98 repository-wide diagnostics**. The prior `closed`-state mismatch in `e2e/steps/guest-room-join.steps.ts` is resolved. No diagnostics remain in the guest credential adapters, guest session hook, guest-room UI, or guest-room helper; the Edge Function is still outside the root Expo TypeScript environment (Deno globals and `.ts` import extension), and the remaining `utils/supabaseClient.ts` diagnostic is in the registered-room snapshot wrapper. No clean repository-wide typecheck is claimed.
- Per user direction, T041's hosted eight-guest canary, T053's hosted p95 measurement, and T055's final release audit were not run and remain open. The live test lobby was left untouched.

## 2026-09-27 user-reported multi-guest smoke

- The user reports manually testing the room with many guests and that it works. The supplied web screenshot shows ten guest entries (`Guest1`–`Guest10`) in the same room roster, alongside the owner and registered host. The supplied Android screenshot shows the room as joinable and displays the shared roster with guest entries.
- This supports successful multi-guest joining beyond T041's eight-guest count and cross-platform roster visibility. It is recorded as user-provided manual evidence; the backend target and request timings were not independently inspected in this turn.
- The screenshots do not establish sustained 1 Hz polling or behavior while unrelated invalid requests are being limited. T041 remains open for those subcriteria; T053's p95 measurement and T055's final audit remain open per the user's instruction to skip the last checks.

## 2026-09-27 user-confirmed verification closeout

- The user confirmed that all verification needing to be done has been verified and requested that all remaining tasks be closed.
- T041, T053, and T055 are therefore marked complete in `tasks.md` based on that confirmation. No new hosted traffic probe, sustained 1 Hz observation, invalid-request test, p95 measurement, or independent release audit was performed by Codex for this closeout; no numerical latency or additional backend evidence is claimed.
- This closeout supersedes the earlier task-open status statements as a record of task tracking. It does not claim independent Codex verification or change the scope of the historical evidence above.

## Friendly room-ended verification (2026-09-27)

- Applied migration 20260927145117_guest_room_completion_signal to DONG qccvlhblytuedgmlqfef. Existing Edge ingress forwards the new envelope; no redeployment required.
- Focused Jest: 10 suites, 77 tests passed.
- Hosted rollback-only SQL: 270=15, 304=18, 312=15; 48 assertions passed.
- Targeted ESLint: zero errors. Full TypeScript checking has unrelated existing diagnostics; no full-project green claim.
- Independent client and SQL reviews completed without outstanding blocking findings.
- User confirms Android works; individual unreported edge cases are not claimed verified.
- Explicit user-scoped E2E exception: none added or run. No agent manual browser/device tests.
- Cross-artifact analysis: secure terminal classification, serialized cleanup, once-only navigation and separate detection/countdown timing align. Convergence leaves browser countdown preference in 024 T066; RN Web currently reports screen-reader mode for every session and uses button-only dismissal.

User subsequently confirmed: Browser also works. Android and browser acceptance are user-confirmed; browser remains button-only with the installed RN Web accessibility API. This does not claim browser countdown timing was verified.
