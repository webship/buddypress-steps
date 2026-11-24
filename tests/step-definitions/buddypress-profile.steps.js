'use strict';

// The profile form of the account logged in (its fields, group by group, and who may see each) and the registration
// form of a visitor. A field a scenario changes is put back when it ends; a registration is only ever refused here
// (the suites never make an account).

const { Given, When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const h = require('./buddypress-helpers');

const FORM = '#profile-edit-form';
const LEVELS = ['Everyone', 'Only Me', 'All Members', 'My Friends'];

/** Open the profile form of the account logged in, on the group of fields that holds a field. */
async function openFieldGroup(world, field) {
  // The form that is open, with the field on it, keeps what was typed in it: no new page then.
  if (await fieldBox(world, field).count()) return fieldBox(world, field);
  const handle = await h.me(world);
  await h.visit(world, h.profilePath(world, handle, 'profile/edit'));
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const box = fieldBox(world, field);
    if (await box.count()) return box;
    // Another group of fields: its tab ("Base", "Work").
    const tabs = world.page.locator(`${FORM} .button-tabs a, #buddypress ul.button-tabs a`);
    const labels = (await tabs.allInnerTexts().catch(() => [])).map(h.clean);
    const current = h.clean(await world.page.locator(`${FORM} .button-tabs li.current a, #buddypress ul.button-tabs li.current a`).first().innerText({ timeout: 500 }).catch(() => ''));
    const next = labels.findIndex((l, i) => i >= attempt && !h.same(l, current));
    if (next < 0) break;
    await h.clickAndLoad(world, tabs.nth(next), `open the fields "${labels[next]}"`);
  }
  const legends = (await world.page.locator(`${FORM} fieldset legend`).allInnerTexts().catch(() => [])).map(h.clean);
  throw friendly({ message: `The profile form has no field "${field}". This group of fields has ${h.listed(legends)}.`, hint: 'Name the field as its label reads, without "(required)".' });
}

/** The box of a field of the profile form, by its label ("Location"; "Name (required)" is "Name"). */
function fieldBox(world, field) {
  return world.page.locator(`${FORM} fieldset, ${FORM} .editfield`).filter({
    has: world.page.locator('legend, label.field-label, > label').filter({ hasText: new RegExp(`^\\s*${h.escapeRegExp(h.clean(field))}(\\s*\\(required\\))?\\s*$`, 'i') }),
  }).first();
}

/** The value a field of the profile form holds: its text, or the checked choices of a list ("Design, Writing"). */
async function fieldValue(box) {
  return box.evaluate((el) => {
    const text = el.querySelector('input[type=text], input[type=url], input[type=email], input[type=number], textarea');
    if (text) return text.value;
    const checked = [...el.querySelectorAll('input[type=checkbox]:checked, input[type=radio]:checked')].filter((i) => !/visibility/.test(i.name));
    if (checked.length) return checked.map((i) => (i.labels && i.labels[0] ? i.labels[0].innerText : i.value).trim()).join(', ');
    const select = el.querySelector('select');
    return select ? [...select.selectedOptions].map((o) => o.text.trim()).join(', ') : '';
  });
}

/** Put a value in a field of the profile form: a text, a rich text, a list of choices, a select. */
async function setField(world, box, value) {
  const kind = await box.evaluate((el) => {
    if (el.querySelector('iframe')) return 'rich';
    if (el.querySelector('textarea')) return 'textarea';
    if (el.querySelector('input[type=checkbox]:not([name*=visibility])')) return 'checkbox';
    if (el.querySelector('input[type=radio]:not([name*=visibility])')) return 'radio';
    if (el.querySelector('select')) return 'select';
    return 'text';
  });
  if (kind === 'rich') {
    const id = await box.locator('textarea').first().getAttribute('id');
    // The rich editor of the page keeps its own copy: its API sets both.
    await world.page.evaluate(([fieldId, text]) => {
      const editor = window.tinymce && window.tinymce.get(fieldId);
      if (editor) { editor.setContent(text); editor.save(); } else { document.getElementById(fieldId).value = text; }
    }, [id, value]);
  } else if (kind === 'textarea') {
    await box.locator('textarea').first().fill(value);
  } else if (kind === 'checkbox' || kind === 'radio') {
    const wanted = value.split(/\s*,\s*/).filter(Boolean);
    const inputs = box.locator(`input[type=${kind}]:not([name*=visibility])`);
    for (let i = 0; i < (await inputs.count()); i += 1) {
      const input = inputs.nth(i);
      const label = h.clean(await input.evaluate((el) => (el.labels && el.labels[0] ? el.labels[0].innerText : el.value)));
      const on = wanted.some((w) => h.same(w, label));
      if (kind === 'checkbox') await input.setChecked(on, { force: true });
      else if (on) await input.check({ force: true });
    }
  } else if (kind === 'select') {
    await box.locator('select').first().selectOption({ label: value });
  } else {
    await box.locator('input[type=text], input[type=url], input[type=email], input[type=number]').first().fill(value);
  }
}

