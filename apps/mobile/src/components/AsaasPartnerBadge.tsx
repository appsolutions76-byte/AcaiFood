import React from 'react';
import { ShieldCheck, Info } from 'lucide-react';

interface AsaasPartnerBadgeProps {
  className?: string;
  variant?: 'footer' | 'badge' | 'inline' | 'subtle' | 'full';
}

export function AsaasPartnerBadge({ className = '', variant = 'footer' }: AsaasPartnerBadgeProps) {
  if (variant === 'badge') {
    return (
      <div className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-zinc-900 dark:text-white text-xs font-semibold shadow-xs ${className}`}>
        <ShieldCheck size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
        <span className="text-zinc-800 dark:text-zinc-100">
          Parceira Financeira: <strong className="text-zinc-950 dark:text-white font-bold">Asaas Gestão Financeira Instituição de Pagamento S.A. (CNPJ 19.540.550/0001-21)</strong>
        </span>
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <span className={`inline-flex items-center gap-1 text-xs text-zinc-800 dark:text-zinc-100 font-semibold ${className}`}>
        <ShieldCheck size={13} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
        <span>
          Parceira Financeira: <strong className="text-zinc-950 dark:text-white font-bold">Asaas Gestão Financeira Instituição de Pagamento S.A. (CNPJ 19.540.550/0001-21)</strong> (Banco Central do Brasil)
        </span>
      </span>
    );
  }

  if (variant === 'subtle') {
    return (
      <div className={`text-xs text-zinc-800 dark:text-zinc-100 font-semibold text-center flex flex-col items-center justify-center gap-1 ${className}`}>
        <div className="flex items-center justify-center gap-1.5 flex-wrap">
          <ShieldCheck size={13} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>
            Tecnologia AçaíFood • Parceira Financeira: <strong className="text-zinc-950 dark:text-white font-bold">Asaas Gestão Financeira Instituição de Pagamento S.A., CNPJ 19.540.550/0001-21</strong>
          </span>
        </div>
        <div className="flex items-center justify-center gap-1.5 flex-wrap">
          <Info size={13} className="text-amber-600 dark:text-amber-400 shrink-0" />
          <span>
            Favorecido no Pix: <strong className="text-zinc-950 dark:text-white font-bold">a loja vendedora</strong> (conta Asaas da loja; comissão do AçaíFood por split)
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={`text-center py-2 text-xs font-semibold text-zinc-800 dark:text-zinc-100 flex flex-col items-center justify-center gap-1.5 ${className}`}>
      <div className="flex items-center justify-center gap-1.5 flex-wrap">
        <ShieldCheck size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
        <span>
          Parceira Financeira & BaaS: <strong className="text-zinc-950 dark:text-white font-bold">Asaas Gestão Financeira Instituição de Pagamento S.A., CNPJ: 19.540.550/0001-21</strong> — Autorizada pelo Banco Central do Brasil
        </span>
      </div>
      <div className="flex items-center justify-center gap-1.5 flex-wrap text-[11px] text-zinc-600 dark:text-zinc-300">
        <span>
          Modelo de Operação: <strong className="text-zinc-900 dark:text-white font-bold">cobrança na conta da loja com split da comissão</strong> (o Asaas presta os serviços financeiros e o AçaíFood atua como integradora tecnológica e distribuidora da experiência)
        </span>
      </div>
      <div className="flex items-center justify-center gap-1.5 flex-wrap">
        <Info size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />
        <span>
          Recebedor no Pix: <strong className="text-zinc-950 dark:text-white font-bold">a loja vendedora</strong>. Taxas da plataforma e coleta de resíduos: Eletromecânica Baia Ltda
        </span>
      </div>
    </div>
  );
}

export function EmpresaControladoraNota({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-left text-xs text-zinc-800 dark:text-zinc-100 ${className}`}>
      <div className="flex items-center gap-1.5 font-bold text-zinc-900 dark:text-white mb-1">
        <Info size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />
        <span>Empresa Controladora & Razão Social do Pagamento</span>
      </div>
      <p className="leading-relaxed text-[11px] text-zinc-700 dark:text-zinc-200">
        A marca e plataforma <strong className="text-zinc-950 dark:text-white font-bold">AçaíFood</strong> é desenvolvida pela <strong className="text-zinc-950 dark:text-white font-bold">AppSolutions76</strong>, divisão pertencente à <strong className="text-zinc-950 dark:text-white font-bold">Eletromecânica Baia Ltda</strong>. Os pagamentos de pedidos via <strong className="text-zinc-950 dark:text-white font-bold">Asaas Gestão Financeira Instituição de Pagamento S.A., CNPJ 19.540.550/0001-21</strong> são emitidos em nome da <strong className="text-zinc-950 dark:text-white font-bold">loja vendedora</strong>, com a comissão do AçaíFood separada por split. Taxas da plataforma e coleta de resíduos são emitidas em nome da <strong className="text-zinc-950 dark:text-white font-bold">Eletromecânica Baia Ltda</strong>.
      </p>
    </div>
  );
}

export default AsaasPartnerBadge;
