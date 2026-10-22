-- FabZap: complemento da 0002 (22/10/2026). Só ACRESCENTA tabelas novas; não muda nada que já existe.
-- Pode rodar duas vezes (IF NOT EXISTS / DROP POLICY IF EXISTS). Regras de acesso iguais às da 0002:
-- usuário aprovado ou admin lê, cria e altera; apagar é só admin (menos onde está dito).

-- Fila do Júnior (prompt 10 E): o que precisa de gente. O n8n grava, a equipe resolve no Solar e na FabZap.
CREATE TABLE IF NOT EXISTS public.fz_fila (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  telefone_e164 text CHECK (telefone_e164 IS NULL OR telefone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  nome text,
  linha text,
  tipo text NOT NULL CHECK (tipo IN ('oficio_revisao', 'saude', 'reclamacao', 'nao_entendeu', 'status_cidadao', 'acompanhamento', 'silencio', 'retorno_prometido', 'conferir_cadastro', 'outro')),
  resumo text,
  oficio_id uuid REFERENCES public.oficios(id) ON DELETE SET NULL,
  chave text UNIQUE,
  criado_em timestamptz NOT NULL DEFAULT now(),
  resolvido_em timestamptz,
  resolvido_por uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS fz_fila_aberta_idx ON public.fz_fila (criado_em DESC) WHERE resolvido_em IS NULL;

-- Mensagem agendada pra UMA pessoa (8h às 20h): o n8n manda na linha do Júnior; nas outras, a FabZap aberta na linha.
CREATE TABLE IF NOT EXISTS public.fz_agendamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  linha text,
  numero_linha text,
  telefone_e164 text NOT NULL CHECK (telefone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  texto text NOT NULL,
  quando timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'agendado' CHECK (status IN ('agendado', 'enviado', 'cancelado', 'erro')),
  erro text,
  enviado_em timestamptz,
  created_by uuid DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fz_agendamentos_pendentes_idx ON public.fz_agendamentos (quando) WHERE status = 'agendado';

-- Pastas da equipe na barra de cima da FabZap (juntam etiquetas e conversas), compartilhadas entre os computadores.
CREATE TABLE IF NOT EXISTS public.fz_pastas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  ordem int NOT NULL DEFAULT 0,
  tag_ids uuid[] NOT NULL DEFAULT '{}',
  telefones text[] NOT NULL DEFAULT '{}',
  created_by uuid DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Scripts em sequência: várias partes (texto, áudio do Fabão, mídia) com intervalo; o atendente dispara e acompanha.
CREATE TABLE IF NOT EXISTS public.fz_sequencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  pasta text NOT NULL DEFAULT 'Geral',
  atalho text UNIQUE CHECK (atalho IS NULL OR atalho ~ '^/[a-z0-9_-]{2,30}$'),
  arquivado_em timestamptz,
  created_by uuid DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.fz_sequencia_partes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequencia_id uuid NOT NULL REFERENCES public.fz_sequencias(id) ON DELETE CASCADE,
  ordem int NOT NULL DEFAULT 0,
  tipo text NOT NULL CHECK (tipo IN ('texto', 'audio', 'midia')),
  texto text,
  audio_id text,
  midia_id uuid REFERENCES public.media_library(id) ON DELETE SET NULL,
  intervalo_s int NOT NULL DEFAULT 3 CHECK (intervalo_s BETWEEN 1 AND 120)
);
CREATE INDEX IF NOT EXISTS fz_sequencia_partes_seq_idx ON public.fz_sequencia_partes (sequencia_id, ordem);

-- Papel de cada pessoa na FabZap (o admin continua sendo o admin do Solar)
CREATE TABLE IF NOT EXISTS public.fz_papeis (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  papel text NOT NULL CHECK (papel IN ('coordenacao', 'atendente')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.fz_fila, public.fz_agendamentos, public.fz_pastas, public.fz_sequencias, public.fz_sequencia_partes, public.fz_papeis TO authenticated;
GRANT ALL ON TABLE public.fz_fila, public.fz_agendamentos, public.fz_pastas, public.fz_sequencias, public.fz_sequencia_partes, public.fz_papeis TO service_role;

ALTER TABLE public.fz_fila ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fz_agendamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fz_pastas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fz_sequencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fz_sequencia_partes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fz_papeis ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['fz_fila', 'fz_agendamentos', 'fz_pastas', 'fz_sequencias', 'fz_sequencia_partes'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "FabZap: aprovados leem" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "FabZap: aprovados criam" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "FabZap: aprovados alteram" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "FabZap: apagar" ON public.%I', t);
    EXECUTE format('CREATE POLICY "FabZap: aprovados leem" ON public.%I FOR SELECT TO authenticated USING (public.is_user_approved(auth.uid()) OR public.is_admin(auth.uid()))', t);
    EXECUTE format('CREATE POLICY "FabZap: aprovados criam" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_user_approved(auth.uid()) OR public.is_admin(auth.uid()))', t);
    EXECUTE format('CREATE POLICY "FabZap: aprovados alteram" ON public.%I FOR UPDATE TO authenticated USING (public.is_user_approved(auth.uid()) OR public.is_admin(auth.uid())) WITH CHECK (public.is_user_approved(auth.uid()) OR public.is_admin(auth.uid()))', t);
  END LOOP;
END $$;
-- apagar: admin em tudo; quem criou também apaga a própria pasta e sequência
CREATE POLICY "FabZap: apagar" ON public.fz_fila FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "FabZap: apagar" ON public.fz_agendamentos FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "FabZap: apagar" ON public.fz_pastas FOR DELETE TO authenticated USING (public.is_admin(auth.uid()) OR created_by = auth.uid());
CREATE POLICY "FabZap: apagar" ON public.fz_sequencias FOR DELETE TO authenticated USING (public.is_admin(auth.uid()) OR created_by = auth.uid());
CREATE POLICY "FabZap: apagar" ON public.fz_sequencia_partes FOR DELETE TO authenticated USING (public.is_user_approved(auth.uid()) OR public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "FabZap papeis: aprovados leem" ON public.fz_papeis;
DROP POLICY IF EXISTS "FabZap papeis: admin define" ON public.fz_papeis;
CREATE POLICY "FabZap papeis: aprovados leem" ON public.fz_papeis FOR SELECT TO authenticated USING (public.is_user_approved(auth.uid()) OR public.is_admin(auth.uid()));
CREATE POLICY "FabZap papeis: admin define" ON public.fz_papeis FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- Conferência: 6 linhas, todas com rls = true; fz_papeis com 2 regras, as outras com 4
SELECT c.relname AS tabela, c.relrowsecurity AS rls, (SELECT count(*) FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = c.relname) AS regras
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN ('fz_fila', 'fz_agendamentos', 'fz_pastas', 'fz_sequencias', 'fz_sequencia_partes', 'fz_papeis') ORDER BY 1;
