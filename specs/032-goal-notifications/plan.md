# Implementation Plan: Active Game Goal Notifications

**Branch** `feat/goal-notifications` targeting `multiplayer` | **Date** 2026-11-06 | **Spec** [spec.md](spec.md)

**Input** `specs/032-goal-notifications/spec.md`, including both 2026-11-06 clarifications.

## Summary

Send opt-in Web Push for newly accepted provider-backed score changes in a player's active game. A separate worker reads committed catalog observations and rechecks current authorization before handoff. It has its own schedule, limits, and kill switch. Players set their multiplayer match scope inside the current game. The default is assigned matches plus the common match, with an option to follow all provider-backed room matches that receive fresh accepted score evidence through existing coverage. Both respect the common-match preference. Deliver eligible push regardless of game visibility.

## Technical Context

| Area | Choice |
| --- | --- |
| Runtime | Existing Expo Router and TypeScript client, static SPA export on Cloudflare Pages, Supabase Postgres and Deno Edge Functions |
| Dependencies | Browser Push API, Notifications API and service worker, existing Supabase Auth and room/solo authorization, Supabase Cron and pg_net. Pinned Web Push sender candidate and preview compatibility gate in [research](research.md). |
| Storage | Additive private Postgres tables. Existing catalog observations, gameplay state and session credentials remain authoritative. Browser stores the platform subscription and an opaque installation handle. |
| Tests | Jest, pgTAP, existing Playwright BDD, Edge typecheck and focused sender tests, physical phone delivery checks |
| Release | Android Chrome, Firefox and Samsung Internet. The iPhone Home Screen website on iOS 16.4+ has a separate public enablement gate pending verification on a physical iPhone in production. Preview and restricted production enrollment are controlled by server policy. Native Android is a follow-up and there is no native iOS product. |
| Latency | SC-001 requires 19 of 20 controlled eligible alerts within 30 seconds of committed acceptance for each enabled target. Measure provider delay separately. |
| Capacity | Start with at most 50 opted-in installations, 25 claimed deliveries per tick and five concurrent network sends. Use measured CPU, queue age and project quotas to set final rollout limits. |
| Retention | Five-minute send deadline, seven days for diagnostics, and 24-hour cleanup for expired associations and detected invalid/revoked subscriptions. |

## Constitution Check

| Gate | Before research | After design |
| --- | --- | --- |
| I. Cross-platform behavior | Pass. Web release and native deferrals are documented. | Pass. Web adapter and static worker isolate platform APIs. Native settings do not claim browser push support. Separate physical iPhone gate. |
| II. Server-authoritative state | Pass. Committed scores and verified membership control eligibility. | Pass. Narrow authorized operations, revision checks and pre-handoff revalidation. Push consumes committed evidence through an independent transaction. |
| III. Auditable history | Pass. Consume existing observations. | Pass. Delivery ledger has stable logical identity and bounded diagnostics. No historic alert backfill or notification dependencies in score writes. |
| IV. Supabase first | Pass. Use existing platform and auth. | Pass. Private Postgres state and dedicated Edge sender. No Java changes or paid service dependency. |
| V. Verifiable delivery | Pass. Spec includes testable stories. | Pass. Each implementation milestone has a validation gate. Required cases include authorization, concurrent processing, mobile delivery, and failure isolation. |
| VI. Skill first | Pass. Apply Spec Kit, Supabase, Postgres design and agent-context guidance. | Pass. Research covered catalog ingestion, room/solo authorization, and Web Push. Follow relevant testing and React guidance during implementation. |

## Project Structure

### Documentation

- [Specification](spec.md)
- [Research and decisions](research.md)
- [Data model](data-model.md)
- [Interface contracts](contracts/goal-notifications.md)
- [Validation quickstart](quickstart.md)

### Repository changes by surface

| Surface | Planned location |
| --- | --- |
| Browser permission and installation | `platform/notifications/`, `public/index.html`, `public/manifest.webmanifest`, `public/goal-push-sw.js` |
| In-game UI and tap routing | `features/game-progress/`, shared settings in `features/preferences/`, thin route in `app/` |
| Existing multiplayer foreground fix | `features/game-progress/useGameProgressController.ts`, `features/rooms/useActiveGameRoomSync.ts` and its authorized snapshot/event path |
| Subscription operations and dispatch | `supabase/functions/goal-notifications/`, `supabase/functions/dispatch-goal-notifications/`, shared sender in `supabase/functions/_shared/goal-notifications/`, additive migrations and function configuration |
| Verification | `supabase/tests/database/`, `__tests__/features/game-progress/`, `__tests__/platform/`, `e2e/features/`, `e2e/steps/`, `package.json` Edge typecheck entries |

## Skills by implementation stage

Read the relevant `SKILL.md` before starting the matching work. Check the original checkout's `.agents/skills/` first, then use the session's skill catalog for skills available outside that checkout.

