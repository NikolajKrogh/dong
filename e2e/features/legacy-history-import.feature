Feature: Legacy History Import

    Background:
        Given the app is running on web
        And the Supabase import service is mocked
        And the user has a signed-in legacy history ready for import

    Scenario: Import legacy history from Settings
        When the user navigates to preferences
        Then the "History Import" section should be visible
        And the "Import Local History" action should be visible
        When the user starts the legacy history import
        Then the claimant picker should be visible
        When the user selects the "Alex Example" claimant
        Then the import completion summary should be visible
        And the "Import Complete" action should be visible

    Scenario: Mixed registered and guest players preserve guest snapshots
        When the user navigates to preferences
        Then the "History Import" section should be visible
        When the user starts the legacy history import
        Then the claimant picker should be visible
        When the user selects the "Alex Example" claimant
        Then the import request should preserve guest participant snapshots
        And the import completion summary should be visible

    Scenario: Reopening the completed import stays disabled
        When the user navigates to preferences
        Then the "History Import" section should be visible
        When the user starts the legacy history import
        Then the claimant picker should be visible
        When the user selects the "Alex Example" claimant
        Then the import completion summary should be visible
        When the user tries to start the legacy history import again
        Then the import action should remain disabled
        And the import RPC should only be called once