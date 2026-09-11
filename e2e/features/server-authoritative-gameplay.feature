@server-authoritative
Feature: Server-authoritative active gameplay

    Scenario: A resumed browser hydrates the canonical multiplayer room
        Given the active-game snapshot service is mocked
        And a browser has a persisted multiplayer game and opens the active game
        Then the active game shows the shared game as synced
        And the canonical active match is visible
        And the host can see the reassignment control

    Scenario: A stale browser replaces its local copy after reconnect
        Given the active-game snapshot service returns a newer canonical sequence after refresh
        And a browser has a persisted multiplayer game and opens the active game
        When the browser reloads the active game
        Then the active game shows the shared game as synced
        And the canonical refreshed score is visible

    Scenario: The host completes the canonical multiplayer game
        Given the active-game completion service is mocked
        And a browser has a persisted multiplayer game and opens the active game
        When the host confirms end game
        Then the active game shows the canonical completed state

    Scenario: Solo gameplay stays local when shared RPCs are unavailable
        Given a local solo game is seeded and shared RPCs are unavailable
        When the browser opens the solo game
        Then the solo game remains usable without a shared-game banner

    Scenario: Two browser clients converge through score, drink, reassignment, reconnect, and completion
        Given the active two-client gameplay services are mocked
        And a browser has a persisted multiplayer game and opens the active game
        And a second browser resumes as the active member
        When the host records a manual goal
        Then the member sees the canonical goal
        When the member records a half-drink for themselves
        Then the host sees the canonical drink total
        When the host reassigns their match to the alternate fixture
        Then both clients retain the canonical score and assignment
        When the member reloads the active game
        Then the member still sees the canonical score and drink total
        When the host confirms end game
        Then both clients show the canonical completed state
