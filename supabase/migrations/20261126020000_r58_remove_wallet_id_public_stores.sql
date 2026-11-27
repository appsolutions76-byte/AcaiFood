-- ==============================================================================
-- AÇAÍFOOD R58 — Remove asaas_wallet_id e asaas_account_status da vitrine pública
-- Timestamp: 20261126020000
-- Auditoria: B1 — get_public_stores() expunha dados financeiros sensíveis (wallet_id)
--            ao papel anon (visitantes sem login).
-- Reversão: restaurar a função com as colunas expostas (ver rollback abaixo).
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
      'id',         u.id,
      'name',       u.name,
      'role',       u.role,
      'cidade',     u.cidade,
      'bairro',     u.bairro,
      'latitude',   u.latitude,
      'longitude',  u.longitude,
      'is_online',  u.is_online,
      'status',     u.status,
      'created_at', u.created_at,
      'storefronts', COALESCE((
        SELECT jsonb_agg(
          to_jsonb(sf) || jsonb_build_object(
            'products',
            COALESCE(
              (SELECT jsonb_agg(to_jsonb(p)) FROM public.products p WHERE p.storefront_id = sf.id),
              '[]'::jsonb
            )
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

-- Mantém as mesmas permissões — apenas o conteúdo retornado foi restringido
REVOKE EXECUTE ON FUNCTION public.get_public_stores() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_stores() TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- ROLLBACK (NÃO EXECUTAR EM PRODUÇÃO — apenas para referência):
-- CREATE OR REPLACE FUNCTION public.get_public_stores() ...
--   com 'asaas_wallet_id', u.asaas_wallet_id,
--       'asaas_account_status', u.asaas_account_status,
-- ==============================================================================
