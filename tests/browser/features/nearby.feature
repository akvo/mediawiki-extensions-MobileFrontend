Feature: Nearby page (mobile interface)
  Test currently only works with Firefox

  Scenario: Nearby exists
    When I click on "Nearby" in the main navigation menu
      And I give permission for the page to access my location
    Then I should see at least one result in the nearby items list

  Scenario: Page preview
    Given I am in beta mode
      And I click on "Nearby" in the main navigation menu
      And I give permission for the page to access my location
      And I should see at least one result in the nearby items list
    When I click a nearby result
    Then I see the page preview overlay
