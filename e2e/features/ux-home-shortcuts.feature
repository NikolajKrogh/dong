@ux-home-shortcuts
Feature: Find Friends and History from Home
  Scenario: Signed-out Home supports ordinary destination links and local History
    Given the Home shortcuts fixture is signed out
    Then the Home shortcuts are named destination links
    When I keyboard open History from the Game Stats card
    Then local History is available from the shortcut

  Scenario: Signed-in Home exposes the same shortcuts with room actions intact
    Given the Home shortcuts fixture is signed in
    Then the Home shortcuts are named destination links
    And the Home room entry remains available


  Scenario: Signed-out Friends preserves the Home shortcut through sign-in
    Given the Home Friends recovery services are mocked
    And the Home shortcuts fixture is signed out
    When I keyboard open Friends from the Home shortcut
    And I complete the Home Friends sign-in recovery
    Then the Home Friends intended destination is restored
