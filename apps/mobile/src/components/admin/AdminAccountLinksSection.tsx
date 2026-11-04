"use client";

import React, { useCallback, useEffect, useState } from "react";
import { getAuthHeaders } from "@/store/useAppStore";

// R47 — Admin: contas vinculadas à mesma subconta e registro das requisições ao Asaas

const STATUS_LABEL: Record<string, string> = { PENDING: '⏳ Pendente', ACTIVE: '✅ Ativo', REJECTED: '✖ Recusado', REVOKED: '↩ Desfeito' };
const maskDoc = (d: string) => {
  const x = String(d || '').replace(/\D/g, '');
  if (x.length === 11) return `***.${x.slice(3, 6)}.${x.slice(6, 9)}-**`;
  if (x.length === 14) return `**.${x.slice(2, 5)}.${x.slice(5, 8)}/${x.slice(8, 12)}-**`;
  return x ? '***' : '';
};

export function AdminAccountLinksSection() {
  const [links, setLinks] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [migrationApplied, setMigrationApplied] = useState(true);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/account-links', { headers: await getAuthHeaders(), cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json?.success) {
        setLinks(json.links || []);
        setLogs(json.logs || []);
        setMigrationApplied(Boolean(json.migrationApplied));
      }
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const act = async (linkId: string, action: string, extra?: Record<string, any>) => {
    if (!window.confirm('Confirmar esta ação no vínculo?')) return;
    setBusy(linkId);
    try {
      const res = await fetch('/api/asaas/account-links', { method: 'POST', headers: await getAuthHeaders(), body: JSON.stringify({ linkId, action, ...(extra || {}) }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) alert(json?.error || 'Não foi possível concluir.');
      await load();
    } finally {
      setBusy(null);
    }
  };

  const copyLog = async (g: any) => {
    const text = JSON.stringify({
      data: g.created_at, acao: g.action, metodo: g.method, endpoint: g.endpoint,
      requisicao: g.request_body, status_http: g.response_status, resposta: g.response_body, erro: g.error,
    }, null, 2);
    try { await navigator.clipboard.writeText(text); setCopied(g.id); setTimeout(() => setCopied(null), 2500); }
    catch (_e) { window.prompt('Copie o texto abaixo:', text); }
  };

  return (
    <div className="space-y-4 mt-6">
      <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-bold text-zinc-900 dark:text-white">🔗 Contas vinculadas à mesma subconta (mesmo CPF/CNPJ)</h3>
            <p className="text-xs text-zinc-500 mt-1">Uma pessoa pode ter várias contas no app (outro e-mail) recebendo pela mesma subconta Asaas. Saldo único, um saque por vez por subconta.</p>
          </div>
          <button onClick={load} disabled={loading} className="px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs font-bold cursor-pointer">{loading ? '...' : '🔄'}</button>
        </div>
        {!migrationApplied && <p className="text-xs text-amber-600">Atualização do banco (R47) ainda não aplicada: vínculos e registro de requisições ficam disponíveis depois dela.</p>}
        {links.length === 0 ? (
          <p className="text-xs text-zinc-500">Nenhum vínculo.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[720px]">
              <thead className="text-[10px] uppercase text-zinc-500 text-left">
                <tr><th className="p-2">Conta principal</th><th className="p-2">Conta vinculada</th><th className="p-2">CPF/CNPJ</th><th className="p-2">Situação</th><th className="p-2">Saque</th><th className="p-2">Ações</th></tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {links.map(l => (
                  <tr key={l.id}>
                    <td className="p-2"><b>{l.owner?.name || '—'}</b><br /><span className="text-zinc-500">{l.owner?.email}</span></td>
                    <td className="p-2"><b>{l.linked?.name || '—'}</b><br /><span className="text-zinc-500">{l.linked?.email}</span></td>
                    <td className="p-2 font-mono">{maskDoc(l.cpf_cnpj)}</td>
                    <td className="p-2">{STATUS_LABEL[l.status] || l.status}</td>
                    <td className="p-2">{l.status === 'ACTIVE' ? (l.can_withdraw ? 'Liberado' : 'Só principal') : '—'}</td>
                    <td className="p-2">
                      <div className="flex flex-wrap gap-1">
                        {l.status === 'PENDING' && <>
                          <button disabled={busy === l.id} onClick={() => act(l.id, 'approve')} className="px-2 py-1 rounded bg-emerald-600 text-white font-bold cursor-pointer">Aprovar</button>
                          <button disabled={busy === l.id} onClick={() => act(l.id, 'reject')} className="px-2 py-1 rounded bg-zinc-200 dark:bg-zinc-800 font-bold cursor-pointer">Recusar</button>
                        </>}
                        {l.status === 'ACTIVE' && <>
                          <button disabled={busy === l.id} onClick={() => act(l.id, 'set_withdraw', { canWithdraw: !l.can_withdraw })} className="px-2 py-1 rounded bg-purple-600 text-white font-bold cursor-pointer">{l.can_withdraw ? 'Bloquear saque' : 'Liberar saque'}</button>
                          <button disabled={busy === l.id} onClick={() => act(l.id, 'revoke')} className="px-2 py-1 rounded bg-red-50 text-red-600 border border-red-200 font-bold cursor-pointer">Desvincular</button>
                        </>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-3">
        <div>
          <h3 className="font-bold text-zinc-900 dark:text-white">🧾 Requisições enviadas ao Asaas (abertura de subconta e vínculos)</h3>
          <p className="text-xs text-zinc-500 mt-1">O que o app enviou e o que o Asaas respondeu, sem chaves secretas. Use &quot;Copiar para o suporte&quot; para mandar ao Asaas.</p>
        </div>
        {logs.length === 0 ? (
          <p className="text-xs text-zinc-500">Nenhuma requisição registrada ainda (o registro começa a partir desta versão).</p>
        ) : (
          <div className="space-y-2">
            {logs.map(g => (
              <div key={g.id} className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <p className="font-bold text-zinc-900 dark:text-white">{g.action} {g.response_status ? <span className={g.response_status >= 400 ? 'text-red-600' : 'text-emerald-600'}>· HTTP {g.response_status}</span> : null}</p>
                  <p className="text-zinc-500">{new Date(g.created_at).toLocaleString('pt-BR')} · {g.user?.name || '—'} {g.user?.email ? `(${g.user.email})` : ''}{g.error ? ` · ${g.error}` : ''}</p>
                </div>
                <button onClick={() => copyLog(g)} className="px-3 py-1.5 rounded-lg bg-purple-600 text-white font-bold cursor-pointer">{copied === g.id ? 'Copiado ✓' : 'Copiar para o suporte'}</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminAccountLinksSection;
