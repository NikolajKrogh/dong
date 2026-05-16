Feature: Host Profile and Synced Settings

    Scenario: Signed-in host updates profile details from preferences
        Given the host profile settings flow is available
        And a signed-in host profile is restored in preferences
        When the host updates the profile display name to "Captain Updated"
        And the host updates the profile username to "captain-updated"
        And the host saves the profile form
        Then the saved profile should show display name "Captain Updated"
        And the saved profile should show username "captain-updated"

    Scenario: Invalid profile values show a clear validation message
        Given the host profile settings flow is available
        And a signed-in host profile is restored in preferences
        When the host clears the profile display name
        And the host saves the profile form
        Then the profile validation message should say "Account display name cannot be blank."
        And the saved profile should show display name "Captain"

    Scenario: First sync seeds supported settings from local values
        Given the host profile settings flow is available
        And the local preference state is seeded for first sync
        When the signed-in host restores preferences without cloud settings
        Then the synced settings row should seed from the current local values

    Scenario: Returning host restores synced settings on another session
        Given the host profile settings flow is available
        And cloud-backed settings already exist for the signed-in host
        When the signed-in host restores preferences on another session
        Then the synced settings should match the saved account state

    Scenario: Signing out returns preferences to a safe signed-out state
        Given the host profile settings flow is available
        And a signed-in host profile is restored in preferences
        When the host signs out from preferences
        Then the preferences screen should show the signed-out recovery state

    Scenario: Session expiration explains how to recover
        Given the host profile settings flow is available
        And a signed-in host profile is restored in preferences
        When the signed-in host session expires in preferences
        Then the preferences screen should show the signed-out recovery state
        And the session failure message should be visible
