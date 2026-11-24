@must-fail
Feature: Assertions of friends, the stream and groups that must fail
  Each scenario asserts something that is not true on the test site: its last step must fail with the message its
  description announces, and a hint. The scenarios only read; tests/check-must-fail.js runs them.

  Scenario: Another state of the friendship button
    Fails with: The profile's friendship button reads "Cancel Friendship", not "Add Friend".
    Given I am a logged in user with the "member" user
    When I go to the profile of "organizer"
    Then the profile's friendship button should read "Add Friend"

  Scenario: A request nobody sent
    Fails with: My friendship requests do not list "Organizer Test".
    Given I am a logged in user with the "member" user
    When I go to my friendship requests
    Then my friendship requests should list "organizer"

  Scenario: A friend the member does not have
    Fails with: The friends of "member" do not list "Newcomer Test".
    Given I am not logged in
    Then the friends of "member" should list "newcomer"

  Scenario: An update the stream does not show
    Fails with: The activity stream shows no "Webship test nothing".
    Given I am not logged in
    When I go to the activity stream
    Then the activity stream should show "Webship test nothing"

  Scenario: A message the update form does not give
    Fails with: The update form does not say "Your update was posted.".
    Given I am a logged in user with the "member" user
    When I go to the activity stream
    Then the update form should say "Your update was posted."

  Scenario: A comment the update does not have
    Fails with: The update "Welcome to the Webship Community!" does not show the comment "Webship test nothing".
    Given I am not logged in
    When I go to the activity stream
    Then the update "Welcome to the Webship Community!" should show the comment "Webship test nothing"

  Scenario: A button a visitor does not get on an update
    Fails with: The update "Welcome to the Webship Community!" does not offer "Mark as Favorite".
    Given I am not logged in
    When I go to the activity stream
    Then the update "Welcome to the Webship Community!" should offer "Mark as Favorite"

  Scenario: A group the directory does not show
    Fails with: The groups list shows no "Core Team".
    Given I am not logged in
    When I go to the groups directory
    Then the groups list should show "Core Team"

  Scenario: Another count of members
    Fails with: The groups list shows no "Webship Club" with "Public Group / 9 members".
    Given I am not logged in
    When I go to the groups directory
    Then the groups list should show "Webship Club" with "Public Group / 9 members"

  Scenario: A button a member of the group does not get
    Fails with: The row of "Webship Club" does not offer "Join Group".
    Given I am a logged in user with the "member" user
    When I go to the groups directory
    Then the row of the group "Webship Club" should offer "Join Group"

  Scenario: A public group is found
    Fails with: The group "Webship Club" answered 200
    Given I am not logged in
    Then the group "Webship Club" should not be found

  Scenario: A text the group page does not show
    Fails with: The group page does not say "Hidden Group"
    Given I am not logged in
    When I go to the group "Webship Club"
    Then the group page should say "Hidden Group"

  Scenario: A member the group does not have
    Fails with: The members of "Webship Club" do not list "Newcomer Test".
    Given I am not logged in
    Then the members of the group "Webship Club" should list "newcomer"

  Scenario: A request nobody made
    Fails with: The membership requests of "Design Circle" do not list "Newcomer Test".
    Given I am a logged in user with the "organizer" user
    Then the membership requests of the group "Design Circle" should list "newcomer"

  Scenario: Another role
    Fails with: The role of "Member Test" in "Webship Club" is "Member", not "Administrator".
    Given I am a logged in user with the "organizer" user
    Then the role of "member" in the group "Webship Club" should be "Administrator"
