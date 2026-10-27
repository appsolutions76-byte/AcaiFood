-- Reversão do R32: remove só a tabela de registro das validações
DROP TABLE IF EXISTS public.transfer_validation_log;
NOTIFY pgrst, 'reload schema';
