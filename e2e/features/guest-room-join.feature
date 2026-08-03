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
        Then the guest is taken into the active game

    Scenario: Restore a stored guest room session
        Given the guest room service is mocked
        And a guest room session grant is preloaded for the mocked room
        And the guest room app is running on web
        Then the guest lobby summary should be visible
        And the guest lobby should list the guest participant "Guest Player"
        And the guest lobby should explain the temporary guest access for room "ROOM42"
    Scenario: A guest picks their own matches from the host's pool
        Given the guest room service is mocked in player-picked mode
        And the guest room app is running on web
        When the user opens the guest join flow
        And the guest joins the mocked room as "Casey"
        Then the guest lobby summary should be visible
        And the guest should see their own pick panel
        And the guest's pick progress should read "0/2"
        When the guest picks the first match in the pool
        Then the guest's pick progress should read "1/2"
        When the guest picks the second match in the pool
        Then the guest's pick progress should read "2/2"
        And the remaining matches in the pool should be unpickable
        When the guest releases their first pick
        Then the guest's pick progress should read "1/2"
        And the stored guest picks should contain exactly one match

    Scenario: A guest sees no pick panel outside player-picked mode
        Given the guest room service is mocked
        And the guest room app is running on web
        When the user opens the guest join flow
        And the guest joins the mocked room as "Casey"
        Then the guest lobby summary should be visible
        And the guest should not see a pick panel