/** Send the profile form and read its outcome. */
async function saveProfile(world) {
  const button = world.page.locator('#profile-group-edit-submit');
  if (!(await button.count())) throw friendly({ message: `The profile form is not open: ${await h.pageSummary(world)}.`, hint: 'Change a field first: When I set my profile field "Location" to "…".' });
  await h.clickAndLoad(world, button, 'save the profile');
  return h.feedback(world);
}

/** Who may see a field, as its line under it reads ("This field may be seen by: Everyone"). */
async function visibilityOf(box) {
  const text = h.clean(await box.locator('.field-visibility-settings-toggle, .field-visibility-settings-notoggle').first().innerText({ timeout: 1000 }).catch(() => ''));
  return h.clean(text.replace(/^This field may be seen by:\s*/i, '').replace(/\s*Change$/i, ''));
}

/** Put a field back as it was, as its account, once the scenario ends. */
function restoreField(world, handle, field, value, level) {
  h.afterScenario(world, () => h.asAccount(world, handle, async () => {
    const box = await openFieldGroup(world, field);
    if (h.supplied(value)) await setField(world, box, value);
    if (h.supplied(level)) await setVisibility(world, box, level);
    await saveProfile(world);
  }));
}

/** Choose who may see a field: its "Change" button, the level, then "Close". */
async function setVisibility(world, box, level) {
  const name = LEVELS.find((l) => h.same(l, level));
  if (!name) throw friendly({ message: `"${level}" is not a level of the profile fields.`, hint: `The levels are ${h.listed(LEVELS)}.` });
  const change = box.getByRole('button', { name: 'Change' });
  if (!(await change.count())) throw friendly({ message: 'The field\'s visibility cannot be changed.', hint: 'Its line reads "This field may be seen by: …" with no "Change": the site fixed it.' });
  await change.click();
  await box.getByLabel(name, { exact: true }).check();
  await box.getByRole('button', { name: 'Close' }).click().catch(() => {});
}

/**
 * Put a value in a field of my profile form (the account logged in), opening the form on the group of fields that
 * holds it; a list of choices takes them comma-separated ("Design, Writing"). The field gets its value back when the
 * scenario ends. "When I save my profile" sends the form.
 *
 * Example #1: When I set my profile field "Location" to "Nairobi, Kenya"
 * Example #2: And I set my profile field "Skills" to "Design, Writing"
 * Example #3: When I set my profile field "About me" to "Webship test: a profile written by a test."
 * Example #4: And we set my profile field "Website" to "https://example.com/member"
 * Example #5: When I set my profile field "Location" to ""
 */
