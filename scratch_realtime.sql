-- Adiciona as tabelas ao sistema de Realtime do Supabase para que o Painel Admin possa recebê-las ao vivo sem precisar recarregar a página.

ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
ALTER PUBLICATION supabase_realtime ADD TABLE public.storefronts;
