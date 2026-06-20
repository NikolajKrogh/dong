# Tasks: ESPN Proxy and Normalized Match Endpoints

**Input**: Design documents from `specs/015-espn-match-proxy/`  
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅  
**Applicable Skills**: `java-springboot`, `openapi-to-application-code`, `react-native-testing` (loaded and followed per Constitution Principle VI)

**Tests**: Every story includes required backend unit/integration coverage. This feature also includes a narrow Expo hook/component regression because the setup-game match discovery transport changes. No end-to-end browser flow is required for this issue.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallelizable (different files, no incomplete-task dependency)
- **[Story]**: maps to spec.md user stories (US1–US3)
- Every task includes exact repository-relative file paths

---

## Phase 1: Setup

**Purpose**: Add feature-wide configuration and developer setup surfaces before backend/client implementation starts.

- [x] T001 Add match-discovery defaults for the supported league allowlist, ESPN base URL, and default PT5M cache TTL in `command-api/src/main/resources/application.yml`
- [x] T002 [P] Add match-discovery environment examples and startup notes in `command-api/.env.example` and `command-api/README.md`
- [x] T003 [P] Add `EXPO_PUBLIC_COMMAND_API_URL` setup guidance to `README.md`

**Checkpoint**: Repo docs and config surfaces describe how to run the command API and Expo app together for this feature.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared backend and client infrastructure that must exist before any user story can be completed.

**⚠️ CRITICAL**: No user story work should begin until this phase is complete.

- [x] T004 Create canonical match-discovery config and query types in `command-api/src/main/java/com/dong/commandapi/match/MatchDiscoveryProperties.java` and `command-api/src/main/java/com/dong/commandapi/match/MatchQuery.java`
- [x] T005 [P] Extend match-discovery error codes and advice mapping in `command-api/src/main/java/com/dong/commandapi/error/ErrorCode.java` and `command-api/src/main/java/com/dong/commandapi/error/GlobalExceptionHandler.java`
- [x] T006 [P] Permit unauthenticated `GET /v1/matches` in `command-api/src/main/java/com/dong/commandapi/security/SecurityConfig.java`
- [x] T007 [P] Create the ESPN outbound boundary in `command-api/src/main/java/com/dong/commandapi/match/espn/EspnClient.java` and `command-api/src/main/java/com/dong/commandapi/match/espn/EspnScoreboardResponse.java`
- [x] T008 [P] Create normalized response DTOs and mapper scaffolding in `command-api/src/main/java/com/dong/commandapi/match/dto/NormalizedMatch.java` and `command-api/src/main/java/com/dong/commandapi/match/MatchNormalizer.java`
- [x] T009 Create the Expo command API transport helper in `utils/commandApiClient.ts`
- [x] T010 Create the shared match-discovery service/controller shells in `command-api/src/main/java/com/dong/commandapi/match/MatchDiscoveryService.java` and `command-api/src/main/java/com/dong/commandapi/match/MatchDiscoveryController.java`

**Checkpoint**: The repo has a public route slot, shared query/config types, match-specific error codes, and a client transport helper ready for story work.

---

## Phase 3: User Story 1 - Fetch Normalized Match Lists (Priority: P1) 🎯 MVP

**Goal**: Deliver a public backend endpoint and client hook path that return flat normalized match data for supported league codes.

**Independent Test**: Call `GET /v1/matches` with supported `leagueCode` values and an optional `requestedAt`, then verify the response is a flat normalized match array and `useMatchData` still feeds `MatchList` without additional consumer changes.

### Tests for User Story 1 (REQUIRED coverage) ⚠️

- [x] T011 [P] [US1] Add public happy-path and default-date integration coverage in `command-api/src/test/java/com/dong/commandapi/match/MatchDiscoveryControllerTest.java`
- [x] T012 [P] [US1] Add scoreboard-to-normalized mapping coverage in `command-api/src/test/java/com/dong/commandapi/match/MatchNormalizationTest.java`
- [x] T013 [P] [US1] Add command API transport regression coverage in `__tests__/hooks/useMatchData.test.tsx`
- [x] T014 [P] [US1] Add backend-backed match-list regression coverage in `__tests__/components/setupGame/MatchList.platform.test.tsx`

### Implementation for User Story 1

