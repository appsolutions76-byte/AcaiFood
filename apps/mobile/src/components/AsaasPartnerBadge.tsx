import React from 'react';
import { ShieldCheck, Info } from 'lucide-react';

interface AsaasPartnerBadgeProps {
  className?: string;
  variant?: 'footer' | 'badge' | 'inline' | 'subtle' | 'full';
}

export function AsaasPartnerBadge({ className = '', variant = 'footer' }: AsaasPartnerBadgeProps) {
  if (variant === 'badge') {
    return (
      <div className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-700 dark:text-purple-300 text-xs font-semibold shadow-xs ${className}`}>
        <ShieldCheck size={14} className="text-purple-600 dark:text-purple-400 shrink-0" />
        <span>Parceira Financeira: <strong>Asaas IP S.A. (CNPJ 19.540.550/0001-21)</strong></span>
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <span className={`inline-flex items-center gap-1 text-xs text-purple-700 dark:text-purple-300 font-semibold ${className}`}>
        <ShieldCheck size={13} className="text-purple-600 dark:text-purple-400 shrink-0" />
        <span>Parceira Financeira: <strong>Asaas IP S.A. (CNPJ 19.540.550/0001-21)</strong> (Banco Central do Brasil)</span>
      </span>
    );
  }

  if (variant === 'subtle') {
    return (
      <div className={`text-xs text-purple-700 dark:text-purple-300 font-semibold text-center flex flex-col items-center justify-center gap-1 ${className}`}>
        <div className="flex items-center justify-center gap-1.5 flex-wrap">
          <ShieldCheck size={13} className="text-purple-600 dark:text-purple-400 shrink-0" />
          <span>Tecnologia AçaíFood • Parceira Financeira: <strong>Asaas IP S.A. (ASAAS GESTÃO FINANCEIRA INSTITUIÇÃO DE PAGAMENTOS S.A., CNPJ 19.540.550/0001-21)</strong></span>
        </div>
        <div className="flex items-center justify-center gap-1.5 flex-wrap">
          <Info size={13} className="text-amber-500 dark:text-amber-400 shrink-0" />
          <span>Favorecido no Pix/Banco: <strong>Eletromecânica Baia Ltda</strong> (Empresa detentora da AppSolutions76/AçaíFood)</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`text-center py-2 text-xs font-semibold text-purple-700 dark:text-purple-300 flex flex-col items-center justify-center gap-1.5 ${className}`}>
      <div className="flex items-center justify-center gap-1.5 flex-wrap">
        <ShieldCheck size={14} className="text-purple-600 dark:text-purple-400 shrink-0" />
        <span>Parceira Financeira & BaaS: <strong>Asaas IP S.A. (ASAAS GESTÃO FINANCEIRA INSTITUIÇÃO DE PAGAMENTOS S.A., CNPJ: 19.540.550/0001-21)</strong> — Autorizada pelo Banco Central do Brasil</span>
      </div>
      <div className="flex items-center justify-center gap-1.5 flex-wrap text-[11px] text-zinc-500 dark:text-zinc-400">
        <span>Modelo de Operação: <strong>Modelo A — Direto Tomador</strong> (O Asaas presta os serviços financeiros e o AçaíFood atua como integradora tecnológica e distribuidora da experiência)</span>
      </div>
      <div className="flex items-center justify-center gap-1.5 flex-wrap">
        <Info size={14} className="text-amber-500 dark:text-amber-400 shrink-0" />
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
        A marca e plataforma <strong>AçaíFood</strong> é desenvolvida pela <strong>AppSolutions76</strong>, divisão pertencente à <strong>Eletromecânica Baia Ltda</strong>. Todas as cobranças Pix e liquidações via <strong>Asaas IP S.A. (ASAAS GESTÃO FINANCEIRA INSTITUIÇÃO DE PAGAMENTOS S.A., CNPJ 19.540.550/0001-21)</strong> operam sob o <strong>Modelo A — Direto Tomador</strong> e são emitidas em nome da razão social <strong>Eletromecânica Baia Ltda</strong>.
      </p>
    </div>
  );
}

export default AsaasPartnerBadge;
