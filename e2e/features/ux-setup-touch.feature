@ux-setup-touch
Feature: Touch entry preserves the pending player while the keyboard changes viewport height
  Scenario Outline: A mobile touch input survives the short-viewport transition
    Given an empty solo setup is open in a touch browser through <entry>
    When I tap the touch player input and type a pending name
    And the touch viewport shrinks and expands around the keyboard threshold
    Then touch Next adds the pending player once and advances to Matches
    Examples:
      | entry  |
      | direct |
      | Home   |


  Scenario Outline: Keyboard scrolling hands off through empty and populated player lists
    Given an empty solo setup is open in a touch browser through direct
    And the touch setup player list contains <players> saved players
    When I tap the touch player input and type a pending name
    And the touch keyboard reduces only the visual viewport
    Then trusted touch drags over the player list reveal Next without losing the input
    Examples:
      | players |
      | 0       |
      | 20      |
