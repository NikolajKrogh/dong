Feature: Application Shell Launch

  Background:
    Given the app is running on web

  Scenario: Shell launches with the default light theme
    When the home screen loads
    Then the shell background should be visible
    And the "Start New Game" action should be visible

  Scenario: Home screen shows current game card when game is in progress
    Given a game is in progress
    When the home screen loads
    Then the "Continue Game" action should be visible
    And the "Cancel Game" action should be visible

  Scenario: Home screen shows history stats when history exists
    Given the user has game history
    When the home screen loads
    Then the "Game Stats" section should be visible

  Scenario: Shell preserves theme after switching to dark mode
    Given the user navigates to preferences
    When the user switches to dark theme
    Then the shell should reflect the dark theme
    When the user navigates back to home
    Then the shell background should be visible

  Scenario: Preferences screen shows all settings sections
    Given the user navigates to preferences
    Then the "Appearance" section should be visible
    And the "Sound & Notifications" section should be visible
    And the "League Configuration" section should be visible
    And the "View Onboarding" action should be visible

  Scenario: User can toggle dark mode in preferences
    Given the user navigates to preferences
    When the user switches to dark theme
    Then the shell should reflect the dark theme
    When the user switches to light theme
    Then the shell should reflect the light theme
