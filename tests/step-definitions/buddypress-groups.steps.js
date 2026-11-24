'use strict';

// Groups: the groups directory (its list, a row's button, its order and search), a group's page (its status, its
// text, its members), joining and leaving, a private group's membership request and its answer in the group's
// management, a member's role in the group, and a group made with the creation steps and deleted. A membership, a
// request and a role a scenario changes come back when it ends; a group it makes goes.

const { Given, When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const h = require('./buddypress-helpers');

const GROUPS = '#groups-list';

/** The address of a group from its name: the slug the community makes of it. */
function groupPath(world, name, tab) {
  const slug = h.clean(name).toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return `${h.communityPath(world, 'groups')}${slug}/${tab ? String(tab).replace(/^\/+|\/+$/g, '') + '/' : ''}`;
}

/** Open a group's page (or one of its tabs), and say what the site answered. */
async function openGroup(world, name, tab) {
  const status = await h.visit(world, groupPath(world, name, tab));
  if (status === 404) {
    throw friendly({ message: `The site has no group "${name}" for this account (404 at ${world.page.url()}).`, hint: 'A hidden group answers "not found" to whoever is not in it.' });
  }
}

/** The rows of the groups list on the page. */
async function groupRows(world) {
  return world.page.locator(`${GROUPS} > li`).evaluateAll((rows) => rows.map((li) => ({
    name: (li.querySelector('.list-title, .item-title') || {}).innerText || '',
    meta: (li.querySelector('.item-meta') || {}).innerText || '',
    buttons: [...li.querySelectorAll('.group-button')].filter((b) => b.tagName === 'BUTTON' || b.tagName === 'A').map((b) => (b.innerText || '').trim()),
  }))).catch(() => []).then((rows) => rows.map((r) => ({ name: h.clean(r.name), meta: h.clean(r.meta), buttons: r.buttons.map(h.clean).filter(Boolean) })));
}

/** The button of the group's header ("Join Group", "Leave Group", "Request Membership", "Request Sent"). */
async function headerButton(world) {
  const button = world.page.locator('#item-header .group-button').filter({ visible: true }).filter({ hasText: /\S/ }).last();
  return { button, label: h.clean(await button.innerText({ timeout: 1000 }).catch(() => '')) };
}

/** Whether an account is a member of a group: its "My Groups" list. */
async function isMember(world, handle, name) {
  return h.asAccount(world, handle, async () => {
    await h.visit(world, h.profilePath(world, handle, 'groups'));
    await h.waitForList(world, GROUPS);
    return (await groupRows(world)).some((r) => h.same(r.name, name));
  });
}

/** Take an account out of a group (it leaves; an organizer cannot, so the management removes it) and drop its request. */
async function takeOut(world, handle, name) {
  await h.asAccount(world, handle, async () => {
    await openGroup(world, name).catch(() => {});
    const { button, label } = await headerButton(world);
    if (/^Leave Group$/i.test(label)) {
      await button.click();
      await h.eventually(world, async () => (await headerButton(world)).label, (l) => !/^Leave Group$/i.test(l), async (l) => ({ message: `"${handle}" could not leave "${name}": the button reads "${l}".`, hint: 'An organizer of a group cannot leave it while it has no other organizer.' }));
    }
  });
  // A membership request waits for an answer: the group's administrators reject it.
  await answerRequest(world, name, handle, 'reject', true);
}

/** Answer a membership request in the group's management, as its organizer (the users registry's "organizer"), quietly. */
async function answerRequest(world, name, who, action, quiet) {
  const organizer = (world.parameters.users || {}).organizer ? 'organizer' : h.manager(world);
  await h.asAccount(world, organizer, async () => {
    await openGroup(world, name, 'admin/membership-requests');
    const row = world.page.locator('#request-list > li').filter({ hasText: h.nameOf(world, who) }).first();
    if (!(await row.count())) {
      if (quiet) return;
      throw friendly({ message: `The group "${name}" has no membership request of "${h.nameOf(world, who)}".`, hint: 'A request shows in the group\'s "Manage" tab, "Requests", to its organizers.' });
    }
    const label = action === 'accept' ? 'Accept' : 'Reject';
    await h.clickAndLoad(world, row.getByRole('link', { name: label }).or(row.getByRole('button', { name: label })).first(), `${action} the request`);
  });
}

/** Bring an account's place in a group back as it was when the scenario began, once it ends. */
async function restoreMembership(world, handle, name) {
  if (!world.communityGroupsRestored) world.communityGroupsRestored = new Set();
  const key = `${handle}|${name}`;
  if (world.communityGroupsRestored.has(key)) return;
  world.communityGroupsRestored.add(key);
  const before = await isMember(world, handle, name);
  h.afterScenario(world, async () => {
    const now = await isMember(world, handle, name);
    if (now && !before) await takeOut(world, handle, name);
    else if (!now && before) await bringIn(world, handle, name);
    else if (!now) await answerRequest(world, name, handle, 'reject', true);
  });
}

/** Put an account in a group: it joins a public one, or asks and the organizer accepts. */
async function bringIn(world, handle, name) {
  let asked = false;
  await h.asAccount(world, handle, async () => {
    await openGroup(world, name);
    const { button, label } = await headerButton(world);
    if (/^Join Group$/i.test(label)) {
      await button.click();
      await h.eventually(world, async () => (await headerButton(world)).label, (l) => /^Leave Group$/i.test(l), async (l) => ({ message: `"${handle}" could not join "${name}": the button reads "${l}".`, hint: 'A public group is joined with "Join Group"; a private one asks with "Request Membership".' }));
    } else if (/^Request Membership$/i.test(label)) {
      await button.click();
      await world.page.waitForTimeout(1500);
      asked = true;
    } else if (/^Request Sent$/i.test(label)) {
      asked = true;
    }
  });
  if (asked) await answerRequest(world, name, handle, 'accept', false);
}

/**
 * Open the groups directory ("/groups/"; `worldParameters.community.groups` names another address) and wait for its
 * list.
 *
 * Example #1: Given I am on the groups directory
 * Example #2: When I go to the groups directory
 * Example #3: Given we are on the groups directory
 * Example #4: And I go to the groups directory
 * Example #5: When we go to the groups directory
 */
Given(/^(?:(?:I am |we are )+on|(?:I |we )*go to) the groups directory$/, async function () {
  await h.visit(this, h.communityPath(this, 'groups'));
  await h.waitForList(this, GROUPS);
});

/**
 * Assert the groups list on the page (the directory, or a member's "Groups" tab) shows (or does not show) a group, and,
 * when given, what its row says ("Private Group / 2 members").
 *
 * Example #1: Then the groups list should show "Webship Club"
 * Example #2: And the groups list should show "Design Circle" with "Private Group / 2 members"
 * Example #3: Then the groups list should not show "Core Team"
 * Example #4: And the groups list should show "Webship Club" with "Public Group"
 * Example #5: Then the groups list should not show "Webship test group"
 */
Then(/^the groups list should( not)* show "([^"]*)"(?: with "([^"]*)")?$/, async function (notCase, name, meta) {
  await h.waitForList(this, GROUPS);
  await h.eventually(this, () => groupRows(this), (rows) => rows.some((r) => h.same(r.name, name) && (!h.supplied(meta) || h.holds(r.meta, meta))) !== Boolean(notCase), async (rows) => ({
    message: notCase ? `The groups list shows "${name}".` : `The groups list shows no "${name}"${h.supplied(meta) ? ` with "${meta}"` : ''}. It shows ${h.listed((rows || []).map((r) => `${r.name} (${r.meta})`))}.`,
    hint: 'A hidden group shows only to its members; a row says "Public Group / 3 members".',
  }));
});

