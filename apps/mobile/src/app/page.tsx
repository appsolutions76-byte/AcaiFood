"use client";

import React, { useEffect, useState, useSyncExternalStore, Suspense } from "react";
import Link from "next/link";
import { ShoppingCart, BookOpen, MessageSquare, Share2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAppStore, haversineKm, getRatesForCity, calculateOrderFreight } from "@/store/useAppStore";
import { MapModal, MapPoint } from "@/components/MapModal";
import { PixModal } from "@/components/PixModal";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PartnerManualModal } from "@/components/PartnerManualModal";
import { OrderChatModal } from "@/components/OrderChatModal";
import { AdBannerCarousel } from "@/components/AdBannerCarousel";
import { SupportChatButton } from "@/components/SupportChatButton";
import { ShareLandingModal } from "@/components/ShareLandingModal";
import { validateCpfCnpjDigits } from "@/lib/pix";

const emptySubscribe = () => () => {};

function DirectStoreUrlHandler({ onStoreFound }: { onStoreFound: (storeId: string) => void }) {
  const searchParams = useSearchParams();
  useEffect(() => {
    const lojaParam = searchParams.get('loja') || searchParams.get('store');
    if (lojaParam) {
      onStoreFound(lojaParam);
    }
  }, [searchParams, onStoreFound]);
  return null;
}

function PaymentHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  useEffect(() => {
    const paymentStatus = searchParams.get('payment');
    if (paymentStatus === 'success') {
      alert('Pagamento aprovado via Asaas! A loja já está preparando seu pedido com Split automático.');
      window.history.replaceState(null, '', '/');
    } else if (paymentStatus === 'failure') {
      alert('Houve um problema com o pagamento via Asaas. Tente novamente.');
      window.history.replaceState(null, '', '/');
    } else if (paymentStatus === 'pending') {
      alert('Seu pagamento Asaas está em processamento ou aguardando confirmação do PIX.');
      window.history.replaceState(null, '', '/');
    }
  }, [searchParams, router]);

  return null;
}

