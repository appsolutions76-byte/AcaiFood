"use client";

import React, { useState, useEffect } from 'react';
import { getAuthHeaders } from '@/store/useAppStore';
import { Wallet, ArrowDownToLine, Clock, CheckCircle2, XCircle, AlertCircle, RefreshCw, KeyRound } from 'lucide-react';

interface PartnerWithdrawalSectionProps {
  partnerId: string;
  role: string;
  showToast?: (msg: string) => void;
}

export function PartnerWithdrawalSection({ partnerId, role, showToast }: PartnerWithdrawalSectionProps) {
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [balanceData, setBalanceData] = useState<{
    totalDisponivel: number;
    minWithdrawalValue: number;
    canRequest: boolean;
    pendingRequest: any;
    recentRequests: any[];
  } | null>(null);

  const fetchBalance = async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/asaas/withdrawals', { headers });
      const data = await res.json();
      if (res.ok && data.success) {
        setBalanceData(data);
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

    if (!confirm(`Deseja solicitar o saque de todo o seu saldo disponível (R$ ${balanceData.totalDisponivel.toFixed(2)})?`)) {
      return;
    }

    setRequesting(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/asaas/withdrawals', {
        method: 'POST',
        headers
      });
      const data = await res.json();

      if (res.ok && data.success) {
        if (showToast) showToast("✅ " + data.message);
        else alert(data.message);
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
              <h3 className="font-bold text-sm text-zinc-300">Saldo Disponível para Saque</h3>
              <p className="text-[11px] text-zinc-400">Repasses acumulados de pedidos concluídos</p>
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
            <div className="text-xs text-zinc-400 mt-1 font-medium">
              Valor mínimo configurado: <span className="text-purple-300 font-bold">{formatMoney(minVal)}</span>
            </div>
          </div>

          {pendingReq ? (
            <div className="bg-amber-950/70 border border-amber-600/50 rounded-2xl p-3.5 space-y-1 sm:max-w-xs">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
                <Clock size={14} className="animate-spin" /> Solicitação em Andamento
              </div>
              <div className="text-sm font-black text-white">{formatMoney(pendingReq.requested_amount)}</div>
              <div className="text-[10px] text-amber-200/80">
                {formatDate(pendingReq.created_at)} • Aguardando aprovação
              </div>
            </div>
          ) : (
            <div>
              <button
                disabled={!balanceData?.canRequest || requesting}
                onClick={handleRequestWithdrawal}
                className={`px-5 py-3.5 rounded-2xl font-bold text-sm shadow-lg transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer ${
                  balanceData?.canRequest && !requesting
                    ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-900/50'
                    : 'bg-zinc-800 text-zinc-500 border border-zinc-700/50 cursor-not-allowed'
                }`}
              >
                <ArrowDownToLine size={18} />
                {requesting ? 'Enviando...' : 'Solicitar Saque'}
              </button>
            </div>
          )}
        </div>

        {!pendingReq && totalDisponivel > 0 && totalDisponivel < minVal && (
          <div className="mt-4 text-xs text-amber-300 bg-amber-950/40 border border-amber-900/50 rounded-xl p-2.5 flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0" />
            <span>Faltam {formatMoney(minVal - totalDisponivel)} de repasses para atingir o valor mínimo de saque de {formatMoney(minVal)}.</span>
          </div>
        )}
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
                  {req.status === 'APROVADO' && (
                    <span className="bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-300 dark:border-blue-800 px-2.5 py-1 rounded-full font-bold uppercase text-[10px] flex items-center gap-1">
                      <Clock size={11} /> Aprovado
                    </span>
                  )}
                  {req.status === 'PAGO' && (
                    <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 px-2.5 py-1 rounded-full font-bold uppercase text-[10px] flex items-center gap-1">
                      <CheckCircle2 size={11} /> Pago Pix
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
