-- ==========================================================
-- AÇAÍFOOD — FASE 2B: REVOGAÇÃO DE MUTAÇÃO DIRETA EM ORDERS
-- Timestamp: 20261002010000
-- Prompt R11 - Fase 2B
-- ==========================================================

-- 1. Revogar INSERT e UPDATE gerais na tabela orders para usuários comuns
REVOKE INSERT, UPDATE ON public.orders FROM anon, authenticated;

-- 2. Conceder permissão de UPDATE exclusivamente na coluna 'is_hidden' (para ocultar do histórico)
GRANT UPDATE (is_hidden) ON public.orders TO authenticated;

-- 3. Atualizar política de UPDATE em orders para permitir apenas alteração de is_hidden para o próprio comprador/loja
DROP POLICY IF EXISTS "Orders User Update" ON public.orders;
DROP POLICY IF EXISTS "Orders Granular Update" ON public.orders;

CREATE POLICY "Orders Granular Update IsHidden" ON public.orders
FOR UPDATE USING (
  auth.role() = 'authenticated' AND (
    buyer_id = auth.uid() 
    OR EXISTS (
      SELECT 1 FROM public.storefronts sf 
      WHERE sf.id = orders.seller_storefront_id AND sf.partner_id = auth.uid()
    )
    OR public.is_admin()
  )
)
WITH CHECK (
  auth.role() = 'authenticated' AND (
    buyer_id = auth.uid() 
    OR EXISTS (
      SELECT 1 FROM public.storefronts sf 
      WHERE sf.id = orders.seller_storefront_id AND sf.partner_id = auth.uid()
    )
    OR public.is_admin()
  )
);

-- 4. Ocultar pin_hash e provided_pin de leituras públicas
REVOKE SELECT (pin_hash, provided_pin) ON public.orders FROM anon;

NOTIFY pgrst, 'reload schema';