export default function StorefrontPage() {
  const store = useAppStore();
  const rates = getRatesForCity(store.currentUser?.cidade, store.rates, store.cities) || store.rates;
  const formatMoney = (val: number) => (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const currentUser = store.currentUser;
  const router = useRouter();
  
  const [mapModal, setMapModal] = useState<{
    open: boolean;
    origem: MapPoint | null;
    destino: MapPoint | null;
    motorista?: MapPoint | null;
  }>({ open: false, origem: null, destino: null, motorista: null });
  const [productSelectModal, setProductSelectModal] = useState<{ open: boolean; lojaId: string; tipo: string; quantity: number }>({ open: false, lojaId: '', tipo: 'medio', quantity: 1 });
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [pixModalData, setPixModalData] = useState<{ open: boolean; qrCode?: string; copiaECola?: string; invoiceUrl?: string; orderId?: string; isSandbox?: boolean; paymentId?: string; totalValue?: number }>({ open: false });
  const [pixPaid, setPixPaid] = useState(false);
  const [cpfModalOpen, setCpfModalOpen] = useState(false);
  const [cpfInputValue, setCpfInputValue] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const [chatModalData, setChatModalData] = useState<{ open: boolean; orderId: string; otherName?: string; otherPhone?: string; otherRole?: string }>({ open: false, orderId: "" });
  const { cart, addToCart, removeFromCart, updateCartQuantity } = store;

  const [addressMode, setAddressMode] = useState<'profile' | 'gps' | 'custom'>('profile');
  const [customAddress, setCustomAddress] = useState("");
  const [customReference, setCustomReference] = useState("");
  const [gpsLocation, setGpsLocation] = useState<{ lat: number; lng: number; address?: string } | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedCategoryChip, setSelectedCategoryChip] = useState<'all' | 'open' | 'free_frete' | 'nearest' | 'grosso' | 'branco' | 'lowest_price'>('all');
  const [selectedBairro, setSelectedBairro] = useState<string>('all');
  const [visibleStoreLimit, setVisibleStoreLimit] = useState<number>(12);

  useEffect(() => {
    if (selectedStoreId && store.users?.[selectedStoreId]) {
      document.title = `${store.users[selectedStoreId].name} - AçaíFood Oficial`;
    } else {
      document.title = 'AçaíFood - O Marketplace Definitivo do Açaí';
    }
  }, [selectedStoreId, store.users]);

  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPassword, setGuestPassword] = useState("");
  const [guestCpf, setGuestCpf] = useState("");
  const [isRegisteringGuest, setIsRegisteringGuest] = useState(false);
  const [shareLandingModalOpen, setShareLandingModalOpen] = useState(false);

  const handleGetGpsLocation = () => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      alert("Geolocalização não é suportada pelo seu navegador.");
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setGpsLocation({
          lat,
          lng,
          address: `Localização GPS (${lat.toFixed(4)}, ${lng.toFixed(4)})`
        });
        setAddressMode('gps');
        setIsLocating(false);

        if (currentUser?.id) {
          await store.updateUserLocation(currentUser.id, lat, lng);
        }
        alert(`📍 Localização GPS atualizada com sucesso!\n\nCoordenadas: ${lat.toFixed(4)}, ${lng.toFixed(4)}\nAs distâncias e fretes das batedeiras foram recalculados para sua posição atual.`);
      },
      (_err) => {
        setIsLocating(false);
        alert("Não foi possível obter sua localização GPS. Verifique se a permissão de localização do seu navegador está autorizada.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  useEffect(() => {
    if (!pixModalData.open || !pixModalData.orderId) {
      return;
    }

    let isSubscribed = true;

    const checkStatus = async () => {
      // 1. Checar status no banco local via store
      const localOrder = (store.orders || []).find(o => o.id === pixModalData.orderId);
      if (localOrder) {
        const s = String(localOrder.status).toLowerCase();
        if (['pago', 'preparo', 'pronto', 'em_rota', 'entregue', 'paid', 'preparing', 'ready', 'delivering', 'delivered', 'received', 'completed'].includes(s)) {
          if (isSubscribed) setPixPaid(true);
          return;
        }
      }

      // 2. Checar API de status do Asaas
      try {
        const query = pixModalData.paymentId 
          ? `paymentId=${pixModalData.paymentId}&orderId=${pixModalData.orderId}` 
          : `orderId=${pixModalData.orderId}`;
        const res = await fetch(`/api/asaas/status?${query}`);
        if (res.ok && isSubscribed) {
          const data = await res.json();
          if (data.isPaid) {
            setPixPaid(true);
            if (pixModalData.orderId) {
              store.acaoPedido(pixModalData.orderId, 'confirmar_pagamento');
            }
          }
        }
      } catch (e) {
        console.warn("Erro ao checar status Pix:", e);
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 3500);
    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pixModalData.open, pixModalData.orderId, pixModalData.paymentId]);

  const getCartPrice = (lojaId: string, tipo: string) => {
    const loja = store.users?.[lojaId];
    if (!loja) return 0;
    if (tipo === 'popular' || tipo === 'medio' || tipo === 'grosso') {
        return loja.priceB2C?.[tipo as keyof typeof loja.priceB2C] || (tipo === 'grosso' ? 35 : tipo === 'medio' ? 26 : 20);
    }
    if (tipo === 'branco') {
        return loja.priceB2C?.branco || 38;
    }
    if (tipo === 'lata') {
        return loja.priceB2B ?? 140;
    }
    const customProd = loja.products?.find(p => p.id === tipo);
    return customProd ? customProd.price : 0;
  };

  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  useEffect(() => {
    store.fetchLojas(true);
    store.fetchRates(true);
    store.startRealtime();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mounted) return;
    
    if (currentUser) {
      store.startRealtime();
      if (currentUser.role === 'admin') router.replace('/admin');
      else if (currentUser.role === 'loja') router.replace('/parceiros/batedeira');
      else if (currentUser.role === 'fornecedor') router.replace('/parceiros/fornecedor');
      else if (currentUser.role === 'motorista' && currentUser.veiculo === 'Moto') router.replace('/parceiros/motoboy');
      else if (currentUser.role === 'motorista' && (currentUser.veiculo === 'Caminhão' || currentUser.veiculo === 'Caçamba')) router.replace('/parceiros/caminhao');
    }
  }, [mounted, currentUser?.id, currentUser?.role, router]);

  if (!mounted) {
    return <div className="min-h-screen bg-zinc-950 flex items-center justify-center"><p className="text-white">Carregando...</p></div>;
  }

  let meusPedidos = currentUser ? (store.orders || []).filter(o => o.clienteId === currentUser.id || o.criadoPor === currentUser.id) : [];
  const clientActiveOrders = meusPedidos.filter(o => o.status !== 'entregue' && o.status !== 'cancelado' && o.status !== 'arquivado');
  const clientHistoryOrders = meusPedidos.filter(o => o.status === 'entregue' || o.status === 'cancelado' || o.status === 'arquivado');
  meusPedidos = [...clientActiveOrders, ...clientHistoryOrders];
  const norm = (s?: string | null) => String(s || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const userCityNorm = norm(currentUser?.cidade);

  const batedeirasAll = Object.values(store.users || {})
    .filter(u => u.role === 'loja' && u.status !== 'blocked')
    .filter(u => {
      if (!userCityNorm || !u.cidade) return true;
      return norm(u.cidade) === userCityNorm;
    });

  // Extração de bairros distintos disponíveis
  const bairrosList = Array.from(new Set(batedeirasAll.map(u => u.bairro?.trim()).filter(Boolean) as string[])).sort();

  // Contadores para os Chips Rápidos
  const countTotal = batedeirasAll.length;
  const countOpen = batedeirasAll.filter(u => u.status !== 'paused').length;
  const countFreeFrete = batedeirasAll.filter(u => (u.freteSubsidyPct || 0) > 0).length;
  const countGrosso = batedeirasAll.filter(u => u.availabilityB2C?.grosso !== false).length;
  const countBranco = batedeirasAll.filter(u => u.availabilityB2C?.branco !== false).length;

  const batedeirasFiltered = batedeirasAll.filter(loja => {
    if (selectedBairro !== 'all') {
      if (!loja.bairro || norm(loja.bairro) !== norm(selectedBairro)) return false;
    }

    if (searchQuery.trim()) {
      const q = norm(searchQuery);
      const nameMatch = norm(loja.name).includes(q);
      const bairroMatch = norm(loja.bairro).includes(q);
      const cidadeMatch = norm(loja.cidade).includes(q);
      const prodMatch = loja.products?.some(p => norm(p.name).includes(q));
      if (!nameMatch && !bairroMatch && !cidadeMatch && !prodMatch) return false;
    }

    if (selectedCategoryChip === 'open' && loja.status === 'paused') return false;
    if (selectedCategoryChip === 'free_frete' && (!loja.freteSubsidyPct || loja.freteSubsidyPct <= 0)) return false;
    if (selectedCategoryChip === 'grosso' && loja.availabilityB2C?.grosso === false) return false;
    if (selectedCategoryChip === 'branco' && loja.availabilityB2C?.branco === false) return false;

    return true;
  }).sort((a, b) => {
    // 1. Prioridade Máxima: Lojas Abertas (status !== 'paused') aparecem primeiro
    const aOpen = a.status !== 'paused' ? 1 : 0;
    const bOpen = b.status !== 'paused' ? 1 : 0;
    if (aOpen !== bOpen) return bOpen - aOpen;

    // 2. Ordenação secundária por filtro ou distância
    if (selectedCategoryChip === 'lowest_price') {
      const priceA = a.priceB2C?.medio ?? a.priceB2C?.popular ?? 999;
      const priceB = b.priceB2C?.medio ?? b.priceB2C?.popular ?? 999;
      return priceA - priceB;
    }
    const distA = (a.lat && currentUser?.lat) ? haversineKm(a.lat, a.lng!, currentUser!.lat, currentUser!.lng!) : 999;
    const distB = (b.lat && currentUser?.lat) ? haversineKm(b.lat, b.lng!, currentUser!.lat, currentUser!.lng!) : 999;
    return distA - distB;
  });

  const batedeiras = batedeirasFiltered.slice(0, visibleStoreLimit);

  const calcFreteCliente = (lojaId: string) => {
    const loja = store.users?.[lojaId];
    const isSupplier = loja?.role === 'fornecedor';
    const orderType = isSupplier ? 'B2B' : 'B2C';
    const userLat = currentUser?.lat || gpsLocation?.lat || (loja?.lat ? loja.lat + 0.015 : -1.455);
    const userLng = currentUser?.lng || gpsLocation?.lng || (loja?.lng ? loja.lng + 0.015 : -48.490);
    if (!loja || !loja.lat) return { freteCliente: rates.courier_payment_mode === 'FIXED' ? (rates.courier_fixed_fee || 6) : 6, dist: 2.0, subsidy: 0 };
    const dist = haversineKm(loja.lat, loja.lng!, userLat, userLng);
    const freteTotal = calculateOrderFreight(orderType, dist, rates);
    const subsidy = loja.freteSubsidyPct || 0;
    const freteCliente = freteTotal * (1 - subsidy / 100);
    return { freteCliente, dist, subsidy };
  };

  const handleSelectStore = (lojaId: string) => {
    const loja = store.users?.[lojaId];
    if (loja?.status === 'paused') {
      alert(`⚠️ "${loja.name}" está fechada no momento e não está aceitando pedidos agora.`);
      return;
    }

    if (cart.storeId && cart.storeId !== lojaId && cart.items.length > 0) {
      const lojaAtualNome = store.users?.[cart.storeId]?.name || 'outra loja';
      const novaLojaNome = store.users?.[lojaId]?.name || 'esta loja';
      if (confirm(`⚠️ Seu carrinho possui produtos da loja "${lojaAtualNome}". Você só pode comprar em uma loja por vez.\n\nDeseja limpar o carrinho anterior e entrar na "${novaLojaNome}"?`)) {
        store.clearCart?.();
        setSelectedStoreId(lojaId);
      }
    } else {
      setSelectedStoreId(lojaId);
    }
  };

  const handleAddToCart = () => {
    if (!productSelectModal) return;
    const { lojaId, tipo, quantity } = productSelectModal;
    const loja = store.users?.[lojaId];
    if (!loja) return;

    if (loja.status === 'paused') {
      alert(`⚠️ "${loja.name}" está fechada no momento e não está aceitando novos pedidos.`);
      setProductSelectModal({ open: false, lojaId: '', tipo: 'medio', quantity: 1 });
      return;
    }

    if (cart.storeId && cart.storeId !== lojaId && cart.items.length > 0) {
      const lojaAtualNome = store.users?.[cart.storeId]?.name || 'outra loja';
      const novaLojaNome = store.users?.[lojaId]?.name || 'esta loja';
      if (!confirm(`⚠️ Seu carrinho possui produtos da loja "${lojaAtualNome}". Você só pode comprar em uma loja por vez.\n\nDeseja limpar o carrinho anterior e adicionar os produtos da "${novaLojaNome}"?`)) {
        return;
      }
      store.clearCart?.();
    }

    let price = 0;
    let name = '';

    if (tipo === 'lata') {
      if (loja.availabilityB2B?.lata === false) {
        alert('Este item está esgotado neste fornecedor.');
        return;
      }
      price = loja.priceB2B ?? 140;
      name = 'Lata de Açaí Fruto (14kg)';
    } else if (['popular', 'medio', 'grosso', 'branco'].includes(tipo)) {
      if (loja.availabilityB2C?.[tipo as keyof typeof loja.availabilityB2C] === false) {
        alert('Este item está esgotado nesta loja.');
        return;
      }
      price = (loja.priceB2C as any)?.[tipo] || (tipo === 'branco' ? 38 : tipo === 'grosso' ? 35 : tipo === 'medio' ? 26 : 20);
      name = tipo === 'branco' ? 'Açaí Branco Especial (1L)' : `Açaí ${tipo.charAt(0).toUpperCase() + tipo.slice(1)} (1L)`;
    } else {
      const customProd = loja.products?.find(p => p.id === tipo);
      if (customProd) {
        if (customProd.isAvailable === false) {
          alert('Este produto está esgotado nesta loja.');
          return;
        }
        price = customProd.price;
        name = customProd.name;
      }
    }

    if (price > 0) {
      addToCart(lojaId, { id: tipo, name, price, quantity });
      setProductSelectModal({ open: false, lojaId: '', tipo: 'medio', quantity: 1 });
      setSelectedStoreId(lojaId);
    }
  };

  const isValidCpfCnpj = (val?: string | null) => {
    if (!val) return false;
    const digits = val.replace(/\D/g, '');
    return digits.length === 11 || digits.length === 14;
  };

  const handleConfirmOrder = async () => {
    if (!cart.storeId || cart.items.length === 0) return;

    const storeUser = store.users?.[cart.storeId];
    if (storeUser?.status === 'paused') {
      alert(`⚠️ A batedeira "${storeUser.name}" está fechada no momento. O pedido não pode ser enviado agora.`);
      return;
    }

    if (!currentUser) {
      if (!guestName.trim()) {
        alert("Por favor, informe seu Nome Completo para a entrega.");
        return;
      }
      const cleanPhone = guestPhone.replace(/\D/g, '');
      if (!cleanPhone || cleanPhone.length < 10) {
        alert("Por favor, informe um WhatsApp / Celular válido com DDD.");
        return;
      }
      if (!guestEmail.trim() || !guestEmail.includes('@')) {
        alert("Por favor, informe um E-mail válido.");
        return;
      }
      if (!guestPassword || guestPassword.length < 6) {
        alert("Por favor, crie uma senha simples de pelo menos 6 dígitos.");
        return;
      }
      if (addressMode === 'custom' && !customAddress.trim()) {
        alert("Por favor, informe seu Endereço de Entrega.");
        return;
      }

      setIsRegisteringGuest(true);
      try {
        const finalAddress = addressMode === 'custom' ? customAddress : (gpsLocation?.address || 'Belém');
        const regRes = await store.registerUser({
          name: guestName.trim(),
          email: guestEmail.trim(),
          telefone: cleanPhone,
          endereco: finalAddress,
          cidade: storeUser?.cidade || 'Belém',
          bairro: storeUser?.bairro || 'Central',
          lat: gpsLocation?.lat || storeUser?.lat || -1.455,
          lng: gpsLocation?.lng || storeUser?.lng || -48.490,
          role: 'cliente',
          icon: '👤',
          password: guestPassword,
          cpfCnpj: guestCpf.trim() ? guestCpf.trim().replace(/\D/g, '') : undefined
        });

        if (!regRes) {
          setIsRegisteringGuest(false);
          return;
        }

        await processCheckout();
      } catch (err: any) {
        alert("Erro ao criar conta: " + (err.message || 'Falha de comunicação'));
      } finally {
        setIsRegisteringGuest(false);
      }
      return;
    }

    await processCheckout();
  };

  const processCheckout = async () => {
    if (!cart.storeId || cart.items.length === 0) return;

    let deliveryInfo: { address?: string; lat?: number; lng?: number; reference?: string } | undefined = undefined;

    if (addressMode === 'gps' && gpsLocation) {
      deliveryInfo = {
        address: gpsLocation.address || 'Localização GPS em Tempo Real (Rua / Praça)',
        lat: gpsLocation.lat,
        lng: gpsLocation.lng,
        reference: customReference
      };
    } else if (addressMode === 'custom' && customAddress) {
      deliveryInfo = {
        address: customAddress,
        reference: customReference
      };
    } else if (customReference) {
      deliveryInfo = {
        reference: customReference
      };
    }

    const isSupplier = store.users?.[cart.storeId]?.role === 'fornecedor';
    const orderType = isSupplier ? 'B2B' : 'B2C';
    const res: any = await store.criarPedido(orderType, cart.storeId, deliveryInfo);
    setCheckoutModalOpen(false);
    
    if (res && typeof res === 'object') {
      if (res.error && (res.error.toLowerCase().includes('cpf') || res.error.toLowerCase().includes('cnpj'))) {
        alert('Por favor, informe seu CPF ou CNPJ de cadastro para gerar o Pix registrado no Banco Central.');
        setCpfModalOpen(true);
        return;
      }

      if (res.pixQrCode || res.pixCopiaECola || res.invoiceUrl) {
         setPixModalData({
            open: true,
            qrCode: res.pixQrCode,
            copiaECola: res.pixCopiaECola,
            invoiceUrl: res.invoiceUrl,
            orderId: res.orderId,
            paymentId: res.paymentId,
            isSandbox: res.isSandbox,
            totalValue: res.totalValue || finalCartTotal
         });

         if (res.error) {
            console.warn("Nota do checkout Asaas:", res.error);
         }
         return;
      }

      if (res.error) {
         alert(`Aviso do Asaas: ${res.error}`);
      } else {
         alert('✅ Pedido realizado com sucesso! A loja já recebeu seu pedido e iniciará o preparo.');
      }
    } else if (typeof res === 'string' && res.startsWith('http')) {
      window.location.href = res;
    } else {
      alert('✅ Pedido realizado com sucesso! A loja já recebeu seu pedido e iniciará o preparo.');
    }
  };

  const handleSaveCpfAndContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = cpfInputValue.replace(/\D/g, "");
    if (!validateCpfCnpjDigits(cleaned)) {
      alert("CPF ou CNPJ inválido. Por favor, insira um CPF (11 dígitos) ou CNPJ (14 dígitos) válido com dígitos verificadores corretos.");
      return;
    }
    await store.updateCpfCnpj(cleaned);
    setCpfModalOpen(false);
    await processCheckout();
  };

  const cartItemsTotal = cart.items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const cartTotalQuantity = cart.items.reduce((acc, item) => acc + item.quantity, 0);
  const cartFrete = cart.storeId ? calcFreteCliente(cart.storeId).freteCliente : 0;
  const finalCartTotal = cartItemsTotal + cartFrete;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 pb-44 sm:pb-48 font-sans">
      <Suspense fallback={null}>
        <PaymentHandler />
        <DirectStoreUrlHandler onStoreFound={(id) => setSelectedStoreId(id)} />
      </Suspense>
      <header className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 p-3 sm:p-4 sticky top-0 z-30 shadow-xs">
        <div className="flex justify-between items-center max-w-7xl mx-auto w-full px-2 sm:px-4">
          <div className="flex items-center gap-2.5 text-zinc-900 dark:text-white">
            <span className="text-2xl sm:text-3xl">🥣</span>
            <div>
              <h1 className="text-lg sm:text-xl font-black leading-tight tracking-tight">AçaíFood</h1>
              {selectedStoreId && store.users?.[selectedStoreId] && (
                <p className="text-[10px] text-purple-600 dark:text-purple-400 font-black uppercase tracking-wide">
                  {store.users[selectedStoreId].role === 'fornecedor' ? '🏭 Fornecedor Oficial' : '🏪 Loja Selecionada'} • {store.users[selectedStoreId].name}
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2 items-center">
             <Link
               href="/apresentacao"
               className="text-xs bg-purple-100 hover:bg-purple-200 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 px-3 py-1.5 rounded-xl font-bold flex items-center gap-1 shadow-2xs border border-purple-300 dark:border-purple-800 transition-all"
               title="Conheça a apresentação do aplicativo AçaíFood"
             >
               ✨ <span className="hidden sm:inline">Apresentação</span>
             </Link>
             <button
               onClick={() => setShareLandingModalOpen(true)}
               className="text-xs bg-pink-50 hover:bg-pink-100 text-pink-700 dark:bg-pink-950/50 dark:text-pink-300 px-3 py-1.5 rounded-xl font-bold flex items-center gap-1 shadow-2xs border border-pink-200 dark:border-pink-800 transition-all"
               title="Compartilhar página de apresentação"
             >
               <Share2 size={13} /> <span className="hidden sm:inline">Divulgar App</span>
             </button>
             <button onClick={() => setManualOpen(true)} className="text-xs bg-amber-50 hover:bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 shadow-2xs border border-amber-200 dark:border-amber-900/50 transition-all">
               <BookOpen size={13} /> <span className="hidden sm:inline">Manual</span>
             </button>
             {!currentUser ? (
                <>
                  <Link href="/login" className="bg-transparent hover:bg-purple-50 dark:hover:bg-purple-950/40 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold border border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300 transition">
                    Entrar
                  </Link>
                  <Link href="/cadastro" className="bg-purple-600 hover:bg-purple-700 text-white px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold shadow-sm transition">
                    Criar Conta
                  </Link>
                </>
              ) : (
                <div className="flex items-center gap-2 sm:gap-3">
                  <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 hidden sm:inline-block bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 rounded-xl">
                    👋 Olá, {currentUser.name.split(' ')[0]}
                  </span>
                  <button onClick={() => window.location.reload()} className="text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300 px-3 py-1.5 rounded-xl font-bold flex items-center gap-1 shadow-2xs border border-indigo-200 dark:border-indigo-900/50 transition-all">
                    🔄 <span className="hidden sm:inline">Atualizar</span>
                  </button>
                  <ThemeToggle />
                  <button onClick={() => store.logout()} className="text-xs font-bold text-red-600 hover:text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/50 px-2.5 py-1.5 rounded-xl border border-red-200 dark:border-red-900/50 transition">
                    Sair
                  </button>
                </div>
              )}
          </div>
        </div>
      </header>

      <PartnerManualModal isOpen={manualOpen} onClose={() => setManualOpen(false)} role="login" />
      <ShareLandingModal isOpen={shareLandingModalOpen} onClose={() => setShareLandingModalOpen(false)} />

      <main className="p-3 sm:p-5 max-w-7xl mx-auto space-y-5">
        
        {/* HERO COMPACTO & BARRA DE LOCALIZAÇÃO INTELIGENTE */}
        <div className="bg-gradient-to-r from-purple-900/90 via-zinc-900 to-purple-950 text-white p-4 sm:p-5 rounded-2xl shadow-md border border-purple-500/30 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-black text-white leading-tight flex items-center gap-2">
              <span>{selectedStoreId && store.users?.[selectedStoreId]?.role === 'fornecedor' ? '🏭' : '🥣'}</span>
              {selectedStoreId && store.users?.[selectedStoreId] ? (
                <span>{store.users[selectedStoreId].role === 'fornecedor' ? 'Catálogo de Fornecedor' : 'Cardápio Oficial'}: {store.users[selectedStoreId].name}</span>
              ) : (
                <span>O Verdadeiro Açaí da Amazônia</span>
              )}
            </h2>
            <p className="text-xs text-purple-200/90 mt-0.5 font-medium">
              {selectedStoreId && store.users?.[selectedStoreId]?.role === 'fornecedor'
                ? 'Compre latas de fruto em caroço e insumos direto do produtor/fornecedor oficial. Faça seu pedido!'
                : 'Faça seu pedido com entregas rápidas de açaí batido na hora com frete justo calculado por GPS.'}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap shrink-0 w-full sm:w-auto">
            {currentUser ? (
              <span className="text-xs bg-black/40 text-purple-200 font-bold px-3 py-2 rounded-xl border border-purple-400/30 flex items-center gap-1.5 backdrop-blur-xs">
                📍 {currentUser.bairro ? `${currentUser.bairro} (${currentUser.cidade || 'Belém'})` : (currentUser.cidade || 'Belém')}
              </span>
            ) : null}

            <button
              onClick={handleGetGpsLocation}
              disabled={isLocating}
              className="text-xs bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-3.5 py-2 rounded-xl shadow-md flex items-center gap-1.5 transition active:scale-95 cursor-pointer shrink-0"
              title="Calibrar sua localização GPS para ver distâncias exatas"
            >
              {isLocating ? '⏳ GPS...' : gpsLocation ? `📍 GPS Ativo (${gpsLocation.lat.toFixed(2)}, ${gpsLocation.lng.toFixed(2)})` : '🛰️ Localizar Mais Próximas'}
            </button>
          </div>
        </div>

        {/* CARROSSEL DE BANNERS COMERCIAIS */}
        {!selectedStoreId && (
          <AdBannerCarousel 
            city={currentUser?.cidade} 
            onSelectStore={(id) => setSelectedStoreId(id)} 
          />
        )}

        <div>
                {selectedStoreId && store.users?.[selectedStoreId] ? (() => {
                  const selLoja = store.users[selectedStoreId];
                  const { freteCliente, dist, subsidy } = calcFreteCliente(selLoja.id);
                  const isCartStore = cart.storeId === selLoja.id && cart.items.length > 0;

                  return (
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 shadow-sm border border-purple-200 dark:border-purple-900/40 mb-6">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-zinc-200 dark:border-zinc-800 pb-4 mb-4">
                        <div className="flex items-center gap-3">
                          <span className="text-4xl bg-purple-50 dark:bg-purple-950/50 p-2 rounded-2xl">{selLoja.icon || (selLoja.role === 'fornecedor' ? '🏭' : '🏪')}</span>
                          <div>
                            <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wide">
                              {selLoja.role === 'fornecedor' ? '🏭 Fornecedor / Produtor Oficial' : '🏪 Loja Selecionada'}
                            </span>
                            <h3 className="text-xl font-bold text-zinc-800 dark:text-white leading-tight">{selLoja.name}</h3>
                            <p className="text-xs text-zinc-500">📍 Bairro: {selLoja.bairro || 'Central'}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                          <button 
                            onClick={() => {
                              const latOrig = selLoja?.lat || 0;
                              const lngOrig = selLoja?.lng || 0;
                              const latDest = currentUser?.lat || (latOrig ? latOrig + 0.0045 : -1.455);
                              const lngDest = currentUser?.lng || (lngOrig ? lngOrig + 0.0045 : -48.490);
                              setMapModal({
                                open: true,
                                origem: { lat: latOrig, lng: lngOrig, name: selLoja.name || 'Retirada' },
                                destino: { lat: latDest, lng: lngDest, name: currentUser?.name || 'Entrega' },
                                motorista: null
                              });
                            }} 
                            className="text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-3 py-2 rounded-xl"
                          >
                            🗺️ {dist.toFixed(1)} km
                          </button>

                          <button 
                            onClick={() => setSelectedStoreId(null)}
                            className="text-xs bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold px-3 py-2 rounded-xl transition"
                          >
                            ⬅️ Ver Outras Lojas
                          </button>
                        </div>
                      </div>

                      {selLoja.status === 'paused' && (
                        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 p-3.5 rounded-xl mb-4 flex items-center gap-2.5 text-red-700 dark:text-red-300 text-xs font-bold shadow-xs">
                          <span className="text-base">⛔</span>
                          <span>{selLoja.role === 'fornecedor' ? 'Este fornecedor' : 'Esta batedeira'} está <strong>fechado(a) no momento</strong> e pausou o recebimento de pedidos.</span>
                        </div>
                      )}

                      <div className="bg-purple-50 dark:bg-purple-950/30 p-3 rounded-xl mb-4 border border-purple-100 dark:border-purple-900/30 flex justify-between items-center text-xs text-purple-900 dark:text-purple-300 font-medium">
                        <span>Frete Estimado p/ esta loja: <strong>{formatMoney(freteCliente)}</strong></span>
                        {subsidy > 0 && <span className="bg-orange-100 text-orange-800 font-bold px-2 py-0.5 rounded text-[10px] uppercase">Loja Paga {subsidy}%</span>}
                      </div>

                      {isCartStore && (
                        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 p-3 rounded-xl text-xs font-bold mb-4 flex justify-between items-center">
                          <span>🛒 Você tem {cartTotalQuantity} item(ns) no carrinho desta loja ({formatMoney(cartItemsTotal)})</span>
                          <button onClick={() => setCheckoutModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-lg shadow transition">
                            Finalizar Pedido
                          </button>
                        </div>
                      )}

                      {selLoja.role === 'fornecedor' ? (
                        <>
                          <h4 className="font-bold text-sm text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-3">
                            📦 Catálogo de Fruto & Insumos B2B
                          </h4>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                            {/* LATA DE AÇAÍ FRUTO (14KG) */}
                            {(() => {
                              const isAvail = selLoja.availabilityB2B?.lata !== false;
                              const photo = selLoja.imagesB2B?.lata || (selLoja as any).b2bImage || selLoja.imagesB2C?.popular;
                              const priceLata = selLoja.priceB2B ?? 140;
                              return (
                                <div className={`p-3.5 rounded-2xl border transition-all flex justify-between items-center gap-3 ${
                                  isAvail 
                                    ? 'bg-white dark:bg-zinc-900 border-purple-300 dark:border-purple-800 shadow-sm' 
                                    : 'bg-zinc-100/80 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 opacity-60'
                                }`}>
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-14 h-14 rounded-xl bg-purple-100 dark:bg-purple-950 overflow-hidden shrink-0 border border-purple-200 dark:border-purple-800 flex items-center justify-center">
                                      {photo ? (
                                        <img src={photo} alt="Lata de Açaí Fruto" className="w-full h-full object-cover" />
                                      ) : (
                                        <span className="text-2xl">🌴</span>
                                      )}
                                    </div>
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <p className="font-bold text-zinc-800 dark:text-white text-sm truncate">Lata de Açaí Fruto (14kg)</p>
                                        {!isAvail && <span className="text-[9px] bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400 font-extrabold px-1.5 py-0.5 rounded uppercase">Esgotado</span>}
                                      </div>
                                      <p className="text-[11px] text-zinc-500 font-medium">Fruto em caroço selecionado</p>
                                      <p className="text-sm text-purple-600 dark:text-purple-400 font-black">{formatMoney(priceLata)} <span className="text-[10px] font-normal text-zinc-500">/ lata</span></p>
                                    </div>
                                  </div>
                                  {isAvail ? (
                                    <button onClick={() => setProductSelectModal({ open: true, lojaId: selLoja.id, tipo: 'lata', quantity: 1 })} className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition shadow shrink-0 active:scale-95">
                                      + Adicionar
                                    </button>
                                  ) : (
                                    <span className="text-[10px] font-bold text-zinc-400 bg-zinc-200 dark:bg-zinc-800 px-2 py-1.5 rounded-lg shrink-0">
                                      Esgotado
                                    </span>
                                  )}
                                </div>
                              );
                            })()}

                            {/* PRODUTOS EXTRAS & INSUMOS DO FORNECEDOR */}
                            {selLoja.products && [...selLoja.products].sort((a, b) => ((b.isAvailable !== false ? 1 : 0) - (a.isAvailable !== false ? 1 : 0))).map(p => {
                              const isAvail = p.isAvailable !== false;
                              return (
                                <div key={p.id} className={`p-3.5 rounded-2xl border transition-all flex justify-between items-center gap-3 ${
                                  isAvail 
                                    ? 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shadow-sm' 
                                    : 'bg-zinc-100/80 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 opacity-60'
                                }`}>
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-14 h-14 rounded-xl bg-purple-100 dark:bg-purple-950 overflow-hidden shrink-0 border border-purple-200 dark:border-purple-800 flex items-center justify-center">
                                      {p.imageUrl ? (
                                        <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                                      ) : (
                                        <span className="text-2xl">📦</span>
                                      )}
                                    </div>
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <p className="font-bold text-zinc-800 dark:text-white text-sm truncate">{p.name}</p>
                                        {!isAvail && <span className="text-[9px] bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400 font-extrabold px-1.5 py-0.5 rounded uppercase">Esgotado</span>}
                                      </div>
                                      <p className="text-[11px] text-zinc-500 font-medium">Insumo / Produto B2B</p>
                                      <p className="text-sm text-purple-600 dark:text-purple-400 font-black">{formatMoney(p.price)}</p>
                                    </div>
                                  </div>
                                  {isAvail ? (
                                    <button onClick={() => setProductSelectModal({ open: true, lojaId: selLoja.id, tipo: p.id, quantity: 1 })} className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition shadow shrink-0 active:scale-95">
                                      + Adicionar
                                    </button>
                                  ) : (
                                    <span className="text-[10px] font-bold text-zinc-400 bg-zinc-200 dark:bg-zinc-800 px-2 py-1.5 rounded-lg shrink-0">
                                      Esgotado
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </>
                      ) : (
                        <>
                          <h4 className="font-bold text-sm text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-3">Cardápio & Produtos</h4>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                            {/* LISTA DE AÇAÍS (ORDENADOS: DISPONÍVEIS PRIMEIRO, ESGOTADOS NO FINAL) */}
                            {[
                              { key: 'popular', name: 'Açaí Popular (1L)', price: selLoja.priceB2C?.popular ?? 20, isAvail: selLoja.availabilityB2C?.popular !== false, photo: selLoja.imagesB2C?.popular, emoji: '🥣', isTeal: false },
                              { key: 'medio', name: 'Açaí Médio (1L)', price: selLoja.priceB2C?.medio ?? 26, isAvail: selLoja.availabilityB2C?.medio !== false, photo: selLoja.imagesB2C?.medio, emoji: '🥣', isTeal: false },
                              { key: 'grosso', name: 'Açaí Grosso Especial (1L)', price: selLoja.priceB2C?.grosso ?? 35, isAvail: selLoja.availabilityB2C?.grosso !== false, photo: selLoja.imagesB2C?.grosso, emoji: '🥣', isTeal: false },
                              { key: 'branco', name: 'Açaí Branco Especial (1L)', price: selLoja.priceB2C?.branco ?? 38, isAvail: selLoja.availabilityB2C?.branco !== false, photo: selLoja.imagesB2C?.branco, emoji: '🥥', isTeal: true },
                            ]
                            .sort((a, b) => (b.isAvail ? 1 : 0) - (a.isAvail ? 1 : 0))
                            .map(acai => (
                              <div key={acai.key} className={`p-3.5 rounded-2xl border transition-all flex justify-between items-center gap-3 ${
                                acai.isAvail 
                                  ? 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shadow-sm' 
                                  : 'bg-zinc-100/80 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 opacity-60'
                              }`}>
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className={`w-12 h-12 rounded-xl ${acai.isTeal ? 'bg-teal-50 dark:bg-teal-950 border-teal-200 dark:border-teal-800' : 'bg-purple-100 dark:bg-purple-950 border-purple-200 dark:border-purple-800'} overflow-hidden shrink-0 border flex items-center justify-center`}>
                                    {acai.photo ? (
                                      <img src={acai.photo} alt={acai.name} className="w-full h-full object-cover" />
                                    ) : (
                                      <span className="text-xl">{acai.emoji}</span>
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <p className="font-bold text-zinc-800 dark:text-white text-sm truncate">{acai.name}</p>
                                      {!acai.isAvail && <span className="text-[9px] bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400 font-extrabold px-1.5 py-0.5 rounded uppercase">Esgotado</span>}
                                    </div>
                                    <p className={`text-xs ${acai.isTeal ? 'text-teal-600 dark:text-teal-400' : 'text-purple-600 dark:text-purple-400'} font-extrabold`}>{formatMoney(acai.price)}</p>
                                  </div>
                                </div>
                                {acai.isAvail ? (
                                  <button onClick={() => setProductSelectModal({ open: true, lojaId: selLoja.id, tipo: acai.key, quantity: 1 })} className={`${acai.isTeal ? 'bg-teal-600 hover:bg-teal-700' : 'bg-purple-600 hover:bg-purple-700'} text-white text-xs font-bold px-3 py-2 rounded-xl transition shadow shrink-0 active:scale-95`}>
                                    + Adicionar
                                  </button>
                                ) : (
                                  <span className="text-[10px] font-bold text-zinc-400 bg-zinc-200 dark:bg-zinc-800 px-2 py-1.5 rounded-lg shrink-0">
                                    Esgotado
                                  </span>
                                )}
                              </div>
                            ))}

                            {/* PRODUTOS EXTRAS (ORDENADOS: DISPONÍVEIS PRIMEIRO, ESGOTADOS NO FINAL) */}
                            {selLoja.products && [...selLoja.products].sort((a, b) => ((b.isAvailable !== false ? 1 : 0) - (a.isAvailable !== false ? 1 : 0))).map(p => {
                              const isAvail = p.isAvailable !== false;
                              return (
                                <div key={p.id} className={`p-3.5 rounded-2xl border transition-all flex justify-between items-center gap-3 ${
                                  isAvail 
                                    ? 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shadow-sm' 
                                    : 'bg-zinc-100/80 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 opacity-60'
                                }`}>
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-950 overflow-hidden shrink-0 border border-purple-200 dark:border-purple-800 flex items-center justify-center">
                                      {p.imageUrl ? (
                                        <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                                      ) : (
                                        <span className="text-xl">📦</span>
                                      )}
                                    </div>
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <p className="font-bold text-zinc-800 dark:text-white text-sm truncate">{p.name}</p>
                                        {!isAvail && <span className="text-[9px] bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400 font-extrabold px-1.5 py-0.5 rounded uppercase">Esgotado</span>}
                                      </div>
                                      <p className="text-xs text-purple-600 dark:text-purple-400 font-extrabold">{formatMoney(p.price)}</p>
                                    </div>
                                  </div>
                                  {isAvail ? (
                                    <button onClick={() => setProductSelectModal({ open: true, lojaId: selLoja.id, tipo: p.id, quantity: 1 })} className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold px-3 py-2 rounded-xl transition shadow shrink-0 active:scale-95">
                                      + Adicionar
                                    </button>
                                  ) : (
                                    <span className="text-[10px] font-bold text-zinc-400 bg-zinc-200 dark:bg-zinc-800 px-2 py-1.5 rounded-lg shrink-0">
                                      Esgotado
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })() : (
                  <>
                    <div className="space-y-3 mb-6">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <div>
                          <h3 className="font-bold text-lg text-zinc-900 dark:text-white flex items-center gap-2">
                            <span>🏪</span> Batedeiras de Açaí
                          </h3>
                          <p className="text-xs text-zinc-500">
                            {batedeirasFiltered.length} {batedeirasFiltered.length === 1 ? 'loja encontrada' : 'lojas encontradas'} {userCityNorm ? `em ${currentUser?.cidade}` : ''}
                          </p>
                        </div>
                        
                        <div className="relative w-full sm:w-72">
                          <input 
                            type="text"
                            value={searchQuery}
                            onChange={e => {
                              setSearchQuery(e.target.value);
                              setVisibleStoreLimit(12);
                            }}
                            placeholder="🔍 Buscar loja, bairro ou produto..."
                            className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl py-2 pl-9 pr-8 text-xs font-medium text-zinc-800 dark:text-white outline-none focus:border-purple-500 shadow-sm"
                          />
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs opacity-60">🔍</span>
                          {searchQuery && (
                            <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-400 hover:text-zinc-600 bg-zinc-100 dark:bg-zinc-800 rounded-full w-5 h-5 flex items-center justify-center">✕</button>
                          )}
                        </div>
                      </div>

                      {/* CHIPS DE FILTROS RÁPIDOS (SCROLL HORIZONTAL) */}
                      <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-none text-xs">
                        {[
                          { id: 'all', label: `Todas (${countTotal})` },
                          { id: 'open', label: `🟢 Abertas Agora (${countOpen})` },
                          { id: 'free_frete', label: `⚡ Frete Promocional (${countFreeFrete})` },
                          { id: 'nearest', label: '📍 Mais Próximas' },
                          { id: 'grosso', label: `🥣 Açaí Grosso (${countGrosso})` },
                          { id: 'branco', label: `🥥 Açaí Branco (${countBranco})` },
                          { id: 'lowest_price', label: '💲 Menor Preço' },
                        ].map(chip => (
                          <button
                            key={chip.id}
                            onClick={() => {
                              setSelectedCategoryChip(chip.id as any);
                              setVisibleStoreLimit(12);
                            }}
                            className={`px-3 py-1.5 rounded-full font-bold whitespace-nowrap transition-all flex items-center gap-1 shrink-0 border ${
                              selectedCategoryChip === chip.id
                                ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                                : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                            }`}
                          >
                            {chip.label}
                          </button>
                        ))}

                        {/* FILTRO DE BAIRRO (SE HOUVER MAIS DE 1) */}
                        {bairrosList.length > 1 && (
                          <div className="flex items-center gap-1 shrink-0">
                            <span className="text-zinc-400 text-xs font-semibold pl-1">Bairro:</span>
                            <select
                              value={selectedBairro}
                              onChange={(e) => {
                                setSelectedBairro(e.target.value);
                                setVisibleStoreLimit(12);
                              }}
                              aria-label="Filtrar por Bairro"
                              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-full px-3 py-1.5 text-xs font-bold text-zinc-700 dark:text-zinc-300 outline-none focus:border-purple-500 shadow-xs cursor-pointer"
                            >
                              <option value="all">📍 Todos os Bairros</option>
                              {bairrosList.map(b => (
                                <option key={b} value={b}>{b}</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
                      {batedeirasFiltered.length === 0 ? (
                        <div className="col-span-full p-8 text-center bg-white dark:bg-zinc-900 rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-800 text-zinc-500 text-sm">
                          <p className="text-3xl mb-2">🔍</p>
                          <p className="font-bold text-zinc-700 dark:text-zinc-300">Nenhuma batedeira encontrada</p>
                          <p className="text-xs text-zinc-500 mt-1">Tente remover os filtros ou buscar por outro termo.</p>
                          {(searchQuery || selectedCategoryChip !== 'all' || selectedBairro !== 'all') && (
                            <button
                              onClick={() => {
                                setSearchQuery('');
                                setSelectedCategoryChip('all');
                                setSelectedBairro('all');
                              }}
                              className="mt-3 px-3.5 py-1.5 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 rounded-lg text-xs font-bold"
                            >
                              Limpar Filtros
                            </button>
                          )}
                        </div>
                      ) : batedeiras.map(loja => {
                        const { freteCliente, dist, subsidy } = calcFreteCliente(loja.id);
                        const isSelectedLoja = cart.storeId === loja.id && cart.items.length > 0;
                        const isLojaPaused = loja.status === 'paused';
                        const minTime = Math.max(15, Math.min(50, 15 + Math.round(dist * 3.5)));
                        const maxTime = Math.max(25, Math.min(65, 25 + Math.round(dist * 3.5)));

                        return (
                          <div 
                            key={loja.id} 
                            className={`group bg-white dark:bg-zinc-900 p-4 sm:p-5 rounded-2xl shadow-xs border transition-all duration-200 hover:shadow-lg flex flex-col justify-between gap-3 relative overflow-hidden ${
                              isSelectedLoja 
                                ? 'border-purple-500 ring-2 ring-purple-500/30' 
                                : 'border-zinc-200/90 dark:border-zinc-800/90 hover:border-purple-400 dark:hover:border-purple-600'
                            } ${isLojaPaused ? 'opacity-70 bg-zinc-50/90 dark:bg-zinc-950/70' : ''}`}
                          >
                              {isSelectedLoja && (
                                <div className="absolute top-0 right-0 bg-purple-600 text-white text-[9px] font-extrabold uppercase px-2.5 py-0.5 rounded-bl-lg shadow-xs">
                                  No Carrinho ({cartTotalQuantity})
                                </div>
                              )}

                              <div>
                                {/* TOPO DO CARD: ÍCONE, NOME COMPLETO E DISTÂNCIA */}
                                <div className="flex items-start justify-between gap-2.5 mb-2.5">
                                  <div className="flex items-start gap-2.5 min-w-0">
                                    <div className="w-11 h-11 rounded-2xl bg-purple-50 dark:bg-purple-950/70 shrink-0 border border-purple-100 dark:border-purple-900/40 flex items-center justify-center text-2xl shadow-xs group-hover:scale-105 transition">
                                      {loja.icon || '🏪'}
                                    </div>
                                    <div className="min-w-0">
                                      <h4 className="font-extrabold text-zinc-900 dark:text-white text-sm sm:text-base leading-snug truncate" title={loja.name}>
                                        {loja.name}
                                      </h4>
                                      <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 mt-0.5">
                                        <span className="truncate">📍 {loja.bairro || 'Centro'}</span>
                                        <span className="text-amber-500 font-bold shrink-0">★ 4.9</span>
                                      </div>
                                    </div>
                                  </div>

                                  {currentUser && (
                                    <button 
                                      onClick={() => {
                                        const latOrig = loja?.lat || 0;
                                        const lngOrig = loja?.lng || 0;
                                        const latDest = currentUser?.lat || (latOrig ? latOrig + 0.0045 : -1.455);
                                        const lngDest = currentUser?.lng || (lngOrig ? lngOrig + 0.0045 : -48.490);
                                        setMapModal({
                                          open: true,
                                          origem: { lat: latOrig, lng: lngOrig, name: loja.name || 'Retirada' },
                                          destino: { lat: latDest, lng: lngDest, name: currentUser.name || 'Entrega' },
                                          motorista: null
                                        });
                                      }} 
                                      className="text-[11px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 px-2 py-1 rounded-xl shrink-0 transition flex items-center gap-1 border border-blue-200/80 dark:border-blue-800/80 shadow-xs"
                                      title="Ver rota no mapa"
                                    >
                                      🗺️ {dist.toFixed(1)} km
                                    </button>
                                  )}
                                </div>

                                {/* BADGES DE STATUS & TEMPO */}
                                <div className="flex items-center gap-1.5 flex-wrap mb-2.5">
                                  {isLojaPaused ? (
                                    <span className="text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/40 px-2 py-0.5 rounded-md">🔴 Fechada</span>
                                  ) : (
                                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900/40 px-2 py-0.5 rounded-md">🟢 Aberta</span>
                                  )}
                                  {subsidy > 0 && (
                                    <span className="text-[10px] font-extrabold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/50 border border-orange-200 dark:border-orange-900/40 px-2 py-0.5 rounded-md">⚡ Frete -{subsidy}%</span>
                                  )}
                                  <span className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md">⏱️ {minTime}-{maxTime} min</span>
                                </div>
                                
                                <div className="bg-zinc-50 dark:bg-zinc-950/70 p-2.5 rounded-xl flex flex-col gap-1 text-xs mb-2.5 border border-zinc-100 dark:border-zinc-800/80">
                                    <div className="flex justify-between items-center text-xs">
                                      <span className="text-zinc-500 font-medium">A partir de:</span>
                                      <span className="font-extrabold text-purple-600 dark:text-purple-400 text-sm">{formatMoney(loja.priceB2C?.popular || loja.priceB2C?.medio || 0)} <span className="text-[10px] text-zinc-400 font-normal">/L</span></span>
                                    </div>
                                    <div className="flex justify-between items-center text-[11px]">
                                      <span className="text-zinc-500">Entrega estimada:</span>
                                      <span className="font-bold text-zinc-800 dark:text-zinc-200">{formatMoney(freteCliente)}</span>
                                    </div>
                                </div>

                                {/* TAGS DE TIPOS DE AÇAÍ DISPONÍVEIS */}
                                <div className="flex items-center gap-1 flex-wrap">
                                  {loja.availabilityB2C?.popular !== false && (
                                    <span className="text-[9px] bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/40 px-1.5 py-0.5 rounded font-bold">🥣 Popular</span>
                                  )}
                                  {loja.availabilityB2C?.medio !== false && (
                                    <span className="text-[9px] bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/40 px-1.5 py-0.5 rounded font-bold">🥣 Médio</span>
                                  )}
                                  {loja.availabilityB2C?.grosso !== false && (
                                    <span className="text-[9px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40 px-1.5 py-0.5 rounded font-bold">🌿 Grosso</span>
                                  )}
                                  {loja.availabilityB2C?.branco !== false && (
                                    <span className="text-[9px] bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300 border border-teal-200/60 dark:border-teal-800/40 px-1.5 py-0.5 rounded font-bold">🥥 Branco</span>
                                  )}
                                </div>
                              </div>
                              
                               {isLojaPaused ? (
                                 <button 
                                   onClick={() => alert(`⚠️ A batedeira "${loja.name}" está fechada no momento e não está aceitando pedidos agora.`)}
                                   className="w-full mt-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700/60 text-zinc-400 dark:text-zinc-500 font-bold py-2.5 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700/60 transition flex justify-center items-center gap-1.5 text-xs"
                                 >
                                   ⛔ Fechada no Momento
                                 </button>
                               ) : (
                                 <button 
                                   onClick={() => handleSelectStore(loja.id)} 
                                   className="w-full mt-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-extrabold py-2.5 px-3 rounded-xl shadow-sm transition-all duration-150 active:scale-98 flex justify-center items-center gap-1.5 text-xs cursor-pointer"
                                 >
                                     <ShoppingCart size={14} /> Ver Cardápio & Pedir
                                 </button>
                               )}
                          </div>
                        );
                      })}
                    </div>

                    {/* BOTÃO CARREGAR MAIS (PAGINAÇÃO EM LOTES) */}
                    {batedeirasFiltered.length > visibleStoreLimit && (
                      <div className="flex flex-col items-center justify-center pt-4 pb-2 gap-2">
                        <p className="text-xs text-zinc-500">
                          Exibindo <strong>{batedeiras.length}</strong> de <strong>{batedeirasFiltered.length}</strong> batedeiras
                        </p>
                        <button
                          onClick={() => setVisibleStoreLimit(prev => prev + 12)}
                          className="px-6 py-2.5 bg-white dark:bg-zinc-900 border border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/40 rounded-xl text-xs font-extrabold transition shadow-sm active:scale-95 cursor-pointer"
                        >
                          ➕ Carregar Mais Batedeiras (+12)
                        </button>
                      </div>
                    )}
                  </>
                )}
            </div>

        {currentUser && meusPedidos.length > 0 && (
          <div className="mt-8">
              <div className="flex items-center justify-between mb-4 border-b border-zinc-200 dark:border-zinc-800 pb-2">
                <h3 className="font-extrabold text-lg text-zinc-900 dark:text-white flex items-center gap-2">
                  <span>🛍️</span> Meus Pedidos ({meusPedidos.length})
                </h3>
                {clientActiveOrders.length > 0 && (
                  <span className="text-xs bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-extrabold px-2.5 py-1 rounded-full border border-emerald-300 dark:border-emerald-800 animate-pulse">
                    ⚡ {clientActiveOrders.length} em andamento
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {meusPedidos.map(o => {
                  const isCanceled = o.status === 'cancelado';
                  const isActive = o.status !== 'entregue' && o.status !== 'cancelado' && o.status !== 'arquivado';
                  
                  return (
                    <div 
                      key={o.id} 
                      className={`bg-white dark:bg-zinc-900 p-4 sm:p-5 rounded-2xl shadow-xs border transition-all flex flex-col justify-between gap-3 ${
                        isActive
                          ? 'border-purple-400 dark:border-purple-700 ring-1 ring-purple-400/20' 
                          : isCanceled 
                            ? 'border-zinc-200 dark:border-zinc-800 opacity-60' 
                            : 'border-zinc-200 dark:border-zinc-800'
                      }`}
                    >
                        <div>
                            <div className="flex items-start justify-between gap-2">
                              <p className="font-extrabold text-zinc-900 dark:text-white text-sm">{o.title} <span className="text-[11px] text-zinc-400 font-normal">({o.id.slice(-6)})</span></p>
                              <div>
                                {o.status === 'aguardando_pagamento' && <span className="bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase animate-pulse">⏳ Pix Pendente</span>}
                                {o.status === 'pendente' && <span className="bg-yellow-100 text-yellow-800 dark:bg-yellow-950/60 dark:text-yellow-300 px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase">Aguardando Loja</span>}
                                {o.status === 'preparo' && <span className="bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase">Em Preparo</span>}
                                {o.status === 'pronto' && <span className="bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300 px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase">Aguardando Entregador</span>}
                                {o.status === 'em_rota' && <span className="bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase">🛵 Moto em Rota</span>}
                                {o.status === 'aguardando_cliente' && <span className="bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase font-black">📍 Chegou!</span>}
                                {(o.status === 'entregue' || o.status === 'arquivado') && <span className="bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300 px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase">✅ Entregue</span>}
                                {isCanceled && <span className="bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase">Cancelado</span>}
                              </div>
                            </div>

                             <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-1 font-bold">
                               Motorista: {(() => {
                                 const mUser = o.motoristaId ? store.users[o.motoristaId] : null;
                                 const dName = o.motoristaNome || mUser?.name;
                                 const isFinished = o.status === 'entregue' || o.status === 'cancelado' || o.status === 'arquivado' || !!o.receivedAt || !!o.deliveredAt;
                                 return dName || (isFinished ? 'Concluído' : 'Aguardando Atribuição');
                               })()}
                             </p>
                            {o.deliveryAddress && (
                              <p className="text-xs text-purple-700 dark:text-purple-300 font-bold mt-0.5 truncate">📍 {o.deliveryAddress}</p>
                            )}
                            {o.deliveryReference && (
                              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 italic">📌 {o.deliveryReference}</p>
                            )}
                            <p className="text-xs text-zinc-500 mt-1">Total: <strong className="text-zinc-800 dark:text-zinc-200">{formatMoney(o.valor + o.taxas.entregaCliente)}</strong> (Frete: {formatMoney(o.taxas.entregaCliente)})</p>
                            
                            {o.deliveryPin && !isCanceled && o.status !== 'entregue' && o.status !== 'arquivado' && (
                               <div className="mt-3 bg-zinc-900 dark:bg-zinc-950 text-white p-2.5 rounded-xl flex items-center justify-between shadow-xs border border-zinc-700">
                                   <div>
                                       <p className="text-[9px] font-bold uppercase text-zinc-400">PIN de Entrega</p>
                                       <p className="text-[11px] text-zinc-300 leading-tight">Informe ao entregador</p>
                                   </div>
                                   <div className="text-xl font-black tracking-widest text-emerald-400">{o.deliveryPin}</div>
                               </div>
                            )}

                             {!isCanceled && (
                                <div className="flex flex-wrap gap-2 mt-3">
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
                                    className="text-[11px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2.5 py-1.5 rounded-lg inline-flex items-center gap-1 border border-blue-200 dark:border-blue-800"
                                  >
                                    🗺️ Ver Rota ({(o.distancia || 0).toFixed(1)} km)
                                  </button>
                                  <button
                                    onClick={() => {
                                      const motoristaUser = o.motoristaId ? store.users[o.motoristaId] : null;
                                      const lojaUser = o.origemId ? store.users[o.origemId] : null;
                                      const targetOther = motoristaUser || lojaUser;
                                      setChatModalData({
                                        open: true,
                                        orderId: o.id,
                                        otherName: targetOther?.name || o.lojaNome || 'Atendimento',
                                        otherPhone: (targetOther as any)?.phone || targetOther?.telefone || '',
                                        otherRole: motoristaUser ? 'Motoboy' : 'Batedeira'
                                      });
                                    }}
                                    className="text-[11px] font-bold text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/40 hover:bg-purple-200 px-2.5 py-1.5 rounded-lg inline-flex items-center gap-1 transition shadow-xs"
                                  >
                                    💬 Chat & 📞 Voz
                                  </button>
                                </div>
                             )}
                        </div>
                        
                        <div className="flex items-center justify-end w-full border-t border-zinc-100 dark:border-zinc-800 pt-2.5 gap-2">
                            {o.status === 'aguardando_pagamento' && (
                              <button 
                                onClick={async () => {
                                  try {
                                    const res = await fetch(`/api/asaas/status?orderId=${o.id}`);
                                    if (res.ok) {
                                      const data = await res.json();
                                      if (data.isPaid) {
                                        store.acaoPedido(o.id, 'confirmar_pagamento');
                                        alert("✅ Pagamento confirmado no Asaas! Seu pedido foi enviado para a loja.");
                                      } else {
                                        alert("Pagamento ainda em processamento no Asaas. Aguarde alguns instantes.");
                                      }
                                    }
                                  } catch(err) {
                                    alert("Erro ao verificar pagamento no Asaas.");
                                  }
                                }}
                                className="text-xs bg-amber-500 hover:bg-amber-600 text-white font-bold px-3 py-1.5 rounded-lg transition shadow-xs"
                              >
                                🔍 Checar Pix no Asaas
                              </button>
                            )}
  
                            {!isCanceled && o.status !== 'entregue' && o.status !== 'arquivado' && o.status !== 'em_rota' && o.status !== 'aguardando_cliente' && (
                              <button 
                                onClick={() => {
                                  const reason = prompt("Informe o motivo do cancelamento para estorno Pix Asaas:", "Desistência");
                                  if (reason !== null && reason.trim() !== "") {
                                    store.acaoPedido(o.id, 'cancelar_cliente', undefined, reason.trim());
                                    alert("❌ Pedido cancelado.");
                                  }
                                }} 
                                className="text-xs bg-red-100 hover:bg-red-200 text-red-700 font-bold px-3 py-1.5 rounded-lg transition"
                              >
                                ❌ Cancelar Pedido
                              </button>
                            )}

                            {isCanceled && (
                              <button onClick={() => { if(confirm('Deseja excluir este pedido do seu histórico?')) store.acaoPedido(o.id, 'deletar_pedido') }} className="text-xs bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold px-3 py-1.5 rounded-lg transition">🗑️ Excluir</button>
                            )}
                        </div>
                    </div>
                  )
                })}
              </div>
          </div>
        )}

      </main>

      <footer className="mt-12 py-8 border-t border-zinc-200 dark:border-zinc-800 text-center flex flex-col items-center justify-center space-y-4">
        <div className="p-3 bg-white dark:bg-zinc-900 rounded-2xl shadow-xs border border-zinc-200 dark:border-zinc-800 inline-block">
          <img src="/appsolutions76-logo.png" alt="AppSolutions76" className="max-w-[220px] h-auto object-contain" />
        </div>
        <div className="text-xs text-zinc-500 dark:text-zinc-400 space-y-1">
           <p className="font-extrabold text-zinc-800 dark:text-zinc-200">Desenvolvido por AppSolutions76</p>
           <p className="text-[11px]">TECNOLOGIA & INOVAÇÃO PARAENSE | Belém - PA</p>
           <p className="text-[11px]">Contato: <a href="mailto:appsolutions76@gmail.com" className="text-purple-600 dark:text-purple-400 font-semibold hover:underline">appsolutions76@gmail.com</a></p>
        </div>
      </footer>

      {/* Product Select Modal */}
      {productSelectModal.open && (
        <div className="fixed inset-0 bg-black/70 z-[150] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in slide-in-from-bottom-full sm:zoom-in-95">
              <div className="bg-purple-900 text-white p-4 sm:p-5 flex justify-between items-center">
                  <h3 className="font-bold text-lg">🛒 Adicionar ao Carrinho</h3>
                  <button onClick={() => setProductSelectModal({ ...productSelectModal, open: false })} className="text-white hover:text-red-300 font-bold text-2xl leading-none">&times;</button>
              </div>
              
              <div className="p-6">
                  <p className="text-xs text-zinc-500 font-bold uppercase mb-1">Loja selecionada</p>
                  <h4 className="font-bold text-zinc-800 dark:text-white text-xl mb-4">{store.users?.[productSelectModal.lojaId]?.name}</h4>
                  
                  <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">Escolha seu Produto:</label>
                  {(() => {
                      const loja = store.users?.[productSelectModal.lojaId];
                      const isSupplier = loja?.role === 'fornecedor';
                      const pricePopular = loja?.priceB2C?.popular ?? 20;
                      const priceMedio = loja?.priceB2C?.medio ?? 26;
                      const priceGrosso = loja?.priceB2C?.grosso ?? 35;
                      const priceBranco = loja?.priceB2C?.branco ?? 38;
                      const priceLata = loja?.priceB2B ?? 140;
                      const isPopAvail = loja?.availabilityB2C?.popular !== false;
                      const isMedAvail = loja?.availabilityB2C?.medio !== false;
                      const isGroAvail = loja?.availabilityB2C?.grosso !== false;
                      const isBraAvail = loja?.availabilityB2C?.branco !== false;
                      const isLataAvail = loja?.availabilityB2B?.lata !== false;

                      if (isSupplier) {
                        return (
                          <select 
                            value={productSelectModal.tipo} 
                            onChange={e => setProductSelectModal({ ...productSelectModal, tipo: e.target.value })}
                            className="w-full border-2 border-purple-100 dark:border-zinc-700 rounded-xl p-3 bg-purple-50 dark:bg-zinc-800 text-purple-900 dark:text-purple-300 font-bold outline-none focus:border-purple-500 transition mb-4"
                          >
                            <optgroup label="Matéria-Prima B2B (Fruto)">
                              <option value="lata" disabled={!isLataAvail}>
                                Lata de Açaí Fruto (14kg) - {formatMoney(priceLata)} {!isLataAvail ? '(Esgotado)' : ''}
                              </option>
                            </optgroup>

                              {loja?.products && loja.products.length > 0 && (
                                <optgroup label="Produtos & Insumos Extras">
                                  {[...loja.products].sort((a, b) => ((b.isAvailable !== false ? 1 : 0) - (a.isAvailable !== false ? 1 : 0))).map(p => {
                                    const isProdAvail = p.isAvailable !== false;
                                    return (
                                      <option key={p.id} value={p.id} disabled={!isProdAvail}>
                                        {p.name} - {formatMoney(p.price)} {!isProdAvail ? '(Esgotado)' : ''}
                                      </option>
                                    );
                                  })}
                                </optgroup>
                              )}
                          </select>
                        );
                      }

                      const acaiOptions = [
                        { key: 'popular', label: 'Açaí Popular', price: pricePopular, isAvail: isPopAvail },
                        { key: 'medio', label: 'Açaí Médio', price: priceMedio, isAvail: isMedAvail },
                        { key: 'grosso', label: 'Açaí Grosso (Especial)', price: priceGrosso, isAvail: isGroAvail },
                        { key: 'branco', label: 'Açaí Branco (Especial)', price: priceBranco, isAvail: isBraAvail },
                      ].sort((a, b) => (b.isAvail ? 1 : 0) - (a.isAvail ? 1 : 0));

                      return (
                          <select 
                            value={productSelectModal.tipo} 
                            onChange={e => setProductSelectModal({ ...productSelectModal, tipo: e.target.value })}
                            className="w-full border-2 border-purple-100 dark:border-zinc-700 rounded-xl p-3 bg-purple-50 dark:bg-zinc-800 text-purple-900 dark:text-purple-300 font-bold outline-none focus:border-purple-500 transition mb-4"
                          >
                              <optgroup label="Açaí Padrão & Especiais (1L)">
                                  {acaiOptions.map(opt => (
                                    <option key={opt.key} value={opt.key} disabled={!opt.isAvail}>
                                      {opt.label} - {formatMoney(opt.price)} {!opt.isAvail ? '(Esgotado)' : ''}
                                    </option>
                                  ))}
                              </optgroup>
                              
                              {loja?.products && loja.products.length > 0 && (
                                  <optgroup label="Produtos Extras">
                                      {[...loja.products].sort((a, b) => ((b.isAvailable !== false ? 1 : 0) - (a.isAvailable !== false ? 1 : 0))).map(p => {
                                          const isProdAvail = p.isAvailable !== false;
                                          return (
                                            <option key={p.id} value={p.id} disabled={!isProdAvail}>
                                              {p.name} - {formatMoney(p.price)} {!isProdAvail ? '(Esgotado)' : ''}
                                            </option>
                                          );
                                      })}
                                  </optgroup>
                              )}
                          </select>
                      );
                  })()}

                  <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">Quantidade:</label>
                  <div className="flex items-center gap-4 mb-6">
                      <button onClick={() => setProductSelectModal(prev => ({...prev, quantity: Math.max(1, prev.quantity - 1)}))} className="bg-zinc-200 dark:bg-zinc-800 w-10 h-10 rounded-full font-bold text-lg">-</button>
                      <span className="font-bold text-xl">{productSelectModal.quantity}</span>
                      <button onClick={() => setProductSelectModal(prev => ({...prev, quantity: prev.quantity + 1}))} className="bg-zinc-200 dark:bg-zinc-800 w-10 h-10 rounded-full font-bold text-lg">+</button>
                  </div>
                  
                  <div className="space-y-3 mb-6 text-sm text-zinc-600 dark:text-zinc-400">
                      <div className="flex justify-between pt-2 text-lg">
                          <span className="font-bold text-zinc-800 dark:text-white">Subtotal do Item:</span>
                          <span className="font-bold text-purple-600 dark:text-purple-400">{formatMoney(getCartPrice(productSelectModal.lojaId, productSelectModal.tipo) * productSelectModal.quantity)}</span>
                      </div>
                  </div>
                  
                  <div className="flex gap-3">
                      <button onClick={() => setProductSelectModal({ ...productSelectModal, open: false })} className="flex-1 px-4 py-3 bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold rounded-xl active:scale-95 transition">Cancelar</button>
                      <button onClick={handleAddToCart} className="flex-1 px-4 py-3 bg-purple-600 text-white font-bold rounded-xl shadow-lg hover:bg-purple-700 active:scale-95 transition">Adicionar ao Carrinho</button>
                  </div>
              </div>
          </div>
        </div>
      )}

      {/* Cart Checkout Modal */}
      {checkoutModalOpen && cart.storeId && (
        <div className="fixed inset-0 bg-black/70 z-[150] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in slide-in-from-bottom-full sm:zoom-in-95 flex flex-col max-h-[90vh]">
              <div className="bg-purple-900 text-white p-4 sm:p-5 flex justify-between items-center shrink-0">
                  <h3 className="font-bold text-lg">🛒 Seu Pedido</h3>
                  <button onClick={() => setCheckoutModalOpen(false)} className="text-white hover:text-red-300 font-bold text-2xl leading-none">&times;</button>
              </div>
              
              <div className="p-6 overflow-y-auto flex-1">
                  <p className="text-xs text-zinc-500 font-bold uppercase mb-1">Loja selecionada</p>
                  <h4 className="font-bold text-zinc-800 dark:text-white text-xl mb-4">{store.users?.[cart.storeId]?.name}</h4>
                  
                  <div className="space-y-4 mb-6">
                      {cart.items.map(item => (
                          <div key={item.id} className="flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800 pb-3">
                              <div className="flex-1">
                                  <p className="font-bold text-zinc-800 dark:text-white">{item.name}</p>
                                  <p className="text-xs text-zinc-500">{formatMoney(item.price)} un</p>
                              </div>
                              <div className="flex items-center gap-3">
                                  <div className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg px-2 py-1">
                                      <button onClick={() => updateCartQuantity(item.id, item.quantity - 1)} className="w-6 h-6 rounded-full font-bold bg-white dark:bg-zinc-700 flex items-center justify-center shadow-sm">-</button>
                                      <span className="font-bold text-sm w-4 text-center">{item.quantity}</span>
                                      <button onClick={() => updateCartQuantity(item.id, item.quantity + 1)} className="w-6 h-6 rounded-full font-bold bg-white dark:bg-zinc-700 flex items-center justify-center shadow-sm">+</button>
                                  </div>
                                  <button onClick={() => removeFromCart(item.id)} className="text-red-500 hover:text-red-600 font-bold text-xl ml-2">&times;</button>
                              </div>
                          </div>
                      ))}
                  </div>
                  
                  {!currentUser ? (
                    <div className="bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded-xl p-3.5 mb-5 space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">✨</span>
                        <div>
                          <p className="text-xs font-bold text-purple-900 dark:text-purple-200">Finalizar Cadastro & Entrega</p>
                          <p className="text-[10px] text-purple-700 dark:text-purple-400">Preencha seus dados para receber o açaí e criar sua conta AçaíFood</p>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-zinc-600 dark:text-zinc-400 uppercase mb-1">Seu Nome Completo *</label>
                        <input
                          type="text"
                          placeholder="Ex: Maria dos Santos"
                          value={guestName}
                          onChange={e => setGuestName(e.target.value)}
                          className="w-full text-xs p-2.5 rounded-lg border border-purple-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 outline-none focus:border-purple-500 font-medium text-zinc-800 dark:text-white"
                          required
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold text-zinc-600 dark:text-zinc-400 uppercase mb-1">WhatsApp / Celular *</label>
                          <input
                            type="tel"
                            placeholder="(91) 99999-9999"
                            value={guestPhone}
                            onChange={e => setGuestPhone(e.target.value)}
                            className="w-full text-xs p-2.5 rounded-lg border border-purple-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 outline-none focus:border-purple-500 font-medium text-zinc-800 dark:text-white"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-zinc-600 dark:text-zinc-400 uppercase mb-1">CPF (opcional para Pix)</label>
                          <input
                            type="text"
                            placeholder="000.000.000-00"
                            value={guestCpf}
                            onChange={e => setGuestCpf(e.target.value)}
                            className="w-full text-xs p-2.5 rounded-lg border border-purple-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 outline-none focus:border-purple-500 font-medium text-zinc-800 dark:text-white"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold text-zinc-600 dark:text-zinc-400 uppercase mb-1">E-mail de Acesso *</label>
                          <input
                            type="email"
                            placeholder="seuemail@exemplo.com"
                            value={guestEmail}
                            onChange={e => setGuestEmail(e.target.value)}
                            className="w-full text-xs p-2.5 rounded-lg border border-purple-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 outline-none focus:border-purple-500 font-medium text-zinc-800 dark:text-white"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-zinc-600 dark:text-zinc-400 uppercase mb-1">Crie uma Senha *</label>
                          <input
                            type="password"
                            placeholder="Mínimo 6 dígitos"
                            value={guestPassword}
                            onChange={e => setGuestPassword(e.target.value)}
                            className="w-full text-xs p-2.5 rounded-lg border border-purple-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 outline-none focus:border-purple-500 font-medium text-zinc-800 dark:text-white"
                            required
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-zinc-600 dark:text-zinc-400 uppercase mb-1">Endereço de Entrega (Rua, Bairro e Número) *</label>
                        <input
                          type="text"
                          placeholder="Ex: Tv. Quintino Bocaiúva, 1200 - Nazaré"
                          value={customAddress}
                          onChange={e => setCustomAddress(e.target.value)}
                          className="w-full text-xs p-2.5 rounded-lg border border-purple-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 outline-none focus:border-purple-500 font-medium text-zinc-800 dark:text-white"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-zinc-600 dark:text-zinc-400 uppercase mb-1">Ponto de Referência</label>
                        <input
                          type="text"
                          placeholder="Ex: Próximo à praça, Bloco B Apto 204"
                          value={customReference}
                          onChange={e => setCustomReference(e.target.value)}
                          className="w-full text-xs p-2.5 rounded-lg border border-purple-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 outline-none focus:border-purple-500 font-medium text-zinc-800 dark:text-white"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded-xl p-3 mb-5">
                        <label className="block text-xs font-bold uppercase text-purple-900 dark:text-purple-300 mb-2">📍 Onde deseja receber seu pedido?</label>
                        
                        <div className="space-y-2">
                            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-zinc-800 dark:text-zinc-200 bg-white dark:bg-zinc-800 p-2 rounded-lg border border-purple-100 dark:border-zinc-700">
                                <input 
                                    type="radio" 
                                    name="addressMode" 
                                    checked={addressMode === 'profile'} 
                                    onChange={() => setAddressMode('profile')}
                                    className="accent-purple-600"
                                />
                                <span>🏠 Endereço de Cadastro ({currentUser?.bairro || 'Casa'})</span>
                            </label>

                            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-zinc-800 dark:text-zinc-200 bg-white dark:bg-zinc-800 p-2 rounded-lg border border-purple-100 dark:border-zinc-700">
                                <input 
                                    type="radio" 
                                    name="addressMode" 
                                    checked={addressMode === 'gps'} 
                                    onChange={() => {
                                        setAddressMode('gps');
                                        if (!gpsLocation) handleGetGpsLocation();
                                    }}
                                    className="accent-purple-600"
                                />
                                <div className="flex-1 flex justify-between items-center">
                                    <span>📍 Usar GPS Atual (Rua / Praça)</span>
                                    {isLocating ? (
                                        <span className="text-[10px] text-purple-600 animate-pulse">Obtendo GPS...</span>
                                    ) : (
                                        <button 
                                            type="button"
                                            onClick={(e) => { e.preventDefault(); handleGetGpsLocation(); }}
                                            className="text-[10px] bg-purple-100 text-purple-700 font-bold px-2 py-0.5 rounded hover:bg-purple-200"
                                        >
                                            {gpsLocation ? '🔄 Atualizar GPS' : '📍 Obter GPS'}
                                        </button>
                                    )}
                                </div>
                            </label>
                            {addressMode === 'gps' && gpsLocation && (
                                <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 ml-6">
                                    ✅ Posição capturada: Lat {gpsLocation.lat.toFixed(4)}, Lng {gpsLocation.lng.toFixed(4)}
                                </p>
                            )}

                            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-zinc-800 dark:text-zinc-200 bg-white dark:bg-zinc-800 p-2 rounded-lg border border-purple-100 dark:border-zinc-700">
                                <input 
                                    type="radio" 
                                    name="addressMode" 
                                    checked={addressMode === 'custom'} 
                                    onChange={() => setAddressMode('custom')}
                                    className="accent-purple-600"
                                />
                                <span>➕ Outro Endereço / Ponto de Encontro</span>
                            </label>

                            {addressMode === 'custom' && (
                                <div className="mt-2 space-y-2 ml-1">
                                    <input 
                                        type="text" 
                                        placeholder="Digite a Rua, Bairro e Número..." 
                                        value={customAddress}
                                        onChange={e => setCustomAddress(e.target.value)}
                                        className="w-full text-xs p-2 rounded-lg border border-purple-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 outline-none focus:border-purple-500 font-medium"
                                    />
                                </div>
                            )}

                            <div className="mt-2 pt-2 border-t border-purple-100 dark:border-purple-900/50">
                                <input 
                                    type="text" 
                                    placeholder="Ponto de referência (ex: Na mesa da praça, Em frente à farmácia)" 
                                    value={customReference}
                                    onChange={e => setCustomReference(e.target.value)}
                                    className="w-full text-xs p-2 rounded-lg border border-purple-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 outline-none focus:border-purple-500 font-medium"
                                />
                            </div>
                        </div>
                    </div>
                  )}

                  <div className="space-y-3 mb-6 text-sm text-zinc-600 dark:text-zinc-400">
                      <div className="flex justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2">
                          <span>Subtotal ({cartTotalQuantity} itens):</span>
                          <span className="font-bold text-zinc-800 dark:text-white">{formatMoney(cartItemsTotal)}</span>
                      </div>
                      <div className="flex justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2">
                          <span>Frete ({rates.courier_payment_mode === 'FIXED' ? 'Valor Fixo' : 'Estimativa por KM'}):</span>
                          <span className="font-bold text-zinc-800 dark:text-white">{formatMoney(cartFrete)}</span>
                      </div>
                      <div className="flex justify-between pt-2 text-lg">
                          <span className="font-bold text-zinc-800 dark:text-white">Total a Pagar:</span>
                          <span className="font-bold text-purple-600 dark:text-purple-400">{formatMoney(finalCartTotal)}</span>
                      </div>
                  </div>
                  
                  <div className="flex gap-3 mt-4">
                      <button onClick={() => setCheckoutModalOpen(false)} className="flex-1 px-4 py-3 bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold rounded-xl active:scale-95 transition">Continuar Comprando</button>
                      <button 
                        onClick={handleConfirmOrder} 
                        disabled={isRegisteringGuest}
                        className="flex-1 px-4 py-3 bg-purple-600 text-white font-bold rounded-xl shadow-lg hover:bg-purple-700 active:scale-95 transition flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {isRegisteringGuest ? (
                          <span>⏳ Criando conta & Gerando Pix...</span>
                        ) : !currentUser ? (
                          <><span>✨</span> Criar Conta & Pagar Pix</>
                        ) : (
                          <><span className="text-lg">🛒</span> Pagar via Pix</>
                        )}
                      </button>
                  </div>
              </div>
          </div>
        </div>
      )}

      {/* Floating Cart Button */}
      {cart.items.length > 0 && cart.storeId && !checkoutModalOpen && (
          <div className="fixed bottom-6 left-0 right-0 px-4 sm:px-6 max-w-3xl mx-auto z-40 animate-in slide-in-from-bottom-10">
              <button 
                  onClick={() => setCheckoutModalOpen(true)}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white shadow-2xl rounded-2xl p-4 flex justify-between items-center transition active:scale-95"
              >
                  <div className="flex items-center gap-3">
                      <div className="bg-purple-800/50 w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg relative">
                          🛒
                          <span className="absolute -top-1 -right-1 bg-white text-purple-600 text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-black">{cartTotalQuantity}</span>
                      </div>
                      <div className="text-left">
                          <p className="text-xs text-purple-200 font-medium">Ver Carrinho</p>
                          <p className="font-bold text-sm truncate max-w-[150px]">{store.users?.[cart.storeId]?.name}</p>
                      </div>
                  </div>
                  <div className="font-black text-xl">
                      {formatMoney(finalCartTotal)}
                  </div>
              </button>
          </div>
      )}

      <MapModal 
        isOpen={mapModal.open} 
        onClose={() => setMapModal(prev => ({ ...prev, open: false }))} 
        origem={mapModal.origem} 
        destino={mapModal.destino} 
        motorista={mapModal.motorista} 
      />

      <PixModal 
        data={pixModalData} 
        onClose={() => setPixModalData({ open: false })} 
      />

      {/* Modal para Solicitação de CPF no Checkout */}
      {cpfModalOpen && (
        <div className="fixed inset-0 bg-black/75 z-[210] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-zinc-200 dark:border-zinc-800 animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                🆔 Confirmar CPF / CNPJ
              </h3>
              <button onClick={() => setCpfModalOpen(false)} className="text-zinc-400 hover:text-zinc-600 text-xl font-bold">&times;</button>
            </div>
            
            <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-4">
              Para emitir o Pix registrado no Banco Central (via Asaas), informe seu CPF ou CNPJ:
            </p>

            <form onSubmit={handleSaveCpfAndContinue} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1 uppercase">CPF ou CNPJ</label>
                <input 
                  type="text" 
                  required 
                  value={cpfInputValue} 
                  onChange={e => setCpfInputValue(e.target.value)} 
                  placeholder="000.000.000-00" 
                  className="w-full p-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 dark:text-white font-mono text-sm" 
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setCpfModalOpen(false)} className="px-4 py-2 bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl font-bold text-xs">Cancelar</button>
                <button type="submit" className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-xs shadow-md transition">Confirmar e Pagar Pix</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating Cart Sticky Bar */}
      {!checkoutModalOpen && cart.items.length > 0 && cart.storeId && (
        <div className="fixed bottom-3 left-3 right-3 sm:bottom-4 sm:left-4 sm:right-4 max-w-md mx-auto z-30">
          <div className="bg-purple-900/95 dark:bg-purple-950/95 text-white p-3 sm:p-3.5 rounded-2xl shadow-2xl border border-purple-700/80 flex justify-between items-center backdrop-blur-md transition-all animate-in slide-in-from-bottom-3">
            <div className="pr-2 min-w-0 flex-1">
              <p className="text-[10px] uppercase font-bold text-purple-300 tracking-wider truncate">
                🛒 {store.users?.[cart.storeId]?.name || 'Carrinho da Loja'}
              </p>
              <p className="font-bold text-xs sm:text-sm text-zinc-100 truncate">
                {cartTotalQuantity} item(ns) • Total: {formatMoney(finalCartTotal)}
              </p>
            </div>
            <button 
              onClick={() => setCheckoutModalOpen(true)}
              className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-lg transition active:scale-95 flex items-center gap-1 shrink-0"
            >
              Ver Pedido ➔
            </button>
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
          currentUserRole="cliente"
          otherParticipantName={chatModalData.otherName}
          otherParticipantPhone={chatModalData.otherPhone}
          otherParticipantRole={chatModalData.otherRole}
        />
      )}

      {/* BOTÃO FLUTUANTE DE ATENDIMENTO / SUPORTE GERAL */}
      <SupportChatButton currentUser={currentUser} />

      <footer className="text-center py-6 px-4 text-xs text-zinc-500 dark:text-zinc-400 border-t border-zinc-200 dark:border-zinc-800 mt-12 mb-8">
        <p className="font-semibold text-purple-700 dark:text-purple-400">AçaíFood © 2026 • Tecnologia, Logística e Sustentabilidade da Cadeia do Açaí.</p>
        <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1">Belém - PA • Todos os direitos reservados</p>
      </footer>
    </div>
  );
}
