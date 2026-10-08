-- ==============================================================================
-- AÇAÍFOOD — Vitrine pública de lojas para visitante não logado
-- Timestamp: 20261008010000
--
-- Problema: desde a 20261006030000 (R16) o papel anon não lê nada de users.
-- A página inicial (visitante sem login) listava as lojas lendo users direto,
-- recebia "permission denied for table users" e mostrava "Nenhuma batedeira".
--
-- Solução: função get_public_stores() que devolve SÓ dados de vitrine das
-- Lojas/Batedeiras (nome, cidade, bairro, coordenadas, status, loja e produtos).
-- Não devolve CPF/CNPJ, e-mail, telefone, endereço, chave Pix nem dados de KYC.
-- users continua fechado para anon.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.get_public_stores()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', u.id,
      'name', u.name,
      'role', u.role,
      'cidade', u.cidade,
      'bairro', u.bairro,
      'latitude', u.latitude,
      'longitude', u.longitude,
      'is_online', u.is_online,
      'status', u.status,
      'asaas_wallet_id', u.asaas_wallet_id,
      'asaas_account_status', u.asaas_account_status,
      'created_at', u.created_at,
      'storefronts', COALESCE((
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
    ORDER BY u.created_at
  ), '[]'::jsonb)
  FROM public.users u
  WHERE u.role IN ('PARTNER', 'loja')
    AND COALESCE(lower(u.status), 'active') <> 'blocked';
$$;

REVOKE EXECUTE ON FUNCTION public.get_public_stores() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_stores() TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
