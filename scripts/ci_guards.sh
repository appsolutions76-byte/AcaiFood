#!/usr/bin/env bash
# Regras que não podem voltar (docs/18 e docs/20). Falha o CI se achar alguma.
set -uo pipefail
SRC="apps/mobile/src"
fail=0
check() {
  local msg="$1"; shift
  local out
  out=$(grep -rnE "$@" "$SRC" 2>/dev/null || true)
  if [ -n "$out" ]; then
    echo "✗ $msg"; echo "$out"; fail=1
  else
    echo "✓ $msg"
  fi
}
check "Nenhum segredo em variável NEXT_PUBLIC_" "NEXT_PUBLIC_[A-Z_]*(SECRET|SERVICE_ROLE|ASAAS_API_KEY|WEBHOOK_TOKEN|CRON)"
check "Nenhum PIN gerado com Math.random" "(pin|Pin|PIN)[A-Za-z_]*\s*=\s*.*Math\.random"
check "Nenhum e-mail inventado para o Asaas" "user_\\\$\{[^}]*\}@acaifood"
check "Nenhuma subconta criada como APPROVED pelo app" "asaas_account_status:\s*'APPROVED'"
check "Nenhum token na URL" "\?token=\\\$\{"
check "Sem contador de saques no navegador" "getDailyWithdrawalCount|incrementDailyWithdrawalCount\("
exit $fail
