# Verification and rollout

```powershell
npm run typecheck
npm run lint
node --no-experimental-webstorage -r ./scripts/jest-ci-env.cjs node_modules/jest/bin/jest.js --runInBand --watchAll=false __tests__/features/rooms __tests__/features/game-setup
npx bddgen
npx playwright test editable-automatic-assignments --workers=1
npx react-doctor@latest . --scope changed --base HEAD
```

Run supabase/tests/database/editable_automatic_assignments.test.sql against an isolated migrated Supabase database. It covers explicit overrides, authorization, malformed picks, configuration conflicts, common insertion, persisted mode, idempotency and running saves. Retain the existing proposal tests for old-client compatibility.

Apply 20261107162059_editable_automatic_assignments.sql before deploying the client. Verify editableAutomaticAssignments in room snapshots. Check a real host's Automatic → adjust → Start and running Edit → Save with exact selections preserved before rollout is considered complete.

Development evidence is under artifacts/assignment-*. Phone browser checks use isolated mocked room services; they do not replace live-server rollout verification.

## Verified locally

- 361 room/setup unit and component checks passed; focused hook/card checks were repeated after the last changes.
- Four new host Playwright journeys passed across phone and desktop viewports. Existing local setup and two-device player-picking journeys passed after updating setup to make explicit picks and accepting the current creation RPC in the shared mock.
- Connected Android Chrome passed full-page axe in light and dark themes, including a long name and 34 non-common fixtures. Screenshots include assignment-phone-grid.png and assignment-phone-stress-grid.png.
- Isolated SQL checks cover editable overrides, existing proposals, targets and modes. The clone required restoring source-equivalent test-role permissions after its schema-only import.
- Type checking and scoped lint passed. Full lint still reports errors in pre-existing artifacts/host-ux-phone scripts. React Doctor scored 93/100 with five complexity warnings.

The compatible migration was applied to the linked hosted DONG project. Real-service end-to-end rollout remains unverified.

## Presentation refinement checks

The Players pick refinement passed all 1,201 unit/component tests and 14 phone/desktop BDD journeys, including pick changes after review. Type checking and scoped lint passed. Connected Android Chrome passed axe on Automatic, Host assigns, Players pick and reviewed picks; screenshots are `artifacts/players-pick-phone-*.png`. Phone checks use isolated fixtures and confirm a single-row footer without changing the user's current room. Full lint remains blocked by existing artifact-script errors. No database migration is required.

The compact local/host presentation passed 361 room/setup unit and component checks, phone/desktop Playwright journeys for local setup, editable Automatic and two-device Players pick, and full-page axe on connected Android Chrome. Phone checks include light Host assigns and Automatic, plus dark Automatic with a long name and 34 non-common fixtures. Type checking and scoped ESLint passed. React Doctor reports one complexity warning in the shared card. These checks use isolated room fixtures; this presentation refinement requires no new database migration.

The subsequent card correction restores the original gradient, team columns, VS, numbered badge and kickoff footer. Only assignment surfaces opt into compact spacing/logo sizes; default cards keep their original dimensions. Card tests include default/compact gradient parity and the unselected assignment-grid gradient. All 363 room/setup tests pass; phone axe checks cover light and dark list/grid variants.
