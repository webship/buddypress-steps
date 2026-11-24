'use strict';

// Private messages and notifications of the account logged in: a message sent (its recipients chosen as the site
// suggests them), the inbox and the sent box, a conversation read, answered and deleted; the notifications, read and
// deleted. A conversation a scenario begins goes for every side when it ends.

const { Given, When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const h = require('./buddypress-helpers');

const THREADS = '#message-threads';

/** Open a box of my messages ("inbox", "sentbox", "starred", "compose"), and wait for its list. */
async function openBox(world, box) {
  const handle = await h.me(world);
  if (box === 'inbox') await rememberUnread(world, handle);
  await h.visit(world, h.profilePath(world, handle, box === 'inbox' ? 'messages' : `messages/${box}`));
  if (box !== 'compose') await h.waitForList(world, THREADS);
  return handle;
}

/** The conversations of the box on the page: subject (its count of messages aside), who, excerpt, unread. */
async function threads(world) {
  return world.page.locator(`${THREADS} > li.thread-item`).evaluateAll((lis) => lis.map((li) => ({
    subject: (li.querySelector('.subject') || {}).innerText || '',
    who: (li.querySelector('.thread-from, .thread-to') || {}).innerText || '',
    excerpt: (li.querySelector('.excerpt') || {}).innerText || '',
    unread: li.classList.contains('unread'),
  }))).catch(() => []).then((rows) => rows.map((r) => ({ ...r, subject: h.clean(r.subject).replace(/^\(\d+\)\s*/, ''), who: h.clean(r.who).replace(/^(From|To):\s*/i, ''), excerpt: h.clean(r.excerpt) })));
}

/**
 * The unread conversations of an account, read through the site's API before its inbox opens (the box opens the first
 * conversation in its preview, which reads it), and marked unread again when the scenario ends.
 */
async function rememberUnread(world, handle) {
  if (!world.communityUnread) world.communityUnread = {};
  if (world.communityUnread[handle]) return;
  const { restRequest } = require('@webship-js/wordpress-steps/tests/step-definitions/wordpress-helpers');
  const answer = await restRequest(world, '/buddypress/v1/messages?box=inbox&type=unread&per_page=50').catch(() => null);
  const unread = answer && answer.status === 200 && Array.isArray(answer.json) ? answer.json.filter((t) => Number(t.unread_count) > 0) : [];
  world.communityUnread[handle] = unread.map((t) => ({ id: t.id, subject: h.clean((t.subject && (t.subject.rendered || t.subject.raw)) || '') }));
  if (!unread.length) return;
  h.afterScenario(world, () => h.asAccount(world, handle, async () => {
    for (const t of world.communityUnread[handle] || []) {
      await restRequest(world, `/buddypress/v1/messages/${t.id}`, { method: 'PUT', data: { unread: true } }).catch(() => null);
    }
  }));
}

/** Remove a conversation for every side once the scenario ends: each account of the users registry deletes it. */
function removeConversationLater(world, subject) {
  if (!world.communityConversations) world.communityConversations = new Set();
  if (world.communityConversations.has(subject)) return;
  world.communityConversations.add(subject);
  h.afterScenario(world, () => removeConversation(world, subject));
}

async function removeConversation(world, subject) {
  for (const handle of Object.keys(world.parameters.users || {})) {
    await h.asAccount(world, handle, async () => {
      for (const box of ['inbox', 'sentbox']) {
        for (let round = 0; round < 5; round += 1) {
          await h.visit(world, h.profilePath(world, handle, box === 'inbox' ? 'messages' : 'messages/sentbox'));
          await h.waitForList(world, THREADS);
          const subjectLink = world.page.locator(`${THREADS} > li.thread-item .subject`).filter({ hasText: subject }).first();
          if (!(await subjectLink.count())) break;
          await subjectLink.click();
          const del = world.page.locator('button.message-action-delete').first();
          await del.waitFor({ state: 'visible', timeout: h.budget(world) * 2 }).catch(() => {});
          if (!(await del.count())) break;
          await h.clickConfirmed(world, del);
          await world.page.waitForTimeout(1500);
        }
      }
    });
  }
}

/** Put a text in a rich editor of the page (its iframe), or in its textarea when the editor is off. */
async function writeIn(world, id, text) {
  const frame = world.page.locator(`#${id}_ifr`);
  if (await frame.count()) {
    const body = world.page.frameLocator(`#${id}_ifr`).locator('body');
    await body.click();
    await body.fill(text);
  } else {
    await world.page.locator(`#${id}`).fill(text);
  }
}

/** Choose a recipient in "Send @Username": its @login typed, then the site's suggestion. */
async function addRecipient(world, who) {
  const member = h.memberOf(world, who);
  if (!member.username) throw friendly({ message: `"${who}" is not a handle of the users registry.`, hint: 'Name the recipient by its handle in cucumber.js.' });
  const field = world.page.locator('#send-to-input');
  // The page binds its suggestions to the field once its script ran: typed too early, nothing is suggested, so the
  // step types again.
  // A suggestion reads "@member" then the name ("Member Test"), with nothing between them in its text: the @login is
  // followed by anything but a character of a login.
  const mention = String(member.username).toLowerCase().replace(/[^a-z0-9._-]+/g, '-');
  const suggestion = world.page.locator('.atwho-view li').filter({ visible: true }).filter({ hasText: new RegExp(`@${h.escapeRegExp(mention)}(?![a-z0-9._-])`) }).first();
  for (let attempt = 1; ; attempt += 1) {
    await field.click();
    await field.fill('');
    await field.pressSequentially(`@${member.username.slice(0, Math.min(4, member.username.length))}`, { delay: 120 });
    try {
      await suggestion.waitFor({ state: 'visible', timeout: h.budget(world) });
      break;
    } catch (err) {
      if (attempt < 4) continue;
      const offered = (await world.page.locator('.atwho-view li').filter({ visible: true }).allInnerTexts().catch(() => [])).map(h.clean);
      throw friendly({ message: `The site suggests no "@${member.username}" for the recipient. It suggests ${h.listed(offered)}.`, hint: 'The suggestions are the members the account may write to (friends only, when the site says so).', cause: err });
    }
  }
  await suggestion.click();
}

/**
 * Write a private message from the account logged in (its "Messages" tab, "Compose"): the recipient chosen in
 * "Send @Username" as the site suggests it, a subject and a text, then "Send". The conversation goes for every side
 * when the scenario ends.
 *
 * Example #1: When I send the message "Webship test message" to "member" saying "Hello from a test."
 * Example #2: And I send the message "Webship test: the meeting" to "organizer" saying "See you on Thursday."
 * Example #3: When we send the message "Webship test message two" to "moderator" saying "A second message."
 * Example #4: And I send the message "Webship test question" to "member" saying "Is the circle open?"
 * Example #5: When I send the message "Webship test message" to "newcomer" saying "Welcome!"
 */
When(/^(I |we )*send the message "([^"]*)" to "([^"]*)" saying "([^"]*)"$/, async function (pronounCase, subject, who, text) {
  await openBox(this, 'compose');
  await this.page.locator('#subject').waitFor({ state: 'visible', timeout: h.budget(this) * 3 });
  await addRecipient(this, who);
  await this.page.locator('#subject').fill(subject);
  await writeIn(this, 'message_content', text);
  removeConversationLater(this, subject);
  await this.page.locator('#bp-messages-send').click();
  await h.eventually(this, async () => ({ url: this.page.url(), said: await h.feedback(this) }), (s) => /\/sentbox\/?$/.test(s.url) || s.said.some((t) => /recipient|not sent|error/i.test(t)), async (s) => ({ message: `The message was not sent: the page says ${h.listed(s.said)}.`, hint: 'A message needs a recipient the site suggests, a subject and a text.' }), h.budget(this) * 4);
  const said = await h.feedback(this);
  if (!/\/sentbox\/?$/.test(this.page.url())) throw friendly({ message: `The message "${subject}" was not sent: the page says ${h.listed(said)}.`, hint: 'A message needs a recipient the site suggests, a subject and a text.' });
});

