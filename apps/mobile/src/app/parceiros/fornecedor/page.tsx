"use client";

import React, { useState, useEffect, useRef, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { PackageOpen, Printer, BookOpen, Share2 } from "lucide-react";
import { useAppStore, getRatesForCity, generateUUID, getDailyWithdrawalCount, incrementDailyWithdrawalCount } from "@/store/useAppStore";
import { OrderTimelineBadges } from "@/components/OrderTimelineBadges";
import { MapModal, MapPoint } from "@/components/MapModal";
import { supabase } from "@/lib/supabase";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PartnerManualModal } from "@/components/PartnerManualModal";
import { OrderChatModal } from "@/components/OrderChatModal";
import { PhotoPickerModal } from "@/components/PhotoPickerModal";
import { PartnerShareModal, StoreShareCard } from "@/components/PartnerShareModal";
import { PartnerWithdrawalSection } from "@/components/PartnerWithdrawalSection";
import { PartnerDashboardLayout } from "@/components/PartnerDashboardLayout";
import { SupportChatButton } from "@/components/SupportChatButton";
import {
  getPrinterConfig,
  savePrinterConfig,
  printOrderTicket,
  printTestTicket,
  DEFAULT_PRINTER_CONFIG,
  PrinterConfig,
} from "@/lib/thermalPrinter";
import PartnerActivationGuard from "@/components/PartnerActivationGuard";
import { AsaasPartnerBadge } from "@/components/AsaasPartnerBadge";

const emptySubscribe = () => () => {};

