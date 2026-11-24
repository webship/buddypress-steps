'use strict';

// The members of the community: the members directory (its list, its search, its order and its tabs, the buttons of
// a row), a member's profile (its header, its tabs and their counts, the fields it shows) and the registration form.

const { Given, When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const h = require('./buddypress-helpers');

const MEMBERS = '#members-list';

/** Open the members directory and wait for its list. */
async function openDirectory(world) {
  await h.visit(world, h.communityPath(world, 'members'));
  await h.waitForList(world, MEMBERS);
}

/** The rows of the members list on the page: their names and the labels of their buttons. */
async function memberRows(world) {
  return world.page.locator(`${MEMBERS} > li`).evaluateAll((rows) => rows.map((li) => ({
    name: (li.querySelector('.list-title, .item-title') || {}).innerText || '',
    meta: (li.querySelector('.item-meta') || {}).innerText || '',
    buttons: [...li.querySelectorAll('.members-action-buttons button, .members-action-buttons a, .action button, .action a, .generic-button button, .generic-button a')]
      .map((b) => (b.innerText || '').trim()).filter(Boolean),
  }))).catch(() => []);
}

/** Wait for the list the directory fills again after a search, an order or a tab (its request to the site's AJAX). */
async function refilled(world, action) {
  const page = world.page;
  const answer = page.waitForResponse((r) => /admin-ajax\.php/.test(r.url()) && r.request().method() === 'POST', { timeout: h.budget(world) * 4 }).catch(() => null);
  await action();
  await answer;
  await h.waitForList(world, MEMBERS);
}

/** Whether the page is the members directory. */
async function onDirectory(world) {
  return (await world.page.locator(`#buddypress ${MEMBERS}, #buddypress #members-dir-list`).count()) > 0;
}

async function requireDirectory(world) {
  if (!(await onDirectory(world))) {
    throw friendly({ message: `The members directory is not open: ${await h.pageSummary(world)}.`, hint: 'Open it first: Given I am on the members directory.' });
  }
}

/**
 * Open the members directory ("/members/"; `worldParameters.community.members` names another address) and wait for
 * its list, which the page fills after it loaded.
 *
 * Example #1: Given I am on the members directory
 * Example #2: When I go to the members directory
 * Example #3: Given we are on the members directory
 * Example #4: And I go to the members directory
 * Example #5: When we go to the members directory
 */
Given(/^(?:(?:I am |we are )+on|(?:I |we )*go to) the members directory$/, async function () {
  await openDirectory(this);
});

/**
 * Assert the list of the members directory shows (or does not show) a member, by a handle of the users registry or
 * by the name the community shows.
 *
 * Example #1: Then the members directory should list "member"
 * Example #2: And the members directory should list "Organizer Test"
 * Example #3: Then the members directory should not list "newcomer"
 * Example #4: And the members directory should not list "Nobody Test"
 * Example #5: Then the members directory should list "moderator"
 */
Then(/^the members directory should( not)* list "([^"]*)"$/, async function (notCase, who) {
  await requireDirectory(this);
  const name = h.nameOf(this, who);
  await h.eventually(this, () => memberRows(this), (rows) => rows.some((r) => h.same(r.name, name)) !== Boolean(notCase), async (rows) => ({
    message: notCase
      ? `Expected the members directory not to list "${name}", but it does.`
      : `Expected the members directory to list "${name}". It lists ${h.listed((rows || []).map((r) => r.name))}.`,
    hint: 'The list is the page the directory is on: a search, an order or a tab changes it.',
  }));
});

/**
 * Assert what the members directory says about its list: the count under it ("Viewing 1 - 5 of 5 active members"),
 * or the feedback of an empty list ("Sorry, no members were found.").
 *
 * Example #1: Then the members directory should say "Viewing 1 - 5 of 5 active members"
 * Example #2: And the members directory should say "Sorry, no members were found."
 * Example #3: Then the members directory should say "Viewing 1 active member"
 * Example #4: And the members directory should say "of 5 active members"
 * Example #5: Then the members directory should say "no members were found"
 */
