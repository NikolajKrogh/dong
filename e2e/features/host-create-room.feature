Feature: Host Create Room

    Scenario: An authenticated host creates a room
        Given the host room service is mocked
        And a signed-in host is on the home screen
        When the host taps the Create Room button
        Then the host is navigated to the lobby screen
        And a 6-digit numeric join code is displayed
        And the host display name appears in the participant list

    Scenario: Hosting requires sign-in
        Given the guest room app is running on web
        Then hosting asks the signed-out user to sign in

    Scenario: A host resumes a lobby from its canonical URL
        Given the host room service is mocked
        And a signed-in host is on the home screen
        When the host taps the Create Room button
        Then the host is navigated to the lobby screen
        And a 6-digit numeric join code is displayed
        When the host opens the canonical lobby URL directly and refreshes it
        Then a 6-digit numeric join code is displayed
        And the host display name appears in the participant list
