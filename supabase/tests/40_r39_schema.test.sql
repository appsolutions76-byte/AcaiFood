-- ==============================================================================
-- TESTE R39: SCHEMA E INTEGRIDADE DE INDICAÇÕES E AVALIAÇÕES
-- ==============================================================================
BEGIN;

-- 1. Verifica existência das tabelas
SELECT 'partner_referrals existe' WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'partner_referrals');
SELECT 'referral_invite_links existe' WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'referral_invite_links');
SELECT 'ratings existe' WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ratings');
SELECT 'rating_reports existe' WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'rating_reports');

-- 2. Verifica views
SELECT 'ratings_public existe' WHERE EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'ratings_public');
SELECT 'user_rating_summary existe' WHERE EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'user_rating_summary');

-- 3. Verifica colunas novas em users
SELECT 'users.dispatch_mode' WHERE EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'dispatch_mode');
SELECT 'users.serve_mode' WHERE EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'serve_mode');

-- 4. Verifica colunas novas em orders
SELECT 'orders.dispatch_mode' WHERE EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'dispatch_mode');
SELECT 'orders.radar_open_at' WHERE EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'radar_open_at');
SELECT 'orders.self_delivery' WHERE EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'self_delivery');

-- 5. Verifica colunas novas em cities
SELECT 'cities.referrals_enabled' WHERE EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cities' AND column_name = 'referrals_enabled');
SELECT 'cities.ratings_enabled' WHERE EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cities' AND column_name = 'ratings_enabled');

ROLLBACK;
