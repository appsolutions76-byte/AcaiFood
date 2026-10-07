-- ==============================================================================
-- AÇAÍFOOD — R16: privacidade de users, status da subconta, radar e log de admin
-- Timestamp: 20261006030000
-- Base: docs/19_AUDITORIA_POS_R15_2026-10-06.md e docs/20 (R16)
--
-- APLICAR JUNTO com o deploy do app R16 (o app passa a ler o próprio perfil por
-- get_my_profile_json() e não pede mais colunas sensíveis de outros usuários).
--
--  1. users.asaas_account_status_detail (etapas do Asaas: commercialInfo,
--     bankAccountInfo, documentation, general).
--  2. users: SELECT por coluna. Usuário logado NÃO lê CPF/CNPJ, chave Pix, renda,
--     data de nascimento, e-mail etc. de outros usuários (LGPD; Anexo I, 6).
--     anon não lê nada de users.
--  3. get_my_profile_json(): o próprio usuário lê o seu perfil completo (sem segredos).
--  4. INSERT em users pelo app não pode nascer com subconta aprovada / split ligado.
--  5. admin_audit_log só aceita INSERT (Anexo I, 7).
--  6. Radar com coordenadas aproximadas a ~1 km (2 casas decimais).
-- ==============================================================================

-- 1. Detalhe do status da subconta ------------------------------------------------
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS asaas_account_status_detail JSONB;

-- Contas novas não nascem aprovadas (o padrão antigo era 'APPROVED')
ALTER TABLE public.users ALTER COLUMN asaas_account_status DROP DEFAULT;
ALTER TABLE public.users ALTER COLUMN split_enabled SET DEFAULT FALSE;

-- 2. SELECT por coluna em users ----------------------------------------------------
REVOKE SELECT ON public.users FROM anon, authenticated;

DO $$
DECLARE
  v_cols TEXT;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
  INTO v_cols
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'users'
    AND column_name NOT IN (
      'cpf_cnpj', 'pix_key', 'pix_key_type',
      'birth_date', 'monthly_income', 'company_type',
      'postal_code', 'address_number', 'province',
      'email',
      'asaas_account_id', 'asaas_account_status_detail', 'asaas_account_api_key',
      'activation_payment_id'
    );

  EXECUTE format('GRANT SELECT (%s) ON public.users TO authenticated', v_cols);
END $$;

-- 3. Perfil completo do próprio usuário --------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_profile_json()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (to_jsonb(u) - 'asaas_account_api_key')
         || jsonb_build_object(
              'storefronts',
              COALESCE((
                SELECT jsonb_agg(
                  to_jsonb(sf) || jsonb_build_object(
                    'products',
                    COALESCE((SELECT jsonb_agg(to_jsonb(p)) FROM public.products p WHERE p.storefront_id = sf.id), '[]'::jsonb)
                  )
                )
                FROM public.storefronts sf
                WHERE sf.partner_id = u.id
              ), '[]'::jsonb)
            )
  FROM public.users u
  WHERE u.id = auth.uid();
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_profile_json() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_profile_json() TO authenticated, service_role;

-- 4. INSERT/UPDATE pelo app não mexe em campos financeiros/KYC ----------------------
CREATE OR REPLACE FUNCTION public.protect_users_financial_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(auth.role(), 'anon') = 'service_role' OR COALESCE(public.is_admin(), false) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.asaas_account_id := NULL;
    NEW.asaas_wallet_id := NULL;
    NEW.asaas_account_status := NULL;
    NEW.split_enabled := FALSE;
    NEW.asaas_account_status_detail := NULL;
  ELSE
    NEW.asaas_account_id := OLD.asaas_account_id;
    NEW.asaas_wallet_id := OLD.asaas_wallet_id;
    NEW.asaas_account_status := OLD.asaas_account_status;
    NEW.split_enabled := OLD.split_enabled;
    NEW.asaas_account_status_detail := OLD.asaas_account_status_detail;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_users_financial_fields ON public.users;
CREATE TRIGGER trg_protect_users_financial_fields
BEFORE INSERT OR UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.protect_users_financial_fields();

-- 5. admin_audit_log append-only ---------------------------------------------------
REVOKE UPDATE, DELETE, TRUNCATE ON public.admin_audit_log FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_audit_log_append_only()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'admin_audit_log é somente inclusão (Anexo I, item 7)';
END;
$$;

DROP TRIGGER IF EXISTS trg_admin_audit_log_append_only ON public.admin_audit_log;
CREATE TRIGGER trg_admin_audit_log_append_only
BEFORE UPDATE OR DELETE ON public.admin_audit_log
FOR EACH ROW EXECUTE FUNCTION public.admin_audit_log_append_only();

-- 6. Radar: coordenadas aproximadas (~1 km) ----------------------------------------
CREATE OR REPLACE FUNCTION public.get_driver_radar()
RETURNS TABLE (
  id UUID,
  order_type TEXT,
  status TEXT,
  delivery_distance_km NUMERIC,
  driver_payout_amount NUMERIC,
  origin_name TEXT,
  origin_bairro TEXT,
  delivery_bairro TEXT,
  approx_lat NUMERIC,
  approx_lng NUMERIC,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF auth.uid() IS NULL AND COALESCE(auth.role(), 'anon') <> 'service_role' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    o.id,
    COALESCE(o.order_type, 'B2C')::text AS order_type,
    o.status::text,
    COALESCE(o.delivery_distance_km, 0)::numeric AS delivery_distance_km,
    COALESCE(o.driver_payout_amount, 0)::numeric AS driver_payout_amount,
    COALESCE(sf.store_name, u_seller.name, 'Loja / Batedeira')::text AS origin_name,
    COALESCE(u_seller.bairro, 'Centro')::text AS origin_bairro,
    COALESCE(o.delivery_bairro, u_buyer.bairro, 'Destino')::text AS delivery_bairro,
    ROUND(COALESCE(o.delivery_lat, 0)::numeric, 2) AS approx_lat,
    ROUND(COALESCE(o.delivery_lng, 0)::numeric, 2) AS approx_lng,
    o.created_at
  FROM public.orders o
  LEFT JOIN public.storefronts sf ON sf.id = o.seller_storefront_id
  LEFT JOIN public.users u_seller ON u_seller.id = sf.partner_id
  LEFT JOIN public.users u_buyer ON u_buyer.id = o.buyer_id
  WHERE o.driver_id IS NULL
    AND o.status IN ('READY', 'SEARCHING_OPERATOR', 'ready')
    AND COALESCE(o.is_hidden, false) = false
  ORDER BY o.created_at DESC
  LIMIT 50;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_driver_radar() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_driver_radar() TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
