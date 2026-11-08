Feature: Editable automatic assignments use the shared setup controls

  Scenario: A host changes randomized matches and starts with the exact selection
    Given a host is editing an automatic room with editable assignments
    When the host adjusts a collapsed player's count and restores the default
    And the host randomizes and edits the full match pool in both views
    Then starting preserves the edited automatic selections

  Scenario: A host changes running assignments without randomizing again
    Given a host is editing an automatic room with editable assignments
    When the host randomizes and edits the full match pool in both views
    And the host starts and edits the running automatic game
    Then saving preserves the edited running selections
