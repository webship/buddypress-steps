@must-fail
Feature: Assertions of members and profiles that must fail
  Each scenario asserts something that is not true on the test site: its last step must fail with the message its
  description announces, and a hint. The scenarios only read; tests/check-must-fail.js runs them.

  Scenario: A member the directory does not list
    Fails with: Expected the members directory to list "Nobody Test".
    Given I am not logged in
    When I go to the members directory
    Then the members directory should list "Nobody Test"

  Scenario: A member the directory lists
    Fails with: Expected the members directory not to list "Member Test", but it does.
    Given I am not logged in
    When I go to the members directory
    Then the members directory should not list "member"

  Scenario: A count the directory does not say
    Fails with: The members directory does not say "Viewing 1 - 9 of 9 active members".
    Given I am not logged in
    When I go to the members directory
    Then the members directory should say "Viewing 1 - 9 of 9 active members"

  Scenario: Another order
    Fails with: The members directory does not list "Organizer Test" and "Administrator Test" in this order.
    Given I am not logged in
    When I go to the members directory
    And I order the members by "Alphabetical"
    Then the members directory should list "organizer" and "admin" in this order

  Scenario: A button a visitor does not get
    Fails with: The row of "Member Test" does not offer "Add Friend".
    Given I am not logged in
    When I go to the members directory
    Then the row of "member" in the members directory should offer "Add Friend"

  Scenario: Another member's profile
    Fails with: The page is not the profile of "Organizer Test"
    Given I am not logged in
    When I go to the profile of "member"
    Then I should be on the profile of "organizer"

  Scenario: Another count of friends
    Fails with: The page does not offer the tab "Friends" with 7.
    Given I am not logged in
    When I go to the profile of "member"
    Then the page should offer the "Friends" tab with 7

  Scenario: A button of the header a visitor does not get
    Fails with: The page does not offer the button "Add Friend".
    Given I am not logged in
    When I go to the profile of "member"
    Then the page should offer the button "Add Friend"

  Scenario: Another value of a field
    Fails with: The profile shows "Location" as "Nairobi", not "Lisbon".
    Given I am not logged in
    When I go to the profile of "member"
    Then the profile should show "Location" as "Lisbon"

  Scenario: A field the member left empty
    Fails with: The profile shows no field "Website".
    Given I am not logged in
    When I go to the profile of "member"
    Then the profile should show the field "Website"

  Scenario: Another level of a field
    Fails with: My profile field "Location" may be seen by "Everyone", not "Only Me".
    Given I am a logged in user with the "member" user
    When I go to my profile
    And I open the "Profile" tab
    And I open "Edit" in the tab's menu
    Then my profile field "Location" should be seen by "Only Me"

  Scenario: Another value of my field
    Fails with: My profile field "Location" is "Nairobi", not "Lisbon".
    Given I am a logged in user with the "member" user
    When I go to my profile
    And I open the "Profile" tab
    And I open "Edit" in the tab's menu
    Then my profile field "Location" should be "Lisbon"

  Scenario: A field the registration form does not ask for
    Fails with: The registration form does not ask for "Location".
    Given I am not logged in
    When I go to the registration page
    Then the registration form should ask for "Location"

  Scenario: A refusal the form did not make
    Fails with: The registration was not refused with "Sorry, that username already exists!".
    Given I am not logged in
    When I go to the registration page
    Then the registration should be refused with "Sorry, that username already exists!"
