@ux-back-return
Feature: Scoped Back and safe game return
  Scenario: Friends child header restores Requests without a duplicate parent
    Given UX return opens Requests with a safe Home caller
    When UX return opens friend search then uses its header Back
    Then UX return restores Requests and can Back to Home

  Scenario: Browser Back and explicit Close share one game overlay lifecycle
    Given UX return opens a solo game after an external page
    And UX return selects the Players tab
    When UX return opens game actions
    Then UX return browser Back closes only game actions
    When UX return opens game actions
    And UX return explicitly closes game actions
    Then UX return the next browser Back leaves DONG

  Scenario: Forward after caller remount explains safe Home recovery
    Given UX return opens a solo game after an external page
    And UX return selects the Players tab
    When UX return opens game actions
    Then UX return browser Back closes only game actions
    And UX return Forward offers Home recovery for the unmounted caller

  Scenario: Three Home and resume cycles retain the same solo game
    Given UX return opens Home after an external page with a saved solo game
    When UX return resumes and returns Home three times
    Then UX return retains the saved game and can leave DONG with one Back

  Scenario: Refreshing a transient panel offers a safe page fallback
    Given UX return opens a solo game after an external page
    When UX return opens game actions
    And UX return reloads the transient overlay
    Then UX return explains the expired panel and recovers to gameplay

  Scenario: Default-league Back and Close keep configured preferences
    Given UX return opens league preferences after an external page
    When UX return dismisses default leagues with Back and Close
    Then UX return the next browser Back leaves DONG

  Scenario: A malformed fresh gameplay tab waits for navigation readiness
    Given UX return opens gameplay with an ambiguous tab query
    Then UX return normalizes to the Matches view safely