/**
 * Assert the row of a group in the groups list offers (or does not offer) a button ("Join Group", "Leave Group",
 * "Request Membership", "Request Sent").
 *
 * Example #1: Then the row of the group "Webship Club" should offer "Join Group"
 * Example #2: And the row of the group "Design Circle" should offer "Request Membership"
 * Example #3: Then the row of the group "Webship Club" should not offer "Join Group"
 * Example #4: And the row of the group "Webship Club" should offer "Leave Group"
 * Example #5: Then the row of the group "Design Circle" should not offer "Join Group"
 */
Then(/^the row of the group "([^"]*)" should( not)* offer "([^"]*)"$/, async function (name, notCase, label) {
  await h.waitForList(this, GROUPS);
  await h.eventually(this, () => groupRows(this), (rows) => {
    const row = rows.find((r) => h.same(r.name, name));
    return Boolean(row) && row.buttons.some((b) => h.same(b, label)) !== Boolean(notCase);
  }, async (rows) => {
    const row = (rows || []).find((r) => h.same(r.name, name));
    return { message: !row ? `The groups list shows no "${name}". It shows ${h.listed((rows || []).map((r) => r.name))}.` : `The row of "${name}" ${notCase ? 'offers' : 'does not offer'} "${label}". It offers ${h.listed(row.buttons)}.`, hint: 'A visitor sees no button.' };
  });
});

/**
 * Search the groups directory ("Search Groups…" and the Enter key), and wait for the list it fills again.
 *
 * Example #1: When I search the groups for "Club"
 * Example #2: And we search the groups for "Circle"
 * Example #3: When I search the groups for "Nothing like this"
 * Example #4: Then I search the groups for "Design"
 * Example #5: When we search the groups for "Webship"
 */
When(/^(I |we )*search the groups for "([^"]*)"$/, async function (pronounCase, words) {
  const box = this.page.getByRole('searchbox', { name: /Search Groups/ }).first();
  if (!(await box.count())) throw friendly({ message: `The page has no search of groups: ${await h.pageSummary(this)}.`, hint: 'Open the groups directory first.' });
  await box.fill(words);
  const answer = this.page.waitForResponse((r) => /admin-ajax\.php/.test(r.url()), { timeout: h.budget(this) * 4 }).catch(() => null);
  await box.press('Enter');
  await answer;
  await h.waitForList(this, GROUPS);
});

