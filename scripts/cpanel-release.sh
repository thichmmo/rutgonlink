#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

release_id="${1:?release id is required}"
archive_name="${2:?archive name is required}"
expected_sha="${3:?archive checksum is required}"
app="/home/$(id -un)/public_html/rutgonlink.site"
release="$app/.deploy/$release_id"
archive="$release/release.tar.gz"
stage="$release/unpacked/.next/standalone"
live="$app/.next/standalone"
backup="$app/.next/standalone.before-$release_id"
failed="$app/.next/standalone.failed-$release_id"
node="$app/node-v20.15.1-linux-x64/bin/node"
status="$release/deploy.status"
log="$release/deploy.log"
preflight_pid=""
swapped=0

mkdir -p "$release/unpacked"
if [ -f "$status" ]; then exit 0; fi
if ! mkdir "$release/.running" 2>/dev/null; then exit 0; fi
exec >>"$log" 2>&1

rollback_on_error() {
  code=$?
  trap - ERR
  set +e
  [ -n "$preflight_pid" ] && kill "$preflight_pid" 2>/dev/null
  if [ "$swapped" -eq 1 ] && [ -d "$backup" ]; then
    [ -d "$live" ] && mv "$live" "$failed"
    mv "$backup" "$live"
    touch "$app/tmp/restart.txt"
    echo ROLLED_BACK > "$status"
  else
    echo FAILED_PRE_SWAP > "$status"
  fi
  echo "deploy_error=$code"
  exit "$code"
}
trap rollback_on_error ERR

echo "deploy_start=$(date -Is) release=$release_id"
test -f "$app/.env"
test -x "$node"
test -d "$live"
test ! -e "$backup"
mv "/home/$(id -un)/tmp/$archive_name" "$archive"
actual_sha="$(sha256sum "$archive" | cut -d' ' -f1)"
test "$actual_sha" = "$(printf '%s' "$expected_sha" | tr -d '\r\n')"
tar -xzf "$archive" -C "$release/unpacked"
test -f "$stage/server.js"
test -f "$stage/.next/BUILD_ID"
test -d "$stage/.next/static"
test -d "$stage/public"
test -d "$release/unpacked/prisma/migrations"
ln -s "$app/.env" "$stage/.env"

cd "$stage"
"$node" -e "for (const p of ['next', '@swc/helpers/_/_interop_require_default', '@prisma/client']) require.resolve(p)"
echo runtime_resolution_ok

db_value() {
  awk -F= -v key="$1" '$1 == key { sub(/^[^=]*=/, ""); gsub(/^"|"$/, ""); print; exit }' "$app/.env"
}
db_bin="$(command -v mysql || command -v mariadb)"
db_host="$(db_value DB_HOST)"
db_port="$(db_value DB_PORT)"
db_name="$(db_value DB_NAME)"
db_user="$(db_value DB_USER)"
db_password="$(db_value DB_PASSWORD)"
test -n "$db_bin"; test -n "$db_host"; test -n "$db_name"; test -n "$db_user"; test -n "$db_password"
db_sql() {
  MYSQL_PWD="$db_password" "$db_bin" --protocol=TCP -h "$db_host" -P "$db_port" -u "$db_user" "$db_name" "$@"
}

# cPanel databases were initially imported from database.sql without Prisma history.
db_sql -e 'CREATE TABLE IF NOT EXISTS `RutgonlinkMigration` (`migrationName` VARCHAR(191) NOT NULL, `checksum` CHAR(64) NOT NULL, `appliedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY (`migrationName`)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
baseline="20260926000000"
for migration_sql in "$release/unpacked/prisma/migrations"/*/migration.sql; do
  migration_name="$(basename "$(dirname "$migration_sql")")"
  if [[ "$migration_name" < "$baseline" ]]; then continue; fi
  escaped_name="${migration_name//\'/\'\'}"
  applied="$(db_sql -N -B -e "SELECT COUNT(*) FROM RutgonlinkMigration WHERE migrationName='$escaped_name'")"
  if [ "$applied" = 1 ]; then continue; fi
  migration_sha="$(sha256sum "$migration_sql" | cut -d' ' -f1)"
  db_sql < "$migration_sql"
  db_sql -e "INSERT INTO RutgonlinkMigration (migrationName, checksum) VALUES ('$escaped_name', '$migration_sha')"
  echo "migration_applied=$migration_name"
done
echo migration_verified

PORT=3012 HOSTNAME=127.0.0.1 NODE_ENV=production nohup "$node" "$stage/server.js" > "$release/preflight.log" 2>&1 &
preflight_pid=$!
for _ in $(seq 1 30); do
  root_http="$(curl -sS --max-time 4 -o /dev/null -w '%{http_code}' -H 'Host: rutgonlink.site' http://127.0.0.1:3012/ || true)"
  popups_http="$(curl -sS --max-time 4 -o /dev/null -w '%{http_code}' -H 'Host: rutgonlink.site' http://127.0.0.1:3012/api/popups || true)"
  posts_http="$(curl -sS --max-time 4 -o /dev/null -w '%{http_code}' -H 'Host: rutgonlink.site' http://127.0.0.1:3012/api/posts || true)"
  if [ "$root_http" = 200 ] && [ "$popups_http" = 401 ] && [ "$posts_http" = 401 ]; then break; fi
  sleep 2
done
test "$root_http" = 200; test "$popups_http" = 401; test "$posts_http" = 401
kill "$preflight_pid" 2>/dev/null || true
wait "$preflight_pid" 2>/dev/null || true
preflight_pid=""
echo preflight_ok

mv "$live" "$backup"
mv "$stage" "$live"
swapped=1
touch "$app/tmp/restart.txt"
for attempt in $(seq 1 30); do
  root_http="$(curl -k -sS --max-time 6 --resolve rutgonlink.site:443:103.57.221.79 -o /dev/null -w '%{http_code}' https://rutgonlink.site/ || true)"
  popups_http="$(curl -k -sS --max-time 6 --resolve rutgonlink.site:443:103.57.221.79 -o /dev/null -w '%{http_code}' https://rutgonlink.site/api/popups || true)"
  posts_http="$(curl -k -sS --max-time 6 --resolve rutgonlink.site:443:103.57.221.79 -o /dev/null -w '%{http_code}' https://rutgonlink.site/api/posts || true)"
  echo "health_attempt=$attempt root=$root_http popups=$popups_http posts=$posts_http"
  if [ "$root_http" = 200 ] && [ "$popups_http" = 401 ] && [ "$posts_http" = 401 ]; then break; fi
  sleep 3
done
test "$root_http" = 200; test "$popups_http" = 401; test "$posts_http" = 401
echo SUCCESS > "$status"
echo "deploy_success=$(date -Is)"
