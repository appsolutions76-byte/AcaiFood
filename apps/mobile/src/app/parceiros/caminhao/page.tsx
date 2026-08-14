"use client";

import React, { useState, useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Truck, BookOpen } from "lucide-react";
import { useAppStore, getRatesForCity } from "@/store/useAppStore";
import { MapModal, MapPoint } from "@/components/MapModal";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PartnerManualModal } from "@/components/PartnerManualModal";
import { OrderChatModal } from "@/components/OrderChatModal";

const emptySubscribe = () => () => {};

export default function CaminhaoDashboard() {
  const router = useRouter();
  const store = useAppStore();
  const currentUser = store.currentUser;
  
  const [mapModal, setMapModal] = useState<{
    open: boolean;
    origem: MapPoint | null;
    destino: MapPoint | null;
    motorista?: MapPoint | null;
  }>({ open: false, origem: null, destino: null, motorista: null });
  const [activeTab, setActiveTab] = useState('radar');
  const [pinInputs, setPinInputs] = useState<Record<string, string>>({});
  const [partnerManualOpen, setPartnerManualOpen] = useState(false);
  const [chatModalData, setChatModalData] = useState<{ open: boolean; orderId: string; otherName?: string; otherPhone?: string; otherRole?: string }>({ open: false, orderId: "" });

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

  // Captura contínua do GPS em tempo real quando Online
  useEffect(() => {
    if (!mounted || !currentUser || currentUser.status === 'paused' || typeof window === 'undefined' || !navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        if (latitude && longitude) {
          store.updateUserLocation(currentUser.id, latitude, longitude);
        }
      },
      (err) => {
        console.warn("Aviso de GPS do Caminhoneiro:", err.message);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [mounted, currentUser?.id, currentUser?.status]);

  if (!mounted) {
    return <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 flex items-center justify-center p-6"><p>Carregando...</p></div>;
  }

  const roleStr = String(currentUser?.role || '').toLowerCase();
  const veicStr = String(currentUser?.veiculo || '').toLowerCase();
  const isCaminhaoUser = currentUser && (roleStr === 'caminhao' || (roleStr === 'motorista' && (veicStr.includes('caminh') || veicStr.includes('caçamb'))));

  if (!isCaminhaoUser) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 flex flex-col items-center justify-center p-6 text-center">
        <Truck size={48} className="text-blue-600 mb-4" />
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">Acesso Restrito</h2>
        <p className="text-zinc-500 mb-6">Você precisa estar logado como Caminhoneiro ou Motorista de Caçamba para acessar este painel.</p>
        <button onClick={() => router.push('/login')} className="bg-blue-600 text-white font-bold py-3 px-6 rounded-xl hover:bg-blue-700 transition">
          Fazer Login
        </button>
      </div>
    );
  }

  const rates = getRatesForCity(currentUser?.cidade, store.rates, store.cities) || store.rates;
  const formatMoney = (val: number) => (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const getDriverFee = (o: any) => {
    const orderCity = o.cidadeOrigem || currentUser?.cidade || 'Belém';
    const cityRates = getRatesForCity(orderCity, store.rates, store.cities) || rates;
    const dist = o.distancia || 1.0;
    const totalFrete = o.type === 'COLETA'
      ? (cityRates.ecopoint_payment_mode === 'FIXED' ? (cityRates.ecopoint_fixed_fee ?? 50.00) : dist * (cityRates.col_km || 8.00))
      : (cityRates.transporter_payment_mode === 'FIXED' ? (cityRates.transporter_fixed_fee ?? 150.00) : dist * (cityRates.b2b_km || 4.00));
    const platPct = ((o.type === 'COLETA' ? cityRates.col_mot_plat : cityRates.b2b_mot_plat) ?? 15) / 100;
    return totalFrete * (1 - platPct);
  };

  const isDelivered = (st?: string) => st === 'entregue' || st === 'RECEIVED' || st === 'DELIVERED';

  const corridasDisponiveis = (store.orders || []).filter(o => {
    const isReady = (o.status === 'pronto' || o.status === 'preparo' || o.status === 'pendente' || (o.status as string) === 'READY') && (o.motoristaId === null || !o.motoristaId) && (o.type === 'B2B' || o.type === 'COLETA');
    if (!isReady) return false;
    const originCity = (o as any).cidadeOrigem?.toLowerCase()?.trim() || 'belém';
    const driverCity = currentUser.cidade?.toLowerCase()?.trim() || 'belém';
    return originCity === driverCity;
  });
  const minhasCorridas = (store.orders || []).filter(o => o.motoristaId === currentUser.id);
  const ganhosHoje = minhasCorridas.filter(o => isDelivered(o.status) && !o.payoutDriverDone).reduce((acc, curr) => acc + getDriverFee(curr), 0);

  const isPaused = currentUser.status === 'paused';
  const handleToggleStatus = () => {
    store.updateUserStatus(currentUser.id, isPaused ? 'active' : 'paused');
  };

  const linkAsaasAccount = store.linkAsaasAccount;
  const handleLinkAsaas = async () => {
    if (!currentUser) return;
    const inputPix = prompt("Informe a sua Chave PIX (CPF, Celular, E-mail ou Aleatória) ou Carteira Asaas para receber os repasses dos seus fretes:", currentUser.pixKey || currentUser.asaasWalletId || "");
    if (inputPix !== null && inputPix.trim() !== "") {
      await linkAsaasAccount(currentUser.id, inputPix.trim());
      alert("✅ Chave PIX / Carteira Asaas salva com sucesso! Repasses ativados.\n\n📲 Nota: Se você receber um SMS do Asaas com código de verificação, não se preocupe: sua conta no AçaíFood já está 100% ativa e pronta para receber!");
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

    if (!ganhosHoje || ganhosHoje <= 0) {
      alert("Não há saldo disponível para saque no momento.");
      return;
    }

    if (confirm(`Deseja transferir R$ ${ganhosHoje.toFixed(2)} instantaneamente via PIX para a sua Chave Pix externa (${targetKey})?`)) {
      try {
        const res = await fetch('/api/asaas/transfer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-internal-secret': process.env.NEXT_PUBLIC_INTERNAL_API_SECRET || '' },
          body: JSON.stringify({
            pixKey: targetKey,
            value: ganhosHoje,
            description: `Saque Instantâneo AçaíFood (${currentUser.name})`
          })
        });
        const data = await res.json();
        if (res.ok && (data.success || data.transferId)) {
          alert(`✅ PIX enviado com sucesso!\nID da Transferência: ${data.transferId || 'concluída'}\nO valor de R$ ${ganhosHoje.toFixed(2)} já está a caminho do seu banco (${targetKey}).`);
        } else {
          const msg = data.error || '';
          if (msg.includes('Saldo insuficiente')) {
            alert(`ℹ️ Saldo já creditado na Subconta Asaas:\nO valor de R$ ${ganhosHoje.toFixed(2)} já consta na sua subconta Asaas oficial (${currentUser.asaasWalletId || 'Ativa'}).\nA varredura automática de repasse para o seu banco externo ocorrerá às ${rates.payout_time || '22:00'}.`);
          } else {
            alert(`Status do PIX Asaas: ${msg || 'Não foi possível processar a transferência no momento.'}`);
          }
        }
      } catch (_err) {
        alert("Erro de conexão ao solicitar transferência PIX.");
      }
    }
  };


  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 pb-24">
      <PartnerManualModal isOpen={partnerManualOpen} onClose={() => setPartnerManualOpen(false)} role="caminhao" />
      <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 p-4 sticky top-0 z-30">
        <div className="flex justify-between items-center max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <Truck className="text-blue-600" />
            <h1 className="text-xl font-bold text-zinc-900 dark:text-white">Fretes Pesados (B2B / Coleta)</h1>
          </div>
          <div className="flex items-center gap-3">
            {currentUser?.asaasLinked && (
               <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-1 rounded font-bold border border-emerald-200 hidden sm:inline-block">Asaas Ativo ✅</span>
            )}
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
        <div className="max-w-4xl mx-auto px-4 flex gap-6 overflow-x-auto">
          <button onClick={() => setActiveTab('geral')} className={`py-4 px-2 font-bold text-sm border-b-2 transition whitespace-nowrap ${activeTab === 'geral' ? 'border-blue-600 text-blue-600' : 'border-transparent text-zinc-500 hover:text-zinc-800'}`}>📊 Visão Geral</button>
          <button onClick={() => setActiveTab('radar')} className={`py-4 px-2 font-bold text-sm border-b-2 transition whitespace-nowrap ${activeTab === 'radar' ? 'border-blue-600 text-blue-600' : 'border-transparent text-zinc-500 hover:text-zinc-800'}`}>📡 Radar de Fretes</button>
          <button onClick={() => setActiveTab('historico')} className={`py-4 px-2 font-bold text-sm border-b-2 transition whitespace-nowrap ${activeTab === 'historico' ? 'border-blue-600 text-blue-600' : 'border-transparent text-zinc-500 hover:text-zinc-800'}`}>🚚 Meus Fretes</button>
        </div>
      </div>

      <main className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
        {!currentUser?.asaasLinked && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-6 text-center shadow-sm">
            <h3 className="text-amber-700 dark:text-amber-400 font-bold text-lg mb-2">Atenção: Repasses Pendentes!</h3>
            <p className="text-amber-600 dark:text-amber-300 text-sm mb-4">
              Para receber os pagamentos dos seus fretes diretamente no seu PIX ou subconta Asaas, vincule sua Chave PIX / Carteira Asaas.
            </p>
            <button 
              onClick={handleLinkAsaas}
              className="inline-block bg-amber-600 text-white font-bold py-3 px-6 rounded-xl shadow-md hover:bg-amber-700 transition"
            >
              🤝 Vincular Subconta / Carteira Asaas
            </button>
            <p className="text-[11px] text-amber-600 dark:text-amber-400 opacity-80 mt-3">
              📲 <strong>Dica:</strong> Se você receber um SMS do Asaas com código de verificação, não se preocupe: a sua conta AçaíFood é ativada automaticamente via API!
            </p>
          </div>
        )}
        {activeTab === 'geral' && (
        <div className="bg-blue-950 text-white p-5 rounded-xl shadow flex justify-between items-center border border-blue-900 animate-in fade-in zoom-in-95 duration-300">
            <div>
                <h2 className="text-xl font-bold">{currentUser.icon} {currentUser.name} ({currentUser.veiculo})</h2>
                <p className="text-blue-300 text-xs mt-1">📍 Base: {currentUser.bairro}</p>
            </div>
            <div className="text-right flex flex-col items-end">
                <p className="text-sm text-blue-300">Cofre Virtual (A Receber)</p>
                <p className="text-2xl font-bold text-green-400">{formatMoney(ganhosHoje)}</p>
                <p className="text-[10px] text-blue-300 mt-1">🗓️ Pix Automático: às {rates.payout_time || '22:00'}</p>
                {ganhosHoje > 0 && (
                  <button 
                    onClick={handleResgatarPix}
                    className="mt-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-lg transition shadow flex items-center gap-1"
                  >
                    💸 Saque Instantâneo Pix
                  </button>
                )}
                <button onClick={handleToggleStatus} className={`mt-2 px-3 py-1 rounded-lg text-xs font-bold transition border ${isPaused ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100' : 'bg-green-50 text-green-600 border-green-200 hover:bg-green-100'}`}>
                    {isPaused ? 'Offline 🚫' : 'Online ✅'}
                </button>
            </div>
        </div>
        )}

        {activeTab === 'radar' && (
        <div className="grid grid-cols-1 gap-6 animate-in fade-in zoom-in-95 duration-300">
            <div>
                <h3 className="font-bold text-lg text-zinc-700 dark:text-zinc-200 border-b border-zinc-200 dark:border-zinc-800 pb-2 mb-4">🚨 Radar de Fretes</h3>
                <div className="space-y-4">
                  {corridasDisponiveis.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-8 bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-dashed border-zinc-300 dark:border-zinc-700 text-center">
                        <span className="text-4xl mb-3 opacity-50">📡</span>
                        <p className="text-zinc-500 font-medium">Nenhum frete pesado no momento.</p>
                    </div>
                  ) : corridasDisponiveis.map(o => {
                    const origem = store.users?.[o.origemId];
                    const destino = store.users?.[o.destinoId];
                    return (
                      <div key={o.id} className="bg-white dark:bg-zinc-900 p-4 rounded-xl shadow-sm border border-blue-100 dark:border-blue-900/50">
                          <div className="flex justify-between items-start mb-2">
                              <span className="text-[10px] font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded">Nova Rota {o.type}</span>
                              <span className="font-bold text-green-600 dark:text-green-400">Líquido: {formatMoney(o.taxas?.entregaMotorista || 0)}</span>
                          </div>
                          <div className="bg-gray-50 dark:bg-zinc-950/50 p-3 rounded text-sm mb-4 flex flex-col gap-1 border border-zinc-100 dark:border-zinc-800">
                              <div className="flex items-center gap-2"><span className="text-zinc-400 text-xs">📍</span> <span className="text-zinc-700 dark:text-zinc-300 font-medium">{origem?.bairro || '—'}</span></div>
                              <div className="flex items-center gap-2"><span className="text-zinc-400 text-xs">🏁</span> <span className="text-zinc-700 dark:text-zinc-300 font-medium">{destino?.bairro || '—'}</span></div>
                              <button 
                                onClick={() => {
                                  const latOrigem = (origem?.lat && origem.lat !== 0) ? origem.lat : -1.4558;
                                  const lngOrigem = (origem?.lng && origem.lng !== 0) ? origem.lng : -48.4908;
                                  const latDestino = o.deliveryLat || destino?.lat || (latOrigem + 0.0045);
                                  const lngDestino = o.deliveryLng || destino?.lng || (lngOrigem + 0.0045);
                                  const driverLat = (currentUser?.lat && currentUser.lat !== 0) ? currentUser.lat : latOrigem - 0.003;
                                  const driverLng = (currentUser?.lng && currentUser.lng !== 0) ? currentUser.lng : lngOrigem - 0.003;

                                  setMapModal({
                                    open: true,
                                    origem: { lat: latOrigem, lng: lngOrigem, name: o.lojaNome || origem?.name || 'Retirada' },
                                    destino: { lat: latDestino, lng: lngDestino, name: o.clienteNome || destino?.name || 'Entrega' },
                                    motorista: { lat: driverLat, lng: driverLng, name: currentUser?.name || 'Seu Veículo', veiculo: currentUser?.veiculo || 'Caminhão' }
                                  });
                                }} 
                                className="mt-2 text-blue-600 bg-blue-100/50 dark:bg-blue-900/20 p-2 rounded-lg font-bold hover:bg-blue-100 dark:hover:bg-blue-900/40 text-center w-full transition border border-blue-200 dark:border-blue-800"
                              >
                                🗺️ Ver Rota de {o.distancia ? o.distancia.toFixed(1) : '0.0'} km
                              </button>
                          </div>
                          <button onClick={() => store.acaoPedido(o.id, 'aceitar_motorista')} className="w-full bg-blue-600 hover:bg-blue-700 text-white text-base font-bold py-3.5 rounded-xl transition shadow-md">Aceitar Frete</button>
                      </div>
                    )
                  })}
                </div>
            </div>
        </div>
        )}
            
        {activeTab === 'historico' && (
        <div className="grid grid-cols-1 gap-6 animate-in fade-in zoom-in-95 duration-300">
            <div>
                <h3 className="font-bold text-lg text-zinc-700 dark:text-zinc-200 border-b border-zinc-200 dark:border-zinc-800 pb-2 mb-4">📦 Em Andamento</h3>
                <div className="space-y-4">
                  {minhasCorridas.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-8 bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-dashed border-zinc-300 dark:border-zinc-700 text-center">
                        <span className="text-4xl mb-3 opacity-50">✅</span>
                        <p className="text-zinc-500 font-medium">Você está livre.</p>
                    </div>
                  ) : minhasCorridas.map(o => {
                    const origId = o.fornecedorId || o.origemId;
                    const destId = o.lojaId || o.destinoId;
                    const origemUser = store.users?.[origId];
                    const destinoUser = store.users?.[destId];
                    return (
                    <div key={o.id} className={`bg-white dark:bg-zinc-900 p-4 rounded-xl shadow-sm border ${o.status === 'em_rota' ? 'border-blue-400 dark:border-blue-600' : 'border-zinc-200 dark:border-zinc-800'}`}>
                        <div className="flex justify-between items-center mb-2">
                            <span className="font-bold text-zinc-800 dark:text-white text-sm">{o.title}</span>
                            <span className="text-xs font-bold text-green-600 dark:text-green-400">Líquido: {formatMoney(getDriverFee(o))}</span>
                        </div>
                        
                        <div className="bg-gray-50 dark:bg-zinc-950/50 p-3 rounded-lg text-xs mb-3 flex flex-col gap-1.5 border border-zinc-100 dark:border-zinc-800">
                            <div className="flex items-center gap-2">
                                <span className="text-sm">📍</span> 
                                <div>
                                    <span className="text-[10px] font-bold uppercase text-zinc-400 block">Retirar no Fornecedor</span>
                                    <span className="text-zinc-800 dark:text-zinc-200 font-bold">{o.lojaNome || origemUser?.name || '—'}</span> 
                                    <span className="text-zinc-500 text-[11px]"> ({origemUser?.bairro || '—'})</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 pt-1 border-t border-zinc-200 dark:border-zinc-800">
                                <span className="text-sm">🏁</span> 
                                <div>
                                    <span className="text-[10px] font-bold uppercase text-zinc-400 block">Entregar na Loja</span>
                                    <span className="text-zinc-800 dark:text-zinc-200 font-bold">{o.clienteNome || destinoUser?.name || '—'}</span> 
                                    <span className="text-zinc-500 text-[11px]"> ({destinoUser?.bairro || '—'})</span>
                                </div>
                            </div>
                            <div className="mt-2 flex flex-col sm:flex-row gap-2 w-full">
                              <button 
                                  onClick={() => {
                                    const latOrigem = (origemUser?.lat && origemUser.lat !== 0) ? origemUser.lat : -1.4558;
                                    const lngOrigem = (origemUser?.lng && origemUser.lng !== 0) ? origemUser.lng : -48.4908;
                                    
                                    const latDestino = (o.deliveryLat && o.deliveryLat !== 0) 
                                      ? o.deliveryLat 
                                      : ((destinoUser?.lat && destinoUser.lat !== 0) ? destinoUser.lat : (latOrigem ? latOrigem + 0.0045 : -1.4552));
                                    
                                    const lngDestino = (o.deliveryLng && o.deliveryLng !== 0) 
                                      ? o.deliveryLng 
                                      : ((destinoUser?.lng && destinoUser.lng !== 0) ? destinoUser.lng : (lngOrigem ? lngOrigem + 0.0045 : -48.4902));

                                    const driverLat = (currentUser?.lat && currentUser.lat !== 0) ? currentUser.lat : latOrigem - 0.003;
                                    const driverLng = (currentUser?.lng && currentUser.lng !== 0) ? currentUser.lng : lngOrigem - 0.003;

                                    setMapModal({
                                      open: true,
                                      origem: { lat: latOrigem, lng: lngOrigem, name: o.lojaNome || origemUser?.name || 'Retirada' },
                                      destino: { lat: latDestino, lng: lngDestino, name: o.clienteNome || destinoUser?.name || 'Entrega' },
                                      motorista: { lat: driverLat, lng: driverLng, name: currentUser?.name || 'Seu Veículo', veiculo: currentUser?.veiculo || 'Caminhão' }
                                    });
                                  }} 
                                  className="flex-1 text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/30 p-2.5 rounded-xl font-bold text-center transition border border-blue-200 dark:border-blue-800/80 flex items-center justify-center gap-1.5 text-xs shadow-sm"
                              >
                                  🗺️ Ver Mapa ({(o.distancia || 0).toFixed(1)} km)
                              </button>
                              
                              {origemUser?.lat ? (
                                <a 
                                  href={`https://www.google.com/maps/dir/?api=1&destination=${origemUser.lat},${origemUser.lng}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex-1 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs transition flex items-center justify-center gap-1.5 shadow-sm text-center"
                                >
                                  🚀 GPS p/ Retirada
                                </a>
                              ) : (
                                <a 
                                  href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(origemUser?.name || o.lojaNome || 'Origem, Belém')}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex-1 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs transition flex items-center justify-center gap-1.5 shadow-sm text-center"
                                >
                                  🚀 GPS p/ Retirada
                                </a>
                              )}

                              {(() => {
                                const latOrig = origemUser?.lat || 0;
                                const lngOrig = origemUser?.lng || 0;
                                const latDest = o.deliveryLat || destinoUser?.lat;
                                const lngDest = o.deliveryLng || destinoUser?.lng;

                                const hasDistinctDest = latDest && lngDest && (Math.abs(latDest - latOrig) > 0.0001 || Math.abs(lngDest - lngOrig) > 0.0001);
                                const destAddress = o.deliveryAddress || destinoUser?.endereco || destinoUser?.bairro || o.clienteNome || 'Destino';

                                const mapsUrl = hasDistinctDest
                                  ? `https://www.google.com/maps/dir/?api=1&destination=${latDest},${lngDest}`
                                  : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destAddress)}`;

                                return (
                                  <>
                                    <a 
                                      href={mapsUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex-1 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 font-bold p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-900/40 text-xs transition flex items-center justify-center gap-1.5 shadow-sm text-center"
                                    >
                                      🏁 GPS p/ Destino
                                    </a>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const compradorUser = (o as any).buyerId ? store.users[(o as any).buyerId] : (o.destinoId ? store.users[o.destinoId] : null);
                                        const vendedorUser = o.origemId ? store.users[o.origemId] : null;
                                        const targetOther = compradorUser || vendedorUser;
                                        setChatModalData({
                                          open: true,
                                          orderId: o.id,
                                          otherName: targetOther?.name || o.clienteNome || 'Comprador/Vendedor',
                                          otherPhone: (targetOther as any)?.phone || targetOther?.telefone || '',
                                          otherRole: compradorUser ? 'Comprador' : 'Vendedor'
                                        });
                                      }}
                                      className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold p-2.5 rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow-sm text-center"
                                    >
                                      💬 Chat & 📞 Voz
                                    </button>
                                  </>
                                );
                              })()}
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2 mb-3">
                           {o.createdAt && <span className="text-[9px] bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-2 py-0.5 rounded font-bold">🕒 Pedido: {new Date(o.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>}
                           {o.acceptedAt && <span className="text-[9px] bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded font-bold">👨‍🍳 Aceito: {new Date(o.acceptedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>}
                           {o.readyAt && <span className="text-[9px] bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-2 py-0.5 rounded font-bold">🛎️ Pronto: {new Date(o.readyAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>}
                           {o.pickedUpAt && <span className="text-[9px] bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded font-bold">📦 Retirada: {new Date(o.pickedUpAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>}
                           {o.deliveredAt && <span className="text-[9px] bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 px-2 py-0.5 rounded font-bold">📍 Chegou: {new Date(o.deliveredAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>}
                           {o.receivedAt && <span className="text-[9px] bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 px-2 py-0.5 rounded font-bold">✅ Recebido: {new Date(o.receivedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>}
                        </div>
                        
                        {o.status === 'em_rota' ? (
                            <div className="flex gap-2 w-full">
                                <button onClick={() => { if(confirm('Deseja cancelar este transporte?')) store.acaoPedido(o.id, 'cancelar_pedido'); }} className="bg-red-100 hover:bg-red-200 text-red-700 text-xs font-bold px-3 py-3 rounded-lg transition">❌ Cancelar</button>
                                {!o.pickedUpAt ? (
                                  <button onClick={() => store.acaoPedido(o.id, 'retirar_pedido')} className="flex-1 bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold py-3 rounded-lg shadow transition flex items-center justify-center gap-1.5">
                                    🏪 Confirmar Chegada na Loja
                                  </button>
                                ) : (
                                  <button onClick={() => store.acaoPedido(o.id, 'conf_motorista')} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold py-3 rounded-lg shadow transition flex items-center justify-center gap-1.5">
                                    🏁 Confirmar Chegada no Destino
                                  </button>
                                )}
                            </div>
                        ) : o.status === 'aguardando_cliente' ? (
                            <div className="bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-800 p-4 rounded-xl flex flex-col gap-3 shadow-inner">
                                <p className="text-xs text-center font-bold">Peça o PIN de Segurança à Loja</p>
                                <div className="flex gap-2">
                                    <input 
                                        type="text" 
                                        maxLength={4} 
                                        placeholder="0000" 
                                        value={pinInputs[o.id] || ''} 
                                        onChange={e => setPinInputs(prev => ({...prev, [o.id]: e.target.value}))}
                                        className="w-20 text-center font-bold tracking-widest text-lg p-2 rounded-lg border border-orange-300 dark:border-orange-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-orange-500"
                                    />
                                    <button 
                                        onClick={() => store.acaoPedido(o.id, 'validar_pin', pinInputs[o.id])} 
                                        className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 rounded-lg transition shadow-md"
                                    >
                                        Validar e Finalizar
                                    </button>
                                </div>
                            </div>
                        ) : o.status === 'entregue' || o.status === 'arquivado' ? (
                            <div className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800 text-xs p-3 rounded-xl flex flex-col gap-2 items-center font-bold">
                                <p>✅ Frete Concluído</p>
                                {o.payoutDriverDone ? (
                                  <span className="text-[10px] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-bold px-2 py-1 rounded border border-emerald-200 dark:border-emerald-800/60 shadow-sm flex items-center gap-1">
                                    ✅ Repasse Efetuado (R$ {getDriverFee(o).toFixed(2)})
                                  </span>
                                ) : (
                                  <button 
                                    type="button"
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      const isRealUuid = (id?: string) => !!id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
                                      const targetPixKey = (currentUser?.pixKey && !isRealUuid(currentUser.pixKey))
                                         ? currentUser.pixKey
                                         : (isRealUuid(currentUser?.asaasWalletId) ? currentUser.asaasWalletId : (currentUser?.cpfCnpj || currentUser?.asaasWalletId));
                                      const valorEntrega = getDriverFee(o);
                                      if (!targetPixKey) {
                                        alert("Cadastre seu CPF, CNPJ ou Chave Pix em seu perfil para receber o frete.");
                                        return;
                                      }
                                      try {
                                        const res = await fetch('/api/asaas/transfer', {
                                          method: 'POST',
                                          headers: { 'Content-Type': 'application/json', 'x-internal-secret': process.env.NEXT_PUBLIC_INTERNAL_API_SECRET || '' },
                                          body: JSON.stringify({
                                            pixKey: targetPixKey,
                                            value: valorEntrega,
                                            description: `Repasse Frete B2B AçaíFood #${o.id.substring(0, 8)}`,
                                            orderId: o.id
                                          })
                                        });
                                        const data = await res.json();
                                        if (data.success) {
                                          alert(`✅ Repasse Pix de R$ ${valorEntrega.toFixed(2)} enviado para sua conta!`);
                                          o.payoutDriverDone = true;
                                          const { supabase } = await import('@/lib/supabase');
                                          await supabase.from('orders').update({ payout_driver_done: true }).eq('id', o.id);
                                          store.fetchOrders(currentUser.id, true);
                                        } else {
                                          const msg = data.error || '';
                                          alert(`Status do Repasse Asaas: ${msg || 'Não foi possível processar a transferência.'}`);
                                        }
                                      } catch(err) {
                                        alert("Erro ao solicitar repasse Pix.");
                                      }
                                    }}
                                    className="text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2 py-1 rounded transition shadow-sm"
                                  >
                                    💸 Resgatar Repasse (R$ {getDriverFee(o).toFixed(2)})
                                  </button>
                                )}
                            </div>
                        ) : null}
                    </div>
                  )})}
                </div>
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

      {currentUser && (
        <OrderChatModal
          isOpen={chatModalData.open}
          onClose={() => setChatModalData({ open: false, orderId: "" })}
          orderId={chatModalData.orderId}
          currentUserId={currentUser.id}
          currentUserName={currentUser.name}
          currentUserRole="caminhoneiro"
          otherParticipantName={chatModalData.otherName}
          otherParticipantPhone={chatModalData.otherPhone}
          otherParticipantRole={chatModalData.otherRole}
        />
      )}
    </div>
  );
}
