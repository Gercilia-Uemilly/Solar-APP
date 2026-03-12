ALTER TABLE public.oficio_anexos
ADD CONSTRAINT oficio_anexos_oficio_id_fkey
FOREIGN KEY (oficio_id) REFERENCES public.oficios(id) ON DELETE CASCADE;