CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.avisar_n8n_oficio_revisado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $function$
DECLARE
  v_secret text;
BEGIN
  SELECT value INTO v_secret
  FROM private.cron_config
  WHERE key = 'bot_secret'
  LIMIT 1;

  IF v_secret IS NULL OR v_secret = '' THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := 'https://n8n.solardigital.site/webhook/oficio-revisado-6f7a5cbbfc50',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-bot-secret', v_secret),
    body := jsonb_build_object('oficio_id', NEW.id, 'status', NEW.status)
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_avisar_n8n_oficio_revisado ON public.oficios;

CREATE TRIGGER trg_avisar_n8n_oficio_revisado
AFTER UPDATE ON public.oficios
FOR EACH ROW
WHEN (NEW.status = 'Salvo no Drive' AND (OLD.status IS DISTINCT FROM NEW.status OR OLD.uploaded_at IS DISTINCT FROM NEW.uploaded_at))
EXECUTE FUNCTION public.avisar_n8n_oficio_revisado();