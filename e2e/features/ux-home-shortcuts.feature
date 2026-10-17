@ux-home-shortcuts
Feature: Find Friends and History from Home
  Scenario: Signed-out Home supports ordinary destination links and local History
    Given the Home shortcuts fixture is signed out
    Then the Home shortcuts are named destination links
    When I keyboard open History from the Home shortcut
    Then local History is available from the shortcut

  Scenario: Signed-in Home exposes the same shortcuts with room actions intact
    Given the Home shortcuts fixture is signed in
    Then the Home shortcuts are named destination links
    And the Home room entry remains available
