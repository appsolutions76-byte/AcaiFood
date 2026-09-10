'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/store/useAppStore';
import { Copy, Clock, LogOut, RefreshCw, ShieldAlert } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface PartnerActivationGuardProps {
  children: React.ReactNode;
  roleName?: string;
}

export default function PartnerActivationGuard({ children, roleName }: PartnerActivationGuardProps) {
  const router = useRouter();
  const currentUser = useAppStore(state => state.currentUser);
  const logout = useAppStore(state => state.logout);

  const [isLoading, setIsLoading] = useState(true);
  const [isBlocked, setIsBlocked] = useState(false);
  const [activationFee, setActivationFee] = useState(13.10);
  const [pixData, setPixData] = useState<{
    paymentId?: string;
    pixQrCode?: string;
    pixCopiaECola?: string;
  } | null>(null);
  const [copiedPix, setCopiedPix] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isPaidSuccess, setIsPaidSuccess] = useState(false);

  const checkStatus = useCallback(async (silent = false) => {
    if (!currentUser?.id) return;
    if (!silent) setIsChecking(true);

    try {
      const res = await fetch('/api/asaas/activation?userId=' + currentUser.id);
      const data = await res.json();

      if (data && data.success) {
        if (data.activationFee) setActivationFee(Number(data.activationFee));

        if (data.activationEnabled && !data.userStatus?.isPaid) {
          setIsBlocked(true);

          if (!pixData?.pixQrCode) {
            const payRes = await fetch('/api/asaas/activation', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userId: currentUser.id,
                name: currentUser.name,
                email: currentUser.email,
                cpfCnpj: currentUser.cpfCnpj,
                phone: currentUser.telefone
              })
            });
            const payJson = await payRes.json();
            if (payJson?.isFounderSubsidized || payJson?.isPaid) {
              setIsBlocked(false);
              setIsPaidSuccess(true);
            } else if (payJson?.paymentId) {
              setPixData({
                paymentId: payJson.paymentId,
                pixQrCode: payJson.pixQrCode,
                pixCopiaECola: payJson.pixCopiaECola
              });
            }
          }
        } else {
          setIsBlocked(false);
        }
      }
    } catch (_err) {
      console.warn('Aviso ao verificar status de ativação no Guard:', _err);
    } finally {
      setIsLoading(false);
      if (!silent) setIsChecking(false);
    }
  }, [currentUser?.id, currentUser?.name, currentUser?.email, currentUser?.cpfCnpj, currentUser?.telefone, pixData?.pixQrCode]);

  useEffect(() => {
    const r = String(currentUser?.role || '').toLowerCase();
    if (r === 'admin' || r === 'cliente') {
      setIsLoading(false);
      setIsBlocked(false);
      return;
    }

    if (currentUser?.id) {
      checkStatus(false);
    } else {
      setIsLoading(false);
    }
  }, [currentUser?.id, currentUser?.role, checkStatus]);

  useEffect(() => {
    if (!isBlocked || !currentUser?.id || isPaidSuccess) return;

    const interval = setInterval(() => {
      checkStatus(true);
    }, 4000);

    return () => clearInterval(interval);
  }, [isBlocked, currentUser?.id, isPaidSuccess, checkStatus]);

  const handleCopyPix = () => {
    if (pixData?.pixCopiaECola) {
      navigator.clipboard.writeText(pixData.pixCopiaECola);
      setCopiedPix(true);
      setTimeout(() => setCopiedPix(false), 3000);
    }
  };

  const handleManualCheck = async () => {
    setIsChecking(true);
    try {
      const res = await fetch('/api/asaas/activation?userId=' + currentUser?.id + (pixData?.paymentId ? '&paymentId=' + pixData.paymentId : ''));
      const data = await res.json();
      if (data?.userStatus?.isPaid) {
        setIsPaidSuccess(true);
        setIsBlocked(false);
        try {
          const { data: sessData } = await supabase.auth.getSession();
          const authHeaders: any = { 'Content-Type': 'application/json' };
          if (sessData?.session?.access_token) {
            authHeaders['Authorization'] = 'Bearer ' + sessData.session.access_token;
          }
          fetch('/api/asaas/subaccount', {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({
              userId: currentUser?.id,
              name: currentUser?.name,
              email: currentUser?.email,
              cpfCnpj: currentUser?.cpfCnpj ? currentUser.cpfCnpj.replace(/\D/g, '') : undefined,
              phone: currentUser?.telefone,
              endereco: currentUser?.endereco,
              bairro: currentUser?.bairro,
              cidade: currentUser?.cidade
            })
          }).catch(_err => console.warn('Aviso ao vincular subconta:', _err));
        } catch (_sErr) {}
      } else {
        alert('Pagamento ainda em processamento. Conclua o Pix no seu banco e tente novamente.');
      }
    } catch (_e) {
      alert('Erro ao checar status. Tente novamente.');
    } finally {
      setIsChecking(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4">
        <div className="w-10 h-10 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-bold text-zinc-600 dark:text-zinc-400">Verificando autorização de acesso...</p>
      </div>
    );
  }

  if (isBlocked) {
    return (
      <div className="fixed inset-0 bg-zinc-950/80 backdrop-blur-md flex items-center justify-center p-4 z-[999] overflow-y-auto">
        <div className="bg-white dark:bg-zinc-900 border border-purple-300 dark:border-purple-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl text-center space-y-5 my-auto">
          
          <div className="w-14 h-14 bg-purple-100 dark:bg-purple-950/60 rounded-2xl flex items-center justify-center mx-auto text-purple-600">
            <ShieldAlert size={32} />
          </div>

          <div>
            <h2 className="text-xl font-black text-zinc-900 dark:text-white">
              Conta Aguardando Ativação
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              {roleName ? `Painel exclusivo para parceiros homologados (${roleName}).` : 'Painel exclusivo para parceiros homologados.'}
            </p>
          </div>

          <div className="bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 rounded-2xl p-4 text-left space-y-1">
            <p className="text-xs font-black text-purple-900 dark:text-purple-200 flex items-center gap-1.5">
              <Clock size={16} className="text-purple-600 shrink-0" />
              Taxa Única de Homologação Asaas
            </p>
            <p className="text-[11px] text-purple-700 dark:text-purple-300 leading-relaxed">
              As vagas de fundadores liberadas pelo Admin foram preenchidas. Para desbloquear seu painel operacional e começar a receber pedidos e corridas, conclua a ativação via Pix:
            </p>
            <p className="text-xl font-black text-purple-900 dark:text-purple-100 mt-2">
              R$ {activationFee.toFixed(2).replace('.', ',')}
            </p>
          </div>

          {pixData?.pixQrCode ? (
            <div className="flex flex-col items-center justify-center p-3 bg-zinc-50 dark:bg-zinc-800/80 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-inner">
              <img 
                src={`data:image/png;base64,${pixData.pixQrCode}`} 
                alt="QR Code Pix Ativação" 
                className="w-44 h-44 rounded-lg object-contain"
              />
              <span className="text-[10px] text-zinc-400 mt-2 font-mono">Escaneie no aplicativo do seu banco</span>
            </div>
          ) : (
            <div className="p-8 bg-zinc-100 dark:bg-zinc-800 rounded-2xl flex flex-col items-center justify-center">
              <div className="w-8 h-8 border-3 border-purple-600 border-t-transparent rounded-full animate-spin mb-2" />
              <p className="text-xs text-zinc-500 font-medium">Carregando cobrança Pix Asaas...</p>
            </div>
          )}

          {pixData?.pixCopiaECola && (
            <div className="space-y-1 text-left">
              <label className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">Pix Copia e Cola:</label>
              <div className="flex items-center gap-2">
                <input 
                  type="text" 
                  readOnly 
                  value={pixData.pixCopiaECola} 
                  className="bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-[10px] font-mono p-2.5 rounded-xl w-full text-zinc-700 dark:text-zinc-300 select-all outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopyPix}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-bold p-2.5 rounded-xl text-xs shrink-0 flex items-center gap-1 shadow transition active:scale-95"
                >
                  <Copy size={14} />
                  {copiedPix ? 'Copiado!' : 'Copiar'}
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2 pt-1">
            <button 
              onClick={handleManualCheck}
              disabled={isChecking}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3.5 rounded-xl transition shadow-lg flex justify-center items-center gap-2 active:scale-95 text-sm disabled:opacity-50"
            >
              <RefreshCw size={16} className={isChecking ? 'animate-spin' : ''} />
              {isChecking ? 'Verificando no Asaas...' : 'Já Paguei o Pix'}
            </button>

            <button 
              onClick={handleLogout}
              className="w-full bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400 font-bold py-2.5 rounded-xl transition text-xs flex justify-center items-center gap-1.5"
            >
              <LogOut size={14} /> Sair da Conta
            </button>
          </div>

          <p className="text-[10px] text-zinc-400 leading-tight">
            🛡️ O acesso à operação da plataforma é liberado automaticamente após a compensação do Pix pela infraestrutura bancária Asaas.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
