"use client";

import React, { useState, useEffect, useRef, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { 
  Store, 
  Printer, 
  BookOpen, 
  ShoppingCart, 
  Share2, 
  Search, 
  Plus, 
  Trash2, 
  Edit3, 
  Check, 
  X, 
  Sparkles, 
  CheckCircle2, 
  XCircle, 
  Package,
  Layers,
  ArrowUpDown
} from "lucide-react";
import { useAppStore, haversineKm, getRatesForCity, generateUUID, getDailyWithdrawalCount, incrementDailyWithdrawalCount } from "@/store/useAppStore";
import { MapModal, MapPoint } from "@/components/MapModal";
import { supabase } from "@/lib/supabase";
import { PixModal, PixModalData } from "@/components/PixModal";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PartnerManualModal } from "@/components/PartnerManualModal";
import { OrderChatModal } from "@/components/OrderChatModal";
import { PhotoPickerModal } from "@/components/PhotoPickerModal";
import { PartnerShareModal, StoreShareCard } from "@/components/PartnerShareModal";
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

const QUICK_EXTRAS_CATEGORIES = [
  { id: 'acai', label: '🥣 Açaí & Adicionais' },
  { id: 'carnes', label: '🍖 Churrasco & Carnes' },
  { id: 'bebidas', label: '🥤 Bebidas' },
  { id: 'outros', label: '🍟 Porções & Outros' }
] as const;

