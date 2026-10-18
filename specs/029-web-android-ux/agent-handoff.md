# Integration handoff

Feature 029 is integrated on `web-navigation` in PR #205. The original workers started from `2604e1a`; A handled game context/overlays, B handled caller return and route state, and C handled shared controls/compact layout. Their work is complete. This document does not authorize restarting workers or changing release status.

## Sources of truth

- [spec.md](spec.md): requirements and user decisions.
- [contracts/navigation.md](contracts/navigation.md): routes, dismissal, roles and presentation behavior.
- [tasks.md](tasks.md): task status and requirement mapping.
- [skills.md](skills.md): relevant skills and tooling compatibility.
- [quickstart.md](quickstart.md): commands and runtime checks.
- [validation.md](validation.md): build-specific results and outstanding acceptance.

## Maintenance boundaries

Preserve unrelated dirty work. If work is delegated again, record the starting commit and give each shared path one writer; integrate changes serially. Only one controller may use a shared Android device at a time. Read `AGENTS.md`, `CLAUDE.md` and the constitution before working.

Navigation must preserve room membership, guest grants, private-data fences and immutable game history. Home is distinct from Leave/End. Do not add backend writes, dependencies or a second history manager to update a view.

`TaskOverlay` uses a router-owned transparent web route and native modal content. Keep owner lifetime, idempotent dismissal, deferred destination actions and focus restoration together. A refreshed transient panel cannot revive an unmounted owner. `SetupWizard` supports controlled stable step keys while retaining its local mode; preserve prerequisites, deferred input and Back without duplicate entries. Polling must not move an active editor.

Tamagui 2 uses `render` for web elements. Keep real links/buttons, caller roles, disabled suppression and one main landmark. Do not restore redundant visible titles or a separate History button: Home uses Friends and the clickable Game Stats card. Preserve the stable input ancestry and panned visual-viewport handling that fix the observed keyboard/scroll defects.

Use unit/component tests for permutations and keep only the two added browser journeys in `web-navigation.feature`. Choose checks for the changed behavior; do not repeat the full suite after each edit. Browser fixtures and development-client results do not establish physical, hosted or packaged-release acceptance. Keep transient artifacts and credentials out of commits.

## Android runner

`scripts/android/run-ux-journeys.ps1` observes an already-open fixture. It does not install/launch the app, authenticate or create rooms. Required arguments are `DeviceSerial`, `Package`, `Scenario`, and `FixtureManifest`; `OutputDirectory` is optional. Packages are `com.krogh.dong.dev` and `com.krogh.dong`. Follow the ARTEMIS exploration/diagnosis rules in `AGENTS.md` before adding interactions.

Minimal local manifest:

```json
{
  "deviceSerial": "<approved-serial>",
  "package": "com.krogh.dong.dev",
  "approvedForReadOnlyNavigation": true,
  "gameMode": "solo",
  "accountState": "signedIn",
  "scenarios": ["back-return"],
  "homePlayerCountText": "<observed count>",
  "homeMatchCountText": "<observed count>"
}
```

The count labels are optional for solo and required for registered/guest configuration checks. Registered fixtures need `gameMode=registered`, `gameRole=owner|member`, and at least two distinct `roomParticipantNames`. Pre-start fixtures set `gamePhase=joinable` and may supply `roomJoinCode`/`roomMatchSummary`. Guest fixtures need `gameMode=guest` and `guestStatusCountText`. Expectations must match observed UI; no credentials belong in the manifest.

| Scenario | Scope |
| --- | --- |
| game-context | Solo setup, registered owner/member configuration or pre-start Room/Matches/Back, or guest read-only status; same identities and role controls, no game mutation |
| back-return | Actions -> hardware Back retains gameplay; three Home/resume cycles retain the game |
| route-state | History Players -> hardware Back returns Games; header Back returns Home |
| accessibility | Solo control names and keyboard-first Back; excludes TalkBack/autofill |
| layout-scroll | Populated Home reaches Game Stats/Friends/Settings and returns to Continue Game |
| home-shortcuts | Signed-in Friends Requests -> search -> caller return, then History and Home |
| all | The six scenarios above with all fixture prerequisites; not all roles or release acceptance |

The runner validates device/foreground/manifest approval, reads fresh package-scoped UIAutomator state and uses bounded waits/scrolls. The one coordinate fallback is calibrated only for the recorded Huawei/default-font gameplay surface; retain its device/display guards. Unstable or stale observations must fail rather than supply tap coordinates. Success exits 0; failed prerequisites/assertions exit 1 with results and a failure screenshot when available. Use distinct output folders and keep raw private hierarchies local.
