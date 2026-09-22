-- Migration: Permitir status PROCESSING na constraint de withdrawal_requests
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
    CHECK (status IN ('PENDENTE','APROVADO','PROCESSING','REJEITADO','PAGO','FALHOU'));
END $$;
