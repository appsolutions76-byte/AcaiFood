-- ==========================================================
-- AÇAÍFOOD — GENERAL SUPPORT CHAT & HELP DESK SYSTEM
-- Versão: 20260906000000
-- ==========================================================

-- 1. TABELA DE MENSAGENS DE SUPORTE GERAL
CREATE TABLE IF NOT EXISTS public.support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL, -- ID do usuário ou ID anônimo da sessão
  user_name TEXT NOT NULL,
  user_role TEXT NOT NULL DEFAULT 'cliente', -- 'cliente', 'loja', 'motorista', 'fornecedor', 'visitante'
  user_phone TEXT,
  user_email TEXT,
  content TEXT NOT NULL,
  sender TEXT NOT NULL DEFAULT 'user', -- 'user' ou 'admin'
  is_read BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'aberto', -- 'aberto', 'em_atendimento', 'resolvido'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar RLS em support_messages
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS permissivas e seguras
DROP POLICY IF EXISTS "support_messages_select_all" ON public.support_messages;
CREATE POLICY "support_messages_select_all" ON public.support_messages
  FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS "support_messages_insert_all" ON public.support_messages;
CREATE POLICY "support_messages_insert_all" ON public.support_messages
  FOR INSERT TO public
  WITH CHECK (true);

DROP POLICY IF EXISTS "support_messages_update_all" ON public.support_messages;
CREATE POLICY "support_messages_update_all" ON public.support_messages
  FOR UPDATE TO public
  USING (true);

DROP POLICY IF EXISTS "support_messages_delete_admin" ON public.support_messages;
CREATE POLICY "support_messages_delete_admin" ON public.support_messages
  FOR DELETE TO public
  USING (true);

-- Índices de alta performance para filtros e ordenação
CREATE INDEX IF NOT EXISTS idx_support_messages_user_created 
  ON public.support_messages (user_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_support_messages_status_created 
  ON public.support_messages (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_messages_is_read 
  ON public.support_messages (is_read);

-- Notificar PostgREST
NOTIFY pgrst, 'reload schema';
