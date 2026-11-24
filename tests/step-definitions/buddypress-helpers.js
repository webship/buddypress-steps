'use strict';

// Shared helpers for the community's step files.
//
// Not a step file: it registers no step definitions and no hooks. It holds the plumbing the step files share, on top
// of the WordPress pack's helpers (the page budget, navigation, the users registry, the login): the community's
// addresses, the lists its directories fill by script (members, groups, the activity stream), a member's profile and
// a group's page, the session of another account for the test content and its removal, and the mail catcher.
//
// The community's template pack draws every screen inside `#buddypress`: a directory fills `#members-list`,
// `#groups-list` or `#activity-stream` after the page loaded (a feedback "Loading the members of your community.
// Please wait." meanwhile), a member or a group has its header (`#item-header`), its navigation (`nav#object-nav`),
// the navigation of a tab (`nav#subnav`) and its body (`#item-body`), and every outcome is a `.bp-feedback` box.

const { friendly, gotoUrl } = require('webship-js/tests/step-definitions/webship');
const {
  budget,
  settle,
  siteRoot,
  joinUrl,
  navigate,
  resolveUser,
  loginAs,
  isLoggedIn,
  supplied,
} = require('@webship-js/wordpress-steps/tests/step-definitions/wordpress-helpers');

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

/** White space collapsed, typographic dashes and quotes made plain, trimmed. */
function clean(text) {
  return String(text === null || text === undefined ? '' : text)
    .replace(/[‒-―−]/g, '-')
    .replace(/[“”„‟]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[  ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** A list for a failure message: "a", "b" and "c", or (none). */
function listed(items) {
  const all = (items || []).map((i) => `"${clean(i)}"`);
  if (!all.length) return '(none)';
  return all.length > 12 ? `${all.slice(0, 12).join(', ')} and ${all.length - 12} more` : all.join(', ');
}

/** The same text for a person: letter case, white space, dashes and quotes aside. */
function same(a, b) {
  return clean(a).toLowerCase() === clean(b).toLowerCase();
}

/** Whether a text holds another, letter case, white space, dashes and quotes aside. */
function holds(text, part) {
  return clean(text).toLowerCase().includes(clean(part).toLowerCase());
}

/** A regular expression that matches the text as a person reads it. */
function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** The whole of a text, white space aside, for a locator's `hasText` or `name`. */
function exactly(text) {
  return new RegExp(`^\\s*${escapeRegExp(clean(text)).replace(/ /g, '\\s+')}\\s*$`, 'i');
}

// ---------------------------------------------------------------------------
// Waiting
// ---------------------------------------------------------------------------

/**
 * Read something of the page again and again until `ok` holds for it, or the wait budget (twice the page budget) is
 * spent; then fail with the message `fail` builds from the last reading.
 */
async function eventually(world, read, ok, fail, timeout) {
  const deadline = Date.now() + (timeout || budget(world) * 2);
  let value;
  for (;;) {
    try {
      value = await read();
    } catch (err) {
      value = undefined;
      if (Date.now() > deadline) throw err;
    }
    if (value !== undefined && ok(value)) return value;
    if (Date.now() > deadline) break;
    await world.page.waitForTimeout(200);
  }
  throw friendly(await fail(value));
}

/**
 * Wait for a list the community fills by script after the page loaded: its "Loading …" feedback gone, and its rows
 * or the feedback that says it is empty there.
 */
async function waitForList(world, list) {
  const page = world.page;
  // The first request of a site that was just started can take long (its code is compiled on the way): the list gets
  // ten page budgets to come.
  const limit = budget(world) * 10;
  await page.locator(`${list} > li, #buddypress .bp-feedback:not(.loading)`).first().waitFor({ state: 'attached', timeout: limit }).catch(() => {});
  await page.locator('#buddypress .bp-feedback.loading').first().waitFor({ state: 'hidden', timeout: limit }).catch(() => {});
  await page.waitForTimeout(150);
}

/**
 * Click a link or a button that loads a page (a form of the community, a link of the administration) and wait for
 * that page.
 */
async function clickAndLoad(world, locator, what) {
  try {
    await Promise.all([
      world.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }),
      locator.click(),
    ]);
  } catch (err) {
    throw friendly({ message: `Could not ${what}: the site did not answer with a page.`, cause: err, hint: `The browser is at ${world.page.url()}.` });
  }
  await settle(world);
}

/**
 * Click something that asks "Are you sure?" first (a delete of the activity stream or of a notification): the
 * question is answered yes, the click goes on.
 */
async function clickConfirmed(world, locator) {
  // The page the click is on: the scenario may have closed it (or opened another) by the time the question is gone.
  const page = world.page;
  const accept = (dialog) => dialog.accept().catch(() => {});
  page.once('dialog', accept);
  try {
    await locator.click();
  } finally {
    setTimeout(() => { try { page.off('dialog', accept); } catch { /* the page is gone */ } }, 5000);
  }
}

// ---------------------------------------------------------------------------
// Addresses
// ---------------------------------------------------------------------------

/** The community's settings of cucumber.js: `worldParameters.community`. */
function community(world) {
  return (world.parameters && world.parameters.community) || {};
}

/** An address of the community ("members", "groups", "activity", "register"), as the plugin's URLs settings make it. */
function communityPath(world, what) {
  const defaults = { members: '/members/', groups: '/groups/', activity: '/activity/', register: '/register/' };
  const own = community(world)[what] || defaults[what];
  return '/' + String(own).replace(/^\/+|\/+$/g, '') + '/';
}

/** The handle of the account that removes test content in the administration: `worldParameters.community.manager`. */
function manager(world) {
  return community(world).manager || 'admin';
}

/**
 * Open an address of the site and say what the site answered: the status of the page the browser ended on (after
 * its redirects), 0 when none was read.
 */
async function visit(world, url) {
  let status = 0;
  const onResponse = (response) => {
    const request = response.request();
    if (request.isNavigationRequest() && request.frame() === world.page.mainFrame()) status = response.status();
  };
  world.page.on('response', onResponse);
  try {
    await navigate(world, url);
  } finally {
    world.page.off('response', onResponse);
  }
  return status;
}

/** Open a screen of the administration and say what the site answered (it keeps timers running: no settle). */
async function visitAdmin(world, url) {
  let status = 0;
  const onResponse = (response) => {
    const request = response.request();
    if (request.isNavigationRequest() && request.frame() === world.page.mainFrame()) status = response.status();
  };
  world.page.on('response', onResponse);
  try {
    await gotoUrl(world.page, joinUrl(world.launchUrl, url));
    await world.page.waitForSelector('body', { state: 'attached', timeout: 30000 });
    await world.page.waitForLoadState('domcontentloaded');
  } finally {
    world.page.off('response', onResponse);
  }
  return status;
}

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

/** The account of a handle of the users registry: its login and the name the community shows. */
function memberOf(world, who) {
  const users = (world.parameters && world.parameters.users) || {};
  if (users[who]) {
    // The WordPress pack's resolveUser gives the login and the password; the name and the address are the entry's.
    const account = resolveUser(world, who);
    const entry = typeof users[who] === 'object' ? users[who] : {};
    return { handle: who, username: account.username, name: entry.name || account.username, email: entry.email || null };
  }
  // Not a handle: the name the community shows, as written.
  const found = Object.entries(users).find(([, entry]) => entry && typeof entry === 'object' && same(entry.name || '', who));
  if (found) return memberOf(world, found[0]);
  return { handle: null, username: null, name: who, email: null };
}

/** The name the community shows for a handle of the users registry, or the name as written. */
function nameOf(world, who) {
  return memberOf(world, who).name;
}

/** The address of a member's profile: the members directory, then the account's login (its slug). */
function profilePath(world, who, tab) {
  const member = memberOf(world, who);
  if (!member.username) {
    throw friendly({ message: `"${who}" is not a handle of the users registry.`, hint: `Name an account by its handle in cucumber.js (${Object.keys(world.parameters.users || {}).join(', ')}).` });
  }
  const slug = encodeURIComponent(String(member.username).toLowerCase().replace(/[^a-z0-9._-]+/g, '-'));
  return `${communityPath(world, 'members')}${slug}/${tab ? String(tab).replace(/^\/+|\/+$/g, '') + '/' : ''}`;
}

/** The handle of the account the browser is logged in as, from the toolbar's "Howdy, <name>", or ''. */
async function currentMember(world) {
  const text = await world.page.locator('#wp-admin-bar-my-account .display-name, #wp-admin-bar-my-account > a').first().innerText({ timeout: 1000 }).catch(() => '');
  const name = clean(text).replace(/^Howdy,\s*/i, '');
  if (!name) return '';
  const users = (world.parameters && world.parameters.users) || {};
  const found = Object.entries(users).find(([, entry]) => entry && typeof entry === 'object' && (same(entry.name || '', name) || same(entry.username || '', name)));
  return found ? found[0] : '';
}

/** The account the steps of "my" profile mean: the one logged in, else a failure that says so. */
async function me(world) {
  let handle = await currentMember(world);
  if (handle) return handle;
  if (!/^https?:/.test(world.page.url()) || !(await world.page.locator('#wpadminbar').count())) {
    // A blank page (another account's work just began) or a page without the toolbar: the site's own page has it.
    await visit(world, communityPath(world, 'members'));
    handle = await currentMember(world);
    if (handle) return handle;
  }
  if (!(await isLoggedIn(world).catch(() => false))) {
    throw friendly({ message: 'Nobody is logged in.', hint: 'Log in first: Given I am a logged in user with the "member" user.' });
  }
  throw friendly({ message: 'The account logged in is not one of the users registry.', hint: 'Give worldParameters.users in cucumber.js its handle, with its "name" as the community shows it.' });
}

// ---------------------------------------------------------------------------
// The page that is open
// ---------------------------------------------------------------------------

/** The text of the outcomes the page shows (`.bp-feedback` boxes), the "Loading …" one aside. */
async function feedback(world) {
  const texts = await world.page.locator('#buddypress .bp-feedback:not(.loading), .bp-messages-feedback .bp-feedback').filter({ visible: true }).allInnerTexts().catch(() => []);
  return [...new Set(texts.map(clean).filter(Boolean))];
}

/** A short account of the page for a failure message: its address, its heading and its outcomes. */
async function pageSummary(world) {
  const page = world.page;
  const heading = clean(await page.locator('main h1, #item-header h2.user-nicename, #item-header h1').first().innerText({ timeout: 500 }).catch(() => ''));
  const said = await feedback(world);
  return `the page ${page.url()}${heading ? ` (heading "${heading}")` : ''}${said.length ? `, which says ${listed(said)}` : ''}`;
}

/** The labels of the tabs of a navigation (`nav#object-nav` of a member or a group, `nav#subnav` of a tab), counts aside. */
async function tabsOf(world, nav) {
  const texts = await world.page.locator(`${nav} li a`).allInnerTexts().catch(() => []);
  return texts.map((t) => clean(t)).filter(Boolean);
}

/** A tab of a navigation by its label, its count aside ("Friends 2" is "Friends"). */
function tabLabel(text) {
  return clean(text).replace(/\s+\d+$/, '');
}

// ---------------------------------------------------------------------------
// Another account's session
// ---------------------------------------------------------------------------

const SESSIONS = new Map();

/**
 * Do some work as another account of the users registry (test content, its removal), then give the scenario its own
 * session back. An account logs in once in a run; later work reuses its session.
 */
async function asAccount(world, handle, work) {
  resolveUser(world, handle);
  const key = `${siteRoot(world.launchUrl)}|${handle}`;
  const before = await world.context.cookies();
  const at = world.page.url();
  try { await world.page.goto('about:blank'); } catch { /* nothing open yet */ }
  await world.context.clearCookies();
  let ready = false;
  if (SESSIONS.has(key)) {
    await world.context.addCookies(SESSIONS.get(key));
    ready = await isLoggedIn(world).catch(() => false);
    if (!ready) await world.context.clearCookies();
  }
  if (!ready) {
    await loginAs(world, handle);
    SESSIONS.set(key, await world.context.cookies());
  }
  try {
    return await work();
  } finally {
    try { await world.page.goto('about:blank'); } catch { /* the page is gone */ }
    await world.context.clearCookies();
    if (before.length) await world.context.addCookies(before);
    if (/^https?:/.test(at)) await gotoUrl(world.page, at).catch(() => {});
  }
}

/**
 * Run a removal once the scenario ends, whatever its outcome (the After hook of buddypress-defaults.js); a late one
 * runs after all the others (what they do may undo it: a removal that opens an inbox reads its first conversation).
 */
function afterScenario(world, job, late) {
  const list = late ? 'communityLateCleanup' : 'communityCleanup';
  if (!world[list]) world[list] = [];
  world[list].push(job);
}

// ---------------------------------------------------------------------------
// The mail catcher
// ---------------------------------------------------------------------------

/** The address of a handle of the users registry, or the address itself. */
function addressOf(world, who) {
  if (/@/.test(who)) return who;
  const member = memberOf(world, who);
  if (!member.email) {
    throw friendly({
      message: `"${who}" has no e-mail address in the users registry.`,
      hint: `Give worldParameters.users.${who} an "email" in cucumber.js, or write the address itself in the step.`,
    });
  }
  return member.email;
}

/** The mail catcher's API address: `worldParameters.mailUrl`, else port 8026 of the site (a DDEV project's Mailpit). */
function mailRoot(world) {
  const own = world.parameters && world.parameters.mailUrl;
  return String(own || `${siteRoot(world.launchUrl)}:8026`).replace(/\/+$/, '');
}

/** The mail that arrived since the scenario began, to an address, newest first. */
async function mailTo(world, address) {
  const url = `${mailRoot(world)}/api/v1/messages?limit=200`;
  let response;
  try {
    response = await world.context.request.get(url, { failOnStatusCode: false, ignoreHTTPSErrors: true });
  } catch (err) {
    throw friendly({ message: `Could not read the mail catcher at ${url}.`, cause: err, hint: 'Check worldParameters.mailUrl in cucumber.js: the API of Mailpit, port 8026 of a DDEV project.' });
  }
  if (response.status() !== 200) {
    throw friendly({ message: `The mail catcher at ${url} answered ${response.status()}.`, hint: 'Check worldParameters.mailUrl in cucumber.js: the API of Mailpit, port 8026 of a DDEV project.' });
  }
  const since = (world.communityScenarioStartedAt || 0) - 2000;
  const wanted = address.toLowerCase();
  const body = await response.json();
  return (body.messages || []).filter((m) => Date.parse(m.Created) >= since
    && [].concat(m.To || [], m.Cc || [], m.Bcc || []).some((a) => String(a.Address || '').toLowerCase() === wanted));
}

/** The text of a mail of the mail catcher: its text version, else its HTML without the markup. */
async function mailText(world, id) {
  const response = await world.context.request.get(`${mailRoot(world)}/api/v1/message/${id}`, { failOnStatusCode: false, ignoreHTTPSErrors: true });
  const body = await response.json();
  return clean(body.Text || String(body.HTML || '').replace(/<[^>]*>/g, ' '));
}

/** A mail's subject without the site's name the community puts first ("[Webship Community] …"). */
function subjectOf(mail) {
  return clean(mail.Subject).replace(/^\[[^\]]*\]\s*/, '');
}

module.exports = {
  budget,
  settle,
  navigate,
  visit,
  visitAdmin,
  joinUrl,
  supplied,
  loginAs,
  isLoggedIn,
  clean,
  listed,
  same,
  holds,
  escapeRegExp,
  exactly,
  eventually,
  waitForList,
  clickAndLoad,
  clickConfirmed,
  community,
  communityPath,
  manager,
  memberOf,
  nameOf,
  profilePath,
  currentMember,
  me,
  feedback,
  pageSummary,
  tabsOf,
  tabLabel,
  asAccount,
  afterScenario,
  addressOf,
  mailTo,
  mailText,
  subjectOf,
};
