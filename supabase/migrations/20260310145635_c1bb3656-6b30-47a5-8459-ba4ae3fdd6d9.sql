ALTER TABLE public.oficios 
ADD COLUMN IF NOT EXISTS uploaded_by_name text,
ADD COLUMN IF NOT EXISTS uploaded_by_email text,
ADD COLUMN IF NOT EXISTS uploaded_at timestamptz;