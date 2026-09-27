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
        And the guest credential should not appear in the URL, local storage, or visible page
        When the mocked host starts gameplay
        Then the guest is taken into the active game

    Scenario: Restore a stored guest room session
        Given the guest room service is mocked
        And a guest room session grant is preloaded for the mocked room
        And the guest room app is running on web
        Then the guest lobby summary should be visible
        And the guest lobby should list the guest participant "Guest Player"
        And the guest lobby should explain the temporary guest access for room "ROOM42"
        And the legacy guest key should be removed

    Scenario: Keep guest access within one browser session and clean legacy storage
        Given the guest room service is mocked
        And the guest room app is running on web
        When the user opens the guest join flow
        And the guest joins the mocked room as "Casey"
        Then the guest bearer should be stored only in the browser session
        When the guest reloads the same browser tab
        Then the guest lobby summary should be visible
        And a new browser tab should not inherit the guest bearer

    Scenario: Renew a near-expiring guest grant safely on web
        Given the guest room service is mocked with a near-expiring grant
        And a near-expiring protected guest grant is preloaded
        And the guest room app is running on web
        Then the guest lobby summary should be visible
        And a replacement guest credential should be confirmed

    Scenario: Confirm a joinable guest departure
        Given the guest room service is mocked
        And the guest room app is running on web
        When the user opens the guest join flow
        And the guest joins the mocked room as "Casey"
        Then the guest lobby summary should be visible
        When the guest leaves the joined room
        Then confirmed guest departure should be visible

    Scenario: Expired guest access is cleared
        Given the guest room service is mocked
        And the guest room app is running on web
        When the user opens the guest join flow
        And the guest joins the mocked room as "Casey"
        Then the guest lobby summary should be visible
        When the guest grant expires on the server
        Then the guest should lose closed-room access

    Scenario: Unknown room feedback does not expose the code or credential
        Given the guest room service is mocked
        And the guest room app is running on web
        When the user opens the guest join flow
        And the guest attempts an unknown room
        Then only generic room-unavailable feedback should be visible

    Scenario: Show final results but deny a closed room
        Given the guest room service is mocked
        And the guest room app is running on web
        When the user opens the guest join flow
        And the guest joins the mocked room as "Casey"
        Then the guest lobby summary should be visible
        When the mocked host completes the room
        Then the guest should see final-only results
        When the mocked host closes the room
        Then the guest should lose closed-room access
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

    Scenario: Host and guest refresh an expiry-aware roster without losing game history
        Given the guest room service includes a retained expired guest
        And the guest room app is running on web
        When the user opens the guest join flow
        And the guest joins the mocked room as "Casey"
        And the host opens the same room in another browser tab
        Then both live rosters should list the expired guest
        When the expired guest is removed from the active roster
        Then both refreshed rosters hide the guest but keep its game projection
