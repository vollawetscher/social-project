#!/bin/sh
# Triggers the scheduled-call-reminders endpoint.
#
# Runs as a Railway Cron Job every 5 minutes.
#
# Railway setup (one-time, in the Railway dashboard):
#   1. In the project that hosts the app, create a new service from this same repo.
#   2. In the new service's Settings, set "Config-as-code File Path" to
#      `railway.cron.json`. That file declares the cron schedule and start command.
#   3. Set the service to deploy from the `dev-team` branch (same as the app).
#   4. Add these env vars on the cron service:
#        APP_BASE_URL           = https://<your prod host>   (no trailing slash needed)
#        INTERNAL_API_SECRET    = same value as the main app service
#   5. Trigger one run manually and verify HTTP 200 in the service logs.
set -e

echo "[trigger-reminders] $(date -u +%FT%TZ) firing"

if [ -z "$APP_BASE_URL" ]; then
  echo "ERROR: APP_BASE_URL is not set"
  exit 1
fi
if [ -z "$INTERNAL_API_SECRET" ]; then
  echo "ERROR: INTERNAL_API_SECRET is not set"
  exit 1
fi

response=$(curl -sS -w "\n%{http_code}" -X POST "${APP_BASE_URL%/}/api/internal/scheduled-call-reminders" \
  -H "Content-Type: application/json" \
  -H "x-internal-secret: $INTERNAL_API_SECRET" \
  -d '{}')

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n -1)

echo "$body"

if [ "$http_code" -lt 200 ] || [ "$http_code" -ge 300 ]; then
  echo "ERROR: endpoint returned HTTP $http_code"
  exit 1
fi
