
-- Add phone lines to profiles for operators
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS telefone1 text,
ADD COLUMN IF NOT EXISTS telefone2 text,
ADD COLUMN IF NOT EXISTS telefone3 text;

-- Add operator tracking fields to oficios
ALTER TABLE public.oficios
ADD COLUMN IF NOT EXISTS linha_telefonica text,
ADD COLUMN IF NOT EXISTS operador_nome text;
