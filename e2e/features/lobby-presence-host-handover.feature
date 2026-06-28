Feature: Lobby Presence and Host Handover

    Scenario: A signed-in host sees the live lobby with a host-only join code
        Given the host room service is mocked
        And a signed-in host is on the home screen
        When the host taps the Create Room button
        Then the host is navigated to the lobby screen
        And a 6-digit numeric join code is displayed
        And the host display name appears in the participant list

    Scenario: A signed-in user sees the Join Room action
        Given the host room service is mocked
        And a signed-in host is on the home screen
        Then the registered Join Room action is visible

    Scenario: A host hands the room to a chosen member
        Given the host room service is mocked
        And the room has two registered members
        And a signed-in host is on the home screen
        When the host taps the Create Room button
        And the host leaves the room
        Then the successor chooser is shown
        When the host selects the first successor
        Then the host returns to the home screen
