Feature: Browser goal notification enrollment

  Scenario: A player enables game goal alerts and turns them off
    Given a solo game has a controlled notification service
    When I open Goal notifications from Game actions
    And I enable browser notifications
    Then goal alerts are enabled for this game
    And the notification controls pass the accessibility audit
    When I turn off browser notifications
    Then DONG confirms the browser notification stop
