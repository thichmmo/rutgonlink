#!/usr/bin/env bash
set -Eeuo pipefail

: "${CPANEL_URL:?Set CPANEL_URL in GitHub Actions secrets}"
: "${CPANEL_USER:?Set CPANEL_USER in GitHub Actions secrets}"
: "${CPANEL_API_TOKEN:?Set CPANEL_API_TOKEN in GitHub Actions secrets}"
: "${CPANEL_APP_DIR:=/home/$CPANEL_USER/public_html/rutgonlink.site}"

artifact="${1:?Pass the release archive path}"
release_id="${2:?Pass the release id}"
artifact_url="${3:?Pass the public release asset URL}"
release_script_url="${4:?Pass the public release script URL}"
archive_name="$release_id.tar.gz"
checksum="$(sha256sum "$artifact" | cut -d' ' -f1)"

api_get() {
  curl --fail --silent --show-error --max-time 60 \
    -H "Authorization: cpanel $CPANEL_USER:$CPANEL_API_TOKEN" "$@"
}

echo "Starting cPanel release fetch $release_id"
# Fileman multipart uploads are discarded by this host from GitHub runners.
# Let the host fetch the public, checksum-verified release asset directly.
command="/bin/bash -c 'set -o pipefail; curl --fail --silent --show-error --location --max-time 120 \"$release_script_url\" | /bin/bash -s -- \"$release_id\" \"$archive_name\" \"$checksum\" \"$artifact_url\"'"
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
