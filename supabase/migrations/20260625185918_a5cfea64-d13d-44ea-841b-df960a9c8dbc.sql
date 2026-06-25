GRANT SELECT, INSERT, UPDATE, DELETE ON public.oficios TO authenticated;
GRANT ALL ON public.oficios TO service_role;
GRANT INSERT ON public.oficios TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.oficio_respostas TO authenticated;
GRANT ALL ON public.oficio_respostas TO service_role;

GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;