-- ==============================================================================
-- AÇAÍFOOD — ROLLBACK R14: Reverter withdrawal_requests transfer_attempt_id
-- Timestamp: 20261002080000
-- ==============================================================================

DROP INDEX IF EXISTS public.idx_withdrawal_requests_transfer_attempt_id;
ALTER TABLE public.withdrawal_requests DROP COLUMN IF EXISTS transfer_attempt_id;

NOTIFY pgrst, 'reload schema';
