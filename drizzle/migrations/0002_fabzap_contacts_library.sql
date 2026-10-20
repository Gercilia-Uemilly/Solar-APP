CREATE TABLE public.contacts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), nome text,
 telefone_e164 text UNIQUE CHECK (telefone_e164 ~ '^\+[1-9][0-9]{7,14}$'), wa_lid text UNIQUE,
 codigo_jr text UNIQUE CHECK (codigo_jr ~ '^JR[0-9]{5,}$'), conferir_nono_digito boolean NOT NULL DEFAULT false,
 empresa text, bairro text, origem text NOT NULL DEFAULT 'manual' CHECK (origem IN ('whatsapp','manual','csv','bot')),
 status_atendimento text NOT NULL DEFAULT 'novo' CHECK (status_atendimento IN ('novo','em_atendimento','aguardando_retorno','concluido')),
 responsavel_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL, observacoes text,
 ultima_msg_recebida_em timestamptz, ultima_resposta_em timestamptz, arquivado_em timestamptz,
 created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT contacts_tem_identificador CHECK (telefone_e164 IS NOT NULL OR wa_lid IS NOT NULL)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.contacts TO authenticated;
GRANT ALL ON TABLE public.contacts TO service_role;
CREATE INDEX contacts_nome_trgm ON public.contacts USING gin (nome gin_trgm_ops);
CREATE INDEX contacts_status_idx ON public.contacts(status_atendimento);
CREATE INDEX contacts_responsavel_idx ON public.contacts(responsavel_id);
CREATE INDEX contacts_updated_idx ON public.contacts(updated_at DESC);
CREATE INDEX contacts_esperando_idx ON public.contacts(ultima_msg_recebida_em DESC) WHERE arquivado_em IS NULL;
CREATE TRIGGER contacts_updated_at BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TABLE public.contact_tags (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), nome text NOT NULL, cor text,
 created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.contact_tags TO authenticated;