- [x] T015 [P] [US1] Implement the outbound ESPN fetch adapter in `command-api/src/main/java/com/dong/commandapi/match/espn/RestClientEspnClient.java`
- [x] T016 [P] [US1] Implement normalized match mapping in `command-api/src/main/java/com/dong/commandapi/match/MatchNormalizer.java` and `command-api/src/main/java/com/dong/commandapi/match/dto/NormalizedMatch.java`
- [x] T017 [US1] Implement successful multi-league query aggregation in `command-api/src/main/java/com/dong/commandapi/match/MatchDiscoveryService.java`
- [x] T018 [US1] Implement the public OpenAPI-documented match endpoint in `command-api/src/main/java/com/dong/commandapi/match/MatchDiscoveryController.java`
- [x] T019 [US1] Replace direct ESPN match discovery in `hooks/useMatchData.ts` using `utils/commandApiClient.ts` while preserving the existing `apiData`, `teamsData`, and `availableLeagues` return shape

**Checkpoint**: User Story 1 is independently functional. The app can load normalized matches through the backend without direct ESPN calls for discovery.

---

## Phase 4: User Story 2 - Keep Client Flows Independent of Upstream Failures (Priority: P1)

**Goal**: Reject invalid queries cleanly and translate upstream outages or malformed payloads into controlled client-safe errors while preserving empty-result behavior.

**Independent Test**: Send invalid dates or unsupported league codes and receive validation errors; simulate upstream timeout, 429/rate-limit, malformed payload, and no-match responses and confirm controlled backend behavior plus client-safe hook state.

### Tests for User Story 2 (REQUIRED coverage) ⚠️

- [x] T020 [P] [US2] Add invalid-date and unsupported-league validation coverage in `command-api/src/test/java/com/dong/commandapi/match/MatchDiscoveryControllerTest.java`
- [x] T021 [P] [US2] Add upstream unavailable, 429/rate-limit, malformed payload, and empty-result coverage in `command-api/src/test/java/com/dong/commandapi/match/MatchDiscoveryServiceTest.java`
- [x] T022 [P] [US2] Add sanitized error and empty-state regression coverage in `__tests__/hooks/useMatchData.test.tsx`

### Implementation for User Story 2

- [x] T023 [P] [US2] Implement ISO 8601 parsing, default-date resolution, and supported league validation in `command-api/src/main/java/com/dong/commandapi/match/MatchQuery.java` and `command-api/src/main/java/com/dong/commandapi/match/MatchDiscoveryController.java`
- [x] T024 [P] [US2] Implement controlled upstream timeout, 429/rate-limit, malformed payload, and empty-result handling in `command-api/src/main/java/com/dong/commandapi/match/MatchDiscoveryService.java` and `command-api/src/main/java/com/dong/commandapi/match/espn/RestClientEspnClient.java`
- [x] T025 [US2] Update `hooks/useMatchData.ts` to surface client-safe `isError` and `errorMessage` behavior from command API failures without exposing upstream details

**Checkpoint**: User Story 2 is independently functional. Invalid input and upstream problems are sanitized at the backend boundary and handled safely by the client hook.

---

## Phase 5: User Story 3 - Protect Repeated Match Lookups (Priority: P2)

**Goal**: Reuse identical short-term queries through TTL caching inside the configured default PT5M window and in-flight coalescing so the upstream provider is not hit redundantly.

**Independent Test**: Issue repeated identical queries within the configured TTL window and verify cache hits/coalescing suppress duplicate upstream calls while the endpoint still returns stable results.

### Tests for User Story 3 (REQUIRED coverage) ⚠️

- [x] T026 [P] [US3] Add cache-hit, configured-TTL expiry, injected-`Clock`, and in-flight coalescing coverage in `command-api/src/test/java/com/dong/commandapi/match/MatchCacheServiceTest.java`
- [x] T027 [P] [US3] Add repeated-query integration coverage in `command-api/src/test/java/com/dong/commandapi/match/MatchDiscoveryControllerTest.java`

### Implementation for User Story 3

- [x] T028 [P] [US3] Implement the in-memory TTL cache and in-flight request registry in `command-api/src/main/java/com/dong/commandapi/match/MatchCacheService.java`
- [x] T029 [US3] Wire cached reuse into `command-api/src/main/java/com/dong/commandapi/match/MatchDiscoveryService.java` and `command-api/src/main/java/com/dong/commandapi/match/MatchDiscoveryProperties.java`