Then(/^the members directory should say "([^"]*)"$/, async function (words) {
  await requireDirectory(this);
  const read = async () => {
    const counts = await this.page.locator('#buddypress .pag-count').allInnerTexts().catch(() => []);
    return [...counts.map(h.clean), ...(await h.feedback(this))];
  };
  await h.eventually(this, read, (texts) => texts.some((t) => h.holds(t, words)), async (texts) => ({
    message: `The members directory does not say "${words}". It says ${h.listed(texts)}.`,
    hint: 'Its count reads "Viewing 1 - 5 of 5 active members"; an empty list says "Sorry, no members were found.".',
  }));
});

/**
 * Search the members directory (its box "Search Members…" and the Enter key), and wait for the list it fills again.
 *
 * Example #1: When I search the members for "Moderator"
 * Example #2: And we search the members for "Test"
 * Example #3: When I search the members for "Nobody here"
 * Example #4: Then I search the members for "Organizer"
 * Example #5: When we search the members for "Member"
 */
When(/^(I |we )*search the members for "([^"]*)"$/, async function (pronounCase, words) {
  await requireDirectory(this);
  const box = this.page.getByRole('searchbox', { name: /Search Members/ }).first();
  if (!(await box.count())) throw friendly({ message: 'The members directory has no search box.', hint: 'Its box is "Search Members…".' });
  await box.fill(words);
  await refilled(this, () => box.press('Enter'));
});

/**
 * Order the members directory by one of its choices ("Last Active", "Newest Registered", "Alphabetical").
 *
 * Example #1: When I order the members by "Alphabetical"
 * Example #2: And we order the members by "Newest Registered"
 * Example #3: When I order the members by "Last Active"
 * Example #4: Then I order the members by "Alphabetical"
 * Example #5: When we order the members by "Last Active"
 */
When(/^(I |we )*order the members by "([^"]*)"$/, async function (pronounCase, choice) {
  await requireDirectory(this);
  const select = this.page.locator('#members-order-by');
  const options = await select.locator('option').allInnerTexts().catch(() => []);
  const option = options.find((o) => h.same(o, choice));
  if (!option) throw friendly({ message: `The members directory has no order "${choice}". It offers ${h.listed(options)}.`, hint: 'The choices of "Order By:".' });
  await refilled(this, () => select.selectOption({ label: option }));
});

/**
 * Assert the order of the members directory's list: the names, from the first.
 *
 * Example #1: Then the members directory should list "Administrator Test", "Member Test" and "Moderator Test" in this order
 * Example #2: And the members directory should list "member" and "moderator" in this order
 * Example #3: Then the members directory should list "Newcomer Test" and "Organizer Test" in this order
 * Example #4: And the members directory should list "admin", "member" and "newcomer" in this order
 * Example #5: Then the members directory should list "Moderator Test" and "Newcomer Test" in this order
 */
Then(/^the members directory should list ((?:"[^"]*"(?:, | and )?)+) in this order$/, async function (list) {
  await requireDirectory(this);
  const wanted = (list.match(/"[^"]*"/g) || []).map((q) => h.nameOf(this, q.slice(1, -1)));
  await h.eventually(this, () => memberRows(this), (rows) => {
    const names = rows.map((r) => h.clean(r.name)).filter((n) => wanted.some((w) => h.same(w, n)));
    return names.length === wanted.length && names.every((n, i) => h.same(n, wanted[i]));
  }, async (rows) => ({
    message: `The members directory does not list ${h.listed(wanted)} in this order. It lists ${h.listed((rows || []).map((r) => r.name))}.`,
    hint: 'The order is the one "Order By:" chose; a search keeps only some members.',
  }));
});

/**
 * Open a tab of the members directory ("All Members", "My Friends"), its count aside, and wait for its list.
 *
 * Example #1: When I open the "My Friends" tab of the members directory
 * Example #2: And we open the "All Members" tab of the members directory
 * Example #3: When I open the "My Friends" tab of the members directory
 * Example #4: Then I open the "All Members" tab of the members directory
 * Example #5: When we open the "My Friends" tab of the members directory
 */
When(/^(I |we )*open the "([^"]*)" tab of the members directory$/, async function (pronounCase, label) {
  await requireDirectory(this);
  const tabs = this.page.locator('nav[aria-label="Directory menu"] li a, #buddypress .dir-navs li a');
  const texts = (await tabs.allInnerTexts()).map(h.tabLabel);
  let index = texts.findIndex((t) => h.same(t, label));
  // The first tab reads "All Members" or "Active Members" after the list's order.
  if (index < 0 && /^all members$/i.test(h.clean(label))) index = texts.findIndex((t) => /members$/i.test(t) && !/friends/i.test(t));
  if (index < 0) throw friendly({ message: `The members directory has no tab "${label}". It has ${h.listed(texts)}.`, hint: '"My Friends" shows for an account with friends.' });
  await refilled(this, () => tabs.nth(index).click());
});

