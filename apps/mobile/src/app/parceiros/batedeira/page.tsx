"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Store } from "lucide-react";
import { useAppStore, haversineKm } from "@/store/useAppStore";
import { MapModal } from "@/components/MapModal";
import { ThemeToggle } from "@/components/ThemeToggle";
import { supabase } from "@/lib/supabase";

export default function BatedeiraDashboard() {
  const store = useAppStore();
  const currentUser = store.currentUser;
  
  const [mapModal, setMapModal] = useState<{ open: boolean; origem: string; destino: string; motorista?: string | null }>({ open: false, origem: '', destino: '' });
  const [subsidyInput, setSubsidyInput] = useState(currentUser?.freteSubsidyPct?.toString() || "0");
  const [priceModalOpen, setPriceModalOpen] = useState(false);
  const [prices, setPrices] = useState(currentUser?.priceB2C || { popular: 18, medio: 25, grosso: 33 });
  const [activeTab, setActiveTab] = useState('pedidos');

  useEffect(() => {
    if (currentUser) {
      if (currentUser.priceB2C) setPrices(currentUser.priceB2C);
      if (currentUser.freteSubsidyPct !== undefined) setSubsidyInput(currentUser.freteSubsidyPct.toString());
    }
  }, [currentUser?.priceB2C, currentUser?.freteSubsidyPct]);

  const [newProductName, setNewProductName] = useState('');
  const [newProductPrice, setNewProductPrice] = useState('');
  const [cartModalB2B, setCartModalB2B] = useState<{ open: boolean; fornId: string; quantity: number }>({ open: false, fornId: '', quantity: 1 });

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    store.fetchAllUsers();
    store.startRealtime();
    setMounted(true);
  }, []);

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
          id: `prod_${Date.now()}`,
          name: newProductName,
          price: Number(newProductPrice)
      });
      setNewProductName('');
      setNewProductPrice('');
  };

  const router = useRouter();

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
    return <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 flex items-center justify-center"><p>Carregando...</p></div>;
  }

  if (!currentUser || currentUser.role !== 'loja') {
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

  const formatMoney = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const meusPedidosAll = store.orders.filter(o => o.lojaId === currentUser.id);
  const vendasHoje = meusPedidosAll.filter(o => (o.status === 'entregue' || o.status === 'arquivado') && o.type === 'B2C').reduce((acc, curr) => acc + curr.taxas.repasse, 0);
  
  const batedeiraActiveOrders = meusPedidosAll.filter(o => o.status !== 'entregue' && o.status !== 'cancelado' && o.status !== 'arquivado');
  const batedeiraHistoryOrders = meusPedidosAll.filter(o => o.status === 'entregue' || o.status === 'cancelado' || o.status === 'arquivado');
  const meusPedidos = [...batedeiraActiveOrders, ...batedeiraHistoryOrders];
  const fornecedores = Object.values(store.users)
    .filter(u => u.role === 'fornecedor' && u.status !== 'paused' && u.status !== 'blocked' && u.cidade === currentUser.cidade)
    .sort((a, b) => {
      const distA = (a.lat && currentUser.lat) ? haversineKm(a.lat, a.lng!, currentUser.lat, currentUser.lng!) : 999;
      const distB = (b.lat && currentUser.lat) ? haversineKm(b.lat, b.lng!, currentUser.lat, currentUser.lng!) : 999;
      return distA - distB;
    });
  
  const distColeta = (currentUser.lat && store.users.ecoponto?.lat) ? haversineKm(currentUser.lat, currentUser.lng!, store.users.ecoponto.lat, store.users.ecoponto.lng!) : 0;
  const freteColeta = distColeta * store.rates.col_km;

  const handleSaveSubsidy = () => {
    store.setFreteSubsidy(currentUser.id, parseFloat(subsidyInput) || 0);
    alert('Subsídio salvo com sucesso!');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 pb-24">
      <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 p-4 sticky top-0 z-30">
        <div className="flex justify-between items-center max-w-5xl mx-auto">
          <div className="flex items-center gap-3">
            <Store className="text-purple-600" />
            <h1 className="text-xl font-bold text-zinc-900 dark:text-white">Painel da Loja</h1>
          </div>
          <div className="flex items-center gap-3">
            {currentUser.mpLinked && (
               <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-1 rounded font-bold border border-blue-200 hidden sm:inline-block">MP Ativo ✅</span>
            )}
            <button onClick={() => window.location.reload()} className="text-xs bg-indigo-100 hover:bg-indigo-200 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 shadow-sm transition-all">🔄 Atualizar</button>
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

        {!currentUser.mpLinked && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-6 text-center shadow-sm">
            <h3 className="text-red-700 dark:text-red-400 font-bold text-lg mb-2">Atenção: Vendas Bloqueadas!</h3>
            <p className="text-red-600 dark:text-red-300 text-sm mb-4">
              Para receber os pagamentos dos clientes automaticamente via PIX ou Cartão, você precisa vincular sua conta do Mercado Pago.
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
          <div className="bg-purple-900 text-white p-5 rounded-xl shadow">
              <h2 className="text-xl font-bold">{currentUser.name}</h2>
              <p className="text-purple-300 text-xs mt-1">📍 {currentUser.bairro}</p>
              <div className="mt-4 pt-4 border-t border-purple-700">
                  <p className="text-sm text-purple-200">Saldo Líquido (Sessão)</p>
                  <p className="text-2xl font-bold text-green-400">{formatMoney(vendasHoje)}</p>
              </div>
          </div>

          {/* Controles da Loja */}
          <div className="col-span-1 md:col-span-2 bg-white dark:bg-zinc-900 p-5 rounded-xl shadow border border-zinc-200 dark:border-zinc-800 flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-3 border-b border-zinc-100 dark:border-zinc-800">
                  <div>
                      <h3 className="font-bold text-zinc-700 dark:text-zinc-200 text-sm uppercase">🏪 Status e Produtos</h3>
                      <p className="text-[10px] text-zinc-500">Controle se a loja está aberta e edite seus preços.</p>
                  </div>
                  <div className="flex items-center gap-2 mt-2 sm:mt-0">
                      <button onClick={handleToggleStatus} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition shadow-sm border ${isPaused ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100' : 'bg-green-50 text-green-600 border-green-200 hover:bg-green-100'}`}>
                          {isPaused ? 'Loja Fechada 🚫' : 'Loja Aberta ✅'}
                      </button>
                      <button onClick={() => setPriceModalOpen(true)} className="bg-purple-100 hover:bg-purple-200 text-purple-700 px-4 py-1.5 rounded-lg text-xs font-bold transition shadow-sm border border-purple-200">Editar Preços</button>
                  </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-3 border-b border-zinc-100 dark:border-zinc-800">
                  <div>
                      <h3 className="font-bold text-zinc-700 dark:text-zinc-200 text-sm uppercase">🚚 Participação no Frete (%)</h3>
                      <p className="text-[10px] text-zinc-500">Defina a porcentagem do frete que você quer pagar para atrair mais clientes.</p>
                  </div>
                  <div className="flex items-center gap-2 mt-2 sm:mt-0">
                      <label className="text-xs font-bold text-zinc-600 dark:text-zinc-400">Você Paga:</label>
                      <input type="number" min="0" max="100" value={subsidyInput} onChange={e => setSubsidyInput(e.target.value)} className="w-16 border border-zinc-300 dark:border-zinc-700 bg-transparent rounded p-1.5 text-center font-bold text-sm outline-none focus:ring-2 focus:ring-purple-500" />
                      <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400">%</span>
                      <button onClick={handleSaveSubsidy} className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-1.5 rounded-lg text-xs font-bold transition shadow-sm ml-1">Salvar</button>
                  </div>
              </div>

              <div className="flex justify-between items-center mt-2">
                  <h3 className="font-bold text-zinc-700 dark:text-zinc-200 text-sm uppercase">Logística Reversa</h3>
                  <div className="flex items-center gap-2">
                      <button onClick={() => setMapModal({ open: true, origem: currentUser.id, destino: 'ecoponto' })} className="text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded">🗺️ {distColeta.toFixed(1)} km</button>
                      <button onClick={async () => {
                          const url = await store.criarPedido('COLETA');
                          if(url) window.location.href = url;
                      }} className="bg-amber-100 hover:bg-amber-200 text-amber-800 font-bold py-1.5 px-3 rounded-lg border border-amber-300 transition text-xs">
                          🚛 Chamar Caçamba ({formatMoney(store.rates.col_valor)})
                      </button>
                  </div>
              </div>
          </div>

          <div className="col-span-1 md:col-span-2 bg-white dark:bg-zinc-900 p-5 rounded-xl shadow border border-zinc-200 dark:border-zinc-800 flex flex-col gap-4">
              <div className="border-b border-zinc-100 dark:border-zinc-800 pb-2">
                  <h3 className="font-bold text-zinc-700 dark:text-zinc-200 text-sm uppercase">📦 Produtos Extras</h3>
                  <p className="text-[10px] text-zinc-500">Cadastre outros itens para os clientes adicionarem ao pedido.</p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                  <input type="text" placeholder="Nome do Produto" value={newProductName} onChange={e => setNewProductName(e.target.value)} className="flex-1 border border-zinc-300 dark:border-zinc-700 bg-transparent rounded-lg p-2 text-sm outline-none focus:border-purple-500" />
                  <input type="number" step="0.1" placeholder="Preço (R$)" value={newProductPrice} onChange={e => setNewProductPrice(e.target.value)} className="w-full sm:w-32 border border-zinc-300 dark:border-zinc-700 bg-transparent rounded-lg p-2 text-sm outline-none focus:border-purple-500" />
                  <button onClick={handleAddProduct} className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-4 py-2 rounded-lg text-sm transition shrink-0">Adicionar</button>
              </div>

              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800 mt-2">
                  {currentUser?.products?.map(p => (
                      <li key={p.id} className="flex justify-between items-center py-2">
                          <div>
                              <p className="font-bold text-zinc-800 dark:text-zinc-200 text-sm">{p.name}</p>
                              <p className="text-purple-600 text-xs font-bold">R$ {p.price.toFixed(2)}</p>
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
          
        {activeTab === 'abastecimento' && (
          <div className="bg-white dark:bg-zinc-900 p-5 rounded-xl shadow border border-zinc-200 dark:border-zinc-800 flex flex-col gap-3 animate-in fade-in zoom-in-95 duration-300">
              <h3 className="font-bold text-zinc-700 dark:text-zinc-200 text-sm uppercase">Comprar Lata Açaí (Fornecedores B2B)</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {fornecedores.map(forn => {
                    const dist = (forn.lat && currentUser.lat) ? haversineKm(forn.lat, forn.lng!, currentUser.lat, currentUser.lng!) : 0;
                    const freteTotal = dist * store.rates.b2b_km;
                    const subsidy = forn.freteSubsidyPct || 0;
                    const freteLoja = freteTotal * (1 - subsidy / 100);

                    return (
                      <div key={forn.id} className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-900 rounded-lg p-3 flex flex-col">
                          <div className="flex justify-between items-start mb-2">
                              <div className="flex gap-2 items-center"><span className="text-2xl">{forn.icon}</span><span className="font-bold text-sm text-emerald-900 dark:text-emerald-400">{forn.name}</span></div>
                              <button onClick={() => setMapModal({ open: true, origem: forn.id, destino: currentUser.id })} className="text-[10px] font-bold text-blue-600 bg-blue-100 dark:bg-blue-900/50 px-2 py-1 rounded">🗺️ {dist.toFixed(1)} km</button>
                          </div>
                          <div className="bg-white/60 dark:bg-black/20 p-2 rounded mb-3 text-xs text-emerald-800 dark:text-emerald-200">
                              <div className="flex justify-between mb-1"><span>Lata Açaí:</span> <span className="font-bold">{formatMoney(forn.priceB2B || 0)}</span></div>
                              <div className="flex justify-between">
                                <span>Frete {subsidy > 0 ? <span className="text-[9px] bg-orange-100 text-orange-700 px-1 rounded uppercase font-bold ml-1">Forn. paga {subsidy}%</span> : ''}</span> 
                                <span className="font-bold">{formatMoney(freteLoja)}</span>
                              </div>
                          </div>
                          <button onClick={() => setCartModalB2B({ open: true, fornId: forn.id, quantity: 1 })} className="w-full mt-auto bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2.5 rounded-lg transition">Comprar Paneiros</button>
                      </div>
                    )
                  })}
              </div>
          </div>
        )}

        {activeTab === 'pedidos' && (
          <div className="animate-in fade-in zoom-in-95 duration-300">
            <h3 className="font-bold text-lg text-zinc-700 dark:text-zinc-200 border-b border-zinc-200 dark:border-zinc-800 pb-2 mb-4">Gestão de Pedidos (Vendas e Abastecimento)</h3>
            
            <div className="grid grid-cols-1 gap-4">
          {meusPedidos.length === 0 ? (
             <div className="flex flex-col items-center justify-center p-8 bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-dashed border-zinc-300 dark:border-zinc-700 text-center">
                <span className="text-4xl mb-3 opacity-50">📋</span>
                <p className="text-zinc-500 font-medium">Nenhuma movimentação registrada na loja ainda.</p>
            </div>
          ) : meusPedidos.map(o => {
            const isCanceled = o.status === 'cancelado';
            
            let financeText = '';
            if (o.type === 'B2C') financeText = `Bruto: ${formatMoney(o.valor)} | Sub. Frete: ${formatMoney(o.taxas.entregaLoja)} | Líquido: ${formatMoney(o.taxas.repasse)}`;
            else if (o.type === 'B2B') financeText = `Custo Lata Açaí: ${formatMoney(o.valor)} | Frete Pago: ${formatMoney(o.taxas.entregaLoja)} | Gasto Total: ${formatMoney(o.valor + o.taxas.entregaLoja)}`;
            else if (o.type === 'COLETA') financeText = `Serviço Base: ${formatMoney(o.valor)} | Gasto Extra: ${formatMoney(-o.taxas.repasse - o.valor)} | Custo Total: ${formatMoney(-o.taxas.repasse)}`;

            return (
              <div key={o.id} className={`bg-white dark:bg-zinc-900 p-4 rounded-xl shadow-sm border border-l-4 ${isCanceled ? 'border-red-300 opacity-60 border-l-red-400' : (o.type === 'B2C' ? 'border-l-purple-500' : o.type === 'B2B' ? 'border-l-emerald-500' : 'border-l-amber-500')} flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4`}>
                  <div className="w-full sm:w-auto">
                      <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${o.type === 'B2C' ? 'bg-purple-100 text-purple-700' : o.type === 'B2B' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{o.type}</span>
                          <span className="font-bold text-zinc-800 dark:text-white text-sm">{o.title}</span>
                          {!isCanceled && (
                            <button onClick={() => setMapModal({ open: true, origem: o.origemId, destino: o.destinoId, motorista: o.motoristaId })} className="text-[10px] text-blue-500 hover:underline">🗺️ {o.distancia.toFixed(1)} km</button>
                          )}
                      </div>
                      <div className="text-[10px] text-zinc-600 dark:text-zinc-400 mb-1 uppercase font-bold">Cliente/Forn: {o.clienteNome || store.users[o.destinoId]?.name || '—'} | Motorista: {o.motoristaNome || 'Aguardando'}</div>
                      <p className="text-xs text-zinc-500 mt-1">{financeText}</p>
                      <div className="flex flex-wrap gap-2 mt-2 mb-2">
                         {o.createdAt && <span className="text-[9px] bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-2 py-0.5 rounded font-bold">🕒 Pedido: {new Date(o.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>}
                         {o.acceptedAt && <span className="text-[9px] bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded font-bold">👨‍🍳 Aceito: {new Date(o.acceptedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>}
                         {o.readyAt && <span className="text-[9px] bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-2 py-0.5 rounded font-bold">🛎️ Pronto: {new Date(o.readyAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>}
                         {o.pickedUpAt && <span className="text-[9px] bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded font-bold">📦 Retirada: {new Date(o.pickedUpAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>}
                         {o.deliveredAt && <span className="text-[9px] bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 px-2 py-0.5 rounded font-bold">📍 Chegou: {new Date(o.deliveredAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>}
                         {o.receivedAt && <span className="text-[9px] bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 px-2 py-0.5 rounded font-bold">✅ Recebido: {new Date(o.receivedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>}
                      </div>

                      {o.type === 'B2B' && o.deliveryPin && !isCanceled && o.status !== 'entregue' && o.status !== 'arquivado' && (
                         <div className="mt-2 mb-2 bg-emerald-900 dark:bg-emerald-950 text-white p-3 rounded-lg flex items-center justify-between shadow-md border border-emerald-700">
                             <div>
                                 <p className="text-[10px] font-bold uppercase text-emerald-300">PIN de Segurança</p>
                                 <p className="text-[10px] text-emerald-100 leading-tight">Forneça ao motorista</p>
                             </div>
                             <div className="text-xl font-black tracking-widest text-white">{o.deliveryPin}</div>
                         </div>
                      )}
                  </div>
                  
                  <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-end w-full sm:w-auto border-t sm:border-t-0 border-zinc-100 dark:border-zinc-800 pt-3 sm:pt-0 gap-2">
                      {/* Status Badges */}
                      {o.status === 'pendente' && <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-[10px] font-bold uppercase">Aguardando</span>}
                      {o.status === 'preparo' && <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-[10px] font-bold uppercase">Em Preparo</span>}
                      {o.status === 'pronto' && <span className="bg-amber-100 text-amber-800 px-2 py-1 rounded text-[10px] font-bold uppercase">Aguardando Moto</span>}
                      {o.status === 'em_rota' && <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-[10px] font-bold uppercase">Em Transporte</span>}
                      {o.status === 'aguardando_cliente' && o.type === 'B2C' && <span className="bg-teal-100 text-teal-800 px-2 py-1 rounded text-[10px] font-bold uppercase">Aguardando Cliente Confirmar</span>}
                      {o.status === 'aguardando_cliente' && o.type === 'B2B' && <span className="bg-teal-100 text-teal-800 px-2 py-1 rounded text-[10px] font-bold uppercase">Caminhão Chegou</span>}
                      {(o.status === 'entregue' || o.status === 'arquivado') && <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-[10px] font-bold uppercase">Concluído</span>}
                      {o.status === 'cancelado' && <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-[10px] font-bold uppercase">Cancelado</span>}
                      
                      {isCanceled && (
                        <button onClick={() => { if(confirm('Deseja excluir este pedido permanentemente?')) store.acaoPedido(o.id, 'deletar_pedido') }} className="text-xs bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold px-3 py-2 rounded-lg transition mt-2 sm:mt-0">🗑️ Excluir</button>
                      )}

                      {/* Interações */}
                      {!isCanceled && o.type === 'B2C' && o.status === 'pendente' && (
                        <div className="flex gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                            <button onClick={() => store.acaoPedido(o.id, 'cancelar_pedido')} className="flex-1 sm:flex-none bg-red-100 hover:bg-red-200 text-red-700 text-xs font-bold px-3 py-2 rounded-lg transition">❌ Recusar</button>
                            <button onClick={() => store.acaoPedido(o.id, 'aceitar_loja')} className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-lg shadow">Aceitar e Preparar</button>
                        </div>
                      )}

                      {!isCanceled && o.type === 'B2C' && o.status === 'preparo' && (
                        <button onClick={() => store.acaoPedido(o.id, 'chamar_moto')} className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-4 py-2 rounded-lg shadow w-full sm:w-auto mt-2 sm:mt-0 transition">🏍️ Chamar Moto</button>
                      )}
                      
                      {!isCanceled && (o.type === 'B2B' || o.type === 'COLETA') && (o.status === 'pendente' || (o.type === 'COLETA' && o.status === 'preparo' && !o.motoristaId)) && (
                        <button onClick={() => store.acaoPedido(o.id, 'cancelar_pedido')} className="bg-red-100 hover:bg-red-200 text-red-700 text-xs font-bold px-3 py-2 rounded-lg transition w-full sm:w-auto mt-2 sm:mt-0">❌ Cancelar</button>
                      )}

                      {!isCanceled && o.type === 'B2B' && o.status === 'em_rota' && (
                        <span className="text-[10px] text-amber-600 font-bold bg-amber-50 px-2 py-1.5 rounded shadow-sm text-center">⏳ Aguardando caminhão</span>
                      )}

                      {!isCanceled && o.type === 'B2B' && o.status === 'aguardando_cliente' && (
                        <button onClick={() => store.acaoPedido(o.id, 'conf_recebedor')} className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-4 py-2.5 rounded-lg shadow-md transition w-full sm:w-auto mt-2 sm:mt-0">✅ Confirmar Recebimento</button>
                      )}
                  </div>
              </div>
            )
          })}
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
          <div className="bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in slide-in-from-bottom-full sm:zoom-in-95">
              <div className="bg-emerald-700 text-white p-4 sm:p-5 flex justify-between items-center">
                  <h3 className="font-bold text-lg">🛒 Comprar Lata Açaí (B2B)</h3>
                  <button onClick={() => setCartModalB2B({ ...cartModalB2B, open: false })} className="text-white hover:text-red-300 font-bold text-2xl leading-none">&times;</button>
              </div>
              
              <div className="p-6">
                  {(() => {
                      const forn = store.users[cartModalB2B.fornId];
                      if (!forn) return <p>Fornecedor não encontrado</p>;
                      
                      const dist = (forn.lat && currentUser?.lat) ? haversineKm(forn.lat, forn.lng!, currentUser.lat, currentUser.lng!) : 0;
                      const freteTotal = dist * store.rates.b2b_km;
                      const subsidy = forn.freteSubsidyPct || 0;
                      const freteLoja = freteTotal * (1 - subsidy / 100);
                      const unitPrice = forn.priceB2B || 0;
                      const subtotal = unitPrice * cartModalB2B.quantity;
                      const totalToPay = subtotal + freteLoja;

                      return (
                          <>
                              <p className="text-xs text-zinc-500 font-bold uppercase mb-1">Fornecedor Selecionado</p>
                              <h4 className="font-bold text-zinc-800 dark:text-white text-xl mb-4">{forn.name}</h4>
                              
                              <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">Quantidade de Paneiros / Latas:</label>
                              <div className="flex items-center gap-4 mb-6">
                                  <button onClick={() => setCartModalB2B(prev => ({ ...prev, quantity: Math.max(1, prev.quantity - 1)}))} className="bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 w-10 h-10 rounded-full font-bold text-xl flex items-center justify-center hover:bg-zinc-300 transition">-</button>
                                  <span className="text-2xl font-bold text-zinc-900 dark:text-white w-8 text-center">{cartModalB2B.quantity}</span>
                                  <button onClick={() => setCartModalB2B(prev => ({ ...prev, quantity: prev.quantity + 1}))} className="bg-emerald-100 text-emerald-700 w-10 h-10 rounded-full font-bold text-xl flex items-center justify-center hover:bg-emerald-200 transition">+</button>
                              </div>
                              
                              <div className="space-y-3 mb-6 text-sm text-zinc-600 dark:text-zinc-400">
                                  <div className="flex justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2">
                                      <span>Valor do Produto ({cartModalB2B.quantity}x {formatMoney(unitPrice)}):</span>
                                      <span className="font-bold text-zinc-800 dark:text-white">{formatMoney(subtotal)}</span>
                                  </div>
                                  <div className="flex justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2">
                                      <span>Frete (sua parte):</span>
                                      <span className="font-bold text-zinc-800 dark:text-white">{formatMoney(freteLoja)}</span>
                                  </div>
                                  <div className="flex justify-between pt-2 text-lg">
                                      <span className="font-bold text-zinc-800 dark:text-white">Total a Pagar:</span>
                                      <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatMoney(totalToPay)}</span>
                                  </div>
                              </div>
                              
                              <div className="flex gap-3">
                                  <button onClick={() => setCartModalB2B({ ...cartModalB2B, open: false })} className="flex-1 px-4 py-3 bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold rounded-xl active:scale-95 transition">Cancelar</button>
                                  <button onClick={async () => {
                                      store.clearCart();
                                      store.addToCart(forn.id, { id: 'B2B', name: 'Paneiro de Açaí', price: unitPrice, quantity: cartModalB2B.quantity });
                                      const url = await store.criarPedido('B2B', forn.id);
                                      setCartModalB2B({ ...cartModalB2B, open: false });
                                      if(url) window.location.href = url;
                                  }} className="flex-1 px-4 py-3 bg-emerald-600 text-white font-bold rounded-xl shadow-lg hover:bg-emerald-700 active:scale-95 transition">Confirmar Pedido</button>
                              </div>
                          </>
                      );
                  })()}
              </div>
          </div>
        </div>
      )}
    </div>
  );
}
