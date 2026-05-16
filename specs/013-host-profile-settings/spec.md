# Feature Specification: Host Profile and Synced Settings

**Feature Branch**: `013-host-profile-settings`  
**Created**: 2026-05-15  
**Status**: Draft  
**Input**: User description: "Issue #129: Allow a signed-in host to manage profile and synced settings"

## Clarifications

### Session 2026-05-15

- Q: Which settings should be cloud-synced for this issue? → A: Sync all settings already exposed in preferences that are meant to persist across devices: theme, sound, common match notifications, configured leagues, and default selected leagues.
- Q: What validation rules should the username/handle follow? → A: Trimmed and non-empty only; duplicates and punctuation are allowed.
- Q: Where should the editable profile data be stored? → A: Keep editable profile data on the existing account identity row and store synced settings in the existing settings row.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Edit Host Profile Details (Priority: P1)

As a signed-in host, I can open my profile area from preferences, update my visible profile details, and save them so my identity stays current across the app.

**Why this priority**: Profile editing is the primary value in the issue and is the basis for the rest of the profile/settings experience.

**Independent Test**: Sign in, change the profile fields from the preferences screen, save them, and confirm the updated values appear again after leaving and returning to the app.

**Acceptance Scenarios (Gherkin style)**:

1. **Given** a signed-in host on the preferences screen, **When** they update their profile with valid values and save, **Then** the saved profile is updated and the new values appear in the profile section.
2. **Given** a signed-in host who previously saved profile changes, **When** they relaunch the app or revisit preferences, **Then** the saved profile values are restored.
3. **Given** a signed-in host editing their profile, **When** they enter a blank display name or a blank username/handle, **Then** the app rejects the change and keeps the previous saved profile intact.

---

### User Story 2 - Sync Supported Preferences Across Devices (Priority: P1)

As a signed-in host, I can change supported app preferences and have them follow my account so my setup feels consistent on every device I use.

**Why this priority**: Cross-device consistency is the main reason these settings are cloud-backed rather than device-only.

**Independent Test**: Change the supported preference controls on one signed-in device, then sign in on another device or restart the app and confirm the same values are restored.

**Acceptance Scenarios (Gherkin style)**:

1. **Given** a signed-in host who changes supported preference controls, **When** they save those changes, **Then** the new values are stored with their account and restored on the next session.
2. **Given** a signed-in host who opens the app on another device, **When** the account is restored, **Then** the supported preference values match the last saved account state.

---

### User Story 3 - Handle Sign-Out and Session Expiration Safely (Priority: P2)

As a signed-in host, I can sign out or lose my session without corrupting my profile data or settings, so the app returns to a safe state instead of failing unpredictably.

**Why this priority**: Session loss is less common than normal editing, but the app must handle it cleanly to avoid broken preferences screens and partial saves.

**Independent Test**: Sign out from preferences or simulate an expired session while viewing the profile area, then confirm the app exits the signed-in state cleanly and keeps saved account data intact.

**Acceptance Scenarios (Gherkin style)**:

1. **Given** a signed-in host on the preferences screen, **When** they sign out, **Then** the profile section returns to the signed-out state and account-only actions stop being available.
2. **Given** a signed-in host whose session expires while they are using preferences, **When** the app detects the expired session, **Then** it clears the signed-in state safely and shows the signed-out experience.
3. **Given** a host whose session ends during a save attempt, **When** the save cannot be completed, **Then** the app reports the failure without corrupting the last saved profile or settings.

---

### Edge Cases

- A host submits a profile update with a blank or whitespace-only display name.
- A host enters a username or handle that is blank or whitespace-only.
- Two signed-in devices for the same account change preferences independently and the later successful save becomes the active account state.
- A session expires while a profile or settings save is in flight.
- A host signs out and then returns to the preferences screen before reauthenticating.
- The app restarts while only some supported preferences have synced to the cloud.
- Device-local preferences that are not part of the cloud-backed set remain available even when the account session is lost.

## Platform & State Impact _(mandatory when applicable)_

