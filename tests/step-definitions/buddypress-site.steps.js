'use strict';

// The mail the community sends (read in the mail catcher), the e-mail settings of an account, and the community's
// administration: its components, its profile fields, its groups and its activity, as the administrator sees them.

const { When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const h = require('./buddypress-helpers');

/**
 * Assert the community sent (since the scenario began) a mail to an account of the users registry, or to an address,
 * whose subject holds some words; the site's name it puts first ("[Webship Community] ") aside.
 *
 * Example #1: Then a community mail "New friendship request from Newcomer Test" should be sent to "member"
 * Example #2: And a community mail "New message from Organizer Test" should be sent to "member"
 * Example #3: Then a community mail "Membership request for group: Design Circle" should be sent to "organizer"
 * Example #4: And a community mail "replied to one of your updates" should be sent to "organizer"
 * Example #5: Then a community mail "New friendship request" should be sent to "member@example.com"
 */
Then(/^a community mail "([^"]*)" should be sent to "([^"]*)"$/, async function (words, who) {
  const address = h.addressOf(this, who);
  await h.eventually(this, () => h.mailTo(this, address), (mails) => mails.some((m) => h.holds(h.subjectOf(m), words)), async (mails) => ({
    message: `No mail "${words}" came to ${address} since the scenario began. It got ${h.listed((mails || []).map(h.subjectOf))}.`,
    hint: 'The account may have turned that e-mail off (its Settings, "Email"); worldParameters.mailUrl names the mail catcher.',
  }), h.budget(this) * 5);
});

/**
 * Assert the community sent no mail (since the scenario began) to an account, or none whose subject holds some words.
 *
 * Example #1: Then no community mail should be sent to "newcomer"
 * Example #2: And no community mail "New friendship request" should be sent to "member"
 * Example #3: Then no community mail should be sent to "moderator"
 * Example #4: And no community mail "New message" should be sent to "organizer"
 * Example #5: Then no community mail "Membership request" should be sent to "organizer"
 */
Then(/^no community mail(?: "([^"]*)")? should be sent to "([^"]*)"$/, async function (words, who) {
  const address = h.addressOf(this, who);
  await this.page.waitForTimeout(h.budget(this));
  const mails = (await h.mailTo(this, address)).filter((m) => !h.supplied(words) || h.holds(h.subjectOf(m), words));
  if (mails.length) throw friendly({ message: `${address} got ${h.listed(mails.map(h.subjectOf))} since the scenario began.`, hint: "The mail catcher lists every mail that came since the scenario began; an e-mail turned off in the account's settings is not sent." });
});

/**
 * Assert the newest mail to an account whose subject holds some words carries a text in its body.
 *
 * Example #1: Then the community mail "New friendship request from Newcomer Test" to "member" should contain "Newcomer Test wants to add you as a friend"
 * Example #2: And the community mail "New message from Organizer Test" to "member" should contain "Webship test message"
 * Example #3: Then the community mail "New friendship request" to "member" should contain "To accept this request"
 * Example #4: And the community mail "Membership request for group" to "organizer" should contain "Newcomer Test wants to join the group"
 * Example #5: Then the community mail "New message" to "member" should contain "Hello from a test."
 */
Then(/^the community mail "([^"]*)" to "([^"]*)" should contain "([^"]*)"$/, async function (words, who, text) {
  const address = h.addressOf(this, who);
  const mails = await h.eventually(this, () => h.mailTo(this, address), (all) => all.some((m) => h.holds(h.subjectOf(m), words)), async (all) => ({ message: `No mail "${words}" came to ${address} since the scenario began. It got ${h.listed((all || []).map(h.subjectOf))}.`, hint: 'The site sends its mail when the event happens; worldParameters.mailUrl names the mail catcher.' }), h.budget(this) * 5);
  const mail = mails.find((m) => h.holds(h.subjectOf(m), words));
  const body = await h.mailText(this, mail.ID);
  if (!h.holds(body, text)) throw friendly({ message: `The mail "${h.subjectOf(mail)}" to ${address} does not contain "${text}". It reads: "${body.slice(0, 300)}".`, hint: 'The body is the text version of the mail (its HTML without the markup when it has none).' });
});

// ---------------------------------------------------------------------------
// The e-mail settings of an account
// ---------------------------------------------------------------------------

/** The rows of the e-mail settings on the page: the event, and the choice that is checked. */
async function emailRows(world) {
  return world.page.locator('#item-body table.notification-settings tbody tr, #item-body table tbody tr').evaluateAll((trs) => trs.map((tr) => {
    const cells = tr.querySelectorAll('td');
    const checked = tr.querySelector('input[type=radio]:checked');
    return { event: cells.length ? cells[cells.length > 2 ? 1 : 0].innerText : '', value: checked ? checked.value : '' };
  })).catch(() => []).then((rows) => rows.map((r) => ({ event: h.clean(r.event), value: r.value })).filter((r) => r.event && r.value));
}

