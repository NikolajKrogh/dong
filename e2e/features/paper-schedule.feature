Feature: Paper match schedule pickers
  Scenario Outline: Apply schedule choices automatically
    Given the match schedule is open in the "<theme>" theme
    When I tap a date in the Paper calendar
    Then the calendar closes and the date is applied without confirmation
    When I select an hour and minutes on the Paper clock
    Then the clock closes and the time is applied without confirmation
    Examples:
      | theme |
      | light |
      | dark  |
