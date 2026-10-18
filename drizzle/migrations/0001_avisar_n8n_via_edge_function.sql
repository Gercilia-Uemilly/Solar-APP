CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.avisar_n8n_oficio_revisado()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  BEGIN
    PERFORM net.http_post(
      url := 'https://ipsmcagnhrtnhuekzcny.supabase.co/functions/v1/avisar-oficio-revisado',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object('oficio_id', NEW.id)
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN NEW;
END;
$function$;