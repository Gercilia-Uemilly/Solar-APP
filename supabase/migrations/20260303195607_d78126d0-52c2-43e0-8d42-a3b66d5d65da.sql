
-- Add active column to profiles
ALTER TABLE public.profiles ADD COLUMN active boolean NOT NULL DEFAULT true;

-- Create a function to check if user is active (security definer to bypass RLS)
CREATE OR REPLACE FUNCTION public.is_user_active(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT active FROM public.profiles WHERE id = _user_id),
    false
  );
$$;
