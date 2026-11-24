'use strict';

// The activity stream: the site's (its directory), a member's and a group's. Its items, an update posted (on the
// profile or in a group), a comment, a favorite, a delete, the filter "Show:" and the tabs of the directory. An update
// or a comment a scenario posts goes when it ends, removed in the administration's activity list.

const { Given, When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const h = require('./buddypress-helpers');

const STREAM = '#activity-stream ul.activity-list';

/** The items of the stream on the page: id, header, text, the labels of their buttons, and their comments. */
async function items(world) {
  return world.page.locator(`${STREAM} > li.activity-item`).evaluateAll((lis) => lis.map((li) => ({
    id: li.getAttribute('data-bp-activity-id') || (li.id || '').replace(/^activity-/, ''),
    header: (li.querySelector('.activity-header') || {}).innerText || '',
    text: (li.querySelector('.activity-inner') || {}).innerText || '',
    buttons: [...li.querySelectorAll(':scope > .activity-content > .activity-meta a, :scope > .activity-content > .activity-meta button')].map((b) => (b.innerText || '').trim()),
    comments: [...li.querySelectorAll('.activity-comments li[id^=acomment-]')].map((c) => ({ id: c.id.replace(/^acomment-/, ''), header: (c.querySelector('.acomment-meta') || {}).innerText || '', text: (c.querySelector('.acomment-content') || {}).innerText || '' })),
  }))).catch(() => []).then((rows) => rows.map((r) => ({ ...r, header: h.clean(r.header), text: h.clean(r.text), buttons: r.buttons.map(h.clean) })));
}

/** The item of the stream whose text holds some words. */
async function itemWith(world, words) {
  const all = await items(world);
  return { item: all.find((i) => h.holds(i.text, words)), all };
}

async function requireStream(world) {
  await h.waitForList(world, STREAM);
  if (!(await world.page.locator('#activity-stream').count())) {
    throw friendly({ message: `The page shows no activity stream: ${await h.pageSummary(world)}.`, hint: 'Open one first: Given I am on the activity stream.' });
  }
}

/** The locator of an item of the stream by its id. */
function itemLocator(world, id) {
  return world.page.locator(`${STREAM} > li#activity-${id}`);
}

/**
 * Remove an item of the stream (an update with its comments, or a comment) once the scenario ends: the account that
 * removes test content (`worldParameters.community.manager`, the administrator) opens the item's own page
 * ("/activity/p/<id>/") and presses its "Delete".
 */
function removeLater(world, id, parent) {
  h.afterScenario(world, () => h.asAccount(world, h.manager(world), async () => {
    const status = await h.visit(world, `${h.communityPath(world, 'activity')}p/${parent || id}/`);
    if (status === 404) return;
    await h.waitForList(world, STREAM);
    const own = world.page.locator(`li#activity-${id} > .activity-content > .activity-meta a, li#activity-${id} > .activity-content > .activity-meta button`).filter({ hasText: /^\s*Delete\s*$/ }).first();
    const comment = world.page.locator(`li#acomment-${id} a.acomment-delete, li#acomment-${id} .acomment-options a`).filter({ hasText: /^\s*Delete\s*$/ }).first();
    const button = (await own.count()) ? own : comment;
    if (!(await button.count())) return;
    await h.clickConfirmed(world, button);
    await world.page.waitForTimeout(1500);
  }));
}

/**
 * Open the site's activity stream ("/activity/"; `worldParameters.community.activity` names another address) and
 * wait for its items.
 *
 * Example #1: Given I am on the activity stream
 * Example #2: When I go to the activity stream
 * Example #3: Given we are on the activity stream
 * Example #4: And I go to the activity stream
 * Example #5: When we go to the activity stream
 */
Given(/^(?:(?:I am |we are )+on|(?:I |we )*go to) the activity stream$/, async function () {
  await h.visit(this, h.communityPath(this, 'activity'));
  await requireStream(this);
});

/**
 * Assert the activity stream on the page shows (or does not show) an item whose text holds some words, and, when
 * given, whose header holds others ("Member Test posted an update", "joined the group Webship Club").
 *
 * Example #1: Then the activity stream should show "Welcome to the Webship Community!"
 * Example #2: And the activity stream should show "Club meeting on Thursday" by "Moderator Test posted an update in the group Webship Club"
 * Example #3: Then the activity stream should not show "Webship test update"
 * Example #4: And the activity stream should show "The new pattern library is out" by "Member Test posted an update"
 * Example #5: Then the activity stream should not show "Club meeting on Thursday"
 */
Then(/^the activity stream should( not)* show "([^"]*)"(?: by "([^"]*)")?$/, async function (notCase, words, header) {
  await requireStream(this);
  await h.eventually(this, () => items(this), (all) => all.some((i) => (h.holds(i.text, words) || h.holds(i.header, words)) && (!h.supplied(header) || h.holds(i.header, header))) !== Boolean(notCase), async (all) => ({
    message: notCase
      ? `The activity stream shows "${words}".`
      : `The activity stream shows no "${words}"${h.supplied(header) ? ` by "${header}"` : ''}. It shows ${h.listed((all || []).map((i) => `${i.header}: ${i.text}`.slice(0, 90)))}.`,
    hint: 'The stream shows its newest items first; "Show:" and the tabs keep some of them only.',
  }));
});

