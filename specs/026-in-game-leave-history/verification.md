# Verification: Issue #165

## Baseline and scope

- 2026-09-28: `multiplayer` was clean and matched `origin/multiplayer` (`a7566a66e676881f518b00d45db404aec4d756e0`, ahead/behind `0 0`) after fetch. Created `codex/165-in-game-leave-history` from that commit.
- Read live [issue #165](https://github.com/NikolajKrogh/dong/issues/165): OPEN, no comments; #136 and #138 CLOSED. Its immediate leaver-result requirement is included.
- No E2E tests or suites were authored or run. No hosted/production database was changed.

## Automated checks

| Check | Result |
|---|---|
| New forward migration applied to disposable `supabase_db_dong-roster-probe-20260926` via `docker exec -i ... psql -v ON_ERROR_STOP=1 -q` | Pass. Final view revision applied to same local probe. |
| `supabase/tests/database/314_in_game_departure_history.test.sql` streamed to the local probe with `psql -v ON_ERROR_STOP=1 -q` | 19/19 pgTAP assertions pass. Covers member/guest retry, frozen result, access scope, final history, and host handover. |
| `supabase/tests/database/205_member_and_guest_leave.test.sql` on same local probe | 3/3 pgTAP assertions pass; joinable lobby behavior retained. |
| `npx jest __tests__/utils/historyRepository.test.ts __tests__/components/gameProgress/GameActionsSheet.platform.test.tsx __tests__/components/gameProgress/FooterButtons.platform.test.tsx __tests__/components/history/GameHistoryItem.test.tsx --runInBand --silent` | 4 suites, 15 tests pass. |
| `npx jest __tests__/hooks/useGuestRoomSession.test.ts __tests__/hooks/useRoomExit.test.ts --runInBand --silent` | 2 suites, 26 tests pass. |
| `npx jest __tests__/app/gameProgress.platform.test.tsx --runInBand --silent` | 1 suite, 5 tests pass, including cancel and confirm. |
| Combined focused Jest command covering the eight listed `gameProgress`, history, guest session, and room-exit suites with `--runInBand --silent` | 8/8 suites, 66/66 tests pass. |
| `npx eslint` on changed application source | Pass, no errors or warnings. |
| `npx tsc --noEmit --pretty false` | Fails on pre-existing unrelated test, Tamagui, and generated typing errors; no new errors in changed source or tests. `ReassignmentControl.tsx:115` has the existing Tamagui Sheet typing error. |
| `git diff --check` | Pass. |
| React Doctor changed scan | 38/100 across 354 files, dominated by generated Tamagui config and existing patterns. No new high-confidence finding affecting this flow. |

The older `313_canonical_completed_history.test.sql` could not complete on the pre-existing probe schema: its `completed_at` assertion failed and `authenticated` lacks `assignment_snapshots` SELECT. The new focused 314 test verifies completion and leaver inclusion on that probe.

## Android exploration (manual inspection, not E2E)

- `adb devices -l` showed one authorized Huawei `CLT_L29`, serial `WCR0218C11000221` (Android 10). ARTEMIS diagnosis reported ready.
- ARTEMIS Pro and Flash attempts were stopped after external Gemini 503 and 429 responses. ADB plus ARTEMIS hierarchy inspection navigated the installed app through Home, local setup, and Game Progress.
- Local match selection could not load because the installed client's `localhost:8080` command API refused connections. ADB opened `myapp:///gameProgress`; the solo Game actions sheet showed Home, Setup, and End Game. The installed build has no new Leave Game code and no active multiplayer room, so the new Android departure flow was not verified.
- No Android automated E2E test was run. The web and Android acceptance walkthroughs remain in [quickstart.md](quickstart.md) for a build connected to a local multiplayer room.

## Spec Kit review

- Specify, clarify, plan, tasks, analyze, checklist, implement, and converge were performed for `026-in-game-leave-history`.
- Analyze found one critical constitution conflict: Principle V requires E2E coverage for this UI journey, while the user's explicit constraint prohibits authoring or running it. The plan records this intentional unmet requirement. No other cross-artifact gap remains after focused verification.
- The contract checklist checks requirement quality, not implementation. Convergence found no additional in-scope implementation task; manual acceptance remains unverified.

## Commits

- `3edf90e` — migration and focused pgTAP checks.
- `dd27959` — client leave/history flow and focused Jest checks.
- The documentation commit SHA is available from `git log` and reported in the final task response.
