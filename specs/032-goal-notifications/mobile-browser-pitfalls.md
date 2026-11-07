# Mobile browser notification pitfalls

Researched 2026-10-30 using Exa and Context7, emphasizing browser-vendor documentation and MDN compatibility data. This is documentation research, not device verification.

## Product boundary

DONG will never have a native iOS app. iPhone access remains through web technology. The user explicitly accepted optional Add to Home Screen setup for background notifications. This creates an installed website, not an App Store app or native iOS build. Ordinary browser play remains available without installation.

No web implementation can promise background push from every ordinary phone browser tab. A delivery provider cannot remove browser/OS restrictions.

The required release matrix is now limited to Android Chrome, Firefox, Samsung Internet and the iPhone Home Screen website. Other capable browsers may work through the same standards-based implementation, but their notification behavior is not a release gate. Existing gameplay support is unchanged.

## Browser coverage to build and validate

| Phone/context | Expected background push route | Product behavior |
| --- | --- | --- |
| Android Chrome | Standard Web Push, without requiring Home Screen installation | Primary test target; permission and device settings still apply |
| Android Firefox | Standard Web Push | Primary test target, independent of Chromium; verify actual delivery |
| Android Samsung Internet | Standard Web Push | Primary test target on Samsung hardware |
| Android Edge and Opera | Candidate standard Web Push paths | Outside required release validation; do not deliberately block capable implementations |
| iPhone, installed website, iOS 16.4+ | Web Push through the Home Screen web app | Required target; optional installation guidance, then launch and request permission there |
| iPhone ordinary Safari/Chrome/Firefox/Edge tab | Not the documented iPhone Web Push route | Keep browser gameplay; explain optional Home Screen setup |
| Embedded Android WebView | PushManager unsupported in MDN compatibility data | Explain how to open DONG in a capable browser; do not display a false enabled state |
| Other in-app browsers, private modes, privacy-focused browsers, older phones | Capability and policy vary | Verify current capabilities, handle registration failure, retain playable fallback; no universal promise |