/**
 * Post an update from the form of the stream on the page ("What's new, …?"), on my profile or, when given, in a group
 * of mine ("Post in:"), and wait for it at the top of the stream. It goes when the scenario ends.
 *
 * Example #1: When I post the update "Webship test update one"
 * Example #2: And I post the update "Webship test update in the club" in the group "Webship Club"
 * Example #3: When we post the update "Webship test: hello from the newcomer"
 * Example #4: And I post the update "Webship test update two"
 * Example #5: When I post the update "Webship test: a meeting note" in the group "Webship Club"
 */
When(/^(I |we )*post the update "([^"]*)"(?: in the group "([^"]*)")?$/, async function (pronounCase, text, group) {
  const page = this.page;
  const box = page.locator('#whats-new');
  if (!(await box.count())) throw friendly({ message: `The page has no form for an update: ${await h.pageSummary(this)}.`, hint: 'Log in and open the activity stream, a profile of your own or a group of yours.' });
  await box.click();
  await box.fill(text);
  if (h.supplied(group)) {
    const where = page.locator('#whats-new-post-in');
    if (!(await where.count())) throw friendly({ message: 'The form offers no "Post in:" choice.', hint: 'A member of no group posts on the profile only.' });
    await where.selectOption('group');
    const search = page.locator('#whats-new-post-in-box input[type=search], #whats-new-post-in-box input[type=text], .bp-activity-object input').first();
    await search.waitFor({ state: 'visible', timeout: h.budget(this) * 2 });
    await search.pressSequentially(group.slice(0, 6), { delay: 60 });
    const choice = page.locator('.bp-activity-object, #whats-new-post-in-box li').filter({ hasText: h.exactly(group) }).first();
    await choice.waitFor({ state: 'visible', timeout: h.budget(this) * 3 });
    await choice.click();
  }
  const answer = page.waitForResponse((r) => /admin-ajax\.php/.test(r.url()) && /post_update/.test(r.request().postData() || ''), { timeout: h.budget(this) * 4 }).catch(() => null);
  await page.locator('#aw-whats-new-submit').click();
  await answer;
  const said = await h.feedback(this);
  const found = await h.eventually(this, () => itemWith(this, text), ({ item }) => Boolean(item) || said.length > 0, async ({ all }) => ({
    message: `The update "${text}" is not in the stream. It shows ${h.listed((all || []).map((i) => i.text.slice(0, 60)))}.`,
    hint: 'An empty update is refused ("Please enter some content to post.").',
  }), h.budget(this) * 3).catch((err) => { throw err; });
  if (found.item) removeLater(this, found.item.id);
});

/**
 * Send the form of the stream with nothing in it, to see it refused.
 *
 * Example #1: When I post an empty update
 * Example #2: And we post an empty update
 * Example #3: When I post an empty update
 * Example #4: Then I post an empty update
 * Example #5: And I post an empty update
 */
