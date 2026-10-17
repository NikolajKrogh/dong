@ux-history-focus
Feature: History detail and shared statistics keep one visible presentation
  Scenario: A shared comparison hides background details and Back restores the game
    Given UX History focus fixtures contain a completed game with an accepted friend
    When I open the UX focus game details and its shared comparison
    Then UX shared statistics are usable without the background game detail modal
    When I return from UX shared statistics with browser Back
    Then the original UX focus game details are restored
