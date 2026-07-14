#!/bin/bash
set -u

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="${APP_DIR:-$(cd "$SCRIPT_DIR/.." && pwd)}"
NODE_BIN="$APP_DIR/node-v20.15.1-linux-x64/bin/node"
NEXT_BIN="$APP_DIR/node_modules/next/dist/bin/next"
PORT=3001

cd "$APP_DIR" || exit 1

# Ưu tiên PID giữ port; CloudLinux có thể ẩn PID nên fallback sang Next process của chính user.
pids=$(fuser "$PORT/tcp" 2>/dev/null || true)
if [ -z "$pids" ]; then
  pids=$(ps x -o pid=,command= | awk '/next-server|npm start/ && !/awk/ { print $1 }')
fi

for pid in $pids; do
  kill "$pid" 2>/dev/null || true
done
sleep 2

for pid in $pids; do
  if ! kill -0 "$pid" 2>/dev/null; then
    continue
  fi
  kill -9 "$pid" 2>/dev/null || true
done

nohup "$NODE_BIN" "$NEXT_BIN" start -p "$PORT" > app_3001.log 2>&1 &
new_pid=$!
echo "$new_pid" > app_3001.pid
sleep 4

kill -0 "$new_pid" 2>/dev/null
curl --fail --silent --output /dev/null "http://127.0.0.1:$PORT/"
