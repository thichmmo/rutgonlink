#!/usr/bin/env bash
set -Eeuo pipefail

: "${CPANEL_URL:?Set CPANEL_URL in GitHub Actions secrets}"
: "${CPANEL_USER:?Set CPANEL_USER in GitHub Actions secrets}"
: "${CPANEL_API_TOKEN:?Set CPANEL_API_TOKEN in GitHub Actions secrets}"
: "${CPANEL_APP_DIR:=/home/$CPANEL_USER/public_html/rutgonlink.site}"

artifact="${1:?Pass the release archive path}"
release_id="${2:?Pass the release id}"
archive_name="$release_id.tar.gz"
checksum="$(sha256sum "$artifact" | cut -d' ' -f1)"
remote_tmp="/home/$CPANEL_USER/tmp"

api_get() {
  curl --fail --silent --show-error --max-time 60 \
    -H "Authorization: cpanel $CPANEL_USER:$CPANEL_API_TOKEN" "$@"
}

api_upload() {
  local path="$1"
  local response
  response="$(curl --fail --silent --show-error --max-time 180 \
    -H "Authorization: cpanel $CPANEL_USER:$CPANEL_API_TOKEN" \
    -F "dir=$remote_tmp" -F "file-1=@$path" \
    "$CPANEL_URL/execute/Fileman/upload_files")"
  python3 -c 'import json,sys; d=json.load(sys.stdin); assert d.get("status") == 1, d; data=d.get("data") or {}; uploads=data.get("uploads", data) if isinstance(data, dict) else data; assert isinstance(uploads, list) and uploads and all(item.get("status") == 1 for item in uploads), d' <<<"$response"
}

echo "Uploading release $release_id"
cpanel_script="$(dirname "$0")/cpanel-release.sh"
cp "$artifact" "$RUNNER_TEMP/$archive_name"
printf '%s\n' "$checksum" > "$RUNNER_TEMP/$release_id.sha256"
api_upload "$RUNNER_TEMP/$archive_name"
api_upload "$RUNNER_TEMP/$release_id.sha256"

remote_script_name="cpanel-release-$release_id.sh"
cp "$cpanel_script" "$RUNNER_TEMP/$remote_script_name"
api_upload "$RUNNER_TEMP/$remote_script_name"
command="/bin/bash $remote_tmp/$remote_script_name $release_id $archive_name $checksum"
cron_response="$(api_get -G \
  --data-urlencode 'cpanel_jsonapi_module=Cron' \
  --data-urlencode 'cpanel_jsonapi_func=add_line' \
  --data-urlencode 'cpanel_jsonapi_apiversion=2' \
  --data-urlencode "command=$command" \
  --data-urlencode 'minute=*' --data-urlencode 'hour=*' \
  --data-urlencode 'day=*' --data-urlencode 'month=*' --data-urlencode 'weekday=*' \
  "$CPANEL_URL/json-api/cpanel")"
line_key="$(python3 -c 'import json,sys; d=json.load(sys.stdin); result=d["cpanelresult"]; assert result["event"]["result"] == 1, d; data=result["data"]; item=data[0] if isinstance(data,list) else data; print(item["linekey"])' <<<"$cron_response")"
echo "Waiting for cPanel deploy job $line_key"

status_dir="$CPANEL_APP_DIR/.deploy/$release_id"
status=''
for _ in $(seq 1 60); do
  response="$(api_get -G --data-urlencode "dir=$status_dir" --data-urlencode 'file=deploy.status' "$CPANEL_URL/execute/Fileman/get_file_content" || true)"
  status="$(python3 -c 'import json,sys; d=json.load(sys.stdin); print((d.get("data") or {}).get("content", "").strip())' <<<"$response" 2>/dev/null || true)"
  if [[ "$status" =~ ^(SUCCESS|FAILED_PRE_SWAP|ROLLED_BACK)$ ]]; then break; fi
  sleep 10
done

api_get -G \
  --data-urlencode 'cpanel_jsonapi_module=Cron' \
  --data-urlencode 'cpanel_jsonapi_func=remove_line' \
  --data-urlencode 'cpanel_jsonapi_apiversion=2' \
  --data-urlencode "linekey=$line_key" \
  "$CPANEL_URL/json-api/cpanel" >/dev/null || true

if [ "$status" != SUCCESS ]; then
  log_response="$(api_get -G --data-urlencode "dir=$status_dir" --data-urlencode 'file=deploy.log' "$CPANEL_URL/execute/Fileman/get_file_content" || true)"
  python3 -c 'import json,sys; print((json.load(sys.stdin).get("data") or {}).get("content", ""))' <<<"$log_response" || true
  echo "cPanel deployment failed with status: ${status:-TIMEOUT}" >&2
  exit 1
fi

echo "cPanel deployment completed: $release_id"
