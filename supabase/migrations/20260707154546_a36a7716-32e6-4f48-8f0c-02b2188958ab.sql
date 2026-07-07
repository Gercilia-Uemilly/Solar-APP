
-- 1. Add x-internal-secret header to the auto-generate trigger and restrict RLS by approval

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
        'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlwc21jYWduaHJ0bmh1ZWt6Y255Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1OTU4ODMsImV4cCI6MjA4NzE3MTg4M30.mmKjub3b856PrtXZ7OJwy5AM5cs5EhIJOHaLppn_SCk',
        'x-internal-secret', 'Ley2QHAZWcS9o5Q4U0-aLlNS7Pb0FlUYm757IPbfdjqs5Aos-jMEs8yVOqP7lYXh'
      ),
      body := jsonb_build_object('oficio_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$function$;

-- 2. base_conhecimento: require approval
DROP POLICY IF EXISTS "Authenticated users read base_conhecimento" ON public.base_conhecimento;
DROP POLICY IF EXISTS "Authenticated users insert base_conhecimento" ON public.base_conhecimento;
DROP POLICY IF EXISTS "Authenticated users update base_conhecimento" ON public.base_conhecimento;
DROP POLICY IF EXISTS "Authenticated users delete base_conhecimento" ON public.base_conhecimento;

CREATE POLICY "Approved users read base_conhecimento" ON public.base_conhecimento
  FOR SELECT TO authenticated
  USING (is_user_approved(auth.uid()) OR is_admin(auth.uid()));
CREATE POLICY "Approved users insert base_conhecimento" ON public.base_conhecimento
  FOR INSERT TO authenticated
  WITH CHECK (is_user_approved(auth.uid()) OR is_admin(auth.uid()));
CREATE POLICY "Approved users update base_conhecimento" ON public.base_conhecimento
  FOR UPDATE TO authenticated
  USING (is_user_approved(auth.uid()) OR is_admin(auth.uid()));
CREATE POLICY "Approved users delete base_conhecimento" ON public.base_conhecimento
  FOR DELETE TO authenticated
  USING (is_user_approved(auth.uid()) OR is_admin(auth.uid()));

-- 3. oficio_anexos: require approval
DROP POLICY IF EXISTS "Authenticated users read anexos" ON public.oficio_anexos;
DROP POLICY IF EXISTS "Authenticated users insert anexos" ON public.oficio_anexos;
DROP POLICY IF EXISTS "Authenticated users delete anexos" ON public.oficio_anexos;

CREATE POLICY "Approved users read anexos" ON public.oficio_anexos
  FOR SELECT TO authenticated
  USING (is_user_approved(auth.uid()) OR is_admin(auth.uid()));
CREATE POLICY "Approved users insert anexos" ON public.oficio_anexos
  FOR INSERT TO authenticated
  WITH CHECK (is_user_approved(auth.uid()) OR is_admin(auth.uid()));
CREATE POLICY "Approved users delete anexos" ON public.oficio_anexos
  FOR DELETE TO authenticated
  USING (is_user_approved(auth.uid()) OR is_admin(auth.uid()));

-- 4. oficios: require approval on SELECT
DROP POLICY IF EXISTS "Authenticated users read all oficios" ON public.oficios;
CREATE POLICY "Approved users read all oficios" ON public.oficios
  FOR SELECT TO authenticated
  USING (is_user_approved(auth.uid()) OR is_admin(auth.uid()));

-- 5. scripts: require approval on SELECT
DROP POLICY IF EXISTS "Users read all scripts" ON public.scripts;
CREATE POLICY "Approved users read all scripts" ON public.scripts
  FOR SELECT TO authenticated
  USING (is_user_approved(auth.uid()) OR is_admin(auth.uid()));

-- 6. atendimentos: require approval on SELECT
DROP POLICY IF EXISTS "Authenticated users read all atendimentos" ON public.atendimentos;
CREATE POLICY "Approved users read all atendimentos" ON public.atendimentos
  FOR SELECT TO authenticated
  USING (is_user_approved(auth.uid()) OR is_admin(auth.uid()));

-- 7. whatsapp_conversations: require approval
DROP POLICY IF EXISTS "Authenticated users manage conversations" ON public.whatsapp_conversations;
DROP POLICY IF EXISTS "Authenticated users read conversations" ON public.whatsapp_conversations;

CREATE POLICY "Approved users read conversations" ON public.whatsapp_conversations
  FOR SELECT TO authenticated
  USING (is_user_approved(auth.uid()) OR is_admin(auth.uid()));
CREATE POLICY "Approved users manage conversations" ON public.whatsapp_conversations
  FOR ALL TO authenticated
  USING (is_user_approved(auth.uid()) OR is_admin(auth.uid()))
  WITH CHECK (is_user_approved(auth.uid()) OR is_admin(auth.uid()));

-- 8. whatsapp_messages: require approval
DROP POLICY IF EXISTS "Authenticated users read messages" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Authenticated users insert messages" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Authenticated users update messages" ON public.whatsapp_messages;

CREATE POLICY "Approved users read messages" ON public.whatsapp_messages
  FOR SELECT TO authenticated
  USING (is_user_approved(auth.uid()) OR is_admin(auth.uid()));
CREATE POLICY "Approved users insert messages" ON public.whatsapp_messages
  FOR INSERT TO authenticated
  WITH CHECK (is_user_approved(auth.uid()) OR is_admin(auth.uid()));
CREATE POLICY "Approved users update messages" ON public.whatsapp_messages
  FOR UPDATE TO authenticated
  USING (is_user_approved(auth.uid()) OR is_admin(auth.uid()));

-- 9. storage midias: restrict shared 'oficios' folder to approved users
DROP POLICY IF EXISTS "Users upload midias" ON storage.objects;
CREATE POLICY "Users upload midias" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'midias'
    AND (
      (
        (storage.foldername(name))[1] = 'oficios'
        AND (is_user_approved(auth.uid()) OR is_admin(auth.uid()))
      )
      OR (auth.uid())::text = (storage.foldername(name))[1]
    )
  );
