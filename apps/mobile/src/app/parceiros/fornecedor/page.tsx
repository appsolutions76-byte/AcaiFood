"use client";

import React, { useState, useEffect, useRef, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { 
  PackageOpen, Printer, BookOpen, Share2, Camera, Edit3, Trash2, 
  CheckCircle2, XCircle, Sparkles, Plus, Search, Tag, Factory, 
  Truck, Package, BarChart3, History, Wallet, Check, X, AlertCircle 
} from "lucide-react";
import { useAppStore, getRatesForCity, generateUUID } from "@/store/useAppStore";
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
  autoReconnectBluetoothPrinter,
  DEFAULT_PRINTER_CONFIG,
  PrinterConfig,
} from "@/lib/thermalPrinter";
import { ThermalPrinterModal } from "@/components/ThermalPrinterModal";
import PartnerActivationGuard from "@/components/PartnerActivationGuard";
import { AsaasPartnerBadge } from "@/components/AsaasPartnerBadge";
import { AppSolutionsBrandCard } from "@/components/AppSolutionsBrandCard";
import { RefundInfo } from "@/components/RefundInfo";

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
  const [chatModalData, setChatModalData] = useState<{ open: boolean; orderId: string; otherName?: string; otherPhone?: string; otherRole?: string; initialMode?: 'chat' | 'report' }>({ open: false, orderId: "" });
  const [shareLandingModalOpen, setShareLandingModalOpen] = useState(false);
  const printedOrdersRef = useRef<Set<string>>(new Set());

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const [printerConfig, setPrinterConfig] = useState<PrinterConfig>(getPrinterConfig);

  useEffect(() => {
    const s = useAppStore.getState();
    s.fetchAllUsers(true);
    s.fetchLojas(true);
    if (typeof s.fetchCities === 'function') s.fetchCities();
    if (typeof s.fetchRates === 'function') s.fetchRates();
    s.startRealtime();

    // Tenta reconectar automaticamente à impressora térmica Bluetooth salva
    autoReconnectBluetoothPrinter();

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
  const [subsidyFeedback, setSubsidyFeedback] = useState<string | null>(null);
  const [showAddB2BForm, setShowAddB2BForm] = useState(false);
  const [priceModalOpen, setPriceModalOpen] = useState(false);
  const [b2bPrice, setB2bPrice] = useState(() => currentUser?.priceB2B ?? 140);
  const [editingInlineLataPrice, setEditingInlineLataPrice] = useState(false);
  const [inlineLataPriceInput, setInlineLataPriceInput] = useState<string>('');
  const [editingExtraPriceId, setEditingExtraPriceId] = useState<string | null>(null);
  const [inlineExtraPriceInput, setInlineExtraPriceInput] = useState<string>('');
  
  // Não sobrescrever o preço enquanto o fornecedor está editando (a lista de usuários recarrega a cada 4 s)
  useEffect(() => {
    if (priceModalOpen) return;
    if (currentUser?.priceB2B !== undefined) {
      setB2bPrice(currentUser.priceB2B);
    }
  }, [currentUser?.priceB2B, priceModalOpen]);
  const [activeTab, setActiveTab] = useState('geral');

  const [newProductName, setNewProductName] = useState('');
  const [newProductPrice, setNewProductPrice] = useState('');
  const [newProductDesc, setNewProductDesc] = useState('');
  const [newProductImage, setNewProductImage] = useState<string | undefined>(undefined);
  
  // Filtros e busca de produtos extras B2B
  const [extraFilterStatus, setExtraFilterStatus] = useState<'all' | 'available' | 'unavailable'>('all');
  const [extraSearchQuery, setExtraSearchQuery] = useState('');

  // Modal de edição completa de produto extra B2B (sem prompt)
  const [editingProduct, setEditingProduct] = useState<{
    id: string;
    name: string;
    price: number;
    description?: string;
    imageUrl?: string;
    isAvailable?: boolean;
  } | null>(null);

  const [photoModalData, setPhotoModalData] = useState<{
    open: boolean;
    title: string;
    category?: 'acai' | 'adicional' | 'b2b' | 'store';
    currentUrl?: string;
    onSelect: (url?: string) => void;
  }>({ open: false, title: '', onSelect: () => {} });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [serverBalance, setServerBalance] = useState<number | null>(null);
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

  const handleStartInlineLataEdit = () => {
    setEditingInlineLataPrice(true);
    setInlineLataPriceInput(b2bPrice.toString());
  };

  const handleSaveInlineLataPrice = () => {
    if (!currentUser) return;
    const val = parseFloat(inlineLataPriceInput.replace(',', '.'));
    if (isNaN(val) || val <= 0) {
      alert('Por favor, informe um valor válido para a lata/paneiro.');
      return;
    }
    setB2bPrice(val);
    store.updateUserPrice(currentUser.id, undefined, val);
    setEditingInlineLataPrice(false);
  };

  const handleStartExtraInlineEdit = (id: string, currentVal: number) => {
    setEditingExtraPriceId(id);
    setInlineExtraPriceInput(currentVal.toString());
  };

  const handleSaveExtraInlinePrice = (id: string) => {
    if (!currentUser) return;
    const val = parseFloat(inlineExtraPriceInput.replace(',', '.'));
    if (isNaN(val) || val < 0) {
      alert('Por favor, informe um valor válido para o produto B2B.');
      return;
    }
    store.updateProduct(currentUser.id, id, { price: val });
    setEditingExtraPriceId(null);
  };

  const handleAddProduct = (presetName?: string, presetPrice?: number, presetDesc?: string) => {
    if (!currentUser) return;
    const nameToAdd = (presetName || newProductName).trim();
    const rawPrice = presetPrice !== undefined ? presetPrice : Number(newProductPrice);
    const descToAdd = (presetDesc !== undefined ? presetDesc : newProductDesc).trim();

    if (!nameToAdd || isNaN(rawPrice) || rawPrice < 0) {
      alert("Informe o nome e um preço válido para o produto extra B2B.");
      return;
    }

    store.addProduct(currentUser.id, {
      id: generateUUID(),
      name: nameToAdd,
      price: rawPrice,
      description: descToAdd || undefined,
      imageUrl: newProductImage,
      isAvailable: true
    });
    setNewProductName('');
    setNewProductPrice('');
    setNewProductDesc('');
    setNewProductImage(undefined);
  };

  const handleOpenEditProduct = (p: any) => {
    setEditingProduct({
      id: p.id,
      name: p.name,
      price: p.price,
      description: p.description || p.desc || '',
      imageUrl: p.imageUrl,
      isAvailable: p.isAvailable !== false
    });
  };

  const handleSaveEditProduct = () => {
    if (!currentUser || !editingProduct) return;
    if (!editingProduct.name.trim() || isNaN(editingProduct.price) || editingProduct.price < 0) {
      alert("Informe um nome válido e um preço maior ou igual a zero.");
      return;
    }
    store.updateProduct(currentUser.id, editingProduct.id, {
      name: editingProduct.name.trim(),
      price: editingProduct.price,
      description: editingProduct.description?.trim() || undefined,
      imageUrl: editingProduct.imageUrl,
      isAvailable: editingProduct.isAvailable !== false
    });
    setEditingProduct(null);
  };

  const handleBulkToggleExtras = (isAvailable: boolean) => {
    if (!currentUser) return;
    const prods = currentUser.products || [];
    if (prods.length === 0) return;
    prods.forEach((p: any) => {
      store.updateProduct(currentUser.id, p.id, { isAvailable });
    });
  };

  const linkAsaasAccount = store.linkAsaasAccount;

  const handleLinkAsaas = async () => {
    if (!currentUser) return;
    alert('Seu saque é analisado e pago na sua subconta Asaas.\n\nPara liberar, abra sua conta e envie os documentos no cartão "Minha conta Asaas", no topo desta página.');
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
  // Mesmo saldo do servidor usado no saque (igual ao painel da batedeira)
  const vendasHoje = serverBalance !== null ? serverBalance : meusPedidosAll.filter((o: any) => isCompleted(o.status) && !o.payoutSellerDone).reduce((acc: number, curr: any) => acc + getSupplierRepasse(curr), 0);
  const emProcessamento = meusPedidosAll.filter((o: any) => isPaidOrProcessing(o.status)).reduce((acc: number, curr: any) => acc + getSupplierRepasse(curr), 0);

  const fornActiveOrders = meusPedidosAll.filter((o: any) => 
    o.status !== 'aguardando_pagamento' && 
    !isCompleted(o.status) && 
    o.status !== 'cancelado' && 
    o.status !== 'arquivado'
  );
  const fornHistoryOrders = meusPedidosAll.filter((o: any) => isCompleted(o.status) || o.status === 'cancelado' || o.status === 'arquivado');
  const meusPedidos = [...fornActiveOrders, ...fornHistoryOrders];

  const handleSaveSubsidy = (val?: number) => {
    const valueToSave = val !== undefined ? val : (parseFloat(subsidyInput) || 0);
    store.setFreteSubsidy(currentUser.id, valueToSave);
    setSubsidyInput(valueToSave.toString());
    setSubsidyFeedback(`Subsídio salvo: ${valueToSave}%`);
    setTimeout(() => setSubsidyFeedback(null), 3000);
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
                    const isConcluded = o.status === 'entregue' || o.status === 'cancelado' || o.status === 'concluido' || o.status === 'finalizado';

                    setChatModalData({
                      open: true,
                      orderId: o.id,
                      otherName: targetOther?.name || o.clienteNome || 'Loja Batedeira',
                      otherPhone: (targetOther as any)?.phone || targetOther?.telefone || o.clienteTelefone || '',
                      otherRole: caminhoneiroUser ? 'Transporte' : 'Loja Compradora',
                      initialMode: isConcluded ? 'report' : 'chat'
                    });
                  }}
                  className={`text-[10px] font-bold px-2 py-1 rounded inline-flex items-center gap-1 transition shadow-sm ml-2 ${
                    (o.status === 'entregue' || o.status === 'cancelado')
                      ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 hover:bg-amber-200'
                      : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200'
                  }`}
                >
                  {(o.status === 'entregue' || o.status === 'cancelado') ? '⚠️ Reportar Problema' : '💬 Chat & 📞 Voz'}
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
            {!isCanceled && o.status !== 'entregue' && o.status !== 'arquivado' && (
              <div className="mt-2.5 bg-amber-500 text-white p-2.5 rounded-xl flex items-center justify-between shadow-sm border border-amber-400">
                <div>
                  <p className="text-[10px] font-bold uppercase text-amber-100 flex items-center gap-1">
                    <span>🔑</span> PIN de Retirada (Despacho B2B)
                  </p>
                  <p className="text-[10px] text-amber-50 leading-tight">Informe ao caminhoneiro no carregamento</p>
                </div>
                <div className="text-xl font-black tracking-widest text-zinc-900 bg-white px-3 py-1 rounded-lg border border-amber-200 shadow-sm">
                  {o.pickupPin || (o as any).pickup_pin || 'Indisponível'}
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
            {o.status === 'preparo' && <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-[10px] font-bold uppercase">Em Separação</span>}
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
            <RefundInfo order={o} viewer="loja" compact />
            
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
      partnerPhoto={currentUser.photo}
      onEditPhoto={() => setPhotoModalData({
        open: true,
        title: 'Foto da Usina / Fornecedor',
        category: 'store' as any,
        currentUrl: currentUser?.photo,
        onSelect: (url) => {
          if (currentUser) store.updateStorePhoto(currentUser.id, url);
        }
      })}
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
      onOpenPrinter={() => setPrinterModalOpen(true)}
      onOpenShare={() => setShareLandingModalOpen(true)}
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
        <div className="bg-zinc-100/90 dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-1.5 shadow-sm flex items-center w-full">
          <div className="flex gap-1.5 overflow-x-auto py-0.5 no-scrollbar w-full">
            <button 
              onClick={() => setActiveTab('geral')} 
              className={`py-2 px-3 sm:px-4 font-bold text-xs sm:text-sm rounded-xl transition whitespace-nowrap flex items-center gap-1.5 cursor-pointer shrink-0 ${
                activeTab === 'geral' 
                  ? 'bg-emerald-600 text-white shadow-md' 
                  : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 border border-zinc-200 dark:border-zinc-800'
              }`}
            >
              <BarChart3 size={15} />
              <span>Visão Geral & Produtos</span>
            </button>

            <button 
              onClick={() => setActiveTab('pedidos')} 
              className={`py-2 px-3 sm:px-4 font-bold text-xs sm:text-sm rounded-xl transition whitespace-nowrap flex items-center gap-1.5 cursor-pointer shrink-0 ${
                activeTab === 'pedidos' 
                  ? 'bg-emerald-600 text-white shadow-md' 
                  : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 border border-zinc-200 dark:border-zinc-800'
              }`}
            >
              <PackageOpen size={15} />
              <span>Pedidos Ativos</span>
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
                  : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 border border-zinc-200 dark:border-zinc-800'
              }`}
            >
              <History size={15} />
              <span>Histórico</span>
              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${activeTab === 'historico' ? 'bg-emerald-800 text-white' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'}`}>
                {fornHistoryOrders.length}
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
              <Wallet size={15} />
              <span>Carteira Digital</span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-black px-1.5 py-0.5 rounded border border-emerald-500/30">
                {formatMoney((vendasHoje && vendasHoje > 0) ? vendasHoje : (emProcessamento || 0))}
              </span>
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
          <div className="space-y-5 animate-in fade-in zoom-in-95 duration-300">
            {/* 1. BARRA SUPERIOR INTEGRADA: STATUS OPERACIONAL & FRETE DO CAMINHÃO */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              {/* Status Usina Operando / Pausada */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 flex items-center justify-center shrink-0">
                  <Factory size={18} className="text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-sm sm:text-base text-zinc-900 dark:text-white">Status da Usina</h3>
                    <button
                      onClick={handleToggleStatus}
                      className={`px-3 py-1 rounded-full text-xs font-extrabold transition border flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                        isPaused
                          ? 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30'
                          : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${isPaused ? 'bg-red-500' : 'bg-emerald-500'}`} />
                      <span>{isPaused ? 'Pausada (Reabrir)' : 'Operando (Recebendo)'}</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    {isPaused ? 'Usina pausada para novos pedidos.' : 'Recebendo pedidos B2B normalmente das lojas.'}
                  </p>
                </div>
              </div>

              {/* Participação no Frete do Caminhão */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2.5 w-full md:w-auto">
                <div className="flex items-center gap-1.5">
                  <Truck size={14} className="text-emerald-600 dark:text-emerald-400" />
                  <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Frete Caminhão:</span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {[0, 15, 25, 50, 100].map(pct => {
                    const isSelected = Math.round(Number(subsidyInput) || 0) === pct;
                    return (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => {
                          setSubsidyInput(pct.toString());
                          handleSaveSubsidy(pct);
                        }}
                        className={`px-2 py-1 rounded-lg text-xs font-black transition cursor-pointer active:scale-95 ${
                          isSelected
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-emerald-50 dark:hover:bg-zinc-700'
                        }`}
                      >
                        {pct}%
                      </button>
                    );
                  })}
                  <div className="flex items-center gap-1 ml-1">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={subsidyInput}
                      onChange={e => setSubsidyInput(e.target.value)}
                      className="w-12 bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-lg py-1 text-center font-black text-xs text-zinc-900 dark:text-white outline-none focus:border-emerald-500"
                      title="Porcentagem livre de frete"
                    />
                    <span className="text-[11px] font-bold text-zinc-400">%</span>
                    <button
                      type="button"
                      onClick={() => handleSaveSubsidy()}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer active:scale-95"
                    >
                      Salvar
                    </button>
                  </div>
                </div>

                {subsidyFeedback && (
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                    <Check size={12} /> {subsidyFeedback}
                  </span>
                )}
              </div>
            </div>

            {/* 2. PRODUTO PRINCIPAL B2B: LATA / PANEIRO DE AÇAÍ */}
            <div className="bg-white dark:bg-zinc-900 p-5 sm:p-6 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 flex flex-col gap-4">
              <div className="flex justify-between items-center pb-2 border-b border-zinc-100 dark:border-zinc-800">
                <div>
                  <h3 className="font-extrabold text-base sm:text-lg text-zinc-900 dark:text-white tracking-tight">
                    Matéria-Prima B2B (Frutos In Natura)
                  </h3>
                  <p className="text-xs text-zinc-500">Controle preço por lata, estoque e foto do produto base para batedeiras.</p>
                </div>
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800/40">
                  Base Oficial B2B
                </span>
              </div>

              {(() => {
                const isLataAvail = currentUser?.availabilityB2B?.lata !== false;
                const lataPhoto = currentUser?.imagesB2B?.lata || 'https://images.unsplash.com/photo-1628557044797-f21a177c37ec?auto=format&fit=crop&w=400&q=80';
                return (
                  <div className={`p-4 rounded-xl border transition flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${
                    isLataAvail 
                      ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60' 
                      : 'bg-zinc-100/70 dark:bg-zinc-900/40 border-zinc-200 dark:border-zinc-800 opacity-70'
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
                        className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 overflow-hidden shrink-0 border border-emerald-300 dark:border-emerald-700 cursor-pointer flex items-center justify-center relative group shadow-xs"
                        title="Trocar Foto da Lata"
                      >
                        <img src={lataPhoto} alt="Lata Açaí" className="w-full h-full object-cover group-hover:scale-105 transition" />
                        <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold transition">
                          <Camera size={16} />
                        </span>
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-extrabold text-base sm:text-lg text-zinc-950 dark:text-white leading-tight">
                            Paneiro / Lata de Açaí (In Natura)
                          </h4>
                          {!isLataAvail && (
                            <span className="text-[10px] bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400 font-extrabold px-1.5 py-0.5 rounded uppercase">
                              Esgotado
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-zinc-500">Frutos in natura padrão (por lata)</p>

                        {/* PREÇO COM EDIÇÃO INLINE OU DISPLAY */}
                        {editingInlineLataPrice ? (
                          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            <span className="text-xs font-extrabold text-zinc-500">R$</span>
                            <input
                              type="number"
                              step="1"
                              autoFocus
                              value={inlineLataPriceInput}
                              onChange={e => setInlineLataPriceInput(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') handleSaveInlineLataPrice();
                                if (e.key === 'Escape') setEditingInlineLataPrice(false);
                              }}
                              className="w-22 bg-white dark:bg-zinc-900 border-2 border-emerald-500 rounded-xl px-2 py-1 text-sm font-black text-zinc-900 dark:text-white outline-none shadow-xs"
                            />
                            <button
                              type="button"
                              onClick={handleSaveInlineLataPrice}
                              className="w-8 h-8 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl flex items-center justify-center font-black shadow-sm cursor-pointer active:scale-95 shrink-0"
                              title="Confirmar Preço"
                            >
                              <Check size={16} strokeWidth={3} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingInlineLataPrice(false)}
                              className="w-8 h-8 bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 text-zinc-700 dark:text-zinc-200 rounded-xl flex items-center justify-center font-black cursor-pointer active:scale-95 shrink-0"
                              title="Cancelar"
                            >
                              <X size={16} strokeWidth={3} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 mt-0.5">
                            <span 
                              onClick={handleStartInlineLataEdit}
                              className="text-base sm:text-lg font-black text-zinc-950 dark:text-white tracking-tight cursor-pointer hover:text-emerald-600 dark:hover:text-emerald-400 transition"
                              title="Clique para alterar preço da lata"
                            >
                              {formatMoney(b2bPrice)}
                            </span>
                            <span className="text-xs font-normal text-zinc-400">/ lata</span>
                            <button
                              type="button"
                              onClick={handleStartInlineLataEdit}
                              className="p-1.5 px-2 bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200 rounded-lg text-xs font-black transition cursor-pointer active:scale-95 flex items-center gap-1 shadow-2xs"
                              title="Editar este preço"
                            >
                              <span>✏️</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
                      <button
                        type="button"
                        onClick={() => {
                          if (currentUser) store.toggleB2BAvailability(currentUser.id);
                        }}
                        className={`px-4 py-2 rounded-xl text-xs font-bold border transition shadow-xs cursor-pointer active:scale-95 ${
                          isLataAvail
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200 dark:bg-emerald-900/60 dark:border-emerald-700 dark:text-emerald-200'
                            : 'bg-red-100 text-red-800 border-red-300 hover:bg-red-200 dark:bg-red-950 dark:border-red-800 dark:text-red-300'
                        }`}
                      >
                        {isLataAvail ? '🟢 Fruto Disponível' : '🔴 Fruto Esgotado'}
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Card 3: PRODUTOS EXTRAS & INSUMOS B2B - VISÃO LARGA E AMPLA */}
            <div className="bg-white dark:bg-zinc-900 p-5 sm:p-6 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 flex flex-col gap-4">
              {/* Header com Totais e Ações Rápidas em Lote */}
              <div className="border-b border-zinc-100 dark:border-zinc-800 pb-3 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <PackageOpen className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    <h3 className="font-extrabold text-zinc-900 dark:text-zinc-100 text-base sm:text-lg uppercase tracking-tight">
                      Produtos & Insumos Extras B2B
                    </h3>
                    <span className="bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 font-black text-xs px-2.5 py-0.5 rounded-full">
                      {(currentUser?.products || []).length} { (currentUser?.products || []).length === 1 ? 'item' : 'itens' }
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">
                    Sacas de frutos selecionados, açaí branco, polpas concentradas, paneiros e insumos com controle de estoque.
                  </p>
                </div>

                {/* Ações e Botão Novo Item B2B */}
                <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                  {(currentUser?.products?.length || 0) > 0 && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleBulkToggleExtras(true)}
                        className="px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 text-xs font-bold flex items-center gap-1.5 transition shadow-xs active:scale-95 cursor-pointer"
                        title="Marcar todos os produtos extras como disponíveis"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Todos Disponíveis
                      </button>
                      <button
                        type="button"
                        onClick={() => handleBulkToggleExtras(false)}
                        className="px-3 py-2 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 hover:bg-red-100 text-xs font-bold flex items-center gap-1.5 transition shadow-xs active:scale-95 cursor-pointer"
                        title="Pausar todos os extras"
                      >
                        <XCircle className="w-4 h-4" />
                        Todos Esgotados
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowAddB2BForm(prev => !prev)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95 ${
                      showAddB2BForm
                        ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-300'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    }`}
                  >
                    {showAddB2BForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    <span>{showAddB2BForm ? 'Fechar Cadastro' : '+ Novo Item B2B'}</span>
                  </button>
                </div>
              </div>

              {/* Bloco Retrátil: Presets B2B + Formulário de Cadastro */}
              {showAddB2BForm && (
                <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
              {/* Sugestões Rápidas de 1 Clique (Presets B2B) */}
              <div className="bg-gradient-to-br from-emerald-50/80 via-teal-50/40 to-zinc-50 dark:from-emerald-950/40 dark:via-zinc-900 dark:to-zinc-950 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-900/50">
                <div className="flex items-center gap-1.5 mb-2.5">
                  <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="text-xs font-black text-emerald-900 dark:text-emerald-300 uppercase tracking-wider">
                    Adicionar Rápido com 1 Clique (Sugestões B2B)
                  </span>
                </div>

                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto pr-1">
                  {[
                    { name: 'Saca de Açaí de Várzea (50kg)', price: 280, description: 'Frutos frescos colhidos no mesmo dia direto dos ribeirinhos de várzea' },
                    { name: 'Saca de Açaí Selecionado (50kg)', price: 340, description: 'Frutos graúdos de alto rendimento para batedeiras e indústrias' },
                    { name: 'Saca de Açaí Branco Raro (50kg)', price: 420, description: 'Frutos raros de açaí branco da Amazônia para cardápios premium' },
                    { name: 'Polpa de Açaí Puro B2B (10kg)', price: 160, description: 'Polpa concentrada 100% pura congelada sem adição de água' },
                    { name: 'Paneiros de Palha Vazios (Fardo c/ 10)', price: 50, description: 'Paneiros artesanais tradicionais para transporte e armazenamento' },
                    { name: 'Gelo em Barra para Transporte (20kg)', price: 25, description: 'Barras de gelo para conservação térmica do fruto na viagem' },
                  ].map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setNewProductName(preset.name);
                        setNewProductPrice(preset.price.toString());
                        setNewProductDesc(preset.description || '');
                      }}
                      className="group flex items-center gap-2 bg-white dark:bg-zinc-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 border border-emerald-200/90 dark:border-emerald-800/60 hover:border-emerald-400 px-3 py-2 rounded-xl text-xs font-bold text-zinc-800 dark:text-zinc-200 transition shadow-xs hover:shadow-sm cursor-pointer active:scale-95"
                      title={`Clique para preencher "${preset.name}" por R$ ${preset.price.toFixed(2)}`}
                    >
                      <Package className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{preset.name}</span>
                      <span className="font-black text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded-md text-[11px]">
                        R$ {preset.price.toFixed(2)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Form de Cadastro Amplo */}
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  handleAddProduct();
                }}
                className="bg-zinc-50 dark:bg-zinc-950/80 p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col gap-2.5"
              >
                <div className="flex flex-col sm:flex-row gap-2.5 items-center w-full">
                  <button
                    type="button"
                    onClick={() => setPhotoModalData({
                      open: true,
                      title: 'Foto do Produto B2B',
                      category: 'b2b',
                      currentUrl: newProductImage,
                      onSelect: (url) => setNewProductImage(url)
                    })}
                    className="w-full sm:w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/60 hover:bg-emerald-200 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0 border border-emerald-300 dark:border-emerald-700 transition cursor-pointer"
                    title="Escolher Foto do Produto"
                  >
                    {newProductImage ? (
                      <img src={newProductImage} alt="Foto" className="w-full h-full object-cover rounded-xl" />
                    ) : (
                      <Camera size={18} />
                    )}
                  </button>
                  <div className="relative flex-1 w-full">
                    <input 
                      type="text" 
                      placeholder="Nome do produto extra B2B (ex: Saca de Fruto Selecionado, Polpa 10kg...)" 
                      value={newProductName} 
                      onChange={e => setNewProductName(e.target.value)} 
                      className="w-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded-xl py-3 px-3.5 text-xs sm:text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-medium" 
                    />
                    {newProductName && (
                      <button
                        type="button"
                        onClick={() => setNewProductName('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 text-xs"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <div className="relative w-full sm:w-36">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-400">R$</span>
                    <input 
                      type="number" 
                      step="0.01" 
                      placeholder="0,00" 
                      value={newProductPrice} 
                      onChange={e => setNewProductPrice(e.target.value)} 
                      className="w-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded-xl py-3 pl-8 pr-3 text-xs sm:text-sm font-black outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-zinc-900 dark:text-white" 
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2.5 items-center w-full">
                  <input 
                    type="text" 
                    placeholder="Descrição / Detalhes (ex: Frutos colhidos em Igarapé-Miri com polpa grossa...)" 
                    value={newProductDesc} 
                    onChange={e => setNewProductDesc(e.target.value)} 
                    className="flex-1 w-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded-xl py-2 px-3 text-xs outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-zinc-600 dark:text-zinc-300" 
                  />
                  <button 
                    type="submit" 
                    className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-5 py-2.5 rounded-xl text-xs transition shadow-sm flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shrink-0"
                  >
                    <Plus size={14} />
                    <span>Adicionar Produto</span>
                  </button>
                </div>
              </form>
                </div>
              )}

              {/* Barra de Filtros e Busca */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2.5 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <div className="relative w-full sm:w-64">
                  <input
                    type="text"
                    value={extraSearchQuery}
                    onChange={(e) => setExtraSearchQuery(e.target.value)}
                    placeholder="Buscar nos produtos B2B..."
                    className="w-full pl-8 pr-7 py-1.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs outline-none focus:border-emerald-500"
                  />
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                  {extraSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setExtraSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 text-xs font-bold"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
                  <button
                    type="button"
                    onClick={() => setExtraFilterStatus('all')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                      extraFilterStatus === 'all'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200'
                    }`}
                  >
                    Todos ({(currentUser?.products || []).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setExtraFilterStatus('available')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                      extraFilterStatus === 'available'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-white dark:bg-zinc-900 text-emerald-700 dark:text-emerald-400 border border-zinc-200 dark:border-zinc-800'
                    }`}
                  >
                    🟢 Disponíveis ({(currentUser?.products || []).filter((p: any) => p.isAvailable !== false).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setExtraFilterStatus('unavailable')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                      extraFilterStatus === 'unavailable'
                        ? 'bg-red-600 text-white shadow-xs'
                        : 'bg-white dark:bg-zinc-900 text-red-700 dark:text-red-400 border border-zinc-200 dark:border-zinc-800'
                    }`}
                  >
                    🔴 Esgotados ({(currentUser?.products || []).filter((p: any) => p.isAvailable === false).length})
                  </button>
                </div>
              </div>

              {/* Grid de Cards de Produtos Extras B2B */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 max-h-[580px] overflow-y-auto pr-1">
                {[...(currentUser?.products || [])]
                  .filter((p: any) => {
                    if (extraFilterStatus === 'available' && p.isAvailable === false) return false;
                    if (extraFilterStatus === 'unavailable' && p.isAvailable !== false) return false;
                    if (extraSearchQuery.trim()) {
                      const q = extraSearchQuery.toLowerCase().trim();
                      return p.name.toLowerCase().includes(q);
                    }
                    return true;
                  })
                  .sort((a: any, b: any) => ((b.isAvailable !== false ? 1 : 0) - (a.isAvailable !== false ? 1 : 0)))
                  .map((p: any) => {
                    const isAvail = p.isAvailable !== false;
                    const isEditingExtraThis = editingExtraPriceId === p.id;
                    return (
                      <div 
                        key={p.id} 
                        className={`p-3.5 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                          isAvail
                            ? 'bg-white dark:bg-zinc-900/90 border-zinc-200 dark:border-zinc-800 hover:border-emerald-300 dark:hover:border-emerald-700/60 shadow-xs hover:shadow-md'
                            : 'bg-zinc-50 dark:bg-zinc-950/60 border-zinc-200/60 dark:border-zinc-800/60 opacity-60'
                        }`}
                      >
                        {/* Topo do Card: Foto + Nome + Preço */}
                        <div className="flex items-center gap-3 min-w-0">
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
                            className="w-14 h-14 rounded-xl bg-zinc-100 dark:bg-zinc-800 overflow-hidden shrink-0 border border-zinc-200 dark:border-zinc-700 cursor-pointer flex items-center justify-center hover:opacity-80 transition relative group"
                            title="Clique para alterar foto"
                          >
                            {p.imageUrl ? (
                              <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition" />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center text-emerald-700 dark:text-emerald-300 text-xs font-bold">
                                <span>📸</span>
                                <span className="text-[8px]">Foto</span>
                              </div>
                            )}
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-bold">
                              <Camera size={14} />
                            </div>
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className={`font-extrabold text-sm sm:text-base leading-tight line-clamp-2 ${isAvail ? 'text-zinc-900 dark:text-white' : 'text-zinc-400 line-through'}`} title={p.name}>
                              {p.name}
                            </p>

                            {/* PREÇO COM EDIÇÃO INLINE IDÊNTICA AO PRODUTO PRINCIPAL */}
                            {isEditingExtraThis ? (
                              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                <span className="text-xs font-extrabold text-zinc-500">R$</span>
                                <input
                                  type="number"
                                  step="0.5"
                                  autoFocus
                                  value={inlineExtraPriceInput}
                                  onChange={e => setInlineExtraPriceInput(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') handleSaveExtraInlinePrice(p.id);
                                    if (e.key === 'Escape') setEditingExtraPriceId(null);
                                  }}
                                  className="w-20 bg-white dark:bg-zinc-900 border-2 border-emerald-500 rounded-xl px-2 py-1 text-sm font-black text-zinc-900 dark:text-white outline-none shadow-xs"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSaveExtraInlinePrice(p.id)}
                                  className="w-8 h-8 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl flex items-center justify-center font-black shadow-sm cursor-pointer active:scale-95 shrink-0"
                                  title="Confirmar Preço"
                                >
                                  <Check size={16} strokeWidth={3} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingExtraPriceId(null)}
                                  className="w-8 h-8 bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 text-zinc-700 dark:text-zinc-200 rounded-xl flex items-center justify-center font-black cursor-pointer active:scale-95 shrink-0"
                                  title="Cancelar"
                                >
                                  <X size={16} strokeWidth={3} />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 mt-0.5">
                                <span 
                                  onClick={() => handleStartExtraInlineEdit(p.id, p.price)}
                                  className="text-base sm:text-lg font-black text-emerald-700 dark:text-emerald-400 tracking-tight cursor-pointer hover:underline"
                                  title="Clique para alterar preço"
                                >
                                  R$ {p.price.toFixed(2)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleStartExtraInlineEdit(p.id, p.price)}
                                  className="p-1.5 px-2 bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200 rounded-lg text-xs font-black transition cursor-pointer active:scale-95 flex items-center gap-1 shadow-2xs"
                                  title="Editar este preço"
                                >
                                  <span>✏️</span>
                                </button>
                              </div>
                            )}

                            {p.description && (
                              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-1 mt-1 leading-snug italic" title={p.description}>
                                {p.description}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Rodapé do Card: Switch de Disponibilidade + Botões de Ação ao Lado do Produto */}
                        <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800/80 gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (currentUser) store.toggleProductAvailability(currentUser.id, p.id);
                            }}
                            className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-black border transition shadow-xs flex items-center justify-center gap-1 cursor-pointer active:scale-95 ${
                              isAvail
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:border-emerald-700'
                                : 'bg-red-50 text-red-700 border-red-300 hover:bg-red-100 dark:bg-red-950/40 dark:border-red-700'
                            }`}
                          >
                            {isAvail ? '🟢 Disponível' : '🔴 Esgotado'}
                          </button>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button 
                              type="button"
                              onClick={() => handleOpenEditProduct(p)} 
                              className="px-2.5 py-1.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 rounded-xl border border-emerald-200 dark:border-emerald-800/60 text-xs font-bold transition shadow-xs cursor-pointer active:scale-95 flex items-center gap-1" 
                              title="Editar detalhes e foto"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span className="text-[11px]">Detalhes</span>
                            </button>
                            <button 
                              type="button"
                              onClick={() => { if (confirm(`Deseja excluir "${p.name}"?`)) store.removeProduct(currentUser.id, p.id); }} 
                              className="text-red-500 hover:text-red-700 p-1.5 bg-red-50 dark:bg-red-900/30 rounded-xl border border-red-200 dark:border-red-800/60 transition shadow-xs cursor-pointer active:scale-95" 
                              title="Excluir produto"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>

              {(!currentUser?.products || currentUser.products.length === 0) && (
                <div className="text-center py-8 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800">
                  <PackageOpen className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
                  <p className="text-xs text-zinc-500 font-medium">Nenhum produto extra B2B cadastrado ainda.</p>
                  <p className="text-[11px] text-zinc-400 mt-0.5">Use as sugestões rápidas acima para cadastrar sacas e polpas com 1 clique.</p>
                </div>
              )}
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
              onBalanceLoaded={setServerBalance}
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

      {/* Modal de Edição de Produto Extra B2B */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-lg shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[88vh]">
            <div className="p-3.5 sm:p-4 bg-emerald-600 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-emerald-100" />
                <h3 className="font-extrabold text-sm sm:text-base">
                  Editar Produto B2B
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 overscroll-contain">
              {/* Foto do Produto */}
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5 uppercase tracking-wider">
                  Foto do Produto
                </label>
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-xl bg-zinc-100 dark:bg-zinc-800 overflow-hidden border border-zinc-200 dark:border-zinc-700 flex items-center justify-center shrink-0">
                    {editingProduct.imageUrl ? (
                      <img src={editingProduct.imageUrl} alt={editingProduct.name} className="w-full h-full object-cover" />
                    ) : (
                      <Package className="w-6 h-6 text-zinc-400" />
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5 flex-1">
                    <button
                      type="button"
                      onClick={() => setPhotoModalData({
                        open: true,
                        title: `Foto de ${editingProduct.name}`,
                        category: 'b2b',
                        currentUrl: editingProduct.imageUrl,
                        onSelect: (url) => setEditingProduct(prev => prev ? { ...prev, imageUrl: url } : null)
                      })}
                      className="px-3 py-1.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 border border-emerald-200 dark:border-emerald-800 cursor-pointer"
                    >
                      <Camera size={13} />
                      <span>Alterar Foto</span>
                    </button>
                    {editingProduct.imageUrl && (
                      <button
                        type="button"
                        onClick={() => setEditingProduct(prev => prev ? { ...prev, imageUrl: undefined } : null)}
                        className="text-red-500 hover:text-red-700 text-[11px] font-semibold text-left px-1 cursor-pointer"
                      >
                        Remover foto
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Nome */}
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1 uppercase tracking-wider">
                  Nome do Produto
                </label>
                <input
                  type="text"
                  value={editingProduct.name}
                  onChange={(e) => setEditingProduct(prev => prev ? { ...prev, name: e.target.value } : null)}
                  className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-xl text-sm font-semibold outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  placeholder="Nome do produto"
                />
              </div>

              {/* Descrição */}
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1 uppercase tracking-wider">
                  Descrição / Detalhes
                </label>
                <textarea
                  rows={3}
                  value={editingProduct.description || ''}
                  onChange={(e) => setEditingProduct(prev => prev ? { ...prev, description: e.target.value } : null)}
                  className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-xl text-xs sm:text-sm font-medium outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 resize-none leading-relaxed"
                  placeholder="Ex: Sacas com 50kg colhidas no mesmo dia..."
                />
              </div>

              {/* Preço com Botões de Ajuste Rápido */}
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1 uppercase tracking-wider">
                  Preço de Venda (R$)
                </label>
                <div className="relative mb-2">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-zinc-400">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={editingProduct.price}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setEditingProduct(prev => prev ? { ...prev, price: isNaN(val) ? 0 : val } : null);
                    }}
                    className="w-full pl-10 pr-3 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-xl text-base font-black outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                {/* Ajustes rápidos de preço */}
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-[10px] font-bold text-zinc-400 mr-1">Ajuste rápido:</span>
                  {[
                    { label: '+R$ 5', delta: 5 },
                    { label: '+R$ 10', delta: 10 },
                    { label: '+R$ 20', delta: 20 },
                    { label: '+R$ 50', delta: 50 },
                    { label: '-R$ 10', delta: -10 },
                  ].map((btn, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setEditingProduct(prev => {
                          if (!prev) return null;
                          const newP = Math.max(0, Number((prev.price + btn.delta).toFixed(2)));
                          return { ...prev, price: newP };
                        });
                      }}
                      className="px-2 py-1 rounded-md text-[11px] font-extrabold bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 transition cursor-pointer active:scale-95"
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Switch de Disponibilidade */}
              <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">Disponibilidade no Catálogo</p>
                  <p className="text-[11px] text-zinc-500">Batedeiras só podem pedir se estiver disponível.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingProduct(prev => prev ? { ...prev, isAvailable: !prev.isAvailable } : null)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                    editingProduct.isAvailable !== false
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300'
                      : 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950/60 dark:text-red-300'
                  }`}
                >
                  {editingProduct.isAvailable !== false ? '🟢 Disponível' : '🔴 Esgotado'}
                </button>
              </div>
            </div>

            {/* Rodapé Fixo com Ações */}
            <div className="p-3 sm:p-4 bg-zinc-50 dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-2 shrink-0 sticky bottom-0 z-10 shadow-lg">
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveEditProduct}
                className="px-5 py-2.5 rounded-xl text-xs sm:text-sm font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition active:scale-95 cursor-pointer flex items-center gap-1.5"
              >
                <Check size={14} />
                <span>Salvar Alterações</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {priceModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col">
            <div className="bg-emerald-900 text-white p-5 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-2">
                  <Edit3 size={18} className="text-emerald-400" />
                  <h3 className="font-bold text-lg">Editar Preço da Lata Açaí</h3>
                </div>
                <button onClick={() => setPriceModalOpen(false)} className="text-white hover:text-red-300 font-bold text-2xl leading-none cursor-pointer">&times;</button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                  <label className="text-xs uppercase text-zinc-500 font-bold">Lote/Paneiro B2B (R$)</label>
                  <input type="number" step="0.1" value={b2bPrice} onChange={e => setB2bPrice(Number(e.target.value))} className="w-full border border-zinc-300 dark:border-zinc-700 bg-transparent rounded-lg p-3 outline-none focus:ring-2 focus:ring-emerald-500 mt-1 font-bold text-lg"/>
              </div>
            </div>

            <div className="p-5 bg-zinc-50 dark:bg-zinc-900/50 flex justify-end gap-3 border-t border-zinc-200 dark:border-zinc-800">
                <button onClick={() => setPriceModalOpen(false)} className="px-5 py-2.5 text-zinc-600 bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 rounded-xl font-bold transition cursor-pointer">Cancelar</button>
                <button onClick={handleSavePrices} className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition cursor-pointer active:scale-95">Salvar Preço</button>
            </div>
          </div>
        </div>
      )}
      {/* Modal de Configuração de Impressora Térmica & Bluetooth */}
      <ThermalPrinterModal
        isOpen={printerModalOpen}
        onClose={() => setPrinterModalOpen(false)}
        storeName={currentUser?.name || 'Fornecedor AçaíFood'}
      />

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
          initialMode={chatModalData.initialMode || 'chat'}
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
      
      <div className="mt-12 mb-6 flex flex-col items-center justify-center">
        <AppSolutionsBrandCard />
      </div>
      <AsaasPartnerBadge variant="footer" className="mt-4 mb-4" />
    </PartnerDashboardLayout>
  );
}