GRANT ALL ON TABLE public.contact_tags TO service_role;
CREATE UNIQUE INDEX contact_tags_nome_unico ON public.contact_tags(lower(nome));
CREATE TABLE public.contact_tag_assignments (
 contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
 tag_id uuid NOT NULL REFERENCES public.contact_tags(id) ON DELETE CASCADE,
 created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(contact_id,tag_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.contact_tag_assignments TO authenticated;
GRANT ALL ON TABLE public.contact_tag_assignments TO service_role;
CREATE INDEX contact_tag_assignments_tag_idx ON public.contact_tag_assignments(tag_id);
CREATE TABLE public.contact_history (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
 tipo text NOT NULL CHECK (tipo IN ('cadastro','status','nota','oficio','aviso_junior','importacao')),
 descricao text NOT NULL, dados jsonb, oficio_id uuid REFERENCES public.oficios(id) ON DELETE SET NULL,
 user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON TABLE public.contact_history TO authenticated;
GRANT ALL ON TABLE public.contact_history TO service_role;
CREATE INDEX contact_history_contact_idx ON public.contact_history(contact_id,created_at DESC);
CREATE TABLE public.import_jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tipo text NOT NULL CHECK (tipo IN ('contatos','scripts')),
 arquivo_nome text, status text NOT NULL DEFAULT 'em_andamento' CHECK (status IN ('em_andamento','concluido','cancelado','erro')),
 total_linhas integer NOT NULL DEFAULT 0, novos integer NOT NULL DEFAULT 0, atualizados integer NOT NULL DEFAULT 0,
 ignorados integer NOT NULL DEFAULT 0, duplicados integer NOT NULL DEFAULT 0, invalidos integer NOT NULL DEFAULT 0,
 user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz
);
GRANT SELECT, INSERT, UPDATE ON TABLE public.import_jobs TO authenticated;
GRANT ALL ON TABLE public.import_jobs TO service_role;
CREATE TABLE public.import_job_errors (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), job_id uuid NOT NULL REFERENCES public.import_jobs(id) ON DELETE CASCADE,
 linha integer, valor text, motivo text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON TABLE public.import_job_errors TO authenticated;
GRANT ALL ON TABLE public.import_job_errors TO service_role;
CREATE INDEX import_job_errors_job_idx ON public.import_job_errors(job_id);
CREATE OR REPLACE FUNCTION public.contacts_registrar_historico()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF TG_OP = 'INSERT' THEN
  INSERT INTO public.contact_history(contact_id,tipo,descricao,user_id)
  VALUES(NEW.id,'cadastro','Contato cadastrado (origem: ' || NEW.origem || ')',auth.uid());
 ELSIF NEW.status_atendimento IS DISTINCT FROM OLD.status_atendimento THEN
  INSERT INTO public.contact_history(contact_id,tipo,descricao,dados,user_id)
  VALUES(NEW.id,'status','Status: ' || OLD.status_atendimento || ' → ' || NEW.status_atendimento,
   jsonb_build_object('de',OLD.status_atendimento,'para',NEW.status_atendimento),auth.uid());
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER contacts_historico AFTER INSERT OR UPDATE OF status_atendimento ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.contacts_registrar_historico();
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_tag_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_job_errors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved users read contacts" ON public.contacts FOR SELECT TO authenticated USING(is_user_approved(auth.uid()) OR is_admin(auth.uid()));
CREATE POLICY "Approved users insert contacts" ON public.contacts FOR INSERT TO authenticated WITH CHECK(is_user_approved(auth.uid()) OR is_admin(auth.uid()));
CREATE POLICY "Approved users update contacts" ON public.contacts FOR UPDATE TO authenticated USING(is_user_approved(auth.uid()) OR is_admin(auth.uid())) WITH CHECK(is_user_approved(auth.uid()) OR is_admin(auth.uid()));
CREATE POLICY "Admin or creator delete contacts" ON public.contacts FOR DELETE TO authenticated USING(is_admin(auth.uid()) OR created_by=auth.uid());
CREATE POLICY "Approved users read tags" ON public.contact_tags FOR SELECT TO authenticated USING(is_user_approved(auth.uid()) OR is_admin(auth.uid()));
CREATE POLICY "Approved users insert tags" ON public.contact_tags FOR INSERT TO authenticated WITH CHECK(is_user_approved(auth.uid()) OR is_admin(auth.uid()));
CREATE POLICY "Approved users update tags" ON public.contact_tags FOR UPDATE TO authenticated USING(is_user_approved(auth.uid()) OR is_admin(auth.uid())) WITH CHECK(is_user_approved(auth.uid()) OR is_admin(auth.uid()));
CREATE POLICY "Admin delete tags" ON public.contact_tags FOR DELETE TO authenticated USING(is_admin(auth.uid()));
CREATE POLICY "Approved users manage tag assignments" ON public.contact_tag_assignments FOR ALL TO authenticated USING(is_user_approved(auth.uid()) OR is_admin(auth.uid())) WITH CHECK(is_user_approved(auth.uid()) OR is_admin(auth.uid()));
CREATE POLICY "Approved users read history" ON public.contact_history FOR SELECT TO authenticated USING(is_user_approved(auth.uid()) OR is_admin(auth.uid()));
CREATE POLICY "Approved users add own history" ON public.contact_history FOR INSERT TO authenticated WITH CHECK((is_user_approved(auth.uid()) OR is_admin(auth.uid())) AND user_id=auth.uid());
CREATE POLICY "Admin delete history" ON public.contact_history FOR DELETE TO authenticated USING(is_admin(auth.uid()));
CREATE POLICY "Approved users read import jobs" ON public.import_jobs FOR SELECT TO authenticated USING(is_user_approved(auth.uid()) OR is_admin(auth.uid()));
CREATE POLICY "Approved users create own import jobs" ON public.import_jobs FOR INSERT TO authenticated WITH CHECK((is_user_approved(auth.uid()) OR is_admin(auth.uid())) AND user_id=auth.uid());
CREATE POLICY "Owner updates import jobs" ON public.import_jobs FOR UPDATE TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
CREATE POLICY "Approved users read import errors" ON public.import_job_errors FOR SELECT TO authenticated USING(is_user_approved(auth.uid()) OR is_admin(auth.uid()));
CREATE POLICY "Job owner adds import errors" ON public.import_job_errors FOR INSERT TO authenticated WITH CHECK(EXISTS(SELECT 1 FROM public.import_jobs j WHERE j.id=job_id AND j.user_id=auth.uid()));
ALTER TABLE public.oficios ADD COLUMN IF NOT EXISTS contato_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS oficios_contato_idx ON public.oficios(contato_id);
ALTER TABLE public.scripts ADD COLUMN IF NOT EXISTS subcategoria text NOT NULL DEFAULT 'Geral';
ALTER TABLE public.scripts ADD COLUMN IF NOT EXISTS ordem integer NOT NULL DEFAULT 0;
ALTER TABLE public.scripts ADD COLUMN IF NOT EXISTS atalho text UNIQUE CHECK(atalho ~ '^/[a-z0-9_-]{2,30}$');
CREATE TABLE public.contact_reminders (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
 lembrar_em timestamptz NOT NULL, texto text NOT NULL, responsavel_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
 feito boolean NOT NULL DEFAULT false, feito_em timestamptz, avisado_em timestamptz,
 created_by uuid DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.contact_reminders TO authenticated;
GRANT ALL ON TABLE public.contact_reminders TO service_role;
CREATE INDEX contact_reminders_pendentes_idx ON public.contact_reminders(lembrar_em) WHERE NOT feito;
CREATE INDEX contact_reminders_contact_idx ON public.contact_reminders(contact_id);
ALTER TABLE public.contact_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved users read reminders" ON public.contact_reminders FOR SELECT TO authenticated USING(is_user_approved(auth.uid()) OR is_admin(auth.uid()));
CREATE POLICY "Approved users insert reminders" ON public.contact_reminders FOR INSERT TO authenticated WITH CHECK(is_user_approved(auth.uid()) OR is_admin(auth.uid()));
CREATE POLICY "Approved users update reminders" ON public.contact_reminders FOR UPDATE TO authenticated USING(is_user_approved(auth.uid()) OR is_admin(auth.uid())) WITH CHECK(is_user_approved(auth.uid()) OR is_admin(auth.uid()));
CREATE POLICY "Admin or creator delete reminders" ON public.contact_reminders FOR DELETE TO authenticated USING(is_admin(auth.uid()) OR created_by=auth.uid());
CREATE TABLE public.media_library (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), titulo text NOT NULL, pasta text NOT NULL DEFAULT 'Geral',
 tipo text NOT NULL CHECK(tipo IN ('imagem','pdf','contato')), storage_path text, mime_type text, tamanho_bytes integer,
 contato_nome text, contato_telefone text CHECK(contato_telefone IS NULL OR contato_telefone ~ '^\+[1-9][0-9]{7,14}$'),
 arquivado_em timestamptz, created_by uuid DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT media_library_conteudo CHECK(
 (tipo='contato' AND contato_nome IS NOT NULL AND contato_telefone IS NOT NULL)
 OR (tipo='imagem' AND storage_path IS NOT NULL AND (tamanho_bytes IS NULL OR tamanho_bytes<=5242880))
 OR (tipo='pdf' AND storage_path IS NOT NULL AND (tamanho_bytes IS NULL OR tamanho_bytes<=16777216)))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.media_library TO authenticated;
GRANT ALL ON TABLE public.media_library TO service_role;
CREATE INDEX media_library_pasta_idx ON public.media_library(pasta,titulo);
CREATE TRIGGER media_library_updated_at BEFORE UPDATE ON public.media_library FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
ALTER TABLE public.media_library ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved users read media" ON public.media_library FOR SELECT TO authenticated USING(is_user_approved(auth.uid()) OR is_admin(auth.uid()));
CREATE POLICY "Approved users insert media" ON public.media_library FOR INSERT TO authenticated WITH CHECK(is_user_approved(auth.uid()) OR is_admin(auth.uid()));
CREATE POLICY "Approved users update media" ON public.media_library FOR UPDATE TO authenticated USING(is_user_approved(auth.uid()) OR is_admin(auth.uid())) WITH CHECK(is_user_approved(auth.uid()) OR is_admin(auth.uid()));
CREATE POLICY "Admin delete media" ON public.media_library FOR DELETE TO authenticated USING(is_admin(auth.uid()));
CREATE POLICY "FabZap midia: aprovados leem" ON storage.objects FOR SELECT TO authenticated USING(bucket_id='fabzap-midia' AND (is_user_approved(auth.uid()) OR is_admin(auth.uid())));
CREATE POLICY "FabZap midia: aprovados enviam" ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='fabzap-midia' AND (is_user_approved(auth.uid()) OR is_admin(auth.uid())));
CREATE POLICY "FabZap midia: aprovados atualizam" ON storage.objects FOR UPDATE TO authenticated USING(bucket_id='fabzap-midia' AND (is_user_approved(auth.uid()) OR is_admin(auth.uid())));
CREATE POLICY "FabZap midia: admin apaga" ON storage.objects FOR DELETE TO authenticated USING(bucket_id='fabzap-midia' AND is_admin(auth.uid()));