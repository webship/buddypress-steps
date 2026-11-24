@must-fail
Feature: Assertions of messages, notifications, mail and the administration that must fail
  Each scenario asserts something that is not true on the test site: its last step must fail with the message its
  description announces, and a hint. The scenarios only read; tests/check-must-fail.js runs them.

  Scenario: A text the messages page does not give
    Fails with: The messages page does not say "Your message was sent.".
    Given I am a logged in user with the "member" user
    When I go to my inbox
    Then the messages page should say "Your message was sent."

  Scenario: A conversation the inbox does not have
    Fails with: The box lists no conversation "Webship test nothing"
    Given I am a logged in user with the "member" user
    When I go to my inbox
    Then the box should list the conversation "Webship test nothing"

  Scenario: A message the conversation does not have
    Fails with: The conversation shows no "Webship test nothing"
    Given I am a logged in user with the "member" user
    When I go to my inbox
    And I open the conversation "Welcome to the club"
    Then the conversation should show "Webship test nothing"

  Scenario: A notification nobody got
    Fails with: My notifications do not list "Webship test nothing".
    Given I am a logged in user with the "member" user
    When I go to my notifications
    Then my notifications should list "Webship test nothing"

  Scenario: A mail nobody sent
    Fails with: No mail "Webship test nothing" came to member@example.com since the scenario began.
    Given I am not logged in
    Then a community mail "Webship test nothing" should be sent to "member"

  Scenario: The content of a mail nobody sent
    Fails with: No mail "Webship test nothing" came to member@example.com since the scenario began.
    Given I am not logged in
    Then the community mail "Webship test nothing" to "member" should contain "Hello"

  Scenario: An e-mail that is on
    Fails with: The e-mail for "A member sends you a new message" is on, not off.
    Given I am a logged in user with the "member" user
    Then the email for "A member sends you a new message" should be off

  Scenario: A component that is not active
    Fails with: The component "Site Tracking" is not active.
    Given I am a logged in user with the "admin" user
    Then the community component "Site Tracking" should be active

  Scenario: A field the group does not have
    Fails with: The group "Work" has no field "Location".
    Given I am a logged in user with the "admin" user
    Then the profile fields should list "Location" in "Work"

  Scenario: A group the administration does not list
    Fails with: The administration's groups do not list "Webship test nothing".
    Given I am a logged in user with the "admin" user
    Then the administration's groups should list "Webship test nothing"

  Scenario: An item the administration does not list
    Fails with: The administration's activity does not list "Webship test nothing".
    Given I am a logged in user with the "admin" user
    Then the administration's activity should list "Webship test nothing"
