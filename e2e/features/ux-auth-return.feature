Feature: Return from account recovery without duplicating the caller
  Scenario: Friends sign-in returns to the original caller before Requests and Back
    Given the UX account recovery services are mocked
    When I open Friends recovery from Home
    And I sign in through the UX recovery form
    And I select Requests after UX sign-in
    And I use the UX Friends header Back
    Then the UX account recovery Home caller is visible

  Scenario: A Requests recovery target retains its tab and dismisses to its caller
    Given the UX account recovery services are mocked
    When I open a Requests recovery link
    And I sign in through the UX recovery form
    Then the UX recovery Requests tab is selected
    When I use the UX Friends header Back
    Then the UX account recovery Home caller is visible
