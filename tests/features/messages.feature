@messages
Feature: Private messages
  As a member of the community
  I want to write to another member and answer what I get
  So that we talk without the whole community reading

  Scenario: The message of the build waits in the member's inbox
    Given I am a logged in user with the "member" user
    When I go to my inbox
    Then the box should list the unread conversation "Welcome to the club" with "organizer"
    When I open the conversation "Welcome to the club"
    Then the conversation should show "Hi Member, welcome!" from "organizer"

  Scenario: A message sent, read, answered and deleted
    Given there is no conversation "Webship test message"
    And I am a logged in user with the "organizer" user
    When I send the message "Webship test message" to "member" saying "Hello from a test."
    Then the box should list the conversation "Webship test message" with "member"
    And a community mail "New message from Organizer Test" should be sent to "member"
    And the community mail "New message from Organizer Test" to "member" should contain "Hello from a test."
    Given I am a logged in user with the "member" user
    When I go to my inbox
    Then the box should list the unread conversation "Webship test message" with "Organizer Test"
    When I open the conversation "Webship test message"
    And I reply "Webship test reply" to the conversation
    Then the conversation should show "Webship test reply" from "member"
    And the conversation should show "Hello from a test." from "organizer"
    When I delete the conversation
    Then the messages page should say "Messages deleted"
    When I go to my inbox
    Then the box should not list the conversation "Webship test message"
    Given I am a logged in user with the "organizer" user
    When I go to my sent box
    Then the box should list the conversation "Webship test message"

  Scenario: A message without a recipient is refused
    Given I am a logged in user with the "member" user
    When I send the message "Webship test message" to nobody saying "Nobody gets this."
    Then the messages page should say "Please add at least one recipient."
