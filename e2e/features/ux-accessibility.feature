@ux-accessibility
Feature: Operate primary controls and account forms accessibly
  Scenario: Keyboard users activate a real destination from Home
    Given the accessibility Home fixture is open
    Then the accessibility Home exposes one main and a descriptive title
    When I keyboard activate the accessibility setup link
    Then the accessibility setup destination opens once

  Scenario: Account labels, autofill, password toggle and validation are rendered
    Given the accessibility account form is open
    Then the accessibility sign-in fields declare their purposes
    When I switch the accessibility form to registration and submit mismatched passwords
    Then the accessibility registration error is associated and announced

  Scenario: A disabled pending command cannot be activated twice
    Given the accessibility account form is open
    When I submit the accessibility sign-in form to a pending service
    Then the accessibility pending command is disabled
