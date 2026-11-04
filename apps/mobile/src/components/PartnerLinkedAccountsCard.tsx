"use client";

import React, { useCallback, useEffect, useState } from "react";
import { getAuthHeaders } from "@/store/useAppStore";

// R47 — Contas do app que usam a mesma conta de recebimento (subconta Asaas, mesmo CPF/CNPJ).
// Conta principal: aprova/recusa pedidos, libera saque e desfaz vínculos.
// Conta vinculada: vê de qual conta recebe e se pode sacar.

type Account = { name: string; email: string; tipo: string } | null;
type OwnerLink = { id: string; status: 'PENDING' | 'ACTIVE'; canWithdraw: boolean; requestedAt: string; account: Account };
type MyLink = { id: string; status: 'PENDING' | 'ACTIVE'; canWithdraw: boolean; owner: Account } | null;

export function PartnerLinkedAccountsCard() {
  const [asOwner, setAsOwner] = useState<OwnerLink[]>([]);
  const [asLinked, setAsLinked] = useState<MyLink>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/asaas/account-links', { headers: await getAuthHeaders(), cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json?.success) {
        setAsOwner(Array.isArray(json.asOwner) ? json.asOwner : []);
        setAsLinked(json.asLinked || null);
      }
    } catch (_e) { /* cartão some se não carregar */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  const act = async (linkId: string, action: 'approve' | 'reject' | 'revoke' | 'set_withdraw', extra?: Record<string, any>) => {
    const confirmText: Record<string, string> = {
      approve: 'Aprovar? Esta conta passa a receber vendas e corridas na SUA conta de recebimento (mesmo CPF/CNPJ).',
      reject: 'Recusar este pedido de vínculo?',
      revoke: 'Desfazer o vínculo? A outra conta deixa de receber pela sua conta de recebimento.',
      set_withdraw: extra?.canWithdraw ? 'Permitir que esta conta faça saques da sua conta de recebimento?' : 'Bloquear saques desta conta?',
    };
    if (!window.confirm(confirmText[action])) return;
    setBusy(linkId);
    setMsg(null);
    try {
      const res = await fetch('/api/asaas/account-links', {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({ linkId, action, ...(extra || {}) }),
      });
      const json = await res.json().catch(() => ({}));
      setMsg(res.ok ? '✅ Feito.' : `⚠️ ${json?.error || 'Não foi possível concluir.'}`);
      await load();
    } finally {
      setBusy(null);
    }
  };

  if (asOwner.length === 0 && !asLinked) return null;

  return (
    <div className="bg-white dark:bg-zinc-900 border border-purple-200 dark:border-purple-900/50 rounded-2xl p-4 shadow-sm space-y-3">
      <div>
        <h3 className="font-bold text-sm text-zinc-900 dark:text-white">🔗 Contas vinculadas (mesmo CPF/CNPJ)</h3>
        <p className="text-[11px] text-zinc-500 mt-0.5">Contas do app que recebem pela mesma conta de recebimento Asaas. O saldo é um só para todas.</p>
      </div>

      {asLinked && (
        <div className="text-xs rounded-xl p-3 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/50 text-zinc-700 dark:text-zinc-300">
          {asLinked.status === 'PENDING' ? (
            <>⏳ Pedido de vínculo aguardando aprovação da conta principal <strong>{asLinked.owner?.name || ''}</strong> ({asLinked.owner?.email || ''}).</>
          ) : (
            <>Esta conta recebe pela conta de recebimento de <strong>{asLinked.owner?.name || 'conta principal'}</strong> ({asLinked.owner?.email || ''}).
              {' '}Saque: <strong>{asLinked.canWithdraw ? 'liberado' : 'somente na conta principal'}</strong>.</>
          )}
        </div>
      )}

      {asOwner.map(l => (
        <div key={l.id} className="rounded-xl p-3 border border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="text-xs">
            <p className="font-bold text-zinc-900 dark:text-white">{l.account?.name || 'Conta'} <span className="font-normal text-zinc-500">· {l.account?.tipo || ''} · {l.account?.email || ''}</span></p>
            <p className="text-zinc-500">{l.status === 'PENDING' ? '⏳ Pedindo para usar sua conta de recebimento' : `✅ Vinculada · Saque ${l.canWithdraw ? 'liberado' : 'bloqueado'}`}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {l.status === 'PENDING' ? (
              <>
                <button disabled={busy === l.id} onClick={() => act(l.id, 'approve')} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold disabled:opacity-50 cursor-pointer">Aprovar</button>
                <button disabled={busy === l.id} onClick={() => act(l.id, 'reject')} className="px-3 py-1.5 rounded-lg bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs font-bold disabled:opacity-50 cursor-pointer">Recusar</button>
              </>
            ) : (
              <>
                <button disabled={busy === l.id} onClick={() => act(l.id, 'set_withdraw', { canWithdraw: !l.canWithdraw })} className="px-3 py-1.5 rounded-lg bg-purple-600 text-white text-xs font-bold disabled:opacity-50 cursor-pointer">
                  {l.canWithdraw ? 'Bloquear saque' : 'Liberar saque'}
                </button>
                <button disabled={busy === l.id} onClick={() => act(l.id, 'revoke')} className="px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-600 border border-red-200 dark:border-red-900 text-xs font-bold disabled:opacity-50 cursor-pointer">Desvincular</button>
              </>
            )}
          </div>
        </div>
      ))}

      {msg && <p className="text-xs text-zinc-600 dark:text-zinc-400">{msg}</p>}
    </div>
  );
}

export default PartnerLinkedAccountsCard;
