"use client";

import React, { useState, useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Bike, BookOpen, Share2 } from "lucide-react";
import { useAppStore, getRatesForCity, calculateOrderFreight, getDailyWithdrawalCount, incrementDailyWithdrawalCount } from "@/store/useAppStore";
import { OrderTimelineBadges } from "@/components/OrderTimelineBadges";
import { MapModal, MapPoint } from "@/components/MapModal";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PartnerManualModal } from "@/components/PartnerManualModal";
import { OrderChatModal } from "@/components/OrderChatModal";
import { SupportChatButton } from "@/components/SupportChatButton";
import { ShareLandingModal } from "@/components/ShareLandingModal";
import { supabase } from "@/lib/supabase";
import PartnerActivationGuard from "@/components/PartnerActivationGuard";
import { AsaasPartnerBadge } from "@/components/AsaasPartnerBadge";
import { PartnerWithdrawalSection } from "@/components/PartnerWithdrawalSection";
import { PartnerDashboardLayout } from "@/components/PartnerDashboardLayout";

const emptySubscribe = () => () => {};

export default function MotoboyDashboard() {
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
        console.warn("Aviso de GPS do Motoboy:", err.message);
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
  const isMotoboyUser = currentUser && (roleStr === 'motoboy' || (roleStr === 'motorista' && (!veicStr || veicStr.includes('moto'))));

  if (!isMotoboyUser) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 flex flex-col items-center justify-center p-6 text-center">
        <Bike size={48} className="text-amber-600 mb-4" />
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">Acesso Restrito</h2>
        <p className="text-zinc-500 mb-6">Você precisa estar logado como Motoboy para acessar este painel.</p>
        <button onClick={() => router.push('/login')} className="bg-amber-600 text-white font-bold py-3 px-6 rounded-xl hover:bg-amber-700 transition">
          Fazer Login
        </button>
      </div>
    );
  }

  const rates = getRatesForCity(currentUser?.cidade, store.rates, store.cities) || store.rates || {};
  const formatMoney = (val: number) => (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const getMotoboyFee = (o: any) => {
    if (!o) return 0;
    if (o.taxas?.entregaMotorista && Number(o.taxas.entregaMotorista) > 0) {
      return Number(o.taxas.entregaMotorista);
    }
    const storeUsers = store.users || {};
    const orderCity = o.cidadeOrigem || (o.lojaId && storeUsers[o.lojaId] ? storeUsers[o.lojaId]?.cidade : undefined) || currentUser?.cidade || 'Belém';
    const cityRates = getRatesForCity(orderCity, store.rates, store.cities) || rates || {};
    const dist = Number(o.distancia || 1.0);
    const totalFrete = calculateOrderFreight('B2C', dist, cityRates);
    const platPct = Number((cityRates?.b2c_mot_plat ?? 15)) / 100;
    const fee = totalFrete * (1 - platPct);
    return isNaN(fee) ? 0 : fee;
  };

  const isDelivered = (st?: string) => {
    const norm = String(st || '').toLowerCase().trim();
    return ['entregue', 'received', 'delivered', 'completed', 'concluido', 'arquivado'].includes(norm);
  };

  const corridasDisponiveis = (store.orders || []).filter((o: any) => {
    if (!o) return false;
    const isReady = (o.status === 'pronto' || (o.status as string) === 'READY' || (o.status as string) === 'SEARCHING_OPERATOR') && (!o.motoristaId || o.motoristaId === null) && (o.type === 'B2C' || !o.type);
    if (!isReady) return false;
    return true;
  });
  const minhasCorridasAll = (store.orders || []).filter((o: any) => o && currentUser?.id && o.motoristaId === currentUser.id);
  const ganhosHoje = minhasCorridasAll.filter((o: any) => o && isDelivered(o.status) && !o.payoutDriverDone).reduce((acc: number, curr: any) => acc + (curr ? getMotoboyFee(curr) : 0), 0);
  const saquesHoje = currentUser?.id ? getDailyWithdrawalCount(currentUser.id) : 0;

  const motoActiveOrders = minhasCorridasAll.filter((o: any) => o && !isDelivered(o.status) && o.status !== 'cancelado' && o.status !== 'arquivado');
  const motoHistoryOrders = minhasCorridasAll.filter((o: any) => o && (isDelivered(o.status) || o.status === 'cancelado' || o.status === 'arquivado'));
  const minhasCorridas = [...motoActiveOrders, ...motoHistoryOrders];
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
      console.warn("Erro ao atualizar dados do motoboy:", e);
    } finally {
      setIsRefreshing(false);
    }
  };

  const isPaused = currentUser?.status === 'paused';
  const handleToggleStatus = () => {
    if (!currentUser?.id) return;
    store.updateUserStatus(currentUser.id, isPaused ? 'active' : 'paused');
  };

  const linkAsaasAccount = store.linkAsaasAccount;
  const handleLinkAsaas = async () => {
    if (!currentUser) return;
    const cpfKey = currentUser.cpfCnpj || currentUser.pixKey;
    alert(`🔒 Chave PIX Oficial de Repasses:\n\nSua Chave Pix oficial cadastrada é o seu CPF/CNPJ (${cpfKey || 'Cadastrado'}).\n\nPor conformidade bancária e segurança contra fraudes, os repasses de corridas são creditados exclusivamente na conta bancária de mesma titularidade.`);
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
        const pendingOrders = minhasCorridasAll.filter((o: any) => isDelivered(o.status) && !o.payoutDriverDone);
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
      role="motorista"
      title="Corridas (B2C)"
      roleIcon={<Bike className="text-amber-500" size={24} />}
      themeColor="amber"
      partnerId={currentUser.id}
      partnerName={`${currentUser.name || 'Entregador Motoboy'} (${currentUser.veiculo || 'Moto'})`}
      locationText={`Base: ${currentUser.bairro || currentUser.cidade || 'Belém'}`}
      pixKeyInfo={currentUser.cpfCnpj || currentUser.pixKey}
      statusLabel={isPaused ? 'Pausado (Fora de Serviço)' : 'Online (Recebendo Corridas)'}
      isOnline={!isPaused}
      onToggleStatus={handleToggleStatus}
      isRefreshing={isRefreshing}
      onRefresh={handleRefresh}
      virtualVaultValue={ganhosHoje}
      manualRole="motoboy"
      shareModal={<ShareLandingModal isOpen={shareLandingModalOpen} onClose={() => setShareLandingModalOpen(false)} />}
    >
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-2 mb-6">
        <div className="flex gap-2 overflow-x-auto">
          <button onClick={() => setActiveTab('geral')} className={`py-2.5 px-4 font-bold text-xs sm:text-sm rounded-xl transition whitespace-nowrap ${activeTab === 'geral' ? 'bg-purple-600 text-white shadow-md' : 'text-zinc-400 hover:text-zinc-200'}`}>📊 Visão Geral</button>
          <button onClick={() => setActiveTab('radar')} className={`py-2.5 px-4 font-bold text-xs sm:text-sm rounded-xl transition whitespace-nowrap ${activeTab === 'radar' ? 'bg-purple-600 text-white shadow-md' : 'text-zinc-400 hover:text-zinc-200'}`}>🚨 Radar B2C</button>
          <button onClick={() => setActiveTab('historico')} className={`py-2.5 px-4 font-bold text-xs sm:text-sm rounded-xl transition whitespace-nowrap ${activeTab === 'historico' ? 'bg-purple-600 text-white shadow-md' : 'text-zinc-400 hover:text-zinc-200'}`}>📦 Minhas Corridas</button>
        </div>
      </div>

        {activeTab === 'radar' && (
        <div className="grid grid-cols-1 gap-6 animate-in fade-in zoom-in-95 duration-300">
            <div>
                <h3 className="font-bold text-lg text-zinc-700 dark:text-zinc-200 border-b border-zinc-200 dark:border-zinc-800 pb-2 mb-4">🚨 Radar de Corridas</h3>
                <div className="space-y-4">
                  {corridasDisponiveis.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-8 bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-dashed border-zinc-300 dark:border-zinc-700 text-center">
                        <span className="text-4xl mb-3 opacity-50">📡</span>
                        <p className="text-zinc-500 font-medium">Nenhum chamado no radar no momento.</p>
                    </div>
                  ) : corridasDisponiveis.map((o: any) => {
                    const origem = store.users?.[o.origemId];
                    const destino = store.users?.[o.destinoId];
                    return (
                      <div key={o.id} className="bg-white dark:bg-zinc-900 p-4 rounded-xl shadow-sm border border-blue-100 dark:border-blue-900/50">
                          <div className="flex justify-between items-center mb-2">
                              <span className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded">Nova Rota B2C</span>
                              <span className="text-base sm:text-lg font-black text-zinc-950 dark:text-white tracking-tight">Líquido: {formatMoney(getMotoboyFee(o))}</span>
                          </div>
                          <div className="bg-gray-50 dark:bg-zinc-950/50 p-3 rounded text-sm mb-4 flex flex-col gap-1 border border-zinc-100 dark:border-zinc-800">
                              <div className="flex items-center gap-2"><span className="text-zinc-400 text-xs">📍</span> <span className="text-zinc-700 dark:text-zinc-300 font-medium">{origem?.bairro || '—'}</span></div>
                              <div className="flex items-center gap-2"><span className="text-zinc-400 text-xs">🏁</span> <span className="text-zinc-700 dark:text-zinc-300 font-medium">{destino?.bairro || '—'}</span></div>
                              <button 
                                onClick={() => {
                                  const latOrigem = (origem?.lat && origem.lat !== 0) ? origem.lat : -1.4558;
                                  const lngOrigem = (origem?.lng && origem.lng !== 0) ? origem.lng : -48.4908;
                                  const latDestino = o.deliveryLat || destino?.lat || (latOrigem + 0.0045);
                                  const lngDestino = o.deliveryLng || destino?.lng || (lngOrigem + 0.0045);
                                  const driverLat = (currentUser?.lat && currentUser.lat !== 0) ? currentUser.lat : latOrigem - 0.003;
                                  const driverLng = (currentUser?.lng && currentUser.lng !== 0) ? currentUser.lng : lngOrigem - 0.003;

                                  setMapModal({
                                    open: true,
                                    origem: { lat: latOrigem, lng: lngOrigem, name: o.lojaNome || origem?.name || 'Retirada' },
                                    destino: { lat: latDestino, lng: lngDestino, name: o.clienteNome || destino?.name || 'Entrega' },
                                    motorista: { lat: driverLat, lng: driverLng, name: currentUser?.name || 'Sua Moto', veiculo: currentUser?.veiculo || 'Moto' }
                                  });
                                }} 
                                className="mt-2 text-blue-600 bg-blue-100/50 dark:bg-blue-900/20 p-2 rounded-lg font-bold hover:bg-blue-100 dark:hover:bg-blue-900/40 text-center w-full transition border border-blue-200 dark:border-blue-800"
                              >
                                🗺️ Ver Rota de {o.distancia ? o.distancia.toFixed(1) : '0.0'} km
                              </button>
                          </div>
                          <button onClick={() => store.acaoPedido(o.id, 'aceitar_motorista')} className="w-full bg-zinc-800 hover:bg-black dark:bg-zinc-800 dark:hover:bg-zinc-700 text-white text-base font-bold py-3.5 rounded-xl transition shadow-md">Aceitar Corrida</button>
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
                    const isCanceled = o.status === 'cancelado';
                    const lojaUser = store.users?.[o.lojaId!] || store.users?.[o.origemId];
                    const clienteId = o.clienteId || (o.type === 'B2C' ? o.criadoPor : undefined) || o.destinoId;
                    const clienteUser = store.users?.[clienteId] || store.users?.[o.destinoId];
                    const origemUser = lojaUser;
                    const destinoUser = clienteUser;
                    return (
                    <div key={o.id} className={`bg-white dark:bg-zinc-900 p-4 rounded-xl shadow-sm border ${o.status === 'em_rota' ? 'border-purple-400 dark:border-purple-600' : isCanceled ? 'border-red-300 opacity-60 border-l-4 border-l-red-400' : 'border-zinc-200 dark:border-zinc-800'}`}>
                        <div className="flex justify-between items-center mb-2">
                            <span className="font-extrabold text-zinc-900 dark:text-white text-sm sm:text-base">{o.title}</span>
                            <span className="text-base sm:text-lg font-black text-zinc-950 dark:text-white tracking-tight">Líquido: {formatMoney(getMotoboyFee(o))}</span>
                        </div>
                        
                        <div className="bg-gray-50 dark:bg-zinc-950/50 p-3 rounded-lg text-xs mb-3 flex flex-col gap-1.5 border border-zinc-100 dark:border-zinc-800">
                            <div className="flex items-center gap-2">
                                <span className="text-sm">📍</span> 
                                <div>
                                    <span className="text-[10px] font-bold uppercase text-zinc-400 block">Retirar na Loja</span>
                                    <span className="text-zinc-800 dark:text-zinc-200 font-bold">{o.lojaNome || lojaUser?.name || '—'}</span> 
                                    <span className="text-zinc-500 text-[11px]"> ({lojaUser?.bairro || '—'})</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 pt-1 border-t border-zinc-200 dark:border-zinc-800">
                                <span className="text-sm">🏁</span> 
                                <div>
                                    <span className="text-[10px] font-bold uppercase text-zinc-400 block">Entregar ao Cliente</span>
                                    <span className="text-zinc-800 dark:text-zinc-200 font-bold">{o.clienteNome || clienteUser?.name || '—'}</span> 
                                    <span className="text-purple-600 dark:text-purple-400 font-bold text-[11px]"> ({o.deliveryAddress || clienteUser?.bairro || '—'})</span>
                                    {o.deliveryReference && (
                                        <p className="text-[10px] font-medium text-amber-600 dark:text-amber-400 italic mt-0.5">📌 Ref: {o.deliveryReference}</p>
                                    )}
                                </div>
                            </div>
                            <div className="mt-2 flex flex-col sm:flex-row gap-2 w-full">
                              <button 
                                  onClick={() => {
                                    const latOrigem = (lojaUser?.lat && lojaUser.lat !== 0) ? lojaUser.lat : -1.4558;
                                    const lngOrigem = (lojaUser?.lng && lojaUser.lng !== 0) ? lojaUser.lng : -48.4908;
                                    
                                    const latDestino = (o.deliveryLat && o.deliveryLat !== 0) 
                                      ? o.deliveryLat 
                                      : ((clienteUser?.lat && clienteUser.lat !== 0) ? clienteUser.lat : (latOrigem ? latOrigem + 0.0045 : -1.4552));
                                    
                                    const lngDestino = (o.deliveryLng && o.deliveryLng !== 0) 
                                      ? o.deliveryLng 
                                      : ((clienteUser?.lng && clienteUser.lng !== 0) ? clienteUser.lng : (lngOrigem ? lngOrigem + 0.0045 : -48.4902));

                                    const driverLat = (currentUser?.lat && currentUser.lat !== 0) ? currentUser.lat : latOrigem - 0.003;
                                    const driverLng = (currentUser?.lng && currentUser.lng !== 0) ? currentUser.lng : lngOrigem - 0.003;

                                    setMapModal({
                                      open: true,
                                      origem: { lat: latOrigem, lng: lngOrigem, name: o.lojaNome || lojaUser?.name || 'Retirada' },
                                      destino: { lat: latDestino, lng: lngDestino, name: o.clienteNome || clienteUser?.name || 'Entrega' },
                                      motorista: { lat: driverLat, lng: driverLng, name: currentUser?.name || 'Sua Moto', veiculo: currentUser?.veiculo || 'Moto' }
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
                                  href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(o.lojaNome || 'Ponto do açaí, Belém')}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex-1 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs transition flex items-center justify-center gap-1.5 shadow-sm text-center"
                                >
                                  🚀 GPS p/ Retirada
                                </a>
                              )}

                              {(() => {
                                 const latOrig = origemUser?.lat || 0;
                                 const lngOrig = origemUser?.lng || 0;
                                 const latDest = o.deliveryLat || destinoUser?.lat;
                                 const lngDest = o.deliveryLng || destinoUser?.lng;

                                 const hasDistinctDestCoords = latDest && lngDest && (Math.abs(latDest - latOrig) > 0.0001 || Math.abs(lngDest - lngOrig) > 0.0001);
                                 
                                 const clientDestStr = o.deliveryAddress 
                                   ? o.deliveryAddress 
                                   : (destinoUser?.bairro ? `${destinoUser.bairro}, ${destinoUser.cidade || 'Belém'}` : (destinoUser?.endereco || o.clienteNome || 'Cliente'));

                                 const mapsUrl = hasDistinctDestCoords
                                   ? `https://www.google.com/maps/dir/?api=1&destination=${latDest},${lngDest}`
                                   : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(clientDestStr)}`;

                                 return (
                                   <a 
                                     href={mapsUrl}
                                     target="_blank"
                                     rel="noopener noreferrer"
                                     className="flex-1 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 font-bold p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-900/40 text-xs transition flex items-center justify-center gap-1.5 shadow-sm text-center"
                                   >
                                     🏁 GPS p/ Cliente
                                   </a>
                                 );
                               })()}
                            </div>
                            <div className="flex gap-2 mt-2">
                              <button
                                type="button"
                                onClick={() => {
                                  const clienteId = o.clienteId || (o as any).buyerId || o.destinoId;
                                  const clienteUser = clienteId && store.users ? store.users[clienteId] : null;
                                  const lojaId = o.lojaId || (o as any).sellerStorefrontId || o.origemId;
                                  const lojaUser = lojaId && store.users ? store.users[lojaId] : null;
                                  setChatModalData({
                                    open: true,
                                    orderId: o.id,
                                    otherName: clienteUser?.name || o.clienteNome || 'Cliente',
                                    otherPhone: (clienteUser as any)?.phone || clienteUser?.telefone || o.clienteTelefone || '',
                                    otherRole: 'Cliente'
                                  });
                                }}
                                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold p-2.5 rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
                              >
                                💬 Chat do Pedido
                              </button>
                            </div>
                        </div>
                        <OrderTimelineBadges order={o} className="flex flex-wrap gap-2 mb-3" />
                        
                        {o.status === 'em_rota' ? (
                            <div className="flex gap-2 w-full">
                                <button onClick={() => { if(confirm('Deseja realmente cancelar esta corrida?')) store.acaoPedido(o.id, 'cancelar_pedido'); }} className="bg-red-100 hover:bg-red-200 text-red-700 text-xs font-bold px-3 py-3 rounded-lg transition">❌ Cancelar</button>
                                {!o.pickedUpAt ? (
                                  <button onClick={() => store.acaoPedido(o.id, 'retirar_pedido')} className="flex-1 bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold py-3 rounded-lg shadow transition flex items-center justify-center gap-1.5">
                                    🏪 Confirmar Chegada na Loja
                                  </button>
                                ) : (
                                  <button onClick={() => store.acaoPedido(o.id, 'conf_motorista')} className="flex-1 bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold py-3 rounded-lg shadow transition flex items-center justify-center gap-1.5">
                                    🏁 Confirmar Chegada no Cliente
                                  </button>
                                )}
                            </div>
                        ) : o.status === 'aguardando_cliente' ? (
                            <div className="bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-800 p-4 rounded-xl flex flex-col gap-3 shadow-inner">
                                <p className="text-xs text-center font-bold">Peça o PIN de Segurança ao cliente</p>
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
                                <p>✅ Entrega Concluída</p>
                                {o.payoutDriverDone ? (
                                  <span className="text-[10px] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-bold px-2 py-1 rounded border border-emerald-200 dark:border-emerald-800/60 shadow-sm flex items-center gap-1">
                                    ✅ Repasse Liquidado (R$ {getMotoboyFee(o).toFixed(2)})
                                  </span>
                                ) : (
                                  <span className="text-[10px] bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 font-bold px-2 py-1 rounded border border-amber-200 dark:border-amber-800/60 shadow-sm flex items-center gap-1">
                                    ⏳ Saldo p/ Saque Asaas (R$ {getMotoboyFee(o).toFixed(2)})
                                  </span>
                                )}
                            </div>
                        ) : isCanceled ? (
                            <div className="flex flex-col gap-2">
                               <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 text-xs p-2 rounded text-center font-bold">Cancelado</div>
                               <button onClick={() => { if(confirm('Deseja excluir esta corrida do seu histórico?')) store.acaoPedido(o.id, 'deletar_pedido') }} className="w-full text-xs bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold py-2 rounded-lg transition">🗑️ Excluir</button>
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
          currentUserRole="motoboy"
          otherParticipantName={chatModalData.otherName}
          otherParticipantPhone={chatModalData.otherPhone}
          otherParticipantRole={chatModalData.otherRole}
        />
      )}

      {/* BOTÃO FLUTUANTE DE ATENDIMENTO / SUPORTE GERAL */}
      <SupportChatButton currentUser={currentUser} />
      <AsaasPartnerBadge variant="footer" className="mt-8 mb-4" />
    </PartnerDashboardLayout>
  );
}
