-- ============================================================================
-- Migration: 20261006020000_r15_users_privacy.sql
-- Descrição: Isolamento de segredos de parceiros (partner_secrets) e RLS de usuários
-- ============================================================================

-- 1. Criar tabela partner_secrets acessível apenas por service_role
CREATE TABLE IF NOT EXISTS public.partner_secrets (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  asaas_account_api_key TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.partner_secrets ENABLE ROW LEVEL SECURITY;

-- 2. Copiar chaves existentes para partner_secrets
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'asaas_account_api_key'
  ) THEN
    INSERT INTO public.partner_secrets (user_id, asaas_account_api_key)
    SELECT id, asaas_account_api_key
    FROM public.users
    WHERE asaas_account_api_key IS NOT NULL AND asaas_account_api_key <> ''
    ON CONFLICT (user_id) DO UPDATE SET asaas_account_api_key = EXCLUDED.asaas_account_api_key;

    ALTER TABLE public.users DROP COLUMN IF EXISTS asaas_account_api_key;
  END IF;
END $$;

-- 3. Função RPC segura para o próprio usuário ler seu perfil completo
CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS TABLE (
  id UUID,
  name TEXT,
  email TEXT,
  phone TEXT,
  cpf_cnpj TEXT,
  role TEXT,
  bairro TEXT,
  cidade TEXT,
  status TEXT,
  split_enabled BOOLEAN,
  asaas_account_id TEXT,
  asaas_wallet_id TEXT,
  asaas_account_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.name,
    u.email,
    u.phone,
    u.cpf_cnpj,
    u.role,
    u.bairro,
    u.cidade,
    u.status,
    u.split_enabled,
    u.asaas_account_id,
    u.asaas_wallet_id,
    u.asaas_account_status
  FROM public.users u
  WHERE u.id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;