export default function FornecedorDashboard() {
  const router = useRouter();
  const store = useAppStore();
  const currentUser = store.currentUser;
  
  const [mapModal, setMapModal] = useState<{
    open: boolean;
    origem: MapPoint | null;
    destino: MapPoint | null;
    motorista?: MapPoint | null;
  }>({ open: false, origem: null, destino: null, motorista: null });
  const [printerModalOpen, setPrinterModalOpen] = useState(false);
  const [chatModalData, setChatModalData] = useState<{ open: boolean; orderId: string; otherName?: string; otherPhone?: string; otherRole?: string }>({ open: false, orderId: "" });
  const [shareLandingModalOpen, setShareLandingModalOpen] = useState(false);
  const printedOrdersRef = useRef<Set<string>>(new Set());

  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  const [printerConfig, setPrinterConfig] = useState<PrinterConfig>(getPrinterConfig);

  useEffect(() => {
    const s = useAppStore.getState();
    s.fetchAllUsers(true);
    s.fetchLojas(true);
    if (typeof s.fetchCities === 'function') s.fetchCities();
    if (typeof s.fetchRates === 'function') s.fetchRates();
    s.startRealtime();

    const interval = setInterval(() => {
      s.fetchAllUsers(true);
      s.fetchLojas(true);
    }, 4000);

    const handleFocus = () => {
      s.fetchAllUsers(true);
      s.fetchLojas(true);
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  useEffect(() => {
    if (!mounted || !printerConfig.enabled || printerConfig.printMode !== 'auto' || !currentUser) return;

    const autoOrders = (store.orders || []).filter((o: any) =>
      o.fornecedorId === currentUser.id &&
      o.type === 'B2B' &&
      o.status === 'preparo' &&
      !printedOrdersRef.current.has(o.id)
    );

    for (const order of autoOrders) {
      printedOrdersRef.current.add(order.id);
      const allUsersWithCurrent = currentUser ? { ...store.users, [currentUser.id]: currentUser } : store.users;
      printOrderTicket(order, currentUser.name, printerConfig, allUsersWithCurrent);
    }
  }, [store.orders, currentUser, printerConfig, mounted, store.users]);

  const [subsidyInput, setSubsidyInput] = useState(() => currentUser?.freteSubsidyPct?.toString() || "0");
  const [priceModalOpen, setPriceModalOpen] = useState(false);
  const [b2bPrice, setB2bPrice] = useState(() => currentUser?.priceB2B ?? 140);
  
  useEffect(() => {
    if (currentUser?.priceB2B !== undefined) {
      setB2bPrice(currentUser.priceB2B);
    }
  }, [currentUser?.priceB2B]);
  const [activeTab, setActiveTab] = useState('geral');

  const [newProductName, setNewProductName] = useState('');
  const [newProductPrice, setNewProductPrice] = useState('');
  const [newProductDesc, setNewProductDesc] = useState('');
  const [newProductImage, setNewProductImage] = useState<string | undefined>(undefined);
  const [photoModalData, setPhotoModalData] = useState<{
    open: boolean;
    title: string;
    category?: 'acai' | 'adicional' | 'b2b';
    currentUrl?: string;
    onSelect: (url?: string) => void;
  }>({ open: false, title: '', onSelect: () => {} });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [payingOrderId, setPayingOrderId] = useState<string | null>(null);
  const [partnerManualOpen, setPartnerManualOpen] = useState(false);
  const [myStorefrontId, setMyStorefrontId] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser?.id) {
      supabase.from('storefronts').select('id').eq('partner_id', currentUser.id).maybeSingle().then(({ data }) => {
        if (data?.id) setMyStorefrontId(data.id);
      });
    }
  }, [currentUser?.id]);

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
      console.warn("Erro ao atualizar dados do fornecedor:", e);
    } finally {
      setIsRefreshing(false);
    }
  };

  const isPaused = currentUser?.status === 'paused';
  const handleToggleStatus = () => {
    if (!currentUser) return;
    store.updateUserStatus(currentUser.id, isPaused ? 'active' : 'paused');
  };

  const handleSavePrices = () => {
    if (!currentUser) return;
    store.updateUserPrice(currentUser.id, undefined, b2bPrice);
    setPriceModalOpen(false);
    alert('Preço da Lata Açaí atualizado com sucesso!');
  };

  const handleAddProduct = () => {
      if (!currentUser || !newProductName || !newProductPrice) return;
      store.addProduct(currentUser.id, {
          id: generateUUID(),
          name: newProductName.trim(),
          price: Number(newProductPrice),
          description: newProductDesc.trim() || undefined,
          imageUrl: newProductImage,
          isAvailable: true
      });
      setNewProductName('');
      setNewProductPrice('');
      setNewProductDesc('');
      setNewProductImage(undefined);
  };

  const handleEditProduct = (p: any) => {
    if (!currentUser) return;
    const newName = prompt("Editar nome do produto extra B2B:", p.name);
    if (newName === null) return;
    const newPriceStr = prompt("Editar preço do produto extra (R$):", p.price.toString());
    if (newPriceStr === null) return;
    const newPrice = parseFloat(newPriceStr.replace(',', '.'));
    if (isNaN(newPrice) || newPrice < 0) {
      alert("Preço inválido.");
      return;
    }
    const newDesc = prompt("Editar descrição / detalhes do produto:", p.description || p.desc || '');
    if (newDesc === null) return;
    const cleanName = newName.trim() || p.name;
    store.updateProduct(currentUser.id, p.id, { name: cleanName, price: newPrice, description: newDesc.trim() || undefined });
  };

  const linkAsaasAccount = store.linkAsaasAccount;

  const handleLinkAsaas = async () => {
    if (!currentUser) return;
    const cpfKey = currentUser.cpfCnpj || currentUser.pixKey;
    alert(`🔒 Chave PIX Oficial de Repasses:\n\nSua Chave Pix oficial cadastrada é o seu CPF/CNPJ (${cpfKey || 'Cadastrado'}).\n\nPor conformidade bancária e segurança contra fraudes, os repasses são creditados exclusivamente na conta bancária de mesma titularidade.`);
  };

  const handleResgatarPix = async () => {
    if (!currentUser) return;
    const targetKey = String(currentUser.cpfCnpj || currentUser.pixKey || '').replace(/\D/g, '');

    if (!targetKey) {
      alert("Chave Pix (CPF/CNPJ) não localizada no seu cadastro. Entre em contato com o suporte.");
      return;
    }

    const valorSaque = (vendasHoje && vendasHoje > 0) ? vendasHoje : 0;
    if (!valorSaque || valorSaque <= 0) {
      alert("Não há saldo disponível para saque no momento.");
      return;
    }

    const saquesHoje = getDailyWithdrawalCount(currentUser.id);
    if (saquesHoje >= 2) {
      alert("⚠️ Limite diário atingido:\n\nVocê já realizou 2 saques hoje (limite máximo permitido). Novos valores acumulados serão liquidados automaticamente no encerramento diário pelo administrador ou estarão disponíveis para novo saque amanhã.");
      return;
    }

    if (isWithdrawing) return;

    if (confirm(`Deseja transferir R$ ${valorSaque.toFixed(2)} instantaneamente via PIX para o seu CPF/CNPJ (${targetKey}) cadastrado?\n(Saque ${saquesHoje + 1} de no máximo 2 saques hoje)`)) {
      setIsWithdrawing(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const authHeaders: any = { 
          'Content-Type': 'application/json'
        };
        if (session?.access_token) {
          authHeaders['Authorization'] = `Bearer ${session.access_token}`;
        }

        const pendingOrders = meusPedidos.filter((o: any) => (o.status === 'entregue' || o.status === 'arquivado') && o.type === 'B2B' && !o.payoutSellerDone);
        const pendingOrderIds = pendingOrders.map((o: any) => o.id);

        const res = await fetch('/api/asaas/withdrawals', {
          method: 'POST',
          headers: authHeaders
        });
        const data = await res.json();
        if (res.ok && data.success) {
          incrementDailyWithdrawalCount(currentUser.id);
          alert(`✅ Solicitação de Saque no valor de R$ ${valorSaque.toFixed(2)} enviada com sucesso!\nO valor será repassado via Pix Asaas para sua chave/subconta.`);
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

  const [isUpdatingGPS, setIsUpdatingGPS] = useState(false);

  const handleUpdateGPS = async () => {
    if (isUpdatingGPS) return;
    if (!currentUser) return;
    if (!confirm("Deseja atualizar a localização GPS do seu estabelecimento para a sua posição atual do celular agora?\n\n(Recomendado fazer isso quando você estiver fisicamente na loja)")) return;
    
    setIsUpdatingGPS(true);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000, enableHighAccuracy: true });
      });
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;

      await store.updateUserLocation(currentUser.id, lat, lng);
      alert("✅ GPS do estabelecimento atualizado com sucesso para as novas coordenadas!");
      const s = useAppStore.getState();
      s.fetchAllUsers(true);
    } catch (err) {
      alert("Não foi possível capturar sua geolocalização. Certifique-se de que o GPS do aparelho está ativado e as permissões foram concedidas.");
    } finally {
      setIsUpdatingGPS(false);
    }
  };

  if (!mounted) {
    return <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 flex items-center justify-center p-6"><p>Carregando...</p></div>;
  }

  const roleLowerForn = String(currentUser?.role || '').toLowerCase();
  const isFornecedor = currentUser && (roleLowerForn === 'fornecedor' || roleLowerForn === 'supplier' || roleLowerForn === 'partner');

  if (!isFornecedor) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 flex flex-col items-center justify-center p-6 text-center">
        <PackageOpen size={48} className="text-emerald-600 mb-4" />
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">Acesso Restrito</h2>
        <p className="text-zinc-500 mb-6">Você precisa estar logado como Fornecedor para acessar este painel.</p>
        <button onClick={() => router.push('/login')} className="bg-emerald-600 text-white font-bold py-3 px-6 rounded-xl hover:bg-emerald-700 transition">
          Fazer Login
        </button>
      </div>
    );
  }

  const rates = getRatesForCity(currentUser?.cidade, store.rates, store.cities) || store.rates;
  const formatMoney = (val: number) => (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const getSupplierRepasse = (o: any) => {
    if (o.taxas?.repasse && o.taxas.repasse > 0) return o.taxas.repasse;
    const val = o.valor || o.totalValue || 0;
    const cityRates = rates;
    const platPct = (cityRates.b2b_plat ?? 5) / 100;
    const subFrete = o.taxas?.entregaFornecedor || 0;
    return Math.max(0, val * (1 - platPct) - subFrete);
  };

  const isCompleted = (st?: string) => {
    const norm = String(st || '').toLowerCase().trim();
    return ['entregue', 'received', 'delivered', 'completed', 'concluido', 'concluído', 'arquivado'].includes(norm);
  };
  const isPaidOrProcessing = (st?: string) => st === 'pendente' || st === 'preparo' || st === 'pronto' || st === 'em_rota' || st === 'aguardando_cliente' || st === 'PAID' || st === 'PREPARING' || st === 'READY' || st === 'IN_TRANSIT';

  const myFornSfIds = [
    myStorefrontId,
    (store.users[currentUser.id] as any)?.storefrontId,
    ...(((store.users[currentUser.id] as any)?.storefronts || []).map((s: any) => s.id))
  ].filter(Boolean) as string[];

  const isMyOrder = (o: any) => {
    if (!currentUser) return false;
    const targetSfId = (o as any).seller_storefront_id || (o as any).sellerStorefrontId;
    const isSupplier = o.fornecedorId === currentUser.id || 
                       (o as any).fornecedor_id === currentUser.id || 
                       o.origemId === currentUser.id || 
                       targetSfId === currentUser.id ||
                       (myFornSfIds.length > 0 && myFornSfIds.includes(targetSfId)) ||
                       (myFornSfIds.length > 0 && (myFornSfIds.includes(o.fornecedorId) || myFornSfIds.includes(o.origemId))) ||
                       (o.type === 'B2B' && o.lojaNome && currentUser.name && o.lojaNome.toLowerCase().trim() === currentUser.name.toLowerCase().trim());
    return isSupplier;
  };

  const meusPedidosAll = (store.orders || []).filter((o: any) => isMyOrder(o));
  const vendasHoje = meusPedidosAll.filter((o: any) => isCompleted(o.status) && !o.payoutSellerDone).reduce((acc: number, curr: any) => acc + getSupplierRepasse(curr), 0);
  const emProcessamento = meusPedidosAll.filter((o: any) => isPaidOrProcessing(o.status)).reduce((acc: number, curr: any) => acc + getSupplierRepasse(curr), 0);
  const saquesHoje = currentUser ? getDailyWithdrawalCount(currentUser.id) : 0;

  const fornActiveOrders = meusPedidosAll.filter((o: any) => 
    o.status !== 'aguardando_pagamento' && 
    !isCompleted(o.status) && 
    o.status !== 'cancelado' && 
    o.status !== 'arquivado'
  );
  const fornHistoryOrders = meusPedidosAll.filter((o: any) => isCompleted(o.status) || o.status === 'cancelado' || o.status === 'arquivado');
  const meusPedidos = [...fornActiveOrders, ...fornHistoryOrders];

  const handleSaveSubsidy = () => {
    store.setFreteSubsidy(currentUser.id, parseFloat(subsidyInput) || 0);
    alert('Subsídio salvo com sucesso!');
  };


  const renderFornecedorOrderCard = (o: any) => {
    const isCanceled = o.status === 'cancelado';
    return (
    <div key={o.id} className={`bg-white dark:bg-zinc-900 p-4 sm:p-5 rounded-xl shadow-sm border border-l-4 ${isCanceled ? 'border-red-300 opacity-60 border-l-red-400' : 'border-l-emerald-500'} border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4`}>
        <div className="w-full sm:w-auto">
            <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-700">{o.type}</span>
                <span className="font-bold text-zinc-800 dark:text-white text-sm">{o.title}</span>
                {o.createdAt && (
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                     📅 {new Date(o.createdAt).toLocaleDateString('pt-BR')} às {new Date(o.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </span>
                )}
                <button 
                  onClick={() => {
                    const origemUser = store.users[o.origemId];
                    const destinoUser = store.users[o.destinoId];
                    const latOrigem = origemUser?.lat || 0;
                    const lngOrigem = origemUser?.lng || 0;
                    const latDestino = o.deliveryLat || destinoUser?.lat || (latOrigem ? latOrigem + 0.0045 : -1.455);
                    const lngDestino = o.deliveryLng || destinoUser?.lng || (lngOrigem ? lngOrigem + 0.0045 : -48.490);
                    const motoristaUser = o.motoristaId ? store.users[o.motoristaId] : null;
                    setMapModal({
                      open: true,
                      origem: { lat: latOrigem, lng: lngOrigem, name: o.lojaNome || origemUser?.name || 'Retirada' },
                      destino: { lat: latDestino, lng: lngDestino, name: o.clienteNome || destinoUser?.name || 'Entrega' },
                      motorista: motoristaUser?.lat ? { lat: motoristaUser.lat, lng: motoristaUser.lng || 0, name: motoristaUser.name || 'Entregador', veiculo: motoristaUser.veiculo || 'moto' } : null
                    });
                  }} 
                  className="text-[10px] text-blue-500 hover:underline"
                >
                  🗺️ Ver Rota de {(o.distancia || 0).toFixed(1)} km
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const compradorUser = (o as any).buyerId ? store.users[(o as any).buyerId] : (o.destinoId ? store.users[o.destinoId] : null);
                    const caminhoneiroUser = o.motoristaId ? store.users[o.motoristaId] : null;
                    const targetOther = caminhoneiroUser || compradorUser;
                    setChatModalData({
                      open: true,
                      orderId: o.id,
                      otherName: targetOther?.name || o.clienteNome || 'Loja Batedeira',
                      otherPhone: (targetOther as any)?.phone || targetOther?.telefone || o.clienteTelefone || '',
                      otherRole: caminhoneiroUser ? 'Transporte' : 'Loja Compradora'
                    });
                  }}
                  className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/40 hover:bg-emerald-200 px-2 py-1 rounded inline-flex items-center gap-1 transition shadow-sm ml-2"
                >
                  💬 Chat & 📞 Voz
                </button>
            </div>
            <div className="text-xs text-zinc-700 dark:text-zinc-300 mb-1 font-bold flex flex-wrap items-center gap-3">
                <span>🏪 Loja Compradora: {store.users[o.destinoId]?.name || store.users[o.lojaId!]?.name || o.clienteNome || '—'}</span>
                <span className="text-zinc-400">|</span>
                <span>
                  🚛 Caminhão: {(() => {
                    const mUser = o.motoristaId ? store.users[o.motoristaId] : null;
                    const dName = o.motoristaNome || mUser?.name;
                    const isFinished = o.status === 'entregue' || o.status === 'cancelado' || o.status === 'arquivado' || !!o.receivedAt || !!o.deliveredAt;
                    return dName || (isFinished ? 'Concluído' : 'Aguardando');
                  })()}
                </span>
            </div>
            <p className="text-xs text-zinc-500 mt-1">
                Bruto: {formatMoney(o.valor)} |
                Sub. Frete: {formatMoney(o.taxas.entregaFornecedor || 0)} |
                Líquido: {formatMoney(o.taxas.repasse)}
            </p>
            <OrderTimelineBadges order={o} className="flex flex-wrap gap-2 mt-2" />
            {(o.pickupPin || (o as any).pickup_pin) && !isCanceled && o.status !== 'entregue' && o.status !== 'arquivado' && (
              <div className="mt-2.5 bg-amber-500 text-white p-2.5 rounded-xl flex items-center justify-between shadow-sm border border-amber-400">
                <div>
                  <p className="text-[10px] font-bold uppercase text-amber-100 flex items-center gap-1">
                    <span>🔑</span> PIN de Retirada (Despacho B2B)
                  </p>
                  <p className="text-[10px] text-amber-50 leading-tight">Informe ao caminhoneiro no carregamento</p>
                </div>
                <div className="text-xl font-black tracking-widest text-zinc-900 bg-white px-3 py-1 rounded-lg border border-amber-200 shadow-sm">
                  {o.pickupPin || (o as any).pickup_pin}
                </div>
              </div>
            )}
        </div>
        
        <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-end w-full sm:w-auto border-t sm:border-t-0 border-zinc-100 dark:border-zinc-800 pt-3 sm:pt-0 gap-2">
            {/* Status Badges */}
            {o.status === 'aguardando_pagamento' && (
              <div className="flex flex-col items-end gap-1.5 w-full sm:w-auto">
                <span className="bg-amber-100 text-amber-800 px-2 py-1 rounded text-[10px] font-bold uppercase animate-pulse">⏳ Aguardando Pagamento Pix</span>
                <div className="flex flex-wrap gap-1.5 justify-end w-full">
                  <button 
                    type="button"
                    onClick={async (e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      try {
                        const res = await fetch(`/api/asaas/status?orderId=${o.id}`);
                        if (res.ok) {
                          const data = await res.json();
                          if (data.isPaid) {
                            store.acaoPedido(o.id, 'confirmar_pagamento');
                            alert("✅ Pagamento identificado com sucesso no Asaas! Pedido liberado para separação.");
                          } else {
                            alert("O pagamento ainda consta como pendente no Asaas.");
                          }
                        }
                      } catch (_err) {
                        alert("Erro ao consultar status no Asaas.");
                      }
                    }}
                    className="text-[10px] bg-blue-100 hover:bg-blue-200 text-blue-700 font-bold px-2 py-1.5 rounded-lg transition"
                  >
                    🔍 Checar Pix no Asaas
                  </button>
                  <button 
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      if (confirm("Deseja realmente cancelar este pedido B2B? Em caso de Pix já pago, o estorno automático será solicitado no Asaas.")) {
                        store.acaoPedido(o.id, 'cancelar_pedido');
                        alert("❌ Pedido cancelado com sucesso. Caso o Pix tenha sido pago, o estorno foi solicitado no Asaas.");
                      }
                    }}
                    className="text-[10px] bg-red-100 hover:bg-red-200 text-red-700 font-bold px-2.5 py-1.5 rounded-lg transition shadow-sm"
                  >
                    ❌ Cancelar Pedido
                  </button>
                </div>
              </div>
            )}
            {o.status === 'pendente' && <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-[10px] font-bold uppercase">Aguardando Você</span>}
            {o.status === 'preparo' && (
              <div className="flex flex-col items-end gap-1">
                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-[10px] font-bold uppercase">Em Separação</span>
                <button 
                  type="button"
                  onClick={() => {
                    store.acaoPedido(o.id, 'chamar_caminhao');
                    alert("✅ Pedido marcado como Pronto! O frete agora está disponível no Radar dos Caminhoneiros.");
                  }}
                  className="text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2.5 py-1.5 rounded-lg transition shadow-sm flex items-center gap-1"
                >
                  🚚 Concluir Separação (Liberar Frete)
                </button>
              </div>
            )}
            {o.status === 'pronto' && <span className="bg-amber-100 text-amber-800 px-2 py-1 rounded text-[10px] font-bold uppercase">Aguardando Caminhão</span>}
            {o.status === 'em_rota' && <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-[10px] font-bold uppercase">Em Transporte</span>}
            {o.status === 'aguardando_cliente' && <span className="bg-teal-100 text-teal-800 px-2 py-1 rounded text-[10px] font-bold uppercase">Aguardando Loja Confirmar</span>}
            {(o.status === 'entregue' || o.status === 'arquivado') && (
              <div className="flex flex-col items-end gap-1">
                <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-[10px] font-bold uppercase">Concluído</span>
                {o.payoutSellerDone ? (
                  <span className="text-[10px] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-bold px-2 py-1 rounded border border-emerald-200 dark:border-emerald-800/60 shadow-sm flex items-center gap-1">
                    ✅ Repasse Liquidado (R$ {(o.taxas?.repasse || getSupplierRepasse(o)).toFixed(2)})
                  </span>
                ) : (
                  <span className="text-[10px] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-bold px-2 py-1 rounded border border-emerald-200 dark:border-emerald-800/60 shadow-sm flex items-center gap-1">
                    ⏳ Saldo p/ Saque Asaas (R$ {(o.taxas?.repasse || getSupplierRepasse(o)).toFixed(2)})
                  </span>
                )}
              </div>
            )}
            {o.status === 'cancelado' && <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-[10px] font-bold uppercase">Cancelado</span>}
            
            {isCanceled && (
              <button onClick={() => { if(confirm('Deseja excluir este pedido permanentemente?')) store.acaoPedido(o.id, 'deletar_pedido') }} className="text-xs bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold px-3 py-2 rounded-lg transition mt-2 sm:mt-0">🗑️ Excluir</button>
            )}

            {!isCanceled && (
              <button
                type="button"
                onClick={() => {
                  const allUsersWithCurrent = currentUser ? { ...store.users, [currentUser.id]: currentUser } : store.users;
                  printOrderTicket(o, currentUser?.name || 'Fornecedor AçaíFood', printerConfig, allUsersWithCurrent);
                }}
                className="text-xs bg-emerald-100 hover:bg-emerald-200 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 font-bold px-3 py-2 rounded-lg border border-emerald-300 dark:border-emerald-800 transition shadow-sm flex items-center gap-1 shrink-0 mt-2 sm:mt-0"
                title="Imprimir comanda térmica deste pedido"
              >
                🖨️ Imprimir Comanda
              </button>
            )}

            {!isCanceled && o.status === 'pendente' && (
              <div className="flex gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                  <button onClick={() => {
                    const reason = prompt("Informe o motivo da recusa:", "Sem estoque suficiente");
                    if (reason !== null && reason.trim() !== "") {
                      store.acaoPedido(o.id, 'cancelar_pedido', undefined, reason.trim());
                      alert("❌ Pedido recusado e estorno acionado no Asaas.");
                    }
                  }} className="flex-1 sm:flex-none bg-red-100 hover:bg-red-200 text-red-700 text-xs font-bold px-3 py-2 rounded-lg transition">❌ Recusar</button>
                  <button onClick={() => {
                    store.acaoPedido(o.id, 'aceitar_forn');
                    const pConfig = getPrinterConfig();
                    if (pConfig.enabled && pConfig.printMode === 'auto') {
                      const allUsersWithCurrent = currentUser ? { ...store.users, [currentUser.id]: currentUser } : store.users;
                      printOrderTicket(o, currentUser?.name || o.lojaNome || 'Fornecedor AçaíFood', pConfig, allUsersWithCurrent, null, 'PREPARO', 'SYSTEM');
                    }
                  }} className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-lg shadow">Aceitar e Separar</button>
              </div>
            )}
            
            {!isCanceled && o.status === 'preparo' && (
              <div className="flex gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                  <button onClick={() => {
                    const reason = prompt("Informe o motivo do cancelamento:", "Impossibilidade de expedição");
                    if (reason !== null && reason.trim() !== "") {
                      store.acaoPedido(o.id, 'cancelar_pedido', undefined, reason.trim());
                      alert("❌ Pedido cancelado e estorno acionado no Asaas.");
                    }
                  }} className="bg-red-100 hover:bg-red-200 text-red-700 text-xs font-bold px-3 py-2 rounded-lg transition">❌ Cancelar</button>
                  <button onClick={() => store.acaoPedido(o.id, 'chamar_moto')} className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-4 py-2 rounded-lg shadow transition">🚛 Chamar Caminhão</button>
              </div>
            )}
        </div>
    </div>
  )};

  return (
    <PartnerDashboardLayout
      role="fornecedor"
      title="Painel do Fornecedor (B2B)"
      roleIcon={<PackageOpen className="text-emerald-500" size={24} />}
      themeColor="emerald"
      partnerId={currentUser.id}
      partnerName={currentUser.name || 'Fornecedor B2B'}
      locationText={`Bairro: ${currentUser.bairro || currentUser.cidade || 'Central'}`}
      pixKeyInfo={currentUser.cpfCnpj || currentUser.pixKey}
      statusLabel={isPaused ? 'Pausado (Abrir)' : 'Operando'}
      isOnline={!isPaused}
      onToggleStatus={handleToggleStatus}
      isRefreshing={isRefreshing}
      onRefresh={handleRefresh}
      onUpdateGPS={handleUpdateGPS}
      virtualVaultValue={(vendasHoje && vendasHoje > 0) ? vendasHoje : (emProcessamento || 0)}
      manualRole="fornecedor"
      shareModal={
        <PartnerShareModal 
          isOpen={shareLandingModalOpen} 
          onClose={() => setShareLandingModalOpen(false)} 
          storeId={currentUser.id} 
          storeName={currentUser.name} 
          role="fornecedor" 
        />
      }
      navigationBar={
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-1.5 shadow-md flex items-center justify-between gap-2 flex-wrap">
          <div className="flex gap-1.5 overflow-x-auto py-0.5 no-scrollbar flex-1">
            <button 
              onClick={() => setActiveTab('geral')} 
              className={`py-2 px-3 sm:px-4 font-bold text-xs sm:text-sm rounded-xl transition whitespace-nowrap flex items-center gap-1.5 cursor-pointer shrink-0 ${
                activeTab === 'geral' 
                  ? 'bg-emerald-600 text-white shadow-md' 
                  : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
              }`}
            >
              <span>📊 Visão Geral</span>
            </button>

            <button 
              onClick={() => setActiveTab('pedidos')} 
              className={`py-2 px-3 sm:px-4 font-bold text-xs sm:text-sm rounded-xl transition whitespace-nowrap flex items-center gap-1.5 cursor-pointer shrink-0 ${
                activeTab === 'pedidos' 
                  ? 'bg-emerald-600 text-white shadow-md' 
                  : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
              }`}
            >
              <span>📦 Pedidos Ativos</span>
              {fornActiveOrders.length > 0 && (
                <span className="bg-emerald-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full animate-pulse">
                  {fornActiveOrders.length}
                </span>
              )}
            </button>

            <button 
              onClick={() => setActiveTab('historico')} 
              className={`py-2 px-3 sm:px-4 font-bold text-xs sm:text-sm rounded-xl transition whitespace-nowrap flex items-center gap-1.5 cursor-pointer shrink-0 ${
                activeTab === 'historico' 
                  ? 'bg-emerald-600 text-white shadow-md' 
                  : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
              }`}
            >
              <span>📋 Histórico</span>
              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${activeTab === 'historico' ? 'bg-emerald-800 text-white' : 'bg-zinc-800 text-zinc-300'}`}>
                {fornHistoryOrders.length}
              </span>
            </button>

            <button 
              onClick={() => setActiveTab('carteira')} 
              className={`py-2 px-3 sm:px-4 font-bold text-xs sm:text-sm rounded-xl transition whitespace-nowrap flex items-center gap-1.5 cursor-pointer shrink-0 ${
                activeTab === 'carteira' 
                  ? 'bg-emerald-600 text-white shadow-md' 
                  : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
              }`}
            >
              <span>💳 Carteira Digital</span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-black px-1.5 py-0.5 rounded border border-emerald-500/30">
                {formatMoney((vendasHoje && vendasHoje > 0) ? vendasHoje : (emProcessamento || 0))}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button 
              onClick={() => setPrinterModalOpen(true)} 
              className="text-xs bg-emerald-900/40 hover:bg-emerald-900/70 text-emerald-300 border border-emerald-800 px-3 py-2 rounded-xl font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer shrink-0"
              title="Configurar Impressora Térmica"
            >
              <Printer size={14} /> Impressora Térmica
            </button>
            <button 
              onClick={() => setShareLandingModalOpen(true)}
              className="text-xs bg-pink-950/40 hover:bg-pink-900/60 text-pink-300 border border-pink-900/50 px-3 py-2 rounded-xl font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer shrink-0"
            >
              <Share2 size={14} /> Compartilhar
            </button>
          </div>
        </div>
      }
    >

      <StoreShareCard 
        storeId={currentUser.id} 
        storeName={currentUser.name} 
        role="fornecedor" 
      />

        {activeTab === 'geral' && (
          <div className="grid grid-cols-1 gap-6 animate-in fade-in zoom-in-95 duration-300">
            {/* Card 1: Status de Funcionamento & Lata Açaí */}
            <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 flex flex-col justify-center gap-3">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-3 border-b border-zinc-100 dark:border-zinc-800">
                <div>
                  <h3 className="font-bold text-zinc-700 dark:text-zinc-200 text-sm uppercase flex items-center gap-2">
                    <span>🏭</span> Status da Usina / Fornecedor
                  </h3>
                  <p className="text-[10px] text-zinc-500">Controle se seu estabelecimento está operando e recebendo pedidos das lojas.</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap mt-2 sm:mt-0">
                  <button 
                    onClick={handleToggleStatus} 
                    className={`px-4 py-2.5 rounded-xl text-xs font-black transition shadow-sm border flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                      isPaused 
                        ? 'bg-red-500 hover:bg-red-600 text-white border-red-400 animate-pulse' 
                        : 'bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-400'
                    }`}
                  >
                    {isPaused ? '🔴 Pausado (Clique para Abrir)' : '🟢 Operando (Recebendo Pedidos)'}
                  </button>
                  <div className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700">
                    <span className="text-xs sm:text-sm font-bold text-zinc-600 dark:text-zinc-300">Lata:</span>
                    <span className="text-base sm:text-lg font-black text-zinc-950 dark:text-white tracking-tight">{formatMoney(b2bPrice)}</span>
                  </div>
                  <button onClick={() => setPriceModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-sm">
                    ✏️ Editar Preço
                  </button>
                </div>
              </div>

              {/* Participação no Frete */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pt-1">
                <div>
                  <h3 className="font-bold text-zinc-700 dark:text-zinc-200 text-sm uppercase flex items-center gap-1.5">
                    <span>🚚</span> Participação no Frete do Caminhão (%)
                  </h3>
                  <p className="text-[10px] text-zinc-500">Defina a porcentagem do frete que você quer subsidiar para atrair batedeiras.</p>
                </div>
                <div className="flex items-center gap-2 mt-2 sm:mt-0">
                  <label className="text-xs font-bold text-zinc-600 dark:text-zinc-400">Você Paga:</label>
                  <input type="number" min="0" max="100" value={subsidyInput} onChange={e => setSubsidyInput(e.target.value)} className="w-16 border border-zinc-300 dark:border-zinc-700 bg-transparent rounded-lg p-1.5 text-center font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
                  <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400">%</span>
                  <button onClick={handleSaveSubsidy} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded-lg text-xs font-bold transition shadow-sm ml-1">Salvar</button>
                </div>
              </div>
            </div>

            {/* Card 2: PRODUTO PRINCIPAL B2B: LATA / PANEIRO DE AÇAÍ (FRUTO IN NATURA) */}
            <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-3 border-b border-zinc-100 dark:border-zinc-800">
                <div>
                  <h3 className="font-bold text-zinc-800 dark:text-zinc-100 text-sm uppercase flex items-center gap-2">
                    <span>🧺</span> Produto Principal (Frutos In Natura)
                  </h3>
                  <p className="text-xs text-zinc-500">Matéria-prima e latas de açaí vendidas diretamente para as batedeiras.</p>
                </div>
                <span className="text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 px-2.5 py-1 rounded-full">
                  Base B2B
                </span>
              </div>

              {(() => {
                const isLataAvail = currentUser?.availabilityB2B?.lata !== false;
                const lataPhoto = currentUser?.imagesB2B?.lata || 'https://images.unsplash.com/photo-1628557044797-f21a177c37ec?auto=format&fit=crop&w=400&q=80';
                return (
                  <div className={`p-4 rounded-2xl border transition flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${
                    isLataAvail 
                      ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60' 
                      : 'bg-zinc-100/80 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 opacity-70'
                  }`}>
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div 
                        onClick={() => setPhotoModalData({
                          open: true,
                          title: 'Foto da Lata de Açaí (Fruto In Natura)',
                          category: 'b2b',
                          currentUrl: currentUser?.imagesB2B?.lata,
                          onSelect: (url) => {
                            if (currentUser) store.updateB2BImage(currentUser.id, url);
                          }
                        })}
                        className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 overflow-hidden shrink-0 border border-emerald-300 dark:border-emerald-700 cursor-pointer flex items-center justify-center relative group shadow-sm"
                        title="Trocar Foto da Lata"
                      >
                        <img src={lataPhoto} alt="Lata Açaí" className="w-full h-full object-cover" />
                        <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold transition">
                          📷
                        </span>
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-extrabold text-base sm:text-lg text-zinc-950 dark:text-white leading-tight">
                            Paneiro / Lata de Açaí (In Natura)
                          </h4>
                          {!isLataAvail && (
                            <span className="text-[9px] bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400 font-extrabold px-1.5 py-0.5 rounded uppercase">
                              Esgotado
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-zinc-500">Frutos in natura padrão (por lata)</p>
                        <p className="text-base sm:text-lg font-black text-zinc-950 dark:text-white mt-0.5 tracking-tight">
                          {formatMoney(b2bPrice)} <span className="text-xs font-normal text-zinc-400">/ lata</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
                      <button
                        type="button"
                        onClick={() => {
                          if (currentUser) store.toggleB2BAvailability(currentUser.id);
                        }}
                        className={`px-3 py-2 rounded-xl text-xs font-bold border transition shadow-sm ${
                          isLataAvail
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200 dark:bg-emerald-900/60 dark:border-emerald-700 dark:text-emerald-200'
                            : 'bg-red-100 text-red-800 border-red-300 hover:bg-red-200 dark:bg-red-950 dark:border-red-800 dark:text-red-300'
                        }`}
                      >
                        {isLataAvail ? '🟢 Fruto Disponível' : '🔴 Fruto Esgotado'}
                      </button>
                      <button 
                        type="button"
                        onClick={() => setPhotoModalData({
                          open: true,
                          title: 'Foto da Lata de Açaí (Fruto In Natura)',
                          category: 'b2b',
                          currentUrl: currentUser?.imagesB2B?.lata,
                          onSelect: (url) => {
                            if (currentUser) store.updateB2BImage(currentUser.id, url);
                          }
                        })}
                        className="bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 px-3 py-2 rounded-xl text-xs font-bold transition border border-zinc-200 dark:border-zinc-700"
                      >
                        📷 Foto
                      </button>
                      <button 
                        onClick={() => setPriceModalOpen(true)} 
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-sm"
                      >
                        ✏️ Editar Preço
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Card 3: Cadastro & Lista de Produtos Extras / Insumos B2B */}
            <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 flex flex-col gap-4">
              <div className="border-b border-zinc-100 dark:border-zinc-800 pb-2">
                <h3 className="font-bold text-zinc-800 dark:text-zinc-100 text-sm uppercase flex items-center gap-2">
                  <span>📦</span> Produtos & Insumos Extras B2B
                </h3>
                <p className="text-xs text-zinc-500">Cadastre outros produtos como sacas, frutos selecionados, polpas, insumos, etc.</p>
              </div>

              {/* Form de cadastro com foto */}
              <div className="bg-zinc-50 dark:bg-zinc-950/60 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row gap-2 items-center">
                <button
                  type="button"
                  onClick={() => setPhotoModalData({
                    open: true,
                    title: 'Foto do Produto B2B',
                    category: 'b2b',
                    currentUrl: newProductImage,
                    onSelect: (url) => setNewProductImage(url)
                  })}
                  className="w-full sm:w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 hover:bg-emerald-200 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0 border border-emerald-300 dark:border-emerald-700 transition"
                  title="Escolher Foto"
                >
                  {newProductImage ? (
                    <img src={newProductImage} alt="Extra" className="w-full h-full object-cover rounded-lg" />
                  ) : (
                    <span>📸</span>
                  )}
                </button>
                <div className="flex-1 flex flex-col gap-1.5 w-full">
                  <div className="flex gap-2 w-full">
                    <input 
                      type="text" 
                      placeholder="Nome (ex: Saca de Açaí Selecionado)" 
                      value={newProductName} 
                      onChange={e => setNewProductName(e.target.value)} 
                      className="flex-1 border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded-lg p-2 text-xs outline-none focus:border-emerald-500 font-semibold" 
                    />
                    <input 
                      type="number" 
                      step="0.1" 
                      placeholder="R$" 
                      value={newProductPrice} 
                      onChange={e => setNewProductPrice(e.target.value)} 
                      className="w-24 border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded-lg p-2 text-xs outline-none focus:border-emerald-500 font-bold" 
                    />
                  </div>
                  <input 
                    type="text" 
                    placeholder="Descrição / Detalhes (ex: Saca com 50kg de açaí de várzea selecionado...)" 
                    value={newProductDesc} 
                    onChange={e => setNewProductDesc(e.target.value)} 
                    className="w-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-lg p-1.5 text-xs outline-none focus:border-emerald-500 text-zinc-600 dark:text-zinc-300" 
                  />
                </div>
                <button 
                  onClick={handleAddProduct} 
                  className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-lg text-xs transition shrink-0 shadow-sm self-stretch sm:self-auto flex items-center justify-center cursor-pointer"
                >
                  + Adicionar
                </button>
              </div>

              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800 mt-2">
                {[...(currentUser?.products || [])].sort((a: any, b: any) => ((b.isAvailable !== false ? 1 : 0) - (a.isAvailable !== false ? 1 : 0))).map((p: any) => {
                  const isAvail = p.isAvailable !== false;
                  return (
                    <li key={p.id} className="flex justify-between items-center py-2.5 gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div 
                          onClick={() => setPhotoModalData({
                            open: true,
                            title: `Foto de ${p.name}`,
                            category: 'b2b',
                            currentUrl: p.imageUrl,
                            onSelect: (url) => {
                              if (currentUser) store.updateProduct(currentUser.id, p.id, { imageUrl: url });
                            }
                          })}
                          className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 overflow-hidden shrink-0 border border-zinc-200 dark:border-zinc-700 cursor-pointer flex items-center justify-center"
                          title="Trocar Foto"
                        >
                          {p.imageUrl ? (
                            <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-sm">🌿</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className={`font-extrabold text-sm sm:text-base truncate ${isAvail ? 'text-zinc-900 dark:text-white' : 'text-zinc-400 line-through'}`}>{p.name}</p>
                          <p className="text-base sm:text-lg font-black text-zinc-950 dark:text-white mt-0.5 tracking-tight">R$ {p.price.toFixed(2)}</p>
                          {p.description && (
                            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-1 italic">
                              📝 {p.description}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            if (currentUser) store.toggleProductAvailability(currentUser.id, p.id);
                          }}
                          className={`px-2 py-1 rounded-md text-[10px] font-bold border transition ${
                            isAvail
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:border-emerald-800'
                              : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100 dark:bg-red-950/40 dark:border-red-800'
                          }`}
                        >
                          {isAvail ? '🟢 Disponível' : '🔴 Esgotado'}
                        </button>
                        <button onClick={() => handleEditProduct(p)} className="text-emerald-600 hover:text-emerald-800 p-1.5 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg transition" title="Editar produto extra">✏️</button>
                        <button onClick={() => { if (confirm(`Deseja excluir "${p.name}"?`)) store.removeProduct(currentUser.id, p.id); }} className="text-red-500 hover:text-red-700 p-1.5 bg-red-50 dark:bg-red-900/30 rounded-lg transition" title="Excluir produto extra">🗑️</button>
                      </div>
                    </li>
                  );
                })}
                {(!currentUser?.products || currentUser.products.length === 0) && (
                  <p className="text-xs text-zinc-500 text-center py-4">Nenhum produto extra cadastrado.</p>
                )}
              </ul>
            </div>
          </div>
        )}

        {/* 2. ABA: PEDIDOS ATIVOS */}
        {activeTab === 'pedidos' && (
          <div className="animate-in fade-in zoom-in-95 duration-300">
            <h3 className="font-bold text-lg text-zinc-700 dark:text-zinc-200 border-b border-zinc-200 dark:border-zinc-800 pb-2 mb-4 flex items-center justify-between">
              <span>📦 Pedidos Ativos em Andamento (B2B)</span>
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">{fornActiveOrders.length} ativo(s)</span>
            </h3>
            
            <div className="space-y-4">
              {fornActiveOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-dashed border-zinc-300 dark:border-zinc-700 text-center">
                  <span className="text-4xl mb-3 opacity-50">🚢</span>
                  <p className="text-zinc-500 font-medium">Nenhum pedido ativo no momento.</p>
                </div>
              ) : (
                fornActiveOrders.map(renderFornecedorOrderCard)
              )}
            </div>
          </div>
        )}

        {/* 3. ABA: HISTÓRICO */}
        {activeTab === 'historico' && (
          <div className="animate-in fade-in zoom-in-95 duration-300">
            <h3 className="font-bold text-lg text-zinc-700 dark:text-zinc-200 border-b border-zinc-200 dark:border-zinc-800 pb-2 mb-4 flex items-center justify-between">
              <span>📋 Histórico de Pedidos e Vendas (B2B)</span>
              <span className="text-xs text-zinc-400 font-normal">{fornHistoryOrders.length} pedido(s) finalizado(s)</span>
            </h3>
            
            <div className="space-y-4">
              {fornHistoryOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-dashed border-zinc-300 dark:border-zinc-700 text-center">
                  <span className="text-4xl mb-3 opacity-50">📜</span>
                  <p className="text-zinc-500 font-medium">Nenhum pedido finalizado ainda.</p>
                </div>
              ) : (
                fornHistoryOrders.map(renderFornecedorOrderCard)
              )}
            </div>
          </div>
        )}

        {/* 4. ABA: CARTEIRA DIGITAL */}
        {activeTab === 'carteira' && (
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
            <PartnerWithdrawalSection 
              partnerId={currentUser.id} 
              role="fornecedor" 
            />
          </div>
        )}

      <MapModal 
        isOpen={mapModal.open} 
        onClose={() => setMapModal(prev => ({ ...prev, open: false }))} 
        origem={mapModal.origem} 
        destino={mapModal.destino} 
        motorista={mapModal.motorista} 
      />

      {priceModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col">
            <div className="bg-emerald-900 text-white p-5 flex justify-between items-center shrink-0">
                <h3 className="font-bold text-lg">✏️ Editar Preço da Lata Açaí</h3>
                <button onClick={() => setPriceModalOpen(false)} className="text-white hover:text-red-300 font-bold text-2xl leading-none">&times;</button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                  <label className="text-xs uppercase text-zinc-500 font-bold">Lote/Paneiro B2B (R$)</label>
                  <input type="number" step="0.1" value={b2bPrice} onChange={e => setB2bPrice(Number(e.target.value))} className="w-full border border-zinc-300 dark:border-zinc-700 bg-transparent rounded-lg p-3 outline-none focus:ring-2 focus:ring-emerald-500 mt-1 font-bold text-lg"/>
              </div>
            </div>

            <div className="p-5 bg-zinc-50 dark:bg-zinc-900/50 flex justify-end gap-3 border-t border-zinc-200 dark:border-zinc-800">
                <button onClick={() => setPriceModalOpen(false)} className="px-5 py-2.5 text-zinc-600 bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 rounded-xl font-bold transition">Cancelar</button>
                <button onClick={handleSavePrices} className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition">Salvar Preço</button>
            </div>
          </div>
        </div>
      )}
      {/* Modal de Configuração de Impressora Térmica */}
      {printerModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-in fade-in zoom-in-95">
            <div className="bg-emerald-900 text-white p-5 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <Printer className="text-emerald-300" />
                <h3 className="font-bold text-lg">🖨️ Impressora Térmica</h3>
              </div>
              <button onClick={() => setPrinterModalOpen(false)} className="text-white hover:text-red-300 font-bold text-2xl leading-none">&times;</button>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className="text-xs uppercase text-zinc-500 font-bold block mb-1">Modo de Impressão</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const updated = { ...printerConfig, printMode: 'manual' as const };
                      setPrinterConfig(updated);
                      savePrinterConfig(updated);
                    }}
                    className={`p-3 rounded-lg border text-xs font-bold text-center transition ${
                      printerConfig.printMode === 'manual'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                    }`}
                  >
                    👆 Manual
                    <p className="text-[9px] font-normal opacity-80 mt-1">Imprimir ao clicar no botão do pedido</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const updated = { ...printerConfig, printMode: 'auto' as const };
                      setPrinterConfig(updated);
                      savePrinterConfig(updated);
                    }}
                    className={`p-3 rounded-lg border text-xs font-bold text-center transition ${
                      printerConfig.printMode === 'auto'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                    }`}
                  >
                    ⚡ Automático
                    <p className="text-[9px] font-normal opacity-80 mt-1">Imprimir comanda ao receber/confirmar</p>
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs uppercase text-zinc-500 font-bold block mb-1">Largura da Bobina / Papel</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const updated = { ...printerConfig, paperWidth: '80mm' as const };
                      setPrinterConfig(updated);
                      savePrinterConfig(updated);
                    }}
                    className={`p-3 rounded-lg border text-xs font-bold text-center transition ${
                      printerConfig.paperWidth === '80mm'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                    }`}
                  >
                    📄 80mm (Padrão)
                    <p className="text-[9px] font-normal opacity-80 mt-1">Elgin, Bematech, Epson, Daruma</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const updated = { ...printerConfig, paperWidth: '58mm' as const };
                      setPrinterConfig(updated);
                      savePrinterConfig(updated);
                    }}
                    className={`p-3 rounded-lg border text-xs font-bold text-center transition ${
                      printerConfig.paperWidth === '58mm'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                    }`}
                  >
                    📜 58mm (Menor)
                    <p className="text-[9px] font-normal opacity-80 mt-1">Mini impressoras / Bluetooth</p>
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs uppercase text-zinc-500 font-bold block mb-1">Quantidade de Vias por Pedido</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const updated = { ...printerConfig, copies: 1 as const };
                      setPrinterConfig(updated);
                      savePrinterConfig(updated);
                    }}
                    className={`p-2.5 rounded-lg border text-xs font-bold text-center transition ${
                      printerConfig.copies === 1
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                    }`}
                  >
                    1 Via (Fornecedor)
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const updated = { ...printerConfig, copies: 2 as const };
                      setPrinterConfig(updated);
                      savePrinterConfig(updated);
                    }}
                    className={`p-2.5 rounded-lg border text-xs font-bold text-center transition ${
                      printerConfig.copies === 2
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                    }`}
                  >
                    2 Vias (Expedição + Caminhão)
                  </button>
                </div>
              </div>

              <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
                <button
                  type="button"
                  onClick={() => printTestTicket(currentUser?.name || 'Fornecedor AçaíFood', printerConfig)}
                  className="px-4 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 rounded-lg text-xs font-bold transition flex items-center gap-1"
                >
                  🧪 Testar Impressão
                </button>

                <button
                  type="button"
                  onClick={() => setPrinterModalOpen(false)}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow"
                >
                  Concluído
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {currentUser && (
        <OrderChatModal
          isOpen={chatModalData.open}
          onClose={() => setChatModalData({ open: false, orderId: "" })}
          orderId={chatModalData.orderId}
          currentUserId={currentUser.id}
          currentUserName={currentUser.name}
          currentUserRole="fornecedor"
          otherParticipantName={chatModalData.otherName}
          otherParticipantPhone={chatModalData.otherPhone}
          otherParticipantRole={chatModalData.otherRole}
        />
      )}

      {/* Modal Seletor de Fotos */}
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

      {/* BOTÃO FLUTUANTE DE ATENDIMENTO / SUPORTE GERAL */}
      <SupportChatButton currentUser={currentUser} />
      <AsaasPartnerBadge variant="footer" className="mt-8 mb-4" />
    </PartnerDashboardLayout>
  );
}
