@registration
Feature: The registration form
  As a visitor of the community
  I want to make an account with the form of the site
  So that I can join the community

  Scenario: The form asks for the account and the profile
    Given I am not logged in
    When I go to the registration page
    Then the registration form should ask for "Username"
    And the registration form should ask for "Email Address"
    And the registration form should ask for "Choose a Password"
    And the registration form should ask for "Name (required)"
    And the registration form should not ask for "Location"

  Scenario: A login and an address that are taken are refused
    Given I am not logged in
    When I go to the registration page
    And I try to register as "member" with the email "member@example.com" and the name "Webship test person"
    Then the registration should be refused with "Sorry, that username already exists!"
    And the registration should be refused with "Sorry, that email address is already used!"
