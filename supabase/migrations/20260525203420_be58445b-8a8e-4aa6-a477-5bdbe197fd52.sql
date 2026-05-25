CREATE OR REPLACE FUNCTION public.trigger_auto_generate_oficio_whatsapp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.origem = 'whatsapp_bot'
     AND COALESCE(NEW.ia_gerada, false) = false
     AND NEW.deleted_at IS NULL
  THEN
    PERFORM net.http_post(
      url := 'https://ipsmcagnhrtnhuekzcny.supabase.co/functions/v1/auto-generate-oficio-whatsapp',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlwc21jYWduaHJ0bmh1ZWt6Y255Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1OTU4ODMsImV4cCI6MjA4NzE3MTg4M30.mmKjub3b856PrtXZ7OJwy5AM5cs5EhIJOHaLppn_SCk',
        'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlwc21jYWduaHJ0bmh1ZWt6Y255Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1OTU4ODMsImV4cCI6MjA4NzE3MTg4M30.mmKjub3b856PrtXZ7OJwy5AM5cs5EhIJOHaLppn_SCk'
      ),
      body := jsonb_build_object('oficio_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_auto_generate_oficio_whatsapp ON public.oficios;
CREATE TRIGGER trg_auto_generate_oficio_whatsapp
AFTER INSERT ON public.oficios
FOR EACH ROW
EXECUTE FUNCTION public.trigger_auto_generate_oficio_whatsapp();