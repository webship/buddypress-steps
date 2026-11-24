'use strict';

// Friends: a request from a member's profile, the requests an account received (accept, reject), its friends
// (cancel one), and the Givens that put two accounts in a known state first. Every friendship and request a scenario
// changes is put back when it ends.

const { Given, When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const h = require('./buddypress-helpers');

/** The friendship button of a member's profile that is open, and what it says. */
async function friendshipButton(world) {
  const button = world.page.locator('#item-header button.friendship-button, #item-header a.friendship-button').filter({ visible: true }).first();
  const label = h.clean(await button.innerText({ timeout: h.budget(world) }).catch(() => ''));
  return { button, label };
}

/** What two accounts are to each other, as the first sees it on the second's profile: its friendship button. */
async function relation(world, from, to) {
  return h.asAccount(world, from, async () => {
    await h.visit(world, h.profilePath(world, to));
    return (await friendshipButton(world)).label;
  });
}

/** Make two accounts no friends and drop any request between them, as each of them in the browser. */
async function unfriend(world, a, b) {
  for (const [from, to] of [[a, b], [b, a]]) {
    await h.asAccount(world, from, async () => {
      await h.visit(world, h.profilePath(world, to));
      const { button, label } = await friendshipButton(world);
      if (/^(Cancel Friendship|Cancel Friendship Request)$/i.test(label)) {
        await h.clickConfirmed(world, button);
        await h.eventually(world, async () => (await friendshipButton(world)).label, (l) => /^Add Friend$/i.test(l), async (l) => ({ message: `"${from}" could not end its friendship with "${to}": the button reads "${l}".`, hint: 'The friendship buttons of the profile answer by script; a slow site takes a moment.' }));
      } else if (/^Friendship Requested$/i.test(label)) {
        // A request "to" sent "from": rejected on the requests page.
        await h.visit(world, h.profilePath(world, from, 'friends/requests'));
        const row = world.page.locator('#friend-list > li').filter({ hasText: h.nameOf(world, to) }).first();
        if (await row.count()) await row.getByRole('button', { name: 'Reject' }).or(row.getByRole('link', { name: 'Reject' })).first().click();
        await world.page.waitForTimeout(1000);
      }
    });
  }
}

/** Make two accounts friends: a request from the first, accepted by the second. */
async function befriend(world, a, b) {
  await unfriend(world, a, b);
  await h.asAccount(world, a, async () => {
    await h.visit(world, h.profilePath(world, b));
    const { button } = await friendshipButton(world);
    await button.click();
    await h.eventually(world, async () => (await friendshipButton(world)).label, (l) => /^Cancel Friendship Request$/i.test(l), async (l) => ({ message: `"${a}" could not ask "${b}" to be friends: the button reads "${l}".`, hint: 'A request needs the two accounts to be no friends and to have no request between them.' }));
  });
  await h.asAccount(world, b, async () => {
    await h.visit(world, h.profilePath(world, b, 'friends/requests'));
    const row = world.page.locator('#friend-list > li').filter({ hasText: h.nameOf(world, a) }).first();
    await row.getByRole('button', { name: 'Accept' }).or(row.getByRole('link', { name: 'Accept' })).first().click();
    await world.page.waitForTimeout(1000);
  });
}

/** Put two accounts back as they were when the scenario began, once it ends. */
async function restoreRelation(world, a, b) {
  if (!world.communityFriendsRestored) world.communityFriendsRestored = new Set();
  const key = [a, b].sort().join('|');
  if (world.communityFriendsRestored.has(key)) return;
  world.communityFriendsRestored.add(key);
  const before = await relation(world, a, b);
  h.afterScenario(world, async () => {
    const now = await relation(world, a, b);
    if (h.same(now, before)) return;
    if (/^Cancel Friendship$/i.test(before)) await befriend(world, a, b);
    else await unfriend(world, a, b);
  });
}

/**
 * Make two accounts no friends, with no request between them, as each of them in the browser; whatever they were
 * comes back when the scenario ends.
 *
 * Example #1: Given "newcomer" and "member" are not friends
 * Example #2: Given "member" and "moderator" are not friends
 * Example #3: And "newcomer" and "organizer" are not friends
 * Example #4: Given "moderator" and "newcomer" are not friends
 * Example #5: And "organizer" and "member" are not friends
 */
Given(/^"([^"]*)" and "([^"]*)" are not friends$/, async function (a, b) {
  await restoreRelation(this, a, b);
  await unfriend(this, a, b);
});

/**
 * Make two accounts friends (a request from the first, accepted by the second); whatever they were comes back when the
 * scenario ends.
 *
 * Example #1: Given "newcomer" and "member" are friends
 * Example #2: Given "organizer" and "member" are friends
 * Example #3: And "newcomer" and "moderator" are friends
 * Example #4: Given "member" and "moderator" are friends
 * Example #5: And "newcomer" and "organizer" are friends
 */
Given(/^"([^"]*)" and "([^"]*)" are friends$/, async function (a, b) {
  await restoreRelation(this, a, b);
  if (/^Cancel Friendship$/i.test(await relation(this, a, b))) return;
  await befriend(this, a, b);
});

/**
 * Press the friendship button of the member's profile that is open ("Add Friend", "Cancel Friendship Request",
 * "Cancel Friendship") and wait for its new state. The two accounts come back as they were when the scenario ends.
 *
 * Example #1: When I press "Add Friend" on the profile
 * Example #2: And I press "Cancel Friendship Request" on the profile
 * Example #3: When we press "Cancel Friendship" on the profile
 * Example #4: And I press "Add Friend" on the profile
 * Example #5: When I press "Cancel Friendship" on the profile
 */
When(/^(I |we )*press "(Add Friend|Cancel Friendship Request|Cancel Friendship)" on the profile$/, async function (pronounCase, label) {
  const { button, label: now } = await friendshipButton(this);
  if (!h.same(now, label)) {
    throw friendly({ message: `The profile's friendship button reads "${now || '(none)'}", not "${label}": ${await h.pageSummary(this)}.`, hint: 'Open another member\'s profile, logged in: When I go to the profile of "member".' });
  }
  const mine = await h.me(this);
  const other = await profileOwner(this);
  if (other) await restoreRelation(this, mine, other);
  await h.clickConfirmed(this, button);
  await h.eventually(this, async () => (await friendshipButton(this)).label, (l) => l && !h.same(l, label), async (l) => ({ message: `The friendship button still reads "${l}".`, hint: 'The site answers the button by script; a slow site takes a moment.' }));
});

/** The handle of the member whose profile is open, from its @login. */
async function profileOwner(world) {
  const header = h.clean(await world.page.locator('#item-header').first().innerText({ timeout: 1000 }).catch(() => ''));
  const login = (header.match(/@([A-Za-z0-9._-]+)/) || [])[1];
  if (!login) return '';
  const users = (world.parameters && world.parameters.users) || {};
  const found = Object.entries(users).find(([, entry]) => entry && typeof entry === 'object' && h.same(entry.username || '', login));
  return found ? found[0] : '';
}

/**
 * Assert the friendship button of the member's profile that is open reads a state ("Add Friend", "Cancel Friendship
 * Request", "Cancel Friendship").
 *
 * Example #1: Then the profile's friendship button should read "Cancel Friendship Request"
 * Example #2: And the profile's friendship button should read "Add Friend"
 * Example #3: Then the profile's friendship button should read "Cancel Friendship"
 * Example #4: And the profile's friendship button should read "Cancel Friendship Request"
 * Example #5: Then the profile's friendship button should read "Add Friend"
 */
Then(/^the profile's friendship button should read "([^"]*)"$/, async function (label) {
  await h.eventually(this, async () => (await friendshipButton(this)).label, (l) => h.same(l, label), async (l) => ({
    message: `The profile's friendship button reads "${l || '(none)'}", not "${label}".`,
    hint: 'A visitor and the account itself see no friendship button.',
  }));
});

