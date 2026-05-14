# Feature Specification: Account Authentication

**Feature Branch**: `130-us31-host-authentication`  
**Created**: 2026-05-09  
**Status**: Draft  
**Input**: User description: "Issue #130: Allow a user to create an account and sign in before hosting multiplayer sessions"

## Clarifications

### Session 2026-05-09

- Q: Which app areas should be authentication-gated for issue #130? → A: Only multiplayer owner actions and room-management flows are gated; local game setup, history, and preferences stay accessible.
- Q: Where should the user's multiplayer display name from onboarding be stored? → A: Store it in public.accounts.preferred_display_name only; allow duplicates; use it as the visible multiplayer name.
- Q: Should a new user be able to use the account immediately after sign-up, or must email verification happen first? → A: Immediate session after sign-up; no email verification gate before multiplayer access.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - New User Creates an Account and Profile (Priority: P1)

As a new user, I can create an account, choose a display name, and reach the account-ready state so I can start or join multiplayer sessions with a durable identity.

**Why this priority**: Without account creation and profile setup, there is no authenticated multiplayer identity to own or rejoin sessions.

**Independent Test**: Create a new account with email and password, complete display-name onboarding, and verify the user reaches the authenticated entry point with a persisted profile.

**Acceptance Scenarios (Gherkin style)**:

1. **Given** a user who is not signed in, **When** they create an account with a valid email and password, **Then** they receive an authenticated session.
2. **Given** a newly authenticated user, **When** they complete display-name onboarding, **Then** their account profile is saved and they can continue into owner-only multiplayer setup.
3. **Given** a returning user, **When** they reopen a multiplayer entry point later, **Then** the app recognizes their existing account and keeps their profile identity intact.

---

### User Story 2 - Returning User Signs In, Stays Signed In, and Signs Out (Priority: P1)

As a returning user, I can sign in, keep my session after relaunch, and sign out when I am finished so I do not have to reauthenticate every time I use the app.

**Why this priority**: Returning access is part of the core multiplayer experience and removes friction for repeated use.

**Independent Test**: Sign out, close or reload the app, sign back in, and confirm the same account is restored and later cleared by sign-out.

**Acceptance Scenarios (Gherkin style)**:

1. **Given** a user with an existing account, **When** they sign in with valid credentials, **Then** they regain authenticated access to multiplayer features.
2. **Given** a user with a valid active session, **When** they relaunch the app, **Then** the app restores the signed-in state automatically.
3. **Given** a signed-in user, **When** they sign out, **Then** the app removes authenticated access and returns them to the signed-out entry flow.

---

### User Story 3 - Unauthenticated Users Are Blocked From Owner Actions (Priority: P1)

As a signed-out user, I am asked to authenticate before I can reach owner-only multiplayer actions so I do not accidentally create or manage a room without an account.

**Why this priority**: Owner-only actions must be protected from anonymous access to preserve ownership and account-based session control.

**Independent Test**: Start from a signed-out state, attempt an owner-only action, and confirm the app stops the action and routes the user into authentication first.

**Acceptance Scenarios (Gherkin style)**:

1. **Given** a user who is not signed in, **When** they try to create a multiplayer room or access another owner-only action, **Then** the app requires authentication before continuing.
2. **Given** a signed-out user who begins an owner-only action, **When** they finish signing in or signing up, **Then** the app returns them to the original multiplayer flow.
3. **Given** a user who has not completed account setup, **When** they reach an owner-only entry point, **Then** the app keeps them in the onboarding flow until the account is ready.

---

### User Story 4 - Users Can Recover Access With Password Reset (Priority: P2)

As a user who forgot their password, I can request a reset and return to my existing account so I do not have to create a new one.

**Why this priority**: Recovery is important for account retention, but it is less critical than initial sign-up, sign-in, and host gating.

**Independent Test**: Request a password reset for a valid account, complete the recovery path, and confirm the user can sign in again with the updated password.

**Acceptance Scenarios (Gherkin style)**:

1. **Given** a user on the sign-in screen, **When** they request a password reset with a valid email address, **Then** the app confirms the recovery request.
2. **Given** a user who completes the password recovery flow, **When** they return to the app, **Then** they can sign in to the same account with the new password.
3. **Given** a user who requests a reset for an unknown email address, **When** the request is submitted, **Then** the app shows a safe, non-revealing response.

