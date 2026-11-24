<p align="center"><img src="https://raw.githubusercontent.com/webship/buddypress-steps/2.0.x/assets/logo.svg" alt="BuddyPress logo" width="96"></p>

# buddypress-steps

[![Test](https://github.com/webship/buddypress-steps/actions/workflows/test.yml/badge.svg)](https://github.com/webship/buddypress-steps/actions/workflows/test.yml)

Cucumber step definitions for testing communities on WordPress with BuddyPress, with
[webship-js](https://webship.co/docs/webship-js/2.0.x), a BDD browser automation harness built on Playwright and
Cucumber-js.

`@webship-js/buddypress-steps` is an extension of [`@webship-js/wordpress-steps`](https://github.com/webship/wordpress-steps):
it depends on it and loads it, so a community project installs this one pack and has both. The WordPress pack gives the
login by a handle of the users registry, the administration screens, menus and notices, a setting by its label and the
rest of the site; this pack adds the community:

- **the members directory and a profile**: the members it lists, its count, its search, its order and its tabs, the
  buttons of a row; a member's profile, its header and its buttons, its tabs and their counts, the fields it shows;
- **the profile fields**: a field of one's own profile set (a text, a rich text, a list of choices), who may see it
  ("Everyone", "Only Me", "All Members", "My Friends"), and what a visitor then sees;
- **friends**: a request from a profile, withdrawn, accepted or rejected, the requests an account received, its
  friends, a friendship cancelled;
- **the activity stream**: its items and who posted them, an update posted (on the profile or in a group), a comment, a
  favorite, a delete, the kinds of items ("Show:") and the tabs of the directory, an empty update refused;
- **groups**: the groups directory (a row's status, count and button, its search), a group's page and what it says,
  joining and leaving, a private group's membership request and its answer in the group's management, the members of a
  group and their roles, a role changed, a group made with the creation steps and deleted, a hidden group that answers
  "not found";
- **private messages and notifications**: a message sent to a member the site suggests, the inbox and the sent box, a
  conversation read, answered and deleted, a message refused without a recipient; the notifications, read and deleted;
- **the account's e-mail settings**, an e-mail turned off and on;
- **the registration form**: what it asks for, and its refusals (a taken login, a taken address);
- **the community in the administration**: its components, its profile fields, its groups and its activity;
- **the community's e-mails**, read in the local mail catcher.

No step phrase names the platform: a scenario reads `When I press "Join Group" on the group page` and `Then the members
of the group "Webship Club" should list "newcomer"`.

CI builds a real site with [DDEV](https://ddev.com) on the runner (the latest WordPress with the latest BuddyPress from
the plugin directory, its components, the accounts of the suite, the test content), on a block theme and on a classic
theme, and runs the whole suite against it twice on every push and pull request, then the assertions that must fail;
see [The test site](#the-test-site) and [`.github/workflows/test.yml`](.github/workflows/test.yml).

## From nothing to a green run

What the machine needs: Docker, [DDEV](https://ddev.com), git, python3, and Node.js 24 or later with npm. PHP, WP-CLI,
the database and the mail catcher run in DDEV's containers.

**1. The site.** The pack's own build script (the one CI runs) makes the site in a DDEV project of type `wordpress`:
the latest WordPress, BuddyPress from the plugin directory with the components a community uses, the theme WordPress
installs with, the five accounts of [Test users](#test-users) and the test content (see [The test site](#the-test-site)).
It takes about two minutes.

```bash
git clone https://github.com/webship/buddypress-steps.git
SITE_DIR="$PWD/buddypress-site" buddypress-steps/.github/scripts/build-ddev-site.sh
```

The community answers at `https://buddypresssteps.ddev.site/members/` and the mail catcher at
`https://buddypresssteps.ddev.site:8026`. The accounts are `administrator`, `organizer`, `moderator`, `member` and
`newcomer`, each with the password `dD.123123ddd` (step 3 names them).

In the [Webship Workspace](https://github.com/webship/workspace), its BuddyPress plugin builds the same site instead, on
top of its WordPress plugin, in a sites folder of the workspace (`dev/` here, the one `--with-needs` adds to a new
workspace; `test/`, `sandboxes/` and `demos/` work the same):

```bash
bash core/scripts/plugins.sh --require buddypress --with-needs
bash core/scripts/plugins.sh --activate buddypress --with-needs
bash core/scripts/plugins.sh --install buddypress
bash dev/cmd-buddypress-project.sh bpsite --install --add-users --sample-content
```

That community answers at `https://bpsite.ddev.site/members/` and the mail catcher at `https://bpsite.ddev.site:8026`.
`--sample-content` adds the profiles, friendships, groups, updates and the message the features name. Its accounts are
the plugin's, the same five with the workspace's shared password `dD.123123ddd`; the workspace's own account is the
installer's, one more administrator of the site.

**2. A test project.**

```bash
mkdir buddypress-tests && cd buddypress-tests
npm init -y
npm install --save-dev webship-js @webship-js/buddypress-steps
npx init-webship-js
```

`npx init-webship-js` writes `cucumber.js`, `playwright.config.ts`, the `tests/` folders with a first feature and the
`npm test` scripts, and installs Chromium. npm usually runs it already when it installs webship-js; a second run changes
nothing. npm installs `@webship-js/wordpress-steps` along with the pack.

**3. `cucumber.js`.** Replace the file with the wiring of the pack: the step files of webship-js and of the pack (which
loads the WordPress pack's itself), the tags that keep the assertions that must fail out of a normal run, the address of
the site and of its mail catcher, and the accounts (the JSON of [Test users](#test-users)). The first lines are the
starter's own: a feature named on the command line runs alone.

```javascript
// A feature file or a scenario (file:line) named on the command line runs alone:
// cucumber-js 12 would add it to the paths below, so `paths` is left empty then.
const OPTIONS_WITH_A_VALUE = new Set([
  '-c', '--config', '-f', '--format', '--format-options', '--i18n-keywords',
  '-i', '--import', '-l', '--loader', '--language', '--name', '--order',
  '-p', '--profile', '--parallel', '--plugin', '--plugin-options',
  '-r', '--require', '--require-module', '--retry', '--retry-tag-filter',
  '--shard', '-t', '--tags', '--world-parameters',
]);

function commandLinePaths() {
  if (!/cucumber(-js|\.js)?$/.test(String(process.argv[1] || ''))) return [];
  const args = process.argv.slice(2);
  const paths = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i].startsWith('-')) {
      if (OPTIONS_WITH_A_VALUE.has(args[i])) i += 1;
    } else {
      paths.push(args[i]);
    }
  }
  return paths;
}

const launchUrl = (process.env.LAUNCH_URL || 'https://buddypresssteps.ddev.site').replace(/\/+$/, '');

module.exports = {
  default: {
    requireModule: ['tsx/cjs'],
    require: [
      'node_modules/webship-js/tests/step-definitions/**/*.js',
      'node_modules/@webship-js/buddypress-steps/tests/step-definitions/**/*.js',
      'tests/step-definitions/**/*.js',
    ],
    paths: commandLinePaths().length ? [] : ['tests/features/**/*.feature'],
    // Work in progress and the assertions that must fail stay out of a normal run.
    tags: process.env.CUCUMBER_TAGS || 'not @wip and not @must-fail',
    format: ['@cucumber/pretty-formatter', 'json:tests/reports/cucumber_report.json'],
    worldParameters: {
      launchUrl,
      // The mail catcher of the site (the mail steps read it): the Mailpit of the DDEV project.
      mailUrl: `${launchUrl}:8026`,
      // The community's addresses, and the account that removes test content in the administration.
      community: { members: '/members/', groups: '/groups/', activity: '/activity/', register: '/register/', manager: 'admin' },
      // The waits webship-js adds around each page, scenario and step (milliseconds).
      minWaitTime: { page: 3000, before_scenario: 0, after_scenario: 0, before_step: 0, after_step: 0 },
      // "admin" is the handle the WordPress pack's features give the administrator; "name" is the community's.
      users: {
        admin: { username: 'administrator', password: 'dD.123123ddd', email: 'administrator@example.com', name: 'Administrator Test' },
        organizer: { username: 'organizer', password: 'dD.123123ddd', email: 'organizer@example.com', name: 'Organizer Test' },
        moderator: { username: 'moderator', password: 'dD.123123ddd', email: 'moderator@example.com', name: 'Moderator Test' },
        member: { username: 'member', password: 'dD.123123ddd', email: 'member@example.com', name: 'Member Test' },
        newcomer: { username: 'newcomer', password: 'dD.123123ddd', email: 'newcomer@example.com', name: 'Newcomer Test' },
      },
    },
  },
};
```

On a site from the Webship Workspace (step 1) the accounts are the same; its address goes in `LAUNCH_URL` (step 5), and
`mailUrl` follows it.

**4. A first feature**, `tests/features/first-run.feature`:

```gherkin
Feature: First run
  Scenario: A visitor finds a member and a group
    Given I am not logged in
    When I go to the members directory
    Then the members directory should list "Member Test"
    When I go to the groups directory
    Then the groups list should show "Webship Club" with "Public Group"

  Scenario: The newcomer may ask the member to be friends
    Given I am a logged in user with the "newcomer" user
    When I go to the profile of "member"
    Then the profile's friendship button should read "Add Friend"
    And the page should offer the "Friends" tab with 2
```

**5. Run it.** Set `LAUNCH_URL` to the address of the site: `https://buddypresssteps.ddev.site` for the build script's
site, `https://bpsite.ddev.site` for the Workspace's.

```bash
LAUNCH_URL=https://buddypresssteps.ddev.site npm test
```

A green first run prints every step, then the summary (the starter feature of `npx init-webship-js` and the two
scenarios above, passed) and the HTML report it wrote:

```
3 scenarios (3 passed)
11 steps (11 passed)
```

From there, copy the features of [`tests/features/`](tests/features/) (they also ship in the package, under
`node_modules/@webship-js/buddypress-steps/tests/features/`): together they use every step of the pack. They read no
file of their own, so they run on the build script's site and on the Workspace's as they are.

### What the suite tests

The features of this repository run every step of the pack against the test site, twice in a row in CI on every
change, then the assertions that must fail:

- **`members.feature`**: the members directory of a visitor (its count, its order, a search that finds one member and
  one that finds none) and of a member (the buttons of a row, its "My Friends" tab), a member's profile (its header,
  its buttons, its tabs and their counts, the tabs an account sees only on its own profile).
- **`profile.feature`**: the fields of a profile a visitor reads, a field changed and kept to the members (a visitor no
  longer sees it), a list of choices changed; each comes back when the scenario ends.
- **`registration.feature`**: what the registration form asks for, a taken login and a taken address refused.
- **`friends.feature`**: a request sent, mailed, seen in the notifications and rejected; one accepted, then the
  friendship cancelled; a request withdrawn; two accounts made friends for a scenario.
- **`activity.feature`**: the stream of a visitor, an update posted, commented on and deleted, an update in a group, a
  comment on another member's update (mailed to its author) and a favorite, the kinds of items, the tabs, an empty
  update refused.
- **`groups.feature`**: the groups directory of a visitor and of a member (a row's status, count and button, a search),
  a hidden group that answers "not found", a public group joined and left, a private group's request rejected (mailed
  both ways) and one accepted, a hidden group seen by its members.
- **`group-management.feature`**: the roles of a group, one changed (mailed); a private group made with the creation
  steps and deleted.
- **`messages.feature`**: the build's message waiting unread, a message sent, mailed, read, answered and deleted (for
  one side only), a message without a recipient refused.
- **`notifications.feature`**: a notification read (and back among the unread when the scenario ends), a notification
  of a test deleted, an e-mail turned off and not sent.
- **`administration.feature`**: the components, the profile fields, the groups and the activity of the administration.

Every scenario that makes an update, a comment, a group or a conversation removes it again, and every friendship,
membership, request, role, profile field, favorite, e-mail setting, read conversation and read notification it changes
comes back when it ends, with the stream items and notifications the community recorded for it: the suite leaves the
site as it found it.

The mail steps read only the mail that came since the scenario began, so a run never reads the mail of an earlier one.

Not tested: avatars and cover images (an upload that stays on the site), the "@mentions" of an update, group invitations
(the invitation of a member to a group), the account's password and address changed, the data export and the deletion
of one's own account, member types and group types, the Site Tracking component (off on a new install), the widgets and
blocks of the community, languages other than English (the steps read the site's words: "Add Friend", "Join Group",
"Changes saved."), and the registration completed (the suites never make an account).

## Requirements

- Node.js 24 or later
- A webship-js 2.0 test project (webship-js 2.0.16 or later)
- A site on WordPress with BuddyPress 14, its components on (Extended Profiles, Account Settings, Activity Streams,
  Notifications, Friend Connections, User Groups, Private Messaging), and accounts on it for the suite

## Install

```bash
npm install --save-dev @webship-js/buddypress-steps
```

npm installs `@webship-js/wordpress-steps` with it. List only this pack's step files in `cucumber.js`: it loads the
WordPress pack's itself. A project that also lists the WordPress pack's glob is fine while npm installed one copy of it
(Node loads a file once); a second, nested copy (the project pins another release line of it) registers every WordPress
step twice, so drop that glob then.

## What is included

| File | Covers |
| --- | --- |
| `buddypress-members.steps.js` | The members directory (its list, its count, its search, its order, its tabs, the buttons of a row), a member's profile (opening it, its header, its tabs and their counts, its buttons, the fields it shows), the tabs and their menus of a member's or a group's page. |
| `buddypress-profile.steps.js` | One's own profile form (a field set, who may see it, saved, its value and its level read), the registration form (what it asks for, a registration tried and refused). |
| `buddypress-friends.steps.js` | Two accounts made friends or no friends for a scenario, the friendship button of a profile (pressed and read), the requests an account received (accepted, rejected), the friends of a member. |
| `buddypress-activity.steps.js` | The activity stream (its items and who posted them), an update posted (on the profile or in a group), an empty one refused, a comment, the buttons of an item (a favorite, a delete), the kinds of items and the tabs. |
| `buddypress-groups.steps.js` | The groups directory and its search, a group's page and what it says, a group that answers "not found", joining and leaving, an account made a member or not, the members of a group, its membership requests and their answer, the roles of a group, a group made and deleted, the removal of a group of an earlier run. |
| `buddypress-messages.steps.js` | A message sent (and one refused without a recipient), the inbox and the sent box, a conversation read, answered and deleted, the removal of a conversation of an earlier run; the notifications (listed, read, deleted). |
| `buddypress-site.steps.js` | The community's mail in the mail catcher (sent, not sent, what one says), an e-mail of the account's settings turned on or off, the components, the profile fields, the groups and the activity of the administration. |
| `buddypress-defaults.js` | Loads the WordPress pack's steps, adds the community's screens to its named administration screens ("Profile Fields", "Community Components", "Activity", "Groups", "Emails"), and keeps per scenario the moment it began and the removals its steps asked for, run when it ends. It registers no step. |
| `buddypress-helpers.js` | Shared plumbing: the community's addresses, the lists it fills by script, a member's profile and the account logged in, the session of another account, the mail catcher. It registers no step. |

Text, links, fields, buttons, the status code and the headers of a page and the accessibility audit are webship-js's
own steps (`I should see "..."`, `I click "..."`); the login by a handle, the administration screens and notices are the
WordPress pack's (`Given I am a logged in user with the "member" user`, `Given I am on the "Profile Fields" admin
screen`).

## How the steps find things and wait

- **By what a person reads.** A member is named by a handle of the users registry (its login opens its profile, its
  `name` is what the lists show) or by the name the community shows; a group by its name (its address is the slug the
  community makes of it); an update by words of its text; a conversation by its subject; a field by its label.
- **No fixed sleeps.** The steps wait on the community's own signals:
  - the directories and the stream fill their lists by script after the page loaded ("Loading the members of your
    community. Please wait."): a step waits for that feedback to go and the rows to come;
  - a search, an order, a tab or a filter asks the site again: the step waits for that answer, then for the list;
  - "Add Friend", "Join Group", "Leave Group", "Mark as Favorite" answer in place: the step waits for the button's new
    words; a delete that asks "Are you sure?" is answered yes;
  - a form that loads a page (the profile form, the creation steps of a group, a membership request answered, the
    e-mail settings) is followed to that page and its feedback ("Changes saved.");
  - the mail in the mail catcher, polled until it arrives.
- **What a scenario changes comes back.** A step that changes the site asks for its removal when the scenario ends,
  whatever its outcome: a friendship or a request, a membership or a request, a role, a profile field and its level, a
  favorite, an e-mail setting, a conversation or a notification read go back as they were, and an update, a comment, a
  group or a conversation made goes, each by the account that may (the administrator in the activity stream and the
  groups list, each account of the registry for a conversation).
- **What the community records by itself goes too.** A membership or a profile field put back leaves the stream item
  the community recorded for it ("Newcomer Test joined the group Webship Club", "Member Test's profile was updated"),
  and a request leaves its notifications. After the removals, the manager's session of the site's API removes the
  stream items (hidden ones and comments too) and the notifications that the accounts of the users registry got since
  the scenario began, and puts the notifications the run found back to read or unread. Nothing of another account,
  and nothing older than the scenario, is touched, so a real site's activity stays as it is.
- **Failures say what was found.** `The groups list shows no "Webship Club" with "Public Group / 9 members". It shows
  "Webship Club (Public Group / 3 members)", "Design Circle (Private Group / 2 members)".` with a hint on where to look.

## Accounts

The suite never creates or deletes an account. Accounts are configuration: list the ones the site has in
`worldParameters.users`, by a handle the scenarios use, each with its `username` and `password`, its `email` for the
mail steps and its `name` as the community shows it:

```javascript
users: {
  admin: { username: 'administrator', password: process.env.WP_ADMIN_PASSWORD, email: 'administrator@example.com', name: 'Administrator Test' },
  member: { username: 'member', password: process.env.WP_MEMBER_PASSWORD, email: 'member@example.com', name: 'Member Test' },
},
```

The removals need one more thing: `worldParameters.community.manager`, the handle of an account that may delete any
update and any group (the site's administrator; `admin` by default).

## Test users

The accounts this repository's suite logs in as, exactly as `cucumber.js` lists them in `worldParameters.users` (the
default values; the `WP_<HANDLE>_USER`, `WP_<HANDLE>_PASSWORD`, `WP_<HANDLE>_EMAIL` and `WP_<HANDLE>_NAME` variables
replace them). The build script makes them; the Workspace's BuddyPress plugin makes the same five.

```json
{
  "admin": { "username": "administrator", "password": "dD.123123ddd", "email": "administrator@example.com", "name": "Administrator Test" },
  "organizer": { "username": "organizer", "password": "dD.123123ddd", "email": "organizer@example.com", "name": "Organizer Test" },
  "moderator": { "username": "moderator", "password": "dD.123123ddd", "email": "moderator@example.com", "name": "Moderator Test" },
  "member": { "username": "member", "password": "dD.123123ddd", "email": "member@example.com", "name": "Member Test" },
  "newcomer": { "username": "newcomer", "password": "dD.123123ddd", "email": "newcomer@example.com", "name": "Newcomer Test" }
}
```

`admin` is the site's administrator (the installer's account in the build script): every profile and group, the
community's administration, a member of the hidden group. `organizer` runs the three groups; `moderator` moderates the
public one; `member` has friends, two groups and a message; `newcomer` has nothing yet. The four are subscribers of the
site. They are accounts of a throwaway test site, with a placeholder password, not accounts of any real one.

## The test site

[`.github/scripts/build-ddev-site.sh`](.github/scripts/build-ddev-site.sh) builds the site the suite of this repository
runs against, in a DDEV project of type `wordpress` with PHP 8.4 and Node.js 24 (`WORDPRESS_VERSION`,
`BUDDYPRESS_VERSION`, `PHP_VERSION`, `THEME`, `SITE_TITLE` change it):

- the latest WordPress, with pretty addresses and registration open, and the theme it installs with (a block theme), or
  the classic theme `THEME` names;
- BuddyPress from the plugin directory: its own install first (a plugin activated from WP-CLI leaves it to the first
  page of the administration, which would turn the components below off again), without the welcome screen its
  activation asks for (for 30 seconds the first request of the administration goes there, even a visitor's request for
  the activity stream, which then stays empty), then the components a community uses, with the plugin's own command
  (`wp bp component activate`);
- the five accounts of [Test users](#test-users);
- the test content, written by [`site/community-site.php`](site/community-site.php) with the plugin's own functions, so
  the counts, the stream and the notifications are the ones the plugin keeps:

| What | The test content |
| --- | --- |
| Profile fields | "Name", "Location" and "About me" (Base); "Skills" (Design, Development, Writing) and "Website" (Work); each account's values |
| Friends | The organizer, the moderator and the member, each a friend of the two others; the newcomer has none |
| Groups | "Webship Club" (public: the organizer, the moderator as its moderator, the member), "Design Circle" (private: the organizer, the member), "Core Team" (hidden: the organizer, the administrator) |
| Updates | "Welcome to the Webship Community! …" by the organizer, with a comment by the member and its favorite; "The new pattern library is out …" by the member; "Club meeting on Thursday …" by the moderator in "Webship Club" |
| Messages | "Welcome to the club", from the organizer to the member, unread |

CI builds it twice, see [`.github/workflows/test.yml`](.github/workflows/test.yml): on the block theme WordPress
installs with and PHP 8.4 (with the assertions that must fail), and on a classic theme (Twenty Twenty-One) and PHP 8.2.
Each lane runs the suite twice and compares what the community holds before the first run and after each run
(`COUNTS_ONLY=1`): its stream items by type, hidden ones and comments included, each account's notifications and how
many are unread, its unread messages, friends, groups and favorites, and each group's members.

After a run that was stopped half way, `RESET_ONLY=1 SITE_DIR="$PWD/buddypress-site"
buddypress-steps/.github/scripts/build-ddev-site.sh` puts the community back as the build left it: every update,
comment, notification and message that came after the build goes (the build marks its newest items), the groups and
conversations named "Webship test …" too, and the friendships, the memberships and their roles, the profile fields and
who may see them, the favorites and the build's message come back, without a new stream item, notification or mail.

## Steps

One example of each step; the JSDoc block above each definition holds five.

### `buddypress-members.steps.js` (17)

- `Given I am on the members directory`
- `Then the members directory should list "member"`
- `Then the members directory should say "Viewing 1 - 5 of 5 active members"`
- `When I search the members for "Moderator"`
- `When I order the members by "Alphabetical"`
- `Then the members directory should list "Administrator Test", "Member Test" and "Moderator Test" in this order`
- `When I open the "My Friends" tab of the members directory`
- `Then the row of "member" in the members directory should offer "Add Friend"`
- `When I go to the profile of "member"`
- `When I go to my profile`
- `Then I should be on the profile of "member"`
- `When I open the "Friends" tab`
- `When I open "Requests" in the tab's menu`
- `Then the page should offer the "Friends" tab`
- `Then the page should offer the button "Add Friend"`
- `Then the profile should show "Location" as "Nairobi"`
- `Then the profile should show the field "Location"`

### `buddypress-profile.steps.js` (9)

- `When I set my profile field "Location" to "Nairobi, Kenya"`
- `When I let "All Members" see my profile field "Location"`
- `When I save my profile`
- `Then my profile field "Location" should be seen by "All Members"`
- `Then my profile field "Location" should be "Nairobi"`
- `Given I am on the registration page`
- `Then the registration form should ask for "Username"`
- `When I try to register as "member" with the email "member@example.com" and the name "Webship test person"`
- `Then the registration should be refused with "Sorry, that username already exists!"`

### `buddypress-friends.steps.js` (8)

- `Given "newcomer" and "member" are not friends`
- `Given "newcomer" and "member" are friends`
- `When I press "Add Friend" on the profile`
- `Then the profile's friendship button should read "Cancel Friendship Request"`
- `When I go to my friendship requests`
- `Then my friendship requests should list "newcomer"`
- `When I accept the friendship request of "newcomer"`
- `Then the friends of "member" should list "organizer"`

### `buddypress-activity.steps.js` (11)

- `Given I am on the activity stream`
- `Then the activity stream should show "Welcome to the Webship Community!"`
- `When I post the update "Webship test update one"`
- `When I post an empty update`
- `Then the update form should say "Please enter some content to post."`
- `When I comment "Webship test comment" on the update "Welcome to the Webship Community!"`
- `Then the update "Welcome to the Webship Community!" should show the comment "Hello everyone, glad to be here."`
- `When I press "Mark as Favorite" on the update "The new pattern library is out"`
- `Then the update "Welcome to the Webship Community!" should offer "Remove Favorite"`
- `When I show only "Updates" in the activity stream`
- `When I open the "My Favorites" tab of the activity stream`

### `buddypress-groups.steps.js` (17)

- `Given I am on the groups directory`
- `Then the groups list should show "Webship Club"`
- `Then the row of the group "Webship Club" should offer "Join Group"`
- `When I search the groups for "Club"`
- `When I go to the group "Webship Club"`
- `Then the group "Core Team" should not be found`
- `Then the group page should say "Private Group"`
- `When I press "Join Group" on the group page`
- `Given "newcomer" is not a member of the group "Webship Club"`
- `Then the members of the group "Webship Club" should list "member"`
- `Then the membership requests of the group "Design Circle" should list "newcomer"`
- `When I accept the membership request of "newcomer" to the group "Design Circle"`
- `Then the role of "moderator" in the group "Webship Club" should be "Moderator"`
- `When I change the role of "member" in the group "Webship Club" to "Moderator"`
- `When I create the public group "Webship test group" described as "A group made by a test run."`
- `When I delete the group "Webship test group"`
- `Given there is no group "Webship test group"`

### `buddypress-messages.steps.js` (14)

- `When I send the message "Webship test message" to "member" saying "Hello from a test."`
- `When I send the message "Webship test message" to nobody saying "Nobody gets this."`
- `Then the messages page should say "Please add at least one recipient."`
- `When I go to my inbox`
- `Then the box should list the conversation "Welcome to the club" with "Organizer Test"`
- `When I open the conversation "Welcome to the club"`
- `Then the conversation should show "Hi Member, welcome!" from "organizer"`
- `When I reply "Webship test reply" to the conversation`
- `When I delete the conversation`
- `Given there is no conversation "Webship test message"`
- `When I go to my notifications`
- `Then my notifications should list "You have a friendship request from Newcomer Test"`
- `When I mark the notification "You have a friendship request from Newcomer Test" as read`
- `When I delete the notification "You have a friendship request from Newcomer Test"`

### `buddypress-site.steps.js` (9)

- `Then a community mail "New friendship request from Newcomer Test" should be sent to "member"`
- `Then no community mail should be sent to "newcomer"`
- `Then the community mail "New friendship request from Newcomer Test" to "member" should contain "Newcomer Test wants to add you as a friend"`
- `When I turn off the email for "A member sends you a new message"`
- `Then the email for "A member sends you a new message" should be off`
- `Then the community component "Friend Connections" should be active`
- `Then the profile fields should list "Location" in "Base (Primary)"`
- `Then the administration's groups should list "Webship Club"`
- `Then the administration's activity should list "Welcome to the Webship Community!"`
## Phrases shared with other packs

The session phrases are the WordPress pack's, which this pack loads; none of this pack's phrases matches one of
the WordPress pack or of webship-js (`npm run test:examples` checks it). The platform packs are not meant to be
loaded together (one `cucumber.js` profile per system). Loaded beside each of the
42 packs published so far, these phrases of this pack also match one of theirs:

| Phrase of this pack | Also in |
| --- | --- |
| `I open the "…" tab` | filament, joomla, keycloak, mautic, odoo, payload |
| `I am on the registration page` | drupal-core |
| `I go to my inbox` | phpbb |
| `I go to the activity stream` | nextcloud |
| `I search the members for "…"` | ghost |
| `the activity stream should show "…"` | nextcloud |
| `the registration should be refused with "…"` | phpbb |

None matches a phrase of the component pack (Bootstrap), of the Diffy pack or of the Shopify pack, which can be
loaded beside this one.

## BuddyPress's own tests and this pack

BuddyPress tests itself with PHPUnit (`tests/phpunit/testcases/` of its repository): no browser suite, but the flows
and the counts its tests hold to are the logic these steps check on a real site, through the pages a person uses:

| BuddyPress's own tests | In this pack |
| --- | --- |
| `friends/functions.php`: the requests on request, accept, withdraw and reject; no friendship with oneself; the status of a friendship in the members loop | `friends.feature`: a request sent, then accepted, rejected or withdrawn, and the requests and the friends of each account after it; no "Add Friend" on one's own row; the buttons of the directory's rows by the friendship |
| `groups/functions.php`: the total member count after a join, a leave, an accepted request, a removal; the group count of a member | `groups.feature`: the "Members" tab's count before a join, the members of the group after a join and a leave, after a request accepted and one rejected; the counts of the directory's rows |
| `activity/functions.php`: an empty update refused, a comment, a favorite (not twice), a delete that takes the comments with it | `activity.feature`: "Please enter some content to post.", a comment shown under its update, "Mark as Favorite" turned into "Remove Favorite" and back, an update deleted from the stream |
| `messages/functions.php`: the unread count, a message with no recipient or no content refused | `messages.feature`: the build's message unread, "Please add at least one recipient.", a conversation answered and deleted |
| `notifications/functions.php`: marked read, deleted, no duplicate | `notifications.feature`: a notification read (and among the read ones), one deleted |
| `xprofile/functions.php`: field data, visibility levels | `profile.feature`: a field set and read back, a field kept to the members and gone for a visitor |

## Testing this package

```bash
npm ci
npm run test:examples    # every step's JSDoc examples match it and nothing else; every feature step resolves
npm run test:paths       # a feature named on the command line runs alone
npx cucumber-js --dry-run
SITE_DIR="$PWD/../buddypress-site" .github/scripts/build-ddev-site.sh
npx cucumber-js          # the whole suite
npm run test:must-fail   # the assertions that must fail, each with its message and a hint
THEME=twentytwentyone PHP_VERSION=8.2 SITE_DIR="$PWD/../buddypress-site-classic" .github/scripts/build-ddev-site.sh
npx cucumber-js
```

The second build makes a project of the same name: remove the first one before it (`ddev delete -Oy buddypresssteps`).

## How the steps were written

Every step was written from a round of manual testing of the real local site in the browser first: each page it touches
was opened as the account the step works as, its lists, labels and messages noted, and the signal it gives while it
works found (the "Loading …" feedback of a directory, the words a friendship button turns into, the feedback of a group
left, the address a sent message lands on). The failures of the first runs went back to the browser before the step
changed: the components the first page of the administration turned off again after an install from the command line,
the activity stream a visitor found empty on CI, where the suite starts within the 30 seconds the activation's welcome
screen catches the first request of the administration (the stream's own, through `admin-ajax.php`), the groups
directory that answers "not found" until the rewrite rules are written again, a row's count that stays until a reload,
the search term that stays for the other tabs of a directory, a conversation deleted for one side only, and the build's
message read again when a cleanup went back to the conversation a scenario ended on.

## License

MIT, see [LICENSE](LICENSE).

## Logo

The logo in this README is the BuddyPress mark WordPress itself ships in its icon font (`buddicons-buddypress-logo` of
`wp-includes/fonts/dashicons.svg`, WordPress 7.1.5, GPL-2.0-or-later), with its fill set to black; it stays under that
licence, and is not part of the npm package. Simple Icons, the source of most packs' logos, has none for BuddyPress. The
BuddyPress name and logo belong to their owner; this pack is not affiliated with or endorsed by them.
