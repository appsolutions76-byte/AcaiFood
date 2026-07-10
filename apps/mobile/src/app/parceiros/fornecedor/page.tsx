"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, PackageOpen } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { MapModal } from "@/components/MapModal";
import { supabase } from "@/lib/supabase";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function FornecedorDashboard() {
  const router = useRouter();
  const store = useAppStore();
  const currentUser = store.currentUser;
  
  const [mapModal, setMapModal] = useState<{ open: boolean; origem: string; destino: string; motorista?: string | null }>({ open: false, origem: '', destino: '' });

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const [subsidyInput, setSubsidyInput] = useState(currentUser?.freteSubsidyPct?.toString() || "0");
  const [priceModalOpen, setPriceModalOpen] = useState(false);
  const [b2bPrice, setB2bPrice] = useState(currentUser?.priceB2B || 140);
  const [activeTab, setActiveTab] = useState('geral');

  useEffect(() => {
    if (currentUser) {
      if (currentUser.priceB2B !== undefined) setB2bPrice(currentUser.priceB2B);
      if (currentUser.freteSubsidyPct !== undefined) setSubsidyInput(currentUser.freteSubsidyPct.toString());
    }
  }, [currentUser?.priceB2B, currentUser?.freteSubsidyPct]);

  const [newProductName, setNewProductName] = useState('');
  const [newProductPrice, setNewProductPrice] = useState('');

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
          id: `prod_${Date.now()}`,
          name: newProductName,
          price: Number(newProductPrice)
      });
      setNewProductName('');
      setNewProductPrice('');
  };

  const handleLinkMercadoPago = async () => {
    if (!currentUser) return;
    try {
      const { data, error } = await supabase
        .from('mp_oauth_states')
        .insert({ user_id: currentUser.id })
        .select('state_id')
        .single();
        
      if (error || !data) {
        alert("Erro de segurança ao iniciar vínculo. Tente novamente.");
        return;
      }
      
      const clientId = (process.env.NEXT_PUBLIC_MP_CLIENT_ID || "7957691912013698").trim();
      const baseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim().replace(/\/$/, '');
      const redirectUri = encodeURIComponent(`${baseUrl}/functions/v1/mp-oauth`);
      const authUrl = `https://auth.mercadopago.com/authorization?client_id=${clientId}&response_type=code&platform_id=mp&state=${data.state_id}&redirect_uri=${redirectUri}`;
      window.location.href = authUrl;
    } catch (err) {
      console.error(err);
      alert("Erro ao conectar com servidor.");
    }
  };

  if (!mounted) {
    return <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 flex items-center justify-center p-6"><p>Carregando...</p></div>;
  }

  if (!currentUser || currentUser.role !== 'fornecedor') {
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

  const formatMoney = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const meusPedidosAll = store.orders.filter(o => o.fornecedorId === currentUser.id);
  const vendasHoje = meusPedidosAll.filter(o => o.status === 'entregue').reduce((acc, curr) => acc + curr.taxas.repasse, 0);

  const fornActiveOrders = meusPedidosAll.filter(o => o.status !== 'entregue' && o.status !== 'cancelado');
  const fornHistoryOrders = meusPedidosAll.filter(o => o.status === 'entregue' || o.status === 'cancelado').slice(0, 3);
  const meusPedidos = [...fornActiveOrders, ...fornHistoryOrders];

  const handleSaveSubsidy = () => {
    store.setFreteSubsidy(currentUser.id, parseFloat(subsidyInput) || 0);
    alert('Subsídio salvo com sucesso!');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 pb-24">
      <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 p-4 sticky top-0 z-30">
        <div className="flex justify-between items-center max-w-5xl mx-auto">
          <div className="flex items-center gap-3">
            <PackageOpen className="text-emerald-600" />
            <h1 className="text-xl font-bold text-zinc-900 dark:text-white">Painel do Fornecedor (B2B)</h1>
          </div>
          <div className="flex items-center gap-3">
            {currentUser.mercadoPagoToken && (
               <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-1 rounded font-bold border border-blue-200">MP Ativo ✅</span>
            )}
            <ThemeToggle />
            <button onClick={() => { store.logout(); router.push('/login'); }} className="text-sm font-bold text-red-600 hover:text-red-800 underline">Sair</button>
          </div>
        </div>
      </header>
      
      <div className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 mb-6">
        <div className="max-w-5xl mx-auto px-4 flex gap-6 overflow-x-auto">
          <button onClick={() => setActiveTab('geral')} className={`py-4 px-2 font-bold text-sm border-b-2 transition whitespace-nowrap ${activeTab === 'geral' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-zinc-500 hover:text-zinc-800'}`}>📊 Visão Geral</button>
          <button onClick={() => setActiveTab('produtos')} className={`py-4 px-2 font-bold text-sm border-b-2 transition whitespace-nowrap ${activeTab === 'produtos' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-zinc-500 hover:text-zinc-800'}`}>➕ Produtos Extras</button>
          <button onClick={() => setActiveTab('pedidos')} className={`py-4 px-2 font-bold text-sm border-b-2 transition whitespace-nowrap ${activeTab === 'pedidos' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-zinc-500 hover:text-zinc-800'}`}>🚚 Gestão de Pedidos</button>
        </div>
      </div>

      <main className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
        
        {!currentUser.mpLinked && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-6 text-center shadow-sm">
            <h3 className="text-red-700 dark:text-red-400 font-bold text-lg mb-2">Atenção: Vendas Bloqueadas!</h3>
            <p className="text-red-600 dark:text-red-300 text-sm mb-4">
              Para receber os pagamentos das lojas automaticamente via PIX ou Cartão, você precisa vincular sua conta do Mercado Pago.
            </p>
            <button 
              onClick={handleLinkMercadoPago}
              className="inline-block bg-[#009EE3] text-white font-bold py-3 px-6 rounded-xl shadow-md hover:bg-[#008ACB] transition"
            >
              🤝 Vincular Conta Mercado Pago
            </button>
          </div>
        )}

        {activeTab === 'geral' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in zoom-in-95 duration-300">
          {/* Resumo */}
          <div className="bg-emerald-900 text-white p-5 rounded-xl shadow">
              <h2 className="text-xl font-bold">{currentUser.name}</h2>
              <p className="text-emerald-300 text-xs mt-1">📍 {currentUser.bairro}</p>
              <div className="mt-4 pt-4 border-t border-emerald-700">
                  <p className="text-sm text-emerald-200">Saldo Líquido (Sessão)</p>
                  <p className="text-2xl font-bold text-green-400">{formatMoney(vendasHoje)}</p>
              </div>
          </div>

          {/* Controles */}
          <div className="col-span-1 md:col-span-2 bg-white dark:bg-zinc-900 p-5 rounded-xl shadow border border-zinc-200 dark:border-zinc-800 flex flex-col justify-center gap-3">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-3 border-b border-zinc-100 dark:border-zinc-800">
                  <div>
                      <h3 className="font-bold text-zinc-700 dark:text-zinc-200 text-sm uppercase">🏭 Status e Lata Açaí</h3>
                      <p className="text-[10px] text-zinc-500">Controle se sua usina está recebendo pedidos e edite seu preço.</p>
                  </div>
                  <div className="flex items-center gap-3 mt-2 sm:mt-0">
                      <button onClick={handleToggleStatus} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition shadow-sm border ${isPaused ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100' : 'bg-green-50 text-green-600 border-green-200 hover:bg-green-100'}`}>
                          {isPaused ? 'Pausado 🚫' : 'Operando ✅'}
                      </button>
                      <div className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700">
                          <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400">Lata Açaí:</span>
                          <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">{formatMoney(b2bPrice)}</span>
                      </div>
                      <button onClick={() => setPriceModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded-lg text-xs font-bold transition shadow-sm">Editar Preço</button>
                  </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div>
                      <h3 className="font-bold text-zinc-700 dark:text-zinc-200 text-sm uppercase">🚚 Participação no Frete (%)</h3>
                      <p className="text-[10px] text-zinc-500">Defina a porcentagem do frete que você quer pagar para atrair as batedeiras.</p>
                  </div>
                  <div className="flex items-center gap-2 mt-2 sm:mt-0">
                      <label className="text-xs font-bold text-zinc-600 dark:text-zinc-400">Você Paga:</label>
                      <input type="number" min="0" max="100" value={subsidyInput} onChange={e => setSubsidyInput(e.target.value)} className="w-16 border border-zinc-300 dark:border-zinc-700 bg-transparent rounded p-1.5 text-center font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
                      <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400">%</span>
                      <button onClick={handleSaveSubsidy} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded-lg text-xs font-bold transition shadow-sm ml-1">Salvar</button>
                  </div>
              </div>
          </div>
        </div>
        )}
          
        {activeTab === 'produtos' && (
        <div className="grid grid-cols-1 gap-4 animate-in fade-in zoom-in-95 duration-300">
          {/* Cadastro de Produtos Extras */}
          <div className="bg-white dark:bg-zinc-900 p-5 rounded-xl shadow border border-zinc-200 dark:border-zinc-800 flex flex-col gap-4">
              <div className="border-b border-zinc-100 dark:border-zinc-800 pb-2">
                  <h3 className="font-bold text-zinc-700 dark:text-zinc-200 text-sm uppercase">📦 Produtos Extras</h3>
                  <p className="text-[10px] text-zinc-500">Cadastre outros itens B2B para os compradores.</p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                  <input type="text" placeholder="Nome do Produto" value={newProductName} onChange={e => setNewProductName(e.target.value)} className="flex-1 border border-zinc-300 dark:border-zinc-700 bg-transparent rounded-lg p-2 text-sm outline-none focus:border-emerald-500" />
                  <input type="number" step="0.1" placeholder="Preço (R$)" value={newProductPrice} onChange={e => setNewProductPrice(e.target.value)} className="w-full sm:w-32 border border-zinc-300 dark:border-zinc-700 bg-transparent rounded-lg p-2 text-sm outline-none focus:border-emerald-500" />
                  <button onClick={handleAddProduct} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-lg text-sm transition shrink-0">Adicionar</button>
              </div>

              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800 mt-2">
                  {currentUser?.products?.map(p => (
                      <li key={p.id} className="flex justify-between items-center py-2">
                          <div>
                              <p className="font-bold text-zinc-800 dark:text-zinc-200 text-sm">{p.name}</p>
                              <p className="text-emerald-600 text-xs font-bold">R$ {p.price.toFixed(2)}</p>
                          </div>
                          <button onClick={() => store.removeProduct(currentUser.id, p.id)} className="text-red-500 hover:text-red-700 p-2 bg-red-50 rounded-lg transition">🗑️</button>
                      </li>
                  ))}
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
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-700">{o.type}</span>
                        <span className="font-bold text-zinc-800 dark:text-white text-sm">Pedido #{o.id} - Loja: {store.users[o.lojaId!]?.name || '—'}</span>
                        <button onClick={() => setMapModal({ open: true, origem: o.origemId, destino: o.destinoId })} className="text-[10px] text-blue-500 hover:underline">🗺️ Ver Rota de {o.distancia.toFixed(1)} km</button>
                    </div>
                    <p className="text-xs text-zinc-500 mt-1">
                        Bruto: {formatMoney(o.valor)} |
                        Sub. Frete: {formatMoney(o.taxas.entregaFornecedor || 0)} |
                        Líquido: {formatMoney(o.taxas.repasse)}
                    </p>
                </div>
                
                <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-end w-full sm:w-auto border-t sm:border-t-0 border-zinc-100 dark:border-zinc-800 pt-3 sm:pt-0 gap-2">
                    {/* Status Badges */}
                    {o.status === 'pendente' && <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-[10px] font-bold uppercase">Aguardando Você</span>}
                    {o.status === 'preparo' && <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-[10px] font-bold uppercase">Em Separação</span>}
                    {o.status === 'pronto' && <span className="bg-amber-100 text-amber-800 px-2 py-1 rounded text-[10px] font-bold uppercase">Aguardando Caminhão</span>}
                    {o.status === 'em_rota' && <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-[10px] font-bold uppercase">Em Transporte</span>}
                    {o.status === 'aguardando_cliente' && <span className="bg-teal-100 text-teal-800 px-2 py-1 rounded text-[10px] font-bold uppercase">Aguardando Loja Confirmar</span>}
                    {o.status === 'entregue' && <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-[10px] font-bold uppercase">Concluído</span>}
                    {o.status === 'cancelado' && <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-[10px] font-bold uppercase">Cancelado</span>}
                    
                    {isCanceled && (
                      <button onClick={() => { if(confirm('Deseja excluir este pedido permanentemente?')) store.acaoPedido(o.id, 'deletar_pedido') }} className="text-xs bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold px-3 py-2 rounded-lg transition mt-2 sm:mt-0">🗑️ Excluir</button>
                    )}

                    {/* Interações */}
                    {!isCanceled && o.status === 'pendente' && (
                      <div className="flex gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                          <button onClick={() => store.acaoPedido(o.id, 'cancelar_pedido')} className="flex-1 sm:flex-none bg-red-100 hover:bg-red-200 text-red-700 text-xs font-bold px-3 py-2 rounded-lg transition">❌ Recusar</button>
                          <button onClick={() => store.acaoPedido(o.id, 'aceitar_forn')} className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-lg shadow">Aceitar e Separar</button>
                      </div>
                    )}
                    
                    {!isCanceled && o.status === 'preparo' && (
                      <button onClick={() => store.acaoPedido(o.id, 'chamar_moto')} className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-4 py-2 rounded-lg shadow w-full sm:w-auto mt-2 sm:mt-0 transition">🚛 Chamar Caminhão</button>
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
        origemId={mapModal.origem} 
        destinoId={mapModal.destino} 
        motoristaId={mapModal.motorista} 
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
    </div>
  );
}
