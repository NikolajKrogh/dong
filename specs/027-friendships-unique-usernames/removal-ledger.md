# Removal and dependency ledger

## Added tooling (T002)

| Dependency | Version | Current planned use/replacement | Status |
|---|---|---|---|
| @tanstack/react-query | 5.104.0 | Shared Friends/cloud-history fetching and cancellation, replacing manual history lifecycle | Installed; integration pending T043/T045 |
| expo-network | 57.0.1 | Native connectivity behind platform adapter | Installed; integration pending T044 |
| supabase | 2.118.0 | Reproducible CLI instead of floating npx resolution | Installed and version verified |
| Node | 26.3.1 | Same supported runtime locally and subsequently in CI | .nvmrc/engines pinned |
| pg | 8.23.0 | Independent local PostgreSQL connections for explicit race barriers | Dev-only, added for T006 |

## Dependency inventory (T003)

Read-only local catalog inspection used supabase_db_dong; no rows/schema changed.

- Account current-name SQL consumers: private.join_room_as_registered, private.sync_session_owner_participant, private.import_legacy_history, public.import_legacy_history, public.compare_registered_players. Compare current names separately from captured participant/event names.
- profiles policies: profiles_owner_insert, profiles_owner_or_friend_select, profiles_owner_update. The current TypeScript/Edge runtime has no table reader; its remaining database role is the legacy friendship policy. Remove with the table only after social authorization is replaced.
- accounts has owner insert/select/update policies. Narrow writes during username migration.
- friendships retains six direct-write/read policies; replace direct mutation permissions with commands.
- Account FK dependents: friendships (both actors, cascading), profiles, settings, private legacy import sessions/state (cascading), game_sessions owner and participants account (non-cascading). Deletion must preserve intended history and handle non-cascading references explicitly.
- delete-account Edge Function converts surviving membership rows to guests, deletes friendships, then accounts and auth user; its current calls need explicit error handling review before social cascade changes.
- utils/historyRepository.ts loadCloudHistory calls get_history_import_links; mergeHistory uses these to suppress imported local duplicates. Remove ledger only after runtime read/composition migration.
- hooks/useLegacyHistoryImport.ts owns importer auth/state; preferences importer components consume it. `utils/supabaseClient.ts` still calls `import_legacy_history`, `utils/historyRepository.ts` calls `get_history_import_links`, and `e2e/steps/browser-flow.helpers.ts` mocks import. Existing importer tests must be retired/replaced with retained-history coverage.
- Transport is embedded in utils/supabaseClient.ts alongside gameplay/guest/import clients. Extract only transport; preserve the command clients and their tests.
- Package candidates `image-size`, `js-base64`, `expo-symbols`, `expo-web-browser`, and `@react-native-community/datetimepicker` appear in the manifest but have no direct code or Expo/config-plugin reference found in the current source/config search. This is only an inventory: inspect native and peer dependency use with Knip and validate builds before removing any of them (T051/T052).
- Java `EchoCommandHandler` is referenced by `CommandDispatcherTest`; controller tests also post `echo`. Its registration is the Spring component scan. Those tests must move to the retained start-game handler or a test-local stub when Echo is removed (T053). Java start-game/persistent idempotency retained.

## Implemented decisions — 2026-10-01

This section supersedes the candidate/pending status in the initial inventory above. Static checks and unit tests are green; native/web packaging and non-unit runtime checks remain deferred under the user's instruction.

