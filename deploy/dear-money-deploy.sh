#!/usr/bin/env bash
# The deploy command on the server, run as root through sudo (no password, this script only).
# Installed as /usr/local/sbin/dear-money-deploy by install-on-server.sh, refreshed by every `upload`.
# The GitHub Actions key may run nothing else: authorized_keys forces
# `sudo -n /usr/local/sbin/dear-money-deploy $SSH_ORIGINAL_COMMAND`.
#
#   dear-money-deploy upload        read a tar.gz of the repo's deploy/ from stdin and install it
#   dear-money-deploy deploy <sha>  pull the image of that commit, back up the database, apply
#                                   migrations in a one-off container, start the new version,
#                                   smoke-test /health. When the image is not on the server yet,
#                                   registry user and token come on stdin, one per line
#   dear-money-deploy rollback      start the previous version again; manual only, never automatic
#   dear-money-deploy status        containers, current and previous versions, health
#   dear-money-deploy logs          last 200 lines of the app log
#   dear-money-deploy backup        dump the database to /var/backups/dear-money
#   dear-money-deploy seed          load the fictional test data from data/sample-seed.json;
#                                   rows that are already there are skipped
set -euo pipefail

APP_DIR=/opt/dear-money
PROJECT=dear-money
IMAGE_REPO=ghcr.io/averjuli/dear-money
APP_HOST=app.dearmoney.space
LOCAL_HEALTH=http://127.0.0.1:3001/health
BACKUP_DIR=/var/backups/dear-money
KEEP_BACKUPS=10

step() { echo "==> $*"; }
die() { echo "ERROR: $*" >&2; exit 1; }
current_version() { cat "$APP_DIR/current-version" 2>/dev/null || true; }
previous_version() { cat "$APP_DIR/previous-version" 2>/dev/null || true; }
image_version() {
  docker image inspect -f '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$1" 2>/dev/null
}
compose() {
  local tag=${APP_TAG:-$(current_version)}
  # "none" lets status, logs and backup work before the first deploy
  APP_TAG=${tag:-none} \
    docker compose -p "$PROJECT" --project-directory "$APP_DIR" -f "$APP_DIR/deploy/compose.yaml" "$@"
}
# Commit of the app container that is running now, empty if none
running_version() {
  local id
  id=$(compose ps -q app 2>/dev/null) || true
  [ -n "$id" ] || return 0
  docker inspect -f '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$id" 2>/dev/null || true
}
rollback_hint() {
  local previous
  previous=$(previous_version)
  if [ -n "$previous" ]; then
    echo "Nothing was rolled back; to return to $previous: sudo dear-money-deploy rollback"
  else
    echo "Nothing was rolled back; there is no previous version to return to"
  fi
}

upload() {
  [ ! -t 0 ] || die "pipe a tar.gz of deploy/ into stdin: tar -C deploy -cz . | ssh ... upload"
  local new="$APP_DIR/deploy.new"
  rm -rf "$new"
  install -d -m 755 "$new"
  tar -xzf - -C "$new" --no-same-owner --no-same-permissions
  [ -f "$new/compose.yaml" ] && [ -f "$new/dear-money-deploy.sh" ] \
    || die "compose.yaml or dear-money-deploy.sh is missing, nothing installed"
  bash -n "$new/dear-money-deploy.sh" || die "dear-money-deploy.sh has syntax errors, nothing installed"

  rm -rf "$APP_DIR/deploy.old"
  if [ -d "$APP_DIR/deploy" ]; then mv "$APP_DIR/deploy" "$APP_DIR/deploy.old"; fi
  mv "$new" "$APP_DIR/deploy"
  rm -rf "$APP_DIR/deploy.old"
  # A new file plus a rename: this running copy keeps reading the old one
  install -m 755 "$APP_DIR/deploy/dear-money-deploy.sh" /usr/local/sbin/dear-money-deploy.new
  mv /usr/local/sbin/dear-money-deploy.new /usr/local/sbin/dear-money-deploy
  step "Deploy scripts updated: $(cd "$APP_DIR/deploy" && echo *)"
}

# Pull with registry credentials from stdin (GitHub Actions sends its short-lived token);
# they live in a temporary docker config for this one pull only
pull() {
  local image=$1 user="" token="" config status=0
  if [ ! -t 0 ]; then
    IFS= read -r user || true
    IFS= read -r token || true
  fi
  [ -n "$user" ] && [ -n "$token" ] || die "$image is not on the server and no registry credentials came on stdin"
  step "Pulling $image"
  config=$(mktemp -d)
  {
    printf '%s\n' "$token" | DOCKER_CONFIG=$config docker login ghcr.io -u "$user" --password-stdin >/dev/null \
      && DOCKER_CONFIG=$config docker pull -q "$image"
  } || status=$?
  rm -rf "$config"
  [ "$status" -eq 0 ] || die "could not pull $image"
}

