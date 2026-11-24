'use strict';

// What this pack brings along for every scenario. Not a step file.
//
//   1. The WordPress pack's steps. A community project installs this pack alone: the login by a handle of the users
//      registry, the administration screens, menus and notices, the settings by their labels, the REST API and the
//      feeds come from @webship-js/wordpress-steps, which this package depends on and loads here, so one `require`
//      glob in cucumber.js is enough. A project that lists the WordPress pack's glob as well is fine while npm
//      installed one copy of it (Node loads a file once); a second, nested copy (the project pins another release line
//      of it) registers every WordPress step twice, so drop that glob then (see README).
//
//   2. The community's administration screens, added to the WordPress pack's list of named screens: `Given I am on
//      the "Profile Fields" admin screen` opens the profile fields, as `the "Plugins" admin screen` opens the plugins.
//      A name the WordPress pack already has is never changed.
//
//   3. Per scenario: the moment it began (a mail step reads only the mail that arrived since then), and the removals
//      its steps asked for (an update, a group, a message thread a step made), run once it ends, whatever its outcome.

const fs = require('fs');
const path = require('path');
const { Before, After } = require('@cucumber/cucumber');

const WORDPRESS_STEPS_DIR = path.join(path.dirname(require.resolve('@webship-js/wordpress-steps/package.json')), 'tests', 'step-definitions');
for (const file of fs.readdirSync(WORDPRESS_STEPS_DIR).filter((f) => f.endsWith('.js')).sort()) {
  require(path.join(WORDPRESS_STEPS_DIR, file));
}

const { ADMIN_SCREENS } = require('@webship-js/wordpress-steps/tests/step-definitions/wordpress-helpers');

// The screens of the community's administration, by the name a person reads in the menu or on the screen, lower case.
const COMMUNITY_ADMIN_SCREENS = {
  'community components': '/wp-admin/options-general.php?page=bp-components',
  'community options': '/wp-admin/options-general.php?page=bp-settings',
  'profile fields': '/wp-admin/users.php?page=bp-profile-setup',
  'groups': '/wp-admin/admin.php?page=bp-groups',
  'activity': '/wp-admin/admin.php?page=bp-activity',
  'emails': '/wp-admin/edit.php?post_type=bp-email',
};
for (const [name, screen] of Object.entries(COMMUNITY_ADMIN_SCREENS)) {
  if (!(name in ADMIN_SCREENS)) ADMIN_SCREENS[name] = screen;
}

Before(function () {
  this.communityScenarioStartedAt = Date.now();
  this.communityCleanup = [];
});

// The removals the scenario's steps asked for, newest first; one that fails is reported and the others still run.
After({ timeout: 180000 }, async function () {
  const jobs = (this.communityCleanup || []).slice().reverse();
  this.communityCleanup = [];
  const failures = [];
  for (const job of jobs) {
    try {
      await job();
    } catch (err) {
      failures.push(err && err.message ? err.message : String(err));
    }
  }
  if (failures.length) {
    // eslint-disable-next-line no-console
    console.warn(`The removal of the scenario's test content met a problem: ${failures.join(' | ')}`);
  }
});

module.exports = { WORDPRESS_STEPS_DIR, COMMUNITY_ADMIN_SCREENS };
