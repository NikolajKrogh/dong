Feature: Host Create Room

    Scenario: An authenticated host creates a room
        Given the host room service is mocked
        And a signed-in host is on the home screen
        When the host taps the Create Room button
        Then the host is navigated to the lobby screen
        And a 6-digit numeric join code is displayed
        And the host display name appears in the participant list

    Scenario: Create Room button is hidden for unauthenticated users
        Given the guest room app is running on web
        Then the Create Room button is not visible
