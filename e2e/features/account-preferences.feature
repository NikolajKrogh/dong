Feature: Account preferences
  Scenario: Account changes survive a fresh browser session
    Given an account owner signs in to the local app
    When the owner changes their username and theme
    And the owner signs out and signs in with a fresh browser
    Then the saved username and theme are restored
