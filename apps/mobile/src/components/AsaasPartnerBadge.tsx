import React from 'react';
import { ShieldCheck, Info } from 'lucide-react';

interface AsaasPartnerBadgeProps {
  className?: string;
  variant?: 'footer' | 'badge' | 'inline' | 'subtle';
}

export function AsaasPartnerBadge({ className = '', variant = 'footer' }: AsaasPartnerBadgeProps) {
  if (variant === 'badge') {
    return (
      <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-700 dark:text-purple-300 text-[11px] font-semibold shadow-xs ${className}`}>
        <ShieldCheck size={13} className="text-purple-600 dark:text-purple-400 shrink-0" />
        <span>Parceira Financeira: <strong>Asaas IP S.A. (CNPJ 19.468.242/0001-32)</strong></span>
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <span className={`inline-flex items-center gap-1 text-[11px] text-zinc-500 dark:text-zinc-400 font-medium ${className}`}>
        <ShieldCheck size={12} className="text-emerald-500 shrink-0" />
        <span>Parceira Financeira: <strong>Asaas IP S.A. (CNPJ 19.468.242/0001-32)</strong> (Banco Central do Brasil)</span>
      </span>
    );
  }

  if (variant === 'subtle') {
    return (
      <div className={`text-[11px] text-zinc-500 dark:text-zinc-400 font-medium text-center flex flex-col items-center justify-center gap-0.5 ${className}`}>
        <div className="flex items-center justify-center gap-1">
          <ShieldCheck size={12} className="text-purple-500 shrink-0" />
          <span>Tecnologia AçaíFood • Parceira Financeira <strong>Asaas IP S.A. (CNPJ 19.468.242/0001-32)</strong></span>
        </div>
        <div className="text-[10px] text-zinc-400 dark:text-zinc-500">
          Favorecido no Pix/Banco: <strong>Eletromecânica Baia Ltda</strong> (Empresa detentora da AppSolutions76/AçaíFood)
        </div>
      </div>
    );
  }

  return (
    <div className={`text-center py-2 text-[11px] text-zinc-500 dark:text-zinc-400 font-medium flex flex-col items-center justify-center gap-1 ${className}`}>
      <div className="flex items-center justify-center gap-1.5 flex-wrap">
        <span>AçaíFood © 2026</span>
        <span>•</span>
        <span className="inline-flex items-center gap-1 text-purple-700 dark:text-purple-300 font-semibold">
          <ShieldCheck size={13} className="text-purple-600 dark:text-purple-400 shrink-0" />
          <span>Parceira Financeira & BaaS: <strong>Asaas IP S.A. (CNPJ: 19.468.242/0001-32)</strong></span>
        </span>
      </div>
      <div className="text-[10px] text-zinc-400 dark:text-zinc-500 flex items-center justify-center gap-1 flex-wrap">
        <Info size={11} className="text-amber-500 shrink-0" />
        <span>Razão Social recebedora no Pix/Banco: <strong>Eletromecânica Baia Ltda</strong> (Empresa detentora da AppSolutions76/AçaíFood)</span>
      </div>
    </div>
  );
}

export function EmpresaControladoraNota({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-left text-xs text-amber-900 dark:text-amber-200 ${className}`}>
      <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300 mb-1">
        <Info size={14} className="shrink-0" />
        <span>Empresa Controladora & Razão Social do Pagamento</span>
      </div>
      <p className="leading-relaxed text-[11px]">
        A marca e plataforma <strong>AçaíFood</strong> é desenvolvida pela <strong>AppSolutions76</strong>, divisão pertencente à <strong>Eletromecânica Baia Ltda</strong>. Todas as cobranças Pix e liquidações via <strong>Asaas IP S.A.</strong> são emitidas em nome da razão social <strong>Eletromecânica Baia Ltda</strong>.
      </p>
    </div>
  );
}

export default AsaasPartnerBadge;
