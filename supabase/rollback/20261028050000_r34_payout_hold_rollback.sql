-- Reversão do R34: remove o gatilho e as colunas do bloqueio de saque (pix_key_type fica, já existia)
DROP TRIGGER IF EXISTS trg_users_payout_hold_guard ON public.users;
DROP FUNCTION IF EXISTS public.users_payout_hold_guard();
DROP FUNCTION IF EXISTS public.r34_norm_key(text);
ALTER TABLE public.users DROP COLUMN IF EXISTS payout_hold_release_note;
ALTER TABLE public.users DROP COLUMN IF EXISTS payout_hold_released_by;
ALTER TABLE public.users DROP COLUMN IF EXISTS payout_hold_released_at;
ALTER TABLE public.users DROP COLUMN IF EXISTS payout_hold_at;
ALTER TABLE public.users DROP COLUMN IF EXISTS payout_hold_reason;
ALTER TABLE public.users DROP COLUMN IF EXISTS payout_hold;
NOTIFY pgrst, 'reload schema';