- **Platform Behavior**: The preferences experience must behave consistently on native and web, including restoring profile data and supported settings after reload or device change.
- **Shared State Model**: Local gameplay state remains separate from account profile and cloud-synced settings. Signed-in account data becomes the source of truth for the profile area and supported preferences, while local-only settings stay device-scoped.
- **Identity Model**: The signed-in host owns a durable account profile. The visible display name may differ from the account username/handle, and the profile section must reflect the current saved account identity rather than an unsaved draft.
- **Migration / Backfill**: Existing local preference values should continue to work for current users, and the cloud-backed profile/settings record should be initialized from the user’s current saved values the first time they successfully sync.

## Delivery & Automation Impact _(mandatory)_

- **Unit Test Coverage**: Cover profile-field validation, profile save and restore, supported-settings sync, session-expiration handling, and sign-out behavior in the auth/profile hook and preferences screen tests.
- **E2E Test Coverage**: Yes. Add a primary web journey that signs in, edits profile values, changes supported settings, reloads or reopens the app, and verifies the restored values. Include a sign-out and expired-session path for the preferences screen.
- **Applicable Skills**: supabase, database-testing, react-native-testing, playwright-bdd

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The app MUST allow a signed-in host to view and edit their profile from the preferences area.
- **FR-002**: The app MUST allow the host to update their visible display name and save the change to their cloud-backed account profile.
- **FR-003**: The app MUST allow the host to change their username or handle subject to validation rules that require a trimmed, non-empty value.
- **FR-004**: The app MUST reject invalid profile values and preserve the last saved profile when validation fails.
- **FR-005**: The app MUST sync supported preference settings to the host’s cloud-backed account state so they are restored on later sessions and other devices.
- **FR-006**: The app MUST keep supported cloud-backed settings consistent after the host signs in again on the same or another device.
- **FR-007**: The app MUST keep device-local settings and non-profile app data intact when the host signs out or loses their session.
- **FR-008**: The app MUST handle sign-out and expired sessions by returning the preferences experience to a safe signed-out state without corrupting saved profile or settings data.
- **FR-009**: The app MUST explain validation and session failures in user-facing language that lets the host recover without losing the last saved state.

### Key Entities _(include if feature involves data)_

- **Host Profile**: The signed-in host’s cloud-backed identity data, including the visible display name and username/handle.
- **Synced Preference Set**: The preference values that are restored across sessions and devices for the signed-in host, including appearance theme, sound, common match notifications, configured leagues, and default selected leagues.
- **Cloud Account State**: The combination of the existing account identity row for profile data and the existing settings row for synced preferences that becomes the source of truth for the host.
- **Session State**: The current signed-in or signed-out status that controls whether profile edits and synced saves are available.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: In validation, 95% or more of successful profile edits are restored the next time the same account opens preferences.
- **SC-002**: In validation, 95% or more of successful synced preference changes appear unchanged after a later session restore on the same account.
- **SC-003**: In validation, 100% of invalid profile submissions are rejected without overwriting the previously saved profile.
- **SC-004**: In validation, 100% of sign-out or expired-session events return the app to a safe signed-out state without corrupting saved account data.
- **SC-005**: In validation, a host can complete the full profile-and-settings update flow on a second device without re-entering the saved profile values manually.

## Assumptions

- A username or handle is a separate account identity field from the visible display name, and only blank or whitespace-only values are rejected; duplicates and punctuation are allowed.
- Editable profile data stays on the existing account identity row, and synced settings stay on the existing settings row.
- Duplicate visible display names may remain allowed unless a stricter rule already exists elsewhere in the product.
- Supported cloud-synced settings are the preference values presented in the app’s settings area that should follow the signed-in host across devices; this set includes appearance theme, sound, common match notifications, configured leagues, and default selected leagues. Device-local or migration-only tools remain local.
- Existing local preference values are preserved when a user is signed out and are used to seed the first cloud-backed save for that account.
- The feature does not change multiplayer room history or other local gameplay records.