/**
 * Send the compose form of my messages with a subject and a text and no recipient, to see it refused.
 *
 * Example #1: When I send the message "Webship test message" to nobody saying "Nobody gets this."
 * Example #2: And we send the message "Webship test: lost" to nobody saying "Nobody."
 * Example #3: When I send the message "Webship test message" to nobody saying "Hello?"
 * Example #4: And I send the message "Webship test" to nobody saying "No recipient."
 * Example #5: When we send the message "Webship test message" to nobody saying "Nobody gets this."
 */
When(/^(I |we )*send the message "([^"]*)" to nobody saying "([^"]*)"$/, async function (pronounCase, subject, text) {
  await openBox(this, 'compose');
  await this.page.locator('#subject').waitFor({ state: 'visible', timeout: h.budget(this) * 3 });
  await this.page.locator('#subject').fill(subject);
  await writeIn(this, 'message_content', text);
  await this.page.locator('#bp-messages-send').click();
});

/**
 * Assert the messages page says something ("Please add at least one recipient.", "Messages deleted").
 *
 * Example #1: Then the messages page should say "Please add at least one recipient."
 * Example #2: And the messages page should say "Messages deleted"
 * Example #3: Then the messages page should say "at least one recipient"
 * Example #4: And the messages page should say "Sorry, no messages were found."
 * Example #5: Then the messages page should say "Messages deleted"
 */
Then(/^the messages page should say "([^"]*)"$/, async function (words) {
  await h.eventually(this, () => h.feedback(this), (said) => said.some((s) => h.holds(s, words)), async (said) => ({ message: `The messages page does not say "${words}". It says ${h.listed(said)}.`, hint: 'The page says what it did in its feedback box ("Messages deleted", "Please add at least one recipient.").' }));
});

