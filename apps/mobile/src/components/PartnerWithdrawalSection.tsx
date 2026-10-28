"use client";

import React, { useState, useEffect } from 'react';
import { getAuthHeaders } from '@/store/useAppStore';
import { Wallet, ArrowDownToLine, Clock, CheckCircle2, XCircle, AlertCircle, RefreshCw, KeyRound } from 'lucide-react';
import { SeloAsaas } from '@/components/SeloAsaas';

interface PartnerWithdrawalSectionProps {
  partnerId: string;
  role: string;
  showToast?: (msg: string) => void;
  onBalanceLoaded?: (balance: number) => void;
}

export function PartnerWithdrawalSection({ partnerId, role, showToast, onBalanceLoaded }: PartnerWithdrawalSectionProps) {
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [balanceData, setBalanceData] = useState<{
    totalDisponivel: number;
    minWithdrawalValue: number;
    canRequest: boolean;
    accountStatus?: string;
    accountApproved?: boolean;
    mirroredFromAsaas?: boolean;
    subaccountBalance?: number;
    internalOrderBalance?: number;
    reservedBalance?: number;
    pendingRequest: any;
    recentRequests: any[];
    payoutHold?: boolean;
    payoutHoldMessage?: string | null;
    instantPayout?: boolean;
  } | null>(null);
  // R34: valor do saque (vazio = todo o saldo livre)
  const [amountInput, setAmountInput] = useState('');

  const fetchBalance = async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/asaas/withdrawals', { headers });
      const data = await res.json();
      if (res.ok && data.success) {
        setBalanceData(data);
        if (typeof onBalanceLoaded === 'function') {
          onBalanceLoaded(Number(data.totalDisponivel || 0));
        }
      } else {
        console.warn("Aviso ao carregar dados de saque:", data.error);
      }
    } catch (err) {
      console.error("Exceção ao buscar saldo:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (partnerId) fetchBalance();
  }, [partnerId]);

  const handleRequestWithdrawal = async () => {
    if (!balanceData || !balanceData.canRequest) return;

    const free = balanceData.totalDisponivel;
    const typed = amountInput.trim() ? Number(amountInput.replace(',', '.')) : NaN;
    const total = amountInput.trim() ? typed : free;
    if (!Number.isFinite(total) || total <= 0) {
      alert('Informe um valor válido ou deixe em branco para sacar todo o saldo livre.');
      return;
    }
    if (total < (balanceData.minWithdrawalValue || 0)) {
      alert(`O valor mínimo de saque é ${formatMoney(balanceData.minWithdrawalValue)}.`);
      return;
    }
    if (total > free + 0.001) {
      alert(`O valor é maior que o seu saldo livre (${formatMoney(free)}).`);
      return;
    }
    const net = Math.max(0, total - 0.99);
    const confirmMsg = `Confirmar saque de ${formatMoney(total)}?\n\n` +
      `• Tarifa de transferência Pix Asaas: - ${formatMoney(0.99)}\n` +
      `• Valor líquido que cairá na sua chave Pix: ${formatMoney(net)}\n\n` +
      (balanceData.instantPayout
        ? `O Pix é enviado agora para a chave do seu CPF/CNPJ.`
        : `O Pix é enviado para a chave do seu CPF/CNPJ depois da liberação do AçaíFood.`);

    if (!confirm(confirmMsg)) {
      return;
    }

    setRequesting(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/asaas/withdrawals', {
        method: 'POST',
        headers,
        body: JSON.stringify(amountInput.trim() ? { amount: Number(amountInput.replace(',', '.')) } : {})
      });
      const data = await res.json();

      if (res.ok && data.success) {
        if (showToast) showToast("✅ " + data.message);
        else alert(data.message);
        setAmountInput('');
        fetchBalance();
      } else {
        const errorMsg = data.error || 'Falha ao enviar solicitação de saque.';
        if (showToast) showToast("❌ " + errorMsg);
        else alert(errorMsg);
      }
    } catch (err: any) {
      alert("Erro ao solicitar saque: " + err.message);
    } finally {
      setRequesting(false);
    }
  };

  const formatMoney = (val?: number) => `R$ ${Number(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch (_) { return dateStr; }
  };

  if (loading && !balanceData) {
    return (
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm animate-pulse flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-4 w-32 bg-zinc-200 dark:bg-zinc-800 rounded"></div>
          <div className="h-8 w-40 bg-zinc-300 dark:bg-zinc-700 rounded"></div>
        </div>
        <div className="h-10 w-28 bg-zinc-200 dark:bg-zinc-800 rounded-xl"></div>
      </div>
    );
  }

  const totalDisponivel = balanceData?.totalDisponivel || 0;
  const minVal = balanceData?.minWithdrawalValue || 20;
  const pendingReq = balanceData?.pendingRequest;
  const recentList = balanceData?.recentRequests || [];
  const accountApproved = balanceData?.accountApproved === true;

  return (
    <div className="space-y-4">
      {/* Cartão de Saldo e Solicitação */}
      <div className="bg-gradient-to-br from-zinc-900 via-zinc-900 to-purple-950/80 border border-purple-900/40 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
          <Wallet size={120} />
        </div>

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2.5 rounded-2xl bg-purple-600/30 border border-purple-500/30 text-purple-300">
              <Wallet size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-sm text-zinc-300">Saldo Disponível para Saque</h3>
                {balanceData?.mirroredFromAsaas && (
                  <span className="text-[10px] bg-emerald-950/80 text-emerald-300 border border-emerald-600/50 font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    Subconta Asaas
                  </span>
                )}
              </div>
              <p className="text-[11px] text-zinc-400">
                {balanceData?.mirroredFromAsaas
                  ? "Espelhado em tempo real da sua subconta bancária no Asaas"
                  : "Transferência automática via Pix para a sua conta bancária"}
              </p>
            </div>
          </div>
          <button
            onClick={fetchBalance}
            disabled={loading}
            className="p-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-300 transition active:scale-95"
            title="Atualizar saldo"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mt-2">
          <div>
            <div className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              {formatMoney(totalDisponivel)}
            </div>
            <div className="text-xs text-zinc-400 mt-1 font-medium space-y-0.5">
              <div>Valor mínimo configurado: <span className="text-purple-300 font-bold">{formatMoney(minVal)}</span></div>
              {Number(balanceData?.reservedBalance || 0) > 0 && (
                <div className="text-[11px] text-sky-300 font-semibold">
                  Reservado para pedidos em andamento: {formatMoney(Number(balanceData?.reservedBalance || 0))} <span className="text-zinc-400 font-normal">(liberado após a entrega e o pagamento da corrida)</span>
                </div>
              )}
              {Number(balanceData?.internalOrderBalance || 0) > 0 && (
                <div className="text-[11px] text-amber-300 font-semibold">
                  A caminho da sua subconta: {formatMoney(Number(balanceData?.internalOrderBalance || 0))} <span className="text-zinc-400 font-normal">(entregas concluídas aguardando repasse)</span>
                </div>
              )}
              {totalDisponivel > 0.99 && (
                <div className="text-[11px] text-emerald-400 font-semibold">
                  Líquido Pix a receber: {formatMoney(totalDisponivel - 0.99)} <span className="text-zinc-400 font-normal">(tarifa Pix Asaas: {formatMoney(0.99)})</span>
                </div>
              )}
            </div>
          </div>

          {pendingReq ? (
            <div className={`border rounded-2xl p-3.5 space-y-1 sm:max-w-xs ${
              pendingReq.status === 'APROVADO' || pendingReq.status === 'PROCESSING'
                ? 'bg-blue-950/70 border-blue-600/50'
                : 'bg-amber-950/70 border-amber-600/50'
            }`}>
              <div className={`flex items-center gap-1.5 text-xs font-bold ${
                pendingReq.status === 'APROVADO' || pendingReq.status === 'PROCESSING'
                  ? 'text-blue-400'
                  : 'text-amber-400'
              }`}>
                <Clock size={14} className="animate-spin" /> 
                {pendingReq.status === 'APROVADO' || pendingReq.status === 'PROCESSING'
                  ? 'Transferência em Processamento'
                  : 'Solicitação em Andamento'}
              </div>
              <div className="text-sm font-black text-white">
                {formatMoney(pendingReq.requested_amount)}
                <span className="text-[11px] text-emerald-400 font-semibold block">
                  Líquido Pix: {formatMoney(Math.max(0, Number(pendingReq.requested_amount || 0) - 0.99))} <span className="text-zinc-400 font-normal">(taxa: {formatMoney(0.99)})</span>
                </span>
              </div>
              <div className={`text-[10px] ${
                pendingReq.status === 'APROVADO' || pendingReq.status === 'PROCESSING'
                  ? 'text-blue-200/80'
                  : 'text-amber-200/80'
              }`}>
                {formatDate(pendingReq.created_at)} • {
                  pendingReq.status === 'APROVADO' || pendingReq.status === 'PROCESSING'
                    ? 'Pagamento na subconta Asaas em andamento'
                    : 'Aguardando aprovação'
                }
              </div>
            </div>
          ) : balanceData?.payoutHold ? (
            <div className="text-xs text-red-200 bg-red-950/60 border border-red-700/50 rounded-2xl p-3 sm:max-w-xs">
              🔒 {balanceData?.payoutHoldMessage || 'Saques suspensos por segurança. Fale com o suporte do AçaíFood.'}
            </div>
          ) : !accountApproved ? (
            <div className="text-xs text-amber-200 bg-amber-950/60 border border-amber-700/50 rounded-2xl p-3 sm:max-w-xs">
              Saque liberado depois que sua conta Asaas for aprovada. Veja no cartão "Minha conta Asaas", no topo da página, o que falta.
            </div>
          ) : (
            <div className="space-y-2 sm:max-w-xs">
              {balanceData?.canRequest && (
                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1">Valor do saque (vazio = todo o saldo livre)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs font-bold text-zinc-400">R$</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min={minVal}
                      max={totalDisponivel}
                      step="0.01"
                      value={amountInput}
                      onChange={e => setAmountInput(e.target.value)}
                      placeholder={totalDisponivel.toFixed(2)}
                      className="w-full pl-9 pr-3 py-2 text-sm font-bold bg-zinc-800 border border-zinc-700 rounded-xl text-white outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>
              )}
              <button
                disabled={!balanceData?.canRequest || requesting}
                onClick={handleRequestWithdrawal}
                className={`px-5 py-3.5 rounded-2xl font-bold text-sm shadow-lg transition active:scale-95 flex items-center justify-center gap-2 ${
                  balanceData?.canRequest && !requesting
                    ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-900/50 cursor-pointer'
                    : 'bg-zinc-800 text-zinc-500 border border-zinc-700/50 cursor-not-allowed opacity-75'
                }`}
                title={
                  !balanceData?.canRequest 
                    ? (totalDisponivel < minVal 
                        ? `Saldo disponível (${formatMoney(totalDisponivel)}) abaixo do valor mínimo (${formatMoney(minVal)})` 
                        : 'Saque não disponível no momento')
                    : 'Solicitar transferência para sua subconta Asaas'
                }
              >
                <ArrowDownToLine size={18} />
                {requesting ? 'Enviando...' : (balanceData?.instantPayout ? 'Sacar agora' : 'Solicitar Saque')}
              </button>
            </div>
          )}
        </div>

        {accountApproved && !pendingReq && totalDisponivel === 0 && (
          <div className="mt-4 text-xs text-zinc-400 bg-zinc-800/40 border border-zinc-700/40 rounded-xl p-2.5 flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0 text-zinc-400" />
            <span>Nenhum repasse de entrega pendente no momento. Quando concluir novos pedidos com validação de PIN, seu saldo disponível será liberado aqui.</span>
          </div>
        )}

        {accountApproved && !pendingReq && totalDisponivel > 0 && totalDisponivel < minVal && (
          <div className="mt-4 text-xs text-amber-300 bg-amber-950/40 border border-amber-900/50 rounded-xl p-2.5 flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0" />
            <span>Faltam {formatMoney(minVal - totalDisponivel)} de repasses para atingir o valor mínimo de saque de {formatMoney(minVal)}.</span>
          </div>
        )}

        <div className="mt-4 pt-3 border-t border-purple-900/40 flex items-center justify-between flex-wrap gap-2">
          <span className="text-[10px] text-zinc-400 font-medium">Operações Financeiras & BaaS</span>
          <SeloAsaas variant="negativo-branco" width={130} height={39} />
        </div>
      </div>

      {/* Histórico Recente de Solicitações */}
      {recentList.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm space-y-3">
          <h4 className="font-bold text-sm text-zinc-800 dark:text-zinc-200 flex items-center justify-between">
            <span>📋 Histórico de Saques</span>
            <span className="text-xs text-zinc-400 font-normal">{recentList.length} registro(s)</span>
          </h4>

          <div className="divide-y divide-zinc-100 dark:divide-zinc-800 text-xs">
            {recentList.map((req: any) => (
              <div key={req.id} className="py-2.5 flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="font-bold text-zinc-900 dark:text-white text-sm">
                    {formatMoney(req.requested_amount)}
                  </div>
                  <div className="text-[11px] text-zinc-400">
                    {formatDate(req.created_at)}
                  </div>
                  {req.rejection_reason && (
                    <div className="text-[10px] text-red-500 font-medium mt-0.5">
                      Motivo da rejeição: {req.rejection_reason}
                    </div>
                  )}
                  {req.failure_reason && (
                    <div className="text-[10px] text-red-500 font-medium mt-0.5">
                      Erro no envio: {req.failure_reason}
                    </div>
                  )}
                </div>

                <div className="shrink-0">
                  {req.status === 'PENDENTE' && (
                    <span className="bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-800 px-2.5 py-1 rounded-full font-bold uppercase text-[10px] flex items-center gap-1">
                      <Clock size={11} /> Pendente
                    </span>
                  )}
                  {req.status === 'PROCESSING' && (
                    <span className="bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800 px-2.5 py-1 rounded-full font-bold uppercase text-[10px] flex items-center gap-1">
                      <Clock size={11} className="animate-spin" /> Em Processamento (Subconta)
                    </span>
                  )}
                  {req.status === 'APROVADO' && (
                    <span className="bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-300 dark:border-blue-800 px-2.5 py-1 rounded-full font-bold uppercase text-[10px] flex items-center gap-1">
                      <Clock size={11} /> Aprovado
                    </span>
                  )}
                  {req.status === 'PAGO' && (
                    <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 px-2.5 py-1 rounded-full font-bold uppercase text-[10px] flex items-center gap-1">
                      <CheckCircle2 size={11} /> Pago
                    </span>
                  )}
                  {req.status === 'REJEITADO' && (
                    <span className="bg-red-100 text-red-800 dark:bg-red-950/80 dark:text-red-300 border border-red-300 dark:border-red-800 px-2.5 py-1 rounded-full font-bold uppercase text-[10px] flex items-center gap-1">
                      <XCircle size={11} /> Rejeitado
                    </span>
                  )}
                  {req.status === 'FALHOU' && (
                    <span className="bg-red-100 text-red-800 dark:bg-red-950/80 dark:text-red-300 border border-red-300 dark:border-red-800 px-2.5 py-1 rounded-full font-bold uppercase text-[10px] flex items-center gap-1">
                      <AlertCircle size={11} /> Falhou
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
