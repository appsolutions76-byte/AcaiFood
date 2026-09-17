import React from 'react';
import { ShieldCheck } from 'lucide-react';

interface AsaasPartnerBadgeProps {
  className?: string;
  variant?: 'footer' | 'badge' | 'inline' | 'subtle';
}

export function AsaasPartnerBadge({ className = '', variant = 'footer' }: AsaasPartnerBadgeProps) {
  if (variant === 'badge') {
    return (
      <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-700 dark:text-purple-300 text-[11px] font-semibold shadow-xs ${className}`}>
        <ShieldCheck size={13} className="text-purple-600 dark:text-purple-400 shrink-0" />
        <span>Pagamentos & Custódia por <strong>Asaas IP S.A. (ASAAS GESTÃO FINANCEIRA S.A.)</strong></span>
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <span className={`inline-flex items-center gap-1 text-[11px] text-zinc-500 dark:text-zinc-400 font-medium ${className}`}>
        <ShieldCheck size={12} className="text-emerald-500 shrink-0" />
        <span>Parceira Financeira: <strong>Asaas IP S.A. (ASAAS GESTÃO FINANCEIRA S.A.)</strong> (Banco Central do Brasil)</span>
      </span>
    );
  }

  if (variant === 'subtle') {
    return (
      <div className={`text-[11px] text-zinc-500 dark:text-zinc-400 font-medium flex items-center justify-center gap-1 ${className}`}>
        <ShieldCheck size={12} className="text-purple-500 shrink-0" />
        <span>Tecnologia AçaíFood • Parceira Financeira <strong>Asaas IP S.A. (ASAAS GESTÃO FINANCEIRA S.A.)</strong></span>
      </div>
    );
  }

  return (
    <div className={`text-center py-2 text-[11px] text-zinc-500 dark:text-zinc-400 font-medium flex items-center justify-center gap-1.5 flex-wrap ${className}`}>
      <span>AçaíFood © 2026</span>
      <span>•</span>
      <span className="inline-flex items-center gap-1">
        <ShieldCheck size={12} className="text-purple-600 dark:text-purple-400 shrink-0" />
        <span>Parceira Financeira & BaaS: <strong>Asaas IP S.A. (ASAAS GESTÃO FINANCEIRA S.A.)</strong> (Banco Central do Brasil)</span>
      </span>
    </div>
  );
}