/**
 * Open a group's page by its name ("/groups/<slug>/"), or one of its tabs' addresses ("members", "admin").
 *
 * Example #1: When I go to the group "Webship Club"
 * Example #2: Given I am on the group "Design Circle"
 * Example #3: And we go to the group "Webship Club"
 * Example #4: When I go to the group "Core Team"
 * Example #5: Given we are on the group "Design Circle"
 */
Given(/^(?:(?:I am |we are )+on|(?:I |we )*go to) the group "([^"]*)"$/, async function (name) {
  await openGroup(this, name);
});

/**
 * Assert the site has no page for a group to this account ("not found"): a hidden group to whoever is not in it.
 *
 * Example #1: Then the group "Core Team" should not be found
 * Example #2: And the group "Webship test group" should not be found
 * Example #3: Then the group "Core Team" should not be found
 * Example #4: And the group "Nothing like this" should not be found
 * Example #5: Then the group "Core Team" should not be found
 */
Then(/^the group "([^"]*)" should not be found$/, async function (name) {
  const status = await h.visit(this, groupPath(this, name));
  if (status !== 404) throw friendly({ message: `The group "${name}" answered ${status} (${this.page.url()}), not "not found".`, hint: 'A hidden group shows to its members and to the administrator.' });
});

/**
 * Assert the group's page shows a text in its header or its body ("Private Group", "This is a private group and you
 * must request group membership in order to join.", "Your membership request is awaiting approval …").
 *
 * Example #1: Then the group page should say "Private Group"
 * Example #2: And the group page should say "This is a private group and you must request group membership in order to join."
 * Example #3: Then the group page should say "Your membership request is awaiting approval from the group administrator."
 * Example #4: And the group page should say "Public Group"
 * Example #5: Then the group page should say "You successfully left the group."
 */
Then(/^the group page should say "([^"]*)"$/, async function (words) {
  const read = async () => h.clean(await this.page.locator('#item-header, #item-body, #buddypress .bp-feedback').allInnerTexts().then((t) => t.join(' ')).catch(() => ''));
  await h.eventually(this, read, (text) => h.holds(text, words), async () => ({ message: `The group page does not say "${words}": ${await h.pageSummary(this)}.`, hint: 'Open the group first: When I go to the group "Webship Club".' }));
});

