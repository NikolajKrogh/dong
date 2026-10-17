# Feature 029 reviewed evidence

Implementation and acceptance details: [validation ledger](../../specs/029-web-android-ux/validation.md). These are selected reviewed images and secret-free measurements. A screenshot demonstrates the shown state; gesture, lifecycle and permission claims depend on the paired assertions/runtime report.

| Files | Platform / build / scope |
| --- | --- |
| `setup-320-text200*.png`, `setup-320-text200-bounds.json` | Installed desktop Chromium, 320×640 and 200% text simulation, compact action wrapping correction `c99975a`. Complete Home/Next buttons, labels and icons fit. |
| `setup-landscape-after-scroll.png`, `long-team-names.png` | Browser fixtures, 640×360 landscape and long selected team names; final actions reachable. These are not the inconclusive physical landscape run. |
| `friends-100-last.png`, `history-100-last.png` | Controlled browser datasets, last row of 100 items. |
| `setup-keyboard-offset319-20-players.*` | C's trusted-touch Chromium regression at `4dabfc5` (integrated `7f40c70`), simulated visual height304/offset319 with20 players. Cropped to the visible window. |
| `native-member-room-configuration.png` | Huawei CLT-L29 Android10, development bundle `5655d69`, local registered member: same room participants, Return/Home/Leave, no owner-only End action. |
| `native-guest-room-status.png` | Same device, development bundle `7f40c70`, actual native guest: read-only status, four players/six matches, complete Close/Home controls. |
| `native-guest-text130.png` | Same native build at130% system text; complete status and Close/Home actions fit. Original system text size restored afterward. |
| `physical-chrome-empty-ime-next.*` | Physical Chrome155, `7f40c70`, empty list plus pending name, real keyboard/swipes. Next completely visible at visual offset319; actual tap advances and commits the pending player once. |
| `physical-chrome-20-ime-next.*` | Same physical browser/build,20 saved local players, real swipes over list, focused original input/pending name preserved, Next completely visible above keyboard. JSON records trusted touch events and scroll/bounds. |
| `physical-chrome-friends100.*` | Same physical browser/build,100 accepted friends from isolated local Supabase, two pages. Real swipes reach final row and complete action; no friendship mutation. |
| `physical-landscape-blank-control.json` | Inconclusive environment control: a blank page without DONG reports a viewport taller than the physical rotated screen. It is not a passing landscape result or evidence of a DONG source defect. |
| `physical-chrome-empty-next-once.json` | After actual empty-list Next activation: Matches route and exactly one pending player persisted. |
| `web-export-runtime.json` | Selected final production-export smoke metadata for `7f40c70`:7/7 checks, binary icon-font responses, no browser errors and owned processes stopped. Loopback runtime only. |

Native snapshots use disposable local identities. No passwords, tokens, guest grants or private hierarchy dumps are included. Full transient logs, local fixture helpers and credentials remain ignored under `test-results/`.
