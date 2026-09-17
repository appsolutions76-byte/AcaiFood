-- Migration: Tabela withdrawal_requests e configurações de pagamento automático
CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.users(id),
  role text not null,
  requested_amount numeric(12,2) not null,
  order_ids uuid[] not null default '{}',
  status text not null default 'PENDENTE',
  requested_at timestamptz not null default now(),
  reviewed_by uuid references public.users(id),
  reviewed_at timestamptz,
  paid_at timestamptz,
  asaas_transfer_id text,
  pix_key_used text,
  wallet_id_used text,
  rejection_reason text,
  failure_reason text,
  processed_automatically boolean not null default false,
  created_at timestamptz not null default now()
);

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'withdrawal_requests_status_check'
  ) THEN
    ALTER TABLE public.withdrawal_requests
      ADD CONSTRAINT withdrawal_requests_status_check
      CHECK (status IN ('PENDENTE','APROVADO','REJEITADO','PAGO','FALHOU'));
  END IF;
END $$;

ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Partner reads own withdrawal requests" ON public.withdrawal_requests;
CREATE POLICY "Partner reads own withdrawal requests"
  ON public.withdrawal_requests FOR SELECT
  USING (partner_id = auth.uid() OR public.is_admin());

GRANT SELECT ON public.withdrawal_requests TO authenticated;
GRANT ALL ON public.withdrawal_requests TO service_role;

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS min_withdrawal_value numeric(12,2) NOT NULL DEFAULT 20.00,
  ADD COLUMN IF NOT EXISTS auto_payout_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_payout_time time NOT NULL DEFAULT '18:00',
  ADD COLUMN IF NOT EXISTS auto_payout_timezone text NOT NULL DEFAULT 'America/Belem',
  ADD COLUMN IF NOT EXISTS last_auto_payout_run_at timestamptz;

NOTIFY pgrst, 'reload schema';