const QUICK_EXTRAS_PRESETS = [
  // Açaí & Adicionais
  { name: 'Farinha de Tapioca', price: 5, category: 'acai', icon: '🥣', description: 'Farinha de tapioca branca tradicional, flocada, crocante e leve para acompanhar o açaí.' },
  { name: 'Farinha D\'Água', price: 5, category: 'acai', icon: '🌾', description: 'Farinha d\'água de Bragança torrada, crocante e amarelinha, sabor inconfundível.' },
  { name: 'Banana Fatiada', price: 3, category: 'acai', icon: '🍌', description: 'Porção generosa de banana prata fatiada na hora, fresquinha e doce.' },
  { name: 'Granola Crocante', price: 4, category: 'acai', icon: '🥣', description: 'Granola artesanal com cereais nobres, castanhas e uvas passas.' },
  { name: 'Leite em Pó', price: 4, category: 'acai', icon: '🥛', description: 'Porção de leite em pó integral de alta qualidade.' },
  { name: 'Leite Condensado', price: 4, category: 'acai', icon: '🍯', description: 'Leite condensado cremoso e doce para finalizar seu açaí.' },
  { name: 'Paçoca de Amendoim', price: 2.5, category: 'acai', icon: '🥜', description: 'Paçoca de amendoim esfarelada e saborosa.' },
  { name: 'Morango Fresco', price: 6, category: 'acai', icon: '🍓', description: 'Porção de morangos frescos fatiados e selecionados.' },
  { name: 'Mel Puro de Abelha', price: 4, category: 'acai', icon: '🍯', description: 'Mel de abelha puro 100% natural.' },
  { name: 'Calda de Chocolate', price: 3.5, category: 'acai', icon: '🍫', description: 'Calda especial de chocolate meio amargo cremosa.' },

  // Churrasco & Carnes
  { name: 'Churrasco Misto', price: 23, category: 'carnes', icon: '🍖', description: 'Churrasco misto suculento na brasa com carnes selecionadas, acompanha farofa e vinagrete.' },
  { name: 'Maminha na Brasa', price: 28, category: 'carnes', icon: '🥩', description: 'Maminha assada na brasa no ponto certo, macia e saborosa.' },
  { name: 'Sobre Coxa Frango', price: 25, category: 'carnes', icon: '🍗', description: 'Sobrecoxa de frango dourada e suculenta assada no carvão.' },
  { name: 'Picanha na Brasa', price: 35, category: 'carnes', icon: '🥩', description: 'Picanha fatiada premium assada na brasa, maciez incomparável.' },
  { name: 'Espetinho de Carne', price: 12, category: 'carnes', icon: '🍢', description: 'Espeto de alcatra selecionada assada na brasa.' },
  { name: 'Espetinho de Frango c/ Bacon', price: 12, category: 'carnes', icon: '🍢', description: 'Cubos de peito de frango enrolados em fatias de bacon crocante.' },
  { name: 'Espetinho de Calabresa', price: 10, category: 'carnes', icon: '🌭', description: 'Espeto de linguiça calabresa defumada assada na brasa.' },
  { name: 'Peixe Frito (Posta)', price: 25, category: 'carnes', icon: '🐟', description: 'Posta de peixe regional frito crocante e sequinho, tempero paraense autêntico.' },
  { name: 'Camarão Seco Regional', price: 15, category: 'carnes', icon: '🦐', description: 'Porção de camarão seco salgado selecionado, tradição paraense que combina perfeitamente com açaí.' },

  // Bebidas
  { name: 'Água Mineral 500ml', price: 3, category: 'bebidas', icon: '💧', description: 'Garrafa de água mineral natural sem gás 500ml gelada.' },
  { name: 'Água c/ Gás 500ml', price: 4, category: 'bebidas', icon: '🫧', description: 'Garrafa de água mineral com gás 500ml gelada.' },
  { name: 'Refrigerante Lata 350ml', price: 5, category: 'bebidas', icon: '🥤', description: 'Refrigerante em lata 350ml super gelado.' },
  { name: 'Coca-Cola 2L', price: 12, category: 'bebidas', icon: '🍾', description: 'Garrafa Pet de Coca-Cola 2 Litros gelada.' },
  { name: 'Guaraná Antarctica 2L', price: 10, category: 'bebidas', icon: '🍾', description: 'Garrafa Pet de Guaraná Antarctica 2 Litros gelada.' },
  { name: 'Suco Natural Cupuaçu 500ml', price: 8, category: 'bebidas', icon: '🧃', description: 'Suco natural da polpa pura de cupuaçu 500ml refrescante.' },
  { name: 'Suco Natural Graviola 500ml', price: 8, category: 'bebidas', icon: '🧃', description: 'Suco natural de graviola da Amazônia 500ml.' },
  { name: 'Cerveja Lata 350ml', price: 6, category: 'bebidas', icon: '🍺', description: 'Cerveja em lata 350ml estupidamente gelada.' },

  // Porções & Outros
  { name: 'Porção Batata Frita', price: 15, category: 'outros', icon: '🍟', description: 'Porção de batatas fritas crocantes e sequinhas com sal a gosto.' },
  { name: 'Porção Macaxeira Frita', price: 15, category: 'outros', icon: '🥔', description: 'Macaxeira frita macia por dentro e dourada por fora.' },
  { name: 'Caldo de Carne', price: 12, category: 'outros', icon: '🍲', description: 'Caldo quente encorpado de carne com cheiro-verde e torradas.' },
  { name: 'Vatapá Paraense', price: 18, category: 'outros', icon: '🍲', description: 'Vatapá cremoso tradicional paraense com azeite de dendê, camarão e leite de coco.' },
];

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
  const [prices, setPrices] = useState(() => currentUser?.priceB2C || { popular: 18, medio: 25, grosso: 33, branco: 38 });
  const [acaiDescriptions, setAcaiDescriptions] = useState<{ popular?: string; medio?: string; grosso?: string; branco?: string }>(() => currentUser?.descriptionsB2C || {});
  const [shareLandingModalOpen, setShareLandingModalOpen] = useState(false);

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
    if (currentUser?.descriptionsB2C) {
      setAcaiDescriptions(currentUser.descriptionsB2C);
    }
  }, [currentUser?.priceB2C, currentUser?.descriptionsB2C]);

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
  const [newProductDesc, setNewProductDesc] = useState('');
  const [extraSearchQuery, setExtraSearchQuery] = useState('');
  const [extraFilterStatus, setExtraFilterStatus] = useState<'all' | 'available' | 'unavailable'>('all');
  const [extraPresetCategory, setExtraPresetCategory] = useState<'acai' | 'carnes' | 'bebidas' | 'outros'>('acai');
  const [editingProduct, setEditingProduct] = useState<{
    id: string;
    name: string;
    price: number;
    description?: string;
    imageUrl?: string;
    isAvailable?: boolean;
  } | null>(null);
  const { cart, addToCart, removeFromCart, updateCartQuantity, clearCart } = store;
  const [productSelectModalB2B, setProductSelectModalB2B] = useState<{
    open: boolean;
    fornId: string;
    productId: string;
    name: string;
    price: number;
    imageUrl?: string;
    quantity: number;
  } | null>(null);
  const [b2bCheckoutModalOpen, setB2bCheckoutModalOpen] = useState(false);
  const [b2bSearchQuery, setB2bSearchQuery] = useState('');
  const [b2bSortFilter, setB2bSortFilter] = useState<'all' | 'open' | 'lowest_price' | 'nearest' | 'has_stock' | 'subsidy'>('all');
  const [b2bVisibleLimit, setB2bVisibleLimit] = useState(12);
  const [selectedFornecedorId, setSelectedFornecedorId] = useState<string | null>(null);
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
    s.fetchAllUsers(true);
    s.fetchLojas(true);
    if (typeof s.fetchCities === 'function') s.fetchCities();
    if (typeof s.fetchRates === 'function') s.fetchRates(true);
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

      // 1. Impressão Única Oficial de Comanda (ao aceitar o pedido para preparar)
      // Respeita a quantidade de vias configurada pelo parceiro (1 via ou 2 vias)
      if (order.status === 'preparo' && !printedOrdersRef.current.has(`${order.id}-PREPARO`)) {
        printedOrdersRef.current.add(`${order.id}-PREPARO`);
        const allUsersWithCurrent = currentUser ? { ...store.users, [currentUser.id]: currentUser } : store.users;
        printOrderTicket(order, currentUser?.name || order.lojaNome || 'Loja/Batedeira AçaíFood', activeConfig, allUsersWithCurrent, null, 'PREPARO', 'SYSTEM');
      }
    }

  }, [store.orders, currentUser, printerConfig, mounted, store.users]);


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
      console.warn("Erro ao atualizar dados:", e);
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
    store.updateUserPrice(currentUser.id, prices);
    store.updateAcaiDescriptions(currentUser.id, acaiDescriptions);
    setPriceModalOpen(false);
    alert('Preços e detalhes do açaí atualizados com sucesso!');
  };

  const handleAddProduct = (presetName?: string, presetPrice?: number, presetDesc?: string) => {
    if (!currentUser) return;
    const nameToAdd = (presetName || newProductName).trim();
    const rawPrice = presetPrice !== undefined ? presetPrice : parseFloat(newProductPrice.replace(',', '.'));
    const descToAdd = (presetDesc !== undefined ? presetDesc : newProductDesc).trim();
    if (!nameToAdd || isNaN(rawPrice) || rawPrice < 0) {
      alert("Informe o nome e um preço válido para o produto extra.");
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

  const handleBulkToggleExtras = (available: boolean) => {
    if (!currentUser?.products || currentUser.products.length === 0) return;
    const count = currentUser.products.length;
    const actionText = available ? 'marcar como DISPONÍVEIS' : 'marcar como ESGOTADOS / PAUSADOS';
    if (!confirm(`Deseja ${actionText} todos os ${count} produtos extras de uma só vez?`)) return;
    
    currentUser.products.forEach(p => {
      if ((p.isAvailable !== false) !== available) {
        store.updateProduct(currentUser.id, p.id, { isAvailable: available });
      }
    });
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

    if (confirm(`Deseja transferir R$ ${vendasHoje.toFixed(2)} instantaneamente via PIX para o seu CPF/CNPJ (${targetKey}) cadastrado?\n(Saque ${saquesHoje + 1} de no máximo 2 saques hoje)`)) {
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
  const allFornecedores = Object.values(store.users || {})
    .filter(u => {
      if (u.role !== 'fornecedor' || u.status === 'blocked') return false;
      if (!u.cidade || !currentUser.cidade) return true; // Se alguma das partes estiver sem cidade, mostra mesmo assim para evitar sumiço
      const c1 = u.cidade.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      const c2 = currentUser.cidade.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      return c1 === c2;
    });

  const countAllFornecedores = allFornecedores.length;
  const countOpenFornecedores = allFornecedores.filter(u => u.status !== 'paused').length;
  const countSubsidizedFornecedores = allFornecedores.filter(u => (u.freteSubsidyPct || 0) > 0).length;
  const countStockFornecedores = allFornecedores.filter(u => u.availabilityB2B?.lata !== false || (u.products || []).some(p => p.isAvailable !== false)).length;

  const filteredFornecedores = allFornecedores
    .filter(forn => {
      if (!b2bSearchQuery.trim()) return true;
      const q = b2bSearchQuery.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      const name = (forn.name || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const bairro = (forn.bairro || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const cidade = (forn.cidade || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const productsMatch = (forn.products || []).some(p => (p.name || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(q));
      return name.includes(q) || bairro.includes(q) || cidade.includes(q) || productsMatch;
    })
    .filter(forn => {
      if (b2bSortFilter === 'open') {
        return forn.status !== 'paused';
      }
      if (b2bSortFilter === 'has_stock') {
        return forn.availabilityB2B?.lata !== false || (forn.products || []).some(p => p.isAvailable !== false);
      }
      if (b2bSortFilter === 'subsidy') {
        return (forn.freteSubsidyPct || 0) > 0;
      }
      return true;
    })
    .sort((a, b) => {
      const aOpen = a.status !== 'paused' ? 1 : 0;
      const bOpen = b.status !== 'paused' ? 1 : 0;
      if (aOpen !== bOpen) return bOpen - aOpen;

      const distA = (a.lat && currentUser.lat) ? haversineKm(a.lat, a.lng!, currentUser.lat, currentUser.lng!) : 999;
      const distB = (b.lat && currentUser.lat) ? haversineKm(b.lat, b.lng!, currentUser.lat, currentUser.lng!) : 999;

      if (b2bSortFilter === 'lowest_price') {
        const priceA = a.priceB2B || 9999;
        const priceB = b.priceB2B || 9999;
        return priceA - priceB;
      }
      if (b2bSortFilter === 'subsidy') {
        return (b.freteSubsidyPct || 0) - (a.freteSubsidyPct || 0);
      }
      return distA - distB;
    });

  const bestMarketPrice = allFornecedores.reduce((min, f) => {
    const p = f.priceB2B || 0;
    if (p > 0 && (min === 0 || p < min)) return p;
    return min;
  }, 0);

  const displayedFornecedores = filteredFornecedores.slice(0, b2bVisibleLimit);
  
  const distColeta = (currentUser.lat && store.users?.ecoponto?.lat) ? haversineKm(currentUser.lat, currentUser.lng!, store.users.ecoponto.lat!, store.users.ecoponto.lng!) : 0;
  const freteColeta = (rates.ecopoint_payment_mode === 'FIXED') 
    ? (rates.ecopoint_fixed_fee ?? rates.col_valor ?? 50) 
    : (distColeta > 0 ? (distColeta * (rates.col_km || 0)) : (rates.ecopoint_fixed_fee ?? rates.col_valor ?? 50));

  const calcFreteB2B = (fornId: string) => {
    const forn = store.users?.[fornId];
    if (!forn) return { freteTotal: 0, freteLoja: 0, subsidy: 0, dist: 3.0 };
    const lat1 = Number(forn?.lat || 0);
    const lon1 = Number(forn?.lng || 0);
    const lat2 = Number(currentUser?.lat || 0);
    const lon2 = Number(currentUser?.lng || 0);
    const dist = (lat1 !== 0 && lon1 !== 0 && lat2 !== 0 && lon2 !== 0) ? haversineKm(lat1, lon1, lat2, lon2) : 3.0;
    const freteTotal = (rates.transporter_payment_mode === 'FIXED') ? (rates.transporter_fixed_fee ?? 150.00) : dist * rates.b2b_km;
    const subsidy = forn.freteSubsidyPct || 0;
    const freteLoja = freteTotal * (1 - subsidy / 100);
    return { freteTotal, freteLoja, subsidy, dist };
  };

  const cartB2BStore = cart.storeId ? store.users[cart.storeId] : null;
  const isB2BCart = cartB2BStore?.role === 'fornecedor';
  const b2bCartItems = isB2BCart ? cart.items : [];
  const b2bCartItemsTotal = b2bCartItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const b2bCartTotalQuantity = b2bCartItems.reduce((acc, item) => acc + item.quantity, 0);
  const b2bCartFreteLoja = (isB2BCart && cart.storeId) ? calcFreteB2B(cart.storeId).freteLoja : 0;
  const b2bFinalCartTotal = b2bCartItemsTotal + b2bCartFreteLoja;

  const handleAddToCartB2B = () => {
    if (!productSelectModalB2B) return;
    const { fornId, productId, name, price, quantity } = productSelectModalB2B;
    const forn = store.users?.[fornId];
    if (!forn) return;

    if (forn.status === 'paused') {
      alert(`⚠️ O fornecedor "${forn.name}" está fechado/pausado no momento e não está aceitando novos pedidos de abastecimento.`);
      return;
    }

    if (cart.storeId && cart.storeId !== fornId && cart.items.length > 0) {
      const fornAtualNome = store.users?.[cart.storeId]?.name || 'outro fornecedor';
      if (!confirm(`⚠️ Seu carrinho possui itens do fornecedor "${fornAtualNome}". Você só pode comprar de um fornecedor por vez.\n\nDeseja limpar o carrinho anterior e adicionar os itens de "${forn.name}"?`)) {
        return;
      }
      clearCart();
    }

    addToCart(fornId, { id: productId, name, price, quantity });
    setProductSelectModalB2B(null);
  };

  const handleConfirmB2BOrder = async () => {
    if (!cart.storeId || b2bCartItems.length === 0) return;
    const fornId = cart.storeId;
    const forn = store.users?.[fornId];
    if (forn?.status === 'paused') {
      alert(`⚠️ O fornecedor "${forn.name || 'selecionado'}" está fechado no momento. Não é possível concluir o pedido de abastecimento.`);
      return;
    }
    const res: any = await store.criarPedido('B2B', fornId);
    setB2bCheckoutModalOpen(false);

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
            totalValue: res.totalValue || b2bFinalCartTotal
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
  };

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
                      const allUsersWithCurrent = currentUser ? { ...store.users, [currentUser.id]: currentUser } : store.users;
                      printOrderTicket(o, currentUser?.name || 'Loja/Batedeira AçaíFood', printerConfig, allUsersWithCurrent, null, pType, 'MANUAL');
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
    <PartnerActivationGuard roleName="Batedeira / Loja">
      <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 pb-24">
      <PartnerManualModal isOpen={partnerManualOpen} onClose={() => setPartnerManualOpen(false)} role="batedeira" />
      <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 p-4 sticky top-0 z-30">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 max-w-5xl mx-auto w-full">
          <div className="flex items-center gap-3">
            <Store className="text-purple-600 shrink-0" />
            <div>
              <h1 className="text-xl font-bold text-zinc-900 dark:text-white">Painel da Loja</h1>
              <AsaasPartnerBadge variant="inline" />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 items-center justify-start sm:justify-end w-full sm:w-auto">
            {currentUser.asaasLinked && (
               <span className="text-[10px] bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 px-2 py-1 rounded-lg font-bold border border-purple-200 dark:border-purple-800">Asaas Ativo ✅</span>
            )}
            <button 
              onClick={() => setPrinterModalOpen(true)} 
              className="text-xs bg-purple-100 hover:bg-purple-200 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 shadow-sm transition-all border border-purple-200 dark:border-purple-800 cursor-pointer active:scale-95"
              title="Configurar Impressora Térmica"
            >
              <Printer size={13} /> Impressora
            </button>
            <button 
              onClick={handleRefresh} 
              disabled={isRefreshing}
              className="text-xs bg-indigo-100 hover:bg-indigo-200 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 shadow-sm transition-all active:scale-95 disabled:opacity-60 cursor-pointer"
              title="Atualizar dados e pedidos da loja"
            >
              <span className={isRefreshing ? "animate-spin inline-block" : "inline-block"}>🔄</span> {isRefreshing ? "Atualizando..." : "Atualizar"}
            </button>
            <button 
              onClick={() => setPartnerManualOpen(true)} 
              className="text-xs bg-amber-100 hover:bg-amber-200 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 shadow-sm transition-all active:scale-95 cursor-pointer"
            >
              <BookOpen size={13} /> Manual
            </button>
            <button 
              onClick={() => setShareLandingModalOpen(true)}
              className="text-xs bg-pink-100 hover:bg-pink-200 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 shadow-sm transition-all border border-pink-200 dark:border-pink-800 active:scale-95 cursor-pointer"
              title="Compartilhar apresentação e vendas do AçaíFood"
            >
              <Share2 size={13} /> Compartilhar
            </button>
            <ThemeToggle />
            <button 
              onClick={() => { store.logout(); router.push('/login'); }} 
              className="text-xs sm:text-sm font-bold text-red-600 hover:text-red-800 ml-1 underline cursor-pointer"
            >
              Sair
            </button>
          </div>
        </div>
      </header>
      <PartnerShareModal 
        isOpen={shareLandingModalOpen} 
        onClose={() => setShareLandingModalOpen(false)} 
        storeId={currentUser.id} 
        storeName={currentUser.name} 
        role="loja" 
      />
      
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
        
        {/* Card de Divulgação e Cardápio Digital Próprio */}
        <StoreShareCard 
          storeId={currentUser.id} 
          storeName={currentUser.name} 
          role="loja" 
        />

        {/* Banner Cofre Virtual & Pix Automático (Sempre Visível) */}
        <div className="bg-purple-900 text-white p-5 rounded-2xl shadow flex justify-between items-center border border-purple-800">
            <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-bold">🏪 {currentUser.name}</h2>
                  <button
                    onClick={async () => {
                      const newName = prompt("Digite o novo nome da sua Loja / Batedeira:", currentUser.name);
                      if (newName === null) return;
                      const clean = newName.trim();
                      if (!clean) {
                        alert("O nome da loja não pode ficar em branco.");
                        return;
                      }
                      try {
                        await store.updateUserName(currentUser.id, clean);
                        alert(`✅ Nome da loja alterado para "${clean}" com sucesso!`);
                      } catch (err: any) {
                        alert("Erro ao alterar nome da loja: " + (err?.message || "Tente novamente."));
                      }
                    }}
                    className="text-[11px] bg-purple-800/90 hover:bg-purple-700 text-purple-200 hover:text-white px-2 py-0.5 rounded-lg border border-purple-600 transition shadow flex items-center gap-1 active:scale-95"
                    title="Editar nome do seu estabelecimento"
                  >
                    ✏️ Trocar Nome
                  </button>

                  <button
                    onClick={handleToggleStatus}
                    className={`text-xs font-black px-3 py-1 rounded-lg border transition shadow flex items-center gap-1 cursor-pointer active:scale-95 ${
                      isPaused
                        ? 'bg-red-600 hover:bg-red-700 text-white border-red-400 animate-pulse'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-400'
                    }`}
                    title={isPaused ? "Sua loja está fechada. Clique para abrir e receber pedidos." : "Sua loja está aberta recebendo pedidos. Clique para pausar/fechar."}
                  >
                    {isPaused ? '🔴 Loja Fechada (Abrir)' : '🟢 Loja Aberta'}
                  </button>
                </div>
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
                      const currentPix = (currentUser.cpfCnpj || (currentUser as any).cpf_cnpj || currentUser.pixKey || (currentUser as any).pix_key || '').replace(/\D/g, '').trim();
                      const newPix = prompt("Conforme regra do Banco Central e Asaas, sua Chave Pix deve ser o CPF ou CNPJ do Titular da Conta:\n\nInforme seu CPF ou CNPJ (somente números):", currentPix);
                      if (newPix === null) return;
                      const cleanPix = newPix.replace(/\D/g, '').trim();
                      if (!cleanPix || (cleanPix.length !== 11 && cleanPix.length !== 14)) {
                        alert("A Chave Pix obrigatória deve ter 11 dígitos (CPF) ou 14 dígitos (CNPJ).");
                        return;
                      }
                      try {
                        await store.updateUserPixKey(currentUser.id, cleanPix);
                        alert("✅ Sua Chave Pix CPF/CNPJ foi atualizada com sucesso!");
                      } catch (err: any) {
                        alert("Erro ao salvar Chave Pix: " + err.message);
                      }
                    }}
                    className="text-[10px] bg-purple-800/90 hover:bg-purple-700 text-purple-200 hover:text-white font-bold px-2.5 py-1 rounded-lg border border-purple-600 transition shadow flex items-center gap-1 active:scale-95"
                    title="Chave Pix vinculada ao seu CPF/CNPJ"
                  >
                    🔑 PIX (CPF): {(currentUser.cpfCnpj || (currentUser as any).cpf_cnpj || currentUser.pixKey || (currentUser as any).pix_key) ? (currentUser.cpfCnpj || (currentUser as any).cpf_cnpj || currentUser.pixKey || (currentUser as any).pix_key) : 'Cadastrar'} 🔒
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
          <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
            {/* Controles da Loja e Status Geral */}
            <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 flex flex-col gap-4">
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
                    className={`px-4 py-2.5 rounded-xl text-xs font-black transition shadow-sm border flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                      isPaused 
                        ? 'bg-red-500 hover:bg-red-600 text-white border-red-400 animate-pulse' 
                        : 'bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-400'
                    }`}
                  >
                    {isPaused ? '🔴 Loja Fechada (Clique para Abrir)' : '🟢 Loja Aberta (Recebendo Pedidos)'}
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

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {(['popular', 'medio', 'grosso', 'branco'] as const).map((tipo) => {
                    const label = tipo === 'popular' ? 'Açaí Popular' : tipo === 'medio' ? 'Açaí Médio' : tipo === 'grosso' ? 'Açaí Grosso' : 'Açaí Branco';
                    const price = prices[tipo] || (tipo === 'popular' ? 20 : tipo === 'medio' ? 26 : tipo === 'grosso' ? 35 : 38);
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
                            <p className="font-extrabold text-sm sm:text-base text-zinc-900 dark:text-white truncate">{label}</p>
                            <p className="text-base sm:text-lg font-black text-zinc-950 dark:text-white mt-0.5 tracking-tight">R$ {price.toFixed(2)}</p>
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

            {/* Barra de Ajustes Operacionais (Frete e Logística Reversa) */}
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Participação no Frete */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/40">
                <div>
                  <h4 className="font-bold text-xs uppercase text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                    <span>🚚</span> Participação no Frete (%)
                  </h4>
                  <p className="text-[11px] text-zinc-500 mt-0.5">Subsidie parte da entrega para aumentar as vendas da sua loja.</p>
                </div>
                <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
                  <span className="text-xs font-bold text-zinc-500">Paga:</span>
                  <input 
                    type="number" 
                    min="0" 
                    max="100" 
                    value={subsidyInput} 
                    onChange={e => setSubsidyInput(e.target.value)} 
                    className="w-14 border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded-lg py-1.5 text-center font-bold text-xs outline-none focus:ring-2 focus:ring-purple-500" 
                  />
                  <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400">%</span>
                  <button 
                    onClick={handleSaveSubsidy} 
                    className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-xs"
                  >
                    Salvar
                  </button>
                </div>
              </div>

              {/* Logística Reversa */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200/80 dark:border-zinc-800">
                <div>
                  <h4 className="font-bold text-xs uppercase text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                    <span>🚛</span> Logística Reversa (Caroço)
                  </h4>
                  <p className="text-[11px] text-zinc-500 mt-0.5">Descarte sustentável no Ecoponto.</p>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
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
                    className="text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded-lg border border-blue-200 dark:border-blue-800"
                  >
                    🗺️ {distColeta.toFixed(1)} km
                  </button>
                  
                  {(() => {
                      const activeColeta = (store.orders || []).find(o => 
                        o.type === 'COLETA' && 
                        (o.origemId === currentUser.id || o.lojaId === currentUser.id || o.criadoPor === currentUser.id || (o as any).buyerId === currentUser.id || (o as any).seller_storefront_id === currentUser.id || (currentUser as any).storefrontId === (o as any).seller_storefront_id) && 
                        o.status !== 'entregue' && o.status !== 'arquivado' && o.status !== 'cancelado'
                      );
                      
                      if (activeColeta) {
                          const statusText = activeColeta.status === 'aguardando_pagamento' ? 'Aguardando Pagamento Pix' :
                                             (activeColeta.status === 'pendente' || activeColeta.status === 'pronto') ? (activeColeta.motoristaId ? 'Caçamba a Caminho' : 'Aguardando Caçamba Aceitar') :
                                             activeColeta.status === 'em_rota' ? 'Caçamba a Caminho' : 'Em Andamento';
                          return (
                              <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="text-[11px] font-bold bg-amber-100 text-amber-800 px-2 py-1 rounded-lg border border-amber-200 shadow-xs animate-pulse">🚛 {statusText}</span>
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
                                        className="text-[11px] font-bold bg-purple-600 hover:bg-purple-700 text-white px-2 py-1 rounded-lg shadow-xs flex items-center gap-1"
                                      >
                                        ⚡ Pix
                                      </button>
                                  )}
                                  {activeColeta.deliveryPin && (
                                      <span className="text-[11px] font-black bg-purple-700 text-white px-2 py-1 rounded-md border border-purple-500 tracking-wider">
                                          PIN: {activeColeta.deliveryPin}
                                      </span>
                                  )}
                                  <button onClick={() => store.acaoPedido(activeColeta.id, 'cancelar_pedido')} className="text-[11px] text-red-500 hover:text-red-700 font-bold bg-red-50 px-2 py-1 rounded-lg border border-red-100">Cancelar</button>
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
                                   alert(`Aviso do Asaas: ${res.error}`);
                                } else {
                                   alert('✅ Chamada de caçamba registrada com sucesso!');
                                }
                              } else if (typeof res === 'string' && res.startsWith('http')) {
                                window.location.href = res;
                              } else {
                                alert('✅ Chamada de caçamba registrada com sucesso!');
                              }
                          }} className="bg-amber-100 hover:bg-amber-200 text-amber-800 font-bold py-1.5 px-3 rounded-lg border border-amber-300 transition text-xs shadow-xs">
                              🚛 Chamar Caçamba ({formatMoney(freteColeta)})
                          </button>
                      );
                  })()}
                </div>
              </div>
            </div>

            {/* PRODUTOS EXTRAS & ADICIONAIS - VISÃO TOTALMENTE LARGA E AMPLA */}
            <div className="bg-white dark:bg-zinc-900 p-5 sm:p-6 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 flex flex-col gap-4">
              {/* Header com Totais e Ações Rápidas */}
              <div className="border-b border-zinc-100 dark:border-zinc-800 pb-3 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">📦</span>
                    <h3 className="font-extrabold text-zinc-900 dark:text-zinc-100 text-base sm:text-lg uppercase tracking-tight">
                      Produtos Extras & Cardápio Completo
                    </h3>
                    <span className="bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 font-black text-xs px-2.5 py-0.5 rounded-full">
                      {(currentUser?.products || []).length} { (currentUser?.products || []).length === 1 ? 'item' : 'itens' }
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">
                    Farinhas, acompanhamentos, churrasco, carnes, bebidas e porções com controle de estoque e fotos.
                  </p>
                </div>

                {/* Ações em Lote */}
                {(currentUser?.products?.length || 0) > 0 && (
                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <button
                      type="button"
                      onClick={() => handleBulkToggleExtras(true)}
                      className="px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 text-xs font-bold flex items-center gap-1.5 transition shadow-xs active:scale-95"
                      title="Marcar todos os produtos extras como disponíveis"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Todos Ativos
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBulkToggleExtras(false)}
                      className="px-3 py-2 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 hover:bg-red-100 text-xs font-bold flex items-center gap-1.5 transition shadow-xs active:scale-95"
                      title="Pausar todos os extras (ex: ao encerrar estoque)"
                    >
                      <XCircle className="w-4 h-4" />
                      Todos Esgotados
                    </button>
                  </div>
                )}
              </div>

              {/* Sugestões Rápidas de 1 Clique (Preset Chips) */}
              <div className="bg-gradient-to-br from-purple-50/80 via-indigo-50/40 to-pink-50/30 dark:from-purple-950/40 dark:via-zinc-900 dark:to-zinc-950 p-4 rounded-2xl border border-purple-100 dark:border-purple-900/50">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 mb-3">
                  <span className="text-xs font-black text-purple-900 dark:text-purple-300 uppercase flex items-center gap-1.5 tracking-wider shrink-0">
                    <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                    Adicionar Rápido com 1 Clique (Sugestões Regionais)
                  </span>

                  {/* Tabs de Categoria dos Presets */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {QUICK_EXTRAS_CATEGORIES.map(cat => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setExtraPresetCategory(cat.id as any)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition cursor-pointer shrink-0 ${
                          extraPresetCategory === cat.id
                            ? 'bg-purple-600 text-white shadow-xs'
                            : 'bg-white/90 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-purple-100 dark:hover:bg-zinc-700 border border-zinc-200/70 dark:border-zinc-700'
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Chips de Produtos Pré-definidos */}
                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto pr-1">
                  {QUICK_EXTRAS_PRESETS.filter(p => p.category === extraPresetCategory).map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setNewProductName(preset.name);
                        setNewProductPrice(preset.price.toString());
                        setNewProductDesc(preset.description || '');
                      }}
                      className="group flex items-center gap-2 bg-white dark:bg-zinc-800 hover:bg-purple-50 dark:hover:bg-purple-950/60 border border-purple-200/90 dark:border-purple-800/60 hover:border-purple-400 px-3 py-2 rounded-xl text-xs font-bold text-zinc-800 dark:text-zinc-200 transition shadow-xs hover:shadow-sm cursor-pointer active:scale-95"
                      title={`Clique para preencher "${preset.name}" por R$ ${preset.price.toFixed(2)}: ${preset.description || ''}`}
                    >
                      <span className="text-base">{preset.icon}</span>
                      <span>{preset.name}</span>
                      <span className="font-black text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/60 px-2 py-0.5 rounded-md text-[11px]">
                        R$ {preset.price.toFixed(2)}
                      </span>
                      <span className="text-purple-600 text-[11px] font-black opacity-60 group-hover:opacity-100">
                        ⚡
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
                      title: 'Foto do Produto Extra',
                      category: 'adicional',
                      currentUrl: newProductImage,
                      onSelect: (url) => setNewProductImage(url)
                    })}
                    className="w-full sm:w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/60 hover:bg-purple-200 text-purple-700 dark:text-purple-300 flex items-center justify-center shrink-0 border border-purple-300 dark:border-purple-700 transition"
                    title="Escolher Foto do Produto"
                  >
                    {newProductImage ? (
                      <img src={newProductImage} alt="Foto" className="w-full h-full object-cover rounded-xl" />
                    ) : (
                      <span className="text-lg">📸</span>
                    )}
                  </button>
                  <div className="relative flex-1 w-full">
                    <input 
                      type="text" 
                      placeholder="Nome do produto extra (ex: Churrasco Misto, Farinha de Tapioca...)" 
                      value={newProductName} 
                      onChange={e => setNewProductName(e.target.value)} 
                      className="w-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded-xl py-3 px-3.5 text-xs sm:text-sm outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 font-medium" 
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
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-xs sm:text-sm font-bold">R$</span>
                    <input 
                      type="number" 
                      step="0.01" 
                      placeholder="0,00" 
                      value={newProductPrice} 
                      onChange={e => setNewProductPrice(e.target.value)} 
                      className="w-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded-xl py-3 pl-9 pr-3 text-xs sm:text-sm outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 font-bold" 
                    />
                  </div>
                  <button 
                    type="submit"
                    disabled={!newProductName.trim() || !newProductPrice}
                    className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black px-6 py-3 rounded-xl text-xs sm:text-sm transition shrink-0 shadow-sm flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    Cadastrar Produto
                  </button>
                </div>
                <div className="w-full">
                  <input
                    type="text"
                    placeholder="Descrição / Detalhes (ex: Porção 300g, acompanha farofa e vinagrete...)"
                    value={newProductDesc}
                    onChange={e => setNewProductDesc(e.target.value)}
                    className="w-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded-xl py-2 px-3.5 text-xs outline-none focus:border-purple-500 font-normal text-zinc-700 dark:text-zinc-300"
                  />
                </div>
              </form>

              {/* Barra de Busca e Filtros de Status */}
              <div className="flex flex-col sm:flex-row gap-2.5 justify-between items-center bg-zinc-50 dark:bg-zinc-950/40 p-2.5 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                <div className="relative w-full sm:w-80">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    placeholder="Buscar nos seus produtos extras..."
                    value={extraSearchQuery}
                    onChange={(e) => setExtraSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs sm:text-sm outline-none focus:border-purple-500"
                  />
                  {extraSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setExtraSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
                  <button
                    type="button"
                    onClick={() => setExtraFilterStatus('all')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                      extraFilterStatus === 'all'
                        ? 'bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xs'
                        : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800'
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
                    🟢 Ativos ({(currentUser?.products || []).filter(p => p.isAvailable !== false).length})
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
                    🔴 Esgotados ({(currentUser?.products || []).filter(p => p.isAvailable === false).length})
                  </button>
                </div>
              </div>

              {/* Grid de Cards de Produtos Extras (Visão Ampla e Larga) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 max-h-[580px] overflow-y-auto pr-1">
                {[...(currentUser?.products || [])]
                  .filter(p => {
                    if (extraFilterStatus === 'available' && p.isAvailable === false) return false;
                    if (extraFilterStatus === 'unavailable' && p.isAvailable !== false) return false;
                    if (extraSearchQuery.trim()) {
                      const q = extraSearchQuery.toLowerCase().trim();
                      return p.name.toLowerCase().includes(q);
                    }
                    return true;
                  })
                  .sort((a, b) => ((b.isAvailable !== false ? 1 : 0) - (a.isAvailable !== false ? 1 : 0)))
                  .map(p => {
                    const isAvail = p.isAvailable !== false;
                    return (
                      <div 
                        key={p.id} 
                        className={`p-3.5 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                          isAvail
                            ? 'bg-white dark:bg-zinc-900/90 border-zinc-200 dark:border-zinc-800 hover:border-purple-300 dark:hover:border-purple-700/60 shadow-xs hover:shadow-md'
                            : 'bg-zinc-50 dark:bg-zinc-950/60 border-zinc-200/60 dark:border-zinc-800/60 opacity-60'
                        }`}
                      >
                        {/* Topo do Card: Foto + Nome + Preço */}
                        <div className="flex items-center gap-3 min-w-0">
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
                            className="w-14 h-14 rounded-xl bg-zinc-100 dark:bg-zinc-800 overflow-hidden shrink-0 border border-zinc-200 dark:border-zinc-700 cursor-pointer flex items-center justify-center hover:opacity-80 transition relative group"
                            title="Clique para alterar foto"
                          >
                            {p.imageUrl ? (
                              <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition" />
                            ) : (
                              <span className="text-2xl">📦</span>
                            )}
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-bold">
                              ✏️
                            </div>
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className={`font-extrabold text-sm sm:text-base leading-tight line-clamp-2 ${isAvail ? 'text-zinc-900 dark:text-white' : 'text-zinc-400 line-through'}`} title={p.name}>
                              {p.name}
                            </p>
                            <p className="text-base sm:text-lg font-black text-purple-700 dark:text-purple-400 mt-1 tracking-tight">
                              R$ {p.price.toFixed(2)}
                            </p>
                            {p.description && (
                              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-2 mt-1 leading-snug italic" title={p.description}>
                                📝 {p.description}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Rodapé do Card: Switch de Disponibilidade + Botões de Ação */}
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
                            {isAvail ? '🟢 Ativo' : '🔴 Esgotado'}
                          </button>

                          <div className="flex items-center gap-1 shrink-0">
                            <button 
                              type="button"
                              onClick={() => handleOpenEditProduct(p)} 
                              className="text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-200 p-2 bg-purple-50 dark:bg-purple-900/30 rounded-xl border border-purple-200 dark:border-purple-800/60 transition shadow-xs cursor-pointer active:scale-95" 
                              title="Editar nome, preço e foto"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              type="button"
                              onClick={() => { if (confirm(`Deseja excluir "${p.name}"?`)) store.removeProduct(currentUser.id, p.id); }} 
                              className="text-red-500 hover:text-red-700 p-2 bg-red-50 dark:bg-red-900/30 rounded-xl border border-red-200 dark:border-red-800/60 transition shadow-xs cursor-pointer active:scale-95" 
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
                <div className="text-center py-10 text-zinc-400 bg-zinc-50/50 dark:bg-zinc-950/30 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800">
                  <p className="text-3xl mb-2">🧺</p>
                  <p className="text-sm font-bold text-zinc-600 dark:text-zinc-300">Nenhum produto extra cadastrado ainda.</p>
                  <p className="text-xs text-purple-600 dark:text-purple-400 mt-1 font-semibold">Clique nos botões de 1 clique acima para adicionar rapidamente Farinhas, Churrascos, Bebidas e Porções!</p>
                </div>
              )}
            </div>
          </div>
        )}
          
        {activeTab === 'abastecimento' && (
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
            {/* Header com Contexto */}
            <div className="bg-gradient-to-r from-emerald-900 via-zinc-900 to-teal-950 rounded-2xl p-5 text-white shadow-lg border border-emerald-500/30 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🌿</span>
                  <h3 className="font-extrabold text-lg text-white">Abastecimento B2B & Fornecedores</h3>
                </div>
                <p className="text-emerald-200 text-xs mt-1">
                  Compre Paneiros/Latas de Frutos In Natura e Insumos direto de portos, cooperativas e produtores cadastrados.
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {bestMarketPrice > 0 && (
                  <span className="bg-emerald-400/20 border border-emerald-300/30 text-emerald-200 text-xs px-3 py-1.5 rounded-full font-bold">
                    🔥 Menor cotação: {formatMoney(bestMarketPrice)}/lata
                  </span>
                )}
                <span className="bg-emerald-500/30 border border-emerald-400/30 text-emerald-100 text-xs px-3 py-1.5 rounded-full font-bold self-start sm:self-auto shrink-0">
                  {allFornecedores.length} {allFornecedores.length === 1 ? 'Fornecedor' : 'Fornecedores'}
                </span>
              </div>
            </div>

            {selectedFornecedorId && store.users?.[selectedFornecedorId] ? (() => {
              const selForn = store.users[selectedFornecedorId];
              const { freteTotal, freteLoja, subsidy, dist } = calcFreteB2B(selForn.id);
              const isCartForn = cart.storeId === selForn.id && b2bCartItems.length > 0;
              const isPaused = selForn.status === 'paused';
              const defaultB2BImage = 'https://images.unsplash.com/photo-1628557044797-f21a177c37ec?auto=format&fit=crop&w=400&q=80';

              return (
                <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 shadow-sm border border-emerald-200 dark:border-emerald-900/40 mb-6">
                  {/* Topo do Fornecedor Selecionado */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-zinc-200 dark:border-zinc-800 pb-4 mb-4">
                    <div className="flex items-center gap-3">
                      <span className="text-4xl bg-emerald-50 dark:bg-emerald-950/50 p-2 rounded-2xl border border-emerald-200 dark:border-emerald-800/50">
                        {selForn.icon || '🏭'}
                      </span>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
                            🏭 Fornecedor Selecionado
                          </span>
                          <span className="text-[10px] bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 border border-teal-200 dark:border-teal-800 px-2 py-0.5 rounded-full font-bold">
                            🌿 Fruto Fresco do Dia
                          </span>
                        </div>
                        <h3 className="text-xl font-extrabold text-zinc-900 dark:text-white leading-tight mt-0.5">
                          {selForn.name}
                        </h3>
                        <p className="text-xs text-zinc-500">
                          📍 Bairro: {selForn.bairro || 'Central'} • {selForn.cidade || currentUser?.cidade || 'Região'} ★ 4.9
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                      <button 
                        onClick={() => {
                          setMapModal({
                            open: true,
                            origem: { lat: selForn?.lat || 0, lng: selForn?.lng || 0, name: selForn.name || 'Fornecedor' },
                            destino: { lat: currentUser?.lat || 0, lng: currentUser?.lng || 0, name: currentUser.name || 'Sua Loja' },
                            motorista: null
                          });
                        }} 
                        className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 px-3 py-2 rounded-xl transition border border-blue-200 dark:border-blue-800 flex items-center gap-1 shadow-xs"
                      >
                        🗺️ Rota: {dist.toFixed(1)} km
                      </button>

                      <button 
                        onClick={() => setSelectedFornecedorId(null)}
                        className="text-xs bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 hover:dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold px-3 py-2 rounded-xl transition cursor-pointer"
                      >
                        ⬅️ Ver Todos os Fornecedores
                      </button>
                    </div>
                  </div>

                  {isPaused && (
                    <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 p-3.5 rounded-xl mb-4 flex items-center gap-2.5 text-red-700 dark:text-red-300 text-xs font-bold shadow-xs">
                      <span className="text-base">⛔</span>
                      <span>Este fornecedor está <strong>fechado/pausado no momento</strong> e não está recebendo pedidos de abastecimento.</span>
                    </div>
                  )}

                  <div className="bg-emerald-50 dark:bg-emerald-950/30 p-3 rounded-xl mb-4 border border-emerald-100 dark:border-emerald-900/30 flex justify-between items-center text-xs text-emerald-900 dark:text-emerald-300 font-medium">
                    <span>Frete Caminhão/Caçamba: <strong>{formatMoney(freteLoja)}</strong></span>
                    {subsidy > 0 && <span className="bg-orange-100 text-orange-800 font-bold px-2 py-0.5 rounded text-[10px] uppercase">Fornecedor Paga {subsidy}%</span>}
                  </div>

                  {isCartForn && (
                    <div className="bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 p-3 rounded-xl flex items-center justify-between gap-2 text-xs font-bold mb-4">
                      <span className="text-emerald-900 dark:text-emerald-300">
                        🛒 Você tem {b2bCartTotalQuantity} item(ns) no carrinho deste fornecedor ({formatMoney(b2bCartItemsTotal)})
                      </span>
                      <button 
                        onClick={() => setB2bCheckoutModalOpen(true)} 
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-3.5 py-1.5 rounded-lg shadow transition shrink-0"
                      >
                        Finalizar Pedido B2B
                      </button>
                    </div>
                  )}

                  <h4 className="font-bold text-sm text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    📦 Catálogo de Matéria-Prima & Insumos
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                    {(() => {
                      const isLataAvail = selForn.availabilityB2B?.lata !== false;
                      const lataPhoto = selForn.imagesB2B?.lata || defaultB2BImage;
                      const priceLata = selForn.priceB2B || 140;

                      const b2bItems = [
                        {
                          id: 'base',
                          name: 'Paneiro / Lata de Açaí Fruto',
                          desc: 'Frutos in natura em caroço',
                          price: priceLata,
                          unit: '/ lata',
                          isAvail: isLataAvail,
                          photo: lataPhoto,
                          emoji: '🌴'
                        },
                        ...(selForn.products || []).map(p => ({
                          id: p.id,
                          name: p.name,
                          desc: 'Insumo / Produto B2B',
                          price: p.price,
                          unit: '',
                          isAvail: p.isAvailable !== false,
                          photo: p.imageUrl,
                          emoji: '📦'
                        }))
                      ].sort((a, b) => (b.isAvail ? 1 : 0) - (a.isAvail ? 1 : 0));

                      return b2bItems.map(item => {
                        const canOrder = item.isAvail && !isPaused;
                        return (
                        <div key={item.id} className={`p-3.5 rounded-2xl border transition-all flex justify-between items-center gap-3 ${
                          canOrder 
                            ? 'bg-white dark:bg-zinc-900 border-emerald-200 dark:border-emerald-800 shadow-sm' 
                            : 'bg-zinc-100/80 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 opacity-60'
                        }`}>
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-14 h-14 rounded-xl bg-emerald-100 dark:bg-emerald-950 overflow-hidden shrink-0 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center">
                              {item.photo ? (
                                <img src={item.photo} alt={item.name} className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-2xl">{item.emoji}</span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="font-extrabold text-zinc-950 dark:text-white text-base sm:text-lg leading-tight truncate">{item.name}</p>
                                {!item.isAvail && <span className="text-[9px] bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400 font-extrabold px-1.5 py-0.5 rounded uppercase">Esgotado</span>}
                                {isPaused && <span className="text-[9px] bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400 font-extrabold px-1.5 py-0.5 rounded uppercase">Fechado</span>}
                              </div>
                              <p className="text-[11px] text-zinc-500 font-medium">{item.desc}</p>
                              <p className="text-base sm:text-lg font-black text-zinc-950 dark:text-white mt-0.5 tracking-tight">{formatMoney(item.price)} {item.unit && <span className="text-xs font-normal text-zinc-400">{item.unit}</span>}</p>
                            </div>
                          </div>
                          {canOrder ? (
                            <button 
                              onClick={() => {
                                if (cart.storeId && cart.storeId !== selForn.id && cart.items.length > 0) {
                                  const fornAtualNome = store.users?.[cart.storeId]?.name || 'outro fornecedor';
                                  if (!confirm(`⚠️ Seu carrinho possui itens do fornecedor "${fornAtualNome}". Você só pode comprar de um fornecedor por vez.\n\nDeseja limpar o carrinho anterior e adicionar os itens de "${selForn.name}"?`)) {
                                    return;
                                  }
                                  clearCart();
                                }
                                setProductSelectModalB2B({
                                  open: true,
                                  fornId: selForn.id,
                                  productId: item.id,
                                  name: item.name,
                                  price: item.price,
                                  imageUrl: item.photo,
                                  quantity: 1
                                });
                              }}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition shadow shrink-0 active:scale-95 cursor-pointer"
                            >
                              + Adicionar
                            </button>
                          ) : (
                            <span className="text-[10px] font-bold text-zinc-400 bg-zinc-200 dark:bg-zinc-800 px-2.5 py-1.5 rounded-lg shrink-0">
                              {isPaused ? 'Fornecedor Fechado' : 'Esgotado'}
                            </span>
                          )}
                        </div>
                      );
                      });
                    })()}
                  </div>
                </div>
              );
            })() : (
              <>
                {/* Barra de Busca & Filtros Rápidos B2B */}
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm space-y-3">
                  <div className="relative flex items-center">
                    <span className="absolute left-3.5 text-zinc-400 text-base">🔍</span>
                    <input
                      type="text"
                      placeholder="Buscar fornecedor por nome, bairro, cidade ou insumos..."
                      value={b2bSearchQuery}
                      onChange={(e) => {
                        setB2bSearchQuery(e.target.value);
                        setB2bVisibleLimit(12);
                      }}
                      className="w-full pl-10 pr-10 py-2.5 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                    />
                    {b2bSearchQuery && (
                      <button
                        onClick={() => {
                          setB2bSearchQuery('');
                          setB2bVisibleLimit(12);
                        }}
                        className="absolute right-3 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 text-xs"
                        title="Limpar busca"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Chips de Filtragem e Ordenação B2B */}
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs scrollbar-none">
                    <button
                      onClick={() => { setB2bSortFilter('all'); setB2bVisibleLimit(12); }}
                      className={`px-3 py-1.5 rounded-full font-bold whitespace-nowrap transition-all border ${
                        b2bSortFilter === 'all'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                          : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                      }`}
                    >
                      🏢 Todos ({countAllFornecedores})
                    </button>
                    <button
                      onClick={() => { setB2bSortFilter('open'); setB2bVisibleLimit(12); }}
                      className={`px-3 py-1.5 rounded-full font-bold whitespace-nowrap transition-all border ${
                        b2bSortFilter === 'open'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                          : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                      }`}
                    >
                      🟢 Abertos Agora ({countOpenFornecedores})
                    </button>
                    <button
                      onClick={() => { setB2bSortFilter('lowest_price'); setB2bVisibleLimit(12); }}
                      className={`px-3 py-1.5 rounded-full font-bold whitespace-nowrap transition-all border ${
                        b2bSortFilter === 'lowest_price'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                          : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                      }`}
                    >
                      💲 Menor Preço da Lata
                    </button>
                    <button
                      onClick={() => { setB2bSortFilter('nearest'); setB2bVisibleLimit(12); }}
                      className={`px-3 py-1.5 rounded-full font-bold whitespace-nowrap transition-all border ${
                        b2bSortFilter === 'nearest'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                          : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                      }`}
                    >
                      📍 Mais Próximos
                    </button>
                    <button
                      onClick={() => { setB2bSortFilter('subsidy'); setB2bVisibleLimit(12); }}
                      className={`px-3 py-1.5 rounded-full font-bold whitespace-nowrap transition-all border ${
                        b2bSortFilter === 'subsidy'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                          : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                      }`}
                    >
                      ⚡ Frete Promocional ({countSubsidizedFornecedores})
                    </button>
                    <button
                      onClick={() => { setB2bSortFilter('has_stock'); setB2bVisibleLimit(12); }}
                      className={`px-3 py-1.5 rounded-full font-bold whitespace-nowrap transition-all border ${
                        b2bSortFilter === 'has_stock'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                          : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                      }`}
                    >
                      📦 Com Fruto Disponível ({countStockFornecedores})
                    </button>
                  </div>

                  {(b2bSearchQuery || b2bSortFilter !== 'all') && (
                    <div className="text-xs text-zinc-500 flex items-center justify-between pt-1 border-t border-zinc-100 dark:border-zinc-800">
                      <span>Encontrado(s): <strong>{filteredFornecedores.length}</strong> fornecedor(es)</span>
                      <button
                        onClick={() => {
                          setB2bSearchQuery('');
                          setB2bSortFilter('all');
                          setB2bVisibleLimit(12);
                        }}
                        className="text-emerald-600 hover:underline font-bold"
                      >
                        Limpar filtros
                      </button>
                    </div>
                  )}
                </div>

                {/* Grade de Cards Responsiva dos Fornecedores (4 Colunas) */}
                {filteredFornecedores.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-10 bg-white dark:bg-zinc-900 rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-800 text-center shadow-sm">
                    <span className="text-4xl mb-3 opacity-60">🏭</span>
                    <p className="text-zinc-700 dark:text-zinc-300 font-bold text-base">
                      {b2bSearchQuery ? `Nenhum fornecedor encontrado para "${b2bSearchQuery}"` : 'Nenhum fornecedor ativo na sua região no momento'}
                    </p>
                    <p className="text-zinc-500 text-xs mt-1">
                      {b2bSearchQuery ? 'Tente buscar por outro termo ou limpe os filtros aplicados.' : 'Assim que novos produtores ou entrepostos se cadastrarem na sua cidade, eles aparecerão aqui automaticamente.'}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
                    {displayedFornecedores.map(forn => {
                      const { freteTotal, freteLoja, subsidy, dist } = calcFreteB2B(forn.id);
                      const isSelectedForn = cart.storeId === forn.id && b2bCartItems.length > 0;
                      const isFornPaused = forn.status === 'paused';
                      const minTime = Math.max(20, Math.min(60, 20 + Math.round(dist * 3)));
                      const maxTime = Math.max(35, Math.min(85, 35 + Math.round(dist * 3)));

                      return (
                        <div 
                          key={forn.id} 
                          className={`group bg-white dark:bg-zinc-900 p-4 sm:p-5 rounded-2xl shadow-xs border transition-all duration-200 hover:shadow-lg flex flex-col justify-between gap-3 relative overflow-hidden ${
                            isSelectedForn 
                              ? 'border-emerald-500 ring-2 ring-emerald-500/30' 
                              : 'border-zinc-200/90 dark:border-zinc-800/90 hover:border-emerald-400 dark:hover:border-emerald-600'
                          } ${isFornPaused ? 'opacity-70 bg-zinc-50/90 dark:bg-zinc-950/70' : ''}`}
                        >
                          {isSelectedForn && (
                            <div className="absolute top-0 right-0 bg-emerald-600 text-white text-[9px] font-extrabold uppercase px-2.5 py-0.5 rounded-bl-lg shadow-xs">
                              No Carrinho ({b2bCartTotalQuantity})
                            </div>
                          )}

                          <div>
                            {/* TOPO DO CARD: ÍCONE, NOME E DISTÂNCIA */}
                            <div className="flex items-start justify-between gap-2.5 mb-2.5">
                              <div className="flex items-start gap-2.5 min-w-0">
                                <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/70 shrink-0 border border-emerald-100 dark:border-emerald-900/40 flex items-center justify-center text-2xl shadow-xs group-hover:scale-105 transition">
                                  {forn.icon || '🏭'}
                                </div>
                                <div className="min-w-0">
                                  <h4 className="font-extrabold text-zinc-900 dark:text-white text-sm sm:text-base leading-snug truncate" title={forn.name}>
                                    {forn.name}
                                  </h4>
                                  <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 mt-0.5">
                                    <span className="truncate">📍 {forn.bairro || 'Centro'}</span>
                                    <span className="text-amber-500 font-bold shrink-0">★ 4.9</span>
                                  </div>
                                </div>
                              </div>

                              <button 
                                onClick={() => {
                                  setMapModal({
                                    open: true,
                                    origem: { lat: forn?.lat || 0, lng: forn?.lng || 0, name: forn.name || 'Fornecedor' },
                                    destino: { lat: currentUser?.lat || 0, lng: currentUser?.lng || 0, name: currentUser.name || 'Sua Loja' },
                                    motorista: null
                                  });
                                }} 
                                className="text-[11px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 px-2 py-1 rounded-xl shrink-0 transition flex items-center gap-1 border border-blue-200/80 dark:border-blue-800/80 shadow-xs"
                                title="Ver rota no mapa"
                              >
                                🗺️ {dist.toFixed(1)} km
                              </button>
                            </div>

                            {/* BADGES DE STATUS & SUBSÍDIO */}
                            <div className="flex items-center gap-1.5 flex-wrap mb-2.5">
                              {isFornPaused ? (
                                <span className="text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/40 px-2 py-0.5 rounded-md">🔴 Fechado</span>
                              ) : (
                                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900/40 px-2 py-0.5 rounded-md">🟢 Aberto</span>
                              )}
                              {subsidy > 0 && (
                                <span className="text-[10px] font-extrabold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/50 border border-orange-200 dark:border-orange-900/40 px-2 py-0.5 rounded-md">⚡ Frete -{subsidy}%</span>
                              )}
                              <span className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md">⏱️ {minTime}-{maxTime} min</span>
                            </div>

                            {/* BOX DE PREÇOS */}
                            <div className="bg-zinc-100/90 dark:bg-zinc-950 p-3 rounded-xl flex flex-col gap-1.5 mb-2.5 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs">
                              <div className="flex justify-between items-baseline">
                                <span className="text-zinc-600 dark:text-zinc-300 font-bold text-xs sm:text-sm">Lata Açaí:</span>
                                <span className="font-black text-zinc-950 dark:text-white text-base sm:text-lg tracking-tight">
                                  {formatMoney(forn.priceB2B || 140)} <span className="text-xs text-zinc-500 dark:text-zinc-400 font-semibold">/lata</span>
                                </span>
                              </div>
                              <div className="flex justify-between items-center text-xs pt-1 border-t border-zinc-200/60 dark:border-zinc-800/80">
                                <span className="text-zinc-500 dark:text-zinc-400">Frete Caminhão:</span>
                                <span className="font-extrabold text-zinc-900 dark:text-zinc-100 text-xs sm:text-sm">{formatMoney(freteLoja)}</span>
                              </div>
                            </div>

                            {/* TAGS DE PRODUTOS DISPONÍVEIS */}
                            <div className="flex items-center gap-1 flex-wrap">
                              <span className="text-[9px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40 px-1.5 py-0.5 rounded font-bold">
                                🌴 Lata Fruto
                              </span>
                              {forn.products && forn.products.length > 0 && (
                                <span className="text-[9px] bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300 border border-teal-200/60 dark:border-teal-800/40 px-1.5 py-0.5 rounded font-bold">
                                  📦 +{forn.products.length} Insumo(s)
                                </span>
                              )}
                            </div>
                          </div>

                          {/* BOTÃO DE AÇÃO */}
                          {isFornPaused ? (
                            <button 
                              onClick={() => alert(`⚠️ O fornecedor "${forn.name}" está fechado no momento e não está aceitando pedidos agora.`)}
                              className="w-full mt-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700/60 text-zinc-400 dark:text-zinc-500 font-bold py-2.5 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700/60 transition flex justify-center items-center gap-1.5 text-xs"
                            >
                              ⛔ Fechado no Momento
                            </button>
                          ) : (
                            <button 
                              onClick={() => setSelectedFornecedorId(forn.id)} 
                              className="w-full mt-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold py-2.5 px-3 rounded-xl shadow-sm transition-all duration-150 active:scale-98 flex justify-center items-center gap-1.5 text-xs cursor-pointer"
                            >
                              <ShoppingCart size={14} /> Ver Catálogo & Pedir
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* BOTÃO CARREGAR MAIS (+12) */}
                {filteredFornecedores.length > b2bVisibleLimit && (
                  <div className="flex flex-col items-center justify-center pt-4 pb-2 gap-2">
                    <p className="text-xs text-zinc-500">
                      Exibindo <strong>{displayedFornecedores.length}</strong> de <strong>{filteredFornecedores.length}</strong> fornecedores
                    </p>
                    <button
                      onClick={() => setB2bVisibleLimit(prev => prev + 12)}
                      className="px-6 py-2.5 bg-white dark:bg-zinc-900 border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-xl text-xs font-extrabold transition shadow-sm active:scale-95 cursor-pointer"
                    >
                      ➕ Carregar Mais Fornecedores (+12)
                    </button>
                  </div>
                )}
              </>
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
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] border border-zinc-200 dark:border-zinc-800">
            <div className="bg-gradient-to-r from-purple-800 to-indigo-800 text-white p-4 sm:p-5 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-xl">✏️</span>
                  <h3 className="font-extrabold text-base sm:text-lg">Editar Preços e Detalhes do Açaí</h3>
                </div>
                <button onClick={() => setPriceModalOpen(false)} className="text-white/80 hover:text-white font-bold text-2xl leading-none cursor-pointer">&times;</button>
            </div>
            
            <div className="p-5 space-y-4 overflow-y-auto">
              <p className="text-xs text-zinc-500">
                Personalize os preços e a descrição apresentada aos clientes no cardápio para cada tipo de açaí:
              </p>

              {/* Açaí Popular */}
              <div className="p-3 bg-zinc-50 dark:bg-zinc-950/60 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs uppercase text-purple-700 dark:text-purple-300 font-extrabold flex items-center gap-1">
                    <span>🥣</span> Açaí Popular (1L)
                  </label>
                  <div className="relative w-28">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 font-bold text-xs">R$</span>
                    <input type="number" step="0.1" value={prices.popular} onChange={e => setPrices({...prices, popular: Number(e.target.value)})} className="w-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded-lg py-1.5 pl-8 pr-2 outline-none focus:ring-2 focus:ring-purple-500 font-black text-sm text-right"/>
                  </div>
                </div>
                <input
                  type="text"
                  value={acaiDescriptions.popular || ''}
                  onChange={e => setAcaiDescriptions({...acaiDescriptions, popular: e.target.value})}
                  placeholder="Ex: Açaí tradicional suave e refrescante para consumo diário..."
                  className="w-full border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded-lg p-2 text-xs outline-none focus:border-purple-500"
                />
              </div>

              {/* Açaí Médio */}
              <div className="p-3 bg-zinc-50 dark:bg-zinc-950/60 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs uppercase text-purple-700 dark:text-purple-300 font-extrabold flex items-center gap-1">
                    <span>🥣</span> Açaí Médio (1L)
                  </label>
                  <div className="relative w-28">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 font-bold text-xs">R$</span>
                    <input type="number" step="0.1" value={prices.medio} onChange={e => setPrices({...prices, medio: Number(e.target.value)})} className="w-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded-lg py-1.5 pl-8 pr-2 outline-none focus:ring-2 focus:ring-purple-500 font-black text-sm text-right"/>
                  </div>
                </div>
                <input
                  type="text"
                  value={acaiDescriptions.medio || ''}
                  onChange={e => setAcaiDescriptions({...acaiDescriptions, medio: e.target.value})}
                  placeholder="Ex: Açaí balanceado de sabor autêntico e encorpado..."
                  className="w-full border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded-lg p-2 text-xs outline-none focus:border-purple-500"
                />
              </div>

              {/* Açaí Grosso */}
              <div className="p-3 bg-zinc-50 dark:bg-zinc-950/60 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs uppercase text-purple-700 dark:text-purple-300 font-extrabold flex items-center gap-1">
                    <span>🥣</span> Açaí Grosso Especial (1L)
                  </label>
                  <div className="relative w-28">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 font-bold text-xs">R$</span>
                    <input type="number" step="0.1" value={prices.grosso} onChange={e => setPrices({...prices, grosso: Number(e.target.value)})} className="w-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded-lg py-1.5 pl-8 pr-2 outline-none focus:ring-2 focus:ring-purple-500 font-black text-sm text-right"/>
                  </div>
                </div>
                <input
                  type="text"
                  value={acaiDescriptions.grosso || ''}
                  onChange={e => setAcaiDescriptions({...acaiDescriptions, grosso: e.target.value})}
                  placeholder="Ex: Açaí super concentrado, máxima densidade e cremosidade..."
                  className="w-full border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded-lg p-2 text-xs outline-none focus:border-purple-500"
                />
              </div>

              {/* Açaí Branco */}
              <div className="p-3 bg-zinc-50 dark:bg-zinc-950/60 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs uppercase text-teal-700 dark:text-teal-300 font-extrabold flex items-center gap-1">
                    <span>🥥</span> Açaí Branco Especial (1L)
                  </label>
                  <div className="relative w-28">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 font-bold text-xs">R$</span>
                    <input type="number" step="0.1" value={prices.branco ?? 38} onChange={e => setPrices({...prices, branco: Number(e.target.value)})} className="w-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded-lg py-1.5 pl-8 pr-2 outline-none focus:ring-2 focus:ring-purple-500 font-black text-sm text-right"/>
                  </div>
                </div>
                <input
                  type="text"
                  value={acaiDescriptions.branco || ''}
                  onChange={e => setAcaiDescriptions({...acaiDescriptions, branco: e.target.value})}
                  placeholder="Ex: Açaí raro de polpa clara e suave, iguaria amazônica..."
                  className="w-full border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded-lg p-2 text-xs outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <div className="p-4 bg-zinc-50 dark:bg-zinc-900/50 flex justify-end gap-2.5 border-t border-zinc-200 dark:border-zinc-800 shrink-0">
                <button onClick={() => setPriceModalOpen(false)} className="px-4 py-2 text-zinc-600 bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 rounded-xl font-bold transition text-xs cursor-pointer">Cancelar</button>
                <button onClick={handleSavePrices} className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold transition text-xs shadow-sm cursor-pointer active:scale-95">Salvar Preços & Detalhes</button>
            </div>
          </div>
        </div>
      )}

      {/* Floating B2B Cart Bar */}
      {isB2BCart && b2bCartItems.length > 0 && !b2bCheckoutModalOpen && (
        <div className="fixed bottom-4 left-4 right-4 z-40 max-w-md mx-auto animate-in slide-in-from-bottom-5">
          <button
            onClick={() => setB2bCheckoutModalOpen(true)}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between font-bold text-sm transition-all transform active:scale-95 border-2 border-emerald-400/30"
          >
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2.5 rounded-xl text-xl">🛒</div>
              <div className="text-left">
                <p className="text-xs text-emerald-100 font-medium">Fornecedor: {cartB2BStore?.name || 'Fornecedor'}</p>
                <p className="text-sm font-extrabold">{b2bCartTotalQuantity} {b2bCartTotalQuantity === 1 ? 'item' : 'itens'} • {formatMoney(b2bCartItemsTotal)}</p>
              </div>
            </div>
            <span className="bg-white text-emerald-700 px-3.5 py-2 rounded-xl text-xs font-black shadow-sm flex items-center gap-1">
              Ver Carrinho ➔
            </span>
          </button>
        </div>
      )}

      {/* Modal Selecionar Quantidade de Item B2B */}
      {productSelectModalB2B && (
        <div className="fixed inset-0 bg-black/70 z-[160] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in slide-in-from-bottom-full sm:zoom-in-95">
            <div className="bg-gradient-to-r from-emerald-800 to-teal-900 text-white p-4 flex justify-between items-center shadow">
              <div className="flex items-center gap-2">
                <span className="text-xl">📦</span>
                <h3 className="font-extrabold text-base">Adicionar ao Pedido</h3>
              </div>
              <button onClick={() => setProductSelectModalB2B(null)} className="text-white/80 hover:text-white font-bold text-2xl leading-none">&times;</button>
            </div>

            <div className="p-5">
              <div className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200 dark:border-zinc-700/60 mb-5">
                <div className="w-14 h-14 rounded-lg bg-emerald-100 dark:bg-emerald-950 overflow-hidden shrink-0 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center">
                  {productSelectModalB2B.imageUrl ? (
                    <img src={productSelectModalB2B.imageUrl} alt={productSelectModalB2B.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl">🌿</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-extrabold text-sm text-zinc-900 dark:text-white truncate">{productSelectModalB2B.name}</p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-extrabold mt-0.5">{formatMoney(productSelectModalB2B.price)} un.</p>
                </div>
              </div>

              <div className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/40 p-3.5 rounded-xl mb-5">
                <span className="text-xs font-bold uppercase text-zinc-600 dark:text-zinc-300">Quantidade:</span>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setProductSelectModalB2B(prev => prev ? { ...prev, quantity: Math.max(1, prev.quantity - 1) } : null)} 
                    className="bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 w-9 h-9 rounded-xl font-extrabold text-lg flex items-center justify-center hover:bg-zinc-300 active:scale-95 transition"
                  >
                    -
                  </button>
                  <span className="text-xl font-extrabold text-zinc-900 dark:text-white w-8 text-center">{productSelectModalB2B.quantity}</span>
                  <button 
                    onClick={() => setProductSelectModalB2B(prev => prev ? { ...prev, quantity: prev.quantity + 1 } : null)} 
                    className="bg-emerald-600 text-white w-9 h-9 rounded-xl font-extrabold text-lg flex items-center justify-center hover:bg-emerald-700 active:scale-95 transition shadow"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="flex justify-between items-center bg-zinc-50 dark:bg-zinc-950/80 p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 mb-5 text-sm">
                <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase">Subtotal do Item:</span>
                <span className="font-extrabold text-emerald-600 dark:text-emerald-400 text-base">
                  {formatMoney(productSelectModalB2B.price * productSelectModalB2B.quantity)}
                </span>
              </div>

              <div className="flex gap-2">
                <button 
                  onClick={() => setProductSelectModalB2B(null)} 
                  className="flex-1 px-4 py-3 bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold rounded-xl active:scale-95 transition text-sm"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleAddToCartB2B} 
                  className="flex-1 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg active:scale-95 transition text-sm flex items-center justify-center gap-1.5"
                >
                  <span>Adicionar</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Checkout / Carrinho B2B Multi-item */}
      {b2bCheckoutModalOpen && (
        <div className="fixed inset-0 bg-black/70 z-[150] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col animate-in slide-in-from-bottom-full sm:zoom-in-95">
            <div className="bg-gradient-to-r from-emerald-800 to-teal-900 text-white p-4 sm:p-5 flex justify-between items-center shadow shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xl">🛒</span>
                <h3 className="font-extrabold text-base sm:text-lg">Carrinho de Abastecimento B2B</h3>
              </div>
              <button onClick={() => setB2bCheckoutModalOpen(false)} className="text-white/80 hover:text-white font-bold text-2xl leading-none">&times;</button>
            </div>

            <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1">
              {(() => {
                if (!cart.storeId || b2bCartItems.length === 0) {
                  return (
                    <div className="text-center py-8">
                      <span className="text-4xl mb-2 block">🛒</span>
                      <p className="text-zinc-500 font-bold text-sm">Seu carrinho de abastecimento está vazio.</p>
                    </div>
                  );
                }

                const forn = store.users?.[cart.storeId];
                if (!forn) return <p className="text-zinc-500 text-sm">Fornecedor não encontrado</p>;

                const { dist, subsidy, freteLoja } = calcFreteB2B(forn.id);

                return (
                  <>
                    {/* Info Fornecedor */}
                    <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
                      <div>
                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Fornecedor Selecionado</p>
                        <h4 className="font-extrabold text-zinc-900 dark:text-white text-base sm:text-lg">{forn.name}</h4>
                      </div>
                      <span className="text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-2.5 py-1 rounded-xl">
                        📍 {dist.toFixed(1)} km
                      </span>
                    </div>

                    {/* Lista de Itens do Carrinho */}
                    <div className="space-y-2.5">
                      <p className="text-xs font-bold uppercase text-zinc-500 tracking-wider">Itens do Pedido ({b2bCartTotalQuantity}):</p>
                      {b2bCartItems.map((item) => {
                        const isBase = item.id === 'base' || item.id === 'B2B';
                        const itemImg = isBase
                          ? (forn.imagesB2B?.lata || 'https://images.unsplash.com/photo-1628557044797-f21a177c37ec?auto=format&fit=crop&w=400&q=80')
                          : forn.products?.find(p => p.id === item.id)?.imageUrl;

                        return (
                          <div key={item.id} className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200 dark:border-zinc-700/60 gap-2">
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <div className="w-11 h-11 rounded-lg bg-emerald-100 dark:bg-emerald-950 overflow-hidden shrink-0 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center">
                                {itemImg ? (
                                  <img src={itemImg} alt={item.name} className="w-full h-full object-cover" />
                                ) : (
                                  <span className="text-lg">🌿</span>
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="font-extrabold text-xs sm:text-sm text-zinc-900 dark:text-white truncate">{item.name}</p>
                                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-extrabold">{formatMoney(item.price)} un.</p>
                              </div>
                            </div>

                            {/* Controles de Quantidade */}
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                onClick={() => updateCartQuantity(item.id, Math.max(1, item.quantity - 1))}
                                className="w-7 h-7 bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-lg font-extrabold text-sm flex items-center justify-center hover:bg-zinc-300 active:scale-95 transition"
                              >
                                -
                              </button>
                              <span className="text-sm font-extrabold text-zinc-900 dark:text-white w-6 text-center">{item.quantity}</span>
                              <button
                                onClick={() => updateCartQuantity(item.id, item.quantity + 1)}
                                className="w-7 h-7 bg-emerald-600 text-white rounded-lg font-extrabold text-sm flex items-center justify-center hover:bg-emerald-700 active:scale-95 transition shadow"
                              >
                                +
                              </button>
                              <button
                                onClick={() => removeFromCart(item.id)}
                                className="w-7 h-7 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg flex items-center justify-center transition ml-1"
                                title="Remover item"
                              >
                                🗑️
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Resumo Financeiro */}
                    <div className="space-y-2 text-xs text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-950/80 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
                      <div className="flex justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2">
                        <span>Subtotal dos Produtos ({b2bCartTotalQuantity} itens):</span>
                        <span className="font-bold text-zinc-800 dark:text-white">{formatMoney(b2bCartItemsTotal)}</span>
                      </div>
                      <div className="flex justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2">
                        <span className="flex items-center gap-1">
                          Frete Caminhão (Loja):
                          {subsidy > 0 && <span className="text-[9px] bg-orange-100 text-orange-700 px-1 rounded font-bold">-{subsidy}% subsídio</span>}
                        </span>
                        <span className="font-bold text-zinc-800 dark:text-white">{formatMoney(freteLoja)}</span>
                      </div>
                      <div className="flex justify-between pt-1 text-sm">
                        <span className="font-extrabold text-zinc-900 dark:text-white">Total a Pagar (PIX):</span>
                        <span className="font-extrabold text-emerald-600 dark:text-emerald-400 text-base">{formatMoney(b2bFinalCartTotal)}</span>
                      </div>
                    </div>

                    {/* Botões de Ação */}
                    <div className="flex gap-2.5 pt-2">
                      <button
                        onClick={() => {
                          if (confirm('Deseja realmente esvaziar o carrinho?')) {
                            clearCart();
                            setB2bCheckoutModalOpen(false);
                          }
                        }}
                        className="px-3 py-3 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold rounded-xl active:scale-95 transition text-xs"
                      >
                        Limpar
                      </button>
                      <button
                        onClick={() => setB2bCheckoutModalOpen(false)}
                        className="px-4 py-3 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold rounded-xl active:scale-95 transition text-xs"
                      >
                        + Mais Itens
                      </button>
                      <button
                        onClick={handleConfirmB2BOrder}
                        className="flex-1 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg active:scale-95 transition text-sm flex items-center justify-center gap-1.5"
                      >
                        <span>Confirmar e Pagar via PIX</span>
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
      {/* Modal de Edição de Produto Extra */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-md shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            {/* Header */}
            <div className="p-4 bg-gradient-to-r from-purple-700 to-indigo-700 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-xl">✏️</span>
                <h3 className="font-extrabold text-base">Editar Produto Extra</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              {/* Foto do Produto */}
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-xl bg-zinc-100 dark:bg-zinc-800 overflow-hidden shrink-0 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center">
                  {editingProduct.imageUrl ? (
                    <img src={editingProduct.imageUrl} alt={editingProduct.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl">📦</span>
                  )}
                </div>
                <div className="flex flex-col gap-1.5 flex-1">
                  <button
                    type="button"
                    onClick={() => setPhotoModalData({
                      open: true,
                      title: `Foto de ${editingProduct.name}`,
                      category: 'adicional',
                      currentUrl: editingProduct.imageUrl,
                      onSelect: (url) => setEditingProduct(prev => prev ? { ...prev, imageUrl: url } : null)
                    })}
                    className="px-3 py-1.5 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 hover:bg-purple-200 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 border border-purple-200 dark:border-purple-800"
                  >
                    📸 Alterar Foto
                  </button>
                  {editingProduct.imageUrl && (
                    <button
                      type="button"
                      onClick={() => setEditingProduct(prev => prev ? { ...prev, imageUrl: undefined } : null)}
                      className="text-red-500 hover:text-red-700 text-[11px] font-semibold text-left px-1"
                    >
                      Remover foto
                    </button>
                  )}
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
                  className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-xl text-sm font-semibold outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                  placeholder="Nome do produto"
                />
              </div>

              {/* Descrição / Detalhes */}
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1 uppercase tracking-wider">
                  Descrição & Detalhes (Ingredientes, Porção, Acompanhamentos)
                </label>
                <textarea
                  rows={3}
                  value={editingProduct.description || ''}
                  onChange={(e) => setEditingProduct(prev => prev ? { ...prev, description: e.target.value } : null)}
                  className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-xl text-xs sm:text-sm font-medium outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 resize-none leading-relaxed"
                  placeholder="Ex: Porção de 200g de camarão rosa frito no azeite com vinagrete e farofa de açaí..."
                />
                <p className="text-[11px] text-zinc-400 mt-1">
                  Esta descrição aparecerá no botão &quot;Detalhes ▼&quot; para os clientes no cardápio.
                </p>
              </div>

              {/* Preço com Botões de Ajuste Rápido */}
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1 uppercase tracking-wider">
                  Preço de Venda (R$)
                </label>
                <div className="relative mb-2">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 font-bold text-sm">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={editingProduct.price}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setEditingProduct(prev => prev ? { ...prev, price: isNaN(val) ? 0 : val } : null);
                    }}
                    className="w-full pl-10 pr-3 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-xl text-base font-black outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                    placeholder="0.00"
                  />
                </div>

                {/* Ajustes rápidos de preço */}
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-bold text-zinc-400 mr-1">Ajuste rápido:</span>
                  {[-5, -1, 1, 5].map((delta) => (
                    <button
                      key={delta}
                      type="button"
                      onClick={() => {
                        setEditingProduct(prev => {
                          if (!prev) return null;
                          const newP = Math.max(0, Number((prev.price + delta).toFixed(2)));
                          return { ...prev, price: newP };
                        });
                      }}
                      className="px-2 py-1 rounded-md bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-bold transition"
                    >
                      {delta > 0 ? `+R$ ${delta}` : `-R$ ${Math.abs(delta)}`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Disponibilidade Switch */}
              <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">Status no Cardápio</p>
                  <p className="text-[11px] text-zinc-500">
                    {editingProduct.isAvailable !== false ? 'Disponível para os clientes comprarem' : 'Esgotado temporariamente'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingProduct(prev => prev ? { ...prev, isAvailable: !(prev.isAvailable !== false) } : null)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black border transition ${
                    editingProduct.isAvailable !== false
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:border-emerald-700'
                      : 'bg-red-50 text-red-700 border-red-300 hover:bg-red-100 dark:bg-red-950/40 dark:border-red-700'
                  }`}
                >
                  {editingProduct.isAvailable !== false ? '🟢 Disponível' : '🔴 Esgotado'}
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-zinc-50 dark:bg-zinc-900/60 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Deseja excluir definitivamente "${editingProduct.name}"?`)) {
                    if (currentUser) store.removeProduct(currentUser.id, editingProduct.id);
                    setEditingProduct(null);
                  }
                }}
                className="px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl text-xs font-bold transition flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Excluir
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="px-4 py-2 bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-xl text-xs font-bold transition"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveEditProduct}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
                >
                  Salvar Alterações
                </button>
              </div>
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

      {/* BOTÃO FLUTUANTE DE ATENDIMENTO / SUPORTE GERAL */}
      <SupportChatButton currentUser={currentUser} />
      <AsaasPartnerBadge variant="footer" className="mt-8 mb-4" />
    </div>
    </PartnerActivationGuard>
  );
}

