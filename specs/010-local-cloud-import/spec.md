# Feature Specification: One-Time Local-to-Cloud Import

**Feature Branch**: `127-us24-add-one-time-local-to-cloud-import-for-existing-registered-users`
**Created**: 2026-05-09
**Status**: Draft
**Input**: User description: "Plan implementation for issue #127 '[US2.4] Add one-time local-to-cloud import for existing registered users' using parent epic #115 for context."

## Clarifications

### Session 2026-05-09

- Q: Should the one-time import be enforced per registered account or per device history set? → A: Per registered account; once one import succeeds, later imports for that account only dedupe already-imported sessions.
- Q: How should the importer decide which legacy local participant becomes the signed-in account? → A: Ask the user to pick one local participant once during import, then use that choice to create the registered participant rows.
- Q: How should duplicate imports be detected for the same legacy local session? → A: Server stores a deterministic fingerprint for each legacy local session and treats matching fingerprints as already imported.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Start Import From Settings (Priority: P1)

As a signed-in registered user with legacy local history on my device, I can start a one-time import from Settings, choose which local participant represents my account, and move my existing local games into the cloud without rebuilding them manually.

**Why this priority**: Without a clear entry point and first successful import, the feature delivers no user value.

**Independent Test**: Sign in, open Settings, run import on a device with legacy local sessions, and confirm the app reports completion and leaves a cloud-backed copy of the sessions.

**Acceptance Scenarios (Gherkin style)**:

1. **Given** a signed-in registered user with eligible local sessions on the device, **When** they start the import flow and choose the local participant that represents their account, **Then** the system begins importing the eligible sessions and shows progress or status.
2. **Given** a signed-in registered user with no eligible local sessions, **When** they open the import action, **Then** the system shows an empty-state message and performs no cloud writes.
3. **Given** an import completes successfully, **When** the user returns to the app, **Then** the imported sessions are available through the cloud-backed history source.

---

### User Story 2 - Avoid Duplicate Imports (Priority: P1)

As a signed-in registered user, I can retry the import safely so that an interrupted or repeated run does not create duplicate cloud sessions.

**Why this priority**: Idempotency is required before the feature can be trusted on a flaky network or across multiple devices.

**Independent Test**: Run the same import twice against the same local history dataset and verify cloud session counts do not increase after the first success.

**Acceptance Scenarios (Gherkin style)**:

1. **Given** a local session that was already imported, **When** the import flow runs again, **Then** the existing cloud session is reused and not duplicated.
2. **Given** a cloud import fails partway through a batch, **When** the user retries, **Then** sessions that already succeeded are not written again.
3. **Given** the same legacy local dataset is imported from another signed-in device for the same account, **When** the flow runs, **Then** repeated source sessions are still deduplicated.

---

### User Story 3 - Preserve Legacy Guest Participants (Priority: P2)

As a signed-in registered user, I can import sessions that contained non-account players so those players remain session-scoped guest snapshots in the cloud.

**Why this priority**: Preserving guest identity is necessary for history fidelity and for avoiding accidental promotion of temporary players into durable accounts.

**Independent Test**: Import a session with a mix of account-linked and guest-like local players and confirm guest rows remain session-scoped and non-claimable.

**Acceptance Scenarios (Gherkin style)**:

1. **Given** imported sessions include non-account participants, **When** the import completes, **Then** those participants are stored as guest-scoped session identities.
2. **Given** imported sessions include the same display name as a durable account, **When** the import completes, **Then** the system does not auto-convert that guest into a registered account record.
3. **Given** a successful import, **When** the user opens history, **Then** guest rows remain visible only inside the imported session they came from.

---

### Edge Cases

- No legacy local history exists on the device.
- The signed-in account changes while import is in progress.
- A session was imported successfully but the client never received the success response.
- A local snapshot is incomplete or corrupted and cannot be translated into a valid cloud session.
- The same import is started from more than one device for the same signed-in account.
- The same signed-in account starts import again from another device after a successful import and the flow should no-op or report already imported rather than creating new cloud sessions.
- The same legacy local session is imported again from a different device or after a retry, but the fingerprint matches an already imported source session.
- A legacy session contains duplicate names or several guests with the same display name.
- The user-selected local participant is ambiguous because the same display name appears in multiple legacy sessions or multiple players share the same name within one session.
- Import succeeds for some sessions and fails for others in the same batch.

## Platform & State Impact _(mandatory when applicable)_