| Removed or moved scope | Replacement / retained behavior | Evidence |
|---|---|---|
| `utils/accountRepository.ts` | `features/account` owns the typed repository and username errors; `lib/supabase.ts` owns transport | TypeScript and repository/auth unit tests |
| `hooks/useHistory.ts`, `utils/historyRepository.ts` | `features/history` owns paged/abortable fetching and ID-based local/cloud composition | History/cache unit tests |
| `app/userPreferences/history-import.tsx`, `LegacyHistoryImportSection.tsx`, `LegacyHistoryImportClaimantModal.tsx`, `hooks/useLegacyHistoryImport.ts`, `utils/legacyHistoryImport.ts`, `types/legacyHistoryImport.ts` and exclusive test/E2E fixtures | Retired importer; retained local history and completed/early-leaver cloud history | Zero unused findings; history unit tests; E2E not executed |
| Active `profiles`, legacy import tables/functions/enums, import-link read/composition and direct friendship permissions | New incremental migrations; canonical accounts and private command authority | Disposable schema application/type generation only; feature SQL security tests deferred |
| Production `EchoCommandHandler` | Real start-game/idempotency behavior retained; `TestCommandConfig` supplies the demonstration command only in tests | 32 Java unit tests, all test sources compiled |
| `components/preferences/OnboardingButton.tsx`, `utils/leagueLogos.ts`, redundant barrel/default exports, unreferenced types/helpers/wrappers | Existing active onboarding and team-logo paths; single export form per component; platform adapters retained | Zero Knip issues and TypeScript diagnostics |
| Knip baseline and custom ratchet wrapper | Native `knip` zero-issue gate | Positive check and deliberate-unused-file negative gate |

Removed direct packages: `image-size`, `js-base64`, `react-native-dropdown-select-list`, `@types/uuid`, `ts-jest`, `@react-native-community/datetimepicker`, `dayjs`, `expo-blur`, `expo-haptics`, `expo-symbols`, `react-native-modal-datetime-picker`, and `@tamagui/cli`. Authored source/config and peer ownership were reviewed. The active native picker remains `react-native-date-picker`; `dayjs`/`expo-symbols` remain where transitively owned. `expo-web-browser` is retained for its Expo configuration plugin. Native packaging has not been validated.

| Added dependency | Actual use / scope |
|---|---|
| `@tanstack/react-query` 5.104.0 | Friends/history request lifecycle, cancellation, confirmed-command invalidation and identity isolation; replaces duplicated cloud-fetch state |
| `expo-network` 57.0.1 | Native connectivity adapter driving Query online lifecycle |
| `supabase` 2.118.0 | Pinned development CLI for migrations/generated contracts |
| `knip` 6.39.0 | Development-only unused-code/dependency gate, replacing manual/baselined inventory |
| `pg` 8.23.0 | Development-only independent PostgreSQL connection/barrier runner; feature race scenarios deferred |
| `@jest/globals`, `jest-environment-jsdom` 29.7.0 | Explicit test/runtime dependencies rather than relying on transitive installation |

All removal categories pass lint, type and unused-code gates, plus 513 client unit tests. Runtime Query/connectivity integration is implemented; no new generic command bus or speculative framework was introduced. Applied historical migrations remain replayable and were not deleted or rewritten to squash history.

### Follow-up disposable file removal — 2026-10-02

Removed `.nvmrc` (duplicate Node pin), root `deno.lock` (typecheck-generated artifact), and the whole `.local-db-validation` scratch workspace (logs, repair scripts, caches and generated database mirrors). CI reads `package.json`; Deno checks disable lockfile generation; the upgrade script recreates the disposable database workspace on demand. Retained the checksum-pinned Unicode source and its license because the generator actually consumes them. Two generator unit tests, Edge type checks, CI YAML parsing and whitespace checks passed. No database/platform test execution or Docker resource deletion occurred.


## Tooling scope correction — 2026-10-02

At the user's request, removed the added upgrade runner, dependent generic concurrency-barrier runner, their package commands and CI steps, and the unused development-only pg dependency. Existing db:start/db:reset/db:test and generated-type checks remain. No additional database test runner is required. Restored .gitignore byte-for-byte to HEAD; this change contains no .gitignore edits. Earlier references to a recreated/ignored scratch workspace are historical and superseded. Upgrade/race execution remains unverified.
