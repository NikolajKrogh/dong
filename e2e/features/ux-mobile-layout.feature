@ux-mobile-layout
Feature: Compact setup labels and scroll reachability
  Scenario Outline: Setup schedule and final controls remain reachable
    Given the compact setup fixture has <rows> matches at <width> by <height> with text scale <scale>
    Then the compact schedule title and badges do not overlap
    And the compact setup has no horizontal page overflow
    And the compact setup last match and navigation are reachable
    Examples:
      | rows | width | height | scale |
      | 1    | 320   | 640    | 1     |
      | 20   | 360   | 740    | 1     |
      | 100  | 390   | 844    | 1     |
      | 20   | 640   | 360    | 1     |
      | 20   | 320   | 640    | 2     |
      | 100  | 390   | 844    | 2     |
      | 20   | 640   | 360    | 2     |

  Scenario: Reduced motion keeps compact setup controls usable
    Given the compact setup fixture has 1 matches at 360 by 740 with text scale 1
    When reduced motion is requested in compact setup
    Then the compact schedule can expand and collapse


  Scenario: Selected long team names remain readable on a narrow phone
    Given the compact setup fixture has 1 matches at 320 by 640 with text scale 1
    When I select long custom team names in compact setup
    Then the compact selected team names wrap without clipping


  Scenario Outline: Populated History retains one usable list scroller
    Given the compact History fixture has <rows> games at <width> by <height>
    Then the compact History last game and Back control are reachable
    Examples:
      | rows | width | height |
      | 1    | 320   | 640    |
      | 20   | 360   | 740    |
      | 100  | 390   | 844    |
      | 20   | 640   | 360    |

  Scenario Outline: Populated Friends can reach its final comparison
    Given the compact Friends fixture has <rows> friends at <width> by <height>
    Then the compact Friends final comparison and Back control are reachable
    Examples:
      | rows | width | height |
      | 1    | 320   | 640    |
      | 20   | 360   | 740    |
      | 100  | 390   | 844    |
      | 20   | 640   | 360    |