/**
 * Press the button of the group's header ("Join Group", "Leave Group", "Request Membership") and wait for its new
 * state. The account's place in the group comes back as it was when the scenario ends.
 *
 * Example #1: When I press "Join Group" on the group page
 * Example #2: And I press "Leave Group" on the group page
 * Example #3: When we press "Request Membership" on the group page
 * Example #4: And I press "Join Group" on the group page
 * Example #5: When I press "Leave Group" on the group page
 */
When(/^(I |we )*press "(Join Group|Leave Group|Request Membership)" on the group page$/, async function (pronounCase, label) {
  const { button, label: now } = await headerButton(this);
  if (!h.same(now, label)) throw friendly({ message: `The group's button reads "${now || '(none)'}", not "${label}": ${await h.pageSummary(this)}.`, hint: 'Log in and open a group: When I go to the group "Webship Club".' });
  const name = h.clean(await this.page.locator('#item-header h1, #item-header .group-title, main h1').first().innerText({ timeout: 1000 }).catch(() => ''));
  await restoreMembership(this, await h.me(this), name);
  await button.click();
  await h.eventually(this, async () => (await headerButton(this)).label, (l) => l && !h.same(l, label), async (l) => ({ message: `The group's button still reads "${l}".`, hint: 'The site answers it by script; a slow site takes a moment.' }));
});

/**
 * Make an account a member of a group (it joins, or asks and the group's organizer accepts) or not a member (it
 * leaves, or its request is rejected), in the browser; its place comes back as it was when the scenario ends.
 *
 * Example #1: Given "newcomer" is not a member of the group "Webship Club"
 * Example #2: Given "newcomer" is a member of the group "Webship Club"
 * Example #3: And "newcomer" is not a member of the group "Design Circle"
 * Example #4: Given "member" is a member of the group "Design Circle"
 * Example #5: And "moderator" is not a member of the group "Design Circle"
 */
