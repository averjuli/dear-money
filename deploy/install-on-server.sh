#!/usr/bin/env bash
# One-time server setup for automatic deploys, run by a person with sudo; safe to re-run:
#   1. /opt/dear-money with deploy/ and an empty .env (root only); the dear-money-deploy command
#   2. access: crmapp may run dear-money-deploy through sudo without a password, and the
#      GitHub Actions key in crmapp's authorized_keys may run only dear-money-deploy
#   3. nginx: app.dearmoney.space proxies to the app on 127.0.0.1:3001 instead of the stub page
#      and shows deploy/unavailable.html while the app is not running
#
# The server is shared with the CRM and the landing: this script only adds its own files
# (/opt/dear-money, /usr/local/sbin/dear-money-deploy, /etc/sudoers.d/dear-money-deploy) and
# replaces only its own nginx site dearmoney-https. It never edits anything of theirs.
#
# Run after setup-nginx-tls.sh, from the folder with this script: sudo bash install-on-server.sh
set -euo pipefail

APP_DIR=/opt/dear-money
DEPLOY_USER=crmapp
DEPLOY_KEY_COMMENT="github-actions-deploy dear-money"
SUDOERS_FILE=/etc/sudoers.d/dear-money-deploy
SITE=/etc/nginx/sites-available/dearmoney-https.conf
SITE_LINK=/etc/nginx/sites-enabled/dearmoney-https.conf
HERE="$(cd "$(dirname "$0")" && pwd)"

step() { echo; echo "=== $* ==="; }
die() { echo "ERROR: $*" >&2; exit 1; }

step "0/3 Checks before changing anything"
[ "$(id -u)" -eq 0 ] || die "run with sudo: sudo bash $0"
for f in compose.yaml dear-money-deploy.sh unavailable.html nginx/dearmoney-https.conf; do
  [ -f "$HERE/$f" ] || die "missing $HERE/$f"
done
command -v docker > /dev/null || die "docker is not installed"
docker compose version > /dev/null || die "docker compose is not installed"
command -v nginx > /dev/null || die "nginx is not installed"
[ -f /etc/letsencrypt/live/dearmoney.space/fullchain.pem ] \
  || die "no certificate for dearmoney.space yet: run setup-nginx-tls.sh first"
nginx -t || die "nginx config is broken before our changes, fix that first"

step "1/3 App folder $APP_DIR and the dear-money-deploy command"
install -d -m 755 "$APP_DIR"
if [ ! -e "$APP_DIR/.env" ]; then
  install -m 600 -o root -g root /dev/null "$APP_DIR/.env"
  echo "created an empty $APP_DIR/.env (readable by root only)"
else
  chown root:root "$APP_DIR/.env"
  chmod 600 "$APP_DIR/.env"
  echo "$APP_DIR/.env already exists, left as is (owner root, mode 600)"
fi
tar -C "$HERE" -cz . | bash "$HERE/dear-money-deploy.sh" upload

step "2/3 Access for $DEPLOY_USER and GitHub Actions"
sudoers_tmp=$(mktemp)
cat > "$sudoers_tmp" << SUDOERS
# Managed by dear-money deploy/install-on-server.sh
# Deploys from GitHub Actions log in as $DEPLOY_USER and run this one script as root
$DEPLOY_USER ALL=(root) NOPASSWD: /usr/local/sbin/dear-money-deploy
SUDOERS
visudo -cf "$sudoers_tmp" > /dev/null || { rm -f "$sudoers_tmp"; die "sudoers rule is invalid, nothing installed"; }
install -m 440 -o root -g root "$sudoers_tmp" "$SUDOERS_FILE"
rm -f "$sudoers_tmp"
echo "sudo rule: $DEPLOY_USER may run /usr/local/sbin/dear-money-deploy without a password"

keys=/home/$DEPLOY_USER/.ssh/authorized_keys
# Literal $SSH_ORIGINAL_COMMAND: sshd's shell expands it to the command the client asked for
forced='restrict,command="sudo -n /usr/local/sbin/dear-money-deploy $SSH_ORIGINAL_COMMAND"'
key_line=$(grep " $DEPLOY_KEY_COMMENT\$" "$keys" || true)
if [ -z "$key_line" ]; then
  echo "WARNING: no key '$DEPLOY_KEY_COMMENT' in $keys, GitHub Actions cannot deploy yet"
elif [[ $key_line != "$forced "* ]]; then
  die "the key '$DEPLOY_KEY_COMMENT' in $keys is not limited: its line must start with $forced"
else
  echo "the key '$DEPLOY_KEY_COMMENT' may run only: sudo -n /usr/local/sbin/dear-money-deploy <command>"
fi

step "3/3 nginx: app.dearmoney.space -> 127.0.0.1:3001"
if cmp -s "$HERE/nginx/dearmoney-https.conf" "$SITE"; then
  echo "$SITE is up to date"
else
  old=$(mktemp)
  had_old=0
  if [ -f "$SITE" ]; then
    cp -p "$SITE" "$old"
    had_old=1
  fi
  install -m 644 "$HERE/nginx/dearmoney-https.conf" "$SITE"
  ln -sfn "$SITE" "$SITE_LINK"
  # A broken config would also break the CRM and the landing on the next reload: put ours back
  if ! nginx -t; then
    if [ "$had_old" -eq 1 ]; then cp -p "$old" "$SITE"; else rm -f "$SITE_LINK" "$SITE"; fi
    rm -f "$old"
    die "nginx rejected the new dearmoney-https.conf, the previous one is restored"
  fi
  rm -f "$old"
  systemctl reload nginx
  echo "nginx reloaded: app.dearmoney.space now goes to the app"
fi
if runuser -u www-data -- test -r "$APP_DIR/deploy/unavailable.html"; then
  echo "nginx can read $APP_DIR/deploy/unavailable.html"
else
  echo "WARNING: nginx cannot read $APP_DIR/deploy/unavailable.html, it will show its own 502 page"
fi

step "Check"
/usr/local/sbin/dear-money-deploy status || true
echo
echo "ALL DONE. Next: fill $APP_DIR/.env (sudo nano $APP_DIR/.env), see README.md"
