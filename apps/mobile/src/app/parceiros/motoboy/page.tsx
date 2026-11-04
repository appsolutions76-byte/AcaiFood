"use client";

import React, { useState, useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Bike, BookOpen, Share2, Navigation, MapPin, X } from "lucide-react";
import { useAppStore, getRatesForCity, calculateOrderFreight, isCityFeatureEnabled } from "@/store/useAppStore";
import { OrderRatingCard } from "@/components/ratings/OrderRatingCard";
import { OrderTimelineBadges } from "@/components/OrderTimelineBadges";
import type { MapPoint } from "@/components/MapModal";
import { ThemeToggle } from "@/components/ThemeToggle";

import { SupportChatButton } from "@/components/SupportChatButton";

import { supabase } from "@/lib/supabase";
import PartnerActivationGuard from "@/components/PartnerActivationGuard";
import { initAudioUnlock, playDeliveryAlertTone } from "@/lib/soundAlerts";
import { AsaasPartnerBadge } from "@/components/AsaasPartnerBadge";
import { AppSolutionsBrandCard } from "@/components/AppSolutionsBrandCard";
import { PartnerWithdrawalSection } from "@/components/PartnerWithdrawalSection";
import { PartnerDashboardLayout } from "@/components/PartnerDashboardLayout";

// R41 (desempenho): janelas e abas pesadas só são baixadas depois que a tela abriu
const DriverReferralsSection = dynamic(() => import("@/components/referrals/DriverReferralsSection").then(m => m.DriverReferralsSection), { ssr: false });
const MyReceivedRatingsSection = dynamic(() => import("@/components/ratings/MyReceivedRatingsSection").then(m => m.MyReceivedRatingsSection), { ssr: false });

// R40 (desempenho): janelas pesadas só são baixadas quando a tela já abriu
const MapModal = dynamic(() => import("@/components/MapModal").then(m => m.MapModal), { ssr: false });
const OrderChatModal = dynamic(() => import("@/components/OrderChatModal").then(m => m.OrderChatModal), { ssr: false });
const ShareLandingModal = dynamic(() => import("@/components/ShareLandingModal").then(m => m.ShareLandingModal), { ssr: false });
const PhotoPickerModal = dynamic(() => import("@/components/PhotoPickerModal").then(m => m.PhotoPickerModal), { ssr: false });

