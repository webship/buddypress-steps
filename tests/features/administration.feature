@administration
Feature: The community's administration
  As the administrator of the site
  I want to see the community's components, fields, groups and activity
  So that I know how the community is set up and what happens in it

  Scenario: The components, the fields and the lists of the administration
    Given I am a logged in user with the "admin" user
    Then the community component "Friend Connections" should be active
    And the community component "User Groups" should be active
    And the community component "Private Messaging" should be active
    And the community component "Site Tracking" should not be active
    And the profile fields should list "Location" in "Base (Primary)"
    And the profile fields should list "Skills" in "Work"
    And the administration's groups should list "Core Team" with "Hidden"
    And the administration's groups should not list "Webship test circle"
    And the administration's activity should list "Welcome to the Webship Community!"
    And the administration's activity should not list "Webship test update"
    Given I am on the "Profile Fields" admin screen
    Then I should be on the "Profile Fields" admin screen