backup() {
  install -d -m 700 "$BACKUP_DIR"
  local file
  file="$BACKUP_DIR/$PROJECT-$(date +%Y%m%d-%H%M%S).sql.gz"
  # $POSTGRES_* expand inside the container, so the password never shows up here
  if ! compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"' | (umask 077 && gzip > "$file"); then
    rm -f "$file"
    die "backup failed"
  fi
  echo "$file ($(du -h "$file" | cut -f1))"
  # Keep only the newest backups
  find "$BACKUP_DIR" -maxdepth 1 -name "$PROJECT-*.sql.gz" -printf '%T@ %p\n' \
    | sort -rn | tail -n +$((KEEP_BACKUPS + 1)) | cut -d' ' -f2- | xargs -r rm -f --
}

# 200 with status ok from the public address, through nginx on this server
smoke() {
  local response="" code=""
  for _ in $(seq 1 10); do
    response=$(curl -sS --max-time 5 --resolve "$APP_HOST:443:127.0.0.1" -w '\n%{http_code}' "https://$APP_HOST/health" 2>&1) || true
    code=${response##*$'\n'}
    [ "$code" = 200 ] && break
    sleep 3
  done
  echo "GET https://$APP_HOST/health -> ${response//$'\n'/ }"
  [ "$code" = 200 ] && [[ $response == *'"status":"ok"'* ]]
}

# Keep only the current and the previous image of the app; images of other projects are never touched
prune_images() {
  local current previous ref
  current=$(current_version)
  previous=$(previous_version)
  docker image ls --format '{{.Repository}}:{{.Tag}}' "$IMAGE_REPO" | while read -r ref; do
    case "$ref" in
      "$IMAGE_REPO:$current" | "$IMAGE_REPO:$previous" | *"<none>") ;;
      *) if docker image rm "$ref" >/dev/null; then echo "removed $ref"; fi ;;
    esac
  done
  echo "kept: $current (current), ${previous:-none} (previous)"
}

deploy() {
  local version=${1:-}
  [[ $version =~ ^[0-9a-f]{40}$ ]] || die "usage: dear-money-deploy deploy <full commit SHA>"
  [ -s "$APP_DIR/.env" ] || die "$APP_DIR/.env is missing or empty, see README.md"
  local image="$IMAGE_REPO:$version" current started=0
  current=$(current_version)

  docker image inspect "$image" >/dev/null 2>&1 || pull "$image"
  [ "$(image_version "$image")" = "$version" ] || die "$image was built from another commit"
  export APP_TAG=$version

  step "Starting the database"
  compose up -d --wait db

  step "Backing up the database before migrations"
  backup

  step "Applying migrations in a one-off container of $version"
  compose run --rm --no-deps app node scripts/migrate.mjs \
    || die "migrations failed: $version was not started, ${current:-nothing} keeps running"

  step "Starting $version"
  compose up -d --no-deps --wait --wait-timeout 120 app || started=$?
  if [ -n "$current" ] && [ "$current" != "$version" ]; then
    echo "$current" > "$APP_DIR/previous-version"
  fi
  echo "$version" > "$APP_DIR/current-version"
  if [ "$started" -ne 0 ]; then
    compose logs --tail 50 app || true
    die "$version did not become healthy. $(rollback_hint)"
  fi

  step "Smoke test"
  [ "$(running_version)" = "$version" ] || die "the running app is $(running_version), not $version. $(rollback_hint)"
  smoke || die "smoke test failed, $version is running. $(rollback_hint)"

  step "Removing old images"
  prune_images
  step "Deployed $version"
}

rollback() {
  local previous
  previous=$(previous_version)
  [ -n "$previous" ] || die "no previous version is recorded"
  docker image inspect "$IMAGE_REPO:$previous" >/dev/null 2>&1 || die "the image of $previous is not on the server"
  step "Rolling back from $(current_version) to $previous"
  # Migrations of an older image find nothing new to apply
  deploy "$previous" </dev/null
}

status() {
  compose ps -a || true
  echo "current:  $(current_version)"
  echo "previous: $(previous_version)"
  echo "running:  $(running_version)"
  echo "health:   $(curl -fsS --max-time 5 "$LOCAL_HEALTH" 2>/dev/null || echo unavailable)"
}

[ "$(id -u)" -eq 0 ] || die "run through sudo: sudo dear-money-deploy ${1:-}"
[ $# -le 2 ] || die "too many arguments"
cd "$APP_DIR"
# One dear-money-deploy at a time
exec 9>/run/dear-money-deploy.lock
flock -w 600 9 || die "another dear-money-deploy is still running"

case "${1:-}" in
  upload) upload ;;
  deploy) deploy "${2:-}" ;;
  rollback) rollback ;;
  status) status ;;
  logs) compose logs --tail 200 app ;;
  backup) backup ;;
  seed) compose run --rm app node scripts/seed-cli.mjs data/sample-seed.json ;;
  *) die "usage: dear-money-deploy upload | deploy <sha> | rollback | status | logs | backup | seed" ;;
esac
