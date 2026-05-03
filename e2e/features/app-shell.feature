Feature: Application Shell Launch

  Background:
    Given the app is running on web

  Scenario: Shell launches after hydration and onboarding
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

  Scenario: Home primary action stays centered on a desktop-wide viewport
    Given the browser viewport is desktop-wide
    When the home screen loads
    Then the "home-start-game-button" element should be horizontally centered

  Scenario: Home current game card stays centered on a desktop-wide viewport
    Given a game is in progress
    And the browser viewport is desktop-wide
    When the home screen loads
    Then the "home-current-game-card" element should be horizontally centered

  Scenario: Home history stats card stays centered on a desktop-wide viewport
    Given the user has game history
    And the browser viewport is desktop-wide
    When the home screen loads
    Then the "home-history-stats-card" element should be horizontally centered

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

  Scenario: Setup flow stays usable on a phone-sized viewport
    Given the browser viewport is phone-sized
    When the user navigates to setup
    Then the setup player name input should be visible
    And the "Next" action should be visible

  Scenario: Setup flow exposes wide navigation on a desktop-wide viewport
    Given the browser viewport is desktop-wide
    When the user navigates to setup
    Then the "Matches" action should be visible
    And the "Common" action should be visible
    And the "Assign" action should be visible
    And the setup player name input should be visible
    And the "Next" action should be visible

  Scenario: Setup flow keeps the wizard frame centered on a desktop-wide viewport
    Given the browser viewport is desktop-wide
    When the user navigates to setup
    Then the "SetupWizardRoot" element should be horizontally centered

  Scenario Outline: Setup journey reaches gameplay with representative datasets
    When the user navigates to setup
    And the user completes the "<dataset>" setup journey
    Then the "Matches" action should be visible
    And the "Players" action should be visible

    Examples:
      | dataset   |
      | default   |
      | alternate |

  Scenario: Gameplay flow stays usable on a phone-sized viewport
    Given a game is in progress
    And the browser viewport is phone-sized
    When the user opens the active game
    Then the "Matches" action should be visible
    And the "Players" action should be visible
    When the user opens the game menu
    Then the "End Game" action should be visible

  Scenario: Gameplay quick actions stay usable on a desktop-wide viewport
    Given a game is in progress
    And the browser viewport is desktop-wide
    When the user opens the active game
    Then the "Matches" action should be visible
    And the "Players" action should be visible
    When the user opens quick actions for the first match
    Then the quick actions modal should be visible

  Scenario: Gameplay tab bar stays centered on a desktop-wide viewport
    Given a game is in progress
    And the browser viewport is desktop-wide
    When the user opens the active game
    Then the "GameProgressTabBarContainer" element should be horizontally centered

  Scenario: History sorting stays usable on a phone-sized viewport
    Given the user has game history
    And the browser viewport is phone-sized
    When the user navigates to history
    Then the "Games" action should be visible
    When the user opens the history sort modal
    Then the history sort modal should be visible
    When the user sorts history by the "players" field
    When the user selects the "Players" history tab
    Then the "Compare" action should be visible

  Scenario: History details stay usable on a desktop-wide viewport
    Given the user has game history
    And the browser viewport is desktop-wide
    When the user navigates to history
    Then the "Games" action should be visible
    When the user selects the "Stats" history tab
    Then the "Overall Statistics" section should be visible
    When the user selects the "Games" history tab
    And the user opens the first history entry
    Then the history details modal should be visible

  Scenario: History header stays centered on a desktop-wide viewport
    Given the user has game history
    And the browser viewport is desktop-wide
    When the user navigates to history
    Then the "HistoryHeaderContainer" element should be horizontally centered

  Scenario: User can toggle dark mode in preferences
    Given the user navigates to preferences
    When the user switches to dark theme
    Then the shell should reflect the dark theme
    When the user switches to light theme
    Then the shell should reflect the light theme

  Scenario: Preferences content stays centered on a desktop-wide viewport
    Given the browser viewport is desktop-wide
    And the user navigates to preferences
    Then the "UserPreferencesContent" element should be horizontally centered