/**
 * Turn an e-mail of my settings on or off ("Settings", "Email": "Yes, send email" or "No, do not send email" for an
 * event), and save the settings; the choice comes back when the scenario ends.
 *
 * Example #1: When I turn off the email for "A member sends you a new message"
 * Example #2: And I turn on the email for "A member sends you a new message"
 * Example #3: When we turn off the email for "A member sends you a friendship request"
 * Example #4: And I turn off the email for "A member invites you to join a group"
 * Example #5: When I turn on the email for "A member sends you a friendship request"
 */
When(/^(I |we )*turn (on|off) the email for "([^"]*)"$/, async function (pronounCase, state, event) {
  const handle = await h.me(this);
  await h.visit(this, h.profilePath(this, handle, 'settings/notifications'));
  const before = (await emailRows(this)).find((r) => h.holds(r.event, event));
  if (!before) throw friendly({ message: `My e-mail settings have no "${event}". They have ${h.listed((await emailRows(this)).map((r) => r.event))}.`, hint: 'The events are the rows of "Email Notifications".' });
  await chooseEmail(this, event, state === 'on' ? 'yes' : 'no');
  if (before.value !== (state === 'on' ? 'yes' : 'no')) {
    h.afterScenario(this, () => h.asAccount(this, handle, async () => {
      await h.visit(this, h.profilePath(this, handle, 'settings/notifications'));
      await chooseEmail(this, event, before.value);
    }));
  }
});

async function chooseEmail(world, event, value) {
  const row = world.page.locator('#item-body table tbody tr').filter({ hasText: event }).first();
  await row.locator(`input[type=radio][value=${value}]`).check();
  await h.clickAndLoad(world, world.page.locator('#item-body form [type=submit]').filter({ hasText: /Save/ }).or(world.page.locator('#item-body form input[type=submit]')).first(), 'save the e-mail settings');
}

/**
 * Assert an e-mail of my settings is on or off.
 *
 * Example #1: Then the email for "A member sends you a new message" should be off
 * Example #2: And the email for "A member sends you a new message" should be on
 * Example #3: Then the email for "A member sends you a friendship request" should be on
 * Example #4: And the email for "A member invites you to join a group" should be off
 * Example #5: Then the email for "A member sends you a friendship request" should be off
 */
Then(/^the email for "([^"]*)" should be (on|off)$/, async function (event, state) {
  if (!/\/settings\/notifications\//.test(this.page.url())) await h.visit(this, h.profilePath(this, await h.me(this), 'settings/notifications'));
  const row = (await emailRows(this)).find((r) => h.holds(r.event, event));
  if (!row) throw friendly({ message: `My e-mail settings have no "${event}".`, hint: 'The events are the rows of the account\'s "Settings", "Email" page.' });
  const now = row.value === 'yes' ? 'on' : 'off';
  if (now !== state) throw friendly({ message: `The e-mail for "${event}" is ${now}, not ${state}.`, hint: 'The choice is "Yes, send email" (on) or "No, do not send email" (off) on the account\'s "Settings", "Email" page.' });
});

// ---------------------------------------------------------------------------
// The administration
// ---------------------------------------------------------------------------

/**
 * Assert a component of the community is active (or not) in its settings ("Settings", "BuddyPress", "Components"):
 * "Friend Connections", "User Groups", "Private Messaging", "Activity Streams", "Extended Profiles", "Notifications".
 *
 * Example #1: Then the community component "Friend Connections" should be active
 * Example #2: And the community component "User Groups" should be active
 * Example #3: Then the community component "Site Tracking" should not be active
 * Example #4: And the community component "Private Messaging" should be active
 * Example #5: Then the community component "Activity Streams" should be active
 */
Then(/^the community component "([^"]*)" should( not)* be active$/, async function (name, notCase) {
  await h.visitAdmin(this, '/wp-admin/options-general.php?page=bp-components&action=all');
  const rows = await this.page.locator('#bp-admin-component-form tbody tr, table.wp-list-table tbody tr').evaluateAll((trs) => trs.map((tr) => ({
    name: (tr.querySelector('.plugin-title strong, .plugin-title label, td.plugin-title, th + td strong') || tr.querySelector('strong') || {}).innerText || '',
    active: tr.classList.contains('active') || Boolean(tr.querySelector('input[type=checkbox]:checked')),
  }))).catch(() => []);
  const row = rows.find((r) => h.same(r.name, name));
  if (!row) throw friendly({ message: `The community's components have no "${name}". They are ${h.listed(rows.map((r) => r.name))}.`, hint: 'Log in as the administrator first.' });
  if (row.active === Boolean(notCase)) throw friendly({ message: `The component "${name}" is ${row.active ? 'active' : 'not active'}.`, hint: 'The components are on "Settings", "BuddyPress", "Components" of the administration.' });
});

