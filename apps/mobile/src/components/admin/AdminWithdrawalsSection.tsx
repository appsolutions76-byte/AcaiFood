"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { getAuthHeaders } from '@/store/useAppStore';
import { 
  ArrowDownToLine, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertCircle, 
  RefreshCw, 
  Zap, 
  Search,
  DollarSign,
  TrendingUp,
  Wallet
} from 'lucide-react';

interface AdminWithdrawalsSectionProps {
  showToast?: (msg: string) => void;
  totalOwedAllPartners?: number;
  pendingPayoutsByCity?: Record<string, { cityName: string; partners: any[]; totalOwed: number }>;
  partnersWithPendingPayouts?: Array<{ user: any; pendingOrders: any[]; amountOwed: number }>;
  pagarTodosParceiros?: (partnersWithOwed: any[], cidadeNome?: string) => Promise<void>;
  isPayingAll?: boolean;
  payAllProgress?: { current: number; total: number; name: string } | null;
  totalVolume?: number;
  appRevenue?: number;
  onRefreshAll?: () => void;
}

export function AdminWithdrawalsSection({ 
  showToast,
  totalOwedAllPartners = 0,
  pendingPayoutsByCity = {},
  partnersWithPendingPayouts = [],
  pagarTodosParceiros,
  isPayingAll = false,
  payAllProgress = null,
  totalVolume = 0,
  appRevenue = 0,
  onRefreshAll
}: AdminWithdrawalsSectionProps) {
  const [activeTab, setActiveTab] = useState<'PENDENTE' | 'PAGO' | 'REJEITADO' | 'FALHOU' | 'all'>('PENDENTE');
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCityToPay, setSelectedCityToPay] = useState<string>('ALL');

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
  const [tempMinWithdrawal, setTempMinWithdrawal] = useState<number>(20);
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
        setTempMinWithdrawal(Number(data.settings.min_withdrawal_value ?? 20));
      }
    } catch (err) {
      console.error("Erro ao carregar configurações de pagamento:", err);
    }
  };

  const refreshAllData = async (statusStr = activeTab) => {
    await fetchRequests(statusStr);
    await fetchSettings();
    if (onRefreshAll) {
      onRefreshAll();
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
        refreshAllData();
      } else {
        const errorMsg = data.error || 'Falha ao aprovar a solicitação de saque.';
        alert("❌ " + errorMsg);
        refreshAllData();
      }
    } catch (err: any) {
      alert("Erro ao aprovar solicitação: " + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (req: any) => {
    const reason = prompt(`Informe o motivo da rejeição do saque de R$ ${Number(req.requested_amount).toFixed(2)}:`, "Chave Pix incorreta");
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
        refreshAllData();
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

  const currentCityPartners = useMemo(() => {
    if (selectedCityToPay === 'ALL') return partnersWithPendingPayouts;
    return pendingPayoutsByCity[selectedCityToPay]?.partners || [];
  }, [selectedCityToPay, partnersWithPendingPayouts, pendingPayoutsByCity]);

  const currentCityOwedTotal = useMemo(() => {
    return currentCityPartners.reduce((acc, curr) => acc + curr.amountOwed, 0);
  }, [currentCityPartners]);

  const pendingWithdrawalsTotal = useMemo(() => {
    return requests
      .filter(r => r.status === 'PENDENTE')
      .reduce((acc, r) => acc + Number(r.requested_amount || 0), 0);
  }, [requests]);

  const pendingWithdrawalsCount = useMemo(() => {
    return requests.filter(r => r.status === 'PENDENTE').length;
  }, [requests]);

  const filteredRequests = requests.filter((r: any) => {
    const pName = r.partner?.name || '';
    const pEmail = r.partner?.email || '';
    const pPhone = r.partner?.phone || '';
    const term = searchTerm.toLowerCase();
    return pName.toLowerCase().includes(term) || pEmail.toLowerCase().includes(term) || pPhone.includes(term) || (r.id && r.id.includes(term));
  });

  return (
    <div className="space-y-6">
      {/* 1. Header Unificado e Cards de Resumo Financeiro da Operação */}
      <div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-3 mb-4">
          <div>
            <h2 className="text-xl font-extrabold text-zinc-900 dark:text-white flex items-center gap-2">
              <Wallet className="text-purple-600" size={24} /> Central Financeira & Repasses Asaas
            </h2>
            <p className="text-xs text-zinc-500">
              Gestão integrada de faturamento, liquidações em lote por praça e autorização de saques Pix
            </p>
          </div>
          <button
            onClick={() => refreshAllData()}
            disabled={loading}
            className="px-3 py-1.5 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 hover:bg-purple-100 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Atualizar Financeiro
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Volume Total Transacionado */}
          <div className="bg-gradient-to-br from-indigo-900/10 to-purple-900/20 dark:from-indigo-950/40 dark:to-purple-950/40 border border-indigo-200 dark:border-indigo-800/60 p-4 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase text-indigo-700 dark:text-indigo-400">Volume Transacionado</span>
              <TrendingUp size={18} className="text-indigo-600 dark:text-indigo-400" />
            </div>
            <p className="text-2xl font-black text-indigo-950 dark:text-white mt-1">{formatMoney(totalVolume)}</p>
            <p className="text-[10px] text-zinc-500 mt-1">Total bruto (produtos + fretes entregues)</p>
          </div>

          {/* Receita da Plataforma */}
          <div className="bg-gradient-to-br from-purple-900/10 to-pink-900/20 dark:from-purple-950/40 dark:to-pink-950/40 border border-purple-200 dark:border-purple-800/60 p-4 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase text-purple-700 dark:text-purple-400">Receita AçaíFood</span>
              <DollarSign size={18} className="text-purple-600 dark:text-purple-400" />
            </div>
            <p className="text-2xl font-black text-purple-950 dark:text-white mt-1">{formatMoney(appRevenue)}</p>
            <p className="text-[10px] text-zinc-500 mt-1">Taxas retidas (vendas + comissão de frete)</p>
          </div>

          {/* Saldo Pendente de Repasse aos Parceiros */}
          <div className="bg-gradient-to-br from-amber-900/10 to-orange-900/20 dark:from-amber-950/40 dark:to-orange-950/40 border border-amber-200 dark:border-amber-800/60 p-4 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase text-amber-700 dark:text-amber-400">Pendente de Repasse</span>
              <Clock size={18} className="text-amber-600 dark:text-amber-400" />
            </div>
            <p className="text-2xl font-black text-amber-950 dark:text-white mt-1">{formatMoney(totalOwedAllPartners)}</p>
            <p className="text-[10px] text-zinc-500 mt-1">{partnersWithPendingPayouts.length} parceiro(s) com saldo a liquidar</p>
          </div>

          {/* Saques Solicitados Aguardando Aprovação */}
          <div className="bg-gradient-to-br from-emerald-900/10 to-teal-900/20 dark:from-emerald-950/40 dark:to-teal-950/40 border border-emerald-200 dark:border-emerald-800/60 p-4 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase text-emerald-700 dark:text-emerald-400">Saques Solicitados</span>
              <ArrowDownToLine size={18} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-2xl font-black text-emerald-950 dark:text-white mt-1">{formatMoney(pendingWithdrawalsTotal)}</p>
            <p className="text-[10px] text-zinc-500 mt-1">{pendingWithdrawalsCount} solicitação(ões) pendente(s)</p>
          </div>
        </div>

        {/* Ajuste Exclusivo de Valor Mínimo de Saque (R$) */}
        <div className="mt-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 rounded-xl text-base font-bold shrink-0">
              💸
            </div>
            <div>
              <h4 className="font-bold text-xs text-zinc-900 dark:text-white uppercase tracking-wider">
                Valor Mínimo para Solicitação de Saque
              </h4>
              <p className="text-[11px] text-zinc-500">
                Define o valor mínimo de saldo acumulado na carteira exigido para Lojas, Fornecedores e Motoristas solicitarem saque Pix.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
            <div className="relative flex-1 sm:w-36">
              <span className="absolute left-3 top-2.5 text-xs font-bold text-zinc-400">R$</span>
              <input
                type="number"
                step="1"
                min="1"
                value={tempMinWithdrawal}
                onChange={(e) => setTempMinWithdrawal(Number(e.target.value))}
                className="w-full pl-9 pr-3 py-2 text-xs font-bold bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 text-zinc-900 dark:text-white"
              />
            </div>
            <button
              disabled={savingSettings}
              onClick={() => handleSaveSettings({ min_withdrawal_value: tempMinWithdrawal })}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-zinc-400 text-white text-xs font-bold rounded-xl transition shadow active:scale-95 whitespace-nowrap cursor-pointer flex items-center gap-1"
            >
              {savingSettings ? 'Salvando...' : '💾 Salvar Saque Mínimo'}
            </button>
          </div>
        </div>
      </div>

      {/* 2. Painel Unificado de Liquidação Rápida em Lote (Geral / Por Cidade) */}
      {pagarTodosParceiros && (
        <div className="bg-gradient-to-r from-purple-900/10 via-indigo-900/10 to-purple-900/5 dark:from-purple-950/40 dark:via-indigo-950/40 dark:to-zinc-900 border border-purple-200 dark:border-purple-800/60 p-5 rounded-3xl shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-950/80 px-2 py-0.5 rounded-md">
                ⚡ Liquidação Direta em Lote (Asaas Pix)
              </span>
              {selectedCityToPay !== 'ALL' && (
                <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-950/80 px-2 py-0.5 rounded-md">
                  🏙️ Praça: {selectedCityToPay}
                </span>
              )}
            </div>

            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-2xl font-black text-zinc-900 dark:text-white">
                {formatMoney(currentCityOwedTotal)}
              </span>
              <span className="text-xs text-zinc-500 font-medium">
                a quitar para {currentCityPartners.length} parceiro(s) {selectedCityToPay !== 'ALL' ? `em ${selectedCityToPay}` : 'em todas as cidades'}
              </span>
            </div>

            <p className="text-[11px] text-zinc-500">
              Transfere instantaneamente o saldo líquido dos pedidos entregues direto para a chave Pix dos parceiros no Asaas.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full lg:w-auto">
            {/* Seletor de Cidades */}
            <select
              value={selectedCityToPay}
              onChange={(e) => setSelectedCityToPay(e.target.value)}
              className="bg-white dark:bg-zinc-900 border border-purple-300 dark:border-purple-700 text-xs font-bold text-zinc-800 dark:text-zinc-200 rounded-xl px-3 py-2.5 shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
            >
              <option value="ALL">🌐 Todas as Cidades ({formatMoney(totalOwedAllPartners)})</option>
              {Object.values(pendingPayoutsByCity).map(c => (
                <option key={c.cityName} value={c.cityName}>
                  🏙️ {c.cityName} ({formatMoney(c.totalOwed)} • {c.partners.length} parc.)
                </option>
              ))}
            </select>

            {/* Botão de Disparo */}
            {currentCityPartners.length > 0 ? (
              <button
                disabled={isPayingAll}
                onClick={() => pagarTodosParceiros(currentCityPartners, selectedCityToPay === 'ALL' ? undefined : selectedCityToPay)}
                className="bg-purple-600 hover:bg-purple-700 disabled:bg-zinc-400 text-white font-bold text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 whitespace-nowrap active:scale-95 cursor-pointer"
              >
                <Zap size={16} className={isPayingAll ? 'animate-spin' : ''} />
                {isPayingAll 
                  ? (payAllProgress ? `⏳ Pagando ${payAllProgress.current}/${payAllProgress.total} (${payAllProgress.name})...` : 'Processando...')
                  : (selectedCityToPay === 'ALL' 
                      ? '⚡ Pagar Todos (Geral)' 
                      : `⚡ Pagar Todos de ${selectedCityToPay}`)}
              </button>
            ) : (
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/40 px-3 py-2 rounded-xl border border-emerald-200 dark:border-emerald-800/40 text-center">
                ✨ Nenhum repasse pendente nesta seleção
              </span>
            )}
          </div>
        </div>
      )}



      {/* 4. Tabela e Filtros de Solicitações de Saque Individuais */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-extrabold text-lg text-zinc-900 dark:text-white flex items-center gap-2">
              <ArrowDownToLine className="text-purple-600" size={20} /> Solicitações de Saque de Parceiros
            </h3>
            <p className="text-xs text-zinc-500">
              Aprovação manual 1-clique e histórico de saques realizados na plataforma
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
              className="p-2.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-xl transition cursor-pointer"
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
            <Clock size={13} /> Pendentes ({pendingWithdrawalsCount})
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

