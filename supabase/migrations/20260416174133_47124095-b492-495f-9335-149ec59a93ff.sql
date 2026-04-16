
-- Enable extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove any existing job with same name
DO $$
BEGIN
  PERFORM cron.unschedule('fetch-sos-uberlandia-4h');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Schedule SOS Uberlândia auto-import every 4 hours
SELECT cron.schedule(
  'fetch-sos-uberlandia-4h',
  '0 */4 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ipsmcagnhrtnhuekzcny.supabase.co/functions/v1/fetch-sos-uberlandia',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlwc21jYWduaHJ0bmh1ZWt6Y255Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1OTU4ODMsImV4cCI6MjA4NzE3MTg4M30.mmKjub3b856PrtXZ7OJwy5AM5cs5EhIJOHaLppn_SCk'
    ),
    body := jsonb_build_object('pages', 10)
  );
  $$
);
