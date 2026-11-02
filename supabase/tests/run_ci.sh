#!/usr/bin/env bash
# Testes de banco do R15/R16/R39 num Postgres vazio (CI ou local).
# Uso: PGURL=postgres://postgres:postgres@localhost:5432/postgres bash supabase/tests/run_ci.sh
set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)"
run() { psql "$PGURL" -v ON_ERROR_STOP=1 -q -X -f "$1" > /dev/null; }
run "$DIR/tests/00_supabase_stub.sql"
run "$DIR/tests/fixtures/minimal_schema.sql"
for m in 20261006010000_r15_pin_hardening.sql \
         20261006020000_r15_users_privacy.sql \
         20261006030000_r16_users_privacy_account_status_radar.sql \
         20261006040000_r16_platform_config_and_sla.sql \
         20261008010000_public_store_list.sql \
         20261102010000_r39_indicacoes_e_avaliacoes_schema.sql \
         20261102010100_r39_f1b_ratings_views_privacy.sql \
         20261102020000_r39_referrals_rpcs_and_dispatch.sql \
         20261102040000_r39_stuck_orders_and_self_delivery.sql; do
  echo "→ migration $m"
  run "$DIR/migrations/$m"
done
echo "→ rollback + reapply R39 F1/F1b/F2/F4"
run "$DIR/rollback/20261102040000_r39_stuck_orders_and_self_delivery_rollback.sql"
run "$DIR/rollback/20261102020000_r39_referrals_rpcs_and_dispatch_rollback.sql"
run "$DIR/rollback/20261102010100_r39_f1b_ratings_views_privacy_rollback.sql"
run "$DIR/rollback/20261102010000_r39_indicacoes_e_avaliacoes_schema_rollback.sql"
run "$DIR/migrations/20261102010000_r39_indicacoes_e_avaliacoes_schema.sql"
run "$DIR/migrations/20261102010100_r39_f1b_ratings_views_privacy.sql"
run "$DIR/migrations/20261102020000_r39_referrals_rpcs_and_dispatch.sql"
run "$DIR/migrations/20261102040000_r39_stuck_orders_and_self_delivery.sql"
shopt -s nullglob
for t in "$DIR"/tests/*.test.sql; do
  echo "→ teste $(basename "$t")"
  run "$t"
done
echo "Todos os testes de banco passaram."
