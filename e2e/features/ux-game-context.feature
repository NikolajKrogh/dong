@ux-game-context
Feature: Configuration preserves the current game
  Scenario Outline: Game configuration retains mode and membership
    Given UX context starts a "<role>" game with controlled services
    When UX context opens the current configuration action
    Then UX context retains the "<role>" game without navigation mutations

    Examples:
      | role       |
      | solo       |
      | registered |
      | guest      |
