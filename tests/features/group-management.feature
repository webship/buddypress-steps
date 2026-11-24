@group-management
Feature: Managing a group: its roles, a group made and deleted
  As the organizer of a group
  I want to give its members their roles, and to make and remove groups
  So that each group is run by the right people

  Scenario: The roles of a group, one changed
    Given I am a logged in user with the "organizer" user
    Then the role of "organizer" in the group "Webship Club" should be "Administrator"
    And the role of "moderator" in the group "Webship Club" should be "Moderator"
    And the role of "member" in the group "Webship Club" should be "Member"
    When I change the role of "member" in the group "Webship Club" to "Moderator"
    Then the role of "member" in the group "Webship Club" should be "Moderator"
    And a community mail "You have been promoted in the group" should be sent to "member"

  Scenario: A private group made with the creation steps, then deleted
    Given there is no group "Webship test circle"
    And I am a logged in user with the "member" user
    When I create the private group "Webship test circle" described as "A private group of a test run."
    Then the group page should say "Private Group"
    And the page should offer the "Manage" tab
    And the page should offer the "Members" tab with 1
    When I go to the groups directory
    Then the groups list should show "Webship test circle" with "Private Group"
    When I delete the group "Webship test circle"
    And I go to the groups directory
    Then the groups list should not show "Webship test circle"