Given(/^"([^"]*)" is( not)* a member of the group "([^"]*)"$/, async function (handle, notCase, name) {
  await restoreMembership(this, handle, name);
  const now = await isMember(this, handle, name);
  if (notCase && now) await takeOut(this, handle, name);
  else if (notCase) await answerRequest(this, name, handle, 'reject', true);
  else if (!now) await bringIn(this, handle, name);
});

/**
 * Assert the members of a group (its "Members" tab) list (or do not list) an account.
 *
 * Example #1: Then the members of the group "Webship Club" should list "member"
 * Example #2: And the members of the group "Webship Club" should not list "newcomer"
 * Example #3: Then the members of the group "Design Circle" should list "Organizer Test"
 * Example #4: And the members of the group "Webship Club" should list "newcomer"
 * Example #5: Then the members of the group "Design Circle" should not list "newcomer"
 */
Then(/^the members of the group "([^"]*)" should( not)* list "([^"]*)"$/, async function (name, notCase, who) {
  await openGroup(this, name, 'members');
  await h.waitForList(this, '#members-list');
  const wanted = h.nameOf(this, who);
  const read = async () => (await this.page.locator('#members-list > li .list-title, #group-members-list > li .list-title').allInnerTexts().catch(() => [])).map(h.clean);
  await h.eventually(this, read, (names) => names.some((n) => h.same(n, wanted)) !== Boolean(notCase), async (names) => ({
    message: notCase ? `The members of "${name}" list "${wanted}".` : `The members of "${name}" do not list "${wanted}". They list ${h.listed(names)}.`,
    hint: 'The members of a private group show to its members only.',
  }));
});

/**
 * Assert the membership requests of a group (its management, "Requests", for its organizer) list (or do not list) an
 * account.
 *
 * Example #1: Then the membership requests of the group "Design Circle" should list "newcomer"
 * Example #2: And the membership requests of the group "Design Circle" should not list "newcomer"
 * Example #3: Then the membership requests of the group "Design Circle" should list "Newcomer Test"
 * Example #4: And the membership requests of the group "Design Circle" should not list "moderator"
 * Example #5: Then the membership requests of the group "Design Circle" should list "moderator"
 */
Then(/^the membership requests of the group "([^"]*)" should( not)* list "([^"]*)"$/, async function (name, notCase, who) {
  await openGroup(this, name, 'admin/membership-requests');
  const wanted = h.nameOf(this, who);
  const read = async () => (await this.page.locator('#request-list > li .list-title, #request-list > li .item-title').allInnerTexts().catch(() => [])).map(h.clean);
  const names = await read();
  if (names.some((n) => h.same(n, wanted)) === Boolean(notCase)) {
    throw friendly({
      message: notCase ? `The membership requests of "${name}" list "${wanted}".` : `The membership requests of "${name}" do not list "${wanted}". They list ${h.listed(names)} (the page says ${h.listed(await h.feedback(this))}).`,
      hint: 'The requests show to the group\'s organizers, in its "Manage" tab.',
    });
  }
});

/**
 * Accept or reject a membership request in the group's management ("Requests"), as its organizer logged in, and check
 * the site's answer. The account's place in the group comes back as it was when the scenario ends.
 *
 * Example #1: When I accept the membership request of "newcomer" to the group "Design Circle"
 * Example #2: And I reject the membership request of "newcomer" to the group "Design Circle"
 * Example #3: When we accept the membership request of "Newcomer Test" to the group "Design Circle"
 * Example #4: And I reject the membership request of "moderator" to the group "Design Circle"
 * Example #5: When I accept the membership request of "moderator" to the group "Design Circle"
 */
When(/^(I |we )*(accept|reject) the membership request of "([^"]*)" to the group "([^"]*)"$/, async function (pronounCase, action, who, name) {
  const handle = h.memberOf(this, who).handle;
  if (handle) await restoreMembership(this, handle, name);
  await openGroup(this, name, 'admin/membership-requests');
  const row = this.page.locator('#request-list > li').filter({ hasText: h.nameOf(this, who) }).first();
  if (!(await row.count())) throw friendly({ message: `The group "${name}" has no membership request of "${h.nameOf(this, who)}".`, hint: 'The requests show to the group\'s organizers.' });
  const label = action === 'accept' ? 'Accept' : 'Reject';
  await h.clickAndLoad(this, row.getByRole('link', { name: label }).or(row.getByRole('button', { name: label })).first(), `${action} the request`);
  const wanted = action === 'accept' ? /accepted/i : /rejected/i;
  const said = await h.feedback(this);
  if (!said.some((s) => wanted.test(s))) throw friendly({ message: `The request was not ${action}ed: the page says ${h.listed(said)}.`, hint: 'The page says "Group membership request accepted" or "Group membership request rejected" once the site answered.' });
});

/**
 * Assert the role of an account in a group, as the group's management lists it ("Administrator", "Moderator",
 * "Member", "Banned"), for the group's organizer logged in.
 *
 * Example #1: Then the role of "moderator" in the group "Webship Club" should be "Moderator"
 * Example #2: And the role of "organizer" in the group "Webship Club" should be "Administrator"
 * Example #3: Then the role of "member" in the group "Webship Club" should be "Member"
 * Example #4: And the role of "member" in the group "Design Circle" should be "Member"
 * Example #5: Then the role of "member" in the group "Webship Club" should be "Moderator"
 */
Then(/^the role of "([^"]*)" in the group "([^"]*)" should be "([^"]*)"$/, async function (who, name, role) {
  const roles = await groupRoles(this, name);
  const wanted = h.nameOf(this, who);
  const row = roles.find((r) => h.same(r.name, wanted));
  if (!row || !h.same(row.role, role)) {
    throw friendly({ message: row ? `The role of "${wanted}" in "${name}" is "${row.role}", not "${role}".` : `The management of "${name}" lists no "${wanted}". It lists ${h.listed(roles.map((r) => `${r.name} (${r.role})`))}.`, hint: 'The roles show in the group\'s "Manage" tab, "Members", to its organizers.' });
  }
});

/** The members of a group and their roles, as its management lists them. */
async function groupRoles(world, name) {
  await openGroup(world, name, 'admin/manage-members');
  const rows = world.page.locator('#item-body table tbody tr, #item-body tr').filter({ has: world.page.locator('.group-member, td.uname-column') });
  await rows.first().waitFor({ state: 'attached', timeout: h.budget(world) * 3 }).catch(() => {});
  return rows.evaluateAll((trs) => trs.map((tr) => ({
    name: ((tr.querySelector('.group-member a') || {}).innerText || ''),
    role: ((tr.querySelector('td.urole-column') || {}).innerText || ''),
  }))).catch(() => []).then((list) => list.map((r) => ({ name: h.clean(r.name), role: h.clean(r.role) })));
}