/**
 * Assert the profile fields of the administration ("Users", "Profile Fields") list a field in a group of fields
 * ("Base (Primary)", "Work").
 *
 * Example #1: Then the profile fields should list "Location" in "Base (Primary)"
 * Example #2: And the profile fields should list "Skills" in "Work"
 * Example #3: Then the profile fields should list "Name" in "Base (Primary)"
 * Example #4: And the profile fields should list "Website" in "Work"
 * Example #5: Then the profile fields should list "About me" in "Base (Primary)"
 */
Then(/^the profile fields should list "([^"]*)" in "([^"]*)"$/, async function (field, group) {
  await h.visitAdmin(this, '/wp-admin/users.php?page=bp-profile-setup');
  const tabs = this.page.locator('#tabs > ul li a, .ui-tabs-nav li a');
  const labels = (await tabs.allInnerTexts().catch(() => [])).map(h.clean);
  const index = labels.findIndex((l) => h.same(l, group));
  if (index < 0) throw friendly({ message: `The profile fields have no group "${group}". They have ${h.listed(labels)}.`, hint: 'Log in as the administrator first.' });
  await tabs.nth(index).click();
  const panel = this.page.locator(await tabs.nth(index).getAttribute('href'));
  const fields = (await panel.locator('fieldset legend span, fieldset legend').allInnerTexts().catch(() => [])).map((t) => h.clean(t).replace(/\s*\(.*\)\s*$/, ''));
  if (!fields.some((f) => h.same(f, field) || h.holds(f, field))) throw friendly({ message: `The group "${group}" has no field "${field}". It has ${h.listed(fields)}.`, hint: 'The fields of a group are its tab in "Users", "Profile Fields".' });
});

/**
 * Assert the groups of the administration ("Groups") list (or do not list) a group, and, when given, with a text of
 * its row ("Hidden", "Private").
 *
 * Example #1: Then the administration's groups should list "Webship Club"
 * Example #2: And the administration's groups should list "Core Team" with "Hidden"
 * Example #3: Then the administration's groups should not list "Webship test group"
 * Example #4: And the administration's groups should list "Design Circle" with "Private"
 * Example #5: Then the administration's groups should list "Webship Club" with "Public"
 */
Then(/^the administration's groups should( not)* list "([^"]*)"(?: with "([^"]*)")?$/, async function (notCase, name, words) {
  await h.visitAdmin(this, '/wp-admin/admin.php?page=bp-groups');
  const rows = (await this.page.locator('table.wp-list-table tbody tr').allInnerTexts().catch(() => [])).map(h.clean);
  const found = rows.some((r) => h.holds(r, name) && (!h.supplied(words) || h.holds(r, words)));
  if (found === Boolean(notCase)) throw friendly({ message: notCase ? `The administration's groups list "${name}".` : `The administration's groups do not list "${name}"${h.supplied(words) ? ` with "${words}"` : ''}. They list ${h.listed(rows.map((r) => r.slice(0, 60)))}.`, hint: 'Log in as the administrator first.' });
});

/**
 * Assert the activity of the administration ("Activity") lists (or does not list) an item by words of its text.
 *
 * Example #1: Then the administration's activity should list "Welcome to the Webship Community!"
 * Example #2: And the administration's activity should list "Club meeting on Thursday"
 * Example #3: Then the administration's activity should not list "Webship test update"
 * Example #4: And the administration's activity should list "The new pattern library is out"
 * Example #5: Then the administration's activity should not list "Webship test comment"
 */
Then(/^the administration's activity should( not)* list "([^"]*)"$/, async function (notCase, words) {
  await h.visitAdmin(this, `/wp-admin/admin.php?page=bp-activity&s=${encodeURIComponent(words)}`);
  const rows = (await this.page.locator('table.wp-list-table tbody tr').allInnerTexts().catch(() => [])).map(h.clean).filter((r) => !/No activities found/i.test(r));
  const found = rows.some((r) => h.holds(r, words));
  if (found === Boolean(notCase)) throw friendly({ message: notCase ? `The administration's activity lists "${words}".` : `The administration's activity does not list "${words}". It lists ${h.listed(rows.map((r) => r.slice(0, 60)))}.`, hint: 'Log in as the administrator first.' });
});

module.exports = { emailRows };
