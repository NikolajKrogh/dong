Feature: Player-picked matches across two devices

    #185 (US5.6) asks for a journey covering two participants picking on
    separate devices. Both browsers route their Supabase calls through the same
    mock state, so what is asserted here is genuine propagation — one
    participant's write becoming the other's next ~4s snapshot poll — and not a
    scripted stand-in for the second actor.

    Background:
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

    Scenario: Two participants pick on their own devices and each sees the other's progress
        Given the second member opens the room on their own device
        Then the second member sees the room read-only, with no way to start the game
        And the second member sees their own pick panel

        # Each device picks for itself, and only for itself.
        When the host picks the second added match for themselves
        Then the host's pick progress reads "1/1"
        When the second member picks their first available match
        Then the second member's own pick progress reads "1/1"

        # The crossing assertions: neither write was made by the device that observes it.
        Then the host's device shows the second member at "1/1 picked"
        And the second member's device shows the host at "1/1 picked"

        # Settlement keeps what each participant chose for themselves (FR-041).
        When the host taps the Start Game button
        Then the host is redirected to the active gameplay dashboard
        And the settled assignments include every participant's own picks

    Scenario: A release on one device is reflected on the other
        Given the second member opens the room on their own device
        When the second member picks their first available match
        Then the second member's own pick progress reads "1/1"
        And the host's device shows the second member at "1/1 picked"
        When the second member releases their pick
        Then the second member's own pick progress reads "0/1"
        And the host's device shows the second member at "0/1 picked"