**Checkpoint**: User Story 3 is independently functional. Repeated identical requests are suppressed through caching/coalescing without changing the response contract.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Finish feature-wide documentation and executable validation after all stories land.

- [x] T030 [P] Update public endpoint usage and environment examples in `command-api/README.md` and `README.md`
- [x] T031 [P] Align sample requests and validation steps in `specs/015-espn-match-proxy/quickstart.md` and `specs/015-espn-match-proxy/contracts/match-discovery.md`
- [x] T032 [P] Add focused latency validation for `GET /v1/matches` in `command-api/src/test/java/com/dong/commandapi/match/MatchDiscoveryPerformanceTest.java`
- [x] T033 Run backend and Expo validation from `specs/015-espn-match-proxy/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: starts immediately
- **Foundational (Phase 2)**: depends on Setup and blocks all story work
- **User Story 1 (Phase 3)**: starts after Foundational and delivers the MVP
- **User Story 2 (Phase 4)**: starts after Foundational; because it extends the same endpoint/controller/service slice as US1, sequence it after the US1 happy-path implementation unless multiple contributors coordinate tightly
- **User Story 3 (Phase 5)**: starts after Foundational; practically follows US1 because cache wiring depends on the query/service path being in place
- **Polish (Phase 6)**: depends on the stories you intend to ship

### User Story Dependencies

- **US1 (P1)**: no user-story dependency after Phase 2; this is the MVP slice
- **US2 (P1)**: acceptance criteria are independently testable, but implementation extends the same backend/client transport files as US1
- **US3 (P2)**: acceptance criteria are independently testable, but implementation extends the same backend service path as US1

### Within Each User Story

- Write the listed tests first and confirm they fail
- Implement DTOs/adapters before service logic
- Implement service logic before controller/client wiring
- Re-run the story-scoped tests before moving on

### Parallel Opportunities

- `T002` and `T003` can run in parallel during Setup
- `T005`–`T008` can run in parallel during Foundational while `T004` establishes the shared query/config types
- US1 tests `T011`–`T014` can run in parallel
- US1 implementation tasks `T015` and `T016` can run in parallel before `T017`
- US2 tests `T020`–`T022` can run in parallel
- US2 implementation tasks `T023` and `T024` can run in parallel before `T025`
- US3 tests `T026` and `T027` can run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch User Story 1 test work together:
Task: "Add public happy-path and default-date integration coverage in command-api/src/test/java/com/dong/commandapi/match/MatchDiscoveryControllerTest.java"
Task: "Add scoreboard-to-normalized mapping coverage in command-api/src/test/java/com/dong/commandapi/match/MatchNormalizationTest.java"
Task: "Add command API transport regression coverage in __tests__/hooks/useMatchData.test.tsx"
Task: "Add backend-backed match-list regression coverage in __tests__/components/setupGame/MatchList.platform.test.tsx"

# Launch independent backend building blocks together:
Task: "Implement the outbound ESPN fetch adapter in command-api/src/main/java/com/dong/commandapi/match/espn/RestClientEspnClient.java"
Task: "Implement normalized match mapping in command-api/src/main/java/com/dong/commandapi/match/MatchNormalizer.java and command-api/src/main/java/com/dong/commandapi/match/dto/NormalizedMatch.java"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. Validate `GET /v1/matches` plus the `useMatchData` consumer regression before expanding scope

### Incremental Delivery

1. Ship US1 to move match discovery off direct ESPN calls
2. Add US2 to harden validation and upstream failure handling
3. Add US3 to protect ESPN from repeated identical requests
4. Finish with Phase 6 documentation and quickstart validation

### Parallel Team Strategy

With multiple contributors:

1. One contributor handles Setup + Foundational backend/security/config work
2. After Phase 2, split US1 between backend (`T015`–`T018`) and Expo client (`T013`, `T014`, `T019`)
3. Follow with US2 hardening and US3 caching as the backend slice stabilizes

---

## Notes

- 33 tasks total
- Every task uses exact file paths and the required checklist format
- No end-to-end browser automation is required for this issue; focused backend and Expo regression coverage is sufficient per the spec and plan
- Live-score polling stays out of scope for this task list; only setup-game match discovery moves behind the backend in this feature