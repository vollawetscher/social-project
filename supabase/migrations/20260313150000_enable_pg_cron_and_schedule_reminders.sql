-- Enable extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove any existing job with the same name to avoid duplicates
SELECT cron.unschedule('trigger-scheduled-call-reminders') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'trigger-scheduled-call-reminders'
);

-- Schedule the reminder endpoint to be called every 5 minutes
SELECT cron.schedule(
  'trigger-scheduled-call-reminders',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://social-project.up.railway.app/api/internal/scheduled-call-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', '06467425581018475547805752638908'
    ),
    body := '{}'::jsonb
  );
  $$
);
