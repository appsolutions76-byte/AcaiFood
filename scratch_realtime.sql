-- Habilitar o sistema de Realtime para a tabela orders
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;

-- Garantir que a tabela orders envie os dados completos quando houver UPDATE/DELETE (necessário para Zustand ler os IDs)
ALTER TABLE public.orders REPLICA IDENTITY FULL;