When(/^(I |we )*set my profile field "([^"]*)" to "([^"]*)"$/, async function (pronounCase, field, value) {
  const handle = await h.me(this);
  const box = await openFieldGroup(this, field);
  const before = await fieldValue(box);
  await setField(this, box, value);
  if (!this.communityProfileRestored) this.communityProfileRestored = new Set();
  const key = `${handle}|${field}|value`;
  if (!this.communityProfileRestored.has(key)) {
    this.communityProfileRestored.add(key);
    restoreField(this, handle, field, before, null);
  }
});

/**
 * Choose who may see a field of my profile ("Everyone", "Only Me", "All Members", "My Friends"): its "Change" button,
 * the level, "Close". The level comes back when the scenario ends. "When I save my profile" sends the form.
 *
 * Example #1: When I let "All Members" see my profile field "Location"
 * Example #2: And I let "Only Me" see my profile field "About me"
 * Example #3: When we let "My Friends" see my profile field "Location"
 * Example #4: And I let "Everyone" see my profile field "Location"
 * Example #5: When I let "Only Me" see my profile field "Skills"
 */
When(/^(I |we )*let "([^"]*)" see my profile field "([^"]*)"$/, async function (pronounCase, level, field) {
  const handle = await h.me(this);
  const box = await openFieldGroup(this, field);
  const before = await visibilityOf(box);
  await setVisibility(this, box, level);
  if (!this.communityProfileRestored) this.communityProfileRestored = new Set();
  const key = `${handle}|${field}|level`;
  if (!this.communityProfileRestored.has(key) && before) {
    this.communityProfileRestored.add(key);
    restoreField(this, handle, field, null, before);
  }
});

/**
 * Send the profile form ("Save Changes") and check the site saved it ("Changes saved.").
 *
 * Example #1: When I save my profile
 * Example #2: And we save my profile
 * Example #3: When I save my profile
 * Example #4: Then I save my profile
 * Example #5: And I save my profile
 */
When(/^(I |we )*save my profile$/, async function (pronounCase) {
  const said = await saveProfile(this);
  if (!said.some((s) => /Changes saved/i.test(s))) {
    throw friendly({ message: `The profile was not saved: the page says ${h.listed(said)}.`, hint: 'A required field left empty is refused ("Please make sure you fill in all required fields in this profile field group before saving.").' });
  }
});

/**
 * Assert who may see a field of the profile form, as its line reads ("This field may be seen by: All Members").
 *
 * Example #1: Then my profile field "Location" should be seen by "All Members"
 * Example #2: And my profile field "About me" should be seen by "Everyone"
 * Example #3: Then my profile field "Location" should be seen by "Everyone"
 * Example #4: And my profile field "Skills" should be seen by "Only Me"
 * Example #5: Then my profile field "Location" should be seen by "My Friends"
 */
Then(/^my profile field "([^"]*)" should be seen by "([^"]*)"$/, async function (field, level) {
  let box = fieldBox(this, field);
  if (!(await box.count())) box = await openFieldGroup(this, field);
  const now = await visibilityOf(box);
  if (!h.same(now, level)) throw friendly({ message: `My profile field "${field}" may be seen by "${now}", not "${level}".`, hint: 'The level is the field\'s line in the profile form: "This field may be seen by: …".' });
});

/**
 * Assert a field of my profile form holds a value (a list of choices: the checked ones, comma-separated).
 *
 * Example #1: Then my profile field "Location" should be "Nairobi"
 * Example #2: And my profile field "Skills" should be "Design"
 * Example #3: Then my profile field "Name" should be "Member Test"
 * Example #4: And my profile field "Location" should be "Nairobi, Kenya"
 * Example #5: Then my profile field "Website" should be ""
 */
Then(/^my profile field "([^"]*)" should be "([^"]*)"$/, async function (field, value) {
  let box = fieldBox(this, field);
  if (!(await box.count())) box = await openFieldGroup(this, field);
  const now = h.clean(await fieldValue(box));
  if (!h.same(now, value)) throw friendly({ message: `My profile field "${field}" is "${now}", not "${value}".`, hint: 'Its value is the one the profile form holds.' });
});

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

/**
 * Open the registration form of the community ("/register/"; `worldParameters.community.register` names another
 * address). A logged-in account is sent elsewhere: log out first.
 *
 * Example #1: Given I am on the registration page
 * Example #2: When I go to the registration page
 * Example #3: Given we are on the registration page
 * Example #4: And I go to the registration page
 * Example #5: When we go to the registration page
 */
Given(/^(?:(?:I am |we are )+on|(?:I |we )*go to) the registration page$/, async function () {
  await h.visit(this, h.communityPath(this, 'register'));
  if (!(await this.page.locator('#signup-form, #signup_username').count())) {
    throw friendly({ message: `The registration form is not there: ${await h.pageSummary(this)}.`, hint: 'Registration must be open (Settings → General → "Anyone can register"), and nobody logged in.' });
  }
});

/**
 * Assert the registration form asks (or does not ask) for a field, by its label ("Username (required)", "Name").
 *
 * Example #1: Then the registration form should ask for "Username"
 * Example #2: And the registration form should ask for "Email Address"
 * Example #3: Then the registration form should ask for "Name (required)"
 * Example #4: And the registration form should not ask for "Location"
 * Example #5: Then the registration form should ask for "Choose a Password"
 */
Then(/^the registration form should( not)* ask for "([^"]*)"$/, async function (notCase, label) {
  const labels = (await this.page.locator('#signup-form label, #signup-form legend').filter({ visible: true }).allInnerTexts().catch(() => [])).map(h.clean).filter(Boolean);
  const asks = labels.some((l) => h.same(l, label) || h.same(l.replace(/\s*\(required\)$/i, ''), label));
  if (asks === Boolean(notCase)) {
    throw friendly({ message: notCase ? `The registration form asks for "${label}".` : `The registration form does not ask for "${label}". It asks for ${h.listed(labels)}.`, hint: 'A profile field shows there when the administration put it in the "Signup Fields".' });
  }
});