/** Open the friendship requests of the account logged in. */
async function openRequests(world) {
  await h.visit(world, h.profilePath(world, await h.me(world), 'friends/requests'));
  await h.waitForList(world, '#friend-list');
}

/**
 * Open the friendship requests the account logged in received (its "Friends" tab, "Requests").
 *
 * Example #1: When I go to my friendship requests
 * Example #2: Given I am on my friendship requests
 * Example #3: And we go to my friendship requests
 * Example #4: When I go to my friendship requests
 * Example #5: Given we are on my friendship requests
 */
Given(/^(?:(?:I am |we are )+on|(?:I |we )*go to) my friendship requests$/, async function () {
  await openRequests(this);
});

/**
 * Assert my friendship requests list (or do not list) one from a member.
 *
 * Example #1: Then my friendship requests should list "newcomer"
 * Example #2: And my friendship requests should not list "newcomer"
 * Example #3: Then my friendship requests should list "Newcomer Test"
 * Example #4: And my friendship requests should not list "organizer"
 * Example #5: Then my friendship requests should list "moderator"
 */
Then(/^my friendship requests should( not)* list "([^"]*)"$/, async function (notCase, who) {
  if (!/\/friends\/requests\//.test(this.page.url())) await openRequests(this);
  const name = h.nameOf(this, who);
  const read = async () => (await this.page.locator('#friend-list > li .list-title, #friend-list > li .item-title').allInnerTexts().catch(() => [])).map(h.clean);
  await h.eventually(this, read, (names) => names.some((n) => h.same(n, name)) !== Boolean(notCase), async (names) => ({
    message: notCase ? `My friendship requests list "${name}".` : `My friendship requests do not list "${name}". They list ${h.listed(names)}${names.length ? '' : ` (the page says ${h.listed(await h.feedback(this))})`}.`,
    hint: 'A request shows to the account it was sent to.',
  }));
});

