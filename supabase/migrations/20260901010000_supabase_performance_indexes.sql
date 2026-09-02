-- ==========================================================
-- AÇAÍFOOD — OTIMIZAÇÃO DE PERFORMANCE & ÍNDICES DO SUPABASE
-- Versão: 20260901010000
-- ==========================================================

-- 1. Índices B-Tree compostos para consultas de pedidos e radar em tempo real
CREATE INDEX IF NOT EXISTS idx_orders_status_created_at ON public.orders (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_driver_status ON public.orders (driver_id, status) WHERE driver_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_buyer_status ON public.orders (buyer_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_storefront_status ON public.orders (seller_storefront_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_radar_available ON public.orders (status, created_at DESC) WHERE driver_id IS NULL;

-- 2. Índices para tabelas de auditoria e splits
CREATE INDEX IF NOT EXISTS idx_splits_order_id ON public.splits (order_id);
CREATE INDEX IF NOT EXISTS idx_splits_recipient_status ON public.splits (recipient_id, status);
CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id ON public.order_status_history (order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items (order_id);

-- 3. Otimização de Storage e Cache do PostgREST
ALTER TABLE public.orders SET (fillfactor = 90);
ALTER TABLE public.order_status_history SET (fillfactor = 95);
ALTER TABLE public.splits SET (fillfactor = 90);

-- 4. Notificar PostgREST para recarregar o schema otimizado
NOTIFY pgrst, 'reload schema';
