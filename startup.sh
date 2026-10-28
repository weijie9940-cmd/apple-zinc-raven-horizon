#!/bin/sh
set -eu
cd "$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
app_port="${APP_PORT:-8080}"
case "$(uname -s)" in
  MINGW*|MSYS*)
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File ./startup.ps1 -Port "$app_port"
    exit $?
    ;;
esac
if curl -sf --max-time 2 "http://127.0.0.1:$app_port/" | grep -q 'MARBLE ATELIER'; then
  exit 0
fi
mkdir -p .grok
nohup npm run dev -- --port "$app_port" >>.grok/dev-server.log 2>&1 </dev/null &
