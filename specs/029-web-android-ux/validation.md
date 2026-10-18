# Validation record

Feature 029 is integrated on `web-navigation` in PR #205 against `multiplayer` (`3750010`). The implementation started from planning commit `2604e1a`. No dependency, application schema or remote migration change was introduced. Unrelated local skill changes remain outside the PR.

## Current verification policy

Unit/component tests cover isolated logic and permutations. The PR adds one browser feature with two core journeys, run on phone and desktop: Home keyboard navigation/Back, and preserving a running solo game through configuration/Back/refresh. Existing setup/gameplay E2E coverage remains. Nine expanded E2E pairs and all 43 new `docs/` audit/screenshot files were removed at the user's request. Historical broad-browser results below describe earlier builds, not retained test coverage.

Select checks by changed behavior and reuse passing results. No full-suite, export or device result is implied for later cleanup commits. Transient logs, fixtures and credentials stay under ignored `test-results/`; some earlier artifacts were removed by Playwright cleanup, so those records are historical rather than durable deliverables.

## Recorded automated results

| Source / change | Executed result | Local evidence |
| --- | --- | --- |
| Integrated source `7f40c70` | 141 Jest suites / 910 tests; TypeScript, ESLint and Knip pass. 130 historical UX browser cases pass. Production web export and seven local runtime smoke checks pass. | `ux-final-candidate-jest.log`, `ux-final-candidate-browser.log`, `ux-web-export-final.log`, `ux-export-smoke-final/` |
| Visible-title correction `9b27da2` | 34 focused tests and 92 historical browser cases pass; TypeScript, ESLint and Knip pass. | `ux-remove-titles-*` |
| Game Stats correction `d5cacf9` | 11 Home tests, 76 historical browser cases and six final Home cases pass; static checks pass. | `ux-restore-stats-*` |
| Coverage/docs reduction `29fc195` | 55 focused tests and eight browser cases (new navigation plus existing launch/Settings, each at phone/desktop) pass; TypeScript, ESLint and Knip pass. | `ux-reduced-final.log`, `ux-reduced-jest.log` |
| First simplification `74e3c90` | 78 affected unit tests, TypeScript and targeted ESLint pass; React Doctor reports no issues (86/100). No new tests or broad E2E/device run. | `ux-simplify-*` |
| Full-PR simplification, based on `74e3c90` | All 113 PR files reviewed. Consolidated overlay records and repeated test fixtures; removed unused code and shortened duplicated planning notes. 52 affected unit tests, four core browser cases, 22 runner guard assertions, TypeScript and targeted ESLint pass; changed-scope React Doctor reports no issues (100/100). No new tests, full-suite or device run. | `ux-simplify-final-*`; local review inventory under `ux-simplify-review/` |

These browser runs used intercepted service/auth fixtures at local Metro URLs. They do not establish hosted authorization or physical Android behavior. Full Jest passed but took several minutes to release asynchronous work; no `forceExit` was used. Bare Jest bypasses the repository's Node/Expo preload; use `test:ci`. Restricted-runner cache/browser failures were checked separately from product defects. The existing shell suite had stale Settings, statistics wording and guest-toast expectations reproduced on the baseline; the obsolete Settings assertions were subsequently removed. Stalled/failed preliminary runs were not counted as passes.

React Doctor's earlier dynamic Tamagui anchor/label warnings were reviewed against actual rendered roles, names, hrefs and children; no suppression or score-driven refactor was added. The overlay render boundary remains because inlining it triggers React's ref-analysis warning.

## Runtime findings and corrections

