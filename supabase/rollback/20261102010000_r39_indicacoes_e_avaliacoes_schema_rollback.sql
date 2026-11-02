-- ==============================================================================
-- ROLLBACK: AÇAÍFOOD R39 — FASE 1: INDICAÇÕES DE PARCEIROS E AVALIAÇÕES (SCHEMA E RLS)
-- Timestamp: 20261102010000
-- ==============================================================================

DROP VIEW IF EXISTS public.user_rating_summary CASCADE;
DROP VIEW IF EXISTS public.ratings_public CASCADE;

DROP TABLE IF EXISTS public.rating_reports CASCADE;
DROP TABLE IF EXISTS public.ratings CASCADE;
DROP TABLE IF EXISTS public.referral_invite_links CASCADE;
DROP TABLE IF EXISTS public.partner_referrals CASCADE;

ALTER TABLE public.platform_settings
  DROP COLUMN IF EXISTS rating_window_days,
  DROP COLUMN IF EXISTS rating_min_count_display,
  DROP COLUMN IF EXISTS rating_comments_enabled;

ALTER TABLE public.cities
  DROP COLUMN IF EXISTS referrals_enabled,
  DROP COLUMN IF EXISTS ratings_enabled,
  DROP COLUMN IF EXISTS b2c_delivery_platform_fee_pct_referred,
  DROP COLUMN IF EXISTS b2c_referred_exclusive_seconds,
  DROP COLUMN IF EXISTS b2c_stuck_order_alert_seconds,
  DROP COLUMN IF EXISTS b2b_delivery_platform_fee_pct_referred,
  DROP COLUMN IF EXISTS b2b_referred_exclusive_seconds,
  DROP COLUMN IF EXISTS b2b_stuck_order_alert_seconds,
  DROP COLUMN IF EXISTS col_delivery_platform_fee_pct_referred,
  DROP COLUMN IF EXISTS col_referred_exclusive_seconds,
  DROP COLUMN IF EXISTS col_stuck_order_alert_seconds;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_dispatch_mode_check,
  DROP COLUMN IF EXISTS dispatch_mode,
  DROP COLUMN IF EXISTS radar_open_at,
  DROP COLUMN IF EXISTS dispatch_called_at,
  DROP COLUMN IF EXISTS stuck_alert_sent_at,
  DROP COLUMN IF EXISTS self_delivery,
  DROP COLUMN IF EXISTS assigned_via_referral,
  DROP COLUMN IF EXISTS dispatch_mode_snapshot,
  DROP COLUMN IF EXISTS delivery_platform_fee_pct_applied;

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_dispatch_mode_check,
  DROP CONSTRAINT IF EXISTS users_serve_mode_check,
  DROP COLUMN IF EXISTS dispatch_mode,
  DROP COLUMN IF EXISTS serve_mode;

NOTIFY pgrst, 'reload schema';
