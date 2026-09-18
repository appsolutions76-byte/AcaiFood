"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/store/useAppStore';
import { 
  LogOut, 
  RefreshCw, 
  BookOpen, 
  Share2, 
  MapPin, 
  Key, 
  Power,
  ShieldCheck,
  Wallet
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { AsaasPartnerBadge } from '@/components/AsaasPartnerBadge';
import { PartnerWithdrawalSection } from '@/components/PartnerWithdrawalSection';
import { PartnerManualModal, PartnerRole } from '@/components/PartnerManualModal';
import PartnerActivationGuard from '@/components/PartnerActivationGuard';

export interface PartnerDashboardLayoutProps {
  role: 'loja' | 'fornecedor' | 'motorista' | 'caminhao';
  title: string;
  roleIcon: React.ReactNode;
  themeColor?: 'purple' | 'emerald' | 'amber';
  partnerId: string;
  partnerName: string;
  locationText?: string;
  pixKeyInfo?: string;
  statusLabel: string;
  isOnline: boolean;
  onToggleStatus: () => void;
  isRefreshing: boolean;
  onRefresh: () => void;
  onUpdateGPS?: () => void;
  virtualVaultValue?: number;
  manualRole: PartnerRole;
  shareModal?: React.ReactNode;
  children: React.ReactNode;
}

export function PartnerDashboardLayout({
  role,
  title,
  roleIcon,
  themeColor = 'purple',
  partnerId,
  partnerName,
  locationText,
  pixKeyInfo,
  statusLabel,
  isOnline,
  onToggleStatus,
  isRefreshing,
  onRefresh,
  onUpdateGPS,
  virtualVaultValue = 0,
  manualRole,
  shareModal,
  children
}: PartnerDashboardLayoutProps) {
  const router = useRouter();
  const logout = useAppStore((state: any) => state.logout);
  const currentUser = useAppStore((state: any) => state.currentUser);
  const [manualOpen, setManualOpen] = useState(false);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const themeClasses = {
    purple: {
      bgHeader: 'bg-purple-950/20 border-purple-900/40',
      badgeBg: 'bg-purple-500/10 border-purple-500/30 text-purple-300',
      statusBtnActive: 'bg-emerald-600 text-white hover:bg-emerald-700',
      statusBtnInactive: 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700',
      cardBorder: 'border-purple-900/40 bg-zinc-900/90',
      vaultText: 'text-emerald-400',
    },
    emerald: {
      bgHeader: 'bg-emerald-950/20 border-emerald-900/40',
      badgeBg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
      statusBtnActive: 'bg-emerald-600 text-white hover:bg-emerald-700',
      statusBtnInactive: 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700',
      cardBorder: 'border-emerald-900/40 bg-zinc-900/90',
      vaultText: 'text-emerald-400',
    },
    amber: {
      bgHeader: 'bg-amber-950/20 border-amber-900/40',
      badgeBg: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
      statusBtnActive: 'bg-emerald-600 text-white hover:bg-emerald-700',
      statusBtnInactive: 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700',
      cardBorder: 'border-amber-900/40 bg-zinc-900/90',
      vaultText: 'text-emerald-400',
    }
  }[themeColor];

  const roleGuardName = 
    role === 'loja' ? 'Batedeira de Açaí' :
    role === 'fornecedor' ? 'Fornecedor de Frutos (B2B)' :
    'Entregador / Transporte';

  const rawPix = String(currentUser?.cpfCnpj || currentUser?.pixKey || pixKeyInfo || '').trim();
  const formatMoney = (val?: number) => `R$ ${Number(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <PartnerActivationGuard roleName={roleGuardName}>
      <div className="min-h-screen bg-zinc-950 text-zinc-100 pb-24 font-sans">
        <PartnerManualModal isOpen={manualOpen} onClose={() => setManualOpen(false)} role={manualRole} />
        {shareModal}

        {/* Top Header Sticky */}
        <header className="bg-zinc-900/95 backdrop-blur border-b border-zinc-800 sticky top-0 z-40 p-4 shadow-md">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
            
            {/* Title & Asaas Badge */}
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-purple-950/60 border border-purple-800/60 text-purple-400 shrink-0">
                {roleIcon}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">{title}</h1>
                  <span className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <ShieldCheck size={12} /> Asaas Ativo ✓
                  </span>
                </div>
                <div className="mt-0.5">
                  <AsaasPartnerBadge variant="inline" />
                </div>
              </div>
            </div>

            {/* Header Action Buttons */}
            <div className="flex items-center gap-2 flex-wrap self-end md:self-auto">
              <button
                onClick={onRefresh}
                disabled={isRefreshing}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 transition border border-zinc-700 active:scale-95 disabled:opacity-50"
              >
                <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
                <span>Atualizar</span>
              </button>

              <button
                onClick={() => setManualOpen(true)}
                className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 transition border border-amber-500/30 active:scale-95"
              >
                <BookOpen size={14} />
                <span>Manual</span>
              </button>

              {shareModal && (
                <div className="shrink-0">
                  {/* Share button wrapper */}
                </div>
              )}

              <ThemeToggle />

              <button
                onClick={handleLogout}
                className="bg-red-950/40 hover:bg-red-900/60 text-red-400 font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 transition border border-red-900/50 active:scale-95 ml-1"
              >
                <LogOut size={14} />
                <span>Sair</span>
              </button>
            </div>
          </div>
        </header>

        {/* Main Dashboard Container */}
        <main className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
          
          {/* Módulo 1: Cartão de Saldo e Saques BaaS */}
          <PartnerWithdrawalSection partnerId={partnerId} role={role} />

          {/* Módulo 2: Cartão de Status do Parceiro e Informações Operacionais */}
          <div className={`border rounded-3xl p-5 shadow-xl transition relative overflow-hidden ${themeClasses.cardBorder}`}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              
              {/* Informações da Conta e Titular */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-black text-white">{partnerName || 'Parceiro AçaíFood'}</h2>
                  {onToggleStatus && (
                    <button
                      onClick={onToggleStatus}
                      className={`px-3 py-1 rounded-full font-bold text-xs flex items-center gap-1.5 transition shadow-sm active:scale-95 ${
                        isOnline ? themeClasses.statusBtnActive : themeClasses.statusBtnInactive
                      }`}
                    >
                      <Power size={13} />
                      <span>{statusLabel}</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-4 text-xs text-zinc-400 flex-wrap">
                  {locationText && (
                    <span className="flex items-center gap-1">
                      <MapPin size={13} className="text-purple-400" />
                      <span>{locationText}</span>
                    </span>
                  )}

                  {rawPix && (
                    <span className="flex items-center gap-1 bg-zinc-800/80 px-2.5 py-1 rounded-lg border border-zinc-700/60 text-zinc-300 font-mono text-[11px]">
                      <Key size={12} className="text-amber-400" />
                      <span>PIX (CPF/CNPJ): {rawPix}</span>
                    </span>
                  )}

                  {onUpdateGPS && (
                    <button
                      onClick={onUpdateGPS}
                      className="text-[11px] text-purple-400 hover:text-purple-300 font-bold underline flex items-center gap-1"
                    >
                      <MapPin size={12} /> Atualizar GPS
                    </button>
                  )}
                </div>
              </div>

              {/* Cofre Virtual (A Receber) */}
              <div className="text-left md:text-right bg-zinc-950/60 p-3.5 rounded-2xl border border-zinc-800 shrink-0">
                <span className="text-[11px] text-zinc-400 font-medium block">Cofre Virtual (A Receber)</span>
                <span className={`text-2xl font-black ${themeClasses.vaultText}`}>
                  {formatMoney(virtualVaultValue)}
                </span>
                <span className="text-[10px] text-zinc-500 block mt-0.5">
                  📅 Pix Automático: às 18:00
                </span>
              </div>

            </div>
          </div>

          {/* Módulo 3: Conteúdo e Abas Específicas do Parceiro */}
          <div className="pt-2">
            {children}
          </div>

        </main>
      </div>
    </PartnerActivationGuard>
  );
}

export default PartnerDashboardLayout;
