-- Migration: 20260924020000_add_pix_key_type_to_users.sql
-- Description: Hotfix R9 Item 4 - Add pix_key_type to users and ensure withdrawal_requests status constraint

-- 1. Adicionar coluna pix_key_type na tabela users
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS pix_key_type text;

-- 2. Garantir constraint de status em withdrawal_requests com suporte a PROCESSING
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'withdrawal_requests_status_check'
  ) THEN
    ALTER TABLE public.withdrawal_requests
      DROP CONSTRAINT withdrawal_requests_status_check;
  END IF;

  ALTER TABLE public.withdrawal_requests
    ADD CONSTRAINT withdrawal_requests_status_check
    CHECK (status IN ('PENDENTE', 'APROVADO', 'PROCESSING', 'REJEITADO', 'PAGO', 'FALHOU'));
END $$;
