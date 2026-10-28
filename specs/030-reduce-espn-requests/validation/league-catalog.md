# Bundled league catalog — 2026-10-26

`constants/leagueCatalog.json` is the release-controlled source for 121 league codes, names, categories and defaults. The app and provider transport import it through `constants/leagues.ts`. League choices and the seven configured/two selected defaults are immediately available offline. Existing persisted/account selections, including empty selections, remain intact; reset is synchronous. No metadata RPC, cache, bootstrap or preference initialization flag remains.

Postgres retains the seeded identities/metadata used by matches and discovery admission. Followup migration `20261026191329_bundled_league_catalog.sql` removes the earlier `list_leagues()` functions without deleting data. `npm run check:league-catalog`, now in client CI, checks identity and metadata migration snapshots against the JSON. `node scripts/check-league-catalog.mjs --sql` generates metadata values for release migrations. Future intentional catalog changes require a new migration and updating the consistency check to its snapshot; do not edit applied migration data.

Verification: all 157 Jest suites / 987 tests pass. The updated league database suite passes 16 assertions on disposable feature030, including readable names/defaults, RPC removal, admission protection and preserved tracking. Application and six Edge entrypoints type-check. Catalog consistency, scoped ESLint and diff checks pass. React Doctor reports 90/100 with no errors and one warning for the existing sequential retry loop.

No E2E, Android, hosted migration/deployment or live ESPN request was performed. Logs remain ignored under `.supabase/feature030/static-league-*.log`.
