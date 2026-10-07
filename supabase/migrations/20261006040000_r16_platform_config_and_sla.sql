-- ==============================================================================
-- AÇAÍFOOD — R16 (parte 2): configurações da plataforma e disponibilidade mensal
-- Timestamp: 20261006040000
--
--  1. public.platform_config (key, value jsonb): taxa/cota de ativação e
--     configuração do suporte, que ficavam em JSON dentro de
--     platform_settings.asaas_platform_wallet_id. Copia os valores existentes.
--  2. public.monthly_sla: disponibilidade mensal medida por monitor externo
--     (relatório mensal, cl. 11 do contrato BaaS).
--  Ambas só para service_role (o app acessa pelas rotas de servidor).
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.platform_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.platform_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_config FROM anon, authenticated;
GRANT ALL ON public.platform_config TO service_role;

-- Copia o JSON antigo (se houver)
DO $$
DECLARE
  v_raw TEXT;
  v_json JSONB;
BEGIN
  SELECT asaas_platform_wallet_id INTO v_raw
  FROM public.platform_settings
  WHERE asaas_platform_wallet_id IS NOT NULL
  LIMIT 1;

  IF v_raw IS NOT NULL AND left(trim(v_raw), 1) = '{' THEN
    BEGIN
      v_json := v_raw::jsonb;
    EXCEPTION WHEN OTHERS THEN
      v_json := NULL;
    END;

    IF v_json IS NOT NULL THEN
      INSERT INTO public.platform_config (key, value)
      VALUES ('activation', jsonb_strip_nulls(jsonb_build_object(
        'activationFee', v_json->'activationFee',
        'freeQuota', v_json->'freeQuota'
      )))
      ON CONFLICT (key) DO NOTHING;

      IF v_json ? 'support_config' THEN
        INSERT INTO public.platform_config (key, value)
        VALUES ('support', v_json->'support_config')
        ON CONFLICT (key) DO NOTHING;
      END IF;
    END IF;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.monthly_sla (
  month TEXT PRIMARY KEY CHECK (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  uptime_percent NUMERIC(6,3) NOT NULL CHECK (uptime_percent >= 0 AND uptime_percent <= 100),
  source TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.monthly_sla ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.monthly_sla FROM anon, authenticated;
GRANT ALL ON public.monthly_sla TO service_role;

NOTIFY pgrst, 'reload schema';
