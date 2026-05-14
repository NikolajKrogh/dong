Feature: Account Authentication

  Scenario: New user signs up and reaches onboarding
    Given the account auth flow is available
    When a new user signs up
    Then the user should be routed to display-name onboarding

  Scenario: Returning user signs in and can sign out
    Given the account auth flow is available
    When a returning user signs in
    Then the account should be restored

  Scenario: User can request a password reset
    Given the account auth flow is available
    When the user requests a password reset
    Then the reset confirmation should be visible

  Scenario: User completes password recovery and returns to sign in
    Given the account auth flow is available
    When the user opens a recovery link
    And the user submits a new password
    Then the user should return to the sign in flow

  Scenario: Signed-out owner actions redirect through auth and return to settings
    Given the account auth flow is available
    When a signed-out user opens the owner gate
    Then the app should route them through auth and back to settings