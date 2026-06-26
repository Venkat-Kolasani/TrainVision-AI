#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API="${VITE_API_BASE_URL:-http://localhost:8000}"

echo "== E2E smoke: $API =="
curl -sf "$API/health" | head -c 200
echo ""
curl -sf "$API/schedule" | python3 -c "import sys,json; d=json.load(sys.stdin); print('schedule legs', len(d.get('schedule',[])))"
curl -sf "$API/analytics/trends" | python3 -c "import sys,json; d=json.load(sys.stdin); print('trend points', len(d.get('points',[])))"
echo "OK"

cd "$ROOT/rail-frontend"
npm run test -- --run