---

### Edge Cases

- A user signs up with an email address that already belongs to an account.
- A new user closes the app before display-name onboarding is finished and returns later.
- A stored session is no longer valid when the app launches and the user must sign in again.
- A user attempts an owner-only action while authentication is still loading.
- A user signs out and then immediately tries to open an owner-only screen.
- A password reset request is submitted while the device is offline or the network is unstable.
- A user completes account creation but leaves the username field blank or invalid.
- A user uses the same account on a second device and expects the same display name and access to return.
- Existing local game data remains present while auth state changes.

## Platform & State Impact _(mandatory when applicable)_

- **Platform Behavior**: The auth flow must behave consistently on native and web, including after app relaunch or page reload, and must show clear states for loading, authenticated, and signed-out users. Local game setup, history, and preferences stay available without sign-in; only multiplayer owner and room-management flows require authentication.
- **Shared State Model**: Existing local game state stays separate from account authentication state. Signing in or out controls access to multiplayer owner actions, but it must not wipe saved game progress or preferences.
- **Identity Model**: The authenticated account is the durable multiplayer identity. The chosen display name lives on public.accounts.preferred_display_name and is reused whether the user starts a session or joins one later. The session owner is a role on one room, not a distinct account type.
- **Migration / Backfill**: No backfill of local game history is required for this feature. New account and profile records are created for newly authenticated users, while existing local data remains intact.

## Delivery & Automation Impact _(mandatory)_

- **Unit Test Coverage**: Cover sign-up, sign-in, sign-out, session restore, display-name onboarding validation, and owner-action gating with focused screen and hook tests.
- **E2E Test Coverage**: Yes. Add a web journey for sign-up to account-ready state, returning sign-in with session restore, sign-out, and password reset. Validate the blocked owner-action path for signed-out users.
- **Applicable Skills**: supabase, react-native-testing, playwright-bdd

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The app MUST allow a user to create an account with email and password and receive an authenticated session immediately after successful sign-up.
- **FR-002**: The app MUST require a display name during first-time account setup before the user can enter multiplayer owner flows.
- **FR-003**: The app MUST allow a returning user to sign in and regain the same account identity.
- **FR-004**: The app MUST restore a valid authenticated session automatically when the app starts or reloads.
- **FR-005**: The app MUST allow a signed-in user to sign out and remove authenticated access from the device.
- **FR-006**: The app MUST provide a password reset path from the sign-in experience.
- **FR-007**: The app MUST block unauthenticated users from multiplayer owner and room-management actions and require authentication before continuing.
- **FR-008**: The app MUST surface the account’s stored preferred display name as the visible identity after sign-up and on later launches.

### Key Entities _(include if feature involves data)_

- **Account**: The durable identity that signs in across devices and can start or join multiplayer sessions over time.
- **Account Profile**: The visible preferred display name stored on the account record.
- **Auth Session**: The persisted signed-in state that allows the app to restore access after relaunch.
- **Password Recovery Request**: The user-initiated flow that lets an existing host regain account access.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: In validation, at least 95% of successful sign-up runs reach the account-ready state in under 2 minutes from the first auth screen to completion of display-name setup.
- **SC-002**: In validation, 100% of users with a valid session return to the signed-in account state after app restart or page reload without re-entering credentials.
- **SC-003**: In validation, 100% of unauthenticated attempts to enter owner-only actions are intercepted and redirected to authentication before any owner action proceeds.
- **SC-004**: In validation, 100% of sign-out actions remove authenticated access and require reauthentication before host-only actions are available again.
- **SC-005**: In validation, 100% of password reset requests produce a clear recovery confirmation path back to sign-in.

## Assumptions

- Email and password are the only account creation credentials for v1.
- Sign-up produces an immediately usable authenticated session; email verification is not required before multiplayer access in v1.
- A display name is required before a signed-in user can create multiplayer rooms.
- The onboarding display name is a non-unique preferred display name stored on the account record; the separate social profile table is out of scope for v1 account auth.
- The same account may sign in on multiple devices over time.
- Existing local game data, settings, and history are not reset by this feature.
- Password recovery uses the standard email-based reset path.
