# User verification exception

The implementation request explicitly says: “You should not need to create any new E2E test and you should not run any E2E test”. This overrides the journey-test tasks and the general constitution coverage rule for this implementation.

Do not create BDD/Playwright journeys, run bddgen, run E2E commands, or report device/browser journey acceptance. Unit, component, Java, database and controlled backend concurrency checks remain in scope. Read-only device exploration is distinct from an E2E test; unavailable device evidence must be recorded honestly. No feature deployment or production database reset is authorized by this exception.

T037 and T075 are waived, not passed. T046, T047, T074, T076 and T080 use backend evidence only and retain client/device acceptance limitations.
# Parallel implementation and device scope, 2026-10-26

The user explicitly authorized sub-agents to implement in parallel and asked to skip Android device testing for now. Backend, unit, database and browser verification may continue. Android acceptance remains unverified; the earlier prohibition on creating/running E2E tests remains in effect.

