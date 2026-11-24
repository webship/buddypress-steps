@members
Feature: The members directory and a member's profile
  As a member of the community
  I want to find the other members and read their profiles
  So that I know who is who before I write to them or ask them to be friends

  Scenario: A visitor reads the members directory, searches it and orders it
    Given I am not logged in
    When I go to the members directory
    Then the members directory should list "Organizer Test"
    And the members directory should list "newcomer"
    And the members directory should say "Viewing 1 - 5 of 5 active members"
    And the row of "member" in the members directory should not offer "Add Friend"
    When I order the members by "Alphabetical"
    Then the members directory should list "Administrator Test", "Member Test", "Moderator Test", "Newcomer Test" and "Organizer Test" in this order
    When I search the members for "Moderator"
    Then the members directory should list "moderator"
    And the members directory should not list "member"
    And the members directory should say "Viewing 1 member"
    When I search the members for "Nobody like this"
    Then the members directory should say "Sorry, no members were found."

  Scenario: A member sees who they may ask to be friends, and their own friends
    Given I am a logged in user with the "member" user
    When I go to the members directory
    Then the row of "newcomer" in the members directory should offer "Add Friend"
    And the row of "organizer" in the members directory should offer "Cancel Friendship"
    And the row of "member" in the members directory should not offer "Add Friend"
    When I open the "My Friends" tab of the members directory
    Then the members directory should list "organizer"
    And the members directory should list "moderator"
    And the members directory should not list "newcomer"
    When I open the "All Members" tab of the members directory
    Then the members directory should list "newcomer"

  Scenario: A member's profile, its header and its tabs
    Given I am a logged in user with the "newcomer" user
    When I go to the profile of "member"
    Then I should be on the profile of "member"
    And I should not be on the profile of "organizer"
    And the page should offer the button "Add Friend"
    And the page should offer the button "Private Message"
    And the page should offer the "Friends" tab with 2
    And the page should offer the "Groups" tab with 2
    And the page should not offer the "Messages" tab
    When I open the "Friends" tab
    Then the friends of "member" should list "organizer"
    When I go to my profile
    Then I should be on the profile of "newcomer"
    And the page should offer the "Messages" tab
    And the page should not offer the button "Add Friend"
