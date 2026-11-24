@notifications
Feature: Notifications and the e-mails a member gets
  As a member of the community
  I want to see what happened for me, and choose the e-mails I get
  So that I answer in time and my mailbox stays quiet

  Scenario: A notification read
    Given "newcomer" and "member" are not friends
    And I am a logged in user with the "newcomer" user
    When I go to the profile of "member"
    And I press "Add Friend" on the profile
    Given I am a logged in user with the "member" user
    When I go to my notifications
    Then my notifications should list "You have a friendship request from Newcomer Test"
    When I mark the notification "You have a friendship request from Newcomer Test" as read
    Then my notifications should not list "You have a friendship request from Newcomer Test"
    When I go to my read notifications
    Then my notifications should list "You have a friendship request from Newcomer Test"

  Scenario: A notification of a test deleted
    Given "newcomer" and "member" are not friends
    And I am a logged in user with the "newcomer" user
    When I go to the profile of "member"
    And I press "Add Friend" on the profile
    Given I am a logged in user with the "member" user
    When I go to my notifications
    Then my notifications should list "You have a friendship request from Newcomer Test"
    When I delete the notification "You have a friendship request from Newcomer Test"
    Then my notifications should not list "You have a friendship request from Newcomer Test"

  Scenario: An e-mail turned off is not sent
    Given "newcomer" and "member" are not friends
    And I am a logged in user with the "member" user
    When I turn off the email for "A member sends you a friendship request"
    Then the email for "A member sends you a friendship request" should be off
    Given I am a logged in user with the "newcomer" user
    When I go to the profile of "member"
    And I press "Add Friend" on the profile
    Then no community mail "New friendship request" should be sent to "member"
    And no community mail should be sent to "moderator"
