#!/bin/sh
# Triggers the scheduled-call-reminders endpoint.
# Runs as a Railway Cron Job every 5 minutes.
set -e

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
