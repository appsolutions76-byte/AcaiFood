"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Store } from "lucide-react";
import { useAppStore, haversineKm } from "@/store/useAppStore";
import { MapModal } from "@/components/MapModal";

export default function BatedeiraDashboard() {
  const store = useAppStore();
  const currentUser = store.currentUser;
  
  const [mapModal, setMapModal] = useState<{ open: boolean; origem: string; destino: string; motorista?: string | null }>({ open: false, origem: '', destino: '' });
  const [subsidyInput, setSubsidyInput] = useState(currentUser?.freteSubsidyPct?.toString() || "0");

  if (!currentUser || currentUser.role !== 'loja') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 flex flex-col items-center justify-center p-6 text-center">
        <Store size={48} className="text-purple-600 mb-4" />
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">Acesso Restrito</h2>
        <p className="text-zinc-500 mb-6">Você precisa conectar seu Mercado Pago no Portal de Parceiros para acessar esta área.</p>
        <Link href="/parceiros" className="bg-purple-600 text-white font-bold py-3 px-6 rounded-xl hover:bg-purple-700 transition">
          Volter ao Portal
        </Link>
      </div>
    );
  }

  const formatMoney = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const meusPedidos = store.orders.filter(o => o.lojaId === currentUser.id);
  const vendasHoje = meusPedidos.filter(o => o.status === 'entregue' && o.type === 'B2C').reduce((acc, curr) => acc + curr.taxas.repasse, 0);
  const fornecedores = Object.values(store.users).filter(u => u.role === 'fornecedor');
  
  const distColeta = (currentUser.lat && store.users.ecoponto.lat) ? haversineKm(currentUser.lat, currentUser.lng!, store.users.ecoponto.lat, store.users.ecoponto.lng!) : 0;
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
            <Link href="/parceiros">
              <ArrowLeft className="text-zinc-600 dark:text-zinc-400" />
            </Link>
            <Store className="text-purple-600" />
            <h1 className="text-xl font-bold text-zinc-900 dark:text-white">Painel da Loja</h1>
          </div>
          {currentUser.mercadoPagoToken && (
             <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-1 rounded font-bold border border-blue-200">MP Ativo ✅</span>
          )}
        </div>
      </header>
      
      <main className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                      <h3 className="font-bold text-zinc-700 dark:text-zinc-200 text-sm uppercase">⚙️ Marketing (Subsídio de Frete)</h3>
                      <p className="text-[10px] text-zinc-500">Defina a porcentagem do frete que você quer pagar para os clientes.</p>
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
                      <button onClick={() => store.criarPedido('COLETA')} className="bg-amber-100 hover:bg-amber-200 text-amber-800 font-bold py-1.5 px-3 rounded-lg border border-amber-300 transition text-xs">
                          🚛 Chamar Caçamba ({formatMoney(store.rates.col_valor)})
                      </button>
                  </div>
              </div>

              <hr className="border-zinc-100 dark:border-zinc-800" />
              
              <h3 className="font-bold text-zinc-700 dark:text-zinc-200 text-sm uppercase">Comprar Fruto (Fornecedores B2B)</h3>
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
                              <div className="flex justify-between mb-1"><span>Fruto:</span> <span className="font-bold">{formatMoney(forn.priceB2B || 0)}</span></div>
                              <div className="flex justify-between">
                                <span>Frete {subsidy > 0 ? <span className="text-[9px] bg-orange-100 text-orange-700 px-1 rounded uppercase font-bold ml-1">Forn. paga {subsidy}%</span> : ''}</span> 
                                <span className="font-bold">{formatMoney(freteLoja)}</span>
                              </div>
                          </div>
                          <button onClick={() => store.criarPedido('B2B', forn.id)} className="w-full mt-auto bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2.5 rounded-lg transition">Comprar Paneiros</button>
                      </div>
                    )
                  })}
              </div>
          </div>
        </div>

        <h3 className="font-bold text-lg text-zinc-700 dark:text-zinc-200 border-b border-zinc-200 dark:border-zinc-800 pb-2">Gestão de Pedidos (Vendas e Abastecimento)</h3>
        
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
            else if (o.type === 'B2B') financeText = `Custo Fruto: ${formatMoney(o.valor)} | Frete Pago: ${formatMoney(o.taxas.entregaLoja)} | Gasto Total: ${formatMoney(o.valor + o.taxas.entregaLoja)}`;
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
                      <p className="text-xs text-zinc-500 mt-1">{financeText}</p>
                  </div>
                  
                  <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-end w-full sm:w-auto border-t sm:border-t-0 border-zinc-100 dark:border-zinc-800 pt-3 sm:pt-0 gap-2">
                      {/* Status Badges */}
                      {o.status === 'pendente' && <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-[10px] font-bold uppercase">Aguardando</span>}
                      {o.status === 'preparo' && <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-[10px] font-bold uppercase">Em Preparo</span>}
                      {o.status === 'em_rota' && <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-[10px] font-bold uppercase">Em Transporte</span>}
                      {o.status === 'entregue' && <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-[10px] font-bold uppercase">Concluído</span>}
                      {o.status === 'cancelado' && <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-[10px] font-bold uppercase">Cancelado</span>}
                      
                      {/* Interações */}
                      {!isCanceled && o.type === 'B2C' && o.status === 'pendente' && (
                        <div className="flex gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                            <button onClick={() => store.acaoPedido(o.id, 'cancelar_pedido')} className="flex-1 sm:flex-none bg-red-100 hover:bg-red-200 text-red-700 text-xs font-bold px-3 py-2 rounded-lg transition">❌ Recusar</button>
                            <button onClick={() => store.acaoPedido(o.id, 'aceitar_loja')} className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-lg shadow">Aceitar e Preparar</button>
                        </div>
                      )}
                      
                      {!isCanceled && (o.type === 'B2B' || o.type === 'COLETA') && o.status === 'pendente' && (
                        <button onClick={() => store.acaoPedido(o.id, 'cancelar_pedido')} className="bg-red-100 hover:bg-red-200 text-red-700 text-xs font-bold px-3 py-2 rounded-lg transition w-full sm:w-auto mt-2 sm:mt-0">❌ Cancelar</button>
                      )}

                      {!isCanceled && o.type === 'B2B' && o.status === 'em_rota' && !o.confirmacao.entregador && (
                        <span className="text-[10px] text-amber-600 font-bold bg-amber-50 px-2 py-1.5 rounded shadow-sm text-center">⏳ Aguardando caminhão</span>
                      )}

                      {!isCanceled && o.type === 'B2B' && o.status === 'em_rota' && o.confirmacao.entregador && !o.confirmacao.recebedor && (
                        <button onClick={() => store.acaoPedido(o.id, 'conf_recebedor')} className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-4 py-2.5 rounded-lg shadow-md transition w-full sm:w-auto mt-2 sm:mt-0">✅ Confirmar Chegada</button>
                      )}
                  </div>
              </div>
            )
          })}
        </div>

      </main>

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
