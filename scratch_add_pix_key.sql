-- Executar este SQL no SQL Editor do Supabase para adicionar a coluna pix_key aos usuários existentes.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS pix_key TEXT;
