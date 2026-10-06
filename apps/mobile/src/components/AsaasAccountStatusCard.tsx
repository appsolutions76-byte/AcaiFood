"use client";

import React, { useEffect, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { ExternalLink, FileText, CheckCircle2, Clock, AlertTriangle, ShieldCheck } from 'lucide-react';

export function AsaasAccountStatusCard() {
  const currentUser = useAppStore((state: any) => state.currentUser);
  const [loading, setLoading] = useState(false);
  const [docData, setDocData] = useState<{
    hasAccount: boolean;
    status: string;
    splitEnabled: boolean;
    onboardingUrl?: string | null;
    documents?: any[];
  } | null>(null);

  const fetchDocStatus = async () => {
    if (!currentUser?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/asaas/documents?userId=${currentUser.id}`);
      const data = await res.json();
      if (data && data.success) {
        setDocData(data);
      }
    } catch (err) {
      console.warn('[AsaasAccountStatusCard] Erro ao consultar documentos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocStatus();
  }, [currentUser?.id]);

  if (!currentUser) return null;

  const currentStatus = docData?.status || currentUser.asaas_account_status || 'NO_ACCOUNT';
  const isApproved = currentStatus === 'APPROVED';
  const onboardingUrl = docData?.onboardingUrl;
  const pendingDocs = docData?.documents || [];

  if (currentStatus === 'NO_ACCOUNT') {
    return (
      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 p-4 rounded-2xl shadow-sm">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 font-bold text-sm">
            <AlertTriangle size={18} className="text-amber-600 shrink-0" />
            <span>Subconta de pagamento Asaas ainda não vinculada.</span>
          </div>
          <p className="text-xs text-amber-700 dark:text-amber-300">
            Conclua seu cadastro completo para ativar o recebimento de repasses Pix.
          </p>
        </div>
      </div>
    );
  }

  if (isApproved) {
    return (
      <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 p-3.5 rounded-2xl flex items-center justify-between gap-3 flex-wrap shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-emerald-500 text-white rounded-xl shadow-sm">
            <ShieldCheck size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm text-emerald-900 dark:text-emerald-100">
                Conta de Pagamento Asaas Aprovada
              </span>
              <span className="bg-emerald-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                Split & Saques Liberados
              </span>
            </div>
            <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">
              Sua conta bancária BaaS está 100% regularizada. Os repasses são creditados no cofre após a validação do PIN.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-900 border border-purple-200 dark:border-purple-900/60 p-4 sm:p-5 rounded-2xl shadow-md space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap border-b border-zinc-100 dark:border-zinc-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-xl">
            <Clock size={20} />
          </div>
          <div>
            <h3 className="font-extrabold text-base text-zinc-900 dark:text-white flex items-center gap-2">
              <span>Status da Conta de Pagamento Asaas</span>
              <span className="bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-amber-300 dark:border-amber-800 uppercase">
                {currentStatus === 'PENDING_DOCUMENTS' ? 'Pendente de Documentos' : 'Em Análise pelo Asaas'}
              </span>
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Sua conta de pagamento é mantida pelo Asaas Gestão Financeira S.A.
            </p>
          </div>
        </div>

        <button
          onClick={fetchDocStatus}
          disabled={loading}
          className="text-xs text-purple-600 dark:text-purple-400 hover:underline font-bold"
        >
          {loading ? 'Consultando status...' : '🔄 Reconsultar'}
        </button>
      </div>

      {/* Linha do tempo KYC */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs pt-1">
        <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-bold flex flex-col items-center gap-1">
          <CheckCircle2 size={16} />
          <span>1. Cadastro Enviado</span>
        </div>
        <div className={`p-2 rounded-xl border font-bold flex flex-col items-center gap-1 ${
          currentStatus === 'PENDING_DOCUMENTS'
            ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 text-amber-800 dark:text-amber-200 animate-pulse'
            : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 text-emerald-700 dark:text-emerald-300'
        }`}>
          <FileText size={16} />
          <span>2. Documentos KYC</span>
        </div>
        <div className={`p-2 rounded-xl border font-bold flex flex-col items-center gap-1 ${
          currentStatus === 'AWAITING_APPROVAL'
            ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 text-amber-800 dark:text-amber-200 animate-pulse'
            : 'bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700 text-zinc-500'
        }`}>
          <Clock size={16} />
          <span>3. Análise (até 48h)</span>
        </div>
        <div className="p-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 text-zinc-400 font-bold flex flex-col items-center gap-1">
          <ShieldCheck size={16} />
          <span>4. Aprovada ✓</span>
        </div>
      </div>

      {/* Botão de Link de Onboarding Oficial do Asaas */}
      {onboardingUrl && (
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-4 rounded-2xl shadow-lg flex items-center justify-between gap-3 flex-wrap border border-purple-400">
          <div>
            <p className="text-xs font-bold text-purple-100 uppercase tracking-wider flex items-center gap-1">
              <span>📸</span> Envio Oficial de Fotos e Documentos
            </p>
            <p className="text-sm font-black text-white leading-tight mt-0.5">
              Envie sua foto de identidade e selfie pelo ambiente seguro do Asaas
            </p>
          </div>
          <a
            href={onboardingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white text-purple-950 font-black px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 hover:bg-purple-50 transition active:scale-95 shadow-md shrink-0 cursor-pointer"
          >
            <span>Enviar Documentos no Asaas</span>
            <ExternalLink size={14} />
          </a>
        </div>
      )}

      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed bg-zinc-50 dark:bg-zinc-950/50 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800">
        📌 <strong>Importante:</strong> De acordo com a regulação bancária (BACEN/Asaas), os valores de repasse só ficam disponíveis no seu cofre para saque após a conclusão da verificação dos seus documentos.
      </p>
    </div>
  );
}

export default AsaasAccountStatusCard;
