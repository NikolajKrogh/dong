Feature: Multiplayer game lifecycle
  Scenario: A host and guest play one shared game
    Given a host signs in to the local app
    When the host creates a room and a guest joins
    And the host configures and starts the shared game
    And the host records a shared goal
    Then the guest sees the shared score
    When the host finishes the shared game
    Then both browsers see that the shared game ended
