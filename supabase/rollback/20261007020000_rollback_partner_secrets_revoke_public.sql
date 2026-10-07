-- Reversão de 20261007020000 (não recomendada: devolve os GRANTs padrão; o RLS continua ligado).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_secrets TO authenticated;
NOTIFY pgrst, 'reload schema';
