"use client";

import React, { useState, useEffect, useRef, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { PackageOpen, Printer, BookOpen } from "lucide-react";
import { useAppStore, getRatesForCity, generateUUID, getDailyWithdrawalCount, incrementDailyWithdrawalCount } from "@/store/useAppStore";
import { MapModal, MapPoint } from "@/components/MapModal";
import { supabase } from "@/lib/supabase";
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
  const printedOrdersRef = useRef<Set<string>>(new Set());

  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  const [printerConfig, setPrinterConfig] = useState<PrinterConfig>(getPrinterConfig);

  useEffect(() => {
    const s = useAppStore.getState();
    s.fetchAllUsers();
    if (typeof s.fetchCities === 'function') s.fetchCities();
    if (typeof s.fetchRates === 'function') s.fetchRates();
    s.startRealtime();
  }, []);

  useEffect(() => {
    if (!mounted || !printerConfig.enabled || printerConfig.printMode !== 'auto' || !currentUser) return;

    const autoOrders = (store.orders || []).filter(o =>
      o.fornecedorId === currentUser.id &&
      o.type === 'B2B' &&
      o.status === 'preparo' &&
      !printedOrdersRef.current.has(o.id)
    );

    for (const order of autoOrders) {
      printedOrdersRef.current.add(order.id);
      printOrderTicket(order, currentUser.name, printerConfig, store.users);
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
    setActiveTab('pedidos');
    if (currentUser?.id) {
      await Promise.all([
        store.fetchOrders(currentUser.id, true),
        store.fetchAllUsers(true)
      ]);
    }
    setIsRefreshing(false);
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
    const newName = prompt("Editar nome do produto extra B2B:", p.name);
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

    const valorSaque = (vendasHoje && vendasHoje > 0) ? vendasHoje : (emProcessamento || 0);
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

    if (confirm(`Deseja transferir R$ ${valorSaque.toFixed(2)} instantaneamente via PIX para a sua Chave Pix externa (${targetKey})?\n(Saque ${saquesHoje + 1} de no máximo 2 saques hoje)`)) {
      setIsWithdrawing(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const authHeaders: any = { 
          'Content-Type': 'application/json'
        };
        if (session?.access_token) {
          authHeaders['Authorization'] = `Bearer ${session.access_token}`;
        }

        const pendingOrders = meusPedidos.filter(o => (o.status === 'entregue' || o.status === 'arquivado') && o.type === 'B2B' && !o.payoutSellerDone);
        const pendingOrderIds = pendingOrders.map(o => o.id);

        const res = await fetch('/api/asaas/transfer', {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            pixKey: targetKey,
            value: valorSaque,
            description: `Saque Instantâneo AçaíFood (${currentUser.name})`
          })
        });
        const data = await res.json();
        if (res.ok && (data.success || data.transferId)) {
          incrementDailyWithdrawalCount(currentUser.id);
          if (pendingOrderIds.length > 0) {
            await store.markPayoutDone(pendingOrderIds, 'seller');
          }
          alert(`✅ PIX enviado com sucesso!\nID da Transferência: ${data.transferId || 'concluída'}\nO valor de R$ ${valorSaque.toFixed(2)} já está a caminho do seu banco (${targetKey}).`);
          store.fetchOrders(currentUser.id, true);
        } else {
          const msg = data.error || '';
          if (msg.includes('Saldo insuficiente')) {
            alert(`ℹ️ Saldo já creditado na Subconta Asaas:\nO valor de R$ ${valorSaque.toFixed(2)} já consta na sua subconta Asaas oficial (${currentUser.asaasWalletId || 'Ativa'}).\nA varredura automática de repasse para o seu banco externo ocorrerá às ${rates.payout_time || '22:00'}.`);
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

  const isCompleted = (st?: string) => st === 'entregue' || st === 'RECEIVED' || st === 'DELIVERED';
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

  const meusPedidosAll = (store.orders || []).filter(o => isMyOrder(o));
  const vendasHoje = meusPedidosAll.filter(o => isCompleted(o.status) && !o.payoutSellerDone).reduce((acc, curr) => acc + getSupplierRepasse(curr), 0);
  const emProcessamento = meusPedidosAll.filter(o => isPaidOrProcessing(o.status)).reduce((acc, curr) => acc + getSupplierRepasse(curr), 0);
  const saquesHoje = currentUser ? getDailyWithdrawalCount(currentUser.id) : 0;

  const fornActiveOrders = meusPedidosAll.filter(o => 
    o.status !== 'aguardando_pagamento' && 
    !isCompleted(o.status) && 
    o.status !== 'cancelado' && 
    o.status !== 'arquivado'
  );
  const fornHistoryOrders = meusPedidosAll.filter(o => isCompleted(o.status) || o.status === 'cancelado' || o.status === 'arquivado');
  const meusPedidos = [...fornActiveOrders, ...fornHistoryOrders];

  const handleSaveSubsidy = () => {
    store.setFreteSubsidy(currentUser.id, parseFloat(subsidyInput) || 0);
    alert('Subsídio salvo com sucesso!');
  };


  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 pb-24">
      <PartnerManualModal isOpen={partnerManualOpen} onClose={() => setPartnerManualOpen(false)} role="fornecedor" />
      <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 p-4 sticky top-0 z-30">
        <div className="flex justify-between items-center max-w-5xl mx-auto">
          <div className="flex items-center gap-3">
            <PackageOpen className="text-emerald-600" />
            <h1 className="text-xl font-bold text-zinc-900 dark:text-white">Painel do Fornecedor (B2B)</h1>
          </div>
          <div className="flex items-center gap-3">
            {currentUser.asaasLinked && (
               <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-1 rounded font-bold border border-emerald-200 hidden sm:inline-block">Asaas Ativo ✅</span>
            )}
            <button 
              onClick={() => setPrinterModalOpen(true)} 
              className="text-xs bg-emerald-100 hover:bg-emerald-200 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 shadow-sm transition-all border border-emerald-200 dark:border-emerald-800"
              title="Configurar Impressora Térmica"
            >
              <Printer size={14} /> 🖨️ Impressora
            </button>
            <button 
              onClick={handleRefresh} 
              disabled={isRefreshing}
              className="text-xs bg-indigo-100 hover:bg-indigo-200 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 shadow-sm transition-all active:scale-95 disabled:opacity-60"
              title="Atualizar dados e abrir Gestão de Pedidos"
            >
              <span className={isRefreshing ? "animate-spin" : ""}>🔄</span> {isRefreshing ? "Atualizando..." : "Atualizar"}
            </button>
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
          <button onClick={() => setActiveTab('geral')} className={`py-4 px-2 font-bold text-sm border-b-2 transition whitespace-nowrap ${activeTab === 'geral' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-zinc-500 hover:text-zinc-800'}`}>📊 Visão Geral</button>
          <button onClick={() => setActiveTab('pedidos')} className={`py-4 px-2 font-bold text-sm border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${activeTab === 'pedidos' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-zinc-500 hover:text-zinc-800'}`}>
            <span>🚚 Gestão de Pedidos</span>
            {fornActiveOrders.length > 0 && (
              <span className="bg-emerald-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full animate-pulse">
                {fornActiveOrders.length}
              </span>
            )}
          </button>
        </div>
      </div>

      <main className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
        
        {!currentUser.asaasLinked && (
          <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-6 text-center shadow-sm">
            <h3 className="text-emerald-700 dark:text-emerald-400 font-bold text-lg mb-2">Atenção: Vendas Bloqueadas!</h3>
            <p className="text-emerald-600 dark:text-emerald-300 text-sm mb-4">
              Para receber os pagamentos das lojas automaticamente via PIX ou Cartão com Split, você precisa informar sua Carteira Asaas / Chave Pix.
            </p>
            <button 
              onClick={handleLinkAsaas}
              className="inline-block bg-emerald-600 text-white font-bold py-3 px-6 rounded-xl shadow-md hover:bg-emerald-700 transition"
            >
              🤝 Vincular Conta / Carteira Asaas
            </button>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 opacity-80 mt-3">
              📲 <strong>Dica:</strong> Se você receber um SMS do Asaas com código de verificação, não se preocupe: a sua conta AçaíFood é ativada automaticamente via API!
            </p>
          </div>
        )}

        {/* Banner Cofre Virtual & Pix Automático (Sempre Visível) */}
        <div className="bg-emerald-900 text-white p-5 rounded-2xl shadow flex justify-between items-center border border-emerald-800">
            <div>
                <h2 className="text-xl font-bold">🏭 {currentUser.name}</h2>
                <p className="text-emerald-300 text-xs mt-1">📍 Bairro: {currentUser.bairro || 'Central'}</p>
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <button 
                    onClick={handleUpdateGPS}
                    disabled={isUpdatingGPS}
                    className="text-[10px] bg-emerald-800/80 hover:bg-emerald-700 disabled:bg-emerald-800/40 text-white font-bold px-2.5 py-1 rounded-lg border border-emerald-700 transition shadow flex items-center gap-1 active:scale-95 disabled:scale-100 disabled:cursor-not-allowed"
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
                    className="text-[10px] bg-emerald-800/90 hover:bg-emerald-700 text-emerald-200 hover:text-white font-bold px-2.5 py-1 rounded-lg border border-emerald-600 transition shadow flex items-center gap-1 active:scale-95"
                    title="Clique para cadastrar ou trocar sua Chave Pix"
                  >
                    🔑 PIX: {(currentUser.pixKey || (currentUser as any).pix_key) ? (currentUser.pixKey || (currentUser as any).pix_key) : 'Cadastrar'} ✏️
                  </button>
                </div>
            </div>
            <div className="text-right flex flex-col items-end">
                <p className="text-xs text-emerald-200 font-bold">Cofre Virtual (Disponível p/ Saque)</p>
                <p className="text-2xl font-black text-green-400">{formatMoney(vendasHoje)}</p>
                {emProcessamento > 0 && (
                  <p className="text-[11px] text-amber-300 font-bold mt-1 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/80">
                    ⏳ Em Processamento: {formatMoney(emProcessamento)}
                  </p>
                )}
                <p className="text-[10px] text-emerald-300 mt-1 font-bold">🗓️ Pix Automático: às {rates.payout_time || '22:00'}</p>
                {(vendasHoje > 0 || emProcessamento > 0) && saquesHoje < 2 && (
                  <button 
                    onClick={handleResgatarPix}
                    disabled={isWithdrawing}
                    className={`mt-2 text-xs ${isWithdrawing ? 'bg-gray-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700'} text-white font-bold px-3 py-1.5 rounded-lg transition shadow flex items-center gap-1`}
                  >
                    {isWithdrawing ? '⏳ Transferindo...' : `💸 Saque Instantâneo Pix (${saquesHoje + 1}/2)`}
                  </button>
                )}
                {saquesHoje >= 2 && (vendasHoje > 0 || emProcessamento > 0) && (
                  <p className="text-[10px] text-amber-300 mt-1.5 font-bold bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/60">
                    ⚠️ Limite diário de 2 saques atingido (retorna amanhã)
                  </p>
                )}
            </div>
        </div>

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
                  <button onClick={handleToggleStatus} className={`px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-sm border ${isPaused ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100' : 'bg-green-50 text-green-600 border-green-200 hover:bg-green-100'}`}>
                    {isPaused ? 'Pausado 🚫' : 'Operando ✅'}
                  </button>
                  <div className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700">
                    <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400">Lata:</span>
                    <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">{formatMoney(b2bPrice)}</span>
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
                  Base B2B (~14kg)
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
                          <h4 className="font-extrabold text-sm sm:text-base text-zinc-900 dark:text-white">
                            Paneiro / Lata de Açaí (In Natura)
                          </h4>
                          {!isLataAvail && (
                            <span className="text-[9px] bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400 font-extrabold px-1.5 py-0.5 rounded uppercase">
                              Esgotado
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-zinc-500">Frutos in natura padrão (aprox. 14kg por lata)</p>
                        <p className="text-sm font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                          {formatMoney(b2bPrice)} <span className="text-[10px] font-normal text-zinc-500">/ lata</span>
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
                <input 
                  type="text" 
                  placeholder="Nome (ex: Saca de Açaí Selecionado)" 
                  value={newProductName} 
                  onChange={e => setNewProductName(e.target.value)} 
                  className="flex-1 w-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded-lg p-2 text-xs outline-none focus:border-emerald-500" 
                />
                <input 
                  type="number" 
                  step="0.1" 
                  placeholder="R$" 
                  value={newProductPrice} 
                  onChange={e => setNewProductPrice(e.target.value)} 
                  className="w-full sm:w-28 border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded-lg p-2 text-xs outline-none focus:border-emerald-500" 
                />
                <button 
                  onClick={handleAddProduct} 
                  className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-lg text-xs transition shrink-0 shadow-sm"
                >
                  + Adicionar
                </button>
              </div>

              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800 mt-2">
                {currentUser?.products?.map(p => {
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
                          <p className={`font-bold text-xs truncate ${isAvail ? 'text-zinc-800 dark:text-zinc-200' : 'text-zinc-400 line-through'}`}>{p.name}</p>
                          <p className="text-emerald-600 dark:text-emerald-400 text-xs font-bold">R$ {p.price.toFixed(2)}</p>
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

        {activeTab === 'pedidos' && (
        <div className="animate-in fade-in zoom-in-95 duration-300">
          <h3 className="font-bold text-lg text-zinc-700 dark:text-zinc-200 border-b border-zinc-200 dark:border-zinc-800 pb-2 mb-4">Gestão de Pedidos (Vendas B2B)</h3>
          
          <div className="space-y-4">
          {meusPedidos.length === 0 ? (
             <div className="flex flex-col items-center justify-center p-8 bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-dashed border-zinc-300 dark:border-zinc-700 text-center">
                <span className="text-4xl mb-3 opacity-50">🚢</span>
                <p className="text-zinc-500 font-medium">Nenhum pedido de batedeira no momento.</p>
            </div>
          ) : meusPedidos.map(o => {
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
                    <div className="flex flex-wrap gap-2 mt-2">
                       {o.createdAt && <span className="text-[9px] bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-2 py-0.5 rounded font-bold">🕒 Pedido: {new Date(o.createdAt).toLocaleDateString('pt-BR')} {new Date(o.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>}
                       {o.acceptedAt && <span className="text-[9px] bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded font-bold">👨‍🍳 Aceito: {new Date(o.acceptedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>}
                       {o.readyAt && <span className="text-[9px] bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-2 py-0.5 rounded font-bold">🛎️ Pronto: {new Date(o.readyAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>}
                       {o.pickedUpAt && <span className="text-[9px] bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded font-bold">📦 Retirada: {new Date(o.pickedUpAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>}
                       {o.deliveredAt && <span className="text-[9px] bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 px-2 py-0.5 rounded font-bold">📍 Chegou: {new Date(o.deliveredAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>}
                       {o.receivedAt && <span className="text-[9px] bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 px-2 py-0.5 rounded font-bold">✅ Recebido: {new Date(o.receivedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>}
                    </div>
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
                            ⏳ No Cofre Virtual (R$ {(o.taxas?.repasse || getSupplierRepasse(o)).toFixed(2)})
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
                        onClick={() => printOrderTicket(o, currentUser?.name || 'Fornecedor AçaíFood', printerConfig, store.users)}
                        className="text-xs bg-emerald-100 hover:bg-emerald-200 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 font-bold px-3 py-2 rounded-lg border border-emerald-300 dark:border-emerald-800 transition shadow-sm flex items-center gap-1 shrink-0 mt-2 sm:mt-0"
                        title="Imprimir comanda térmica deste pedido"
                      >
                        🖨️ Imprimir Comanda
                      </button>
                    )}

                    {/* Interações */}
                    {!isCanceled && o.status === 'aguardando_pagamento' && (
                      <div className="flex gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                          <button onClick={() => {
                            const reason = prompt("Informe o motivo da recusa:", "Sem estoque suficiente");
                            if (reason !== null && reason.trim() !== "") {
                              store.acaoPedido(o.id, 'cancelar_pedido', undefined, reason.trim());
                              alert("❌ Pedido recusado e estorno acionado no Asaas.");
                            }
                          }} className="flex-1 sm:flex-none bg-red-100 hover:bg-red-200 text-red-700 text-xs font-bold px-3 py-2 rounded-lg transition">❌ Recusar</button>
                      </div>
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
                              printOrderTicket(o, currentUser?.name || o.lojaNome || 'Fornecedor AçaíFood', pConfig, store.users, null, 'PREPARO', 'SYSTEM');
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
          )})}
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
    </div>
  );
}
