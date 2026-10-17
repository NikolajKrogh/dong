Feature: Restore task position from meaningful route state
  Scenario: Visible setup Back follows the existing task sequence
    Given UX route fixtures contain a valid saved solo setup
    When I advance UX setup through Matches and Common
    And I press the visible UX wizard Back action
    Then the UX matches step is current
    When I use browser Back for UX route state
    Then the UX players step is current

  Scenario: Setup position survives refresh and browser navigation
    Given UX route fixtures contain a valid saved solo setup
    When I visit the UX setup matches route
    And I choose the UX common step and refresh
    Then the UX common step is current
    When I use browser Back for UX route state
    Then the UX matches step is current
    When I use browser Forward for UX route state
    Then the UX common step is current

  Scenario: Later setup entry recovers after persisted prerequisites load
    Given UX route fixtures contain an empty saved solo setup
    When I visit an inaccessible UX assignment route
    Then the UX players step explains its missing prerequisites

  Scenario: History tab and local detail identities survive refresh and Back
    Given UX route fixtures contain one local completed game
    When I visit the UX players History route and refresh
    Then the UX Players History tab is selected
    When I open the UX game detail route and refresh
    Then the UX local game details are visible
    When I use browser Back for UX route state
    Then the UX Games History tab is selected
    When I use browser Back for UX route state
    Then the UX Players History tab is selected

  Scenario: Malformed and unavailable History state has safe recovery
    Given UX route fixtures contain one local completed game
    When I visit an unavailable UX History detail
    Then UX History explains that the detail is unavailable
    When I visit an ambiguous UX History tab
    Then the UX Games History tab is selected

  Scenario: Signed-out comparison links reveal no friend data
    Given UX route fixtures contain one local completed game
    When I visit a signed-out UX comparison target
    Then UX History requires sign-in for online statistics

  Scenario: Direct detail entry establishes a dismissible list parent
    Given UX route fixtures contain one local completed game
    When I visit a direct UX game detail
    Then the UX local game details are visible
    When I use browser Back for UX route state
    Then the UX Games History tab is selected

  Scenario: Direct detail refresh and Forward retain one owned list parent
    Given UX route fixtures contain one local completed game
    When I visit a direct UX game detail
    Then the UX local game details are visible
    When I refresh the UX route page
    Then the UX local game details are visible
    When I use browser Back for UX route state
    Then the UX Games History tab is selected
    When I use browser Forward for UX route state
    Then the UX local game details are visible

  Scenario: Closing reloaded details returns through the actual list caller
    Given UX route fixtures contain one local completed game
    When I visit the UX Settings caller
    And I visit the UX players History route and refresh
    And I open the UX game detail route and refresh
    Then the UX local game details are visible
    When I close the UX game details
    Then the UX Games History tab is selected
    When I use browser Back for UX route state
    Then the UX Players History tab is selected
    When I use browser Back for UX route state
    Then the UX Settings caller is visible

  Scenario: Detail recovery remains available when session storage is denied
    Given UX route fixtures contain one local completed game
    And UX session storage is unavailable
    When I visit a direct UX game detail
    Then the UX local game details are visible
    When I refresh the UX route page
    Then the UX local game details are visible
    When I close the UX game details
    Then the UX Games History tab is selected
