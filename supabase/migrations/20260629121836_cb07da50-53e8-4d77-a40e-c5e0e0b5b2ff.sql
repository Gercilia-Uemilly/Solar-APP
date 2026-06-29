ALTER TABLE public.oficio_respostas REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.oficio_respostas;