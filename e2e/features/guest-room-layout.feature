Feature: Responsive guest room layout

    Scenario Outline: Guest tabs remain usable with a full pool and long names
        Given a guest layout fixture at <width> pixels in "<theme>" theme
        And the guest room app is running on web
        When the user opens the guest join flow
        And the guest joins the mocked room as "Casey"
        Then the guest lobby summary should be visible
        And both guest tabs fit the viewport and support keyboard navigation

        Examples:
            | width | theme |
            | 320   | light |
            | 320   | dark  |
            | 390   | light |
            | 390   | dark  |
            | 768   | light |
            | 768   | dark  |
            | 1280  | light |
            | 1280  | dark  |
