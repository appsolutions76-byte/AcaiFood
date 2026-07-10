"use client";

import React, { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { Store, ShoppingCart, UserCheck } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAppStore, haversineKm } from "@/store/useAppStore";
import { MapModal } from "@/components/MapModal";
import { ThemeToggle } from "@/components/ThemeToggle";

function PaymentHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  useEffect(() => {
    const paymentStatus = searchParams.get('payment');
    if (paymentStatus === 'success') {
      alert('Pagamento aprovado pelo Mercado Pago! A loja já está preparando seu pedido.');
      window.history.replaceState(null, '', '/');
    } else if (paymentStatus === 'failure') {
      alert('Houve um problema com o pagamento.');
      window.history.replaceState(null, '', '/');
    } else if (paymentStatus === 'pending') {
      alert('Seu pagamento está em análise ou aguardando confirmação (PIX).');
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
  const [cartModal, setCartModal] = useState<{ open: boolean; lojaId: string; tipo: string }>({ open: false, lojaId: '', tipo: 'medio' });

  const getCartPrice = (lojaId: string, tipo: string) => {
    const loja = store.users[lojaId];
    if (!loja) return 0;
    if (tipo === 'popular' || tipo === 'medio' || tipo === 'grosso') {
        return loja.priceB2C![tipo as keyof typeof loja.priceB2C] || 0;
    }
    const customProd = loja.products?.find(p => p.id === tipo);
    return customProd ? customProd.price : 0;
  };

  useEffect(() => {
    store.fetchLojas();
    
    if (!currentUser) {
      router.replace('/cadastro');
    } else {
      if (currentUser.role === 'admin') router.replace('/admin');
      else if (currentUser.role === 'loja') router.replace('/parceiros/batedeira');
      else if (currentUser.role === 'fornecedor') router.replace('/parceiros/fornecedor');
      else if (currentUser.role === 'motorista' && currentUser.veiculo === 'Moto') router.replace('/parceiros/motoboy');
      else if (currentUser.role === 'motorista' && (currentUser.veiculo === 'Caminhão' || currentUser.veiculo === 'Caçamba')) router.replace('/parceiros/caminhao');
    }
  }, [currentUser, router]);

  if (!currentUser || currentUser.role !== 'cliente') {
    return <div className="min-h-screen bg-zinc-950 flex items-center justify-center"><p className="text-white">Carregando...</p></div>;
  }

  let meusPedidos = currentUser ? store.orders.filter(o => o.clienteId === currentUser.id) : [];
  const clientActiveOrders = meusPedidos.filter(o => o.status !== 'entregue' && o.status !== 'cancelado');
  const clientHistoryOrders = meusPedidos.filter(o => o.status === 'entregue' || o.status === 'cancelado').slice(0, 3);
  meusPedidos = [...clientActiveOrders, ...clientHistoryOrders];
  const batedeiras = Object.values(store.users)
    .filter(u => u.role === 'loja' && u.status !== 'paused' && u.status !== 'blocked')
    .sort((a, b) => {
      const distA = (a.lat && currentUser.lat) ? haversineKm(a.lat, a.lng!, currentUser.lat, currentUser.lng!) : 999;
      const distB = (b.lat && currentUser.lat) ? haversineKm(b.lat, b.lng!, currentUser.lat, currentUser.lng!) : 999;
      return distA - distB;
    });

  const calcFreteCliente = (lojaId: string) => {
    const loja = store.users[lojaId];
    if (!loja || !loja.lat || !currentUser?.lat) return { freteCliente: 0, dist: 0, subsidy: 0 };
    const dist = haversineKm(loja.lat, loja.lng!, currentUser.lat, currentUser.lng!);
    const freteTotal = dist * store.rates.b2c_km;
    const subsidy = loja.freteSubsidyPct || 0;
    const freteCliente = freteTotal * (1 - subsidy / 100);
    return { freteCliente, dist, subsidy };
  };

  const handleConfirmOrder = async () => {
    if (!cartModal) return;
    const checkoutUrl = await store.criarPedido('B2C', cartModal.lojaId, cartModal.tipo);
    setCartModal({ open: false, lojaId: '', tipo: 'medio' });
    if (checkoutUrl) {
      window.location.href = checkoutUrl;
    }
  };

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
                 <Link href="/login" className="bg-transparent hover:bg-purple-800 px-3 py-1.5 rounded-lg text-sm font-bold border border-purple-400 transition">
                   Entrar
                 </Link>
                 <Link href="/cadastro" className="bg-purple-600 hover:bg-purple-500 px-3 py-1.5 rounded-lg text-sm font-bold border border-purple-500 transition">
                   Criar Conta
                 </Link>
               </>
             ) : (
               <div className="flex items-center gap-3">
                 <span className="text-sm font-medium">Olá, {currentUser.name.split(' ')[0]}</span>
                 <ThemeToggle />
                 <button onClick={() => store.logout()} className="text-xs text-purple-200 hover:text-white underline">Sair</button>
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
                          <button onClick={() => setCartModal({ open: true, lojaId: loja.id, tipo: 'medio' })} className="w-full mt-auto bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-4 rounded-xl shadow-lg transition active:scale-95 flex justify-center items-center gap-2">
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
                    <div key={o.id} className={`bg-white dark:bg-zinc-900 p-5 rounded-xl shadow-sm border ${canConfirm ? 'border-green-400 shadow-green-100 dark:shadow-none' : isCanceled ? 'border-red-200 opacity-60' : 'border-zinc-200 dark:border-zinc-800'} flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4`}>
                        <div className="w-full sm:w-auto">
                            <p className="font-bold text-zinc-800 dark:text-white">{o.title} <span className="text-xs text-zinc-500">({o.id})</span></p>
                            <p className="text-xs text-zinc-500 mt-1">Total: {formatMoney(o.valor + o.taxas.entregaCliente)} (Frete: {formatMoney(o.taxas.entregaCliente)})</p>
                            {!isCanceled && (
                              <button onClick={() => setMapModal({ open: true, origem: o.origemId, destino: o.destinoId, motorista: o.motoristaId })} className="mt-2 text-[10px] font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded inline-flex items-center gap-1">🗺️ Ver Rota ({o.distancia.toFixed(1)} km)</button>
                            )}
                        </div>
                        
                        <div className="flex flex-col sm:flex-row items-center justify-end w-full sm:w-auto border-t sm:border-t-0 border-zinc-100 dark:border-zinc-800 pt-3 sm:pt-0 gap-2">
                            {o.status === 'pendente' && <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-[10px] font-bold uppercase">Aguardando Loja</span>}
                            {o.status === 'preparo' && <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-[10px] font-bold uppercase">Em Preparo</span>}
                            {o.status === 'pronto' && <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-[10px] font-bold uppercase">Aguardando Entregador</span>}
                            {o.status === 'em_rota' && <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-[10px] font-bold uppercase">Moto a caminho</span>}
                            {o.status === 'entregue' && <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-[10px] font-bold uppercase">Entregue</span>}
                            {isCanceled && <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-[10px] font-bold uppercase">Cancelado</span>}
  
                            {!isCanceled && o.status === 'pendente' && (
                              <button onClick={() => store.acaoPedido(o.id, 'cancelar_cliente')} className="text-xs bg-red-100 hover:bg-red-200 text-red-700 font-bold px-3 py-2 rounded-lg transition w-full sm:w-auto mt-2 sm:mt-0">❌ Cancelar</button>
                            )}

                            {isCanceled && (
                              <button onClick={() => { if(confirm('Deseja excluir este pedido do seu histórico?')) store.acaoPedido(o.id, 'deletar_pedido') }} className="text-xs bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold px-3 py-2 rounded-lg transition w-full sm:w-auto mt-2 sm:mt-0">🗑️ Excluir</button>
                            )}
                            
                            {o.status === 'em_rota' && (
                              <button onClick={() => store.acaoPedido(o.id, 'conf_recebedor')} className="bg-green-500 hover:bg-green-600 text-white text-sm font-bold px-5 py-2.5 rounded-xl shadow-md transition active:scale-95 w-full sm:w-auto mt-2 sm:mt-0">✅ Confirmar Recebimento</button>
                            )}
                        </div>
                    </div>
                  )
                })}
              </div>
          </div>
        )}

      </main>

      {/* Cart Modal */}
      {cartModal.open && (
        <div className="fixed inset-0 bg-black/70 z-[150] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in slide-in-from-bottom-full sm:zoom-in-95">
              <div className="bg-purple-900 text-white p-4 sm:p-5 flex justify-between items-center">
                  <h3 className="font-bold text-lg">🛒 Carrinho de Compras</h3>
                  <button onClick={() => setCartModal({ ...cartModal, open: false })} className="text-white hover:text-red-300 font-bold text-2xl leading-none">&times;</button>
              </div>
              
              <div className="p-6">
                  <p className="text-xs text-zinc-500 font-bold uppercase mb-1">Loja selecionada</p>
                  <h4 className="font-bold text-zinc-800 dark:text-white text-xl mb-4">{store.users[cartModal.lojaId]?.name}</h4>
                  
                  <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">Escolha seu Produto:</label>
                  <select 
                    value={cartModal.tipo} 
                    onChange={e => setCartModal({ ...cartModal, tipo: e.target.value })}
                    className="w-full border-2 border-purple-100 dark:border-zinc-700 rounded-xl p-3 bg-purple-50 dark:bg-zinc-800 text-purple-900 dark:text-purple-300 font-bold outline-none focus:border-purple-500 transition mb-6"
                  >
                      <optgroup label="Açaí Padrão (1L)">
                          <option value="popular">Açaí Popular</option>
                          <option value="medio">Açaí Médio</option>
                          <option value="grosso">Açaí Grosso (Especial)</option>
                      </optgroup>
                      
                      {store.users[cartModal.lojaId]?.products && store.users[cartModal.lojaId].products!.length > 0 && (
                          <optgroup label="Produtos Extras">
                              {store.users[cartModal.lojaId].products!.map(p => (
                                  <option key={p.id} value={p.id}>{p.name}</option>
                              ))}
                          </optgroup>
                      )}
                  </select>
                  
                  <div className="space-y-3 mb-6 text-sm text-zinc-600 dark:text-zinc-400">
                      <div className="flex justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2">
                          <span>Valor do Produto:</span>
                          <span className="font-bold text-zinc-800 dark:text-white">{formatMoney(getCartPrice(cartModal.lojaId, cartModal.tipo))}</span>
                      </div>
                      <div className="flex justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2">
                          <span>Frete (sua parte):</span>
                          <span className="font-bold text-zinc-800 dark:text-white">{formatMoney(calcFreteCliente(cartModal.lojaId).freteCliente)}</span>
                      </div>
                      <div className="flex justify-between pt-2 text-lg">
                          <span className="font-bold text-zinc-800 dark:text-white">Total a Pagar:</span>
                          <span className="font-bold text-purple-600 dark:text-purple-400">{formatMoney(getCartPrice(cartModal.lojaId, cartModal.tipo) + calcFreteCliente(cartModal.lojaId).freteCliente)}</span>
                      </div>
                  </div>
                  
                  <div className="flex gap-3">
                      <button onClick={() => setCartModal({ ...cartModal, open: false })} className="flex-1 px-4 py-3 bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold rounded-xl active:scale-95 transition">Cancelar</button>
                      <button onClick={handleConfirmOrder} className="flex-1 px-4 py-3 bg-purple-600 text-white font-bold rounded-xl shadow-lg hover:bg-purple-700 active:scale-95 transition">Confirmar Pedido</button>
                  </div>
              </div>
          </div>
        </div>
      )}

      <MapModal 
        isOpen={mapModal.open} 
        onClose={() => setMapModal(prev => ({ ...prev, open: false }))} 
        origemId={mapModal.origem} 
        destinoId={mapModal.destino} 
        motoristaId={mapModal.motorista} 
      />
    </div>
  );
}