/**
 * Open my inbox or my sent box (the "Messages" tab of the account logged in) and wait for its conversations.
 *
 * Example #1: When I go to my inbox
 * Example #2: Given I am on my sent box
 * Example #3: And we go to my inbox
 * Example #4: When I go to my sent box
 * Example #5: Given we are on my inbox
 */
Given(/^(?:(?:I am |we are )+on|(?:I |we )*go to) my (inbox|sent box)$/, async function (box) {
  await openBox(this, box === 'inbox' ? 'inbox' : 'sentbox');
});

/**
 * Assert the box of messages on the page lists (or does not list) a conversation by its subject, and, when given, from
 * or to whom, and whether it was unread when the inbox opened (the box reads its first conversation in its preview).
 *
 * Example #1: Then the box should list the conversation "Welcome to the club" with "Organizer Test"
 * Example #2: And the box should list the unread conversation "Welcome to the club" with "organizer"
 * Example #3: Then the box should not list the conversation "Webship test message"
 * Example #4: And the box should list the conversation "Webship test message" with "member"
 * Example #5: Then the box should list the conversation "Webship test message"
 */
Then(/^the box should( not)* list the (unread )?conversation "([^"]*)"(?: with "([^"]*)")?$/, async function (notCase, unread, subject, who) {
  await h.waitForList(this, THREADS);
  const name = h.supplied(who) ? h.nameOf(this, who) : null;
  const handle = await h.currentMember(this);
  const remembered = ((this.communityUnread || {})[handle] || []).map((t) => t.subject);
  const isUnread = (t) => t.unread || remembered.some((r) => h.same(r, t.subject));
  await h.eventually(this, () => threads(this), (all) => all.some((t) => h.same(t.subject, subject) && (!name || h.holds(t.who, name)) && (!unread || isUnread(t))) !== Boolean(notCase), async (all) => ({
    message: notCase ? `The box lists the conversation "${subject}".` : `The box lists no ${unread ? 'unread ' : ''}conversation "${subject}"${name ? ` with "${name}"` : ''}. It lists ${h.listed((all || []).map((t) => `${t.subject} (${t.who}${t.unread ? ', unread' : ''})`))}.`,
    hint: 'The inbox lists what came, the sent box what went.',
  }));
});

/**
 * Open a conversation of the box on the page by its subject, and wait for its messages.
 *
 * Example #1: When I open the conversation "Welcome to the club"
 * Example #2: And I open the conversation "Webship test message"
 * Example #3: When we open the conversation "Welcome to the club"
 * Example #4: And I open the conversation "Webship test: the meeting"
 * Example #5: When I open the conversation "Webship test question"
 */
When(/^(I |we )*open the conversation "([^"]*)"$/, async function (pronounCase, subject) {
  await h.waitForList(this, THREADS);
  const link = this.page.locator(`${THREADS} > li.thread-item .subject`).filter({ hasText: subject }).first();
  if (!(await link.count())) throw friendly({ message: `The box lists no conversation "${subject}". It lists ${h.listed((await threads(this)).map((t) => t.subject))}.`, hint: 'Open the inbox or the sent box first.' });
  await link.click();
  await this.page.locator('#bp-message-thread-list > li').first().waitFor({ state: 'visible', timeout: h.budget(this) * 3 });
});


/** The messages of the conversation that is open: who and the text. */
async function conversation(world) {
  return world.page.locator('#bp-message-thread-list > li').evaluateAll((lis) => lis.map((li) => ({
    who: (li.querySelector('.user-link, .message-metadata a') || {}).innerText || '',
    text: (li.querySelector('.message-content') || {}).innerText || li.innerText || '',
  }))).catch(() => []).then((rows) => rows.map((r) => ({ who: h.clean(r.who), text: h.clean(r.text) })).filter((r) => r.who || r.text));
}

