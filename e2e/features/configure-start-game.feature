Feature: Configure Room and Start Game

    A room's pre-start setup is the same four-step wizard as single player —
    Room, Matches, Common, Assign — so these scenarios navigate by wizard step
    rather than through a separate match-configuration route.

    Scenario: A host selects matches, designates a common match, and starts the game
        Given the host room service is mocked
        And the room configuration and start-game services are mocked
        And a signed-in host is on the home screen
        When the host taps the Create Room button
        And the host opens the Matches step
        And the host adds the first two catalog matches
        And the host designates the first added match as the Common Match
        And the host opens the Assign step
        And the host taps the Start Game button
        Then the host is redirected to the active gameplay dashboard

    Scenario: An empty room cannot reach the step that starts the game
        Given the host room service is mocked
        And the room configuration and start-game services are mocked
        And a signed-in host is on the home screen
        When the host taps the Create Room button
        And the host opens the Matches step
        Then the host cannot advance past the Matches step

    Scenario: The room shows an unrelaxable shortfall when the pool is too small for the configured settings
        Given the host room service is mocked
        And the room configuration and start-game services are mocked
        And a signed-in host is on the home screen
        When the host taps the Create Room button
        And the host opens the Matches step
        And the host adds the first two catalog matches
        And the host designates the first added match as the Common Match
        And the host opens the Assign step
        And the host raises the matches-per-player count to 2
        Then the host sees a hard-floor shortfall warning and the Start Game button is disabled

    Scenario: The host switches to host-assigned mode, allocates matches by hand, and starts
        Given the host room service is mocked
        And the room configuration and start-game services are mocked
        And a signed-in host is on the home screen
        When the host taps the Create Room button
        And the host opens the Matches step
        And the host adds the first two catalog matches
        And the host designates the first added match as the Common Match
        And the host opens the Assign step
        And the host switches the assignment mode to host-assigned
        And the host allocates the second added match to themselves
        And the host taps the Start Game button
        Then the host is redirected to the active gameplay dashboard

    Scenario: Switching assignment mode after an allocation exists asks for confirmation
        Given the host room service is mocked
        And the room configuration and start-game services are mocked
        And a signed-in host is on the home screen
        When the host taps the Create Room button
        And the host opens the Matches step
        And the host adds the first two catalog matches
        And the host designates the first added match as the Common Match
        And the host opens the Assign step
        And the host switches the assignment mode to host-assigned
        And the host allocates the second added match to themselves
        And the host attempts to switch the assignment mode to automatic
        Then the host sees a mode-switch confirmation dialog
        When the host declines the mode-switch confirmation
        Then the assignment mode remains host-assigned

    Scenario: The host switches to player-picked mode, picks their own matches, and starts
        Given the host room service is mocked
        And the room configuration and start-game services are mocked
        And the room has a second registered member
        And a signed-in host is on the home screen
        When the host taps the Create Room button
        And the host opens the Matches step
        And the host adds the first two catalog matches
        And the host designates the first added match as the Common Match
        And the host opens the Assign step
        And the host switches the assignment mode to player-picked
        Then the host sees their own pick panel
        And the host's pick progress reads "0/1"
        When the host picks the second added match for themselves
        Then the host's pick progress reads "1/1"
        When the host opens the Room step
        Then the second member's pick progress is visible in the roster
        When the host opens the Assign step
        And the host taps the Start Game button
        Then the host is redirected to the active gameplay dashboard
        And the settled assignments include the host's own pick

    Scenario: A pick is released by tapping it again
        Given the host room service is mocked
        And the room configuration and start-game services are mocked
        And a signed-in host is on the home screen
        When the host taps the Create Room button
        And the host opens the Matches step
        And the host adds the first two catalog matches
        And the host designates the first added match as the Common Match
        And the host opens the Assign step
        And the host switches the assignment mode to player-picked
        And the host picks the second added match for themselves
        Then the host's pick progress reads "1/1"
        When the host picks the second added match for themselves
        Then the host's pick progress reads "0/1"
