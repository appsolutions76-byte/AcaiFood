"use client";

import React, { useState, useEffect } from 'react';
import { getAuthHeaders } from '@/store/useAppStore';
import { 
  ArrowDownToLine, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertCircle, 
  RefreshCw, 
  Settings, 
  Zap, 
  ShieldCheck, 
  Search,
  Sliders
} from 'lucide-react';

interface AdminWithdrawalsSectionProps {
  showToast?: (msg: string) => void;
}

export function AdminWithdrawalsSection({ showToast }: AdminWithdrawalsSectionProps) {
  const [activeTab, setActiveTab] = useState<'PENDENTE' | 'PAGO' | 'REJEITADO' | 'FALHOU' | 'all'>('PENDENTE');
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Configurações do Pagamento Automático
  const [payoutSettings, setPayoutSettings] = useState<{
    auto_payout_enabled: boolean;
    auto_payout_time: string;
    auto_payout_timezone: string;
    min_withdrawal_value: number;
    last_auto_payout_run_at: string | null;
  }>({
    auto_payout_enabled: false,
    auto_payout_time: '18:00',
    auto_payout_timezone: 'America/Belem',
    min_withdrawal_value: 20.00,
    last_auto_payout_run_at: null
  });

  const [savingSettings, setSavingSettings] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchRequests = async (statusStr = activeTab) => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/admin/withdrawals?status=${statusStr}`, { headers });
      const data = await res.json();
      if (res.ok && data.success) {
        setRequests(data.requests || []);
      } else {
        console.warn("Aviso ao buscar solicitações:", data.error);
      }
    } catch (err) {
      console.error("Exceção ao listar saques no admin:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/admin/payout-settings', { headers });
      const data = await res.json();
      if (res.ok && data.success && data.settings) {
        setPayoutSettings(data.settings);
      }
    } catch (err) {
      console.error("Erro ao carregar configurações de pagamento:", err);
    }
  };

  useEffect(() => {
    fetchRequests(activeTab);
    fetchSettings();
  }, [activeTab]);

  const handleSaveSettings = async (newSettings: Partial<typeof payoutSettings>) => {
    setSavingSettings(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/admin/payout-settings', {
        method: 'POST',
        headers,
        body: JSON.stringify(newSettings)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPayoutSettings(prev => ({ ...prev, ...newSettings }));
        if (showToast) showToast("⚙️ " + (data.message || "Configurações salvas com sucesso!"));
        else alert(data.message || "Configurações salvas!");
      } else {
        alert("Erro ao salvar configurações: " + (data.error || "Falha de comunicação"));
      }
    } catch (err: any) {
      alert("Erro ao salvar configurações: " + err.message);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleApprove = async (req: any) => {
    const confirmMsg = `Deseja APROVAR e realizar a transferência Pix de R$ ${Number(req.requested_amount).toFixed(2)} para o parceiro "${req.partner?.name || 'Parceiro'}"?`;
    if (!confirm(confirmMsg)) return;

    setProcessingId(req.id);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/admin/withdrawals/${req.id}/approve`, {
        method: 'POST',
        headers
      });
      const data = await res.json();

      if (res.ok && data.success) {
        if (showToast) showToast("✅ " + (data.message || `Saque de R$ ${Number(req.requested_amount).toFixed(2)} aprovado!`));
        else alert(data.message || "Saque aprovado!");
        fetchRequests();
      } else {
        const errorMsg = data.error || 'Falha ao aprovar a solicitação de saque.';
        alert("❌ " + errorMsg);
        fetchRequests();
      }
    } catch (err: any) {
      alert("Erro ao aprovar solicitação: " + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (req: any) => {
    const reason = prompt(`Informe o motivo do cancelamento/rejeição do saque de R$ ${Number(req.requested_amount).toFixed(2)}:`, "Chave Pix cadastrada incorreta");
    if (reason === null) return;
    const cleanReason = reason.trim();
    if (!cleanReason) {
      alert("O motivo da rejeição é obrigatório.");
      return;
    }

    setProcessingId(req.id);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/admin/withdrawals/${req.id}/reject`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ reason: cleanReason })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        if (showToast) showToast("🚫 Solicitação de saque rejeitada.");
        else alert("Solicitação de saque rejeitada.");
        fetchRequests();
      } else {
        alert("Erro ao rejeitar: " + (data.error || 'Falha de comunicação'));
      }
    } catch (err: any) {
      alert("Erro ao rejeitar solicitação: " + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const formatMoney = (val?: number) => `R$ ${Number(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch (_) { return dateStr; }
  };

  const filteredRequests = requests.filter((r: any) => {
    const pName = r.partner?.name || '';
    const pEmail = r.partner?.email || '';
    const pPhone = r.partner?.phone || '';
    const term = searchTerm.toLowerCase();
    return pName.toLowerCase().includes(term) || pEmail.toLowerCase().includes(term) || pPhone.includes(term) || (r.id && r.id.includes(term));
  });

  return (
    <div className="space-y-6">
      {/* Bloco de Configuração do Modo de Pagamento Automático */}
      <div className="bg-gradient-to-r from-purple-900 via-zinc-900 to-zinc-900 text-white rounded-3xl p-6 border border-purple-800/80 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-purple-800/60 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-800/60 text-purple-200 rounded-2xl border border-purple-600/40">
              <Zap size={22} />
            </div>
            <div>
              <h3 className="font-extrabold text-lg">Modo de Pagamento Automático</h3>
              <p className="text-xs text-purple-200/80">
                Aprova e paga autonomamente as solicitações pendentes no horário configurado
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-purple-950/60 px-4 py-2 rounded-2xl border border-purple-700/50">
            <span className="text-xs font-bold text-zinc-300">Pagamento Automático</span>
            <button
              disabled={savingSettings}
              onClick={() => handleSaveSettings({ auto_payout_enabled: !payoutSettings.auto_payout_enabled })}
              className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                payoutSettings.auto_payout_enabled ? 'bg-emerald-500 justify-end' : 'bg-zinc-700 justify-start'
              }`}
            >
              <div className="bg-white w-4 h-4 rounded-full shadow-md"></div>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="bg-zinc-950/50 p-3.5 rounded-2xl border border-zinc-800 space-y-1">
            <span className="text-zinc-400 font-bold">⏰ Horário da Execução Diária</span>
            <div className="flex items-center gap-2 mt-1">
              <input
                type="time"
                value={payoutSettings.auto_payout_time}
                onChange={e => handleSaveSettings({ auto_payout_time: e.target.value })}
                disabled={!payoutSettings.auto_payout_enabled || savingSettings}
                className="bg-zinc-900 border border-purple-700/50 text-white font-black text-base px-3 py-1.5 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-40"
              />
              <span className="text-[10px] text-zinc-400">({payoutSettings.auto_payout_timezone})</span>
            </div>
          </div>

          <div className="bg-zinc-950/50 p-3.5 rounded-2xl border border-zinc-800 space-y-1">
            <span className="text-zinc-400 font-bold">💵 Valor Mínimo de Saque (R$)</span>
            <div className="flex items-center gap-2 mt-1">
              <span className="font-bold text-zinc-300">R$</span>
              <input
                type="number"
                step="5"
                min="5"
                value={payoutSettings.min_withdrawal_value}
                onChange={e => handleSaveSettings({ min_withdrawal_value: Number(e.target.value) })}
                disabled={savingSettings}
                className="bg-zinc-900 border border-purple-700/50 text-white font-black text-base px-3 py-1.5 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 w-28"
              />
            </div>
          </div>

          <div className="bg-zinc-950/50 p-3.5 rounded-2xl border border-zinc-800 space-y-1">
            <span className="text-zinc-400 font-bold">📅 Última Varredura Automática</span>
            <div className="text-xs font-bold text-purple-200 mt-2">
              {formatDate(payoutSettings.last_auto_payout_run_at || undefined)}
            </div>
          </div>
        </div>
      </div>

      {/* Tabela e Filtros de Solicitações de Saque */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-extrabold text-lg text-zinc-900 dark:text-white flex items-center gap-2">
              <ArrowDownToLine className="text-purple-600" size={20} /> Solicitações de Saque de Parceiros
            </h3>
            <p className="text-xs text-zinc-500">
              Aprovação manual e histórico dos saques realizados na plataforma
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-2.5 text-zinc-400" size={16} />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Pesquisar por nome ou e-mail..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <button
              onClick={() => fetchRequests(activeTab)}
              disabled={loading}
              className="p-2.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-xl transition"
              title="Atualizar lista"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Abas de Status */}
        <div className="flex gap-2 overflow-x-auto border-b border-zinc-200 dark:border-zinc-800 pb-2">
          <button
            onClick={() => setActiveTab('PENDENTE')}
            className={`px-4 py-2 rounded-xl font-bold text-xs transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'PENDENTE'
                ? 'bg-amber-600 text-white shadow-md'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200'
            }`}
          >
            <Clock size={13} /> Pendentes
          </button>
          <button
            onClick={() => setActiveTab('PAGO')}
            className={`px-4 py-2 rounded-xl font-bold text-xs transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'PAGO'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200'
            }`}
          >
            <CheckCircle2 size={13} /> Pagos
          </button>
          <button
            onClick={() => setActiveTab('REJEITADO')}
            className={`px-4 py-2 rounded-xl font-bold text-xs transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'REJEITADO'
                ? 'bg-red-600 text-white shadow-md'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200'
            }`}
          >
            <XCircle size={13} /> Rejeitados
          </button>
          <button
            onClick={() => setActiveTab('FALHOU')}
            className={`px-4 py-2 rounded-xl font-bold text-xs transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'FALHOU'
                ? 'bg-rose-700 text-white shadow-md'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200'
            }`}
          >
            <AlertCircle size={13} /> Falhas
          </button>
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 rounded-xl font-bold text-xs transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'all'
                ? 'bg-purple-600 text-white shadow-md'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200'
            }`}
          >
            📋 Todos ({requests.length})
          </button>
        </div>

        {/* Tabela de Saques */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-max">
            <thead className="bg-zinc-50 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 font-bold uppercase border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                <th className="p-3">Parceiro / Papel</th>
                <th className="p-3">Valor Solicitado</th>
                <th className="p-3">Chave Pix / Cadastro</th>
                <th className="p-3">Data / Origem</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {filteredRequests.map((req: any) => {
                const partner = req.partner || {};
                const isPending = req.status === 'PENDENTE';
                const pixDestino = partner.cpf_cnpj || partner.pix_key || partner.email || partner.asaas_wallet_id || '—';

                return (
                  <tr key={req.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition">
                    <td className="p-3 font-bold text-zinc-900 dark:text-white">
                      <div>{partner.name || 'Parceiro'}</div>
                      <div className="text-[10px] font-semibold text-purple-600 dark:text-purple-400 uppercase">{req.role || partner.role || 'loja'}</div>
                      <div className="text-[10px] text-zinc-400 font-normal">{partner.phone || partner.email}</div>
                    </td>

                    <td className="p-3 font-black text-sm text-zinc-900 dark:text-white">
                      {formatMoney(req.requested_amount)}
                      {req.order_ids && req.order_ids.length > 0 && (
                        <div className="text-[10px] text-zinc-400 font-normal">{req.order_ids.length} pedido(s)</div>
                      )}
                    </td>

                    <td className="p-3 text-zinc-700 dark:text-zinc-300 font-mono">
                      <div>{pixDestino}</div>
                      {req.pix_key_used && (
                        <div className="text-[10px] text-emerald-600 font-sans">Usado: {req.pix_key_used}</div>
                      )}
                    </td>

                    <td className="p-3 text-zinc-600 dark:text-zinc-400">
                      <div>{formatDate(req.created_at)}</div>
                      {req.processed_automatically && (
                        <span className="text-[9px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-bold">🤖 Varredura Automática</span>
                      )}
                    </td>

                    <td className="p-3">
                      {req.status === 'PENDENTE' && <span className="bg-amber-100 text-amber-800 px-2 py-1 rounded text-[10px] font-bold uppercase">Pendente</span>}
                      {req.status === 'APROVADO' && <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-[10px] font-bold uppercase">Aprovado</span>}
                      {req.status === 'PAGO' && <span className="bg-emerald-100 text-emerald-800 px-2 py-1 rounded text-[10px] font-bold uppercase">Pago Pix</span>}
                      {req.status === 'REJEITADO' && <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-[10px] font-bold uppercase">Rejeitado</span>}
                      {req.status === 'FALHOU' && <span className="bg-rose-100 text-rose-800 px-2 py-1 rounded text-[10px] font-bold uppercase">Falhou</span>}
                      
                      {req.rejection_reason && (
                        <div className="text-[10px] text-red-500 font-medium max-w-xs mt-0.5">{req.rejection_reason}</div>
                      )}
                      {req.failure_reason && (
                        <div className="text-[10px] text-red-500 font-medium max-w-xs mt-0.5">{req.failure_reason}</div>
                      )}
                    </td>

                    <td className="p-3 text-right">
                      {isPending ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            disabled={processingId === req.id}
                            onClick={() => handleApprove(req)}
                            className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-zinc-400 text-white font-bold px-3 py-1.5 rounded-lg shadow transition active:scale-95 flex items-center gap-1 cursor-pointer text-xs"
                          >
                            {processingId === req.id ? '⏳...' : '✅ Aprovar'}
                          </button>
                          <button
                            disabled={processingId === req.id}
                            onClick={() => handleReject(req)}
                            className="bg-red-100 hover:bg-red-200 text-red-700 font-bold px-3 py-1.5 rounded-lg transition active:scale-95 cursor-pointer text-xs"
                          >
                            ❌ Rejeitar
                          </button>
                        </div>
                      ) : (
                        <span className="text-zinc-400 italic text-[11px]">Concluído</span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {filteredRequests.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center p-8 text-zinc-400">
                    Nenhuma solicitação de saque encontrada com estes filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
