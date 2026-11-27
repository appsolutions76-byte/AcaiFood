-- ==============================================================================
-- AÇAÍFOOD R57 — Migrar anúncios de asaas_platform_wallet_id → platform_config
-- Timestamp: 20261126010000
--
-- O campo asaas_platform_wallet_id era usado como JSON blob genérico para guardar
-- anúncios (chave "ads"). A tabela platform_config (criada em R16) é o lugar correto.
-- Esta migration:
--   1. Copia o array de anúncios existente para platform_config com key='ads'
--   2. NÃO apaga asaas_platform_wallet_id (preserva dados; limpeza futura separada)
-- ==============================================================================

DO $$
DECLARE
  v_raw  TEXT;
  v_json JSONB;
  v_ads  JSONB;
BEGIN
  -- Lê o JSON atual do campo legado
  SELECT asaas_platform_wallet_id INTO v_raw
  FROM public.platform_settings
  WHERE asaas_platform_wallet_id IS NOT NULL
    AND asaas_platform_wallet_id <> ''
  LIMIT 1;

  IF v_raw IS NULL THEN
    RAISE NOTICE 'asaas_platform_wallet_id vazio ou nulo — nada a migrar.';
    RETURN;
  END IF;

  -- Tenta parsear como JSON
  BEGIN
    v_json := v_raw::jsonb;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Conteúdo de asaas_platform_wallet_id não é JSON válido — nada a migrar.';
    RETURN;
  END;

  -- Extrai o array de anúncios
  v_ads := v_json -> 'ads';

  IF v_ads IS NULL OR jsonb_typeof(v_ads) <> 'array' THEN
    RAISE NOTICE 'Chave "ads" ausente ou não é array — nada a migrar.';
    RETURN;
  END IF;

  IF jsonb_array_length(v_ads) = 0 THEN
    RAISE NOTICE 'Array de anúncios vazio — nada a migrar.';
    RETURN;
  END IF;

  -- Insere (ou substitui) em platform_config com key='ads'
  INSERT INTO public.platform_config (key, value, updated_at)
  VALUES ('ads', v_ads, NOW())
  ON CONFLICT (key) DO UPDATE
    SET value      = EXCLUDED.value,
        updated_at = NOW();

  RAISE NOTICE 'Migrados % anúncios para platform_config.', jsonb_array_length(v_ads);
END $$;

NOTIFY pgrst, 'reload schema';