/**
 * Change the role of an account in a group, in its management ("Edit", then the role), as its organizer logged in;
 * the role comes back as it was when the scenario ends.
 *
 * Example #1: When I change the role of "member" in the group "Webship Club" to "Moderator"
 * Example #2: And I change the role of "moderator" in the group "Webship Club" to "Member"
 * Example #3: When we change the role of "member" in the group "Design Circle" to "Moderator"
 * Example #4: And I change the role of "member" in the group "Webship Club" to "Member"
 * Example #5: When I change the role of "moderator" in the group "Webship Club" to "Administrator"
 */
When(/^(I |we )*change the role of "([^"]*)" in the group "([^"]*)" to "(Administrator|Moderator|Member)"$/, async function (pronounCase, who, name, role) {
  const wanted = h.nameOf(this, who);
  const before = (await groupRoles(this, name)).find((r) => h.same(r.name, wanted));
  if (!before) throw friendly({ message: `The management of "${name}" lists no "${wanted}".`, hint: 'Only a member of the group has a role in it.' });
  const organizer = await h.me(this);
  await setRole(this, name, wanted, role);
  if (!h.same(before.role, role) && /^(Administrator|Moderator|Member)$/.test(before.role)) {
    h.afterScenario(this, () => h.asAccount(this, organizer, async () => {
      await groupRoles(this, name);
      await setRole(this, name, wanted, before.role);
    }));
  }
});

/** Edit a member's row in the group's management and choose a role; the page saves it by itself. */
async function setRole(world, name, who, role) {
  const row = world.page.locator('#item-body tr').filter({ has: world.page.locator('.group-member a').filter({ hasText: h.exactly(who) }) }).first();
  await row.getByRole('link', { name: 'Edit' }).click();
  const select = row.locator('select').first();
  await select.waitFor({ state: 'visible', timeout: h.budget(world) * 2 });
  await select.selectOption({ label: role });
  await h.eventually(world, async () => h.clean(await row.locator('td.urole-column').innerText().catch(() => '')), (now) => h.same(now, role), async (now) => ({ message: `The role of "${who}" reads "${now}" after the change to "${role}".`, hint: 'The management saves a role by itself; a reload shows the role the site kept.' }), h.budget(world) * 4);
}

// ---------------------------------------------------------------------------
// A group made and deleted
// ---------------------------------------------------------------------------

/**
 * Make a group with the creation steps, as the account logged in: its name and description, its privacy ("public",
 * "private", "hidden"), then "Next Step" to "Finish". It is deleted when the scenario ends.
 *
 * Example #1: When I create the public group "Webship test group" described as "A group made by a test run."
 * Example #2: And I create the private group "Webship test circle" described as "A private group of a test run."
 * Example #3: When we create the hidden group "Webship test team" described as "A hidden group of a test run."
 * Example #4: And I create the public group "Webship test club" described as "Made by a test."
 * Example #5: When I create the private group "Webship test group" described as "A group made by a test run."
 */
When(/^(I |we )*create the (public|private|hidden) group "([^"]*)" described as "([^"]*)"$/, async function (pronounCase, privacy, name, description) {
  const page = this.page;
  await h.visit(this, `${h.communityPath(this, 'groups')}create/`);
  const nameField = page.getByLabel('Group Name (required)');
  if (!(await nameField.count())) throw friendly({ message: `The site does not offer to create a group: ${await h.pageSummary(this)}.`, hint: 'Log in first; the administration may keep the creation of groups to administrators.' });
  await nameField.fill(name);
  await page.getByLabel('Group Description (required)').fill(description);
  await h.clickAndLoad(this, page.locator('#group-creation-create'), 'create the group');
  const owner = await h.me(this);
  h.afterScenario(this, () => deleteGroup(this, owner, name, true));
  const said = await h.feedback(this);
  if (await page.locator('#group-name').count()) throw friendly({ message: `The group "${name}" was not created: the page says ${h.listed(said)}.`, hint: 'A name that a group has already is refused.' });
  await page.getByLabel(`This is a ${privacy} group`).check();
  for (let step = 0; step < 6; step += 1) {
    if (await page.locator('#group-creation-finish').count()) {
      await h.clickAndLoad(this, page.locator('#group-creation-finish'), 'finish the group');
      return;
    }
    await h.clickAndLoad(this, page.locator('#group-creation-next'), 'go to the next step');
  }
  throw friendly({ message: `The creation of "${name}" did not reach its last step: ${await h.pageSummary(this)}.`, hint: 'The creation steps are Details, Settings, Photo, Cover Image and Invite, each with "Next Step", the last with "Finish".' });
});

/** Delete a group in its management, as an account (its organizer), when it is there. */
async function deleteGroup(world, handle, name, quiet) {
  await h.asAccount(world, handle, async () => {
    const status = await h.visit(world, groupPath(world, name, 'admin/delete-group'));
    const box = world.page.getByLabel(/I understand the consequences of deleting this group/);
    if (status === 404 || !(await box.count())) {
      if (quiet) return;
      throw friendly({ message: `"${handle}" may not delete the group "${name}" (${status} at ${world.page.url()}).`, hint: 'A group is deleted by its organizers.' });
    }
    await box.check();
    await h.clickAndLoad(world, world.page.locator('#delete-group-button'), 'delete the group');
  });
}

/**
 * Delete a group in its management ("Delete": "I understand the consequences of deleting this group.", "Delete
 * Group"), as the account logged in (an organizer of the group), and check the site's answer.
 *
 * Example #1: When I delete the group "Webship test group"
 * Example #2: And we delete the group "Webship test circle"
 * Example #3: When I delete the group "Webship test team"
 * Example #4: And I delete the group "Webship test club"
 * Example #5: When I delete the group "Webship test group"
 */
When(/^(I |we )*delete the group "([^"]*)"$/, async function (pronounCase, name) {
  const status = await h.visit(this, groupPath(this, name, 'admin/delete-group'));
  const box = this.page.getByLabel(/I understand the consequences of deleting this group/);
  if (status === 404 || !(await box.count())) throw friendly({ message: `The site does not offer to delete the group "${name}" to this account: ${await h.pageSummary(this)}.`, hint: 'A group is deleted by its organizers.' });
  await box.check();
  await h.clickAndLoad(this, this.page.locator('#delete-group-button'), 'delete the group');
  const said = await h.feedback(this);
  if (!said.some((s) => /deleted successfully/i.test(s))) throw friendly({ message: `The group "${name}" was not deleted: the page says ${h.listed(said)}.`, hint: 'The deletion asks for "I understand the consequences of deleting this group." first.' });
});

