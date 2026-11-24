#!/usr/bin/env bash
# Builds the site the suite runs against: the latest WordPress with the free BuddyPress plugin in a DDEV project of
# type wordpress, the way a site gets its community:
#   - BuddyPress from the plugin directory, with pretty addresses, and its components a community uses turned on:
#     the member profiles and their fields, the account settings, the activity stream, notifications, friends,
#     groups and private messages;
#   - the default block theme (Twenty Twenty-Five), or the theme THEME names;
#   - registration open, so the registration page answers (the suites never complete one);
#   - the accounts of the suite, each with its place in the community;
#   - the test content (site/community-site.php): profile fields and their values, friendships, a public, a private
#     and a hidden group with their members, updates with comments and favorites, a private message.
#
# Settings (environment variables, all optional):
#   PROJECT_NAME          the DDEV project name                           (default buddypresssteps)
#   SITE_DIR              the project folder                              (default a new temporary folder)
#   WORDPRESS_VERSION     the WordPress release                           (default latest)
#   BUDDYPRESS_VERSION    the BuddyPress release, from the plugin directory (default the latest stable)
#   PHP_VERSION           the PHP of the web container                    (default 8.4)
#   THEME                 a theme of the theme directory to activate      (default: the theme WordPress installs with)
#   SITE_TITLE            the name of the site                            (default Webship Community)
#   RESET_ONLY            1: build nothing; put the community in SITE_DIR back as the build left it, after a run
#                         that was stopped half way
#
# The accounts are configuration: this script creates them and cucumber.js names them; the features never create or
# delete an account. Each is named after its place in the community, with one password:
#   administrator  dD.123123ddd  administrator of the site (the installer's account): the community's settings,
#                                every profile and group
#   organizer      dD.123123ddd  organizer of the groups (their administrator)
#   moderator      dD.123123ddd  moderator of the public group
#   member         dD.123123ddd  a member: friends, groups, messages
#   newcomer       dD.123123ddd  a member with no friend and no group yet
#
# Nothing is installed that is paid or needs an account.
set -euo pipefail
# No command of the build reads a terminal: a container command waits forever on an open stdin pipe.
exec < /dev/null

PROJECT_NAME="${PROJECT_NAME:-buddypresssteps}"
WORDPRESS_VERSION="${WORDPRESS_VERSION:-latest}"
BUDDYPRESS_VERSION="${BUDDYPRESS_VERSION:-}"
PHP_VERSION="${PHP_VERSION:-8.4}"
THEME="${THEME:-}"
SITE_TITLE="${SITE_TITLE:-Webship Community}"
PASSWORD='dD.123123ddd'
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SITE_DIR="${SITE_DIR:-$(mktemp -d)}"

# The community's settings, places and content, written with the plugin's own functions (site/community-site.php).
community_site() {
  cp "$REPO_DIR/site/community-site.php" .webship-community-site.php
  ddev wp eval-file .webship-community-site.php "$@"
  rm -f .webship-community-site.php
}

mkdir -p "$SITE_DIR"
cd "$SITE_DIR"

if [ "${RESET_ONLY:-}" = "1" ]; then
  community_site reset
  echo "The community is back as the build left it."
  exit 0
fi

# Node.js 24, the line the workspace builds run.
ddev config --project-type=wordpress --docroot="" --project-name="$PROJECT_NAME" --php-version="$PHP_VERSION" --nodejs-version=24
ddev start -y
SITE_URL="$(ddev describe -j | python3 -c "import json,sys; print(json.load(sys.stdin)['raw']['primary_url'])")"

ddev wp core download --version="$WORDPRESS_VERSION"
ddev wp core install --url="$SITE_URL" --title="$SITE_TITLE" \
  --admin_user=administrator --admin_password="$PASSWORD" --admin_email=administrator@example.com --skip-email
ddev wp rewrite structure '/%postname%/'
ddev wp option update users_can_register 1

if [ -n "$THEME" ]; then
  ddev wp theme install "$THEME" --activate
fi

ddev wp plugin install buddypress ${BUDDYPRESS_VERSION:+--version="$BUDDYPRESS_VERSION"} --activate
# The plugin's own install (its tables, its default components and its version), which a plugin activated from the
# command line leaves to the first page of the administration: run there, it would turn off the components below.
# And the welcome screen its activation asks for: for 30 seconds, the first request of the administration goes there
# instead, even a visitor's request for the activity stream (admin-ajax.php), whose list then never comes.
ddev wp eval 'bp_version_updater(); delete_transient( "_bp_activation_redirect" ); delete_transient( "_bp_is_new_install" );'

# The accounts of the suite (the installer's account is the administrator), each a subscriber of the site.
for account in organizer moderator member newcomer; do
  ddev wp user create "$account" "$account@example.com" --role=subscriber --user_pass="$PASSWORD" --porcelain > /dev/null
done

# The components a community uses, with the plugin's own command, which makes their tables and pages (friends,
# groups and private messages are off on a new install).
active="$(ddev wp bp component list --status=active --fields=id --format=csv)"
for component in xprofile settings activity notifications friends groups messages; do
  grep -qx "$component" <<< "$active" || ddev wp bp component activate "$component"
done

community_site content

# The community's addresses (/members/, /groups/, /activity/, …) answer once the rules are written again: a plugin
# activated from the command line does not write them.
ddev wp rewrite flush

if [ -n "${GITHUB_ENV:-}" ]; then
  echo "LAUNCH_URL=$SITE_URL" >> "$GITHUB_ENV"
fi
echo "Built the community at $SITE_URL: WordPress $(ddev wp core version), BuddyPress $(ddev wp plugin get buddypress --field=version), theme $(ddev wp option get stylesheet), PHP $(ddev exec php -r 'echo PHP_VERSION;')"