/**
 * Assert the conversation that is open shows (or does not show) a message by its words, and, when given, from whom.
 *
 * Example #1: Then the conversation should show "Hi Member, welcome!" from "organizer"
 * Example #2: And the conversation should show "Webship test reply" from "Member Test"
 * Example #3: Then the conversation should not show "Webship test reply"
 * Example #4: And the conversation should show "Hello from a test."
 * Example #5: Then the conversation should show "See you on Thursday." from "member"
 */
Then(/^the conversation should( not)* show "([^"]*)"(?: from "([^"]*)")?$/, async function (notCase, words, who) {
  const name = h.supplied(who) ? h.nameOf(this, who) : null;
  await h.eventually(this, () => conversation(this), (all) => all.some((m) => h.holds(m.text, words) && (!name || h.same(m.who, name))) !== Boolean(notCase), async (all) => ({
    message: notCase ? `The conversation shows "${words}".` : `The conversation shows no "${words}"${name ? ` from "${name}"` : ''}. It shows ${h.listed((all || []).map((m) => `${m.who}: ${m.text.slice(0, 60)}`))}.`,
    hint: 'Open it first: When I open the conversation "…".',
  }));
});

/**
 * Answer the conversation that is open ("Send a Reply"), and wait for the answer at its end.
 *
 * Example #1: When I reply "Webship test reply" to the conversation
 * Example #2: And we reply "Webship test: thanks!" to the conversation
 * Example #3: When I reply "Webship test reply two" to the conversation
 * Example #4: And I reply "Webship test: see you" to the conversation
 * Example #5: When I reply "Webship test reply" to the conversation
 */
When(/^(I |we )*reply "([^"]*)" to the conversation$/, async function (pronounCase, text) {
  if (!(await this.page.locator('#send_reply_button').count())) throw friendly({ message: `No conversation is open: ${await h.pageSummary(this)}.`, hint: 'Open one first: When I open the conversation "…".' });
  const subject = h.clean(await this.page.locator('#item-body h2, .thread-subject, #message-subject').first().innerText({ timeout: 1000 }).catch(() => ''));
  if (subject) {
    // A reply in a conversation of the build: the reset (or a removal of the whole conversation) takes it away.
    if (/^Webship test/i.test(subject)) removeConversationLater(this, subject);
  }
  await writeIn(this, 'message_content', text);
  await this.page.locator('#send_reply_button').click();
  await h.eventually(this, () => conversation(this), (all) => all.some((m) => h.holds(m.text, text)), async () => ({ message: `The reply "${text}" did not show in the conversation.`, hint: 'An empty reply is refused.' }), h.budget(this) * 4);
});

/**
 * Delete the conversation that is open ("Delete conversation."), for the account logged in; check the site's answer
 * ("Messages deleted").
 *
 * Example #1: When I delete the conversation
 * Example #2: And we delete the conversation
 * Example #3: When I delete the conversation
 * Example #4: Then I delete the conversation
 * Example #5: And I delete the conversation
 */
When(/^(I |we )*delete the conversation$/, async function (pronounCase) {
  const button = this.page.locator('button.message-action-delete').first();
  if (!(await button.count())) throw friendly({ message: `No conversation is open: ${await h.pageSummary(this)}.`, hint: 'Open one first: When I open the conversation "…".' });
  await h.clickConfirmed(this, button);
  await h.eventually(this, () => h.feedback(this), (said) => said.some((s) => /Messages deleted/i.test(s)), async (said) => ({ message: `The conversation was not deleted: the page says ${h.listed(said)}.`, hint: 'The conversation is deleted for the account logged in only; the others keep it.' }));
});

/**
 * Remove a conversation of an earlier run that was stopped half way, by its subject, for every account of the users
 * registry.
 *
 * Example #1: Given there is no conversation "Webship test message"
 * Example #2: Given there is no conversation "Webship test: the meeting"
 * Example #3: And there is no conversation "Webship test message two"
 * Example #4: Given there is no conversation "Webship test question"
 * Example #5: And there is no conversation "Webship test message"
 */
Given(/^there is no conversation "([^"]*)"$/, async function (subject) {
  await removeConversation(this, subject);
});

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

/** The notifications of the table on the page. */
async function notifications(world) {
  return world.page.locator('table.notifications tbody tr').evaluateAll((trs) => trs.map((tr) => ({
    text: (tr.querySelector('td.notification-description') || {}).innerText || '',
    since: (tr.querySelector('td.notification-since') || {}).innerText || '',
  }))).catch(() => []).then((rows) => rows.map((r) => ({ text: h.clean(r.text), since: h.clean(r.since) })).filter((r) => r.text));
}