| When | Skills and how to use them |
| --- | --- |
| Reconcile requirements and start implementation (T001 onward) | Use `speckit-clarify` if a product decision is open, `speckit-analyze` for read-only consistency checks and `speckit-implement` for the agreed implementation slices. Target `specs/032-goal-notifications` in the original checkout. |
| Work on Supabase contracts, persistence, dispatch and lifecycle (T003–T004, T007–T008, T010–T011, T014–T018, T020–T024, T026–T027, T029, T032, T034) | Use `supabase` for auth, RLS, Edge Functions and scheduling. Add `supabase-postgres-best-practices` for schema, indexes, claims and query plans, and `database-testing` before writing pgTAP migration, ownership and concurrency coverage. |
| Build settings, recovery and navigation UI (T012, T022, T027) | Use `tamagui` for shared controls and `accessibility` for permission guidance, keyboard and screen-reader behavior. Use `react-native-testing` for tests written with React Native Testing Library. |
| Author browser journeys (T006, T019, T025, T031) | Use `playwright-best-practices` for permissions, worker events, multiple tabs and isolated browser fixtures. Use Playwright with axe on the attached Android browser for UI exploration and accessibility (T005). Verify the Android notification tray with ARTEMIS. Record physical delivery separately in T013 and T036–T037. |
| Validate the Expo web export and HTTPS preview (T009, T013, T035–T037) | Use the web guidance from `expo-deployment` where it applies to the existing Cloudflare Pages workflow. |
| Investigate unexpected behavior, including the multiplayer toast and sound bug (T031–T033) | Use `systematic-debugging` to trace the failure before changing behavior. |
| Review each implementation slice | Use `react-doctor` after React changes and `code-reviewer` when reviewing the slice. Check authorization, send isolation, rollback and acceptance coverage. Use `github-ops` for authorized PR or CI work. |

## Implementation sequence

1. **Test notification.** Add browser opt-in, permission recovery, subscription registration and a fixed test message for the requesting installation. Create the manifest and static worker, validate the exported preview over HTTPS, and prove the sender on Android Chrome. Reserve physical iPhone verification for the restricted production test. Check that the deployed worker URL serves the expected JavaScript rather than the SPA HTML fallback.
2. **Active-game eligibility.** Add validated associations for the signed-in participant, room guest and solo grant. Wire the in-game enable flow to bind and establish a baseline before reporting the game as enabled. Exercise a fresh accepted goal from this UI enrollment with the controlled transport. Implement the session setting, compare-and-set changes, baselines and lifecycle cleanup. Verify that changing one player's scope has no effect on others. In a separate foreground fix, connect fresh committed room goals to the existing toast and sound handler. Establish a replay baseline and verify host and guest before enabling multiplayer push. Verify generation-scoped stop retries after offline sign-out, and distinguish permission revocation from a repairable endpoint.
3. **Live dispatch.** Verify who can read the scheduler queue and agree on a dispatcher-only wake credential before implementing dispatch. Then add the independent consumer, bounded retries, stable delivery keys and the authorized tap route. Validate live dispatch first in isolated preview with Android. Keep general production delivery disabled until the rollout gates pass. Test that the Edge endpoint rejects unauthenticated callers and invalid, expired or reused wake leases before claims or sends. Prove that an unavailable sender and failed notification writes leave score acceptance and room replay healthy. Verify positive remaining TTL, provider-specific error classification and Apple VAPID JWT reuse in the sender.
4. **Pilot and rollout.** Start with enrollment and sending disabled. Use short-lived, single-use enrollment grants for Android preview testing and separate production pilot grants for verified configurations. Once the implementation, capacity and rollback gates pass, issue a production-only iPhone verification grant. Give one Home Screen installation time-limited test and live eligibility before public iPhone enablement. Check the installation's approval and target policy on the server for test and live sends. Keep public iPhone enrollment and sends off until the physical Home Screen checks pass in production. Use the fixed test notification and real accepted goals from the tester's active game. Show the awaiting-verification state and setup guidance without prompting for permission. Immediately pause sends for any unauthorized delivery, privacy disclosure, attempt past the deadline or notification-caused scoring, room update or provider request regression. Hold expansion if a configuration misses SC-001 or exceeds measured queue, worker or project capacity limits. Record those limits before the first production cohort. Roll back by disabling test/live sending and the send schedule while database-only cleanup continues and preserves score history. Verify the notification tap reaches the authorized route with the Home Screen website both open and fully closed before public iPhone enablement.

Deliver this feature in one pull request targeting `multiplayer`. Keep focused commits for the test-alert path, active-game eligibility, live dispatch and tap routing, and the multiplayer foreground fix. Eligibility depends on the registration contract, and live dispatch depends on the validated association model. The foreground fix can proceed independently within the same branch. Release gates remain independent by platform, with the foreground fix required for multiplayer push.

## Complexity Tracking

No constitution exceptions. Sender compatibility, load measurements and real-phone delivery are acceptance gates. Implementation and task enumeration follow in `/speckit-tasks`.
