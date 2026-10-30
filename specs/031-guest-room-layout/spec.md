# Guest room: Matches first

Created: 2026-10-30. Approved direction: dedicated guest page with Matches and Room tabs.

## User stories and acceptance

### P1 — Join and choose matches

- Given an unauthenticated player on Home, when joining succeeds, then the join dialog closes and the Matches tab opens on the guest-room page.
- Given player-picked mode, when a match is selected, then the existing shared panel saves automatically and enforces the server's pick cap.
- Given selected matches, when Clear picks is pressed, then an empty pick set is submitted; the action is hidden with zero picks and disabled while saving.
- Given either host or guest picking, then the same cards and quiet Clear picks action are used.

### P1 — Inspect the room without losing selections

- Given saved picks, when Room is selected, then the common match, expanded active roster, host/current-player labels and per-player pick progress appear.
- When returning to Matches, then selections are retained without a write caused by switching tabs.
- Given automatic mode, then the guest is told assignments happen at start. Given host-assigned mode, then their assigned matches are read-only or a waiting message is shown.

### P1 — Recover and navigate safely

- Given multiple mounted screens, then there is one guest-session controller and polling loop.
- Given the same browser session reloads, then protected guest access restores. Credentials never appear in URLs or visible content.
- Given Home or Android Back navigation, then membership is retained. Only confirmed Leave room initiates departure.
- Given observed host start, then gameplay hydrates and navigation happens once. Restoring an already-running room does not force a gameplay redirect.
- Given renewal, expiry, failed refresh, pending departure, completed room or host termination, then existing access protection and recovery behavior remains available.

## Constraints

Expo/React Native and web; Tamagui tokens; 16px mobile gutters; desktop content capped at 960px; one scrolling region. Keyboard-accessible tabs, focus indicators, 44px action targets, safe areas and status announcements are required.

No backend/schema, storage format, assignment-rule, dependency or deployment changes. The user explicitly prohibited testing on their Android phone; use browser and local automated checks and report native verification as outstanding.

## Required coverage

Session lifecycle and shared ownership unit tests; component tests for modes and selection controls; Playwright BDD for join, tab switching, clearing and observed start on phone-sized and desktop web; credential/recovery regressions; light/dark and long-content visual checks.