Sources: [MDN PushManager compatibility data](https://github.com/mdn/browser-compat-data/blob/main/api/PushManager.json), [Samsung Web Development Guide](https://developer.samsung.com/browser/android/web-developer-guide.html), [WebKit iPhone Web Push](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/).

API support alone does not establish delivery reliability. Check secure context, permission, service worker/subscription availability, successful registration and a real delivery test. Do not classify every browser from its name or user-agent string, or assume every embedded browser behaves like a full browser. Absence of PushManager cannot reliably distinguish private mode from every other unsupported context; avoid pretending to diagnose private mode.

## 1. iPhone setup is a separate journey

iPhone Web Push is available to Home Screen web apps from iOS 16.4. Permission must follow a user action in the eligible context. Third-party browsers can offer Add to Home Screen; opening a different browser tab does not itself provide the installed context. Focus settings can silence delivery. [WebKit introduction](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/).

Version-specific instructions matter. Since iOS 26, websites added to Home Screen open as web apps by default, but the user can disable Open as Web App and create a browser bookmark instead. Earlier supported versions need the appropriate app metadata. Provide a stable manifest, icons and launch URL anyway, and verify the actual launched context. [Safari 26 changes](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/).

Suggested flow: explain the benefit, offer optional Home Screen instructions, have the player open DONG from that icon, restore/rejoin the game if necessary, then show Enable goal notifications and Test notification. Do not promise automatic installation or send users through permission prompts before the environment is eligible.

## 2. Installation can separate login and game storage

WebKit documents cookie copying when a Home Screen web app is created from iOS 17.2, but other local storage is not copied. Subsequent website data is separate. [WebKit storage behavior](https://webkit.org/blog/14787/webkit-features-in-safari-17-2/).

DONG-specific evidence: `lib/supabase.ts` supplies AsyncStorage for persisted auth; `store/gameStore.ts` persists players, matches, history, solo tracking and active game context through AsyncStorage. Therefore, do not assume a game or login from a tab exists in the installed website. This is an inference from DONG's persistence and documented storage isolation; it needs real iPhone verification.

For the smallest complete release, encourage setup before starting play and provide explicit sign-in/rejoin guidance. Preserve the original tab's local data. Do not silently transfer credentials in URLs or claim recovery of a local-only solo game unless an authorized transfer actually exists. Signing out in one isolated context does not automatically mean another context signed out; model their notification associations separately.

## 3. Browser permission is only one gate

A registered subscription and granted site permission do not prove that a notification will appear, make sound or interrupt the player. Browser-app notification permissions, Android channels, iPhone Focus, lock-screen settings, connectivity and battery/background restrictions are separate gates. Android documents Doze restrictions; web code does not control all the browser's native execution policies. [Android power limits](https://developer.android.com/topic/performance/power/power-details).

Chrome also revokes some site permissions automatically and applies abuse protections. Its 2026 guidance describes engagement-based throttling and HTTP 429 responses for affected senders. This is not a universal quota for ordinary DONG traffic. Reconcile permission/subscription when the website opens or regains focus, and provide settings guidance instead of repeatedly prompting. [Chrome rate limits](https://developer.chrome.com/blog/web-push-rate-limits).

Offer a user-triggered test, showing server handoff separately from user-confirmed receipt. Do not claim to have read OS notification settings that the web platform does not expose. Do not ask everyone to disable battery protection preemptively; use tested, device-specific recovery when required.

## 4. Do not treat push as invisible background polling

For traditional Safari Web Push, the handler must promptly show a visible notification. Silently ignoring a push can cause permission revocation. Thus a handler that always returns early for foreground tabs, duplicate IDs, expired sessions or old goals can violate the delivery contract. Prevent invalid work before dispatch; do not make silent receipt the primary correctness mechanism. A notification with muted sound is still visible and differs from showing nothing. [Apple sending guidance](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers).

Newer Apple platforms offer Declarative Web Push: iOS/iPadOS 18.4 introduced it for Home Screen websites. It can show fallback content even if optional service worker code fails, improving resilience. It still produces a visible alert and does not let an ordinary iPhone tab bypass the Home Screen requirement. Use it only as a verified enhancement with a traditional cross-browser path; validate duplicate and revocation behavior before adoption. [Declarative Web Push](https://webkit.org/blog/16535/meet-declarative-web-push/).

## 5. Live scores need explicit expiry, ordering and duplicate semantics

- Set a short transport TTL from the remaining delivery window, not a fresh five minutes on every retry. No default multi-week retention for goals.
- A send accepted by a push service is not proof of display. Lost send responses can lead to retries after an earlier handoff already succeeded; exactly-once delivery is not a safe transport assumption.
- Use stable logical event identity and revision handling. Repeated score observations, multiple rooms, later scorer enrichment and VAR reversals must not look like new goals.
- A transport Topic coalesces pending messages; a display tag replaces notifications already displayed. Neither is a complete event ledger. A match-wide key can intentionally replace older updates but can also hide individual goals. Decide summary versus per-goal behavior explicitly.
- On reconnect, late alerts should not narrate an uncertain goal sequence as if it just occurred. Prefer truthful score updates, suppress stale work before dispatch, and keep short transport retention.
- Opt-out stops future dispatch; it cannot reliably recall a message already handed off. Never promise absolute display-time cutoffs or universal removal of displayed notifications.

References: [Web Push protocol](https://www.rfc-editor.org/rfc/rfc8030.html), [Apple TTL/Topic/Urgency guidance](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers), [MDN display options](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/showNotification).

## 6. The essential notification must be simple

Use title/body containing team names and score, plus tap-to-open. Treat icons, images, action buttons, vibration, badges and custom sounds as optional. Do not make gameplay depend on sound or on an extra action button. Use service worker notifications for the cross-browser path: the ordinary Notification constructor throws on most mobile browsers. [MDN mobile constructor restriction](https://developer.mozilla.org/en-US/docs/Web/API/Notification/Notification).

Make the payload sufficient to display without fetching the score first. Service workers have limited execution time and may run without the page's auth or in-memory state; do not require an interactive login or successful extra fetch to render the essential alert. Opening it can then validate access and load current information.

## 7. Subscriptions and deployments need recovery

Reconcile on foreground/startup; subscription-change events have limited availability and background synchronization can fail offline. Permanently invalid endpoints should stop attempts, transient failures need bounded retry, and permission denial needs user-controlled recovery. [MDN subscription changes](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerGlobalScope/pushsubscriptionchange_event).

Keep the origin, service worker URL/scope, manifest identity and VAPID keys stable. Verify actual production-host behavior: the worker must be served as JavaScript, not the single-page app HTML fallback. An app deployment can leave an older worker running, so notification payload changes must remain compatible with deployed clients. Avoid adding a general offline cache just to enable push; stale application bundles would create an unrelated maintenance problem.

Protect subscription endpoints/keys, avoid logging them, validate outbound destinations against request-forgery abuse, and do not put room codes or auth credentials into notification URLs. Keep registration tied to actual game authorization, including guest/solo expiry.

## Release evidence required

Test real phones, not only desktop viewport emulation. Required evidence: Chrome/Firefox on Android, Samsung Internet on Samsung hardware, and a real iPhone. Edge, Opera, other browsers and iPad are outside the required notification matrix. Use Playwright and axe for Android web flows where supported, and ARTEMIS for notification-tray checks. Run physical iPhone checks only on production with the restricted test installation described in the [quickstart](quickstart.md#phone-evidence-and-staged-enablement).

On each supported combination record: first grant, denial/recovery, closed tab, notification tray or Notification Center, longer idle/battery restrictions, offline/reconnect, repeated/rapid goals, goal correction, game end/leave, sign-out, removed site data/subscription, redeployment with an older worker, and tap-to-open after access expiry. Include iPhone installation and game/session isolation plus unsupported embedded-browser fallback.

Use known isolated fixtures. Record provider delay, server dispatch, push-service acceptance and observed presentation separately. Report any suppressed sound or delayed OS presentation without mislabeling it as a failed database update.

## Revised effort

The earlier 3–5 day estimate describes a narrower web MVP. For the agreed four-target release, budget approximately **5–8 developer days**, subject to access to an iPhone and Samsung phone and the chosen minimum OS/browser versions. Reducing the matrix saves validation work; it does not remove consent, dispatch reliability or iPhone storage/setup work. A secure local-only game transfer flow, if required, needs separate estimation. Background delivery in unsupported ordinary iPhone tabs is not solvable by adding development time.