- **Platform Behavior**: The import entry point lives in the signed-in settings experience and must work consistently on native and web. If the user is signed out or has no local history, the import action should degrade to a clear empty or disabled state.
- **Shared State Model**: Local persisted history remains the source of the legacy dataset until import runs. Once imported, cloud history becomes the durable record for those sessions, and repeated import attempts must be safe to replay.
- **Shared State Model**: Local persisted history remains the source of the legacy dataset until import runs. Once imported, cloud history becomes the durable record for those sessions, and repeated import attempts must be safe to replay using a deterministic source fingerprint for each legacy local session.
- **Identity Model**: The signed-in registered account owns the imported sessions. Legacy player rows that do not already map to a durable account remain guest-scoped session members. Import must not create new claimable identities for those guests.
- **Identity Model**: The signed-in registered account owns the imported sessions and is linked to one user-selected legacy participant from the imported history. Other local player rows remain guest-scoped session members. Import must not create new claimable identities for those guests.
- **Migration / Backfill**: This is a one-time backfill from existing device-local history into cloud history, not an ongoing sync pipeline. The feature must preserve enough source identity to prevent duplicate imports on later retries.
- **Migration / Backfill**: This is a one-time backfill from existing device-local history into cloud history, not an ongoing sync pipeline. The import is enforced per registered account, so later attempts from the same account must not create new cloud sessions once the first import has completed.

## Delivery & Automation Impact _(mandatory)_

- **Unit Test Coverage**: Cover the local-session-to-cloud payload mapping, session deduplication, guest preservation, status transitions, and partial retry behavior.
- **E2E Test Coverage**: Yes. Add a primary end-to-end flow for a signed-in user starting import from Settings, completing it, and then seeing the imported sessions in cloud-backed history.
- **Applicable Skills**: `supabase`, `supabase-postgres-best-practices`, `database-testing`, `react-native-testing`

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST allow a signed-in registered user to start a one-time import of legacy local history from an in-app settings surface.
- **FR-002**: The system MUST translate each eligible local session into a cloud-backed session record that preserves the session date, participants, matches, assignments, common match, and summary totals.
- **FR-003**: The system MUST keep the importing account as the durable owner of the imported session.
- **FR-003**: The system MUST let the user choose one legacy local participant to represent the importing registered account and MUST create that participant as the account-linked row during import.
- **FR-004**: The system MUST preserve non-account local players as guest-scoped session participants during import.
- **FR-005**: The system MUST ensure that repeated import attempts do not create duplicate cloud sessions for the same legacy source session.
- **FR-005**: The system MUST ensure that repeated import attempts do not create duplicate cloud sessions for the same legacy source session.
- **FR-006**: The system MUST report per-session import status so the user can distinguish imported, skipped, and failed sessions.
- **FR-007**: The system MUST allow failed sessions to be retried without re-importing sessions that already succeeded.
- **FR-008**: The system MUST make imported sessions visible in cloud-backed history after a successful import.
- **FR-009**: The system MUST not delete or overwrite the original local history as part of import.
- **FR-010**: The system MUST not promote guest participants into durable registered-user records during import.
- **FR-011**: The system MUST treat the import as complete for a registered account after the first successful run and MUST no-op or report already imported on later runs for the same account.
- **FR-012**: The system MUST store a deterministic source fingerprint for each legacy local session and use that fingerprint to recognize already imported sessions across retries and devices.

### Key Entities _(include if feature involves data)_

- **Legacy Local Session Snapshot**: A completed local game record containing players, matches, assignments, common match, and drink totals.
- **Import Batch**: One attempt to move a set of local sessions into cloud history for a signed-in account.
- **Imported Cloud Session**: A cloud-backed session created from a legacy snapshot and visible in history.
- **Claimed Local Participant**: The legacy local participant the user selects to represent the signed-in account during import.
- **Source Fingerprint**: The deterministic identifier derived from a legacy local session snapshot that allows the system to recognize the same session on retry or from another device.
- **Import Status**: The current state of an individual session within an import batch, such as pending, imported, skipped, or failed.
- **Guest Participant Snapshot**: A local player carried into cloud history as a session-scoped participant without durable account ownership.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: In validation, a signed-in user can complete a typical import flow from Settings in under 2 minutes.
- **SC-002**: In validation, 100% of eligible local sessions are imported exactly once, even when the import flow is retried.
- **SC-003**: In validation, re-running the same import on the same dataset creates zero duplicate cloud sessions.
- **SC-004**: In validation, guest participants remain session-scoped in 100% of imported sessions.
- **SC-005**: In validation, partial failures are reported per session and successful sessions remain imported after retry.

## Assumptions

- Legacy local history is already present on the device and is the source of truth for the import.
- The importing signed-in account owns the imported sessions, while non-account local players remain guest-scoped.
- The importing signed-in account is linked to one user-selected local participant identity during import.
- The feature is a migration aid, not a permanent two-way sync between local and cloud storage.
- Cloud-backed history already exists or will exist by the time this feature ships, so imported sessions only need to conform to that contract.
- Existing local history may remain on device after import until a later cleanup decision.
