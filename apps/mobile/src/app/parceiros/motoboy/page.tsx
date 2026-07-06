"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Bike } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { MapModal } from "@/components/MapModal";

export default function MotoboyDashboard() {
  const router = useRouter();
  const store = useAppStore();
  const currentUser = store.currentUser;
  
  const [mapModal, setMapModal] = useState<{ open: boolean; origem: string; destino: string; motorista?: string | null }>({ open: false, origem: '', destino: '' });

  if (!currentUser || currentUser.role !== 'motorista' || currentUser.veiculo !== 'Moto') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 flex flex-col items-center justify-center p-6 text-center">
        <Bike size={48} className="text-amber-600 mb-4" />
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">Acesso Restrito</h2>
        <p className="text-zinc-500 mb-6">Você precisa estar logado como Motoboy para acessar este painel.</p>
        <button onClick={() => router.push('/login')} className="bg-amber-600 text-white font-bold py-3 px-6 rounded-xl hover:bg-amber-700 transition">
          Fazer Login
        </button>
      </div>
    );
  }

  const formatMoney = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const corridasDisponiveis = store.orders.filter(o => o.status === 'preparo' && o.motoristaId === null && o.type === 'B2C');
  const minhasCorridas = store.orders.filter(o => o.motoristaId === currentUser.id);
  const ganhosHoje = minhasCorridas.filter(o => o.status === 'entregue').reduce((acc, curr) => acc + curr.taxas.entregaMotorista, 0);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 pb-24">
      <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 p-4 sticky top-0 z-30">
        <div className="flex justify-between items-center max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <Link href="/parceiros">
              <ArrowLeft className="text-zinc-600 dark:text-zinc-400" />
            </Link>
            <Bike className="text-amber-600" />
            <h1 className="text-xl font-bold text-zinc-900 dark:text-white">Corridas (B2C)</h1>
          </div>
          {currentUser.mercadoPagoToken && (
             <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-1 rounded font-bold border border-blue-200">MP Ativo ✅</span>
          )}
        </div>
      </header>

      <main className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
        <div className="bg-zinc-800 dark:bg-zinc-900 text-white p-5 rounded-xl shadow flex justify-between items-center border border-zinc-700 dark:border-zinc-800">
            <div>
                <h2 className="text-xl font-bold">{currentUser.icon} {currentUser.name} ({currentUser.veiculo})</h2>
                <p className="text-zinc-400 text-xs mt-1">📍 Base: {currentUser.bairro}</p>
            </div>
            <div className="text-right">
                <p className="text-sm text-zinc-400">Ganhos (Sessão)</p>
                <p className="text-2xl font-bold text-green-400">{formatMoney(ganhosHoje)}</p>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
                <h3 className="font-bold text-lg text-zinc-700 dark:text-zinc-200 border-b border-zinc-200 dark:border-zinc-800 pb-2 mb-4">🚨 Radar de Corridas</h3>
                <div className="space-y-4">
                  {corridasDisponiveis.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-8 bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-dashed border-zinc-300 dark:border-zinc-700 text-center">
                        <span className="text-4xl mb-3 opacity-50">📡</span>
                        <p className="text-zinc-500 font-medium">Nenhum chamado no radar no momento.</p>
                    </div>
                  ) : corridasDisponiveis.map(o => {
                    const origem = store.users[o.origemId];
                    const destino = store.users[o.destinoId];
                    return (
                      <div key={o.id} className="bg-white dark:bg-zinc-900 p-4 rounded-xl shadow-sm border border-blue-100 dark:border-blue-900/50">
                          <div className="flex justify-between items-start mb-2">
                              <span className="text-[10px] font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded">Nova Rota B2C</span>
                              <span className="font-bold text-green-600 dark:text-green-400">Líquido: {formatMoney(o.taxas.entregaMotorista)}</span>
                          </div>
                          <div className="bg-gray-50 dark:bg-zinc-950/50 p-3 rounded text-sm mb-4 flex flex-col gap-1 border border-zinc-100 dark:border-zinc-800">
                              <div className="flex items-center gap-2"><span className="text-zinc-400 text-xs">📍</span> <span className="text-zinc-700 dark:text-zinc-300 font-medium">{origem?.bairro || '—'}</span></div>
                              <div className="flex items-center gap-2"><span className="text-zinc-400 text-xs">🏁</span> <span className="text-zinc-700 dark:text-zinc-300 font-medium">{destino?.bairro || '—'}</span></div>
                              <button onClick={() => setMapModal({ open: true, origem: o.origemId, destino: o.destinoId, motorista: currentUser.id })} className="mt-2 text-blue-600 bg-blue-100/50 dark:bg-blue-900/20 p-2 rounded-lg font-bold hover:bg-blue-100 dark:hover:bg-blue-900/40 text-center w-full transition border border-blue-200 dark:border-blue-800">🗺️ Ver Rota de {o.distancia.toFixed(1)} km</button>
                          </div>
                          <button onClick={() => store.acaoPedido(o.id, 'aceitar_motorista')} className="w-full bg-zinc-800 hover:bg-black dark:bg-zinc-800 dark:hover:bg-zinc-700 text-white text-base font-bold py-3.5 rounded-xl transition shadow-md">Aceitar Corrida</button>
                      </div>
                    )
                  })}
                </div>
            </div>
            
            <div>
                <h3 className="font-bold text-lg text-zinc-700 dark:text-zinc-200 border-b border-zinc-200 dark:border-zinc-800 pb-2 mb-4">📦 Em Andamento</h3>
                <div className="space-y-4">
                  {minhasCorridas.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-8 bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-dashed border-zinc-300 dark:border-zinc-700 text-center">
                        <span className="text-4xl mb-3 opacity-50">✅</span>
                        <p className="text-zinc-500 font-medium">Você está livre.</p>
                    </div>
                  ) : minhasCorridas.map(o => (
                    <div key={o.id} className={`bg-white dark:bg-zinc-900 p-4 rounded-xl shadow-sm border ${o.status === 'em_rota' ? 'border-purple-400 dark:border-purple-600' : 'border-zinc-200 dark:border-zinc-800'}`}>
                        <div className="flex justify-between items-center mb-2">
                            <span className="font-bold text-zinc-800 dark:text-white text-sm">{o.title}</span>
                            <button onClick={() => setMapModal({ open: true, origem: o.origemId, destino: o.destinoId, motorista: currentUser.id })} className="text-[10px] text-blue-500 hover:underline">🗺️ {o.distancia.toFixed(1)} km</button>
                        </div>
                        <div className="text-xs text-zinc-500 mb-3">Destino: {store.users[o.destinoId]?.bairro || '—'}</div>
                        
                        {o.status === 'em_rota' && !o.confirmacao.entregador ? (
                            <button onClick={() => store.acaoPedido(o.id, 'conf_motorista')} className="w-full bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold py-3 rounded-lg shadow transition">📍 Confirmar Chegada</button>
                        ) : o.status === 'em_rota' && o.confirmacao.entregador ? (
                            <div className="bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-800 text-xs p-2 rounded text-center font-bold">Aguardando cliente confirmar...</div>
                        ) : (
                            <div className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800 text-xs p-2 rounded text-center font-bold">✅ Finalizado</div>
                        )}
                    </div>
                  ))}
                </div>
            </div>
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
