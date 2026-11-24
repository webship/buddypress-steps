@profile
Feature: The profile fields and who may see them
  As a member of the community
  I want to say where I work from and what I do, and choose who sees it
  So that the right people know me and the others do not

  Scenario: A visitor reads the fields of a profile
    Given I am not logged in
    When I go to the profile of "member"
    And I open the "Profile" tab
    Then the profile should show "Name" as "Member Test"
    And the profile should show "Location" as "Nairobi"
    And the profile should show "Skills" as "Design"
    And the profile should not show the field "Website"
    And the profile should not show "Location" as "Lisbon"

  Scenario: A member changes a field and keeps another to the members
    Given I am a logged in user with the "member" user
    When I set my profile field "Location" to "Nairobi, Kenya"
    And I let "All Members" see my profile field "Location"
    And I save my profile
    Then my profile field "Location" should be "Nairobi, Kenya"
    And my profile field "Location" should be seen by "All Members"
    When I go to the profile of "member"
    And I open the "Profile" tab
    Then the profile should show "Location" as "Nairobi, Kenya"
    Given I am not logged in
    When I go to the profile of "member"
    And I open the "Profile" tab
    Then the profile should not show the field "Location"
    And the profile should show the field "About me"

  Scenario: A list of choices
    Given I am a logged in user with the "member" user
    When I set my profile field "Skills" to "Design, Writing"
    And I save my profile
    Then my profile field "Skills" should be "Design, Writing"
    When I go to my profile
    And I open the "Profile" tab
    Then the profile should show "Skills" as "Design"
    And the profile should show "Skills" as "Writing"