/**
 * Assert a row of the members directory offers (or does not offer) a button ("Add Friend", "Cancel Friendship",
 * "Cancel Friendship Request").
 *
 * Example #1: Then the row of "member" in the members directory should offer "Add Friend"
 * Example #2: And the row of "organizer" in the members directory should offer "Cancel Friendship"
 * Example #3: Then the row of "newcomer" in the members directory should not offer "Add Friend"
 * Example #4: And the row of "Moderator Test" in the members directory should offer "Add Friend"
 * Example #5: Then the row of "member" in the members directory should not offer "Cancel Friendship"
 */
Then(/^the row of "([^"]*)" in the members directory should( not)* offer "([^"]*)"$/, async function (who, notCase, label) {
  await requireDirectory(this);
  const name = h.nameOf(this, who);
  await h.eventually(this, () => memberRows(this), (rows) => {
    const row = rows.find((r) => h.same(r.name, name));
    return Boolean(row) && row.buttons.some((b) => h.same(b, label)) !== Boolean(notCase);
  }, async (rows) => {
    const row = (rows || []).find((r) => h.same(r.name, name));
    return {
      message: !row
        ? `The members directory lists no "${name}". It lists ${h.listed((rows || []).map((r) => r.name))}.`
        : `The row of "${name}" ${notCase ? 'offers' : 'does not offer'} "${label}". It offers ${h.listed(row.buttons)}.`,
      hint: 'A visitor sees no button; nobody sees one on their own row.',
    };
  });
});

// ---------------------------------------------------------------------------
// A member's profile
// ---------------------------------------------------------------------------

/**
 * Open the profile of a member, by a handle of the users registry ("/members/<login>/").
 *
 * Example #1: When I go to the profile of "member"
 * Example #2: Given I am on the profile of "organizer"
 * Example #3: And we go to the profile of "moderator"
 * Example #4: When I go to the profile of "newcomer"
 * Example #5: Given we are on the profile of "admin"
 */
Given(/^(?:(?:I am |we are )+on|(?:I |we )*go to) the profile of "([^"]*)"$/, async function (who) {
  const status = await h.visit(this, h.profilePath(this, who));
  if (status === 404) throw friendly({ message: `The site has no profile of "${who}" (404 at ${this.page.url()}).`, hint: 'Check the account\'s login in worldParameters.users.' });
});

/**
 * Open my own profile: the one of the account logged in.
 *
 * Example #1: When I go to my profile
 * Example #2: Given I am on my profile
 * Example #3: And we go to my profile
 * Example #4: When I go to my profile
 * Example #5: Given we are on my profile
 */
Given(/^(?:(?:I am |we are )+on|(?:I |we )*go to) my profile$/, async function () {
  await h.visit(this, h.profilePath(this, await h.me(this)));
});

/**
 * Assert the page is the profile of a member: its header names them (and shows their @login).
 *
 * Example #1: Then I should be on the profile of "member"
 * Example #2: And I should be on the profile of "Organizer Test"
 * Example #3: Then we should be on the profile of "moderator"
 * Example #4: Then I should not be on the profile of "newcomer"
 * Example #5: And we should not be on the profile of "organizer"
 */
Then(/^(I |we )*should( not)* be on the profile of "([^"]*)"$/, async function (pronounCase, notCase, who) {
  const member = h.memberOf(this, who);
  const read = async () => {
    const header = h.clean(await this.page.locator('#item-header').first().innerText({ timeout: 1000 }).catch(() => ''));
    const heading = h.clean(await this.page.locator('#item-header h1, #item-header h2, main h1').first().innerText({ timeout: 500 }).catch(() => ''));
    return { header, heading };
  };
  await h.eventually(this, read, ({ header, heading }) => {
    const is = h.same(heading, member.name) || (member.username && h.holds(header, `@${member.username}`) && h.holds(header, member.name));
    return Boolean(is) !== Boolean(notCase);
  }, async (v) => ({
    message: notCase ? `The page is the profile of "${member.name}".` : `The page is not the profile of "${member.name}": ${await h.pageSummary(this)}.`,
    hint: 'Open it: When I go to the profile of "member".',
  }));
});