When(/^(I |we )*post an empty update$/, async function (pronounCase) {
  const box = this.page.locator('#whats-new');
  if (!(await box.count())) throw friendly({ message: `The page has no form for an update: ${await h.pageSummary(this)}.`, hint: 'Log in and open the activity stream.' });
  await box.click();
  await box.fill('');
  await this.page.locator('#aw-whats-new-submit').click();
});

/**
 * Assert the form of the stream says something ("Please enter some content to post.").
 *
 * Example #1: Then the update form should say "Please enter some content to post."
 * Example #2: And the update form should say "enter some content"
 * Example #3: Then the update form should say "Please enter some content to post."
 * Example #4: And the update form should say "content to post"
 * Example #5: Then the update form should say "Please enter some content"
 */
Then(/^the update form should say "([^"]*)"$/, async function (words) {
  const read = async () => (await this.page.locator('#whats-new-form .bp-feedback, #bp-nouveau-activity-form .bp-feedback, .activity-update-form .bp-feedback').allInnerTexts().catch(() => [])).map(h.clean);
  await h.eventually(this, read, (texts) => texts.some((t) => h.holds(t, words)), async (texts) => ({ message: `The update form does not say "${words}". It says ${h.listed(texts)}.`, hint: 'Send it first: When I post an empty update.' }));
});

/**
 * Write a comment on an item of the stream, by the words of its text ("Comment", the comment, "Post"), and wait for it
 * under the item. It goes when the scenario ends.
 *
 * Example #1: When I comment "Webship test comment" on the update "Welcome to the Webship Community!"
 * Example #2: And I comment "Webship test: nice!" on the update "The new pattern library is out"
 * Example #3: When we comment "Webship test comment two" on the update "Club meeting on Thursday"
 * Example #4: And I comment "Webship test reply" on the update "Welcome to the Webship Community!"
 * Example #5: When I comment "Webship test: see you there" on the update "Club meeting on Thursday"
 */
