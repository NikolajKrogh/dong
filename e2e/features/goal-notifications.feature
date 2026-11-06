Feature: Browser goal notification enrollment

  Scenario: An approved player sends a test and turns notifications off
    Given a solo game has a controlled notification service
    When I check an approved notification access code
    And I enable browser notifications
    And I send a test notification
    Then DONG reports push-service acceptance
    And the notification controls pass the accessibility audit
    When I turn off browser notifications
    Then DONG confirms the browser notification stop

  Scenario: An offline notification stop is retried on reconnect
    Given a solo game has a controlled notification service
    When I check an approved notification access code
    And I enable browser notifications
    And I turn off notifications offline and reconnect
    Then DONG returns to notification access setup

  Scenario: Revoking browser permission stops the registered installation
    Given a solo game has a controlled notification service
    When I check an approved notification access code
    And I enable browser notifications
    And browser notification permission is revoked
    Then DONG shows notification recovery guidance without a new prompt

  Scenario: An iPhone browser tab provides Home Screen guidance
    Given a solo game is open in an iPhone browser tab
    Then DONG explains how to open it from the Home Screen
