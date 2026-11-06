# Goal notification feasibility

Assessed 2026-10-30. This is an initial assessment, not the implementation plan or production verification.

## Difficulty and effort

Moderate: the repository already has centralized acquisition, accepted observations, compact goals and immutable goal revisions. The missing feature is consent, authorized browser/game associations, reliable notification dispatch and browser handling.

Rough engineering estimate for one developer familiar with this repository:

| Slice | Estimate | Main work |
| --- | --- | --- |
| Small proof of delivery | 0.5–1 day | One browser, service worker, consent and a controlled send; not release-ready |
| Narrow web MVP, including checks | 3–5 days total | Associations, access boundaries, deduplication, bounded retries, lifecycle cleanup, settings and limited browser verification |
| Four-target phone release | 5–8 days total | Android Chrome/Firefox/Samsung Internet and iPhone Home Screen website, including onboarding, storage/session recovery guidance and real-device failure/recovery checks |
| Native Android follow-up | 1–3 additional days | Native registration, FCM credentials, notification channels, opening alerts, receipts and device verification |

These are estimates, not measured delivery commitments. Guest/solo association work, browser coverage and runtime incompatibility can extend them. Native delivery requires a suitable build and credentials.

See [mobile-browser-pitfalls.md](mobile-browser-pitfalls.md) for the expanded research. DONG will have no native iOS app. The user accepted optional browser Add to Home Screen setup on iPhone; ordinary iPhone tabs remain playable but cannot use the documented background Web Push route. An actual local-only game transfer feature, if required beyond sign-in/rejoin guidance, is not included in this estimate.

## Existing code to reuse

- `supabase/functions/_shared/football-matches/footballMatchService.ts`: centralized provider acquisition and separate room replay/failure handling.
- `supabase/functions/_shared/football-matches/postgresFootballMatchRepository.ts`: accepted observations and catalog operations.
- `supabase/migrations/20261026164719_match_catalog_retention.sql`: persisted goal revisions and finite acquisition schedules.
- `features/game-progress/useGameProgressController.ts`: existing solo goal sound/toast path and common-match suppression. The multiplayer increment path exits before calling it, and multiplayer disables the solo live-score callback. Room snapshot updates have no equivalent feedback hook in this controller.
- `features/preferences/SoundNotificationSettings.tsx` and `store/syncedPreferences.ts`: existing settings to preserve, not browser-push consent.
- `platform/`: required home for platform-specific behavior.

Existing source uses roughly 60-second live refresh defaults. Provider lag, scheduling, budgets and failures add delay; instant real-world alerts would require a separate acquisition/freshness assessment. No production runtime settings were inspected.

## Suggested implementation direction

1. Consume accepted catalog changes once, outside individual client polling or per-room fan-out. Persist notification work atomically with accepted evidence where possible, then dispatch independently so push failure cannot undo a score.
2. Associate each opted-in browser subscription with its authorized active game. Multiplayer has server membership; local solo play needs an explicit finite server association, reusing its tracking authorization rather than requiring an account. Audit guest expiry and identity changes.
3. Register a web service worker, request permission after a user action, save its subscription securely, display push events and handle notification clicks. HTTPS and browser capability checks are prerequisites. Standard Web Push uses VAPID application-server keys; keep private keys on the server. [Browser subscription guide](https://web.dev/articles/push-notifications-subscribing-a-user), [MDN Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API).
4. Use a bounded sender with short TTL, retry limits, delivery state and invalid-subscription cleanup. A push-service acceptance is not proof of device display. The Node `web-push` project documents VAPID, encrypted payloads and TTL; its default retention is four weeks, inappropriate for live goals. Set expiry explicitly. [web-push documentation](https://github.com/web-push-libs/web-push/blob/master/README.md).
5. Validate the actual sender in Supabase's Edge runtime before choosing a dependency. The `@negrel/webpush` author's Deno implementation is a candidate using Web APIs; neither package has been tested here. Do not implement encryption yourself or assume Node compatibility. [Author's Deno guide](https://www.negrel.dev/blog/deno-web-push-notifications/).
6. Keep match-change identity, eligibility and logical deliveries reusable for Android. Add its native delivery when requested, without building unused native infrastructure now.

The official Supabase example supports Edge Function dispatch and database-triggered notification work, including Expo and FCM paths. It is a useful integration reference, not a drop-in implementation of authorized game notifications. [Supabase notification example](https://supabase.com/docs/guides/functions/examples/push-notifications).

Expo explicitly does not support web notifications through `expo-notifications`. Its native Android path requires FCM credentials and a development build; remote push is unavailable in Android Expo Go from SDK 53. [Expo service options](https://docs.expo.dev/guides/using-push-notifications-services/), [native setup](https://docs.expo.dev/push-notifications/push-notifications-setup/), [notification SDK](https://docs.expo.dev/versions/latest/sdk/notifications/).

## Remaining planning checks

- Track the reported missing multiplayer toast and DONG sound as a dedicated foreground-fix commit in the same pull request. Verify that a fresh accepted goal shows a toast and plays sound for host and guest when enabled, and that opening or refreshing a room does not replay old goals. Browser test notifications can proceed independently. Verify the foreground fix before enabling multiplayer goal push.
- Confirm minimum versions and prerequisites for Android Chrome/Firefox/Samsung Internet and the iPhone Home Screen website. Other browsers are not notification release gates. Test closed tabs separately from complete browser shutdown.
- Prove sender compatibility, actual background delivery, duplicate suppression and expiry with isolated fixtures; test an accepted request whose response is lost.
- Map exact catalog revision/baseline semantics so enrichment or VAR corrections cannot masquerade as new goals. Preserve uncertain score-only updates honestly.
- Validate destinations against SSRF/redirect abuse, protect subscription keys, enforce ownership and admission limits, and measure fan-out/storage against the existing free-tier reserve.
- Define migrations, rollback, key management, retry scheduling and operational evidence in `/speckit-plan`.

Research used Exa for source discovery/fetching and Context7 for current Expo and web-push documentation. No services, credentials, dependencies or application behavior were changed.