/**
 * Open a tab of the member's or the group's page that is open ("Activity", "Profile", "Friends", "Groups", "Messages",
 * "Notifications", "Settings"; "Home", "Members", "Manage" of a group), its count aside.
 *
 * Example #1: When I open the "Friends" tab
 * Example #2: And I open the "Profile" tab
 * Example #3: When we open the "Members" tab
 * Example #4: And I open the "Manage" tab
 * Example #5: When I open the "Notifications" tab
 */
When(/^(I |we )*open the "([^"]*)" tab$/, async function (pronounCase, label) {
  const links = this.page.locator('nav#object-nav li a, #object-nav li a');
  const texts = (await links.allInnerTexts().catch(() => [])).map(h.tabLabel);
  const index = texts.findIndex((t) => h.same(t, label));
  if (index < 0) throw friendly({ message: `The page has no tab "${label}". Its tabs are ${h.listed(texts)}: ${await h.pageSummary(this)}.`, hint: 'Open a member\'s profile or a group first; a tab shows for whom it is meant (Messages, Settings: the account itself).' });
  await h.clickAndLoad(this, links.nth(index), `open the tab "${label}"`);
});

/**
 * Open an entry of the menu of the tab that is open ("Requests" of Friends, "Edit" of Profile, "Compose" of
 * Messages, "Read" of Notifications), its count aside.
 *
 * Example #1: When I open "Requests" in the tab's menu
 * Example #2: And I open "Edit" in the tab's menu
 * Example #3: When we open "Compose" in the tab's menu
 * Example #4: And I open "Read" in the tab's menu
 * Example #5: When I open "Sent" in the tab's menu
 */
When(/^(I |we )*open "([^"]*)" in the tab's menu$/, async function (pronounCase, label) {
  const links = this.page.locator('nav#subnav li a, #subnav li a');
  const texts = (await links.allInnerTexts().catch(() => [])).map(h.tabLabel);
  const index = texts.findIndex((t) => h.same(t, label));
  if (index < 0) throw friendly({ message: `The tab's menu has no "${label}". It has ${h.listed(texts)}.`, hint: 'Open the tab first: When I open the "Friends" tab.' });
  await h.clickAndLoad(this, links.nth(index), `open "${label}"`);
});

/**
 * Assert the member's or the group's page offers (or does not offer) a tab, with a count when one is given ("Friends
 * 2", "Members 3").
 *
 * Example #1: Then the page should offer the "Friends" tab
 * Example #2: And the page should offer the "Friends" tab with 2
 * Example #3: Then the page should not offer the "Messages" tab
 * Example #4: And the page should offer the "Members" tab with 3
 * Example #5: Then the page should not offer the "Manage" tab
 */
Then(/^the page should( not)* offer the "([^"]*)" tab(?: with (\d+))?$/, async function (notCase, label, count) {
  const read = async () => (await this.page.locator('nav#object-nav li a, #object-nav li a').allInnerTexts().catch(() => [])).map(h.clean);
  await h.eventually(this, read, (tabs) => {
    const tab = tabs.find((t) => h.same(h.tabLabel(t), label));
    const ok = Boolean(tab) && (!h.supplied(count) || (tab.match(/(\d+)$/) || [])[1] === String(count));
    return ok !== Boolean(notCase);
  }, async (tabs) => ({
    message: notCase
      ? `The page offers the tab "${label}"${h.supplied(count) ? ` with ${count}` : ''}.`
      : `The page does not offer the tab "${label}"${h.supplied(count) ? ` with ${count}` : ''}. Its tabs are ${h.listed(tabs)}.`,
    hint: 'A count shows next to the label ("Friends 2"); the tabs of an account itself (Messages, Notifications, Settings) show only to it.',
  }));
});

