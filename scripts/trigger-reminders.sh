#!/bin/sh
# Triggers the scheduled-call-reminders endpoint.
#
# Runs as a Railway Cron Job every 5 minutes.
#
# Uses Node's built-in fetch (Node 18+) instead of curl, because the nixpacks
# Node runtime image does not ship curl and adding it via nixPkgs did not
# survive into the runtime image. Node is guaranteed to be available since
# this is a Node service.
#
# Railway setup (one-time, in the Railway dashboard):
#   1. In the project that hosts the app, create a new service from this repo.
#   2. Either:
#      a) Set Config-as-code Railway Config File to `railway.cron.json`, OR
#      b) Set Start Command to `sh scripts/trigger-reminders.sh`
#         and add a Cron Schedule of `*/5 * * * *`, Restart Policy = Never.
#   3. Set the service to deploy from the `dev-team` branch.
#   4. Env vars on the cron service:
#        APP_BASE_URL           = https://<your prod host>
#        INTERNAL_API_SECRET    = same value as the main app service
#   5. Turn Public Networking off.
set -e

echo "[trigger-reminders] $(date -u +%FT%TZ) firing"

exec node scripts/trigger-reminders.mjs