When(/^(I |we )*comment "([^"]*)" on the update "([^"]*)"$/, async function (pronounCase, comment, words) {
  await requireStream(this);
  const { item, all } = await itemWith(this, words);
  if (!item) throw friendly({ message: `The activity stream shows no "${words}". It shows ${h.listed(all.map((i) => i.text.slice(0, 60)))}.`, hint: 'Name the update by words of its text.' });
  const li = itemLocator(this, item.id);
  await li.locator(':scope > .activity-content > .activity-meta .acomment-reply').first().click();
  const field = li.locator('.ac-form textarea').first();
  await field.waitFor({ state: 'visible', timeout: h.budget(this) * 2 });
  await field.fill(comment);
  await li.locator('.ac-form input[name=ac_form_submit], .ac-form [type=submit]').first().click();
  const posted = await h.eventually(this, async () => (await items(this)).find((i) => i.id === item.id), (i) => Boolean(i) && i.comments.some((c) => h.holds(c.text, comment)), async () => ({ message: `The comment "${comment}" did not show under "${words}".`, hint: 'An empty comment is refused.' }));
  const added = posted.comments.find((c) => h.holds(c.text, comment));
  if (added) removeLater(this, added.id, item.id);
});

/**
 * Assert an item of the stream shows (or does not show) a comment, by words of each.
 *
 * Example #1: Then the update "Welcome to the Webship Community!" should show the comment "Hello everyone, glad to be here."
 * Example #2: And the update "Welcome to the Webship Community!" should show the comment "Webship test comment"
 * Example #3: Then the update "The new pattern library is out" should not show the comment "Webship test"
 * Example #4: And the update "Club meeting on Thursday" should show the comment "Webship test comment two"
 * Example #5: Then the update "Welcome to the Webship Community!" should not show the comment "Webship test comment"
 */
Then(/^the update "([^"]*)" should( not)* show the comment "([^"]*)"$/, async function (words, notCase, comment) {
  await requireStream(this);
  await h.eventually(this, () => itemWith(this, words), ({ item }) => Boolean(item) && item.comments.some((c) => h.holds(c.text, comment)) !== Boolean(notCase), async ({ item, all }) => ({
    message: !item ? `The activity stream shows no "${words}". It shows ${h.listed(all.map((i) => i.text.slice(0, 60)))}.`
      : notCase ? `The update "${words}" shows the comment "${comment}".` : `The update "${words}" does not show the comment "${comment}". Its comments: ${h.listed(item.comments.map((c) => c.text))}.`,
    hint: 'A comment shows under its update.',
  }));
});

/**
 * Press a button of an item of the stream ("Mark as Favorite", "Remove Favorite", "Delete"), by words of its text, and
 * wait for its outcome; "Delete" answers the question "Are you sure?" with yes. A favorite comes back as it was when
 * the scenario ends (a delete is the stream's own: only test content should be deleted).
 *
 * Example #1: When I press "Mark as Favorite" on the update "The new pattern library is out"
 * Example #2: And I press "Remove Favorite" on the update "Welcome to the Webship Community!"
 * Example #3: When I press "Delete" on the update "Webship test update one"
 * Example #4: And we press "Mark as Favorite" on the update "Club meeting on Thursday"
 * Example #5: When I press "Remove Favorite" on the update "The new pattern library is out"
 */
When(/^(I |we )*press "(Mark as Favorite|Remove Favorite|Delete)" on the update "([^"]*)"$/, async function (pronounCase, label, words) {
  await requireStream(this);
  const { item, all } = await itemWith(this, words);
  if (!item) throw friendly({ message: `The activity stream shows no "${words}". It shows ${h.listed(all.map((i) => i.text.slice(0, 60)))}.`, hint: 'Name the update by words of its text.' });
  if (!item.buttons.some((b) => h.same(b, label))) throw friendly({ message: `The update "${words}" offers no "${label}". It offers ${h.listed(item.buttons)}.`, hint: 'Delete is offered on one\'s own items, and on every item to the administrator.' });
  const li = itemLocator(this, item.id);
  const button = li.locator(':scope > .activity-content > .activity-meta a, :scope > .activity-content > .activity-meta button').filter({ hasText: h.exactly(label) }).first();
  if (label !== 'Delete') {
    const handle = await h.me(this);
    const back = label === 'Mark as Favorite' ? 'Remove Favorite' : 'Mark as Favorite';
    h.afterScenario(this, () => h.asAccount(this, handle, async () => {
      await h.visit(this, h.communityPath(this, 'activity'));
      await h.waitForList(this, STREAM);
      const again = itemLocator(this, item.id).locator(':scope > .activity-content > .activity-meta a, :scope > .activity-content > .activity-meta button').filter({ hasText: h.exactly(back) }).first();
      if (await again.count()) { await again.click(); await this.page.waitForTimeout(1500); }
    }));
  }
  await h.clickConfirmed(this, button);
  if (label === 'Delete') {
    await h.eventually(this, () => items(this), (now) => !now.some((i) => i.id === item.id), async () => ({ message: `The update "${words}" is still in the stream.`, hint: 'The stream answers a delete by script; a slow site takes a moment.' }));
  } else {
    const after = label === 'Mark as Favorite' ? 'Remove Favorite' : 'Mark as Favorite';
    // On the "My Favorites" tab an item no longer a favorite leaves the stream.
    const leaves = label === 'Remove Favorite' && /favorites/i.test(h.clean(await this.page.locator('nav[aria-label="Directory menu"] li.selected, #buddypress .activity-type-tabs li.selected').first().innerText({ timeout: 500 }).catch(() => '')));
    await h.eventually(this, async () => (await items(this)).find((i) => i.id === item.id) || null, (i) => (leaves && !i) || (Boolean(i) && i.buttons.some((b) => h.same(b, after))), async (i) => ({ message: `The update "${words}" does not offer "${after}" after "${label}": it offers ${h.listed(i ? i.buttons : [])}.`, hint: 'A favorite is answered by script: "Mark as Favorite" becomes "Remove Favorite".' }));
  }
});

