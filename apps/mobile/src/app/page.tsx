"use client";

import React, { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { Store, ShoppingCart, UserCheck } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAppStore, haversineKm } from "@/store/useAppStore";
import { MapModal } from "@/components/MapModal";
import { ThemeToggle } from "@/components/ThemeToggle";
import { supabase } from "@/lib/supabase";

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
  const formatMoney = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const currentUser = store.currentUser;
  const router = useRouter();
  
  const [mapModal, setMapModal] = useState<{ open: boolean; origem: string; destino: string; motorista?: string | null }>({ open: false, origem: '', destino: '' });
  const [productSelectModal, setProductSelectModal] = useState<{ open: boolean; lojaId: string; tipo: string; quantity: number }>({ open: false, lojaId: '', tipo: 'medio', quantity: 1 });
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [pixModalData, setPixModalData] = useState<{ open: boolean; qrCode?: string; copiaECola?: string; invoiceUrl?: string; orderId?: string }>({ open: false });
  const [cpfModalOpen, setCpfModalOpen] = useState(false);
  const [cpfInputValue, setCpfInputValue] = useState("");
  const { cart, addToCart, removeFromCart, updateCartQuantity } = store;

  const getCartPrice = (lojaId: string, tipo: string) => {
    const loja = store.users[lojaId];
    if (!loja) return 0;
    if (tipo === 'popular' || tipo === 'medio' || tipo === 'grosso') {
        return loja.priceB2C![tipo as keyof typeof loja.priceB2C] || 0;
    }
    const customProd = loja.products?.find(p => p.id === tipo);
    return customProd ? customProd.price : 0;
  };

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    store.fetchLojas();
    setMounted(true);
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
  }, [mounted, currentUser?.role, router]);

  if (!mounted) {
    return <div className="min-h-screen bg-zinc-950 flex items-center justify-center"><p className="text-white">Carregando...</p></div>;
  }

  let meusPedidos = currentUser ? store.orders.filter(o => o.clienteId === currentUser.id || o.criadoPor === currentUser.id) : [];
  const clientActiveOrders = meusPedidos.filter(o => o.status !== 'entregue' && o.status !== 'cancelado' && o.status !== 'arquivado');
  const clientHistoryOrders = meusPedidos.filter(o => o.status === 'entregue' || o.status === 'cancelado' || o.status === 'arquivado');
  meusPedidos = [...clientActiveOrders, ...clientHistoryOrders];
  const batedeiras = Object.values(store.users)
    .filter(u => u.role === 'loja' && u.status !== 'paused' && u.status !== 'blocked')
    .sort((a, b) => {
      const distA = (a.lat && currentUser?.lat) ? haversineKm(a.lat, a.lng!, currentUser!.lat, currentUser!.lng!) : 999;
      const distB = (b.lat && currentUser?.lat) ? haversineKm(b.lat, b.lng!, currentUser!.lat, currentUser!.lng!) : 999;
      return distA - distB;
    });

  const calcFreteCliente = (lojaId: string) => {
    const loja = store.users[lojaId];
    if (!loja || !loja.lat || !currentUser?.lat) return { freteCliente: 0, dist: 0, subsidy: 0 };
    const dist = haversineKm(loja.lat, loja.lng!, currentUser!.lat, currentUser!.lng!);
    const freteTotal = store.rates.courier_payment_mode === 'FIXED' 
      ? (store.rates.courier_fixed_fee ?? 8) 
      : dist * store.rates.b2c_km;
    const subsidy = loja.freteSubsidyPct || 0;
    const freteCliente = freteTotal * (1 - subsidy / 100);
    return { freteCliente, dist, subsidy };
  };

  const handleAddToCart = () => {
    if (!productSelectModal) return;
    const { lojaId, tipo, quantity } = productSelectModal;
    const loja = store.users[lojaId];
    if (!loja) return;

    let price = 0;
    let name = '';

    if (['popular', 'medio', 'grosso'].includes(tipo)) {
      price = loja.priceB2C![tipo as keyof typeof loja.priceB2C] || 0;
      name = `Açaí ${tipo.charAt(0).toUpperCase() + tipo.slice(1)}`;
    } else {
      const customProd = loja.products?.find(p => p.id === tipo);
      if (customProd) {
        price = customProd.price;
        name = customProd.name;
      }
    }

    if (price > 0) {
      addToCart(lojaId, { id: tipo, name, price, quantity });
      setProductSelectModal({ open: false, lojaId: '', tipo: 'medio', quantity: 1 });
    }
  };

  const isValidCpfCnpj = (val?: string | null) => {
    if (!val) return false;
    const digits = val.replace(/\D/g, '');
    return digits.length === 11 || digits.length === 14;
  };

  const handleConfirmOrder = async () => {
    if (!cart.storeId || cart.items.length === 0) return;

    if (!currentUser) {
      alert("Por favor, faça login ou crie sua conta para finalizar o pedido.");
      router.push('/login');
      return;
    }

    await processCheckout();
  };

  const processCheckout = async () => {
    if (!cart.storeId || cart.items.length === 0) return;
    const res: any = await store.criarPedido('B2C', cart.storeId);
    setCheckoutModalOpen(false);
    
    if (res && typeof res === 'object') {
      if (res.pixQrCode || res.pixCopiaECola || res.invoiceUrl) {
         setPixModalData({
            open: true,
            qrCode: res.pixQrCode,
            copiaECola: res.pixCopiaECola,
            invoiceUrl: res.invoiceUrl,
            orderId: res.orderId
         });
      } else if (res.error) {
         alert(`Nota do pagamento Pix: ${res.error}`);
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
    if (cleaned.length !== 11 && cleaned.length !== 14) {
      alert("CPF ou CNPJ inválido. Por favor, insira 11 dígitos para CPF ou 14 dígitos para CNPJ.");
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
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 pb-24 font-sans">
      <Suspense fallback={null}>
        <PaymentHandler />
      </Suspense>
      <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 p-4 sticky top-0 z-30">
        <div className="flex justify-between items-center max-w-5xl mx-auto">
          <div className="flex items-center gap-2 text-zinc-900 dark:text-white">
            <span className="text-2xl">🥣</span>
            <h1 className="text-xl font-bold">AçaíFood</h1>
          </div>
          <div className="flex gap-2">
             {!currentUser ? (
               <>
                 <button onClick={() => { if(navigator.share) { navigator.share({title: 'AçaíFood', text: 'Conheça o AçaíFood!', url: window.location.origin}) } else { alert('Seu navegador não suporta compartilhamento.') } }} className="bg-purple-100 hover:bg-purple-200 text-purple-700 px-3 py-1.5 rounded-lg text-sm font-bold border border-purple-200 transition">
                   📲 Compartilhar
                 </button>
                 <Link href="/login" className="bg-transparent hover:bg-purple-800 px-3 py-1.5 rounded-lg text-sm font-bold border border-purple-400 transition">
                   Entrar
                 </Link>
                 <Link href="/cadastro" className="bg-purple-600 hover:bg-purple-500 px-3 py-1.5 rounded-lg text-sm font-bold border border-purple-500 transition">
                   Criar Conta
                 </Link>
               </>
             ) : (
               <div className="flex items-center gap-3">
                 <span className="text-sm font-medium hidden sm:inline-block">Olá, {currentUser.name.split(' ')[0]}</span>
                 <button onClick={() => window.location.reload()} className="text-xs bg-indigo-100 hover:bg-indigo-200 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 shadow-sm transition-all">🔄 Atualizar</button>
                 <button onClick={() => { if(navigator.share) { navigator.share({title: 'AçaíFood', text: 'Conheça o AçaíFood!', url: window.location.origin}) } else { alert('Seu navegador não suporta compartilhamento.') } }} className="text-[10px] bg-purple-100 hover:bg-purple-200 text-purple-700 px-2 py-1 rounded font-bold">📲 Compartilhar</button>
                 <ThemeToggle />
                 <button onClick={() => store.logout()} className="text-xs text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300 underline">Sair</button>
               </div>
             )}
          </div>
        </div>
      </header>

      <main className="p-4 sm:p-6 max-w-3xl mx-auto space-y-8">
        
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 text-center">
            <h2 className="text-2xl font-bold text-zinc-800 dark:text-white mb-2">Bem-vindo(a) ao AçaíFood!</h2>
            <p className="text-zinc-500 dark:text-zinc-400">O açaí perfeito pra você. O frete é calculado por GPS de acordo com a sua distância da loja.</p>
        </div>

        {!currentUser ? (
          <div className="flex justify-center items-center mt-12 mb-12">
             <img src="/banner.png" alt="AçaíFood Pará" className="w-full max-w-lg rounded-3xl shadow-2xl object-cover border-4 border-white dark:border-zinc-800" />
          </div>
        ) : (
          <>

            <div>
                <h3 className="font-bold text-lg text-zinc-700 dark:text-zinc-200 mb-4 border-b border-zinc-200 dark:border-zinc-800 pb-2">Batedeiras Próximas</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {batedeiras.map(loja => {
                    const { freteCliente, dist, subsidy } = calcFreteCliente(loja.id);
                    return (
                      <div key={loja.id} className="bg-white dark:bg-zinc-900 p-4 rounded-xl shadow-sm border border-purple-100 dark:border-purple-900/30 flex flex-col transition hover:shadow-md">
                          <div className="flex justify-between items-center mb-3">
                              <div className="flex items-center gap-2">
                                  <span className="text-3xl">{loja.icon}</span>
                                  <div>
                                      <p className="font-bold text-zinc-800 dark:text-white leading-tight">{loja.name}</p>
                                      <p className="text-[10px] text-zinc-500">{loja.bairro}</p>
                                  </div>
                              </div>
                              {currentUser && <button onClick={() => setMapModal({ open: true, origem: loja.id, destino: currentUser.id })} className="text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded">🗺️ {dist.toFixed(1)} km</button>}
                          </div>
                          
                          <div className="bg-zinc-50 dark:bg-zinc-950 p-3 rounded flex flex-col gap-1 text-sm mb-4 border border-zinc-100 dark:border-zinc-800">
                              <span className="text-zinc-500 text-[10px] uppercase font-bold">A partir de {formatMoney(loja.priceB2C?.popular || 0)}</span>
                              <span className="text-zinc-600 dark:text-zinc-400 text-xs flex justify-between">
                                <span>Frete Estimado:</span>
                                {subsidy > 0 && <span className="text-[9px] bg-orange-100 text-orange-700 px-1 rounded uppercase font-bold">Loja paga {subsidy}%</span>}
                              </span>
                              <span className="font-bold text-zinc-800 dark:text-zinc-200">{formatMoney(freteCliente)}</span>
                          </div>
                          
                          {currentUser ? (
                              <button onClick={() => setProductSelectModal({ open: true, lojaId: loja.id, tipo: 'medio', quantity: 1 })} className="w-full mt-auto bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-4 rounded-xl shadow-lg transition active:scale-95 flex justify-center items-center gap-2">
                                  <ShoppingCart size={18} /> Pedir Agora
                              </button>
                          ) : (
                              <Link href="/login" className="w-full mt-auto bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold py-3 px-4 rounded-xl shadow-sm transition active:scale-95 flex justify-center items-center gap-2">
                                  Fazer Login para Pedir
                              </Link>
                          )}
                      </div>
                    );
                  })}
                </div>
            </div>
          </>
        )}

        {currentUser && (
          <div>
              <h3 className="font-bold text-lg text-zinc-700 dark:text-zinc-200 mb-4 border-b border-zinc-200 dark:border-zinc-800 pb-2">Meus Pedidos em Andamento</h3>
              <div className="space-y-4">
                {meusPedidos.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-8 bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-dashed border-zinc-300 dark:border-zinc-700 text-center opacity-70">
                      <span className="text-4xl mb-3">🛒</span>
                      <p className="text-zinc-500 font-medium">Você ainda não fez nenhum pedido hoje.</p>
                  </div>
                ) : meusPedidos.map(o => {
                  const isCanceled = o.status === 'cancelado';
                  
                  return (
                    <div key={o.id} className={`bg-white dark:bg-zinc-900 p-5 rounded-xl shadow-sm border ${o.status === 'aguardando_cliente' ? 'border-green-400 shadow-green-100 dark:shadow-none' : isCanceled ? 'border-red-200 opacity-60' : 'border-zinc-200 dark:border-zinc-800'} flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4`}>
                        <div className="w-full sm:w-auto">
                            <p className="font-bold text-zinc-800 dark:text-white">{o.title} <span className="text-xs text-zinc-500">({o.id})</span></p>
                            <p className="text-[10px] text-zinc-600 dark:text-zinc-400 mt-1 uppercase font-bold">Motorista: {o.motoristaNome || 'Aguardando'}</p>
                            <p className="text-xs text-zinc-500 mt-1">Total: {formatMoney(o.valor + o.taxas.entregaCliente)} (Frete: {formatMoney(o.taxas.entregaCliente)})</p>
                            <div className="flex flex-wrap gap-2 mt-2 mb-2">
                               {o.createdAt && <span className="text-[9px] bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded font-bold">🕒 Pedido: {new Date(o.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>}
                               {o.acceptedAt && <span className="text-[9px] bg-purple-50 text-purple-600 px-2 py-0.5 rounded font-bold">👨‍🍳 Aceito: {new Date(o.acceptedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>}
                               {o.readyAt && <span className="text-[9px] bg-orange-50 text-orange-600 px-2 py-0.5 rounded font-bold">🛎️ Pronto: {new Date(o.readyAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>}
                               {o.pickedUpAt && <span className="text-[9px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded font-bold">📦 Retirada: {new Date(o.pickedUpAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>}
                               {o.deliveredAt && <span className="text-[9px] bg-teal-50 text-teal-600 px-2 py-0.5 rounded font-bold">📍 Chegou: {new Date(o.deliveredAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>}
                               {o.receivedAt && <span className="text-[9px] bg-green-50 text-green-600 px-2 py-0.5 rounded font-bold">✅ Recebido: {new Date(o.receivedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>}
                            </div>
                            
                            {o.deliveryPin && !isCanceled && o.status !== 'entregue' && o.status !== 'arquivado' && (
                               <div className="mt-3 bg-zinc-900 dark:bg-zinc-800 text-white p-3 rounded-lg flex items-center justify-between shadow-md border border-zinc-700">
                                   <div>
                                       <p className="text-[10px] font-bold uppercase text-zinc-400">PIN de Entrega</p>
                                       <p className="text-xs text-zinc-300 leading-tight">Informe ao motorista</p>
                                   </div>
                                   <div className="text-2xl font-black tracking-widest text-emerald-400">{o.deliveryPin}</div>
                               </div>
                            )}
                            {!isCanceled && (
                              <button onClick={() => setMapModal({ open: true, origem: o.origemId, destino: o.destinoId, motorista: o.motoristaId })} className="mt-2 text-[10px] font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded inline-flex items-center gap-1">🗺️ Ver Rota ({o.distancia.toFixed(1)} km)</button>
                            )}
                        </div>
                        
                        <div className="flex flex-col sm:flex-row items-center justify-end w-full sm:w-auto border-t sm:border-t-0 border-zinc-100 dark:border-zinc-800 pt-3 sm:pt-0 gap-2">
                            {o.status === 'pendente' && <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-[10px] font-bold uppercase">Aguardando Loja</span>}
                            {o.status === 'preparo' && <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-[10px] font-bold uppercase">Em Preparo</span>}
                            {o.status === 'pronto' && <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-[10px] font-bold uppercase">Aguardando Entregador</span>}
                            {o.status === 'em_rota' && <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-[10px] font-bold uppercase">Moto a caminho</span>}
                            {o.status === 'aguardando_cliente' && <span className="bg-teal-100 text-teal-800 px-2 py-1 rounded text-[10px] font-bold uppercase">Chegou!</span>}
                            {(o.status === 'entregue' || o.status === 'arquivado') && <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-[10px] font-bold uppercase">Entregue</span>}
                            {isCanceled && <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-[10px] font-bold uppercase">Cancelado</span>}
  
                            {!isCanceled && o.status === 'pendente' && (
                              <button onClick={() => store.acaoPedido(o.id, 'cancelar_cliente')} className="text-xs bg-red-100 hover:bg-red-200 text-red-700 font-bold px-3 py-2 rounded-lg transition w-full sm:w-auto mt-2 sm:mt-0">❌ Cancelar</button>
                            )}

                            {isCanceled && (
                              <button onClick={() => { if(confirm('Deseja excluir este pedido do seu histórico?')) store.acaoPedido(o.id, 'deletar_pedido') }} className="text-xs bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold px-3 py-2 rounded-lg transition w-full sm:w-auto mt-2 sm:mt-0">🗑️ Excluir</button>
                            )}
                        </div>
                    </div>
                  )
                })}
              </div>
          </div>
        )}

      </main>

      <footer className="mt-8 py-8 border-t border-zinc-200 dark:border-zinc-800 text-center flex flex-col items-center justify-center space-y-3">
        <img src="/appsolutions76-logo.png" alt="AppSolutions76" className="w-full max-w-xs object-contain" />
        <div className="text-[11px] text-zinc-500 dark:text-zinc-400 space-y-1">
           <p className="font-bold text-zinc-700 dark:text-zinc-300">Desenvolvido por AppSolutions76</p>
           <p>EMPRESA PARAENSE | Belém - PA</p>
           <p>Contato: <a href="mailto:appsolutions76@gmail.com" className="text-purple-600 hover:underline">appsolutions76@gmail.com</a></p>
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
                  <h4 className="font-bold text-zinc-800 dark:text-white text-xl mb-4">{store.users[productSelectModal.lojaId]?.name}</h4>
                  
                  <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">Escolha seu Produto:</label>
                  <select 
                    value={productSelectModal.tipo} 
                    onChange={e => setProductSelectModal({ ...productSelectModal, tipo: e.target.value })}
                    className="w-full border-2 border-purple-100 dark:border-zinc-700 rounded-xl p-3 bg-purple-50 dark:bg-zinc-800 text-purple-900 dark:text-purple-300 font-bold outline-none focus:border-purple-500 transition mb-4"
                  >
                      <optgroup label="Açaí Padrão (1L)">
                          <option value="popular">Açaí Popular</option>
                          <option value="medio">Açaí Médio</option>
                          <option value="grosso">Açaí Grosso (Especial)</option>
                      </optgroup>
                      
                      {store.users[productSelectModal.lojaId]?.products && store.users[productSelectModal.lojaId].products!.length > 0 && (
                          <optgroup label="Produtos Extras">
                              {store.users[productSelectModal.lojaId].products!.map(p => (
                                  <option key={p.id} value={p.id}>{p.name}</option>
                              ))}
                          </optgroup>
                      )}
                  </select>

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
                  <h4 className="font-bold text-zinc-800 dark:text-white text-xl mb-4">{store.users[cart.storeId]?.name}</h4>
                  
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
                  
                  <div className="space-y-3 mb-6 text-sm text-zinc-600 dark:text-zinc-400">
                      <div className="flex justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2">
                          <span>Subtotal ({cartTotalQuantity} itens):</span>
                          <span className="font-bold text-zinc-800 dark:text-white">{formatMoney(cartItemsTotal)}</span>
                      </div>
                      <div className="flex justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2">
                          <span>Frete ({store.rates.courier_payment_mode === 'FIXED' ? 'Valor Fixo' : 'Estimativa por KM'}):</span>
                          <span className="font-bold text-zinc-800 dark:text-white">{formatMoney(cartFrete)}</span>
                      </div>
                      <div className="flex justify-between pt-2 text-lg">
                          <span className="font-bold text-zinc-800 dark:text-white">Total a Pagar:</span>
                          <span className="font-bold text-purple-600 dark:text-purple-400">{formatMoney(finalCartTotal)}</span>
                      </div>
                  </div>
                  
                  <div className="flex gap-3 mt-4">
                      <button onClick={() => setCheckoutModalOpen(false)} className="flex-1 px-4 py-3 bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold rounded-xl active:scale-95 transition">Continuar Comprando</button>
                      <button onClick={handleConfirmOrder} className="flex-1 px-4 py-3 bg-purple-600 text-white font-bold rounded-xl shadow-lg hover:bg-purple-700 active:scale-95 transition flex items-center justify-center gap-2">
                          <span className="text-lg">🛒</span> Pagar via Pix
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
                          <p className="font-bold text-sm truncate max-w-[150px]">{store.users[cart.storeId]?.name}</p>
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
        origemId={mapModal.origem} 
        destinoId={mapModal.destino} 
        motoristaId={mapModal.motorista} 
      />

      {pixModalData.open && (
        <div className="fixed inset-0 bg-black/75 z-[200] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center animate-in zoom-in-95">
            <div className="bg-purple-100 dark:bg-purple-900/40 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-2xl">⚡</span>
            </div>
            <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-1">Pagamento via Pix</h3>
            <p className="text-xs text-zinc-500 mb-4">Escaneie o QR Code ou copie o código para pagar</p>
            
            {(() => {
              const qrSrc = pixModalData.qrCode
                ? (pixModalData.qrCode.startsWith('data:') || pixModalData.qrCode.startsWith('http')
                    ? pixModalData.qrCode
                    : `data:image/png;base64,${pixModalData.qrCode}`)
                : (pixModalData.copiaECola
                    ? `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(pixModalData.copiaECola)}`
                    : null);

              if (!qrSrc) return null;
              return (
                <div className="bg-white p-3 rounded-xl border border-zinc-200 inline-block mb-4 shadow-inner">
                  <img src={qrSrc} alt="Pix QR Code" className="w-48 h-48 mx-auto object-contain" />
                </div>
              );
            })()}

            {pixModalData.copiaECola ? (
              <div className="mb-4">
                <input 
                  type="text" 
                  readOnly 
                  value={pixModalData.copiaECola} 
                  className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg p-2.5 text-xs text-zinc-600 dark:text-zinc-300 font-mono mb-2 text-center"
                />
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(pixModalData.copiaECola!);
                    alert('Código Pix "Copia e Cola" copiado com sucesso!');
                  }}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2.5 rounded-xl text-sm transition shadow-md flex items-center justify-center gap-2"
                >
                  📋 Copiar Código Pix
                </button>
              </div>
            ) : null}

            {pixModalData.invoiceUrl ? (
              <a 
                href={pixModalData.invoiceUrl} 
                target="_blank" 
                rel="noreferrer"
                className="block w-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-bold py-2 rounded-xl text-xs transition mb-3"
              >
                🔗 Abrir Fatura no Asaas
              </a>
            ) : null}

            <button 
              onClick={async () => {
                if (pixModalData.orderId) {
                   await store.acaoPedido(pixModalData.orderId, 'confirmar_pagamento');
                   setPixModalData({ open: false });
                   alert('✅ Pagamento Pix confirmado com sucesso! O pedido foi liberado para a loja iniciar o preparo.');
                } else {
                   setPixModalData({ open: false });
                }
              }} 
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-xs transition mb-2 shadow-md flex items-center justify-center gap-2"
            >
              ✅ Já Paguei / Confirmar Pagamento
            </button>

            <button 
              onClick={() => setPixModalData({ open: false })} 
              className="w-full bg-zinc-800 hover:bg-black text-white font-bold py-2.5 rounded-xl text-xs transition"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

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
    </div>
  );
}
