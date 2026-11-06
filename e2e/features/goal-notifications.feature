Feature: Browser goal notification enrollment

  Scenario: A player sends a test and turns notifications off
    Given a solo game has a controlled notification service
    When I open Goal notifications from Game actions
    And I enable browser notifications
    And I send a test notification
    Then DONG reports push-service acceptance
    And the notification controls pass the accessibility audit
    When I turn off browser notifications
    Then DONG confirms the browser notification stop
