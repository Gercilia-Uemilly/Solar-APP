
-- 1. Remove prazo/cobrança columns from oficios
ALTER TABLE public.oficios DROP COLUMN IF EXISTS prazo_resposta;
ALTER TABLE public.oficios DROP COLUMN IF EXISTS status_resposta;
ALTER TABLE public.oficios DROP COLUMN IF EXISTS cobrado_em;
ALTER TABLE public.oficios DROP COLUMN IF EXISTS cobrado_por;

-- 2. Drop verificar_prazos function
DROP FUNCTION IF EXISTS public.verificar_prazos();

-- 3. Add 2FA columns to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS celular TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS celular_verificado BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS usa_2fa BOOLEAN DEFAULT false;