/**
 * Remove a group of an earlier run that was stopped half way, by its name, as the account that removes test content
 * (`worldParameters.community.manager`) in the administration's groups list.
 *
 * Example #1: Given there is no group "Webship test group"
 * Example #2: Given there is no group "Webship test circle"
 * Example #3: And there is no group "Webship test team"
 * Example #4: Given there is no group "Webship test club"
 * Example #5: And there is no group "Webship test group"
 */
Given(/^there is no group "([^"]*)"$/, async function (name) {
  await h.asAccount(this, h.manager(this), async () => {
    for (let round = 0; round < 5; round += 1) {
      await h.visitAdmin(this, `/wp-admin/admin.php?page=bp-groups&s=${encodeURIComponent(name)}`);
      const row = this.page.locator('table.wp-list-table tbody tr').filter({ has: this.page.locator('strong a, .row-title').filter({ hasText: h.exactly(name) }) }).first();
      if (!(await row.count())) return;
      const del = row.locator('.row-actions .delete a').first();
      await h.clickAndLoad(this, del, 'open the deletion of the group');
      const confirm = this.page.locator('#bp-groups-delete-form [type=submit], input[type=submit][value*="Delete"], #submit').first();
      if (await confirm.count()) await h.clickAndLoad(this, confirm, 'delete the group');
    }
    throw friendly({ message: `The group "${name}" is still listed after five deletions.`, hint: 'The administration\'s groups list deletes a group with its "Delete" link and a confirmation.' });
  });
});

module.exports = { groupPath, openGroup, groupRows, isMember };