// R40: monta o link do Google Maps. Usa as coordenadas cadastradas; sem elas, o endereço escrito.
const buildMapsUrl = (lat?: number | null, lng?: number | null, address?: string) => {
  const la = Number(lat);
  const ln = Number(lng);
  if (Number.isFinite(la) && Number.isFinite(ln) && la !== 0 && ln !== 0) {
    return `https://www.google.com/maps/dir/?api=1&destination=${la},${ln}`;
  }
  if (address && address.trim()) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address.trim())}`;
  }
  return '';
};
const joinAddress = (...parts: Array<string | undefined | null>) =>
  parts.map(p => String(p || '').trim()).filter(p => p && p !== '—').join(', ');

// Endereço da loja/batedeira de um pedido: primeiro o que já está no app; se faltar, busca só esse cadastro.
const resolveStoreMapsUrl = async (orderId: string, fallbackOrder?: any) => {
  const s = useAppStore.getState();
  const fresh: any = (s.orders || []).find((o: any) => o?.id === orderId) || fallbackOrder || {};
  const lojaId = fresh.lojaId || fresh.origemId;
  let loja: any = lojaId ? s.users?.[lojaId] : null;
  if (lojaId && (!loja || !Number(loja.lat) || !Number(loja.lng))) {
    try {
      const { data } = await supabase
        .from('users')
        .select('latitude, longitude, endereco, address, bairro, cidade')
        .eq('id', lojaId)
        .maybeSingle();
      if (data) {
        loja = {
          ...(loja || {}),
          lat: Number(data.latitude) || 0,
          lng: Number(data.longitude) || 0,
          endereco: data.endereco || data.address || loja?.endereco,
          bairro: data.bairro || loja?.bairro,
          cidade: data.cidade || loja?.cidade,
        };
      }
    } catch (_e) { /* segue com o que houver */ }
  }
  const address = joinAddress(loja?.endereco, loja?.bairro, loja?.cidade)
    || (fresh.lojaNome && fresh.lojaNome !== 'Estabelecimento Parceiro' ? joinAddress(fresh.lojaNome, loja?.cidade || 'Belém') : '');
  return buildMapsUrl(loja?.lat, loja?.lng, address);
};

// Destino do cliente: coordenadas da entrega; se faltarem, endereço escrito da entrega.
const resolveClientMapsUrl = (order: any) => {
  const s = useAppStore.getState();
  const fresh: any = (s.orders || []).find((o: any) => o?.id === order?.id) || order || {};
  const lojaUser: any = s.users?.[fresh.lojaId] || s.users?.[fresh.origemId];
  const clienteId = fresh.clienteId || fresh.buyerId || fresh.destinoId;
  const clienteUser: any = clienteId ? s.users?.[clienteId] : null;
  const latDest = Number(fresh.deliveryLat || clienteUser?.lat || 0);
  const lngDest = Number(fresh.deliveryLng || clienteUser?.lng || 0);
  const latOrig = Number(lojaUser?.lat || 0);
  const lngOrig = Number(lojaUser?.lng || 0);
  // Se o destino for igual ao ponto da loja, a coordenada não é do cliente: usa o endereço
  const distinct = latDest && lngDest && (Math.abs(latDest - latOrig) > 0.0001 || Math.abs(lngDest - lngOrig) > 0.0001);
  const address = joinAddress(fresh.deliveryAddress, fresh.delivery_bairro && !String(fresh.deliveryAddress || '').includes(fresh.delivery_bairro) ? fresh.delivery_bairro : '', clienteUser?.cidade || lojaUser?.cidade)
    || joinAddress(clienteUser?.endereco, clienteUser?.bairro, clienteUser?.cidade);
  return distinct ? buildMapsUrl(latDest, lngDest) : buildMapsUrl(null, null, address);
};

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
  const [acceptingOrderId, setAcceptingOrderId] = useState<string | null>(null);
  const [validatingPickupId, setValidatingPickupId] = useState<string | null>(null);

  // Aviso fixo com botão grande de GPS: aparece sempre após aceitar/retirar,
  // porque o celular pode bloquear a abertura automática do mapa.
  const [gpsPrompt, setGpsPrompt] = useState<{ url: string; label: string } | null>(null);

  const openGps = (url: string, label: string, missingMsg: string) => {
    if (!url) {
      setGpsPrompt({ url: '', label: missingMsg });
      return;
    }
    setGpsPrompt({ url, label });
    if (typeof window !== 'undefined') {
      try { window.open(url, '_blank', 'noopener'); } catch (_e) { /* o botão fica na tela */ }
    }
  };

  // 1. Aceitar corrida no radar e redirecionar direto para o GPS da batedeira
  const handleAcceptOrder = async (order: any) => {
    if (acceptingOrderId) return;
    setAcceptingOrderId(order.id);
    try {
      const success = await store.acaoPedido(order.id, 'aceitar_motorista');
      if (success === false) return;
      setActiveTab('ativos');
      // Depois de aceita, a corrida passa a trazer a loja de origem (o radar só mostra o bairro)
      const s = useAppStore.getState();
      if (s.currentUser?.id) await s.fetchOrders(s.currentUser.id, true);
      const url = await resolveStoreMapsUrl(order.id, order);
      openGps(url, 'Abrir GPS até a batedeira', 'Endereço da batedeira não encontrado. Use o Chat & Voz da corrida para combinar a retirada.');
    } finally {
      setAcceptingOrderId(null);
    }
  };

  // 2. Validar PIN de retirada no balcão e redirecionar direto para o GPS do cliente
  const handleValidatePickupPin = async (order: any) => {
    const pin = (pinInputs[`pickup_${order.id}`] || '').trim();
    if (!pin || pin.length !== 4) {
      alert("⚠️ Por favor, digite o PIN de Retirada de 4 dígitos informado pela loja.");
      return;
    }

    setValidatingPickupId(order.id);
    try {
      const success = await store.acaoPedido(order.id, 'validar_pin_retirada', pin);
      if (success !== true) return;
      const url = resolveClientMapsUrl(order);
      openGps(url, 'Abrir GPS até o cliente', 'Endereço do cliente não encontrado. Use o Chat & Voz da corrida para confirmar o local.');
    } finally {
      setValidatingPickupId(null);
    }
  };
  const [partnerManualOpen, setPartnerManualOpen] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [payingOrderId, setPayingOrderId] = useState<string | null>(null);
  const [chatModalData, setChatModalData] = useState<{ open: boolean; orderId: string; otherName?: string; otherPhone?: string; otherRole?: string; initialMode?: 'chat' | 'report' }>({ open: false, orderId: "" });
  const [shareLandingModalOpen, setShareLandingModalOpen] = useState(false);
  const [photoModalData, setPhotoModalData] = useState<{
    open: boolean;
    title: string;
    category?: 'acai' | 'adicional' | 'b2b' | 'store' | 'transport';
    currentUrl?: string;
    onSelect: (url?: string) => void;
  }>({ open: false, title: '', onSelect: () => {} });
  const [serverBalance, setServerBalance] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [myReferrals, setMyReferrals] = useState<any[]>([]);
  const lastAvailableCountRef = React.useRef(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    initAudioUnlock();
    const s = useAppStore.getState();
    if (typeof s.fetchCities === 'function') s.fetchCities();
    // startRealtime já carrega taxas, usuários e pedidos. Modo leve (R41): sem cardápio e fotos das lojas
    s.startRealtime({ lite: true });
    supabase.rpc('get_my_referrals', { p_flow: 'B2C' }).then(({ data }) => {
      if (Array.isArray(data)) setMyReferrals(data);
    });
  }, []);

  // Consulta do radar de entregas (R40: a cada 6 s e só com o app na tela; antes 3,5 s sempre).
  // Ao voltar para o app, a recarga é imediata (visibilitychange no store).
  useEffect(() => {
    if (!mounted || !currentUser?.id || currentUser.status === 'paused') return;
    store.fetchOrders(currentUser.id, false);

    const intervalId = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      const s = useAppStore.getState();
      if (s.currentUser?.id && s.currentUser.status !== 'paused') {
        s.fetchOrders(s.currentUser.id, false);
      }
    }, 6000);

    return () => clearInterval(intervalId);
  }, [mounted, currentUser?.id, currentUser?.status]);

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

  // Notificação sonora quando surgirem novas corridas prontas no Radar (Hook declarado antes de retornos condicionais)
  const availableRadarCount = (store.orders || []).filter((o: any) => {
    if (!o) return false;
    const st = String(o.status || '').toLowerCase().trim();
    // R35: pedido que o próprio entregador comprou não entra no radar dele
    return (st === 'pronto' || st === 'ready' || st === 'searching_operator') && (!o.motoristaId || o.motoristaId === null) && (o.type === 'B2C' || !o.type) && o.clienteId !== currentUser?.id;
  }).length;

  useEffect(() => {
    if (mounted && availableRadarCount > lastAvailableCountRef.current) {
      playDeliveryAlertTone();
    }
    if (mounted) {
      lastAvailableCountRef.current = availableRadarCount;
    }
  }, [mounted, availableRadarCount]);

  if (!mounted) {
    return <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 flex items-center justify-center p-6"><p>Carregando...</p></div>;
  }

  const roleStr = String(currentUser?.role || '').toLowerCase();
  const veicStr = String(currentUser?.veiculo || '').toLowerCase();
  const isMotoboyUser = Boolean(
    currentUser && (
      roleStr === 'motoboy' || 
      roleStr === 'courier' || 
      roleStr === 'motorista' || 
      roleStr === 'driver' ||
      (roleStr !== 'admin' && roleStr !== 'cliente' && (!veicStr || veicStr.includes('moto')))
    )
  );

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
  const referralsEnabled = isCityFeatureEnabled(currentUser?.cidade, store.cities, 'referrals_enabled');
  const ratingsEnabled = isCityFeatureEnabled(currentUser?.cidade, store.cities, 'ratings_enabled');
  const referredPartnerNames = new Set(myReferrals.filter((r: any) => r.status === 'ACTIVE').map((r: any) => String(r.partner_name || '').toLowerCase().trim()));
  const referredPartnerIds = new Set(myReferrals.filter((r: any) => r.status === 'ACTIVE').map((r: any) => String(r.partner_id || '')));
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
    return isNaN(fee) || fee < 0 ? 0 : Number(fee.toFixed(2));
  };

  const isDelivered = (st?: string) => {
    const norm = String(st || '').toLowerCase().trim();
    return ['entregue', 'received', 'delivered', 'completed', 'concluido', 'arquivado'].includes(norm);
  };

  const corridasDisponiveis = (store.orders || []).filter((o: any) => {
    if (!o) return false;
    const st = String(o.status || '').toLowerCase().trim();
    const isReady = (st === 'pronto' || st === 'ready' || st === 'searching_operator') && (!o.motoristaId || o.motoristaId === null) && (o.type === 'B2C' || !o.type);
    if (!isReady) return false;
    if (currentUser?.id && o.clienteId === currentUser.id) return false; // R35: compra do próprio entregador
    return true;
  });
  const minhasCorridasAll = (store.orders || []).filter((o: any) => o && currentUser?.id && o.motoristaId === currentUser.id);
  const ganhosHoje = serverBalance !== null ? serverBalance : minhasCorridasAll.filter((o: any) => o && isDelivered(o.status) && !o.payoutDriverDone).reduce((acc: number, curr: any) => acc + (curr ? getMotoboyFee(curr) : 0), 0);

  const motoActiveOrders = minhasCorridasAll.filter((o: any) => o && !isDelivered(o.status) && o.status !== 'cancelado' && o.status !== 'arquivado');
  const motoHistoryOrders = minhasCorridasAll.filter((o: any) => o && (isDelivered(o.status) || o.status === 'cancelado' || o.status === 'arquivado'));
  const minhasCorridas = [...motoActiveOrders, ...motoHistoryOrders];
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      if (currentUser?.id) {
        await Promise.all([
          store.fetchOrders(currentUser.id, true),
          store.fetchAllUsers(true),
          store.fetchRates(true)
        ]);
      } else {
        await Promise.all([
          store.fetchAllUsers(true),
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
    alert('Seu saque é analisado e pago na sua subconta Asaas.\n\nPara liberar, abra sua conta e envie os documentos no cartão "Minha conta Asaas", no topo desta página.');
  };



  return (
    <PartnerDashboardLayout
      role="motorista"
      title="Corridas (B2C)"
      roleIcon={<Bike className="text-amber-500" size={24} />}
      themeColor="amber"
      partnerId={currentUser?.id || ''}
      partnerName={`${currentUser?.name || 'Entregador Motoboy'} (${currentUser?.veiculo || 'Moto'})`}
      partnerPhoto={currentUser?.photo}
      onEditPhoto={() => setPhotoModalData({
        open: true,
        title: 'Foto do Entregador / Moto',
        category: 'transport',
        currentUrl: currentUser?.photo,
        onSelect: (url) => {
          if (currentUser?.id) store.updateStorePhoto(currentUser.id, url);
        }
      })}
      locationText={`Base: ${currentUser?.bairro || currentUser?.cidade || 'Belém'}`}
      pixKeyInfo={currentUser?.cpfCnpj || currentUser?.pixKey}
      statusLabel={isPaused ? 'Pausado (Fora de Serviço)' : 'Online (Recebendo Corridas)'}
      isOnline={!isPaused}
      onToggleStatus={handleToggleStatus}
      isRefreshing={isRefreshing}
      onRefresh={handleRefresh}
      virtualVaultValue={ganhosHoje}
      manualRole="motoboy"
      onOpenShare={() => setShareLandingModalOpen(true)}
      shareModal={<ShareLandingModal isOpen={shareLandingModalOpen} onClose={() => setShareLandingModalOpen(false)} />}
      navigationBar={
        <div className="bg-zinc-100/90 dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-1.5 shadow-sm flex items-center w-full">
          <div className="flex gap-1.5 overflow-x-auto py-0.5 no-scrollbar w-full">
            <button 
              onClick={() => setActiveTab('radar')} 
              className={`py-2 px-3 sm:px-4 font-bold text-xs sm:text-sm rounded-xl transition whitespace-nowrap flex items-center gap-1.5 cursor-pointer shrink-0 ${
                activeTab === 'radar' 
                  ? 'bg-amber-600 text-white shadow-md' 
                  : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 border border-zinc-200 dark:border-zinc-800'
              }`}
            >
              <span>🚨 Radar B2C</span>
              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${activeTab === 'radar' ? 'bg-amber-800 text-white' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'}`}>
                {corridasDisponiveis.length}
              </span>
            </button>

            <button 
              onClick={() => setActiveTab('ativos')} 
              className={`py-2 px-3 sm:px-4 font-bold text-xs sm:text-sm rounded-xl transition whitespace-nowrap flex items-center gap-1.5 cursor-pointer shrink-0 ${
                activeTab === 'ativos' 
                  ? 'bg-purple-600 text-white shadow-md' 
                  : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 border border-zinc-200 dark:border-zinc-800'
              }`}
            >
              <span>📦 Corridas Ativas</span>
              {motoActiveOrders.length > 0 && (
                <span className="bg-purple-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full animate-pulse">
                  {motoActiveOrders.length}
                </span>
              )}
            </button>

            <button 
              onClick={() => setActiveTab('historico')} 
              className={`py-2 px-3 sm:px-4 font-bold text-xs sm:text-sm rounded-xl transition whitespace-nowrap flex items-center gap-1.5 cursor-pointer shrink-0 ${
                activeTab === 'historico' 
                  ? 'bg-purple-600 text-white shadow-md' 
                  : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 border border-zinc-200 dark:border-zinc-800'
              }`}
            >
              <span>📋 Histórico</span>
              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${activeTab === 'historico' ? 'bg-purple-800 text-white' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'}`}>
                {motoHistoryOrders.length}
              </span>
            </button>

            <button 
              onClick={() => setActiveTab('carteira')} 
              className={`py-2 px-3 sm:px-4 font-bold text-xs sm:text-sm rounded-xl transition whitespace-nowrap flex items-center gap-1.5 cursor-pointer shrink-0 ${
                activeTab === 'carteira' 
                  ? 'bg-emerald-600 text-white shadow-md' 
                  : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 border border-zinc-200 dark:border-zinc-800'
              }`}
            >
              <span>💳 Carteira Digital</span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-black px-1.5 py-0.5 rounded border border-emerald-500/30">
                {formatMoney(ganhosHoje)}
              </span>
            </button>

            {referralsEnabled && (
              <button 
                onClick={() => setActiveTab('indicacoes')} 
                className={`py-2 px-3 sm:px-4 font-bold text-xs sm:text-sm rounded-xl transition whitespace-nowrap flex items-center gap-1.5 cursor-pointer shrink-0 ${
                  activeTab === 'indicacoes' 
                    ? 'bg-purple-600 text-white shadow-md' 
                    : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 border border-zinc-200 dark:border-zinc-800'
                }`}
              >
                <span>🤝 Indicações</span>
              </button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-6">

        {gpsPrompt && (
          <div className="fixed inset-x-0 bottom-24 md:bottom-6 z-[60] px-4 flex justify-center pointer-events-none">
            <div className="pointer-events-auto w-full max-w-md bg-zinc-900 text-white rounded-2xl shadow-2xl p-2.5 flex items-center gap-2 border border-purple-500/70">
              {gpsPrompt.url ? (
                <a
                  href={gpsPrompt.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setGpsPrompt(null)}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-3.5 px-3 rounded-xl font-extrabold text-base flex items-center justify-center gap-2"
                >
                  <Navigation className="w-5 h-5" />
                  <span>{gpsPrompt.label}</span>
                </a>
              ) : (
                <p className="flex-1 text-sm font-medium px-2 py-2">{gpsPrompt.label}</p>
              )}
              <button type="button" onClick={() => setGpsPrompt(null)} aria-label="Fechar" className="p-2 text-zinc-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* 1. ABA: RADAR B2C */}
        {activeTab === 'radar' && (
        <div className="grid grid-cols-1 gap-6 animate-in fade-in zoom-in-95 duration-300">
            <div>
                <h3 className="font-bold text-lg text-zinc-700 dark:text-zinc-200 border-b border-zinc-200 dark:border-zinc-800 pb-2 mb-4 flex items-center justify-between">
                  <span>🚨 Radar de Corridas Prontas</span>
                  <span className="text-xs text-zinc-400 font-normal">{corridasDisponiveis.length} chamada(s) disponível(is)</span>
                </h3>
                <div className="space-y-4">
                  {corridasDisponiveis.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-8 bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-dashed border-zinc-300 dark:border-zinc-700 text-center">
                        <span className="text-4xl mb-3 opacity-50">📡</span>
                        <p className="text-zinc-500 font-medium">Nenhum chamado no radar no momento.</p>
                        <p className="text-xs text-zinc-400 mt-1">Quando uma batedeira preparar um açaí B2C, ele aparecerá aqui instantaneamente.</p>
                    </div>
                  ) : corridasDisponiveis.map((o: any) => {
                    const origem = store.users?.[o.origemId];
                    const destino = store.users?.[o.destinoId];
                    const distKm = Number(o.distancia || 0);
                    return (
                      <div key={o.id} className="bg-white dark:bg-zinc-900 p-4 rounded-xl shadow-sm border border-blue-100 dark:border-blue-900/50">
                          <div className="flex justify-between items-center mb-2">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded">Nova Rota B2C</span>
                                {referralsEnabled && ((o.origemId && referredPartnerIds.has(String(o.origemId))) || (o.lojaId && referredPartnerIds.has(String(o.lojaId))) || (o.lojaNome && referredPartnerNames.has(String(o.lojaNome).toLowerCase().trim()))) && (
                                  <span className="text-[10px] font-black uppercase text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-950/60 border border-purple-300 dark:border-purple-800 px-2 py-0.5 rounded-full">🤝 Te indicou</span>
                                )}
                              </div>
                              <span className="text-base sm:text-lg font-black text-zinc-950 dark:text-white tracking-tight">Líquido: {formatMoney(getMotoboyFee(o))}</span>
                          </div>
                          <div className="bg-gray-50 dark:bg-zinc-950/50 p-3 rounded text-sm mb-4 flex flex-col gap-1 border border-zinc-100 dark:border-zinc-800">
                              <div className="flex items-center gap-2"><span className="text-zinc-400 text-xs">📍</span> <span className="text-zinc-700 dark:text-zinc-300 font-medium">{o.origem_bairro || origem?.bairro || '—'}</span></div>
                              <div className="flex items-center gap-2"><span className="text-zinc-400 text-xs">🏁</span> <span className="text-zinc-700 dark:text-zinc-300 font-medium">{o.delivery_bairro || destino?.bairro || '—'}</span></div>
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
                                    destino: { lat: latDestino, lng: lngDestino, name: `Destino (${o.delivery_bairro || 'Entrega'})` },
                                    motorista: { lat: driverLat, lng: driverLng, name: currentUser?.name || 'Sua Moto', veiculo: currentUser?.veiculo || 'Moto' }
                                  });
                                }} 
                                className="mt-2 text-blue-600 bg-blue-100/50 dark:bg-blue-900/20 p-2 rounded-lg font-bold hover:bg-blue-100 dark:hover:bg-blue-900/40 text-center w-full transition border border-blue-200 dark:border-blue-800 cursor-pointer"
                              >
                                🗺️ Ver Rota de {distKm.toFixed(1)} km
                              </button>
                          </div>
                          <button 
                              onClick={() => handleAcceptOrder(o)} 
                              disabled={acceptingOrderId === o.id}
                              className="w-full bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-800 hover:to-indigo-800 disabled:opacity-50 text-white text-base font-extrabold py-3.5 rounded-xl transition shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                            >
                              <Navigation className="w-5 h-5" />
                              <span>{acceptingOrderId === o.id ? 'Aceitando & Abrindo GPS...' : 'Aceitar Corrida & Abrir GPS'}</span>
                            </button>
                      </div>
                    )
                  })}
                </div>
            </div>
        </div>
        )}
            
        {/* 2. ABA: CORRIDAS ATIVAS / EM ANDAMENTO */}
        {activeTab === 'ativos' && (
        <div className="grid grid-cols-1 gap-6 animate-in fade-in zoom-in-95 duration-300">
            <div>
                <h3 className="font-bold text-lg text-zinc-700 dark:text-zinc-200 border-b border-zinc-200 dark:border-zinc-800 pb-2 mb-4 flex items-center justify-between">
                  <span>📦 Corridas em Andamento</span>
                  <span className="text-xs text-purple-400 font-bold">{motoActiveOrders.length} corrida(s) ativa(s)</span>
                </h3>
                <div className="space-y-4">
                  {motoActiveOrders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-8 bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-dashed border-zinc-300 dark:border-zinc-700 text-center">
                        <span className="text-4xl mb-3 opacity-50">🛵</span>
                        <p className="text-zinc-500 font-medium">Nenhuma corrida ativa no momento.</p>
                        <p className="text-xs text-zinc-400 mt-1">Acesse a aba <strong>Radar B2C</strong> para aceitar novas entregas.</p>
                    </div>
                  ) : motoActiveOrders.map((o: any) => {
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
                                  className="flex-1 text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/30 p-2.5 rounded-xl font-bold text-center transition border border-blue-200 dark:border-blue-800/80 flex items-center justify-center gap-1.5 text-xs shadow-sm cursor-pointer"
                              >
                                  🗺️ Ver Mapa ({Number(o.distancia || 0).toFixed(1)} km)
                              </button>
                              
                              {(() => {
                                 const storeUrl = buildMapsUrl(
                                   origemUser?.lat, origemUser?.lng,
                                   joinAddress(origemUser?.endereco, origemUser?.bairro, origemUser?.cidade) || (o.lojaNome ? joinAddress(o.lojaNome, origemUser?.cidade || 'Belém') : '')
                                 );
                                 const clientUrl = resolveClientMapsUrl(o);
                                 const btnBase = "flex-1 font-bold p-2.5 rounded-xl border text-xs transition flex items-center justify-center gap-1.5 shadow-sm text-center";
                                 return (
                                   <>
                                     {storeUrl && (
                                       <a href={storeUrl} target="_blank" rel="noopener noreferrer"
                                         className={`${btnBase} bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700`}>
                                         <Navigation className="w-3.5 h-3.5" /> GPS p/ Retirada
                                       </a>
                                     )}
                                     {clientUrl && (
                                       <a href={clientUrl} target="_blank" rel="noopener noreferrer"
                                         className={`${btnBase} bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/40`}>
                                         <MapPin className="w-3.5 h-3.5" /> GPS p/ Cliente
                                       </a>
                                     )}
                                   </>
                                 );
                               })()}
                            </div>
                            <div className="flex gap-2 mt-2">
                              <button
                                type="button"
                                onClick={() => {
                                  const clienteId = o.clienteId || (o as any).buyerId || o.destinoId;
                                  const clienteUser = clienteId && store.users ? store.users[clienteId] : null;
                                  setChatModalData({
                                    open: true,
                                    orderId: o.id,
                                    otherName: clienteUser?.name || o.clienteNome || 'Cliente',
                                    otherPhone: (clienteUser as any)?.phone || clienteUser?.telefone || o.clienteTelefone || '',
                                    otherRole: 'Cliente',
                                    initialMode: 'chat'
                                  });
                                }}
                                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold p-2.5 rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
                              >
                                💬 Chat & 📞 Voz
                              </button>
                            </div>
                        </div>
                        <OrderTimelineBadges order={o} className="flex flex-wrap gap-2 mb-3" />
                        
                        {o.status === 'em_rota' ? (
                            <div className="flex flex-col gap-2 w-full">
                                {!o.pickedUpAt ? (
                                  <div className="bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 p-4 rounded-xl flex flex-col gap-2.5 shadow-inner">
                                    <div className="flex items-center justify-between">
                                      <p className="text-xs font-bold flex items-center gap-1">
                                        <span>🔑</span> PIN de Retirada (Balcão)
                                      </p>
                                      <span className="text-[10px] bg-amber-200/60 dark:bg-amber-800 text-amber-900 dark:text-amber-100 font-extrabold px-2 py-0.5 rounded">Etapa 1 de 2</span>
                                    </div>
                                    <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
                                      Peça o PIN impresso na comanda térmica ou exibido na tela da loja para retirar o pedido.
                                    </p>
                                    <div className="flex gap-2 mt-1">
                                      <input 
                                        type="text" 
                                        maxLength={4} 
                                        placeholder="0000" 
                                        value={pinInputs[`pickup_${o.id}`] || ''} 
                                        onChange={e => setPinInputs(prev => ({ ...prev, [`pickup_${o.id}`]: e.target.value }))}
                                        onKeyDown={e => {
                                          if (e.key === 'Enter') handleValidatePickupPin(o);
                                        }}
                                        className="w-24 text-center font-black tracking-widest text-xl p-2.5 rounded-xl border border-amber-300 dark:border-amber-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500"
                                      />
                                      <button 
                                        onClick={() => handleValidatePickupPin(o)} 
                                        disabled={validatingPickupId === o.id}
                                        className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold py-2.5 px-3 rounded-xl transition shadow-md flex items-center justify-center gap-1.5 text-xs sm:text-sm cursor-pointer active:scale-95"
                                      >
                                        <Navigation className="w-4 h-4" />
                                        <span>{validatingPickupId === o.id ? 'Validando & Abrindo GPS...' : 'Validar e Abrir GPS do Cliente'}</span>
                                      </button>
                                    </div>
                                    <div className="flex justify-end pt-1">
                                      <button onClick={() => { if(confirm('Deseja realmente cancelar esta corrida?')) store.acaoPedido(o.id, 'cancelar_pedido'); }} className="text-[11px] text-red-600 hover:underline">
                                        ❌ Cancelar corrida
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex gap-2 w-full">
                                    <button onClick={() => { if(confirm('Deseja realmente cancelar esta corrida?')) store.acaoPedido(o.id, 'cancelar_pedido'); }} className="bg-red-100 hover:bg-red-200 text-red-700 text-xs font-bold px-3 py-3 rounded-lg transition">❌ Cancelar</button>
                                    <button onClick={() => store.acaoPedido(o.id, 'conf_motorista')} className="flex-1 bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold py-3 rounded-lg shadow transition flex items-center justify-center gap-1.5 cursor-pointer">
                                      🏁 Cheguei ao Endereço do Cliente
                                    </button>
                                  </div>
                                )}
                            </div>
                        ) : o.status === 'aguardando_cliente' ? (
                            <div className="bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-800 p-4 rounded-xl flex flex-col gap-2.5 shadow-inner">
                                <div className="flex items-center justify-between">
                                  <p className="text-xs font-bold flex items-center gap-1">
                                    <span>🔑</span> PIN de Entrega (Cliente)
                                  </p>
                                  <span className="text-[10px] bg-orange-200/60 dark:bg-orange-800 text-orange-900 dark:text-orange-100 font-extrabold px-2 py-0.5 rounded">Etapa 2 de 2</span>
                                </div>
                                <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
                                  Peça o PIN de 4 dígitos que está na tela do cliente para confirmar a entrega.
                                </p>
                                <div className="flex gap-2 mt-1">
                                    <input 
                                        type="text" 
                                        maxLength={4} 
                                        placeholder="0000" 
                                        value={pinInputs[o.id] || ''} 
                                        onChange={e => setPinInputs(prev => ({...prev, [o.id]: e.target.value}))}
                                        className="w-24 text-center font-black tracking-widest text-xl p-2.5 rounded-xl border border-orange-300 dark:border-orange-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-orange-500"
                                    />
                                    <button 
                                        onClick={() => store.acaoPedido(o.id, 'validar_pin', pinInputs[o.id])} 
                                        className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-bold py-2.5 px-3 rounded-xl transition shadow-md flex items-center justify-center gap-1.5 text-xs sm:text-sm cursor-pointer"
                                    >
                                        Validar e Finalizar
                                    </button>
                                </div>
                            </div>
                        ) : null}
                    </div>
                  )})}
                </div>
            </div>
        </div>
        )}

        {/* 3. ABA: HISTÓRICO DE CORRIDAS (CONCLUÍDAS / CANCELADAS) */}
        {activeTab === 'historico' && (
        <div className="grid grid-cols-1 gap-6 animate-in fade-in zoom-in-95 duration-300">
            <div>
                <h3 className="font-bold text-lg text-zinc-700 dark:text-zinc-200 border-b border-zinc-200 dark:border-zinc-800 pb-2 mb-4 flex items-center justify-between">
                  <span>📋 Histórico de Corridas Finalizadas</span>
                  <span className="text-xs text-zinc-400 font-normal">{motoHistoryOrders.length} corrida(s) no histórico</span>
                </h3>
                <div className="space-y-4">
                  {motoHistoryOrders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-8 bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-dashed border-zinc-300 dark:border-zinc-700 text-center">
                        <span className="text-4xl mb-3 opacity-50">📋</span>
                        <p className="text-zinc-500 font-medium">Nenhum histórico registrado ainda.</p>
                        <p className="text-xs text-zinc-400 mt-1">As corridas entregues ou canceladas ficarão arquivadas aqui.</p>
                    </div>
                  ) : motoHistoryOrders.map((o: any) => {
                    const isCanceled = o.status === 'cancelado';
                    const lojaUser = store.users?.[o.lojaId!] || store.users?.[o.origemId];
                    const clienteId = o.clienteId || (o.type === 'B2C' ? o.criadoPor : undefined) || o.destinoId;
                    const clienteUser = store.users?.[clienteId] || store.users?.[o.destinoId];
                    return (
                    <div key={o.id} className={`bg-white dark:bg-zinc-900 p-4 rounded-xl shadow-sm border ${isCanceled ? 'border-red-300 opacity-60 border-l-4 border-l-red-400' : 'border-zinc-200 dark:border-zinc-800'}`}>
                        <div className="flex justify-between items-center mb-2">
                            <span className="font-extrabold text-zinc-900 dark:text-white text-sm sm:text-base">{o.title}</span>
                            <span className="text-base sm:text-lg font-black text-zinc-950 dark:text-white tracking-tight">Líquido: {formatMoney(getMotoboyFee(o))}</span>
                        </div>
                        
                        <div className="bg-gray-50 dark:bg-zinc-950/50 p-3 rounded-lg text-xs mb-3 flex flex-col gap-1.5 border border-zinc-100 dark:border-zinc-800">
                            <div className="flex items-center gap-2">
                                <span className="text-sm">📍</span> 
                                <div>
                                    <span className="text-[10px] font-bold uppercase text-zinc-400 block">Loja de Origem</span>
                                    <span className="text-zinc-800 dark:text-zinc-200 font-bold">{o.lojaNome || lojaUser?.name || '—'}</span> 
                                    <span className="text-zinc-500 text-[11px]"> ({lojaUser?.bairro || '—'})</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 pt-1 border-t border-zinc-200 dark:border-zinc-800">
                                <span className="text-sm">🏁</span> 
                                <div>
                                    <span className="text-[10px] font-bold uppercase text-zinc-400 block">Cliente de Destino</span>
                                    <span className="text-zinc-800 dark:text-zinc-200 font-bold">{o.clienteNome || clienteUser?.name || '—'}</span> 
                                    <span className="text-purple-600 dark:text-purple-400 font-bold text-[11px]"> ({o.deliveryAddress || clienteUser?.bairro || '—'})</span>
                                </div>
                            </div>
                        </div>
                        <OrderTimelineBadges order={o} className="flex flex-wrap gap-2 mb-3" />
                        
                        {o.status === 'entregue' || o.status === 'arquivado' ? (
                            <div className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800 text-xs p-3 rounded-xl flex flex-col gap-2 items-center font-bold">
                                <p>✅ Entrega Concluída com Sucesso</p>
                                {o.payoutDriverDone ? (
                                  <span className="text-[10px] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-bold px-2 py-1 rounded border border-emerald-200 dark:border-emerald-800/60 shadow-sm flex items-center gap-1">
                                    ✅ Repasse Liquidado via Pix (R$ {Number(getMotoboyFee(o) || 0).toFixed(2)})
                                  </span>
                                ) : (
                                  <span className="text-[10px] bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 font-bold px-2 py-1 rounded border border-amber-200 dark:border-amber-800/60 shadow-sm flex items-center gap-1">
                                    ⏳ Saldo Disponível p/ Saque Asaas (R$ {Number(getMotoboyFee(o) || 0).toFixed(2)})
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    const clienteId = o.clienteId || (o.type === 'B2C' ? o.criadoPor : undefined) || o.destinoId;
                                    const clienteUser = store.users?.[clienteId] || store.users?.[o.destinoId];
                                    setChatModalData({
                                      open: true,
                                      orderId: o.id,
                                      otherName: clienteUser?.name || o.clienteNome || 'Cliente',
                                      otherPhone: (clienteUser as any)?.phone || clienteUser?.telefone || o.clienteTelefone || '',
                                      otherRole: 'Cliente',
                                      initialMode: 'report'
                                    });
                                  }}
                                  className="w-full text-xs bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 rounded-lg transition shadow-xs flex items-center justify-center gap-1 cursor-pointer"
                                >
                                  ⚠️ Reportar Problema
                                </button>
                                {ratingsEnabled && currentUser?.id && (
                                  <OrderRatingCard
                                    order={o}
                                    viewerId={currentUser.id}
                                    viewerRole="motorista"
                                    ratingsEnabled={ratingsEnabled}
                                  />
                                )}
                            </div>
                        ) : isCanceled ? (
                            <div className="flex flex-col gap-2">
                               <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 text-xs p-2 rounded text-center font-bold">Cancelado</div>
                               <button
                                 type="button"
                                 onClick={() => {
                                   const clienteId = o.clienteId || (o.type === 'B2C' ? o.criadoPor : undefined) || o.destinoId;
                                   const clienteUser = store.users?.[clienteId] || store.users?.[o.destinoId];
                                   setChatModalData({
                                     open: true,
                                     orderId: o.id,
                                     otherName: clienteUser?.name || o.clienteNome || 'Cliente',
                                     otherPhone: (clienteUser as any)?.phone || clienteUser?.telefone || o.clienteTelefone || '',
                                     otherRole: 'Cliente',
                                     initialMode: 'report'
                                   });
                                 }}
                                 className="w-full text-xs bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 rounded-lg transition shadow-xs flex items-center justify-center gap-1 cursor-pointer"
                               >
                                 ⚠️ Reportar Problema
                               </button>
                               <button onClick={() => { if(confirm('Deseja excluir esta corrida do seu histórico?')) store.acaoPedido(o.id, 'deletar_pedido') }} className="w-full text-xs bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold py-2 rounded-lg transition cursor-pointer">🗑️ Excluir do Histórico</button>
                            </div>
                        ) : null}
                    </div>
                  )})}
                </div>
                {ratingsEnabled && currentUser?.id && (
                  <div className="mt-6">
                    <MyReceivedRatingsSection userId={currentUser.id} ratingsEnabled={ratingsEnabled} />
                  </div>
                )}
            </div>
        </div>
        )}

        {/* 4. ABA: CARTEIRA DIGITAL & SAQUES PIX ASAAS */}
        {activeTab === 'carteira' && (
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
            <PartnerWithdrawalSection partnerId={currentUser?.id || ''} role="motorista" onBalanceLoaded={setServerBalance} />
          </div>
        )}

        {/* 5. ABA: INDICAÇÕES (R39) */}
        {referralsEnabled && activeTab === 'indicacoes' && (
          <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
            <DriverReferralsSection
              flow="B2C"
              partnerLabel="loja"
              ratingsEnabled={ratingsEnabled}
              minCountDisplay={rates?.rating_min_count_display ?? 5}
              onReferralsChanged={setMyReferrals}
            />
          </div>
        )}
      </div>

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
          currentUserId={currentUser?.id || ''}
          currentUserName={currentUser?.name || ''}
          currentUserRole="motoboy"
          otherParticipantName={chatModalData.otherName}
          otherParticipantPhone={chatModalData.otherPhone}
          otherParticipantRole={chatModalData.otherRole}
          initialMode={chatModalData.initialMode || 'chat'}
        />
      )}

      {/* BOTÃO FLUTUANTE DE ATENDIMENTO / SUPORTE GERAL */}
      <SupportChatButton currentUser={currentUser} />

      {/* Modal de Escolha de Foto do Entregador/Veículo */}
      <PhotoPickerModal
        isOpen={photoModalData.open}
        onClose={() => setPhotoModalData(prev => ({ ...prev, open: false }))}
        title={photoModalData.title}
        category={photoModalData.category}
        currentImageUrl={photoModalData.currentUrl}
        onSelectPhoto={(url) => {
          photoModalData.onSelect(url);
          setPhotoModalData(prev => ({ ...prev, open: false }));
        }}
      />
      
      <div className="mt-12 mb-6 flex flex-col items-center justify-center">
        <AppSolutionsBrandCard />
      </div>
      <AsaasPartnerBadge variant="footer" className="mt-4 mb-4" />
    </PartnerDashboardLayout>
  );
}
