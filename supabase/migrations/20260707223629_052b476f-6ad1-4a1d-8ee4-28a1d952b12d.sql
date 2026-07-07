CREATE OR REPLACE FUNCTION public.trigger_auto_generate_oficio_whatsapp()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF LOWER(COALESCE(NEW.origem, '')) IN ('whatsapp_bot', 'whatsapp')
     AND COALESCE(NEW.ia_gerada, false) = false
     AND NEW.deleted_at IS NULL
  THEN
    PERFORM net.http_post(
      url := 'https://ipsmcagnhrtnhuekzcny.supabase.co/functions/v1/auto-generate-oficio-whatsapp',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlwc21jYWduaHJ0bmh1ZWt6Y255Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1OTU4ODMsImV4cCI6MjA4NzE3MTg4M30.mmKjub3b856PrtXZ7OJwy5AM5cs5EhIJOHaLppn_SCk',
        'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlwc21jYWduaHJ0bmh1ZWt6Y255Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1OTU4ODMsImV4cCI6MjA4NzE3MTg4M30.mmKjub3b856PrtXZ7OJwy5AM5cs5EhIJOHaLppn_SCk',
        'x-internal-secret', 'Ley2QHAZWcS9o5Q4U0-aLlNS7Pb0FlUYm757IPbfdjqs5Aos-jMEs8yVOqP7lYXh'
      ),
      body := jsonb_build_object('oficio_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$function$;