Feature: Navigate DONG in a browser
  Scenario: Home links support keyboard navigation and browser Back
    Given Home is open in the browser
    When I open Game Stats using the keyboard
    Then History opens and browser Back returns Home
    When I open Friends using the keyboard
    Then Friends opens and browser Back returns through Settings to Home

  Scenario: Opening configuration preserves the running game across Back and refresh
    Given a solo game is running in the browser
    When I open the running game's configuration
    Then the existing players appear in setup
    When I return to gameplay using browser Back and refresh
    Then the same solo game is still running
