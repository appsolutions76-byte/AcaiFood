import React from 'react';
import { ShieldCheck, Info } from 'lucide-react';

interface AsaasPartnerBadgeProps {
  className?: string;
  variant?: 'footer' | 'badge' | 'inline' | 'subtle' | 'full';
}

export function AsaasPartnerBadge({ className = '', variant = 'footer' }: AsaasPartnerBadgeProps) {
  if (variant === 'badge') {
    return (
      <div className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-purple-500/20 border border-purple-400/40 text-white text-xs font-semibold shadow-xs ${className}`}>
        <ShieldCheck size={14} className="text-emerald-400 shrink-0" />
        <span className="text-white">Parceira Financeira: <strong className="text-white font-bold">Asaas IP S.A. (CNPJ 19.540.550/0001-21)</strong></span>
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <span className={`inline-flex items-center gap-1 text-xs text-white font-semibold ${className}`}>
        <ShieldCheck size={13} className="text-emerald-400 shrink-0" />
        <span className="text-white">Parceira Financeira: <strong className="text-white font-bold">Asaas IP S.A. (CNPJ 19.540.550/0001-21)</strong> (Banco Central do Brasil)</span>
      </span>
    );
  }

  if (variant === 'subtle') {
    return (
      <div className={`text-xs text-white font-semibold text-center flex flex-col items-center justify-center gap-1 ${className}`}>
        <div className="flex items-center justify-center gap-1.5 flex-wrap">
          <ShieldCheck size={13} className="text-emerald-400 shrink-0" />
          <span className="text-white">Tecnologia AçaíFood • Parceira Financeira: <strong className="text-white font-bold">Asaas IP S.A. (ASAAS GESTÃO FINANCEIRA INSTITUIÇÃO DE PAGAMENTOS S.A., CNPJ 19.540.550/0001-21)</strong></span>
        </div>
        <div className="flex items-center justify-center gap-1.5 flex-wrap">
          <Info size={13} className="text-amber-400 shrink-0" />
          <span className="text-white">Favorecido no Pix/Banco: <strong className="text-white font-bold">Eletromecânica Baia Ltda</strong> (Empresa detentora da AppSolutions76/AçaíFood)</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`text-center py-2 text-xs font-semibold text-white flex flex-col items-center justify-center gap-1.5 ${className}`}>
      <div className="flex items-center justify-center gap-1.5 flex-wrap">
        <ShieldCheck size={14} className="text-emerald-400 shrink-0" />
        <span className="text-white">Parceira Financeira & BaaS: <strong className="text-white font-bold">Asaas IP S.A. (ASAAS GESTÃO FINANCEIRA INSTITUIÇÃO DE PAGAMENTOS S.A., CNPJ: 19.540.550/0001-21)</strong> — Autorizada pelo Banco Central do Brasil</span>
      </div>
      <div className="flex items-center justify-center gap-1.5 flex-wrap text-[11px] text-white">
        <span className="text-white">Modelo de Operação: <strong className="text-white font-bold">Modelo A — Direto Tomador</strong> (O Asaas presta os serviços financeiros e o AçaíFood atua como integradora tecnológica e distribuidora da experiência)</span>
      </div>
      <div className="flex items-center justify-center gap-1.5 flex-wrap">
        <Info size={14} className="text-amber-400 shrink-0" />
        <span className="text-white">Razão Social recebedora no Pix/Banco: <strong className="text-white font-bold">Eletromecânica Baia Ltda</strong> (Empresa detentora da AppSolutions76/AçaíFood)</span>
      </div>
    </div>
  );
}

export function EmpresaControladoraNota({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-left text-xs text-white ${className}`}>
      <div className="flex items-center gap-1.5 font-bold text-white mb-1">
        <Info size={14} className="text-amber-400 shrink-0" />
        <span className="text-white">Empresa Controladora & Razão Social do Pagamento</span>
      </div>
      <p className="leading-relaxed text-[11px] text-white">
        A marca e plataforma <strong className="text-white font-bold">AçaíFood</strong> é desenvolvida pela <strong className="text-white font-bold">AppSolutions76</strong>, divisão pertencente à <strong className="text-white font-bold">Eletromecânica Baia Ltda</strong>. Todas as cobranças Pix e liquidações via <strong className="text-white font-bold">Asaas IP S.A. (ASAAS GESTÃO FINANCEIRA INSTITUIÇÃO DE PAGAMENTOS S.A., CNPJ 19.540.550/0001-21)</strong> operam sob o <strong className="text-white font-bold">Modelo A — Direto Tomador</strong> e são emitidas em nome da razão social <strong className="text-white font-bold">Eletromecânica Baia Ltda</strong>.
      </p>
    </div>
  );
}

export default AsaasPartnerBadge;