/**
 * Open my notifications (the "Notifications" tab of the account logged in): its unread ones, or its read ones.
 *
 * Example #1: When I go to my notifications
 * Example #2: Given I am on my read notifications
 * Example #3: And we go to my notifications
 * Example #4: When I go to my read notifications
 * Example #5: Given we are on my notifications
 */
Given(/^(?:(?:I am |we are )+on|(?:I |we )*go to) my (read )?notifications$/, async function (read) {
  const handle = await h.me(this);
  await h.visit(this, h.profilePath(this, handle, read ? 'notifications/read' : 'notifications'));
});

/**
 * Assert the notifications on the page list (or do not list) one by its words ("You have a friendship request from
 * Newcomer Test", "Organizer Test sent you a new private message").
 *
 * Example #1: Then my notifications should list "You have a friendship request from Newcomer Test"
 * Example #2: And my notifications should list "sent you a new private message"
 * Example #3: Then my notifications should not list "You have a friendship request from Newcomer Test"
 * Example #4: And my notifications should list "Newcomer Test requests group membership"
 * Example #5: Then my notifications should not list "requests group membership"
 */
Then(/^my notifications should( not)* list "([^"]*)"$/, async function (notCase, words) {
  if (!/\/notifications\//.test(this.page.url())) {
    await h.visit(this, h.profilePath(this, await h.me(this), 'notifications'));
  }
  const all = await notifications(this);
  if (all.some((n) => h.holds(n.text, words)) === Boolean(notCase)) {
    throw friendly({ message: notCase ? `My notifications list "${words}".` : `My notifications do not list "${words}". They list ${h.listed(all.map((n) => n.text))}${all.length ? '' : ` (the page says ${h.listed(await h.feedback(this))})`}.`, hint: 'Unread and read notifications are on two pages: "Unread" and "Read".' });
  }
});

/** The row of a notification on the page, by its words. */
async function notificationRow(world, words) {
  const row = world.page.locator('table.notifications tbody tr').filter({ has: world.page.locator('td.notification-description').filter({ hasText: words }) }).first();
  if (!(await row.count())) throw friendly({ message: `The notifications list no "${words}". They list ${h.listed((await notifications(world)).map((n) => n.text))}.`, hint: 'Open them first: When I go to my notifications.' });
  return row;
}

/**
 * Mark a notification of the page as read ("Read"), by its words; it is unread again when the scenario ends.
 *
 * Example #1: When I mark the notification "You have a friendship request from Newcomer Test" as read
 * Example #2: And I mark the notification "sent you a new private message" as read
 * Example #3: When we mark the notification "requests group membership" as read
 * Example #4: And I mark the notification "Newcomer Test" as read
 * Example #5: When I mark the notification "friendship request" as read
 */
When(/^(I |we )*mark the notification "([^"]*)" as read$/, async function (pronounCase, words) {
  const row = await notificationRow(this, words);
  const handle = await h.me(this);
  h.afterScenario(this, () => h.asAccount(this, handle, async () => {
    await h.visit(this, h.profilePath(this, handle, 'notifications/read'));
    const again = this.page.locator('table.notifications tbody tr').filter({ has: this.page.locator('td.notification-description').filter({ hasText: words }) }).first();
    if (await again.count()) await h.clickAndLoad(this, again.locator('a.mark-unread').first(), 'mark the notification unread');
  }));
  await h.clickAndLoad(this, row.locator('a.mark-read').first(), 'mark the notification as read');
});

/**
 * Delete a notification of the page ("Delete", which asks "Are you sure?"), by its words.
 *
 * Example #1: When I delete the notification "You have a friendship request from Newcomer Test"
 * Example #2: And I delete the notification "sent you a new private message"
 * Example #3: When we delete the notification "requests group membership"
 * Example #4: And I delete the notification "Newcomer Test"
 * Example #5: When I delete the notification "friendship request"
 */
When(/^(I |we )*delete the notification "([^"]*)"$/, async function (pronounCase, words) {
  const row = await notificationRow(this, words);
  const page = this.page;
  const accept = (dialog) => dialog.accept().catch(() => {});
  page.once('dialog', accept);
  await h.clickAndLoad(this, row.locator('a.delete').first(), 'delete the notification');
});

module.exports = { openBox, threads, conversation, notifications, removeConversation };