- Game configuration and safe Home retain solo data or current registered/guest identity. Leave/End retain their existing explicit commands and confirmations. Registered members do not gain owner controls; guests use read-only status rather than the registered lobby.
- Router-owned task overlays replaced a rejected browser-history-sentinel prototype. Setup and History commit meaningful route changes without mutating their mounted predecessor. Hydration/readiness precede normalization, and History details hide on route blur. Bounded opaque browser-entry markers support detail Close after reload; unavailable session storage may conservatively add a Games entry, without exposing private data.
- Auth/username return uses normalized `dismissTo` after a live sign-in exposed a duplicate Friends parent (`36bad02`).
- Same-topic private Realtime channels collided during retained gameplay/re-entry. Shared participant leases and serialized removal fixed that SDK constraint (`c95d151`); unmount-generation and retained-retry guards prevent old work overwriting another room (`a9ce096`, `99d6b70`). Failed/unowned channels fall back to existing polling.
- Changing the web Wizard wrapper remounted/blurred the focused input; stable ancestry fixes it (`2519cf1`). A disabled web FlatList also blocked ancestor touch gestures; its web scroll policy was corrected without changing native behavior (`5655d69`).
- Real Chrome's keyboard kept layout height 623 while reducing visible height to 304 and panning by 319. The stable frame aligns the scrollport within that visual viewport (`7f40c70`). At 320px/200% text, navigation wrapping fixes the measured horizontal overflow (`c99975a`).

## Physical device evidence and limits

Testing used Huawei CLT-L29, Android 10, 1080x2240, default font scale 1, with the installed development client `com.krogh.dong.dev` and Chrome 155. Disposable local fixtures used isolated Supabase stack `dong-ux029` with the existing migrations; the old stack/history was preserved. Public environment and private fixture helpers remain ignored under `test-results/android-ux-local/`. The Java API was intentionally unavailable, so native Start was not verified.

| Verified scope | Build / result |
| --- | --- |
| Solo and signed-in navigation | Six runner scenarios pass at `5540521`; the History route-state fix passes at `a0fd107`. The final guest Home layout check passes after runner guards. |
| Registered owner/member | In-progress configuration, expected participant identities/role controls, overlay Back and three Home/resume cycles pass across `c95d151` through `7f40c70`. Pre-start Room -> Matches -> Back -> Home/re-entry passes at `7f40c70`; the join code is owner-only. |
| Guest | Actual join form creates the local guest grant. Pre-start re-entry and in-progress read-only status/disabled End/Back/Home cycles pass at `7f40c70`. Four players/six matches and native Close/Home remain reachable at 130% system text; original font size restored. |
| Navigation invariants | Read-only before/after comparisons for owner/member/guest and pre-start fixtures preserve room state, membership, scores, assignments, event sequences and command counts. Deliberate fixture joins/start were captured before navigation baselines. No navigation command row was created. |
| Chrome keyboard/scroll | Empty and 20-player lists: real touch, focused original input and pending name survive swipes; Next is fully visible at y564..606 in the panned viewport y319..623. Actual empty-list Next commits the pending player once. A 100-friend fixture loads two server pages and reaches the final row/action through real swipes. |
| User-requested presentation | At `9b27da2`/`d5cacf9`, fresh native Home confirms no added title; tapping the restored Game Stats card opens History and header Back returns Home. Final native layout-scroll and 22 mocked runner guard assertions pass. |

Screenshots alone were not treated as gesture proof. The runner rejects stale XML, clipped bounds, missing identity prerequisites and unstable UIAutomator observations. Initial dev-client readiness and later optional UIAutomator-idle failures were inconclusive, not passing navigation checks.

## Outstanding acceptance

T041 and T048 remain open; 50/52 implementation tasks are complete. Source implementation and previous automated passes do not close these gates:

- Physical Chrome landscape and collapsed browser bars. A blank HTML control reproduced the rotated viewport mismatch, so landscape is inconclusive; no application workaround was added. Original rotation settings were restored.
- TalkBack, real autofill and native error announcements.
- Packaged Android and deployed-web acceptance, including native Start against the real Java API.
- Complete real-service ended/expired/revoked recovery matrix.

W07 Terms content/link remains a separate user-deferred follow-up. Rollback requires no migration: revert the relevant slice while preserving legacy routes, membership/history, guest grants and unrelated user data.
