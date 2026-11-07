Feature: Solo game lifecycle
  Scenario: Play a solo game and retain its history
    Given a player opens the local app
    When the player configures and starts a solo game
    And the player records a goal and a drink
    Then solo progress survives a reload
    When the player finishes the game
    Then the completed solo game appears in history