/**
 * Assert an item of the stream offers (or does not offer) a button, by words of its text ("Comment 1", "Mark as
 * Favorite", "Remove Favorite", "Delete").
 *
 * Example #1: Then the update "Welcome to the Webship Community!" should offer "Remove Favorite"
 * Example #2: And the update "The new pattern library is out" should offer "Delete"
 * Example #3: Then the update "Club meeting on Thursday" should not offer "Delete"
 * Example #4: And the update "Welcome to the Webship Community!" should offer "Comment 1"
 * Example #5: Then the update "The new pattern library is out" should offer "Mark as Favorite"
 */
Then(/^the update "([^"]*)" should( not)* offer "([^"]*)"$/, async function (words, notCase, label) {
  await requireStream(this);
  await h.eventually(this, () => itemWith(this, words), ({ item }) => Boolean(item) && item.buttons.some((b) => h.same(b, label)) !== Boolean(notCase), async ({ item, all }) => ({
    message: !item ? `The activity stream shows no "${words}". It shows ${h.listed(all.map((i) => i.text.slice(0, 60)))}.`
      : `The update "${words}" ${notCase ? 'offers' : 'does not offer'} "${label}". It offers ${h.listed(item.buttons)}.`,
    hint: 'Its buttons are under its text; "Comment" carries the count of its comments.',
  }));
});

/**
 * Keep in the stream only the items of a kind (its "Show:" choice: "Updates", "Friendships", "Group Memberships", …,
 * "— Everything —"), and wait for the stream it fills again.
 *
 * Example #1: When I show only "Updates" in the activity stream
 * Example #2: And I show only "Group Memberships" in the activity stream
 * Example #3: When we show only "Friendships" in the activity stream
 * Example #4: And I show only "Everything" in the activity stream
 * Example #5: When I show only "New Groups" in the activity stream
 */
When(/^(I |we )*show only "([^"]*)" in the activity stream$/, async function (pronounCase, kind) {
  await requireStream(this);
  const select = this.page.locator('#activity-filter-by');
  const options = (await select.locator('option').allInnerTexts().catch(() => [])).map(h.clean);
  // "— Everything —": its dashes aside.
  const option = options.find((o) => h.same(o.replace(/^[-–—\s]+|[-–—\s]+$/g, ''), kind) || h.same(o, kind));
  if (!option) throw friendly({ message: `The stream's "Show:" has no "${kind}". It has ${h.listed(options)}.`, hint: 'Its choices depend on the components that are on.' });
  const answer = this.page.waitForResponse((r) => /admin-ajax\.php/.test(r.url()), { timeout: h.budget(this) * 4 }).catch(() => null);
  const value = await select.locator('option').evaluateAll((opts, wanted) => {
    const o = opts.find((x) => x.textContent.replace(/\s+/g, ' ').trim().replace(/[–—]/g, '-') === wanted);
    return o ? o.value : null;
  }, option);
  await select.selectOption(value !== null ? value : { label: option });
  await answer;
  await h.waitForList(this, STREAM);
});

/**
 * Open a tab of the activity directory ("All Members", "My Friends", "My Groups", "My Favorites", "Mentions"), its
 * count aside, and wait for its items.
 *
 * Example #1: When I open the "My Favorites" tab of the activity stream
 * Example #2: And I open the "My Groups" tab of the activity stream
 * Example #3: When we open the "My Friends" tab of the activity stream
 * Example #4: And I open the "All Members" tab of the activity stream
 * Example #5: When I open the "Mentions" tab of the activity stream
 */
When(/^(I |we )*open the "([^"]*)" tab of the activity stream$/, async function (pronounCase, label) {
  await requireStream(this);
  const tabs = this.page.locator('nav[aria-label="Directory menu"] li a, #buddypress .activity-type-tabs li a');
  const texts = (await tabs.allInnerTexts()).map(h.tabLabel);
  const index = texts.findIndex((t) => h.same(t, label));
  if (index < 0) throw friendly({ message: `The activity stream has no tab "${label}". It has ${h.listed(texts)}.`, hint: 'The tabs of an account show to it logged in.' });
  const answer = this.page.waitForResponse((r) => /admin-ajax\.php/.test(r.url()), { timeout: h.budget(this) * 4 }).catch(() => null);
  await tabs.nth(index).click();
  await answer;
  await h.waitForList(this, STREAM);
});

module.exports = { items, itemWith, removeLater };
