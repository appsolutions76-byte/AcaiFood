"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/store/useAppStore';
import { 
  LogOut, 
  RefreshCw, 
  BookOpen, 
  Share2, 
  Printer,
  MapPin, 
  Key, 
  Power,
  ShieldCheck,
  AlertTriangle,
  Wallet,
  Menu,
  X,
  Home,
  Settings,
  ChevronRight
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { AsaasPartnerBadge } from '@/components/AsaasPartnerBadge';
import { PartnerWithdrawalSection } from '@/components/PartnerWithdrawalSection';
import { PartnerManualModal, PartnerRole } from '@/components/PartnerManualModal';
import PartnerActivationGuard from '@/components/PartnerActivationGuard';
import { AsaasAccountStatusCard } from '@/components/AsaasAccountStatusCard';

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
  onOpenPrinter?: () => void;
  onOpenShare?: () => void;
  virtualVaultValue?: number;
  manualRole: PartnerRole;
  shareModal?: React.ReactNode;
  navigationBar?: React.ReactNode;
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
  onOpenPrinter,
  onOpenShare,
  virtualVaultValue = 0,
  manualRole,
  shareModal,
  navigationBar,
  children
}: PartnerDashboardLayoutProps) {
  const router = useRouter();
  const logout = useAppStore((state: any) => state.logout);
  const currentUser = useAppStore((state: any) => state.currentUser);
  const [manualOpen, setManualOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const handleHeaderRefresh = async () => {
    try {
      await onRefresh();
      showToast("🔄 Painel e dados atualizados com sucesso!");
    } catch (_err) {
      showToast("❌ Erro ao atualizar painel.");
    }
  };

  const themeClasses = {
    purple: {
      bgHeader: 'bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-900/40',
      badgeBg: 'bg-purple-500/10 border-purple-500/30 text-purple-700 dark:text-purple-300',
      statusBtnActive: 'bg-emerald-600 text-white hover:bg-emerald-700',
      statusBtnInactive: 'bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-400 hover:bg-zinc-300 dark:hover:bg-zinc-700',
      cardBorder: 'border-purple-200 dark:border-purple-900/40 bg-white dark:bg-zinc-900/90',
      vaultText: 'text-emerald-600 dark:text-emerald-400',
    },
    emerald: {
      bgHeader: 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40',
      badgeBg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300',
      statusBtnActive: 'bg-emerald-600 text-white hover:bg-emerald-700',
      statusBtnInactive: 'bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-400 hover:bg-zinc-300 dark:hover:bg-zinc-700',
      cardBorder: 'border-emerald-200 dark:border-emerald-900/40 bg-white dark:bg-zinc-900/90',
      vaultText: 'text-emerald-600 dark:text-emerald-400',
    },
    amber: {
      bgHeader: 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40',
      badgeBg: 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300',
      statusBtnActive: 'bg-emerald-600 text-white hover:bg-emerald-700',
      statusBtnInactive: 'bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-400 hover:bg-zinc-300 dark:hover:bg-zinc-700',
      cardBorder: 'border-amber-200 dark:border-amber-900/40 bg-white dark:bg-zinc-900/90',
      vaultText: 'text-emerald-600 dark:text-emerald-400',
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
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 pb-24 font-sans">
        <PartnerManualModal isOpen={manualOpen} onClose={() => setManualOpen(false)} role={manualRole} />
        {shareModal}

        {/* Top Header Sticky */}
        <header className="bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800/90 sticky top-0 z-40 p-2 sm:p-4 shadow-md">
          <div className="max-w-6xl mx-auto space-y-2 sm:space-y-3">
            
            {/* 1. DESKTOP HEADER (100% Intacto para telas médias e computadores) */}
            <div className={`hidden md:block border rounded-2xl p-3 sm:p-3.5 shadow-sm transition relative overflow-hidden ${themeClasses.cardBorder}`}>
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="flex items-start sm:items-center gap-3">
                  <div className="p-2 sm:p-2.5 rounded-2xl bg-purple-100 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800/60 text-purple-700 dark:text-purple-400 shrink-0 mt-0.5 sm:mt-0">
                    {roleIcon}
                  </div>
                  
                  <div className="space-y-1">
                    {/* Nome da Loja / Parceiro como Título Principal + Status Operacional + Asaas */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <h1 className="text-lg sm:text-2xl font-black text-zinc-900 dark:text-white tracking-tight">
                        {partnerName || title}
                      </h1>

                      {onToggleStatus && (
                        <button
                          onClick={onToggleStatus}
                          className={`px-3 py-1 rounded-full font-bold text-xs flex items-center gap-1.5 transition shadow-sm active:scale-95 cursor-pointer shrink-0 ${
                            isOnline ? themeClasses.statusBtnActive : themeClasses.statusBtnInactive
                          }`}
                          title="Alternar status operacional"
                        >
                          <Power size={13} />
                          <span>{statusLabel}</span>
                        </button>
                      )}

                      {currentUser?.asaas_account_status === 'APPROVED' ? (
                        <span className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                          <ShieldCheck size={12} /> Asaas Ativo ✓
                        </span>
                      ) : (
                        <span className="bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                          <AlertTriangle size={12} /> Asaas Pendente ⚠️
                        </span>
                      )}
                    </div>

                    {/* Informações de Localização, Chave PIX, GPS e Parceira Financeira */}
                    <div className="flex items-center gap-3 text-xs text-zinc-700 dark:text-zinc-300 flex-wrap pt-0.5">
                      {locationText && (
                        <span className="flex items-center gap-1 text-zinc-700 dark:text-zinc-300">
                          <MapPin size={12} className="text-purple-600 dark:text-purple-400 shrink-0" />
                          <span className="text-zinc-700 dark:text-zinc-300">{locationText}</span>
                        </span>
                      )}

                      {rawPix && (
                        <span className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800/90 px-2 py-0.5 rounded-lg border border-zinc-200 dark:border-zinc-700/60 text-zinc-800 dark:text-zinc-200 font-mono text-[11px]">
                          <Key size={11} className="text-amber-500 dark:text-amber-400 shrink-0" />
                          <span className="text-zinc-800 dark:text-zinc-200">PIX (CPF/CNPJ): {rawPix}</span>
                        </span>
                      )}

                      {onUpdateGPS && (
                        <button
                          onClick={onUpdateGPS}
                          className="text-[11px] text-zinc-700 dark:text-zinc-300 hover:text-purple-600 dark:hover:text-purple-300 font-bold underline flex items-center gap-1 cursor-pointer"
                        >
                          <MapPin size={11} /> Atualizar GPS
                        </button>
                      )}

                      <AsaasPartnerBadge variant="inline" />
                    </div>
                  </div>
                </div>

                {/* Botões de Ação do Cabeçalho: Impressora, Compartilhar, Atualizar, Manual, Tema, Sair */}
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap self-end lg:self-auto shrink-0">
                  {onOpenPrinter && (
                    <button 
                      onClick={onOpenPrinter} 
                      className="bg-purple-600 hover:bg-purple-700 text-white font-extrabold px-3 py-1.5 sm:py-2 rounded-xl text-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-md shrink-0 ring-2 ring-purple-400/40"
                      title="Configurar e Parear Impressora Bluetooth"
                    >
                      <Printer size={15} className="text-white shrink-0" />
                      <span>🖨️ Impressora</span>
                    </button>
                  )}

                  {onOpenShare && (
                    <button 
                      onClick={onOpenShare}
                      className="bg-pink-100 dark:bg-pink-950/50 hover:bg-pink-200 dark:hover:bg-pink-900/70 text-pink-900 dark:text-white border border-pink-300 dark:border-pink-800/60 font-bold px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-sm shrink-0"
                      title="Compartilhar link da loja / parceiro"
                    >
                      <Share2 size={13} className="text-pink-600 dark:text-pink-300" />
                      <span className="font-bold">Compartilhar</span>
                    </button>
                  )}

                  <button
                    onClick={handleHeaderRefresh}
                    disabled={isRefreshing}
                    className="bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-bold px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-xs flex items-center gap-1.5 transition border border-zinc-300 dark:border-zinc-700/80 active:scale-95 disabled:opacity-50 cursor-pointer shadow-sm shrink-0"
                    title="Atualizar dados do painel em tempo real"
                  >
                    <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
                    <span>{isRefreshing ? 'Atualizando...' : 'Atualizar'}</span>
                  </button>

                  <button
                    onClick={() => setManualOpen(true)}
                    className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-xs flex items-center gap-1.5 transition border border-amber-500/30 active:scale-95 cursor-pointer shadow-sm shrink-0"
                  >
                    <BookOpen size={13} />
                    <span>Manual</span>
                  </button>

                  <ThemeToggle />

                  <button
                    onClick={handleLogout}
                    className="bg-red-100 dark:bg-red-950/40 hover:bg-red-200 dark:hover:bg-red-900/60 text-red-700 dark:text-red-400 font-bold px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-xs flex items-center gap-1.5 transition border border-red-300 dark:border-red-900/50 active:scale-95 ml-1 cursor-pointer shadow-sm shrink-0"
                  >
                    <LogOut size={13} />
                    <span>Sair</span>
                  </button>
                </div>
              </div>
            </div>

            {/* MOBILE HEADER (Exclusivo para celular: Limpo, rápido e focado) */}
            <div className={`md:hidden border rounded-2xl p-2.5 shadow-xs transition flex items-center justify-between gap-2 ${themeClasses.cardBorder}`}>
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className="p-1.5 rounded-xl bg-purple-100 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800/60 text-purple-700 dark:text-purple-400 shrink-0">
                  {roleIcon}
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="text-xs sm:text-sm font-black text-zinc-900 dark:text-white truncate leading-tight">
                    {partnerName || title}
                  </h1>
                  <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                    {locationText && <span className="truncate">{locationText}</span>}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {onToggleStatus && (
                  <button
                    onClick={onToggleStatus}
                    className={`px-2 py-1 rounded-full font-bold text-[10px] flex items-center gap-1 transition shadow-xs active:scale-95 cursor-pointer ${
                      isOnline ? themeClasses.statusBtnActive : themeClasses.statusBtnInactive
                    }`}
                    title="Alternar status operacional"
                  >
                    <Power size={11} />
                    <span>{isOnline ? 'Online' : 'Pausa'}</span>
                  </button>
                )}

                <button
                  onClick={() => setMobileMenuOpen(true)}
                  aria-label="Abrir opções do parceiro"
                  className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-zinc-800 dark:text-zinc-200 active:scale-90 transition cursor-pointer"
                >
                  <Menu size={16} />
                </button>
              </div>
            </div>

            {/* 2. Todos os Botões e Abas de Navegação Fixos com Largura Total para Rolagem */}
            {navigationBar && (
              <div className="w-full">
                {navigationBar}
              </div>
            )}

          </div>
        </header>

        {/* MOBILE DRAWER EXCLUSIVO MOBILE PARA PARCEIROS */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden animate-in fade-in duration-200">
            <div 
              className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
              onClick={() => setMobileMenuOpen(false)} 
            />

            <div className="fixed inset-y-0 right-0 max-w-[310px] w-full bg-white dark:bg-zinc-900 shadow-2xl p-5 flex flex-col justify-between overflow-y-auto z-10 animate-in slide-in-from-right duration-200 border-l border-zinc-200 dark:border-zinc-800">
              <div className="space-y-4">
                {/* Header do Menu */}
                <div className="flex justify-between items-center pb-3 border-b border-zinc-200 dark:border-zinc-800">
                  <div className="flex items-center gap-2">
                    <div className="p-1 rounded-lg bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400">
                      {roleIcon}
                    </div>
                    <span className="font-black text-sm text-zinc-900 dark:text-white truncate max-w-[190px]">
                      {partnerName || title}
                    </span>
                  </div>
                  <button
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Status e Conta */}
                <div className="p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-2xl border border-zinc-200 dark:border-zinc-700/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-zinc-600 dark:text-zinc-300">Status Operacional:</span>
                    {onToggleStatus && (
                      <button
                        onClick={onToggleStatus}
                        className={`px-2.5 py-1 rounded-full font-bold text-[10px] flex items-center gap-1 transition ${
                          isOnline ? themeClasses.statusBtnActive : themeClasses.statusBtnInactive
                        }`}
                      >
                        <Power size={11} />
                        <span>{isOnline ? '🟢 Online' : '⏸️ Pausado'}</span>
                      </button>
                    )}
                  </div>

                  {locationText && (
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center gap-1 truncate">
                      <MapPin size={11} className="text-purple-600 shrink-0" />
                      <span>{locationText}</span>
                    </p>
                  )}

                  {rawPix && (
                    <p className="text-[10px] font-mono text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 truncate">
                      PIX: {rawPix}
                    </p>
                  )}

                  <div className="pt-1">
                    <AsaasPartnerBadge variant="inline" />
                  </div>
                </div>

                {/* Ações Rápidas */}
                <div className="space-y-1.5 pt-1">
                  {onOpenPrinter && (
                    <button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        onOpenPrinter();
                      }}
                      className="w-full flex items-center justify-between p-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-sm transition cursor-pointer"
                    >
                      <span className="flex items-center gap-2.5">
                        <Printer size={15} />
                        <span>🖨️ Conectar Impressora</span>
                      </span>
                      <ChevronRight size={14} className="opacity-70" />
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      handleHeaderRefresh();
                    }}
                    disabled={isRefreshing}
                    className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800/80 text-zinc-800 dark:text-zinc-200 text-xs font-bold transition disabled:opacity-50 cursor-pointer"
                  >
                    <span className="flex items-center gap-2.5">
                      <RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} />
                      <span>{isRefreshing ? 'Atualizando...' : 'Atualizar Painel'}</span>
                    </span>
                  </button>

                  {onOpenShare && (
                    <button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        onOpenShare();
                      }}
                      className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800/80 text-zinc-800 dark:text-zinc-200 text-xs font-bold transition cursor-pointer"
                    >
                      <span className="flex items-center gap-2.5">
                        <Share2 size={15} className="text-pink-500" />
                        <span>Compartilhar Painel</span>
                      </span>
                      <ChevronRight size={14} className="opacity-50" />
                    </button>
                  )}

                  {onUpdateGPS && (
                    <button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        onUpdateGPS();
                      }}
                      className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800/80 text-zinc-800 dark:text-zinc-200 text-xs font-bold transition cursor-pointer"
                    >
                      <span className="flex items-center gap-2.5">
                        <MapPin size={15} className="text-emerald-500" />
                        <span>Atualizar Localização GPS</span>
                      </span>
                      <ChevronRight size={14} className="opacity-50" />
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setManualOpen(true);
                    }}
                    className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800/80 text-zinc-800 dark:text-zinc-200 text-xs font-bold transition cursor-pointer"
                  >
                    <span className="flex items-center gap-2.5">
                      <BookOpen size={15} className="text-amber-500" />
                      <span>Manual de Instruções</span>
                    </span>
                    <ChevronRight size={14} className="opacity-50" />
                  </button>

                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      router.push('/');
                    }}
                    className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800/80 text-zinc-800 dark:text-zinc-200 text-xs font-bold transition cursor-pointer"
                  >
                    <span className="flex items-center gap-2.5">
                      <Home size={15} className="text-purple-500" />
                      <span>Ir para o Marketplace</span>
                    </span>
                    <ChevronRight size={14} className="opacity-50" />
                  </button>

                  {/* Tema */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    <span className="flex items-center gap-2">
                      <span>🌓</span> Aparência
                    </span>
                    <ThemeToggle />
                  </div>
                </div>
              </div>

              {/* Rodapé do Menu */}
              <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleLogout();
                  }}
                  className="w-full py-2.5 px-4 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/60 text-red-600 dark:text-red-400 font-extrabold text-xs rounded-xl border border-red-200 dark:border-red-900/40 transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <LogOut size={14} />
                  <span>Sair do Painel</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Dashboard Container */}
        <main className="max-w-6xl mx-auto p-3 sm:p-6 space-y-4 pb-28 md:pb-12">
          <AsaasAccountStatusCard />
          {children}
        </main>

        {/* BOTTOM NAVIGATION BAR EXCLUSIVA MOBILE PARA PARCEIROS */}
        <nav 
          aria-label="Navegação do Parceiro Mobile" 
          className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border-t border-zinc-200 dark:border-zinc-800 px-3 py-1.5 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]"
        >
          <div className="max-w-md mx-auto grid grid-cols-4 items-center">
            <button
              onClick={() => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="flex flex-col items-center justify-center py-1 text-purple-600 dark:text-purple-400 active:scale-95 transition cursor-pointer"
            >
              <Home size={18} />
              <span className="text-[10px] font-bold mt-0.5">Início</span>
            </button>

            {onToggleStatus ? (
              <button
                onClick={onToggleStatus}
                className={`flex flex-col items-center justify-center py-1 active:scale-95 transition cursor-pointer ${
                  isOnline ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-400'
                }`}
              >
                <Power size={18} />
                <span className="text-[10px] font-bold mt-0.5">{isOnline ? 'Online' : 'Pausado'}</span>
              </button>
            ) : (
              <button
                onClick={() => router.push('/')}
                className="flex flex-col items-center justify-center py-1 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white active:scale-95 transition cursor-pointer"
              >
                <span className="text-base leading-none">🥣</span>
                <span className="text-[10px] font-bold mt-0.5">Lojas</span>
              </button>
            )}

            <button
              onClick={handleHeaderRefresh}
              disabled={isRefreshing}
              className="flex flex-col items-center justify-center py-1 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white active:scale-95 transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
              <span className="text-[10px] font-bold mt-0.5">Atualizar</span>
            </button>

            <button
              onClick={() => setMobileMenuOpen(true)}
              className="flex flex-col items-center justify-center py-1 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white active:scale-95 transition cursor-pointer"
            >
              <Settings size={18} />
              <span className="text-[10px] font-bold mt-0.5">Opções</span>
            </button>
          </div>
        </nav>

        {/* Floating Toast Notification */}
        {toastMsg && (
          <div className="fixed bottom-5 right-5 z-50 bg-zinc-900 border border-purple-500/50 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-5">
            <span className="text-xs font-bold">{toastMsg}</span>
            <button onClick={() => setToastMsg(null)} className="text-zinc-400 hover:text-white font-bold text-sm leading-none">&times;</button>
          </div>
        )}
      </div>
    </PartnerActivationGuard>
  );
}

export default PartnerDashboardLayout;