/**
 * Fill in the registration form with a login, an address and a name (the password of the users registry's first
 * account) and send it, to see it refused: the suites never make an account, so the step fails when the site took
 * the registration (and asks the administration to remove the signup when the scenario ends).
 *
 * Example #1: When I try to register as "member" with the email "member@example.com" and the name "Webship test person"
 * Example #2: And I try to register as "webship-test" with the email "member@example.com" and the name "Webship test person"
 * Example #3: When we try to register as "member" with the email "webship-test@example.com" and the name "Webship test person"
 * Example #4: And I try to register as "organizer" with the email "organizer@example.com" and the name "Webship test"
 * Example #5: When I try to register as "member" with the email "not-an-address" and the name "Webship test person"
 */
When(/^(I |we )*try to register as "([^"]*)" with the email "([^"]*)" and the name "([^"]*)"$/, async function (pronounCase, login, email, name) {
  const page = this.page;
  if (!(await page.locator('#signup_username').count())) {
    throw friendly({ message: `The registration form is not open: ${await h.pageSummary(this)}.`, hint: 'Open it first: Given I am on the registration page.' });
  }
  await page.locator('#signup_username').fill(login);
  await page.locator('#signup_email').fill(email);
  const password = page.locator('#pass1, #signup_password').first();
  await password.fill('Webship-test-1!-password');
  if (await page.locator('#pass2').isVisible().catch(() => false)) await page.locator('#pass2').fill('Webship-test-1!-password');
  const nameField = page.locator('#signup-form').getByRole('textbox', { name: /^Name/ }).first();
  if (await nameField.count()) await nameField.fill(name);
  await h.clickAndLoad(this, page.locator('#signup-form #submit, #signup-form [name=signup_submit]').first(), 'send the registration');
  if (await page.locator('#signup_username').count()) return;
  // The site took it: a signup waits for its activation; the administration removes it.
  h.afterScenario(this, () => h.asAccount(this, h.manager(this), async () => {
    await h.visitAdmin(this, `/wp-admin/users.php?page=bp-signups&s=${encodeURIComponent(login)}`);
    const row = page.locator('table.wp-list-table tbody tr').filter({ hasText: login }).first();
    if (!(await row.count())) return;
    await row.locator('input[type=checkbox]').first().check();
    await page.locator('#bulk-action-selector-top').selectOption('delete');
    await h.clickAndLoad(this, page.locator('#doaction'), 'delete the signup');
    const confirm = page.locator('input[type=submit][value="Confirm"], #submit').first();
    if (await confirm.count()) await h.clickAndLoad(this, confirm, 'confirm the deletion of the signup');
  }));
  throw friendly({ message: `The site took the registration of "${login}" (${email}): ${await h.pageSummary(this)}.`, hint: 'This step only checks a refusal: use a login or an address that is taken, or one the site refuses.' });
});

/**
 * Assert the registration form refused what it got, with its message ("Sorry, that username already exists!",
 * "Sorry, that email address is already used!", "Please check your email address.").
 *
 * Example #1: Then the registration should be refused with "Sorry, that username already exists!"
 * Example #2: And the registration should be refused with "Sorry, that email address is already used!"
 * Example #3: Then the registration should be refused with "username already exists"
 * Example #4: And the registration should be refused with "Please check your email address."
 * Example #5: Then the registration should be refused with "email address is already used"
 */
Then(/^the registration should be refused with "([^"]*)"$/, async function (words) {
  const errors = (await this.page.locator('#signup-form .bp-feedback.error, #signup-form div.error, .bp-feedback.error').allInnerTexts().catch(() => [])).map(h.clean).filter(Boolean);
  if (!errors.some((e) => h.holds(e, words))) {
    throw friendly({ message: `The registration was not refused with "${words}". The form says ${h.listed(errors.length ? errors : await h.feedback(this))}.`, hint: 'Send it first: When I try to register as "member" with the email "…" and the name "…".' });
  }
});

module.exports = { openFieldGroup, fieldBox, fieldValue, setField, saveProfile };
