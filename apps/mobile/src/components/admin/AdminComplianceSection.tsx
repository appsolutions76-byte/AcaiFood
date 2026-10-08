"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { getAuthHeaders } from '@/store/useAppStore';

// Conformidade (contrato BaaS Asaas): subcontas, repasses, log de auditoria e SLA mensal.
// Tudo via rotas de servidor com MFA; nenhum valor de dinheiro é enviado daqui.

type SubTab = 'subcontas' | 'repasses' | 'auditoria' | 'sla';

const STATUS_LABEL: Record<string, string> = {
  APPROVED: 'Aprovada',
  PENDING_DOCUMENTS: 'Aguardando documentos',
  AWAITING_APPROVAL: 'Em análise no Asaas',
  PENDING: 'Pendente',
  REJECTED: 'Reprovada',
  NEEDS_ADMIN: 'Precisa do admin',
  PENDING_PAYMENT: 'Aguardando taxa'
};

function statusClass(status: string): string {
  if (status === 'APPROVED') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300';
  if (status === 'REJECTED' || status === 'NEEDS_ADMIN') return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300';
  return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300';
}

function fmtDate(v?: string | null): string {
  if (!v) return '—';
  try { return new Date(v).toLocaleString('pt-BR'); } catch { return String(v); }
}

