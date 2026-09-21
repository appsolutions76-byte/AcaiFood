"use client";

import React, { useState, useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Truck, BookOpen, Share2 } from "lucide-react";
import { useAppStore, getRatesForCity, calculateOrderFreight, getDailyWithdrawalCount, incrementDailyWithdrawalCount } from "@/store/useAppStore";
import { MapModal, MapPoint } from "@/components/MapModal";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PartnerManualModal } from "@/components/PartnerManualModal";
import { OrderChatModal } from "@/components/OrderChatModal";
import { SupportChatButton } from "@/components/SupportChatButton";
import { ShareLandingModal } from "@/components/ShareLandingModal";
import { supabase } from "@/lib/supabase";
import PartnerActivationGuard from "@/components/PartnerActivationGuard";
import { initAudioUnlock, playDeliveryAlertTone } from "@/lib/soundAlerts";
import { AsaasPartnerBadge } from "@/components/AsaasPartnerBadge";
import { PartnerWithdrawalSection } from "@/components/PartnerWithdrawalSection";
import { PartnerDashboardLayout } from "@/components/PartnerDashboardLayout";

const emptySubscribe = () => () => {};

export default function CaminhaoDashboard() {
  const router = useRouter();
  const store = useAppStore();
  const currentUser = store.currentUser;
  
  const [mapModal, setMapModal] = useState<{
    open: boolean;
    origem: MapPoint | null;
    destino: MapPoint | null;
    motorista?: MapPoint | null;
  }>({ open: false, origem: null, destino: null, motorista: null });
  const [activeTab, setActiveTab] = useState('radar');
  const [pinInputs, setPinInputs] = useState<Record<string, string>>({});
  const [partnerManualOpen, setPartnerManualOpen] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [payingOrderId, setPayingOrderId] = useState<string | null>(null);
  const [chatModalData, setChatModalData] = useState<{ open: boolean; orderId: string; otherName?: string; otherPhone?: string; otherRole?: string }>({ open: false, orderId: "" });
  const [shareLandingModalOpen, setShareLandingModalOpen] = useState(false);

  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  useEffect(() => {
    initAudioUnlock();
    const s = useAppStore.getState();
    s.fetchAllUsers();
    if (typeof s.fetchCities === 'function') s.fetchCities();
    if (typeof s.fetchRates === 'function') s.fetchRates();
    s.startRealtime();
  }, []);

  // Captura contínua do GPS em tempo real quando Online
  useEffect(() => {
    if (!mounted || !currentUser || currentUser.status === 'paused' || typeof window === 'undefined' || !navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        if (latitude && longitude) {
          store.updateUserLocation(currentUser.id, latitude, longitude);
        }
      },
      (err) => {
        console.warn("Aviso de GPS do Caminhoneiro:", err.message);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [mounted, currentUser?.id, currentUser?.status]);

  if (!mounted) {
    return <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 flex items-center justify-center p-6"><p>Carregando...</p></div>;
  }

  const roleStr = String(currentUser?.role || '').toLowerCase();
  const veicStr = String(currentUser?.veiculo || '').toLowerCase();
  const isCaminhaoUser = currentUser && (roleStr === 'caminhao' || (roleStr === 'motorista' && (veicStr.includes('caminh') || veicStr.includes('caçamb'))));

  if (!isCaminhaoUser) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 flex flex-col items-center justify-center p-6 text-center">
        <Truck size={48} className="text-blue-600 mb-4" />
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">Acesso Restrito</h2>
        <p className="text-zinc-500 mb-6">Você precisa estar logado como Caminhoneiro ou Motorista de Caçamba para acessar este painel.</p>
        <button onClick={() => router.push('/login')} className="bg-blue-600 text-white font-bold py-3 px-6 rounded-xl hover:bg-blue-700 transition">
          Fazer Login
        </button>
      </div>
    );
  }

  const rates = getRatesForCity(currentUser?.cidade, store.rates, store.cities) || store.rates || {};
  const formatMoney = (val: number) => (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const getDriverFee = (o: any) => {
    if (!o) return 0;
    if (o.taxas?.entregaMotorista && Number(o.taxas.entregaMotorista) > 0) {
      return Number(o.taxas.entregaMotorista);
    }
    const storeUsers = store.users || {};
    const orderCity = o.cidadeOrigem || (o.origemId && storeUsers[o.origemId] ? storeUsers[o.origemId]?.cidade : undefined) || currentUser?.cidade || 'Belém';
    const cityRates = getRatesForCity(orderCity, store.rates, store.cities) || rates || {};
    const dist = Number(o.distancia || 1.0);
    const totalFrete = calculateOrderFreight(o.type || 'B2B', dist, cityRates);
    const platPct = Number(((o.type === 'COLETA' ? cityRates?.col_mot_plat : cityRates?.b2b_mot_plat) ?? 15)) / 100;
    const fee = totalFrete * (1 - platPct);
    return isNaN(fee) ? 0 : fee;
  };

  const isDelivered = (st?: string) => st === 'entregue' || st === 'RECEIVED' || st === 'DELIVERED';

  const corridasDisponiveis = (store.orders || []).filter((o: any) => {
    if (o.motoristaId) return false;
    if (o.status === 'cancelado' || o.status === 'arquivado' || o.status === 'entregue') return false;
    
    // Coleta (caçamba de caroço) fica disponível assim que o pagamento Pix é confirmado pela loja
    if (o.type === 'COLETA') {
      return o.status === 'pronto' || o.status === 'pendente' || (o.status as string) === 'READY' || (o.status as string) === 'PAID' || (o.status as string) === 'SEARCHING_OPERATOR';
    }
    // Frete B2B fica disponível quando o fornecedor apronta o pedido
    if (o.type === 'B2B') {
      return o.status === 'pronto' || (o.status as string) === 'READY' || (o.status as string) === 'SEARCHING_OPERATOR';
    }
    return false;
  });

  const lastAvailableCountRef = React.useRef(0);
  useEffect(() => {
    if (corridasDisponiveis.length > lastAvailableCountRef.current) {
      playDeliveryAlertTone();
    }
    lastAvailableCountRef.current = corridasDisponiveis.length;
  }, [corridasDisponiveis.length]);

  const minhasCorridas = (store.orders || []).filter((o: any) => o.motoristaId === currentUser.id);
  const ganhosHoje = minhasCorridas.filter((o: any) => isDelivered(o.status) && !o.payoutDriverDone).reduce((acc: number, curr: any) => acc + getDriverFee(curr), 0);
  const saquesHoje = currentUser ? getDailyWithdrawalCount(currentUser.id) : 0;

  const [isRefreshing, setIsRefreshing] = useState(false);
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      if (currentUser?.id) {
        await Promise.all([
          store.fetchOrders(currentUser.id, true),
          store.fetchAllUsers(true),
          store.fetchLojas(true),
          store.fetchRates(true)
        ]);
      } else {
        await Promise.all([
          store.fetchAllUsers(true),
          store.fetchLojas(true),
          store.fetchRates(true)
        ]);
      }
    } catch (e) {
      console.warn("Erro ao atualizar dados do caminhão:", e);
    } finally {
      setIsRefreshing(false);
    }
  };

  const isPaused = currentUser.status === 'paused';
  const handleToggleStatus = () => {
    store.updateUserStatus(currentUser.id, isPaused ? 'active' : 'paused');
  };

  const linkAsaasAccount = store.linkAsaasAccount;
  const handleLinkAsaas = async () => {
    if (!currentUser) return;
    const cpfKey = currentUser.cpfCnpj || currentUser.pixKey;
    alert(`🔒 Chave PIX Oficial de Repasses:\n\nSua Chave Pix oficial cadastrada é o seu CPF/CNPJ (${cpfKey || 'Cadastrado'}).\n\nPor conformidade bancária e segurança contra fraudes, os repasses de fretes pesados são creditados exclusivamente na conta bancária de mesma titularidade.`);
  };

  const handleResgatarPix = async () => {
    if (!currentUser) return;
    const targetKey = String(currentUser.cpfCnpj || currentUser.pixKey || '').replace(/\D/g, '');

    if (!targetKey) {
      alert("Chave Pix (CPF/CNPJ) não localizada no seu cadastro. Entre em contato com o suporte.");
      return;
    }

    if (!ganhosHoje || ganhosHoje <= 0) {
      alert("Não há saldo disponível para saque no momento.");
      return;
    }

    const saquesHoje = getDailyWithdrawalCount(currentUser.id);
    if (saquesHoje >= 2) {
      alert("⚠️ Limite diário atingido:\n\nVocê já realizou 2 saques hoje (limite máximo permitido). Novos valores acumulados serão liquidados automaticamente no encerramento diário pelo administrador ou estarão disponíveis para novo saque amanhã.");
      return;
    }

    if (isWithdrawing) return;

    if (confirm(`Deseja transferir R$ ${ganhosHoje.toFixed(2)} instantaneamente via PIX para o seu CPF/CNPJ (${targetKey}) cadastrado?\n(Saque ${saquesHoje + 1} de no máximo 2 saques hoje)`)) {
      setIsWithdrawing(true);
      try {
        const pendingOrders = minhasCorridas.filter((o: any) => isDelivered(o.status) && !o.payoutDriverDone);
        const pendingOrderIds = pendingOrders.map((o: any) => o.id);

        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch('/api/asaas/withdrawals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}) }
        });
        const data = await res.json();
        if (res.ok && data.success) {
          incrementDailyWithdrawalCount(currentUser.id);
          alert(`✅ Solicitação de Saque no valor de R$ ${ganhosHoje.toFixed(2)} enviada com sucesso!\nO valor será repassado via Pix Asaas para sua chave/subconta.`);
          store.fetchOrders(currentUser.id, true);
        } else {
          const msg = data.error || '';
          alert(`Solicitação de Saque: ${msg || 'Não foi possível registrar o saque no momento.'}`);
        }
      } catch (_err) {
        alert("Erro de conexão ao solicitar transferência PIX.");
      } finally {
        setIsWithdrawing(false);
      }
    }
  };


  return (
    <PartnerDashboardLayout
      role="caminhao"
      title="Fretes Pesados (B2B / Coleta)"
      roleIcon={<Truck size={24} />}
      themeColor="amber"
      partnerId={currentUser.id}
      partnerName={`${currentUser.name} (${currentUser.veiculo || 'Caminhão'})`}
      locationText={currentUser.bairro ? `Base: ${currentUser.bairro}` : undefined}
      pixKeyInfo={currentUser.cpfCnpj || currentUser.pixKey}
      statusLabel={isPaused ? 'Offline (Ficar Online)' : 'Online (Recebendo Fretes)'}
      isOnline={!isPaused}
      onToggleStatus={handleToggleStatus}
      isRefreshing={isRefreshing}
      onRefresh={handleRefresh}
      virtualVaultValue={ganhosHoje}
      manualRole="caminhao"
      shareModal={<ShareLandingModal isOpen={shareLandingModalOpen} onClose={() => setShareLandingModalOpen(false)} />}
    >
      <div className="space-y-6">
        {/* Abas do Caminhoneiro */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-2 shadow-md flex items-center justify-between gap-2 flex-wrap">
          <div className="flex gap-2 overflow-x-auto">
            <button onClick={() => setActiveTab('geral')} className={`py-2.5 px-4 rounded-xl font-bold text-xs transition whitespace-nowrap ${activeTab === 'geral' ? 'bg-amber-600 text-white shadow' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}>📊 Visão Geral</button>
            <button onClick={() => setActiveTab('radar')} className={`py-2.5 px-4 rounded-xl font-bold text-xs transition whitespace-nowrap ${activeTab === 'radar' ? 'bg-amber-600 text-white shadow' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}>📡 Radar de Fretes ({corridasDisponiveis.length})</button>
            <button onClick={() => setActiveTab('historico')} className={`py-2.5 px-4 rounded-xl font-bold text-xs transition whitespace-nowrap ${activeTab === 'historico' ? 'bg-amber-600 text-white shadow' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}>🚚 Meus Fretes ({minhasCorridas.length})</button>
          </div>
          <button 
            onClick={() => setShareLandingModalOpen(true)}
            className="text-xs bg-pink-950/40 hover:bg-pink-900/60 text-pink-300 border border-pink-900/50 px-3 py-2 rounded-xl font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
          >
            <Share2 size={14} /> Compartilhar
          </button>
        </div>

        {!currentUser?.asaasLinked && (
          <div className="bg-amber-950/30 border border-amber-800/60 rounded-2xl p-6 text-center shadow-sm">
            <h3 className="text-amber-300 font-bold text-lg mb-2">Atenção: Repasses Pendentes!</h3>
            <p className="text-amber-200/80 text-sm mb-4">
              Para receber os pagamentos dos seus fretes diretamente no seu PIX ou subconta Asaas, vincule sua Chave PIX / Carteira Asaas.
            </p>
            <button 
              onClick={handleLinkAsaas}
              className="inline-block bg-amber-600 text-white font-bold py-3 px-6 rounded-xl shadow-md hover:bg-amber-700 transition"
            >
              🤝 Vincular Subconta / Carteira Asaas
            </button>
          </div>
        )}

        {activeTab === 'radar' && (
        <div className="grid grid-cols-1 gap-6 animate-in fade-in zoom-in-95 duration-300">
            <div>
                <h3 className="font-bold text-lg text-zinc-700 dark:text-zinc-200 border-b border-zinc-200 dark:border-zinc-800 pb-2 mb-4">🚨 Radar de Fretes</h3>
                <div className="space-y-4">
                  {corridasDisponiveis.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-8 bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-dashed border-zinc-300 dark:border-zinc-700 text-center">
                        <span className="text-4xl mb-3 opacity-50">📡</span>
                        <p className="text-zinc-500 font-medium">Nenhum frete pesado no momento.</p>
                    </div>
                  ) : corridasDisponiveis.map((o: any) => {
                    const isColeta = o.type === 'COLETA';
                    const origId = o.origemId || o.lojaId;
                    const destId = o.destinoId;
                    const origem = (origId && store.users ? store.users[origId] : null) || (o.lojaNome ? { name: o.lojaNome, bairro: o.cidadeOrigem || 'Belém' } : null);
                    const destino = isColeta
                      ? { name: 'Ecoponto Municipal', bairro: 'Área de Descarte Ecológico' }
                      : ((destId && store.users) ? store.users[destId] : null);
                    return (
                      <div key={o.id} className="bg-white dark:bg-zinc-900 p-4 rounded-xl shadow-sm border border-blue-100 dark:border-blue-900/50">
                          <div className="flex justify-between items-center mb-2">
                              <span className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded">
                                {isColeta ? '🚛 Coleta de Caroço (Caçamba)' : `Nova Rota ${o.type}`}
                              </span>
                              <span className="text-base sm:text-lg font-black text-zinc-950 dark:text-white tracking-tight">Líquido: {formatMoney(getDriverFee(o))}</span>
                          </div>
                          <div className="bg-gray-50 dark:bg-zinc-950/50 p-3 rounded text-sm mb-4 flex flex-col gap-1 border border-zinc-100 dark:border-zinc-800">
                              <div className="flex items-center gap-2">
                                <span className="text-zinc-400 text-xs">📍</span> 
                                <span className="text-zinc-700 dark:text-zinc-300 font-medium">
                                  {isColeta ? `Retirar em: ${o.lojaNome || origem?.name || 'Loja de Açaí'} (${origem?.bairro || o.lojaEndereco || 'Belém'})` : (origem?.bairro || '—')}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-zinc-400 text-xs">🏁</span> 
                                <span className="text-zinc-700 dark:text-zinc-300 font-medium">
                                  {isColeta ? 'Descarte: Ecoponto Municipal de Caroço' : (destino?.bairro || '—')}
                                </span>
                              </div>
                              <button 
                                onClick={() => {
                                  const latOrigem = ((origem as any)?.lat && (origem as any).lat !== 0) ? (origem as any).lat : -1.4558;
                                  const lngOrigem = ((origem as any)?.lng && (origem as any).lng !== 0) ? (origem as any).lng : -48.4908;
                                  const latDestino = o.deliveryLat || (destino as any)?.lat || (latOrigem + 0.0045);
                                  const lngDestino = o.deliveryLng || (destino as any)?.lng || (lngOrigem + 0.0045);
                                  const driverLat = (currentUser?.lat && currentUser.lat !== 0) ? currentUser.lat : latOrigem - 0.003;
                                  const driverLng = (currentUser?.lng && currentUser.lng !== 0) ? currentUser.lng : lngOrigem - 0.003;

                                  setMapModal({
                                    open: true,
                                    origem: { lat: latOrigem, lng: lngOrigem, name: o.lojaNome || origem?.name || 'Retirada' },
                                    destino: { lat: latDestino, lng: lngDestino, name: isColeta ? 'Ecoponto Municipal' : (o.clienteNome || destino?.name || 'Entrega') },
                                    motorista: { lat: driverLat, lng: driverLng, name: currentUser?.name || 'Seu Veículo', veiculo: currentUser?.veiculo || 'Caminhão' }
                                  });
                                }} 
                                className="mt-2 text-blue-600 bg-blue-100/50 dark:bg-blue-900/20 p-2 rounded-lg font-bold hover:bg-blue-100 dark:hover:bg-blue-900/40 text-center w-full transition border border-blue-200 dark:border-blue-800"
                              >
                                🗺️ Ver Rota de {o.distancia ? o.distancia.toFixed(1) : '0.0'} km
                              </button>
                          </div>
                          <button onClick={() => store.acaoPedido(o.id, 'aceitar_motorista')} className="w-full bg-blue-600 hover:bg-blue-700 text-white text-base font-bold py-3.5 rounded-xl transition shadow-md">
                            {isColeta ? '🚛 Aceitar Coleta' : 'Aceitar Frete'}
                          </button>
                      </div>
                    )
                  })}
                </div>
            </div>
        </div>
        )}
            
        {activeTab === 'historico' && (
        <div className="grid grid-cols-1 gap-6 animate-in fade-in zoom-in-95 duration-300">
            <div>
                <h3 className="font-bold text-lg text-zinc-700 dark:text-zinc-200 border-b border-zinc-200 dark:border-zinc-800 pb-2 mb-4">📦 Em Andamento</h3>
                <div className="space-y-4">
                  {minhasCorridas.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-8 bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-dashed border-zinc-300 dark:border-zinc-700 text-center">
                        <span className="text-4xl mb-3 opacity-50">✅</span>
                        <p className="text-zinc-500 font-medium">Você está livre.</p>
                    </div>
                  ) : minhasCorridas.map((o: any) => {
                    const isColeta = o.type === 'COLETA';
                    const origId = o.fornecedorId || o.origemId || o.lojaId;
                    const destId = o.destinoId || o.lojaId;
                    const origemUser = (origId && store.users) ? store.users[origId] : null;
                    const destinoUser = isColeta
                      ? { name: 'Ecoponto Municipal de Caroço', bairro: 'Área de Descarte Ecológico' }
                      : ((destId && store.users) ? store.users[destId] : null);
                    return (
                    <div key={o.id} className={`bg-white dark:bg-zinc-900 p-4 rounded-xl shadow-sm border ${o.status === 'em_rota' ? 'border-blue-400 dark:border-blue-600' : 'border-zinc-200 dark:border-zinc-800'}`}>
                        <div className="flex justify-between items-center mb-2">
                            <span className="font-extrabold text-zinc-900 dark:text-white text-sm sm:text-base">{o.title}</span>
                            <span className="text-base sm:text-lg font-black text-zinc-950 dark:text-white tracking-tight">Líquido: {formatMoney(getDriverFee(o))}</span>
                        </div>
                        
                        <div className="bg-gray-50 dark:bg-zinc-950/50 p-3 rounded-lg text-xs mb-3 flex flex-col gap-1.5 border border-zinc-100 dark:border-zinc-800">
                            <div className="flex items-center gap-2">
                                <span className="text-sm">📍</span> 
                                <div>
                                    <span className="text-[10px] font-bold uppercase text-zinc-400 block">{isColeta ? 'Retirar na Loja de Açaí' : 'Retirar no Fornecedor'}</span>
                                    <span className="text-zinc-800 dark:text-zinc-200 font-bold">{o.lojaNome || origemUser?.name || 'Loja de Açaí'}</span> 
                                    <span className="text-zinc-500 text-[11px]"> ({origemUser?.bairro || o.lojaEndereco || '—'})</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 pt-1 border-t border-zinc-200 dark:border-zinc-800">
                                <span className="text-sm">🏁</span> 
                                <div>
                                    <span className="text-[10px] font-bold uppercase text-zinc-400 block">{isColeta ? 'Destino do Caroço' : 'Entregar na Loja'}</span>
                                    <span className="text-zinc-800 dark:text-zinc-200 font-bold">{isColeta ? 'Ecoponto Municipal de Caroço' : (o.clienteNome || destinoUser?.name || '—')}</span> 
                                    <span className="text-zinc-500 text-[11px]"> ({isColeta ? 'Descarte Ecológico' : (destinoUser?.bairro || '—')})</span>
                                </div>
                            </div>
                            <div className="mt-2 flex flex-col sm:flex-row gap-2 w-full">
                              <button 
                                  onClick={() => {
                                    const latOrigem = ((origemUser as any)?.lat && (origemUser as any).lat !== 0) ? (origemUser as any).lat : -1.4558;
                                    const lngOrigem = ((origemUser as any)?.lng && (origemUser as any).lng !== 0) ? (origemUser as any).lng : -48.4908;
                                    
                                    const latDestino = (o.deliveryLat && o.deliveryLat !== 0) 
                                      ? o.deliveryLat 
                                      : (((destinoUser as any)?.lat && (destinoUser as any).lat !== 0) ? (destinoUser as any).lat : (latOrigem ? latOrigem + 0.0045 : -1.4552));
                                    
                                    const lngDestino = (o.deliveryLng && o.deliveryLng !== 0) 
                                      ? o.deliveryLng 
                                      : (((destinoUser as any)?.lng && (destinoUser as any).lng !== 0) ? (destinoUser as any).lng : (lngOrigem ? lngOrigem + 0.0045 : -48.4902));

                                    const driverLat = (currentUser?.lat && currentUser.lat !== 0) ? currentUser.lat : latOrigem - 0.003;
                                    const driverLng = (currentUser?.lng && currentUser.lng !== 0) ? currentUser.lng : lngOrigem - 0.003;

                                    setMapModal({
                                      open: true,
                                      origem: { lat: latOrigem, lng: lngOrigem, name: o.lojaNome || origemUser?.name || 'Retirada' },
                                      destino: { lat: latDestino, lng: lngDestino, name: o.clienteNome || destinoUser?.name || 'Entrega' },
                                      motorista: { lat: driverLat, lng: driverLng, name: currentUser?.name || 'Seu Veículo', veiculo: currentUser?.veiculo || 'Caminhão' }
                                    });
                                  }} 
                                  className="flex-1 text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/30 p-2.5 rounded-xl font-bold text-center transition border border-blue-200 dark:border-blue-800/80 flex items-center justify-center gap-1.5 text-xs shadow-sm"
                              >
                                  🗺️ Ver Mapa ({(o.distancia || 0).toFixed(1)} km)
                              </button>
                              
                              {origemUser?.lat ? (
                                <a 
                                  href={`https://www.google.com/maps/dir/?api=1&destination=${origemUser.lat},${origemUser.lng}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex-1 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs transition flex items-center justify-center gap-1.5 shadow-sm text-center"
                                >
                                  🚀 GPS p/ Retirada
                                </a>
                              ) : (
                                <a 
                                  href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(origemUser?.name || o.lojaNome || 'Origem, Belém')}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex-1 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs transition flex items-center justify-center gap-1.5 shadow-sm text-center"
                                >
                                  🚀 GPS p/ Retirada
                                </a>
                              )}

                              {(() => {
                                const latOrig = (origemUser as any)?.lat || 0;
                                const lngOrig = (origemUser as any)?.lng || 0;
                                const latDest = o.deliveryLat || (destinoUser as any)?.lat;
                                const lngDest = o.deliveryLng || (destinoUser as any)?.lng;

                                const hasDistinctDest = latDest && lngDest && (Math.abs(latDest - latOrig) > 0.0001 || Math.abs(lngDest - lngOrig) > 0.0001);
                                const destAddress = o.deliveryAddress || (destinoUser as any)?.endereco || (destinoUser as any)?.bairro || o.clienteNome || 'Destino';

                                const mapsUrl = hasDistinctDest
                                  ? `https://www.google.com/maps/dir/?api=1&destination=${latDest},${lngDest}`
                                  : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destAddress)}`;

                                return (
                                  <>
                                    <a 
                                      href={mapsUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex-1 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 font-bold p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-900/40 text-xs transition flex items-center justify-center gap-1.5 shadow-sm text-center"
                                    >
                                      🏁 GPS p/ Destino
                                    </a>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const compradorUser = (o as any).buyerId ? store.users[(o as any).buyerId] : (o.destinoId ? store.users[o.destinoId] : null);
                                        const vendedorUser = o.origemId ? store.users[o.origemId] : null;
                                        const targetOther = compradorUser || vendedorUser;
                                        setChatModalData({
                                          open: true,
                                          orderId: o.id,
                                          otherName: targetOther?.name || o.clienteNome || 'Comprador/Vendedor',
                                          otherPhone: (targetOther as any)?.phone || targetOther?.telefone || '',
                                          otherRole: compradorUser ? 'Loja Compradora' : 'Fornecedor'
                                        });
                                      }}
                                      className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold p-2.5 rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow-sm text-center"
                                    >
                                      💬 Chat & 📞 Voz
                                    </button>
                                  </>
                                );
                              })()}
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2 mb-3">
                           {o.createdAt && <span className="text-[9px] bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-2 py-0.5 rounded font-bold">🕒 Pedido: {new Date(o.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>}
                           {o.acceptedAt && <span className="text-[9px] bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded font-bold">👨‍🍳 Aceito: {new Date(o.acceptedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>}
                           {o.readyAt && <span className="text-[9px] bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-2 py-0.5 rounded font-bold">🛎️ Pronto: {new Date(o.readyAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>}
                           {o.pickedUpAt && <span className="text-[9px] bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded font-bold">📦 Retirada: {new Date(o.pickedUpAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>}
                           {o.deliveredAt && <span className="text-[9px] bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 px-2 py-0.5 rounded font-bold">📍 Chegou: {new Date(o.deliveredAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>}
                           {o.receivedAt && <span className="text-[9px] bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 px-2 py-0.5 rounded font-bold">✅ Recebido: {new Date(o.receivedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>}
                        </div>
                        
                        {o.status === 'em_rota' ? (
                            <div className="flex gap-2 w-full">
                                <button onClick={() => { if(confirm('Deseja cancelar este transporte?')) store.acaoPedido(o.id, 'cancelar_pedido'); }} className="bg-red-100 hover:bg-red-200 text-red-700 text-xs font-bold px-3 py-3 rounded-lg transition">❌ Cancelar</button>
                                {!o.pickedUpAt ? (
                                  <button onClick={() => store.acaoPedido(o.id, 'retirar_pedido')} className="flex-1 bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold py-3 rounded-lg shadow transition flex items-center justify-center gap-1.5">
                                    🏪 Confirmar Chegada na Loja
                                  </button>
                                ) : (
                                  <button onClick={() => store.acaoPedido(o.id, 'conf_motorista')} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold py-3 rounded-lg shadow transition flex items-center justify-center gap-1.5">
                                    🏁 Confirmar Chegada no Destino
                                  </button>
                                )}
                            </div>
                        ) : o.status === 'aguardando_cliente' ? (
                            <div className="bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-800 p-4 rounded-xl flex flex-col gap-3 shadow-inner">
                                <p className="text-xs text-center font-bold">Peça o PIN de Segurança à Loja</p>
                                <div className="flex gap-2">
                                    <input 
                                        type="text" 
                                        maxLength={4} 
                                        placeholder="0000" 
                                        value={pinInputs[o.id] || ''} 
                                        onChange={e => setPinInputs(prev => ({...prev, [o.id]: e.target.value}))}
                                        className="w-20 text-center font-bold tracking-widest text-lg p-2 rounded-lg border border-orange-300 dark:border-orange-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-orange-500"
                                    />
                                    <button 
                                        onClick={() => store.acaoPedido(o.id, 'validar_pin', pinInputs[o.id])} 
                                        className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 rounded-lg transition shadow-md"
                                    >
                                        Validar e Finalizar
                                    </button>
                                </div>
                            </div>
                        ) : o.status === 'entregue' || o.status === 'arquivado' ? (
                            <div className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800 text-xs p-3 rounded-xl flex flex-col gap-2 items-center font-bold">
                                <p>✅ Frete Concluído</p>
                                {o.payoutDriverDone ? (
                                  <span className="text-[10px] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-bold px-2 py-1 rounded border border-emerald-200 dark:border-emerald-800/60 shadow-sm flex items-center gap-1">
                                    ✅ Repasse Liquidado (R$ {getDriverFee(o).toFixed(2)})
                                  </span>
                                ) : (
                                   <span className="text-[10px] bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 font-bold px-2 py-1 rounded border border-blue-200 dark:border-blue-800/60 shadow-sm flex items-center gap-1">
                                     ⏳ Saldo p/ Saque Asaas (R$ {getDriverFee(o).toFixed(2)})
                                   </span>
                                )}
                            </div>
                        ) : null}
                    </div>
                  )})}
                </div>
            </div>
        </div>
        )}

      <MapModal 
        isOpen={mapModal.open} 
        onClose={() => setMapModal(prev => ({ ...prev, open: false }))} 
        origem={mapModal.origem} 
        destino={mapModal.destino} 
        motorista={mapModal.motorista} 
      />

      {currentUser && (
        <OrderChatModal
          isOpen={chatModalData.open}
          onClose={() => setChatModalData({ open: false, orderId: "" })}
          orderId={chatModalData.orderId}
          currentUserId={currentUser.id}
          currentUserName={currentUser.name}
          currentUserRole="caminhoneiro"
          otherParticipantName={chatModalData.otherName}
          otherParticipantPhone={chatModalData.otherPhone}
          otherParticipantRole={chatModalData.otherRole}
        />
      )}

      {/* BOTÃO FLUTUANTE DE ATENDIMENTO / SUPORTE GERAL */}
      <SupportChatButton currentUser={currentUser} />
      <AsaasPartnerBadge variant="footer" className="mt-8 mb-4" />
      </div>
    </PartnerDashboardLayout>
  );
}