/**
 * Assert the header of the member's or the group's page offers (or does not offer) a button ("Add Friend", "Cancel
 * Friendship", "Private Message", "Join Group", "Leave Group", "Request Membership", "Request Sent").
 *
 * Example #1: Then the page should offer the button "Add Friend"
 * Example #2: And the page should offer the button "Private Message"
 * Example #3: Then the page should not offer the button "Add Friend"
 * Example #4: And the page should offer the button "Leave Group"
 * Example #5: Then the page should offer the button "Request Sent"
 */
Then(/^the page should( not)* offer the button "([^"]*)"$/, async function (notCase, label) {
  const read = async () => (await this.page.locator('#item-header a, #item-header button').filter({ visible: true }).allInnerTexts().catch(() => [])).map(h.clean).filter(Boolean);
  await h.eventually(this, read, (labels) => labels.some((l) => h.same(l, label)) !== Boolean(notCase), async (labels) => ({
    message: notCase ? `The page offers the button "${label}".` : `The page does not offer the button "${label}". Its header offers ${h.listed(labels)}.`,
    hint: 'The buttons are in the header of a member\'s profile or of a group, for an account logged in.',
  }));
});

/**
 * Assert the profile shows (or does not show) a field with its value, as its "View" page lists it ("Location"
 * "Nairobi"); a field the member left empty, or that the person looking may not see, is not shown.
 *
 * Example #1: Then the profile should show "Location" as "Nairobi"
 * Example #2: And the profile should show "Skills" as "Design"
 * Example #3: Then the profile should not show "Location" as "Lisbon"
 * Example #4: And the profile should show "About me" as "Designer and writer, here for the club."
 * Example #5: Then the profile should show "Name" as "Member Test"
 */
Then(/^the profile should( not)* show "([^"]*)" as "([^"]*)"$/, async function (notCase, field, value) {
  const rows = await profileRows(this);
  const row = rows.find((r) => h.same(r.label, field));
  const shows = Boolean(row) && (h.same(row.value, value) || h.holds(row.value, value));
  if (shows === Boolean(notCase)) {
    throw friendly({
      message: notCase
        ? `The profile shows "${field}" as "${row.value}".`
        : (row ? `The profile shows "${field}" as "${row.value}", not "${value}".` : `The profile shows no "${field}". It shows ${h.listed(rows.map((r) => r.label))}.`),
      hint: 'Open the "Profile" tab of a member first; a field shows to whom its visibility lets it.',
    });
  }
});

/**
 * Assert the profile shows (or does not show) a field at all.
 *
 * Example #1: Then the profile should show the field "Location"
 * Example #2: And the profile should not show the field "Location"
 * Example #3: Then the profile should show the field "Skills"
 * Example #4: And the profile should not show the field "Website"
 * Example #5: Then the profile should show the field "About me"
 */
Then(/^the profile should( not)* show the field "([^"]*)"$/, async function (notCase, field) {
  const rows = await profileRows(this);
  if (rows.some((r) => h.same(r.label, field)) === Boolean(notCase)) {
    throw friendly({
      message: notCase ? `The profile shows the field "${field}".` : `The profile shows no field "${field}". It shows ${h.listed(rows.map((r) => r.label))}.`,
      hint: 'A field the member left empty is not shown, nor one its visibility keeps from the person looking.',
    });
  }
});

/** The fields of the profile's "View" page that is open: label and value of each row. */
async function profileRows(world) {
  if (!(await world.page.locator('#item-body .profile, #item-body .bp-widget').count())) {
    const tab = world.page.locator('nav#object-nav li a').filter({ hasText: /^\s*Profile\s*$/ }).first();
    if (await tab.count()) await h.clickAndLoad(world, tab, 'open the profile');
  }
  await world.page.locator('#item-body .bp-widget').first().waitFor({ state: 'attached', timeout: h.budget(world) }).catch(() => {});
  return world.page.locator('#item-body .bp-widget tr').evaluateAll((trs) => trs.map((tr) => ({
    label: (tr.querySelector('td.label, th') || {}).innerText || '',
    value: (tr.querySelector('td.data') || {}).innerText || '',
  }))).catch(() => []).then((rows) => rows.map((r) => ({ label: h.clean(r.label), value: h.clean(r.value) })));
}

module.exports = { openDirectory, memberRows, profileRows };
