#!/usr/bin/env bash
# One-time server setup for Dear Money: stub pages, nginx sites and one
# Let's Encrypt certificate for both domains.
#
# Usage, on the server, from the folder with this script:
#   sudo bash setup-nginx-tls.sh <email for Let's Encrypt notices>
#
# The server is shared with other projects, so this script only adds its own
# things: nginx sites dearmoney-http and dearmoney-https, the folders
# /var/www/dearmoney.space and /var/www/app.dearmoney.space, and the certificate
# named dearmoney.space. It never edits or removes anything else, and it only
# checks (never changes) Docker.
#
# Safe to run again: existing pages and the https site are left as they are,
# because they change when the landing and the app are deployed.
set -euo pipefail

DOMAIN=dearmoney.space
APP_DOMAIN=app.dearmoney.space
EMAIL=${1:-}

SRC=$(cd "$(dirname "$0")" && pwd)
NGINX_AVAILABLE=/etc/nginx/sites-available
NGINX_ENABLED=/etc/nginx/sites-enabled
ACME_ROOT=/var/www/certbot

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

# Installs a site from the repo and enables it. If nginx rejects the config,
# puts everything back as it was, so a typo here can never break other sites.
enable_site() {
  local name=$1
  local target="$NGINX_AVAILABLE/$name.conf"
  local backup=""

  if [ -f "$target" ]; then
    backup=$(mktemp)
    cp "$target" "$backup"
  fi

  install -m 644 "$SRC/nginx/$name.conf" "$target"
  ln -sfn "$target" "$NGINX_ENABLED/$name.conf"

  if ! nginx -t; then
    if [ -n "$backup" ]; then
      cp "$backup" "$target"
      rm -f "$backup"
    else
      rm -f "$NGINX_ENABLED/$name.conf" "$target"
    fi
    fail "nginx rejected $name, it was rolled back and nothing was reloaded"
  fi

  if [ -n "$backup" ]; then
    rm -f "$backup"
  fi
  systemctl reload nginx
}

echo "== 0. Checks before changing anything"
[ "$(id -u)" -eq 0 ] || fail "run with sudo"
[ -n "$EMAIL" ] || fail "pass the email for Let's Encrypt notices as the first argument"
for f in nginx/dearmoney-http.conf nginx/dearmoney-https.conf stub/index.html; do
  [ -f "$SRC/$f" ] || fail "missing $SRC/$f"
done
command -v nginx > /dev/null || fail "nginx is not installed"
command -v certbot > /dev/null || fail "certbot is not installed"
nginx -t || fail "nginx config is broken before our changes, fix that first"

echo "-- Docker (check only)"
command -v docker > /dev/null || fail "docker is not installed"
systemctl is-active --quiet docker || fail "docker is not running"
docker --version
if grep -Eq '"ip"[[:space:]]*:[[:space:]]*"127\.0\.0\.1"' /etc/docker/daemon.json 2>/dev/null; then
  echo "OK: container ports are published on 127.0.0.1 by default"
else
  echo "WARNING: /etc/docker/daemon.json has no \"ip\": \"127.0.0.1\"." >&2
  echo "         Always write ports as 127.0.0.1:HOST:CONTAINER in compose files." >&2
fi

echo "== 1. Stub pages"
install -d -m 755 "$ACME_ROOT"
for d in "$DOMAIN" "$APP_DOMAIN"; do
  install -d -m 755 "/var/www/$d"
  if [ -e "/var/www/$d/index.html" ]; then
    echo "/var/www/$d/index.html already exists, left as is"
  else
    install -m 644 "$SRC/stub/index.html" "/var/www/$d/index.html"
    echo "/var/www/$d/index.html created"
  fi
done

echo "== 2. nginx on port 80 (domain checks and redirect)"
enable_site dearmoney-http

echo "== 3. Certificate for both domains"
certbot certonly --webroot -w "$ACME_ROOT" \
  --cert-name "$DOMAIN" -d "$DOMAIN" -d "$APP_DOMAIN" \
  --email "$EMAIL" --agree-tos --no-eff-email --non-interactive \
  --key-type ecdsa --keep-until-expiring

echo "== 4. nginx on port 443"
if [ -f "$NGINX_AVAILABLE/dearmoney-https.conf" ]; then
  echo "dearmoney-https.conf already installed, left as is"
  ln -sfn "$NGINX_AVAILABLE/dearmoney-https.conf" "$NGINX_ENABLED/dearmoney-https.conf"
  nginx -t
  systemctl reload nginx
else
  enable_site dearmoney-https
fi

echo "== 5. Automatic renewal"
# certbot.timer renews every certificate on the server twice a day; the existing
# hook in /etc/letsencrypt/renewal-hooks/deploy reloads nginx after a renewal.
systemctl is-enabled --quiet certbot.timer || systemctl enable --now certbot.timer
systemctl is-active --quiet certbot.timer || systemctl start certbot.timer
systemctl list-timers certbot.timer --no-pager
certbot renew --cert-name "$DOMAIN" --dry-run

echo "== 6. Result"
certbot certificates --cert-name "$DOMAIN" | grep -E 'Certificate Name|Domains|Expiry Date'
for d in "$DOMAIN" "$APP_DOMAIN"; do
  http=$(curl -s -o /dev/null -w '%{http_code} -> %{redirect_url}' --resolve "$d:80:127.0.0.1" "http://$d/")
  https=$(curl -s -o /dev/null -w '%{http_code}' --resolve "$d:443:127.0.0.1" "https://$d/")
  echo "$d   http: $http   https: $https"
done
echo "Done."