/**
 * Accept or reject the friendship request of a member, on my friendship requests, and check the site's answer
 * ("Friendship accepted.", "Friendship rejected."). The two accounts come back as they were when the scenario ends.
 *
 * Example #1: When I accept the friendship request of "newcomer"
 * Example #2: And I reject the friendship request of "newcomer"
 * Example #3: When we accept the friendship request of "Newcomer Test"
 * Example #4: And I reject the friendship request of "organizer"
 * Example #5: When I accept the friendship request of "moderator"
 */
When(/^(I |we )*(accept|reject) the friendship request of "([^"]*)"$/, async function (pronounCase, action, who) {
  if (!/\/friends\/requests\//.test(this.page.url())) await openRequests(this);
  const name = h.nameOf(this, who);
  const row = this.page.locator('#friend-list > li').filter({ has: this.page.locator('.list-title, .item-title').filter({ hasText: h.exactly(name) }) }).first();
  if (!(await row.count())) throw friendly({ message: `My friendship requests list no "${name}".`, hint: 'A request shows to the account it was sent to.' });
  const mine = await h.me(this);
  const handle = h.memberOf(this, who).handle;
  if (handle) await restoreRelation(this, mine, handle);
  const label = action === 'accept' ? 'Accept' : 'Reject';
  await row.getByRole('button', { name: label }).or(row.getByRole('link', { name: label })).first().click();
  const wanted = action === 'accept' ? /Friendship accepted/i : /Friendship rejected/i;
  await h.eventually(this, async () => h.clean(await row.innerText().catch(() => '')), (t) => wanted.test(t), async (t) => ({ message: `The request of "${name}" was not ${action}ed: its row reads "${t}".`, hint: 'The row of the request says "Friendship accepted." or "Friendship rejected." once the site answered.' }));
});

/**
 * Assert the friends of a member (the "Friends" tab of their profile) list (or do not list) another.
 *
 * Example #1: Then the friends of "member" should list "organizer"
 * Example #2: And the friends of "member" should not list "newcomer"
 * Example #3: Then the friends of "newcomer" should list "Member Test"
 * Example #4: And the friends of "organizer" should list "moderator"
 * Example #5: Then the friends of "newcomer" should not list "member"
 */
Then(/^the friends of "([^"]*)" should( not)* list "([^"]*)"$/, async function (owner, notCase, who) {
  await h.visit(this, h.profilePath(this, owner, 'friends'));
  await h.waitForList(this, '#friend-list');
  const name = h.nameOf(this, who);
  const read = async () => (await this.page.locator('#friend-list > li .list-title, #members-list > li .list-title').allInnerTexts().catch(() => [])).map(h.clean);
  await h.eventually(this, read, (names) => names.some((n) => h.same(n, name)) !== Boolean(notCase), async (names) => ({
    message: notCase ? `The friends of "${owner}" list "${name}".` : `The friends of "${owner}" do not list "${name}". They list ${h.listed(names)}.`,
    hint: 'A friendship counts once the request is accepted.',
  }));
});

module.exports = { friendshipButton, unfriend, befriend, restoreRelation };