function fmtMoney(v: any): string {
  const n = Number(v || 0);
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

async function apiGet(url: string): Promise<any> {
  const res = await fetch(url, { headers: await getAuthHeaders() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Erro ${res.status}`);
  return data;
}

async function apiPost(url: string, body: any): Promise<any> {
  const res = await fetch(url, { method: 'POST', headers: await getAuthHeaders(), body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Erro ${res.status}`);
  return data;
}

export function AdminComplianceSection({ showToast }: { showToast?: (msg: string) => void }) {
  const [tab, setTab] = useState<SubTab>('subcontas');
  const toast = useCallback((m: string) => { if (showToast) showToast(m); }, [showToast]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {([
          ['subcontas', '🏦 Subcontas Asaas'],
          ['repasses', '💸 Repasses'],
          ['auditoria', '🧾 Log de auditoria'],
          ['sla', '📈 SLA mensal']
        ] as Array<[SubTab, string]>).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-3 py-2 rounded-lg text-xs sm:text-sm font-bold border transition cursor-pointer ${tab === key ? 'bg-purple-600 text-white border-purple-600' : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'subcontas' && <SubaccountsPanel toast={toast} />}
      {tab === 'repasses' && <SettlementsPanel toast={toast} />}
      {tab === 'auditoria' && <AuditLogPanel />}
      {tab === 'sla' && <SlaPanel toast={toast} />}
    </div>
  );
}

function Panel({ title, children, actions }: { title: string; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="font-bold text-zinc-900 dark:text-white">{title}</h3>
        {actions}
      </div>
      {children}
    </div>
  );
}

function SubaccountsPanel({ toast }: { toast: (m: string) => void }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [onlyAttention, setOnlyAttention] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const data = await apiGet('/api/admin/subaccounts');
      setRows(data.subaccounts || []);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const recheck = async (userId: string) => {
    setBusyId(userId);
    try {
      const data = await apiPost('/api/asaas/account-status-sync', { userId });
      if (data?.success === false) throw new Error(data?.error || 'Asaas não respondeu');
      toast(`Situação atualizada: ${STATUS_LABEL[data?.status] || data?.status || 'consultada'}`);
      await load();
    } catch (e: any) { toast(`Erro ao reconsultar: ${e.message}`); }
    setBusyId(null);
  };

  // Subconta antiga sem chave guardada: o app não consegue consultar o Asaas.
  // O admin confere no painel do Asaas (Subcontas) e registra a situação aqui.
  const setManual = async (userId: string, action: 'mark_approved' | 'mark_pending') => {
    const note = window.prompt(action === 'mark_approved'
      ? 'Confirme que a subconta está APROVADA no painel do Asaas. Como você conferiu? (fica no log)'
      : 'Motivo para voltar a subconta para "em análise" (fica no log):');
    if (note === null) return;
    setBusyId(userId);
    try {
      const data = await apiPost('/api/admin/subaccounts', { userId, action, note });
      toast(`Situação registrada: ${STATUS_LABEL[data?.status] || data?.status}`);
      await load();
    } catch (e: any) { toast(`Erro: ${e.message}`); }
    setBusyId(null);
  };

  // Troca para o modelo BaaS: encerra a subconta antiga e o parceiro abre uma nova pelo app.
  const closeOrUnlink = async (r: any, action: 'close_in_asaas' | 'unlink_closed') => {
    const question = action === 'close_in_asaas'
      ? `Encerrar no Asaas a subconta de "${r.name}"? É IRREVERSÍVEL. O parceiro terá de abrir uma nova pelo app.\n\nEscreva o motivo (fica no log):`
      : `Só use se o Asaas JÁ ENCERROU a subconta de "${r.name}" (suporte ou painel).\n\nComo você confirmou o encerramento? (fica no log)`;
    const note = window.prompt(question);
    if (note === null) return;
    setBusyId(r.id);
    try {
      await apiPost('/api/admin/subaccounts', { userId: r.id, action, note });
      toast(action === 'close_in_asaas'
        ? 'Subconta encerrada no Asaas. O parceiro já pode abrir a nova em "Minha conta Asaas".'
        : 'Vínculo removido. O parceiro já pode abrir a nova em "Minha conta Asaas".');
      await load();
    } catch (e: any) { toast(`Erro: ${e.message}`); }
    setBusyId(null);
  };

  const visible = onlyAttention ? rows.filter(r => r.status === 'NEEDS_ADMIN' || r.status === 'REJECTED' || (r.accountId && !r.hasApiKey)) : rows;

  return (
    <Panel
      title={`Subcontas Asaas (${rows.length})`}
      actions={
        <div className="flex items-center gap-2">
          <label className="text-xs text-zinc-600 dark:text-zinc-400 flex items-center gap-1">
            <input type="checkbox" checked={onlyAttention} onChange={e => setOnlyAttention(e.target.checked)} />
            Só com problema
          </label>
          <button onClick={load} className="text-xs px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700">Atualizar</button>
        </div>
      }
    >
      {loading && <p className="text-sm text-zinc-500">Carregando...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!loading && !error && visible.length === 0 && <p className="text-sm text-zinc-500">Nenhuma subconta.</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-xs sm:text-sm">
          <thead>
            <tr className="text-left text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
              <th className="py-2 pr-2">Nome</th>
              <th className="py-2 pr-2">Perfil</th>
              <th className="py-2 pr-2">CPF/CNPJ</th>
              <th className="py-2 pr-2">Situação</th>
              <th className="py-2 pr-2">Detalhe</th>
              <th className="py-2 pr-2">Cadastro</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {visible.map(r => (
              <tr key={r.id} className="border-b border-zinc-100 dark:border-zinc-800 align-top">
                <td className="py-2 pr-2 font-semibold text-zinc-900 dark:text-white">{r.name || '—'}</td>
                <td className="py-2 pr-2">{r.role}</td>
                <td className="py-2 pr-2 font-mono">{r.document || '—'}</td>
                <td className="py-2 pr-2">
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${statusClass(r.status)}`}>
                    {STATUS_LABEL[r.status] || r.status}
                  </span>
                  {!r.accountId && <div className="text-[11px] text-zinc-500 mt-1">Sem subconta criada</div>}
                  {r.accountId && !r.hasApiKey && <div className="text-[11px] text-red-600 mt-1">Subconta antiga (antes do BaaS): trocar</div>}
                </td>
                <td className="py-2 pr-2 text-[11px] text-zinc-600 dark:text-zinc-400 max-w-[220px] break-words">
                  {r.detail ? (typeof r.detail === 'string' ? r.detail : Object.entries(r.detail).map(([k, v]) => `${k}: ${v}`).join(' · ')) : '—'}
                </td>
                <td className="py-2 pr-2">{fmtDate(r.createdAt)}</td>
                <td className="py-2 space-y-1">
                  {r.accountId && r.hasApiKey && (
                    <button
                      disabled={busyId === r.id}
                      onClick={() => recheck(r.id)}
                      className="text-xs px-2 py-1 rounded bg-purple-600 text-white disabled:opacity-50"
                    >
                      {busyId === r.id ? '...' : 'Reconsultar'}
                    </button>
                  )}
                  {r.accountId && !r.hasApiKey && (
                    <div className="flex flex-col gap-1">
                      {r.status !== 'APPROVED' && (
                        <button disabled={busyId === r.id} onClick={() => setManual(r.id, 'mark_approved')} className="text-xs px-2 py-1 rounded bg-emerald-600 text-white disabled:opacity-50 whitespace-nowrap">
                          Aprovada no Asaas
                        </button>
                      )}
                      {r.status === 'APPROVED' && (
                        <button disabled={busyId === r.id} onClick={() => setManual(r.id, 'mark_pending')} className="text-xs px-2 py-1 rounded bg-amber-600 text-white disabled:opacity-50 whitespace-nowrap">
                          Voltar p/ em análise
                        </button>
                      )}
                    </div>
                  )}
                  {r.accountId && (
                    <div className="flex flex-col gap-1 pt-1">
                      <button disabled={busyId === r.id} onClick={() => closeOrUnlink(r, 'close_in_asaas')} className="text-xs px-2 py-1 rounded bg-red-600 text-white disabled:opacity-50 whitespace-nowrap">
                        Encerrar no Asaas
                      </button>
                      <button disabled={busyId === r.id} onClick={() => closeOrUnlink(r, 'unlink_closed')} className="text-xs px-2 py-1 rounded border border-red-400 text-red-600 disabled:opacity-50 whitespace-nowrap">
                        Desvincular (já encerrada no Asaas)
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

const SETTLEMENT_STATUSES = ['', 'REVIEW', 'PENDING', 'PROCESSING', 'DONE', 'FAILED', 'CANCELLED'];

function SettlementsPanel({ toast }: { toast: (m: string) => void }) {
  const [rows, setRows] = useState<any[]>([]);
  const [status, setStatus] = useState('REVIEW');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const data = await apiGet(`/api/admin/settlements${status ? `?status=${status}` : ''}`);
      setRows(data.settlements || []);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }, [status]);

  useEffect(() => { load(); }, [load]);

  const act = async (settlementId: string, action: 'approve_review' | 'cancel_settlement') => {
    const reason = window.prompt(action === 'approve_review' ? 'Motivo da aprovação (fica no log):' : 'Motivo do cancelamento (fica no log):');
    if (reason === null) return;
    setBusyId(settlementId);
    try {
      const data = await apiPost('/api/admin/settlements', { settlementId, action, reason });
      toast(action === 'approve_review'
        ? `Repasse aprovado com valor recalculado: ${fmtMoney(data?.amount)}`
        : 'Repasse cancelado');
      await load();
    } catch (e: any) { toast(`Erro: ${e.message}`); }
    setBusyId(null);
  };

  return (
    <Panel
      title="Repasses (settlements)"
      actions={
        <select value={status} onChange={e => setStatus(e.target.value)} className="text-xs px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 bg-transparent">
          {SETTLEMENT_STATUSES.map(s => <option key={s} value={s}>{s || 'Todos'}</option>)}
        </select>
      }
    >
      <p className="text-xs text-zinc-500 mb-3">O valor aprovado é sempre recalculado no servidor. Os repasses automáticos continuam desligados.</p>
      {loading && <p className="text-sm text-zinc-500">Carregando...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!loading && !error && rows.length === 0 && <p className="text-sm text-zinc-500">Nenhum repasse neste status.</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-xs sm:text-sm">
          <thead>
            <tr className="text-left text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
              <th className="py-2 pr-2">Pedido</th>
              <th className="py-2 pr-2">Papel</th>
              <th className="py-2 pr-2">Valor</th>
              <th className="py-2 pr-2">Status</th>
              <th className="py-2 pr-2">Observação</th>
              <th className="py-2 pr-2">Criado</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-b border-zinc-100 dark:border-zinc-800 align-top">
                <td className="py-2 pr-2 font-mono">#{String(r.order_id || '').slice(0, 8)}</td>
                <td className="py-2 pr-2">{r.role}</td>
                <td className="py-2 pr-2">{fmtMoney(r.amount)}</td>
                <td className="py-2 pr-2">{r.status}</td>
                <td className="py-2 pr-2 text-[11px] text-zinc-600 dark:text-zinc-400 max-w-[220px] break-words">{r.last_error || '—'}</td>
                <td className="py-2 pr-2">{fmtDate(r.created_at)}</td>
                <td className="py-2 space-x-1 whitespace-nowrap">
                  {r.status === 'REVIEW' && (
                    <button disabled={busyId === r.id} onClick={() => act(r.id, 'approve_review')} className="text-xs px-2 py-1 rounded bg-emerald-600 text-white disabled:opacity-50">Aprovar</button>
                  )}
                  {['REVIEW', 'PENDING', 'FAILED'].includes(r.status) && (
                    <button disabled={busyId === r.id} onClick={() => act(r.id, 'cancel_settlement')} className="text-xs px-2 py-1 rounded bg-red-600 text-white disabled:opacity-50">Cancelar</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function AuditLogPanel() {
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);
  const [action, setAction] = useState('');
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const qs = new URLSearchParams();
      if (from) qs.set('from', from);
      if (to) qs.set('to', to);
      if (action.trim()) qs.set('action', action.trim());
      const data = await apiGet(`/api/admin/audit-log?${qs.toString()}`);
      setRows(data.entries || []);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }, [from, to, action]);

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Panel title="Log de auditoria (somente leitura)">
      <div className="flex flex-wrap gap-2 items-end mb-3 text-xs">
        <label className="flex flex-col">De<input type="date" value={from} onChange={e => setFrom(e.target.value)} className="px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 bg-transparent" /></label>
        <label className="flex flex-col">Até<input type="date" value={to} onChange={e => setTo(e.target.value)} className="px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 bg-transparent" /></label>
        <label className="flex flex-col">Ação<input value={action} onChange={e => setAction(e.target.value)} placeholder="ex.: WITHDRAWAL" className="px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 bg-transparent" /></label>
        <button onClick={load} className="px-3 py-1.5 rounded bg-purple-600 text-white font-bold">Filtrar</button>
      </div>
      {loading && <p className="text-sm text-zinc-500">Carregando...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!loading && !error && rows.length === 0 && <p className="text-sm text-zinc-500">Nenhum registro no período.</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-xs sm:text-sm">
          <thead>
            <tr className="text-left text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
              <th className="py-2 pr-2">Data</th>
              <th className="py-2 pr-2">Quem</th>
              <th className="py-2 pr-2">Ação</th>
              <th className="py-2 pr-2">Alvo</th>
              <th className="py-2 pr-2">IP</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <React.Fragment key={r.id}>
                <tr className="border-b border-zinc-100 dark:border-zinc-800">
                  <td className="py-2 pr-2 whitespace-nowrap">{fmtDate(r.created_at)}</td>
                  <td className="py-2 pr-2">{r.actor_name}</td>
                  <td className="py-2 pr-2 font-mono">{r.action}</td>
                  <td className="py-2 pr-2 font-mono">{r.target_type || ''} {r.target_id ? String(r.target_id).slice(0, 12) : ''}</td>
                  <td className="py-2 pr-2">{r.ip_address || ''}</td>
                  <td className="py-2">
                    <button onClick={() => setOpenId(openId === r.id ? null : r.id)} className="text-xs underline text-purple-600">
                      {openId === r.id ? 'Fechar' : 'Detalhes'}
                    </button>
                  </td>
                </tr>
                {openId === r.id && (
                  <tr>
                    <td colSpan={6} className="py-2">
                      <div className="grid sm:grid-cols-2 gap-2">
                        <pre className="text-[11px] bg-zinc-50 dark:bg-zinc-950 p-2 rounded overflow-auto max-h-60">Antes: {JSON.stringify(r.before_state, null, 2)}</pre>
                        <pre className="text-[11px] bg-zinc-50 dark:bg-zinc-950 p-2 rounded overflow-auto max-h-60">Depois: {JSON.stringify(r.after_state, null, 2)}</pre>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function SlaPanel({ toast }: { toast: (m: string) => void }) {
  const lastMonth = (() => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 7); })();
  const [rows, setRows] = useState<any[]>([]);
  const [month, setMonth] = useState(lastMonth);
  const [uptime, setUptime] = useState('');
  const [source, setSource] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await apiGet('/api/admin/sla');
      setRows(data.rows || []);
    } catch (e: any) { setError(e.message); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      await apiPost('/api/admin/sla', { month, uptimePercent: Number(String(uptime).replace(',', '.')), source });
      toast('Disponibilidade registrada');
      setUptime('');
      await load();
    } catch (e: any) { toast(`Erro: ${e.message}`); }
    setSaving(false);
  };

  return (
    <Panel title="Disponibilidade mensal (SLA)">
      <p className="text-xs text-zinc-500 mb-3">
        Informe a disponibilidade medida por um monitor externo (ex.: UptimeRobot). O relatório mensal mostra "não medido" quando o mês não tem valor.
      </p>
      <div className="flex flex-wrap gap-2 items-end mb-4 text-xs">
        <label className="flex flex-col">Mês<input type="month" value={month} onChange={e => setMonth(e.target.value)} className="px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 bg-transparent" /></label>
        <label className="flex flex-col">Disponibilidade (%)<input value={uptime} onChange={e => setUptime(e.target.value)} placeholder="99,95" className="px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 bg-transparent w-28" /></label>
        <label className="flex flex-col">Fonte<input value={source} onChange={e => setSource(e.target.value)} placeholder="UptimeRobot" className="px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 bg-transparent" /></label>
        <button disabled={saving || !uptime || !source} onClick={save} className="px-3 py-1.5 rounded bg-purple-600 text-white font-bold disabled:opacity-50">Salvar</button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <table className="w-full text-xs sm:text-sm">
        <thead>
          <tr className="text-left text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
            <th className="py-2 pr-2">Mês</th>
            <th className="py-2 pr-2">Disponibilidade</th>
            <th className="py-2 pr-2">Fonte</th>
            <th className="py-2">Registrado em</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r: any) => (
            <tr key={r.month} className="border-b border-zinc-100 dark:border-zinc-800">
              <td className="py-2 pr-2">{r.month}</td>
              <td className="py-2 pr-2">{Number(r.uptime_percent).toLocaleString('pt-BR', { maximumFractionDigits: 3 })}%</td>
              <td className="py-2 pr-2">{r.source}</td>
              <td className="py-2">{fmtDate(r.created_at)}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={4} className="py-2 text-zinc-500">Nenhum mês registrado.</td></tr>
          )}
        </tbody>
      </table>
    </Panel>
  );
}
