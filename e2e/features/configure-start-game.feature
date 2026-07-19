Feature: Configure Room and Start Game

    Scenario: A host selects matches, designates a common match, assigns, and starts the game
        Given the host room service is mocked
        And the room configuration and start-game services are mocked
        And a signed-in host is on the home screen
        When the host taps the Create Room button
        And the host opens the match configuration modal
        And the host adds the first two catalog matches
        And the host closes the match configuration modal
        And the host designates the first added match as the Common Match
        And the host randomizes assignments
        And the host taps the Start Game button
        Then the host is redirected to the active gameplay dashboard

    Scenario: Starting the game with no matches selected is rejected
        Given the host room service is mocked
        And the room configuration and start-game services are mocked
        And a signed-in host is on the home screen
        When the host taps the Create Room button
        And the host taps the Start Game button
        Then the host sees a configuration error and remains in the lobby
