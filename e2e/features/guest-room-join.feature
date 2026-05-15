Feature: Guest Room Join

    Scenario: Join a host room from the home screen
        Given the guest room service is mocked
        And the guest room app is running on web
        Then the "Join Room as Guest" action should be visible
        When the user opens the guest join flow
        And the guest joins the mocked room as "Casey"
        Then the guest lobby summary should be visible
        And the guest lobby should list the guest participant "Casey"
        And the guest lobby should explain the temporary guest access for room "ROOM42"
        And the guest room join request should include the room code "ROOM42"
        And the guest room join request should include the guest token
        When the mocked host starts gameplay
        Then the guest lobby should show the room state "in_play"

    Scenario: Restore a stored guest room session
        Given the guest room service is mocked
        And a guest room session grant is preloaded for the mocked room
        And the guest room app is running on web
        Then the guest lobby summary should be visible
        And the guest lobby should list the guest participant "Guest Player"
        And the guest lobby should explain the temporary guest access for room "ROOM42"