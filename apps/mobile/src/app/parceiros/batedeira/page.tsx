"use client";

import React, { useState, useEffect, useRef, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Store, Printer, BookOpen } from "lucide-react";
import { useAppStore, haversineKm, getRatesForCity, generateUUID, getDailyWithdrawalCount, incrementDailyWithdrawalCount } from "@/store/useAppStore";
import { MapModal, MapPoint } from "@/components/MapModal";
import { supabase } from "@/lib/supabase";
import { PixModal, PixModalData } from "@/components/PixModal";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PartnerManualModal } from "@/components/PartnerManualModal";
import { OrderChatModal } from "@/components/OrderChatModal";
import { PhotoPickerModal } from "@/components/PhotoPickerModal";
import {
  getPrinterConfig,
  savePrinterConfig,
  printOrderTicket,
  printTestTicket,
  DEFAULT_PRINTER_CONFIG,
  PrinterConfig,
} from "@/lib/thermalPrinter";

const emptySubscribe = () => () => {};

export default function BatedeiraDashboard() {
  const router = useRouter();
  const store = useAppStore();
  const currentUser = store.currentUser;
  
  const [mapModal, setMapModal] = useState<{
    open: boolean;
    origem: MapPoint | null;
    destino: MapPoint | null;
    motorista?: MapPoint | null;
  }>({ open: false, origem: null, destino: null, motorista: null });
  const [pixModalData, setPixModalData] = useState<PixModalData>({ open: false });
  const [chatModalData, setChatModalData] = useState<{ open: boolean; orderId: string; otherName?: string; otherPhone?: string; otherRole?: string }>({ open: false, orderId: "" });
  const [subsidyInput, setSubsidyInput] = useState(() => currentUser?.freteSubsidyPct?.toString() || "0");
  const [priceModalOpen, setPriceModalOpen] = useState(false);
  const [prices, setPrices] = useState(() => currentUser?.priceB2C || { popular: 18, medio: 25, grosso: 33 });

  const [photoModalData, setPhotoModalData] = useState<{
    open: boolean;
    title: string;
    category?: 'acai' | 'adicional' | 'b2b';
    currentUrl?: string;
    onSelect: (url?: string) => void;
  }>({ open: false, title: '', onSelect: () => {} });
  const [newProductImage, setNewProductImage] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (currentUser?.priceB2C) {
      setPrices(currentUser.priceB2C);
    }
  }, [currentUser?.priceB2C]);

  useEffect(() => {
    if (currentUser?.freteSubsidyPct !== undefined) {
      setSubsidyInput(currentUser.freteSubsidyPct.toString());
    }
  }, [currentUser?.freteSubsidyPct]);
  const [activeTab, setActiveTab] = useState('pedidos');

  const [printerConfig, setPrinterConfig] = useState<PrinterConfig>(getPrinterConfig);
  const [printerModalOpen, setPrinterModalOpen] = useState(false);
  const printedOrdersRef = useRef<Set<string>>(new Set());

  const [newProductName, setNewProductName] = useState('');
  const [newProductPrice, setNewProductPrice] = useState('');
  const [cartModalB2B, setCartModalB2B] = useState<{ open: boolean; fornId: string; quantity: number; productId: string }>({ open: false, fornId: '', quantity: 1, productId: 'base' });
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [payingOrderId, setPayingOrderId] = useState<string | null>(null);
  const [partnerManualOpen, setPartnerManualOpen] = useState(false);

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

  useEffect(() => {
    if (!currentUser?.id) return;
    // Initial forced fetch on mount. Subsequent updates come via Supabase Realtime channel.
    store.fetchOrders(currentUser.id, true);
  }, [currentUser?.id]);

  useEffect(() => {
    const activeConfig = getPrinterConfig();
    if (!mounted || !activeConfig.enabled || activeConfig.printMode !== 'auto' || !currentUser) return;

    const mySfIds = ((currentUser as any)?.storefronts || []).map((s: any) => s.id);

    for (const order of store.orders) {
      if (order.type !== 'B2C') continue;
      const isMyStore = order.lojaId === currentUser.id || 
                        order.origemId === currentUser.id || 
                        (order as any).seller_storefront_id === currentUser.id || 
                        (order as any).sellerStorefrontId === currentUser.id || 
                        (mySfIds.length > 0 && (mySfIds.includes(order.lojaId) || mySfIds.includes(order.origemId) || mySfIds.includes((order as any).seller_storefront_id))) ||
                        ((order.lojaNome || '').toLowerCase().trim() === (currentUser.name || '').toLowerCase().trim());

      if (!isMyStore) continue;

      // 1. Cupom de Preparo (ao aceitar o pedido para preparar)
      if (order.status === 'preparo' && !printedOrdersRef.current.has(`${order.id}-PREPARO`)) {
        printedOrdersRef.current.add(`${order.id}-PREPARO`);
        printOrderTicket(order, currentUser.name || order.lojaNome || 'Loja/Batedeira AçaíFood', activeConfig, store.users, null, 'PREPARO', 'SYSTEM');
      }

      // 2. Cupom de Entrega (ao clicar em Chamar Moto)
      if (order.status === 'pronto' && !printedOrdersRef.current.has(`${order.id}-ENTREGA`)) {
        printedOrdersRef.current.add(`${order.id}-ENTREGA`);
        printOrderTicket(order, currentUser.name || order.lojaNome || 'Loja/Batedeira AçaíFood', activeConfig, store.users, null, 'ENTREGA', 'SYSTEM');
      }

      // 3. Cupom de Entrega Atualizado (reimpresso automaticamente assim que o motoboy aceitar a corrida)
      if (order.status === 'em_rota' && order.motoristaId && !printedOrdersRef.current.has(`${order.id}-ENTREGA_ATUALIZADO`)) {
        printedOrdersRef.current.add(`${order.id}-ENTREGA_ATUALIZADO`);
        printOrderTicket(order, currentUser.name || order.lojaNome || 'Loja/Batedeira AçaíFood', activeConfig, store.users, null, 'ENTREGA_ATUALIZADO', 'SYSTEM');
      }
    }

  }, [store.orders, currentUser, printerConfig, mounted, store.users]);


  const isPaused = currentUser?.status === 'paused';
  const handleToggleStatus = () => {
    if (!currentUser) return;
    store.updateUserStatus(currentUser.id, isPaused ? 'active' : 'paused');
  };

  const handleSavePrices = () => {
    if (!currentUser) return;
    store.updateUserPrice(currentUser.id, prices);
    setPriceModalOpen(false);
    alert('Preços atualizados com sucesso!');
  };

  const handleAddProduct = () => {
      if (!currentUser || !newProductName || !newProductPrice) return;
      store.addProduct(currentUser.id, {
          id: generateUUID(),
          name: newProductName,
          price: Number(newProductPrice),
          imageUrl: newProductImage,
          isAvailable: true
      });
      setNewProductName('');
      setNewProductPrice('');
      setNewProductImage(undefined);
  };

  const handleEditProduct = (p: any) => {
    if (!currentUser) return;
    const newName = prompt("Editar nome do produto extra:", p.name);
    if (newName === null) return;
    const newPriceStr = prompt("Editar preço do produto extra (R$):", p.price.toString());
    if (newPriceStr === null) return;
    const newPrice = parseFloat(newPriceStr.replace(',', '.'));
    if (isNaN(newPrice) || newPrice < 0) {
      alert("Preço inválido.");
      return;
    }
    const cleanName = newName.trim() || p.name;
    store.updateProduct(currentUser.id, p.id, { name: cleanName, price: newPrice });
  };

  const linkAsaasAccount = store.linkAsaasAccount;

  const handleLinkAsaas = async () => {
    if (!currentUser) return;
    const inputPix = prompt("Informe a sua Chave PIX (CPF, Celular, E-mail ou Aleatória) ou Carteira Asaas para receber os repasses:", currentUser.pixKey || currentUser.asaasWalletId || "");
    if (inputPix !== null && inputPix.trim() !== "") {
      await linkAsaasAccount(currentUser.id, inputPix.trim());
      alert("✅ Chave PIX / Carteira Asaas salva com sucesso! Repasses liberados.\n\n📲 Nota: Se você receber um SMS do Asaas com código de verificação, não se preocupe: sua conta no AçaíFood já está 100% ativa e pronta para receber!");
    }
  };

  const handleResgatarPix = async () => {
    if (!currentUser) return;
    const isRealUuid = (id?: string) => !!id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    let targetKey = currentUser.pixKey && !isRealUuid(currentUser.pixKey) ? currentUser.pixKey : (currentUser.cpfCnpj || currentUser.email);

    if (!targetKey || isRealUuid(targetKey)) {
      const inputPix = prompt("Informe a sua Chave PIX externa (CPF, Celular, E-mail ou Aleatória) para receber a transferência no seu banco:", currentUser.cpfCnpj || currentUser.email || "");
      if (inputPix && inputPix.trim()) {
        targetKey = inputPix.trim();
      } else {
        return;
      }
    }

    if (!vendasHoje || vendasHoje <= 0) {
      alert("Não há saldo disponível para saque no momento.");
      return;
    }

    const saquesHoje = getDailyWithdrawalCount(currentUser.id);
    if (saquesHoje >= 2) {
      alert("⚠️ Limite diário atingido:\n\nVocê já realizou 2 saques hoje (limite máximo permitido). Novos valores acumulados serão liquidados automaticamente no encerramento diário pelo administrador ou estarão disponíveis para novo saque amanhã.");
      return;
    }

    if (isWithdrawing) return;

    if (confirm(`Deseja transferir R$ ${vendasHoje.toFixed(2)} instantaneamente via PIX para a sua Chave Pix externa (${targetKey})?\n(Saque ${saquesHoje + 1} de no máximo 2 saques hoje)`)) {
      setIsWithdrawing(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const authHeaders: any = { 
          'Content-Type': 'application/json'
        };
        if (session?.access_token) {
          authHeaders['Authorization'] = `Bearer ${session.access_token}`;
        }

        const pendingOrders = meusPedidosAll.filter(o => (o.status === 'entregue' || o.status === 'arquivado') && o.type === 'B2C' && !o.payoutSellerDone);
        const pendingOrderIds = pendingOrders.map(o => o.id);

        const res = await fetch('/api/asaas/transfer', {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            pixKey: targetKey,
            value: vendasHoje,
            description: `Saque Instantâneo AçaíFood (${currentUser.name})`
          })
        });
        const data = await res.json();
        if (res.ok && (data.success || data.transferId)) {
          incrementDailyWithdrawalCount(currentUser.id);
          if (pendingOrderIds.length > 0) {
            await store.markPayoutDone(pendingOrderIds, 'seller');
          }
          alert(`✅ PIX enviado com sucesso!\nID da Transferência: ${data.transferId || 'concluída'}\nO valor de R$ ${vendasHoje.toFixed(2)} já está a caminho do seu banco (${targetKey}).`);
          store.fetchOrders(currentUser.id, true);
        } else {
          const msg = data.error || '';
          if (msg.includes('Saldo insuficiente')) {
            alert(`ℹ️ Saldo já creditado na Subconta Asaas:\nO valor de R$ ${vendasHoje.toFixed(2)} já consta na sua subconta Asaas oficial (${currentUser.asaasWalletId || 'Ativa'}).\nA varredura automática de repasse para o seu banco externo ocorrerá às ${rates.payout_time || '22:00'}.`);
          } else {
            alert(`Status do PIX Asaas: ${msg || 'Não foi possível processar a transferência no momento.'}`);
          }
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

      const { error } = await supabase.from('users').update({ latitude: lat, longitude: lng }).eq('id', currentUser.id);
      if (error) {
        alert("Erro ao atualizar no banco de dados: " + error.message);
      } else {
        alert("✅ GPS do estabelecimento atualizado com sucesso para as novas coordenadas!");
        const s = useAppStore.getState();
        s.fetchAllUsers(true);
      }
    } catch (err) {
      alert("Não foi possível capturar sua geolocalização. Certifique-se de que o GPS do aparelho está ativado e as permissões foram concedidas.");
    } finally {
      setIsUpdatingGPS(false);
    }
  };

  if (!mounted) {
    return <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 flex items-center justify-center"><p>Carregando...</p></div>;
  }

  const isLoja = currentUser && String(currentUser.role || '').toLowerCase() === 'loja';

  if (!isLoja) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 flex flex-col items-center justify-center p-6 text-center">
        <Store size={48} className="text-purple-600 mb-4" />
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">Acesso Restrito</h2>
        <p className="text-zinc-500 mb-6">Você precisa estar logado como Batedeira para acessar este painel.</p>
        <button onClick={() => router.push('/login')} className="bg-purple-600 text-white font-bold py-3 px-6 rounded-xl hover:bg-purple-700 transition">
          Fazer Login
        </button>
      </div>
    );
  }

  const rates = getRatesForCity(currentUser?.cidade, store.rates, store.cities) || store.rates;
  const formatMoney = (val: number) => (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const mySfIds = ((store.users[currentUser.id] as any)?.storefronts || []).map((s: any) => s.id);
  const meusPedidosAll = (store.orders || []).filter(o => {
    if (!currentUser?.id) return false;
    const targetSfId = (o as any).seller_storefront_id || (o as any).sellerStorefrontId;
    const isMyStore = o.lojaId === currentUser.id || 
                      o.origemId === currentUser.id || 
                      targetSfId === currentUser.id || 
                      (mySfIds.length > 0 && (mySfIds.includes(o.lojaId) || mySfIds.includes(o.origemId) || mySfIds.includes(targetSfId))) ||
                      (o.type === 'B2C' && o.lojaNome && currentUser.name && o.lojaNome.toLowerCase().trim() === currentUser.name.toLowerCase().trim());
    return isMyStore;
  });
  const vendasHoje = meusPedidosAll.filter(o => (o.status === 'entregue' || o.status === 'arquivado') && o.type === 'B2C' && !o.payoutSellerDone).reduce((acc, curr) => acc + (curr.taxas?.repasse || 0), 0);
  const saquesHoje = currentUser ? getDailyWithdrawalCount(currentUser.id) : 0;
  
  const batedeiraActiveOrders = meusPedidosAll.filter(o => 
    o.status !== 'aguardando_pagamento' && 
    o.status !== 'entregue' && 
    o.status !== 'cancelado' && 
    o.status !== 'arquivado'
  );
  const batedeiraHistoryOrders = meusPedidosAll.filter(o => o.status === 'entregue' || o.status === 'cancelado' || o.status === 'arquivado');
  const meusPedidos = [...batedeiraActiveOrders, ...batedeiraHistoryOrders];
  const fornecedores = Object.values(store.users || {})
    .filter(u => {
      if (u.role !== 'fornecedor' || u.status === 'paused' || u.status === 'blocked') return false;
      if (!u.cidade || !currentUser.cidade) return true; // Se alguma das partes estiver sem cidade, mostra mesmo assim para evitar sumiço
      const c1 = u.cidade.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      const c2 = currentUser.cidade.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      return c1 === c2;
    })
    .sort((a, b) => {
      const distA = (a.lat && currentUser.lat) ? haversineKm(a.lat, a.lng!, currentUser.lat, currentUser.lng!) : 999;
      const distB = (b.lat && currentUser.lat) ? haversineKm(b.lat, b.lng!, currentUser.lat, currentUser.lng!) : 999;
      return distA - distB;
    });
  
  const distColeta = (currentUser.lat && store.users?.ecoponto?.lat) ? haversineKm(currentUser.lat, currentUser.lng!, store.users.ecoponto.lat!, store.users.ecoponto.lng!) : 0;
  const freteColeta = (rates.ecopoint_payment_mode === 'FIXED') 
    ? (rates.ecopoint_fixed_fee ?? rates.col_valor ?? 50) 
    : (distColeta > 0 ? (distColeta * (rates.col_km || 0)) : (rates.ecopoint_fixed_fee ?? rates.col_valor ?? 50));

  const renderOrderCard = (o: any) => {
    const isCanceled = o.status === 'cancelado';
    
    let financeText = '';
    if (o.type === 'B2C') financeText = `Bruto: ${formatMoney(o.valor)} | Sub. Frete: ${formatMoney(o.taxas.entregaLoja)} | Líquido: ${formatMoney(o.taxas.repasse)}`;
    else if (o.type === 'B2B') financeText = `Custo Lata Açaí: ${formatMoney(o.valor)} | Frete Pago: ${formatMoney(o.taxas.entregaLoja)} | Gasto Total: ${formatMoney(o.valor + o.taxas.entregaLoja)}`;
    else if (o.type === 'COLETA') financeText = `Serviço Base: ${formatMoney(o.valor)} | Gasto Extra: ${formatMoney(-o.taxas.repasse - o.valor)} | Custo Total: ${formatMoney(-o.taxas.repasse)}`;

    return (
      <div key={o.id} className={`bg-white dark:bg-zinc-900 p-4 rounded-xl shadow-sm border border-l-4 ${isCanceled ? 'border-red-300 opacity-60 border-l-red-400' : (o.type === 'B2C' ? 'border-l-purple-500' : o.type === 'B2B' ? 'border-l-emerald-500' : 'border-l-amber-500')} flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4`}>
          <div className="w-full sm:w-auto">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${o.type === 'B2C' ? 'bg-purple-100 text-purple-700' : o.type === 'B2B' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{o.type}</span>
                  <span className="font-bold text-zinc-800 dark:text-white text-sm">{o.title}</span>
                  {o.createdAt && (
                    <span className="text-xs font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/30 px-2 py-0.5 rounded border border-purple-200 dark:border-purple-800">
                       📅 {new Date(o.createdAt).toLocaleDateString('pt-BR')} às {new Date(o.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </span>
                  )}
                  {!isCanceled && (
                    <button 
                      onClick={() => {
                        const lojaUser = store.users[o.lojaId!] || store.users[o.origemId];
                        const clienteId = o.clienteId || (o.type === 'B2C' ? o.criadoPor : undefined) || o.destinoId;
                        const clienteUser = store.users[clienteId] || store.users[o.destinoId];
                        const latOrigem = lojaUser?.lat || 0;
                        const lngOrigem = lojaUser?.lng || 0;
                        const latDestino = (o.deliveryLat && o.deliveryLat !== 0) 
                          ? o.deliveryLat 
                          : (clienteUser?.lat || (latOrigem ? latOrigem + 0.0045 : -1.455));
                        const lngDestino = (o.deliveryLng && o.deliveryLng !== 0) 
                          ? o.deliveryLng 
                          : (clienteUser?.lng || (lngOrigem ? lngOrigem + 0.0045 : -48.490));
                        const motoristaUser = o.motoristaId ? store.users[o.motoristaId] : null;
                        setMapModal({
                          open: true,
                          origem: { lat: latOrigem, lng: lngOrigem, name: o.lojaNome || lojaUser?.name || 'Retirada' },
                          destino: { lat: latDestino, lng: lngDestino, name: o.clienteNome || clienteUser?.name || 'Entrega' },
                          motorista: motoristaUser?.lat ? { lat: motoristaUser.lat, lng: motoristaUser.lng || 0, name: motoristaUser.name || 'Entregador', veiculo: motoristaUser.veiculo || 'moto' } : null
                        });
                      }} 
                      className="text-[10px] text-blue-500 hover:underline"
                    >
                      🗺️ {(o.distancia || 0).toFixed(1)} km
                    </button>
                  )}
              </div>
              <div className="text-xs text-zinc-700 dark:text-zinc-300 mb-1 font-bold flex flex-wrap items-center gap-3">
                  <span>
                    {o.type === 'B2C' ? `👤 Cliente: ${o.clienteNome || store.users[(o as any).buyerId!]?.name || store.users[o.destinoId]?.name || store.users[o.clienteId!]?.name || store.users[o.criadoPor]?.name || 'Cliente'}` :
                     o.type === 'B2B' ? `🏭 Fornecedor: ${store.users[o.origemId]?.name || '—'}` :
                     `🚛 Caçamba Ecoponto`}
                  </span>
                  <span className="text-zinc-400">|</span>
                  <span>
                    🛵 Entregador: {(() => {
                      const mUser = o.motoristaId ? store.users[o.motoristaId] : null;
                      const dName = o.motoristaNome || mUser?.name;
                      const isFinished = o.status === 'entregue' || o.status === 'cancelado' || o.status === 'arquivado' || !!o.receivedAt || !!o.deliveredAt;
                      return dName || (isFinished ? 'Concluído' : 'Aguardando');
                    })()}
                  </span>
              </div>
              <p className="text-xs text-zinc-500 mt-1">{financeText}</p>
              <div className="flex flex-wrap gap-2 mt-2 mb-2">
                 {o.createdAt && <span className="text-[9px] bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-2 py-0.5 rounded font-bold">🕒 Pedido: {new Date(o.createdAt).toLocaleDateString('pt-BR')} {new Date(o.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>}
                 {o.acceptedAt && <span className="text-[9px] bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded font-bold">👨‍🍳 Aceito: {new Date(o.acceptedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>}
                 {o.readyAt && <span className="text-[9px] bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-2 py-0.5 rounded font-bold">🛎️ Pronto: {new Date(o.readyAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>}
                 {o.pickedUpAt && <span className="text-[9px] bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded font-bold">📦 Retirada: {new Date(o.pickedUpAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>}
                 {o.deliveredAt && <span className="text-[9px] bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 px-2 py-0.5 rounded font-bold">📍 Chegou: {new Date(o.deliveredAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>}
                 {o.receivedAt && <span className="text-[9px] bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 px-2 py-0.5 rounded font-bold">✅ Recebido: {new Date(o.receivedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>}
              </div>

              {o.deliveryPin && !isCanceled && o.status !== 'entregue' && o.status !== 'arquivado' && o.type !== 'B2C' && (
                 <div className="mt-2 mb-2 bg-purple-900 dark:bg-purple-950 text-white p-3 rounded-lg flex items-center justify-between shadow-md border border-purple-700">
                     <div>
                         <p className="text-[10px] font-bold uppercase text-purple-300">🔑 PIN de Segurança</p>
                         <p className="text-[10px] text-purple-100 leading-tight">Forneça ao motorista na entrega/coleta</p>
                     </div>
                     <div className="text-xl font-black tracking-widest text-white bg-purple-950 px-3 py-1 rounded border border-purple-600">{o.deliveryPin}</div>
                 </div>
              )}
          </div>
          
          <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-end w-full sm:w-auto border-t sm:border-t-0 border-zinc-100 dark:border-zinc-800 pt-3 sm:pt-0 gap-2">
              {o.status === 'aguardando_pagamento' && (
                <div className="flex flex-col items-end gap-1.5 w-full sm:w-auto">
                  <span className="bg-amber-100 text-amber-800 px-2 py-1 rounded text-[10px] font-bold uppercase animate-pulse">⏳ Aguardando Pagamento Pix</span>
                  <div className="flex flex-wrap gap-1.5 justify-end w-full">
                    <button 
                      type="button"
                      onClick={() => {
                        const forn = store.users?.[o.origemId];
                        const dist = (forn?.lat && currentUser?.lat) ? haversineKm(forn.lat, forn.lng!, currentUser.lat, currentUser.lng!) : 0;
                        const freteTotal = dist * rates.b2b_km;
                        const subsidy = forn?.freteSubsidyPct || 0;
                        const freteLoja = freteTotal * (1 - subsidy / 100);
                        const totalToPay = (o.valor || 0) + freteLoja;

                        setPixModalData({
                          open: true,
                          qrCode: o.pixQrCode,
                          copiaECola: o.pixCopiaECola,
                          invoiceUrl: o.invoiceUrl,
                          orderId: o.id,
                          paymentId: (o as any).asaasPaymentId || (o as any).paymentId || (o as any).asaas_payment_id,
                          totalValue: totalToPay
                        });
                      }}
                      className="text-[10px] bg-purple-600 hover:bg-purple-700 text-white font-bold px-2.5 py-1.5 rounded-lg transition shadow-sm flex items-center gap-1"
                    >
                      ⚡ Pagar via Pix / Ver QR Code
                    </button>
                    <button 
                      onClick={async () => {
                        try {
                          const res = await fetch(`/api/asaas/status?orderId=${o.id}`);
                          if (res.ok) {
                            const data = await res.json();
                            if (data.isPaid) {
                              store.acaoPedido(o.id, 'confirmar_pagamento');
                              alert("✅ Pagamento identificado com sucesso no Asaas! Pedido liberado para preparo.");
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
                      onClick={() => {
                        if (confirm("Deseja realmente cancelar este pedido? Em caso de Pix já pago, o estorno automático será solicitado no Asaas.")) {
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
              {o.status === 'pendente' && (
                <div className="flex flex-col items-end gap-1">
                  <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-[10px] font-bold uppercase">Pagamento Aprovado</span>
                </div>
              )}
              {o.status === 'preparo' && <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-[10px] font-bold uppercase">Em Preparo</span>}
              {o.status === 'pronto' && <span className="bg-amber-100 text-amber-800 px-2 py-1 rounded text-[10px] font-bold uppercase">{o.type === 'B2B' ? '🚛 Aguardando Caminhão' : '🏍️ Aguardando Moto'}</span>}
              {o.status === 'em_rota' && <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-[10px] font-bold uppercase">Em Transporte</span>}
              {o.status === 'aguardando_cliente' && o.type === 'B2C' && <span className="bg-teal-100 text-teal-800 px-2 py-1 rounded text-[10px] font-bold uppercase">Aguardando Cliente Confirmar</span>}
              {o.status === 'aguardando_cliente' && o.type === 'B2B' && <span className="bg-teal-100 text-teal-800 px-2 py-1 rounded text-[10px] font-bold uppercase">Caminhão Chegou</span>}
              {(o.status === 'entregue' || o.status === 'arquivado') && (
                <div className="flex flex-col items-end gap-1">
                  <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-[10px] font-bold uppercase">Concluído</span>
                  {o.payoutSellerDone ? (
                    <span className="text-[10px] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-bold px-2 py-1 rounded border border-emerald-200 dark:border-emerald-800/60 shadow-sm flex items-center gap-1">
                      ✅ Repasse Liquidado (R$ {o.taxas?.repasse?.toFixed(2)})
                    </span>
                  ) : (
                    <span className="text-[10px] bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 font-bold px-2 py-1 rounded border border-purple-200 dark:border-purple-800/60 shadow-sm flex items-center gap-1">
                      ⏳ No Cofre Virtual (R$ {o.taxas?.repasse?.toFixed(2)})
                    </span>
                  )}
                </div>
              )}
              {o.status === 'cancelado' && <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-[10px] font-bold uppercase">Cancelado</span>}
              
              {isCanceled && (
                <button onClick={() => { if(confirm('Deseja excluir este pedido permanentemente?')) store.acaoPedido(o.id, 'deletar_pedido') }} className="text-xs bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold px-3 py-2 rounded-lg transition mt-2 sm:mt-0">🗑️ Excluir</button>
              )}

              {/* Interações */}
              {!isCanceled && o.type === 'B2C' && (o.status === 'pendente' || o.status === 'aguardando_pagamento') && (
                <div className="flex gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                    <button onClick={() => {
                      const reason = prompt("Informe o motivo da recusa do pedido:", "Impossibilidade de atendimento");
                      if (reason !== null && reason.trim() !== "") {
                        store.acaoPedido(o.id, 'cancelar_pedido', undefined, reason.trim());
                        alert("❌ Pedido recusado e estorno solicitado no Asaas.");
                      }
                    }} className="flex-1 sm:flex-none bg-red-100 hover:bg-red-200 text-red-700 text-xs font-bold px-3 py-2 rounded-lg transition">❌ Recusar</button>
                    <button onClick={() => {
                      store.acaoPedido(o.id, 'aceitar_loja');
                      const pConfig = getPrinterConfig();
                      if (pConfig.enabled && pConfig.printMode === 'auto') {
                        printOrderTicket(o, currentUser?.name || o.lojaNome || 'Loja/Batedeira AçaíFood', pConfig, store.users, null, 'PREPARO', 'SYSTEM');
                      }
                    }} className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-lg shadow">Aceitar e Preparar</button>
                </div>
              )}

              {!isCanceled && o.type === 'B2C' && o.status === 'preparo' && (
                <div className="flex gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                    <button onClick={() => {
                      const reason = prompt("Informe o motivo do cancelamento do pedido:", "Falta de insumos");
                      if (reason !== null && reason.trim() !== "") {
                        store.acaoPedido(o.id, 'cancelar_pedido', undefined, reason.trim());
                        alert("❌ Pedido cancelado e estorno solicitado no Asaas.");
                      }
                    }} className="bg-red-100 hover:bg-red-200 text-red-700 text-xs font-bold px-3 py-2 rounded-lg transition">❌ Cancelar</button>
                    <button onClick={() => store.acaoPedido(o.id, 'chamar_moto')} className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-4 py-2 rounded-lg shadow transition">🏍️ Chamar Moto</button>
                </div>
              )}
              
              {!isCanceled && (o.type === 'B2B' || o.type === 'COLETA') && (o.status === 'pendente' || (o.type === 'COLETA' && o.status === 'preparo' && !o.motoristaId)) && (
                <button onClick={() => {
                  const reason = prompt("Informe o motivo do cancelamento:", "Cancelamento pela loja");
                  if (reason !== null && reason.trim() !== "") {
                    store.acaoPedido(o.id, 'cancelar_pedido', undefined, reason.trim());
                    alert("❌ Pedido cancelado e estorno solicitado no Asaas.");
                  }
                }} className="bg-red-100 hover:bg-red-200 text-red-700 text-xs font-bold px-3 py-2 rounded-lg transition w-full sm:w-auto mt-2 sm:mt-0">❌ Cancelar</button>
              )}

              {!isCanceled && (
                <div className="flex flex-wrap gap-1.5 mt-2 sm:mt-0">
                  <button
                    type="button"
                    onClick={() => {
                      const pType = (o.status === 'em_rota' || o.status === 'entregue' || o.status === 'aguardando_cliente') ? 'ENTREGA_ATUALIZADO' : (o.status === 'pronto' ? 'ENTREGA' : 'PREPARO');
                      printOrderTicket(o, currentUser?.name || 'Loja/Batedeira AçaíFood', printerConfig, store.users, null, pType, 'MANUAL');
                    }}
                    className="text-xs bg-purple-100 hover:bg-purple-200 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 font-bold px-3 py-2 rounded-lg border border-purple-300 dark:border-purple-800 transition shadow-sm flex items-center gap-1 shrink-0 active:scale-95"
                    title="Imprimir cupom térmico deste pedido"
                  >
                    🖨️ Imprimir Cupom
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const isB2B = o.type === 'B2B';
                      const clienteUser = o.buyerId ? store.users[o.buyerId] : null;
                      const fornecedorUser = o.fornecedorId ? store.users[o.fornecedorId] : (o.origemId ? store.users[o.origemId] : null);
                      const motoristaUser = o.motoristaId ? store.users[o.motoristaId] : null;

                      const targetOther = motoristaUser || (isB2B ? fornecedorUser : clienteUser);
                      const targetRole = motoristaUser 
                        ? (isB2B ? 'Transporte' : 'Motoboy') 
                        : (isB2B ? 'Fornecedor' : 'Cliente');

                      setChatModalData({
                        open: true,
                        orderId: o.id,
                        otherName: targetOther?.name || (isB2B ? (o.lojaNome || 'Fornecedor') : (o.clienteNome || 'Cliente')),
                        otherPhone: (targetOther as any)?.phone || targetOther?.telefone || (isB2B ? o.lojaTelefone : o.clienteTelefone) || '',
                        otherRole: targetRole
                      });
                    }}
                    className="text-xs bg-purple-600 hover:bg-purple-700 text-white font-bold px-3 py-2 rounded-lg transition shadow-sm flex items-center gap-1 shrink-0"
                  >
                    💬 Chat & 📞 Voz
                  </button>
                </div>
              )}

              {!isCanceled && o.type === 'B2B' && o.status === 'em_rota' && (
                <span className="text-[10px] text-amber-600 font-bold bg-amber-50 px-2 py-1.5 rounded shadow-sm text-center">⏳ Aguardando caminhão</span>
              )}
          </div>
      </div>
    );
  };

  const handleSaveSubsidy = () => {
    store.setFreteSubsidy(currentUser.id, parseFloat(subsidyInput) || 0);
    alert('Subsídio salvo com sucesso!');
  };


  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 pb-24">
      <PartnerManualModal isOpen={partnerManualOpen} onClose={() => setPartnerManualOpen(false)} role="batedeira" />
      <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 p-4 sticky top-0 z-30">
        <div className="flex justify-between items-center max-w-5xl mx-auto">
          <div className="flex items-center gap-3">
            <Store className="text-purple-600" />
            <h1 className="text-xl font-bold text-zinc-900 dark:text-white">Painel da Loja</h1>
          </div>
          <div className="flex items-center gap-3">
            {currentUser.asaasLinked && (
               <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-1 rounded font-bold border border-purple-200 hidden sm:inline-block">Asaas Ativo ✅</span>
            )}
            <button 
              onClick={() => setPrinterModalOpen(true)} 
              className="text-xs bg-purple-100 hover:bg-purple-200 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 shadow-sm transition-all border border-purple-200 dark:border-purple-800"
              title="Configurar Impressora Térmica"
            >
              <Printer size={14} /> 🖨️ Impressora
            </button>
            <button onClick={() => window.location.reload()} className="text-xs bg-indigo-100 hover:bg-indigo-200 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 shadow-sm transition-all">🔄 Atualizar</button>
            <button onClick={() => setPartnerManualOpen(true)} className="text-xs bg-amber-100 hover:bg-amber-200 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 shadow-sm transition-all">
              <BookOpen size={13} /> Manual
            </button>

            <button onClick={() => { if(navigator.share) { navigator.share({title: 'AçaíFood', text: 'Conheça o AçaíFood!', url: window.location.origin}) } else { alert('Seu navegador não suporta compartilhamento.') } }} className="text-[10px] bg-purple-100 hover:bg-purple-200 text-purple-700 px-2 py-1 rounded font-bold">📲 Compartilhar</button>
            <ThemeToggle />
            <button onClick={() => { store.logout(); router.push('/login'); }} className="text-sm font-bold text-red-600 hover:text-red-800 underline">Sair</button>
          </div>
        </div>
      </header>
      
      <div className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 mb-6">
        <div className="max-w-5xl mx-auto px-4 flex gap-6 overflow-x-auto">
          <button onClick={() => setActiveTab('geral')} className={`py-4 px-2 font-bold text-sm border-b-2 transition whitespace-nowrap ${activeTab === 'geral' ? 'border-purple-600 text-purple-600' : 'border-transparent text-zinc-500 hover:text-zinc-800'}`}>📊 Visão Geral</button>
          <button onClick={() => setActiveTab('abastecimento')} className={`py-4 px-2 font-bold text-sm border-b-2 transition whitespace-nowrap ${activeTab === 'abastecimento' ? 'border-purple-600 text-purple-600' : 'border-transparent text-zinc-500 hover:text-zinc-800'}`}>🛒 Abastecimento B2B</button>
          <button onClick={() => setActiveTab('pedidos')} className={`py-4 px-2 font-bold text-sm border-b-2 transition whitespace-nowrap ${activeTab === 'pedidos' ? 'border-purple-600 text-purple-600' : 'border-transparent text-zinc-500 hover:text-zinc-800'}`}>📦 Histórico e Pedidos</button>
        </div>
      </div>

      <main className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">

        {!currentUser.asaasLinked && (
          <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-2xl p-6 text-center shadow-sm">
            <h3 className="text-purple-700 dark:text-purple-400 font-bold text-lg mb-2">Atenção: Vendas Bloqueadas!</h3>
            <p className="text-purple-600 dark:text-purple-300 text-sm mb-4">
              Para receber os repasses automáticos dos clientes via PIX ou Cartão com Split, informe ou vincule sua Carteira Asaas / Chave Pix.
            </p>
            <button 
              onClick={handleLinkAsaas}
              className="inline-block bg-purple-600 text-white font-bold py-3 px-6 rounded-xl shadow-md hover:bg-purple-700 transition"
            >
              🤝 Vincular Conta / Carteira Asaas
            </button>
            <p className="text-[11px] text-purple-500 dark:text-purple-400 opacity-80 mt-3">
              📲 <strong>Dica:</strong> Se você receber um SMS do Asaas com código de verificação, não se preocupe: a sua conta AçaíFood é ativada automaticamente via API!
            </p>
          </div>
        )}
        
        {/* Banner Cofre Virtual & Pix Automático (Sempre Visível) */}
        <div className="bg-purple-900 text-white p-5 rounded-2xl shadow flex justify-between items-center border border-purple-800">
            <div>
                <h2 className="text-xl font-bold">🏪 {currentUser.name}</h2>
                <p className="text-purple-300 text-xs mt-1">📍 Bairro: {currentUser.bairro || 'Central'}</p>
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <button 
                    onClick={handleUpdateGPS}
                    disabled={isUpdatingGPS}
                    className="text-[10px] bg-purple-800/80 hover:bg-purple-700 disabled:bg-purple-800/40 text-white font-bold px-2.5 py-1 rounded-lg border border-purple-700 transition shadow flex items-center gap-1 active:scale-95 disabled:scale-100 disabled:cursor-not-allowed"
                  >
                    {isUpdatingGPS ? '⏳ Buscando GPS...' : '📍 Atualizar GPS'}
                  </button>
                  <button 
                    onClick={async () => {
                      const currentPix = (currentUser.pixKey || (currentUser as any).pix_key || '').trim();
                      const newPix = prompt("Informe a sua Chave PIX (CPF, CNPJ, Celular, E-mail ou Chave Aleatória):", currentPix);
                      if (newPix === null) return;
                      const cleanPix = newPix.trim();
                      if (!cleanPix) {
                        alert("A Chave Pix não pode ser vazia.");
                        return;
                      }
                      try {
                        await store.updateUserPixKey(currentUser.id, cleanPix);
                        alert("✅ Sua Chave Pix foi atualizada com sucesso!");
                      } catch (err: any) {
                        alert("Erro ao salvar Chave Pix: " + err.message);
                      }
                    }}
                    className="text-[10px] bg-purple-800/90 hover:bg-purple-700 text-purple-200 hover:text-white font-bold px-2.5 py-1 rounded-lg border border-purple-600 transition shadow flex items-center gap-1 active:scale-95"
                    title="Clique para cadastrar ou trocar sua Chave Pix"
                  >
                    🔑 PIX: {(currentUser.pixKey || (currentUser as any).pix_key) ? (currentUser.pixKey || (currentUser as any).pix_key) : 'Cadastrar'} ✏️
                  </button>
                </div>
            </div>
            <div className="text-right flex flex-col items-end">
                <p className="text-xs text-purple-200">Cofre Virtual (A Receber)</p>
                <p className="text-2xl font-black text-green-400">{formatMoney(vendasHoje)}</p>
                <p className="text-[10px] text-purple-300 mt-1 font-bold">🗓️ Pix Automático: às {rates.payout_time || '22:00'}</p>
                {vendasHoje > 0 && saquesHoje < 2 && (
                  <button 
                    onClick={handleResgatarPix}
                    disabled={isWithdrawing}
                    className={`mt-2 text-xs ${isWithdrawing ? 'bg-gray-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700'} text-white font-bold px-3 py-1.5 rounded-lg transition shadow flex items-center gap-1`}
                  >
                    {isWithdrawing ? '⏳ Transferindo...' : `💸 Saque Instantâneo Pix (${saquesHoje + 1}/2)`}
                  </button>
                )}
                {saquesHoje >= 2 && vendasHoje > 0 && (
                  <p className="text-[10px] text-amber-300 mt-1.5 font-bold bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/60">
                    ⚠️ Limite diário de 2 saques atingido (retorna amanhã)
                  </p>
                )}
            </div>
        </div>

        {/* Alerta de Pedidos Ativos da Batedeira (Sempre Visível no Topo) */}
        {batedeiraActiveOrders.length > 0 && (
          <div className="bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-400 dark:border-amber-600 p-5 rounded-2xl shadow-lg space-y-4 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center justify-between border-b border-amber-200 dark:border-amber-800 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-xl animate-bounce">🚨</span>
                <h3 className="font-extrabold text-base text-amber-900 dark:text-amber-200 uppercase tracking-wider">
                  Pedidos Ativos em Andamento ({batedeiraActiveOrders.length})
                </h3>
              </div>
              <span className="text-xs bg-amber-200 text-amber-900 font-bold px-2.5 py-1 rounded-full uppercase">Ação Necessária</span>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {batedeiraActiveOrders.map(renderOrderCard)}
            </div>
          </div>
        )}

        {activeTab === 'geral' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in zoom-in-95 duration-300">
            {/* Controles da Loja e Status Geral */}
            <div className="col-span-1 md:col-span-2 bg-white dark:bg-zinc-900 p-5 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-zinc-100 dark:border-zinc-800">
                <div>
                  <h3 className="font-bold text-zinc-800 dark:text-zinc-100 text-sm uppercase flex items-center gap-2">
                    <span>🏪</span> Status de Funcionamento
                  </h3>
                  <p className="text-xs text-zinc-500">Abra ou feche sua loja para receber novos pedidos.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={handleToggleStatus} 
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm border flex items-center gap-1.5 ${
                      isPaused 
                        ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100 dark:bg-red-950/40 dark:border-red-800' 
                        : 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:border-emerald-800'
                    }`}
                  >
                    {isPaused ? '🔴 Loja Fechada' : '🟢 Loja Aberta (Recebendo Pedidos)'}
                  </button>
                  <button 
                    onClick={() => setPriceModalOpen(true)} 
                    className="bg-purple-100 hover:bg-purple-200 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm border border-purple-200 dark:border-purple-800"
                  >
                    ✏️ Editar Preços Base
                  </button>
                </div>
              </div>

              {/* AÇAÍ BASE (POPULAR, MÉDIO, GROSSO) COM FLAGS E FOTOS */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <div>
                    <h4 className="font-bold text-xs uppercase text-zinc-700 dark:text-zinc-300">🥣 Cardápio Base de Açaí (1 Litro)</h4>
                    <p className="text-[11px] text-zinc-500">Controle a disponibilidade e foto de cada ponto de açaí.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {(['popular', 'medio', 'grosso'] as const).map((tipo) => {
                    const label = tipo === 'popular' ? 'Açaí Popular' : tipo === 'medio' ? 'Açaí Médio' : 'Açaí Grosso';
                    const price = prices[tipo] || (tipo === 'popular' ? 20 : tipo === 'medio' ? 26 : 35);
                    const isAvailable = currentUser?.availabilityB2C?.[tipo] !== false;
                    const photo = currentUser?.imagesB2C?.[tipo];

                    return (
                      <div 
                        key={tipo} 
                        className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between ${
                          isAvailable 
                            ? 'bg-purple-50/50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800/60' 
                            : 'bg-zinc-100/70 dark:bg-zinc-900/40 border-zinc-200 dark:border-zinc-800 opacity-70'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 mb-2.5">
                          <div 
                            onClick={() => setPhotoModalData({
                              open: true,
                              title: `Foto do ${label}`,
                              category: 'acai',
                              currentUrl: photo,
                              onSelect: (url) => {
                                if (currentUser) store.updateAcaiImage(currentUser.id, tipo, url);
                              }
                            })}
                            className="w-12 h-12 rounded-lg bg-purple-200 dark:bg-purple-900 overflow-hidden shrink-0 cursor-pointer border border-purple-300 dark:border-purple-700 relative group"
                            title="Clique para alterar foto"
                          >
                            {photo ? (
                              <img src={photo} alt={label} className="w-full h-full object-cover group-hover:scale-105 transition" />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center text-purple-700 dark:text-purple-300 text-xs font-bold">
                                <span>📸</span>
                                <span className="text-[8px]">Foto</span>
                              </div>
                            )}
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-[10px] font-bold">
                              ✏️
                            </div>
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-xs text-zinc-900 dark:text-zinc-100 truncate">{label}</p>
                            <p className="text-purple-600 dark:text-purple-400 font-extrabold text-xs">R$ {price.toFixed(2)}</p>
                          </div>
                        </div>

                        <div className="flex gap-1.5 pt-2 border-t border-purple-100 dark:border-purple-900/40">
                          <button
                            type="button"
                            onClick={() => {
                              if (currentUser) store.toggleAcaiAvailability(currentUser.id, tipo);
                            }}
                            className={`flex-1 py-1.5 px-2 rounded-lg text-[10px] font-bold transition flex items-center justify-center gap-1 border shadow-xs ${
                              isAvailable
                                ? 'bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-600'
                                : 'bg-red-500 hover:bg-red-600 text-white border-red-600'
                            }`}
                          >
                            {isAvailable ? '🟢 Disponível' : '🔴 Esgotado'}
                          </button>
                          
                          <button
                            type="button"
                            onClick={() => setPhotoModalData({
                              open: true,
                              title: `Foto do ${label}`,
                              category: 'acai',
                              currentUrl: photo,
                              onSelect: (url) => {
                                if (currentUser) store.updateAcaiImage(currentUser.id, tipo, url);
                              }
                            })}
                            className="p-1.5 rounded-lg bg-white dark:bg-zinc-800 hover:bg-purple-100 text-purple-700 dark:text-purple-300 text-xs font-bold border border-zinc-200 dark:border-zinc-700 shadow-xs"
                            title="Trocar Foto"
                          >
                            📸
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Participação no Frete e Logística Reversa */}
            <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 flex flex-col justify-between gap-4">
              <div>
                <h3 className="font-bold text-zinc-800 dark:text-zinc-100 text-sm uppercase flex items-center gap-2">
                  <span>🚚</span> Participação no Frete (%)
                </h3>
                <p className="text-xs text-zinc-500 mt-1">Defina a porcentagem do frete que você quer subsidiar para os clientes.</p>
                <div className="flex items-center gap-2 mt-3">
                  <label className="text-xs font-bold text-zinc-600 dark:text-zinc-400">Você Paga:</label>
                  <input type="number" min="0" max="100" value={subsidyInput} onChange={e => setSubsidyInput(e.target.value)} className="w-16 border border-zinc-300 dark:border-zinc-700 bg-transparent rounded-lg p-2 text-center font-bold text-sm outline-none focus:ring-2 focus:ring-purple-500" />
                  <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400">%</span>
                  <button onClick={handleSaveSubsidy} className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm ml-1">Salvar</button>
                </div>
              </div>

              <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
                <div>
                  <h4 className="font-bold text-xs uppercase text-zinc-700 dark:text-zinc-300">Logística Reversa</h4>
                  <p className="text-[10px] text-zinc-500">Descarte sustentável do caroço.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => {
                      const ecopontoUser = store.users['ecoponto'];
                      const latEcoponto = ecopontoUser?.lat || -1.4558;
                      const lngEcoponto = ecopontoUser?.lng || -48.4908;
                      setMapModal({
                        open: true,
                        origem: { lat: currentUser?.lat || 0, lng: currentUser?.lng || 0, name: currentUser?.name || 'Sua Loja' },
                        destino: { lat: latEcoponto, lng: lngEcoponto, name: ecopontoUser?.name || 'Ecoponto' },
                        motorista: null
                      });
                    }} 
                    className="text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded"
                  >
                    🗺️ {distColeta.toFixed(1)} km
                  </button>
                  
                  {(() => {
                      const activeColeta = (store.orders || []).find(o => o.type === 'COLETA' && o.origemId === currentUser.id && o.status !== 'entregue' && o.status !== 'arquivado' && o.status !== 'cancelado');
                      
                      if (activeColeta) {
                          const statusText = activeColeta.status === 'aguardando_pagamento' ? 'Aguardando Pagamento Pix' :
                                             (activeColeta.status === 'pendente' || activeColeta.status === 'pronto') ? 'Aguardando Caçamba' :
                                             activeColeta.status === 'em_rota' ? 'Caçamba a Caminho' : 'Em Andamento';
                          return (
                              <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-xs font-bold bg-amber-100 text-amber-800 px-2 py-1 rounded border border-amber-200 shadow-sm animate-pulse">🚛 {statusText}</span>
                                  {activeColeta.status === 'aguardando_pagamento' && (
                                      <button 
                                        type="button"
                                        onClick={() => {
                                            setPixModalData({
                                                open: true,
                                                qrCode: activeColeta.pixQrCode,
                                                copiaECola: activeColeta.pixCopiaECola,
                                                invoiceUrl: activeColeta.invoiceUrl,
                                                orderId: activeColeta.id,
                                                totalValue: freteColeta
                                            });
                                        }}
                                        className="text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white px-2.5 py-1 rounded shadow-sm flex items-center gap-1"
                                      >
                                        ⚡ Pagar Pix
                                      </button>
                                  )}
                                  {activeColeta.deliveryPin && (
                                      <span className="text-xs font-black bg-purple-700 text-white px-2.5 py-1 rounded-md shadow-sm border border-purple-500 tracking-widest flex items-center gap-1">
                                          🔑 PIN: {activeColeta.deliveryPin}
                                      </span>
                                  )}
                                  <button onClick={() => store.acaoPedido(activeColeta.id, 'cancelar_pedido')} className="text-xs text-red-500 hover:text-red-700 font-bold bg-red-50 px-2 py-1 rounded border border-red-100">Cancelar</button>
                              </div>
                          );
                      }

                      return (
                          <button onClick={async () => {
                              const res: any = await store.criarPedido('COLETA');
                              if (res && typeof res === 'object') {
                                if (res.pixQrCode || res.pixCopiaECola || res.invoiceUrl) {
                                   setPixModalData({
                                      open: true,
                                      qrCode: res.pixQrCode,
                                      copiaECola: res.pixCopiaECola,
                                      invoiceUrl: res.invoiceUrl,
                                      orderId: res.orderId,
                                      paymentId: res.paymentId,
                                      isSandbox: res.isSandbox,
                                      totalValue: res.totalValue || freteColeta
                                   });
                                   return;
                                }
                                if (res.error) {
                                   alert(`Aviso do Asaas: \${res.error}`);
                                } else {
                                   alert('✅ Chamada de caçamba registrada com sucesso!');
                                }
                              } else if (typeof res === 'string' && res.startsWith('http')) {
                                window.location.href = res;
                              } else {
                                alert('✅ Chamada de caçamba registrada com sucesso!');
                              }
                          }} className="bg-amber-100 hover:bg-amber-200 text-amber-800 font-bold py-1.5 px-3 rounded-lg border border-amber-300 transition text-xs shadow-sm">
                              🚛 Chamar Caçamba ({formatMoney(freteColeta)})
                          </button>
                      );
                  })()}
                </div>
              </div>
            </div>

            {/* PRODUTOS EXTRAS / ADICIONAIS COM DISPONIBILIDADE E FOTOS */}
            <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 flex flex-col gap-4">
              <div className="border-b border-zinc-100 dark:border-zinc-800 pb-2 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-zinc-800 dark:text-zinc-100 text-sm uppercase flex items-center gap-2">
                    <span>📦</span> Produtos Extras & Adicionais
                  </h3>
                  <p className="text-xs text-zinc-500">Farinha de tapioca, banana, granola, leite em pó, etc.</p>
                </div>
              </div>

              {/* Form de Cadastro */}
              <div className="bg-zinc-50 dark:bg-zinc-950/60 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row gap-2 items-center">
                <button
                  type="button"
                  onClick={() => setPhotoModalData({
                    open: true,
                    title: 'Foto do Produto Extra',
                    category: 'adicional',
                    currentUrl: newProductImage,
                    onSelect: (url) => setNewProductImage(url)
                  })}
                  className="w-full sm:w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/60 hover:bg-purple-200 text-purple-700 dark:text-purple-300 flex items-center justify-center shrink-0 border border-purple-300 dark:border-purple-700 transition"
                  title="Escolher Foto"
                >
                  {newProductImage ? (
                    <img src={newProductImage} alt="Extra" className="w-full h-full object-cover rounded-lg" />
                  ) : (
                    <span>📸</span>
                  )}
                </button>
                <input 
                  type="text" 
                  placeholder="Nome (ex: Farinha de Tapioca)" 
                  value={newProductName} 
                  onChange={e => setNewProductName(e.target.value)} 
                  className="flex-1 w-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded-lg p-2 text-xs outline-none focus:border-purple-500" 
                />
                <input 
                  type="number" 
                  step="0.1" 
                  placeholder="R$" 
                  value={newProductPrice} 
                  onChange={e => setNewProductPrice(e.target.value)} 
                  className="w-full sm:w-24 border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded-lg p-2 text-xs outline-none focus:border-purple-500" 
                />
                <button 
                  onClick={handleAddProduct} 
                  className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700 text-white font-bold px-4 py-2 rounded-lg text-xs transition shrink-0 shadow-sm"
                >
                  + Adicionar
                </button>
              </div>

              {/* Lista de Extras */}
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800 max-h-60 overflow-y-auto">
                {currentUser?.products?.map(p => {
                  const isAvail = p.isAvailable !== false;
                  return (
                    <li key={p.id} className="flex justify-between items-center py-2.5 gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div 
                          onClick={() => setPhotoModalData({
                            open: true,
                            title: `Foto de ${p.name}`,
                            category: 'adicional',
                            currentUrl: p.imageUrl,
                            onSelect: (url) => {
                              if (currentUser) store.updateProduct(currentUser.id, p.id, { imageUrl: url });
                            }
                          })}
                          className="w-9 h-9 rounded-lg bg-zinc-100 dark:bg-zinc-800 overflow-hidden shrink-0 border border-zinc-200 dark:border-zinc-700 cursor-pointer flex items-center justify-center"
                          title="Trocar Foto"
                        >
                          {p.imageUrl ? (
                            <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-xs">📦</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className={`font-bold text-xs truncate ${isAvail ? 'text-zinc-800 dark:text-zinc-200' : 'text-zinc-400 line-through'}`}>{p.name}</p>
                          <p className="text-purple-600 dark:text-purple-400 text-xs font-bold">R$ {p.price.toFixed(2)}</p>
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
                        <button onClick={() => handleEditProduct(p)} className="text-purple-600 hover:text-purple-800 p-1.5 bg-purple-50 dark:bg-purple-900/30 rounded-lg transition" title="Editar produto extra">✏️</button>
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
          
        {activeTab === 'abastecimento' && (
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
            {/* Header com Contexto */}
            <div className="bg-gradient-to-r from-emerald-800 to-teal-900 rounded-2xl p-5 text-white shadow-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🌿</span>
                  <h3 className="font-extrabold text-lg text-white">Abastecimento B2B & Fornecedores</h3>
                </div>
                <p className="text-emerald-200 text-xs mt-1">
                  Compre Paneiros/Latas de Frutos In Natura e Insumos direto de portos, cooperativas e produtores cadastrados.
                </p>
              </div>
              <span className="bg-emerald-500/30 border border-emerald-400/30 text-emerald-100 text-xs px-3 py-1.5 rounded-full font-bold self-start sm:self-auto shrink-0">
                {fornecedores.length} {fornecedores.length === 1 ? 'Fornecedor disponível' : 'Fornecedores disponíveis'}
              </span>
            </div>

            {/* Grid de Fornecedores */}
            {fornecedores.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-10 bg-white dark:bg-zinc-900 rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-800 text-center shadow-sm">
                <span className="text-4xl mb-3 opacity-60">🏭</span>
                <p className="text-zinc-700 dark:text-zinc-300 font-bold text-base">Nenhum fornecedor ativo na sua região no momento</p>
                <p className="text-zinc-500 text-xs mt-1">Assim que novos produtores ou entrepostos se cadastrarem na sua cidade, eles aparecerão aqui automaticamente.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6">
                {fornecedores.map(forn => {
                  const lat1 = Number(forn?.lat || 0);
                  const lon1 = Number(forn?.lng || 0);
                  const lat2 = Number(currentUser?.lat || 0);
                  const lon2 = Number(currentUser?.lng || 0);
                  const dist = (lat1 !== 0 && lon1 !== 0 && lat2 !== 0 && lon2 !== 0) ? haversineKm(lat1, lon1, lat2, lon2) : 3.0;
                  const freteTotal = (rates.transporter_payment_mode === 'FIXED') ? (rates.transporter_fixed_fee ?? 150.00) : dist * rates.b2b_km;
                  const subsidy = forn.freteSubsidyPct || 0;
                  const freteLoja = freteTotal * (1 - subsidy / 100);

                  const defaultB2BImage = 'https://images.unsplash.com/photo-1628557044797-f21a177c37ec?auto=format&fit=crop&w=400&q=80';

                  return (
                    <div 
                      key={forn.id} 
                      className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col gap-4"
                    >
                      {/* Topo do Card: Informações do Fornecedor */}
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-zinc-100 dark:border-zinc-800">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-800 flex items-center justify-center text-2xl shadow-inner shrink-0">
                            {forn.icon || '🏭'}
                          </div>
                          <div>
                            <h4 className="font-extrabold text-base text-zinc-900 dark:text-white flex items-center gap-2">
                              {forn.name}
                              <span className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 px-2 py-0.5 rounded-full font-bold uppercase">
                                Fornecedor
                              </span>
                            </h4>
                            <p className="text-xs text-zinc-500 flex items-center gap-1 mt-0.5">
                              📍 {forn.bairro ? `${forn.bairro}, ` : ''}{forn.cidade || 'Região'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap self-end sm:self-auto">
                          {subsidy > 0 && (
                            <span className="text-[11px] font-bold bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300 border border-orange-200 dark:border-orange-800 px-2.5 py-1 rounded-xl flex items-center gap-1 shadow-sm">
                              🚚 Fornecedor paga {subsidy}% do frete
                            </span>
                          )}
                          <button 
                            onClick={() => {
                              setMapModal({
                                open: true,
                                origem: { lat: forn?.lat || 0, lng: forn?.lng || 0, name: forn?.name || 'Fornecedor' },
                                destino: { lat: currentUser?.lat || 0, lng: currentUser?.lng || 0, name: currentUser?.name || 'Sua Loja' },
                                motorista: null
                              });
                            }} 
                            className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800 px-3 py-1 rounded-xl transition flex items-center gap-1 shadow-sm"
                          >
                            🗺️ Rota: {dist.toFixed(1)} km
                          </button>
                        </div>
                      </div>

                      {/* Info de Frete */}
                      <div className="bg-zinc-50 dark:bg-zinc-950 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800/80 flex flex-col sm:flex-row justify-between items-start sm:items-center text-xs gap-2 text-zinc-600 dark:text-zinc-400">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">🚚 Frete do Caminhão/Caçamba:</span>
                          <span className="font-bold text-zinc-800 dark:text-zinc-200">{formatMoney(freteLoja)}</span>
                          {subsidy > 0 && (
                            <span className="text-[10px] text-orange-600 dark:text-orange-400">
                              (Economia de {formatMoney(freteTotal * (subsidy / 100))})
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-zinc-500 italic">Preço do frete compartilhado por viagem</span>
                      </div>

                      {/* Grade de Produtos do Fornecedor (Apresentação idêntica ao Catálogo) */}
                      <div>
                        <p className="text-xs font-extrabold uppercase text-zinc-500 mb-3 tracking-wider flex items-center gap-1.5">
                          🧺 Itens e Matéria-Prima Disponíveis:
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {/* Item Base: Paneiro / Lata de Açaí */}
                          <div className="p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 shadow-sm hover:border-emerald-300 dark:hover:border-emerald-700 transition flex justify-between items-center gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 overflow-hidden shrink-0 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center shadow-inner">
                                <img 
                                  src={defaultB2BImage} 
                                  alt="Lata de Açaí In Natura" 
                                  className="w-full h-full object-cover" 
                                />
                              </div>
                              <div className="min-w-0">
                                <p className="font-extrabold text-zinc-800 dark:text-white text-sm truncate">
                                  Paneiro / Lata de Açaí
                                </p>
                                <p className="text-[11px] text-zinc-500">Frutos in natura (aprox. 14kg)</p>
                                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-extrabold mt-0.5">
                                  {formatMoney(forn.priceB2B || 0)} <span className="text-[10px] font-normal text-zinc-500">/ lata</span>
                                </p>
                              </div>
                            </div>

                            <button 
                              onClick={() => setCartModalB2B({ open: true, fornId: forn.id, quantity: 1, productId: 'base' })}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition shadow active:scale-95 shrink-0 flex items-center gap-1"
                            >
                              + Comprar
                            </button>
                          </div>

                          {/* Itens Extras B2B do Fornecedor */}
                          {forn.products && forn.products.map(p => {
                            const isAvail = p.isAvailable !== false;
                            return (
                              <div 
                                key={p.id} 
                                className={`p-3.5 rounded-2xl border transition-all flex justify-between items-center gap-3 ${
                                  isAvail 
                                    ? 'bg-white dark:bg-zinc-900/90 border-zinc-200 dark:border-zinc-800 shadow-sm hover:border-emerald-300' 
                                    : 'bg-zinc-100/80 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 opacity-60'
                                }`}
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 overflow-hidden shrink-0 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center">
                                    {p.imageUrl ? (
                                      <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                                    ) : (
                                      <span className="text-2xl">📦</span>
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <p className="font-extrabold text-zinc-800 dark:text-white text-sm truncate">{p.name}</p>
                                      {!isAvail && (
                                        <span className="text-[9px] bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400 font-extrabold px-1.5 py-0.5 rounded uppercase">
                                          Esgotado
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs text-emerald-600 dark:text-emerald-400 font-extrabold mt-0.5">
                                      {formatMoney(p.price)}
                                    </p>
                                  </div>
                                </div>

                                {isAvail ? (
                                  <button 
                                    onClick={() => setCartModalB2B({ open: true, fornId: forn.id, quantity: 1, productId: p.id })}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition shadow active:scale-95 shrink-0 flex items-center gap-1"
                                  >
                                    + Comprar
                                  </button>
                                ) : (
                                  <span className="text-[10px] font-bold text-zinc-400 bg-zinc-200 dark:bg-zinc-800 px-2.5 py-1.5 rounded-lg shrink-0">
                                    Esgotado
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Lista de Pedidos de Abastecimento B2B */}
            <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800">
              <h3 className="font-bold text-zinc-700 dark:text-zinc-200 text-sm uppercase mb-3 flex items-center gap-2">
                📦 Histórico e Pedidos de Abastecimento (B2B / Coleta)
              </h3>
              <div className="grid grid-cols-1 gap-4">
                {meusPedidos.filter(o => o.type === 'B2B' || o.type === 'COLETA').length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-6 bg-white dark:bg-zinc-900 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 text-center">
                    <span className="text-3xl mb-2 opacity-50">🚚</span>
                    <p className="text-zinc-500 text-xs font-medium">Nenhum pedido de abastecimento B2B registrado ainda.</p>
                  </div>
                ) : (
                  meusPedidos.filter(o => o.type === 'B2B' || o.type === 'COLETA').map(renderOrderCard)
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'pedidos' && (
          <div className="animate-in fade-in zoom-in-95 duration-300">
            <h3 className="font-bold text-lg text-zinc-700 dark:text-zinc-200 border-b border-zinc-200 dark:border-zinc-800 pb-2 mb-4">Gestão de Pedidos e Vendas (B2C)</h3>
            
            <div className="grid grid-cols-1 gap-4">
              {meusPedidos.filter(o => o.type === 'B2C').length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-dashed border-zinc-300 dark:border-zinc-700 text-center">
                  <span className="text-4xl mb-3 opacity-50">🛍️</span>
                  <p className="text-zinc-500 font-medium">Nenhuma venda B2C registrada na loja ainda.</p>
                </div>
              ) : (
                meusPedidos.filter(o => o.type === 'B2C').map(renderOrderCard)
              )}
            </div>
          </div>
        )}
      </main>

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
            <div className="bg-purple-900 text-white p-5 flex justify-between items-center shrink-0">
                <h3 className="font-bold text-lg">✏️ Editar Preços do Açaí</h3>
                <button onClick={() => setPriceModalOpen(false)} className="text-white hover:text-red-300 font-bold text-2xl leading-none">&times;</button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                  <label className="text-xs uppercase text-zinc-500 font-bold">Açaí Popular (R$)</label>
                  <input type="number" step="0.1" value={prices.popular} onChange={e => setPrices({...prices, popular: Number(e.target.value)})} className="w-full border border-zinc-300 dark:border-zinc-700 bg-transparent rounded-lg p-3 outline-none focus:ring-2 focus:ring-purple-500 mt-1 font-bold text-lg"/>
              </div>
              <div>
                  <label className="text-xs uppercase text-zinc-500 font-bold">Açaí Médio (R$)</label>
                  <input type="number" step="0.1" value={prices.medio} onChange={e => setPrices({...prices, medio: Number(e.target.value)})} className="w-full border border-zinc-300 dark:border-zinc-700 bg-transparent rounded-lg p-3 outline-none focus:ring-2 focus:ring-purple-500 mt-1 font-bold text-lg"/>
              </div>
              <div>
                  <label className="text-xs uppercase text-zinc-500 font-bold">Açaí Grosso Especial (R$)</label>
                  <input type="number" step="0.1" value={prices.grosso} onChange={e => setPrices({...prices, grosso: Number(e.target.value)})} className="w-full border border-zinc-300 dark:border-zinc-700 bg-transparent rounded-lg p-3 outline-none focus:ring-2 focus:ring-purple-500 mt-1 font-bold text-lg"/>
              </div>
            </div>

            <div className="p-5 bg-zinc-50 dark:bg-zinc-900/50 flex justify-end gap-3 border-t border-zinc-200 dark:border-zinc-800">
                <button onClick={() => setPriceModalOpen(false)} className="px-5 py-2.5 text-zinc-600 bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 rounded-xl font-bold transition">Cancelar</button>
                <button onClick={handleSavePrices} className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold transition">Salvar Preços</button>
            </div>
          </div>
        </div>
      )}

      {/* B2B Cart Modal */}
      {cartModalB2B.open && (
        <div className="fixed inset-0 bg-black/70 z-[150] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in slide-in-from-bottom-full sm:zoom-in-95">
              <div className="bg-gradient-to-r from-emerald-800 to-teal-900 text-white p-4 sm:p-5 flex justify-between items-center shadow">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🛒</span>
                    <h3 className="font-extrabold text-base sm:text-lg">Comprar Insumos B2B</h3>
                  </div>
                  <button onClick={() => setCartModalB2B({ ...cartModalB2B, open: false })} className="text-white/80 hover:text-white font-bold text-2xl leading-none">&times;</button>
              </div>
              
              <div className="p-6">
                  {(() => {
                      const forn = store.users?.[cartModalB2B.fornId];
                      if (!forn) return <p className="text-zinc-500 text-sm">Fornecedor não encontrado</p>;
                      
                      const lat1 = Number(forn?.lat || 0);
                      const lon1 = Number(forn?.lng || 0);
                      const lat2 = Number(currentUser?.lat || 0);
                      const lon2 = Number(currentUser?.lng || 0);
                      const dist = (lat1 !== 0 && lon1 !== 0 && lat2 !== 0 && lon2 !== 0) ? haversineKm(lat1, lon1, lat2, lon2) : 3.0;
                      const freteTotal = (rates.transporter_payment_mode === 'FIXED') ? (rates.transporter_fixed_fee ?? 150.00) : dist * rates.b2b_km;
                      const subsidy = forn.freteSubsidyPct || 0;
                      const freteLoja = freteTotal * (1 - subsidy / 100);
                      
                      const isBase = cartModalB2B.productId === 'base';
                      const selectedProd = !isBase ? forn.products?.find(p => p.id === cartModalB2B.productId) : null;
                      const unitPrice = isBase ? (forn.priceB2B || 0) : (selectedProd?.price || 0);
                      const productName = isBase ? 'Paneiro de Açaí (Lata In Natura)' : (selectedProd?.name || 'Produto Extra');
                      const productImg = isBase 
                        ? 'https://images.unsplash.com/photo-1628557044797-f21a177c37ec?auto=format&fit=crop&w=400&q=80'
                        : selectedProd?.imageUrl;

                      const subtotal = unitPrice * cartModalB2B.quantity;
                      const totalToPay = subtotal + freteLoja;

                      return (
                          <>
                              <div className="flex items-center justify-between pb-3 mb-4 border-b border-zinc-100 dark:border-zinc-800">
                                <div>
                                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Fornecedor Selecionado</p>
                                  <h4 className="font-extrabold text-zinc-900 dark:text-white text-lg">{forn.name}</h4>
                                </div>
                                <span className="text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-2.5 py-1 rounded-xl">
                                  📍 {dist.toFixed(1)} km
                                </span>
                              </div>
                              
                              <label className="block text-xs font-bold uppercase text-zinc-500 mb-2">Item Escolhido:</label>
                              <select 
                                value={cartModalB2B.productId} 
                                onChange={e => setCartModalB2B({ ...cartModalB2B, productId: e.target.value })}
                                className="w-full border-2 border-emerald-200 dark:border-zinc-700 rounded-xl p-3 bg-emerald-50/50 dark:bg-zinc-800 text-zinc-900 dark:text-white font-bold outline-none focus:border-emerald-500 transition mb-4 text-sm"
                              >
                                  <option value="base">Paneiro / Lata de Açaí (In Natura) - {formatMoney(forn.priceB2B || 0)}</option>
                                  {forn.products && forn.products.length > 0 && (
                                      <optgroup label="Outros Insumos & Extras">
                                          {forn.products.map(p => (
                                              <option key={p.id} value={p.id} disabled={p.isAvailable === false}>
                                                {p.name} - {formatMoney(p.price)} {p.isAvailable === false ? '(ESGOTADO)' : ''}
                                              </option>
                                          ))}
                                      </optgroup>
                                  )}
                              </select>

                              {/* Preview Card do Produto Escolhido */}
                              <div className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200 dark:border-zinc-700/60 mb-5">
                                <div className="w-12 h-12 rounded-lg bg-emerald-100 dark:bg-emerald-950 overflow-hidden shrink-0 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center">
                                  {productImg ? (
                                    <img src={productImg} alt={productName} className="w-full h-full object-cover" />
                                  ) : (
                                    <span className="text-xl">🌿</span>
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="font-bold text-sm text-zinc-900 dark:text-white truncate">{productName}</p>
                                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-extrabold">{formatMoney(unitPrice)} un.</p>
                                </div>
                              </div>

                              <div className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/40 p-3 rounded-xl mb-5">
                                <span className="text-xs font-bold uppercase text-zinc-600 dark:text-zinc-300">Quantidade de Latas/Itens:</span>
                                <div className="flex items-center gap-3">
                                    <button onClick={() => setCartModalB2B(prev => ({ ...prev, quantity: Math.max(1, prev.quantity - 1)}))} className="bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 w-9 h-9 rounded-xl font-extrabold text-lg flex items-center justify-center hover:bg-zinc-300 active:scale-95 transition">-</button>
                                    <span className="text-xl font-extrabold text-zinc-900 dark:text-white w-7 text-center">{cartModalB2B.quantity}</span>
                                    <button onClick={() => setCartModalB2B(prev => ({ ...prev, quantity: prev.quantity + 1}))} className="bg-emerald-600 text-white w-9 h-9 rounded-xl font-extrabold text-lg flex items-center justify-center hover:bg-emerald-700 active:scale-95 transition shadow">+</button>
                                </div>
                              </div>
                              
                              <div className="space-y-2.5 mb-6 text-xs text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-950/80 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
                                  <div className="flex justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2">
                                      <span>Subtotal ({cartModalB2B.quantity}x {formatMoney(unitPrice)}):</span>
                                      <span className="font-bold text-zinc-800 dark:text-white">{formatMoney(subtotal)}</span>
                                  </div>
                                  <div className="flex justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2">
                                      <span className="flex items-center gap-1">
                                        Frete Caminhão (Loja):
                                        {subsidy > 0 && <span className="text-[9px] bg-orange-100 text-orange-700 px-1 rounded font-bold">-{subsidy}%</span>}
                                      </span>
                                      <span className="font-bold text-zinc-800 dark:text-white">{formatMoney(freteLoja)}</span>
                                  </div>
                                  <div className="flex justify-between pt-1 text-sm">
                                      <span className="font-extrabold text-zinc-900 dark:text-white">Total a Pagar (PIX):</span>
                                      <span className="font-extrabold text-emerald-600 dark:text-emerald-400 text-base">{formatMoney(totalToPay)}</span>
                                  </div>
                              </div>
                              
                              <div className="flex gap-3">
                                  <button onClick={() => setCartModalB2B({ ...cartModalB2B, open: false })} className="flex-1 px-4 py-3 bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold rounded-xl active:scale-95 transition text-sm">Cancelar</button>
                                  <button onClick={async () => {
                                      store.clearCart();
                                      store.addToCart(forn.id, { 
                                          id: cartModalB2B.productId === 'base' ? 'B2B' : cartModalB2B.productId, 
                                          name: productName, 
                                          price: unitPrice, 
                                          quantity: cartModalB2B.quantity 
                                      });
                                      const res: any = await store.criarPedido('B2B', forn.id);
                                      setCartModalB2B({ ...cartModalB2B, open: false });

                                      if (res && typeof res === 'object') {
                                        if (res.pixQrCode || res.pixCopiaECola || res.invoiceUrl) {
                                           setPixModalData({
                                              open: true,
                                              qrCode: res.pixQrCode,
                                              copiaECola: res.pixCopiaECola,
                                              invoiceUrl: res.invoiceUrl,
                                              orderId: res.orderId,
                                              paymentId: res.paymentId,
                                              isSandbox: res.isSandbox,
                                              totalValue: res.totalValue || totalToPay
                                           });
                                           return;
                                        }
                                        if (res.error) {
                                           alert(`Aviso do Asaas: ${res.error}`);
                                        } else {
                                           alert('✅ Pedido B2B enviado ao fornecedor com sucesso!');
                                         }
                                      } else if (typeof res === 'string' && res.startsWith('http')) {
                                        window.location.href = res;
                                      } else {
                                        alert('✅ Pedido B2B enviado ao fornecedor com sucesso!');
                                      }
                                  }} className="flex-1 px-4 py-3 bg-emerald-600 text-white font-bold rounded-xl shadow-lg hover:bg-emerald-700 active:scale-95 transition text-sm flex items-center justify-center gap-1.5">
                                    <span>Confirmar Pedido</span>
                                  </button>
                              </div>
                          </>
                      );
                  })()}
              </div>
          </div>
        </div>
      )}

      {/* Modal de Configuração de Impressora Térmica */}
      {printerModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-in fade-in zoom-in-95">
            <div className="bg-purple-900 text-white p-5 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <Printer className="text-purple-300" />
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
                        ? 'bg-purple-600 text-white border-purple-600 shadow-md'
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
                        ? 'bg-purple-600 text-white border-purple-600 shadow-md'
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
                        ? 'bg-purple-600 text-white border-purple-600 shadow-md'
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
                        ? 'bg-purple-600 text-white border-purple-600 shadow-md'
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
                        ? 'bg-purple-600 text-white border-purple-600 shadow-md'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                    }`}
                  >
                    1 Via (Batedeira)
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
                        ? 'bg-purple-600 text-white border-purple-600 shadow-md'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                    }`}
                  >
                    2 Vias (Cozinha + Entrega)
                  </button>
                </div>
              </div>

              <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => printTestTicket(currentUser?.name || 'Batedeira AçaíFood', printerConfig)}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-sm"
                >
                  🧪 Testar Impressão Agora
                </button>
              </div>
            </div>

            <div className="p-4 bg-zinc-50 dark:bg-zinc-900/50 flex justify-end border-t border-zinc-200 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setPrinterModalOpen(false)}
                className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-xs transition"
              >
                Salvar e Fechar
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal de Pagamento Pix */}
      <PixModal 
        data={pixModalData} 
        onClose={() => setPixModalData({ open: false })} 
      />

      {currentUser && (
        <OrderChatModal
          isOpen={chatModalData.open}
          onClose={() => setChatModalData({ open: false, orderId: "" })}
          orderId={chatModalData.orderId}
          currentUserId={currentUser.id}
          currentUserName={currentUser.name}
          currentUserRole="loja"
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
    </div>
  );
}

