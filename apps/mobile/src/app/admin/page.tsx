"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Settings, Trash2 } from "lucide-react";
import { useAppStore, Order } from "@/store/useAppStore";
import { MapModal } from "@/components/MapModal";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function AdminDashboard() {
  const store = useAppStore();
  const formatMoney = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const [mapModal, setMapModal] = useState<{ open: boolean; origem: string; destino: string; motorista?: string | null }>({ open: false, origem: '', destino: '' });
  const [ratesModalOpen, setRatesModalOpen] = useState(false);
  const [localRates, setLocalRates] = useState(store.rates);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'usuarios' | 'pedidos' | 'cidades'>('dashboard');
  const [newCityName, setNewCityName] = useState('');
  
  const [userFilterRole, setUserFilterRole] = useState<string>('all');
  const [userFilterText, setUserFilterText] = useState<string>('');
  
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [newAdminPassword, setNewAdminPassword] = useState('');

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    if (store.currentUser?.role === 'admin') {
       store.fetchAllUsers();
       store.startRealtime();
    }
  }, [store.currentUser?.role]);

  const filteredUsers = Object.values(store.users).filter(u => {
    if (userFilterRole !== 'all' && u.role !== userFilterRole) return false;
    const search = userFilterText.toLowerCase();
    if (search && !u.name.toLowerCase().includes(search) && !u.email?.toLowerCase().includes(search) && !u.bairro?.toLowerCase().includes(search)) return false;
    return true;
  });

  const router = useRouter();

  if (!mounted) {
    return <div className="min-h-screen flex items-center justify-center p-6"><p>Carregando...</p></div>;
  }

  if (!store.currentUser || store.currentUser.role !== 'admin') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-2xl font-bold mb-4">Acesso Restrito</h1>
        <p className="text-zinc-500 mb-6">Você precisa estar logado como Administrador para acessar esta página.</p>
        <button onClick={() => router.push('/login')} className="bg-purple-600 text-white px-6 py-3 rounded-xl font-bold">Ir para Login</button>
      </div>
    );
  }

  const concluidos = store.orders.filter(o => o.status === 'entregue' || o.status === 'arquivado');
  const getDynamicTaxes = (o: Order) => {
    let repasseLoja = 0, repasseForn = 0, repasseMoto = 0, platVenda = 0, platEntrega = 0, entregaTotal = 0;
    const dist = o.distancia;
    
    if (o.type === 'B2C') {
        entregaTotal = o.taxas?.entregaTotal || (store.rates.courier_payment_mode === 'FIXED' ? (store.rates.courier_fixed_fee ?? 8) : dist * store.rates.b2c_km);
        const sub = (o.lojaId ? store.users[o.lojaId]?.freteSubsidyPct || 0 : 0) / 100;
        const freteLoja = entregaTotal * sub;
        
        platVenda = o.valor * (store.rates.b2c_plat / 100);
        platEntrega = entregaTotal * (store.rates.b2c_mot_plat / 100);
        
        repasseLoja = o.valor - platVenda - freteLoja;
        repasseMoto = entregaTotal - platEntrega;
    } else if (o.type === 'B2B') {
        entregaTotal = o.taxas?.entregaTotal || (store.rates.transporter_payment_mode === 'FIXED' ? (store.rates.transporter_fixed_fee ?? 150) : dist * store.rates.b2b_km);
        const sub = (o.fornecedorId ? store.users[o.fornecedorId]?.freteSubsidyPct || 0 : 0) / 100;
        const freteForn = entregaTotal * sub;
        
        platVenda = o.valor * (store.rates.b2b_plat / 100);
        platEntrega = entregaTotal * (store.rates.b2b_mot_plat / 100);
        
        repasseForn = o.valor - platVenda - freteForn;
        repasseMoto = entregaTotal - platEntrega;
    } else if (o.type === 'COLETA') {
        entregaTotal = o.taxas?.entregaTotal || (store.rates.ecopoint_payment_mode === 'FIXED' ? (store.rates.ecopoint_fixed_fee ?? 50) : dist * store.rates.col_km);
        platEntrega = entregaTotal * (store.rates.col_mot_plat / 100);
        repasseMoto = entregaTotal - platEntrega;
    }
    
    return { repasseLoja, repasseForn, repasseMoto, platVenda, platEntrega, entregaTotal };
  };

  const isMoto = (motId: string | null) => { const m = motId ? store.users[motId] : null; return m && m.veiculo === 'Moto'; };
  const isCaminhao = (motId: string | null) => { const m = motId ? store.users[motId] : null; return m && (m.veiculo === 'Caminhão' || m.veiculo === 'Caçamba'); };

  let totaisVendas = 0;
  let totaisFretes = 0;
  let fatLiqBatedeiras = 0;
  let fatBrutoBatedeiras = 0;
  let fatLiqMotos = 0;
  let fatBrutoMotos = 0;
  let fatLiqCaminhoes = 0;
  let fatBrutoCaminhoes = 0;
  let fatLiqFornecedores = 0;
  let fatBrutoFornecedores = 0;
  let movimentacaoTotal = 0;

  concluidos.forEach(o => {
      const dyn = getDynamicTaxes(o);
      totaisVendas += dyn.platVenda;
      totaisFretes += dyn.platEntrega;
      movimentacaoTotal += (o.valor || 0) + dyn.entregaTotal;
      
      if (o.type === 'B2C') {
          fatLiqBatedeiras += dyn.repasseLoja;
          fatBrutoBatedeiras += (o.valor || 0);
      } else if (o.type === 'B2B') {
          fatLiqFornecedores += dyn.repasseForn;
          fatBrutoFornecedores += (o.valor || 0);
      }
      
      if (isMoto(o.motoristaId)) {
          fatLiqMotos += dyn.repasseMoto;
          fatBrutoMotos += dyn.entregaTotal;
      } else if (isCaminhao(o.motoristaId)) {
          fatLiqCaminhoes += dyn.repasseMoto;
          fatBrutoCaminhoes += dyn.entregaTotal;
      }
  });

  const totais = {
      pedidos: store.orders.length,
      aceitos: store.orders.filter(o => ['preparo', 'em_rota', 'entregue'].includes(o.status)).length,
      cancelados: store.orders.filter(o => o.status === 'cancelado').length,
      concluidos: concluidos.length,
      emRota: store.orders.filter(o => o.status === 'em_rota').length,
      receitaVendas: totaisVendas,
      receitaFretes: totaisFretes
  };

  const handleSaveRates = () => {
    store.saveRates(localRates);
    setRatesModalOpen(false);
    alert("Taxas do Triplo Split atualizadas com sucesso!");
  };

  const handleClearData = () => {
    if (!store.clearPassword) {
       const newPwd = prompt("Crie uma senha de segurança para habilitar o botão Limpar:");
       if (newPwd) {
          store.setClearPassword(newPwd);
          alert("Senha de segurança criada! Clique em Limpar novamente para prosseguir.");
       }
       return;
    }

    const pwd = prompt("Digite a senha de segurança para limpar o banco de dados:");
    if (pwd === null) return; // User cancelled
    
    if (pwd !== store.clearPassword) {
       alert("Senha incorreta!");
       return;
    }

    if (confirm("🚨 ATENÇÃO: Tem certeza que deseja apagar DEFINITIVAMENTE todos os pedidos do banco de dados?")) {
      store.clearData();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 pb-24">
      <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 p-4 sticky top-0 z-30">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 max-w-7xl mx-auto w-full">
          <div className="flex items-center gap-3">
            <Settings className="text-purple-600" />
            <h1 className="text-xl font-bold text-zinc-900 dark:text-white">Admin: AçaíFood</h1>
          </div>
          <div className="flex flex-wrap gap-2 items-center justify-start sm:justify-end">
              <button onClick={() => window.location.reload()} className="text-xs bg-indigo-100 hover:bg-indigo-200 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 shadow-sm transition-all">🔄 Atualizar</button>
              <button onClick={() => { if(navigator.share) { navigator.share({title: 'AçaíFood', text: 'Conheça o AçaíFood!', url: window.location.origin}) } else { alert('Seu navegador não suporta compartilhamento.') } }} className="text-[10px] bg-purple-100 hover:bg-purple-200 text-purple-700 px-2 py-1.5 rounded-lg font-bold shadow-sm transition-all">📲 Compartilhar</button>
              <ThemeToggle />
              <button onClick={() => setPasswordModalOpen(true)} className="bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 px-3 py-1.5 rounded-xl font-bold flex items-center gap-2 transition text-xs">
                  🔑 Senha
              </button>
              <button onClick={() => setRatesModalOpen(true)} className="bg-purple-800 hover:bg-purple-900 text-white px-3 py-1.5 rounded-xl font-bold shadow flex items-center gap-2 transition text-xs">
                  ⚙️ Taxas
              </button>
              <button onClick={handleClearData} className="bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1.5 rounded-xl font-bold flex items-center gap-2 transition text-xs">
                  <Trash2 size={14} /> Limpar
              </button>
              <button onClick={() => { store.logout(); router.push('/login'); }} className="text-sm font-bold text-red-600 hover:text-red-800 ml-1 underline">Sair</button>
          </div>
        </div>
      </header>

      <div className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 mb-6">
          <button onClick={() => setActiveTab('dashboard')} className={`py-4 px-2 font-bold text-sm border-b-2 transition whitespace-nowrap ${activeTab === 'dashboard' ? 'border-purple-600 text-purple-600' : 'border-transparent text-zinc-500 hover:text-zinc-800'}`}>📊 Visão Geral</button>
          <button onClick={() => setActiveTab('usuarios')} className={`py-4 px-2 font-bold text-sm border-b-2 transition whitespace-nowrap ${activeTab === 'usuarios' ? 'border-purple-600 text-purple-600' : 'border-transparent text-zinc-500 hover:text-zinc-800'}`}>👥 Usuários</button>
          <button onClick={() => setActiveTab('pedidos')} className={`py-4 px-2 font-bold text-sm border-b-2 transition whitespace-nowrap ${activeTab === 'pedidos' ? 'border-purple-600 text-purple-600' : 'border-transparent text-zinc-500 hover:text-zinc-800'}`}>🛒 Histórico de Pedidos</button>
          <button onClick={() => setActiveTab('cidades')} className={`py-4 px-2 font-bold text-sm border-b-2 transition whitespace-nowrap ${activeTab === 'cidades' ? 'border-purple-600 text-purple-600' : 'border-transparent text-zinc-500 hover:text-zinc-800'}`}>🌍 Cidades / Expansão</button>
        </div>

      <main className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
        
        {activeTab === 'dashboard' && (
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl shadow-sm border border-zinc-100 dark:border-zinc-800">
                <p className="text-zinc-500 dark:text-zinc-400 text-[11px] uppercase font-bold">Volume Total</p>
                <p className="text-xl font-bold text-zinc-900 dark:text-white">{totais.pedidos}</p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/10 p-4 rounded-xl shadow-sm border border-green-200 dark:border-green-900/50">
                <p className="text-green-700 dark:text-green-500 text-[11px] uppercase font-bold">Aceitos</p>
                <p className="text-xl font-bold text-green-700 dark:text-green-400">{totais.aceitos}</p>
            </div>
            <div className="bg-red-50 dark:bg-red-900/10 p-4 rounded-xl shadow-sm border border-red-200 dark:border-red-900/50">
                <p className="text-red-700 dark:text-red-500 text-[11px] uppercase font-bold">Cancelados</p>
                <p className="text-xl font-bold text-red-700 dark:text-red-400">{totais.cancelados}</p>
            </div>
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl shadow-sm border border-zinc-100 dark:border-zinc-800">
                <p className="text-zinc-500 dark:text-zinc-400 text-[11px] uppercase font-bold">Em Logística</p>
                <p className="text-xl font-bold text-purple-600 dark:text-purple-400">{totais.emRota}</p>
            </div>
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl shadow-sm border border-zinc-100 dark:border-zinc-800">
                <p className="text-zinc-500 dark:text-zinc-400 text-[11px] uppercase font-bold">Concluídos</p>
                <p className="text-xl font-bold text-zinc-800 dark:text-zinc-200">{totais.concluidos}</p>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/10 p-4 rounded-xl shadow-sm border border-purple-200 dark:border-purple-900/50">
                <p className="text-purple-700 dark:text-purple-400 text-[11px] uppercase font-bold">Receita App</p>
                <p className="text-xl font-bold text-purple-800 dark:text-purple-300">{formatMoney(totais.receitaVendas + totais.receitaFretes)}</p>
            </div>
        </div>

        <div className="bg-gradient-to-r from-indigo-900 to-purple-800 text-white p-6 rounded-xl shadow-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
                <h3 className="text-lg font-bold flex items-center gap-2">🌍 Movimentação Total da Cadeia do Açaí</h3>
                <p className="text-purple-200 text-xs mt-1">Volume Financeiro Total (Produto + Frete transacionados com sucesso)</p>
            </div>
            <div className="text-left sm:text-right">
                <p className="text-4xl font-extrabold text-green-400">{formatMoney(movimentacaoTotal)}</p>
            </div>
        </div>

        <h3 className="font-bold text-lg text-zinc-700 dark:text-zinc-200 mt-6 border-b border-zinc-200 dark:border-zinc-800 pb-2">💰 Faturamento dos Parceiros (Bruto x Líquido)</h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Fornecedores */}
            <div className="bg-emerald-50 dark:bg-emerald-900/10 p-5 rounded-xl shadow-sm border border-emerald-200 dark:border-emerald-900 flex flex-col justify-center">
                <p className="text-emerald-800 dark:text-emerald-400 text-sm font-bold flex items-center justify-center gap-1 mb-3"><span>👨🌾</span> Fornecedores</p>
                <div className="flex justify-between items-center w-full">
                    <div><p className="text-[10px] text-emerald-600 dark:text-emerald-500 uppercase font-bold">Bruto</p><p className="text-lg font-bold text-emerald-900 dark:text-emerald-100">{formatMoney(fatBrutoFornecedores)}</p></div>
                    <div className="text-right"><p className="text-[10px] text-green-600 dark:text-green-500 uppercase font-bold">Líquido</p><p className="text-lg font-bold text-green-700 dark:text-green-400">{formatMoney(fatLiqFornecedores)}</p></div>
                </div>
            </div>
            
            {/* Batedeiras */}
            <div className="bg-indigo-50 dark:bg-indigo-900/10 p-5 rounded-xl shadow-sm border border-indigo-200 dark:border-indigo-900 flex flex-col justify-center">
                <p className="text-indigo-800 dark:text-indigo-400 text-sm font-bold flex items-center justify-center gap-1 mb-3"><span>🏪</span> Batedeiras</p>
                <div className="flex justify-between items-center w-full">
                    <div><p className="text-[10px] text-indigo-500 uppercase font-bold">Bruto</p><p className="text-lg font-bold text-indigo-900 dark:text-indigo-100">{formatMoney(fatBrutoBatedeiras)}</p></div>
                    <div className="text-right"><p className="text-[10px] text-green-600 dark:text-green-500 uppercase font-bold">Líquido</p><p className="text-lg font-bold text-green-700 dark:text-green-400">{formatMoney(fatLiqBatedeiras)}</p></div>
                </div>
            </div>
            
            {/* Motoboys */}
            <div className="bg-amber-50 dark:bg-amber-900/10 p-5 rounded-xl shadow-sm border border-amber-200 dark:border-amber-900 flex flex-col justify-center">
                <p className="text-amber-800 dark:text-amber-400 text-sm font-bold flex items-center justify-center gap-1 mb-3"><span>🛵</span> Motociclistas</p>
                <div className="flex justify-between items-center w-full">
                    <div><p className="text-[10px] text-amber-600 dark:text-amber-500 uppercase font-bold">Frete Bruto</p><p className="text-lg font-bold text-amber-900 dark:text-amber-100">{formatMoney(fatBrutoMotos)}</p></div>
                    <div className="text-right"><p className="text-[10px] text-green-600 dark:text-green-500 uppercase font-bold">Líquido</p><p className="text-lg font-bold text-green-700 dark:text-green-400">{formatMoney(fatLiqMotos)}</p></div>
                </div>
            </div>
            
            {/* Caminhões */}
            <div className="bg-blue-50 dark:bg-blue-900/10 p-5 rounded-xl shadow-sm border border-blue-200 dark:border-blue-900 flex flex-col justify-center">
                <p className="text-blue-800 dark:text-blue-400 text-sm font-bold flex items-center justify-center gap-1 mb-3"><span>🚚</span> Caminhões</p>
                <div className="flex justify-between items-center w-full">
                    <div><p className="text-[10px] text-blue-500 uppercase font-bold">Frete Bruto</p><p className="text-lg font-bold text-blue-900 dark:text-blue-100">{formatMoney(fatBrutoCaminhoes)}</p></div>
                    <div className="text-right"><p className="text-[10px] text-green-600 dark:text-green-500 uppercase font-bold">Líquido</p><p className="text-lg font-bold text-green-700 dark:text-green-400">{formatMoney(fatLiqCaminhoes)}</p></div>
                </div>
            </div>
          </div>
          </div>
        )}

        {activeTab === 'pedidos' && (
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
            <h3 className="font-bold text-lg text-zinc-700 dark:text-zinc-200 border-b border-zinc-200 dark:border-zinc-800 pb-2">🛒 Gestão de Pedidos</h3>
            <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-x-auto">
                <table className="w-full text-left text-sm min-w-max">
                <thead className="bg-zinc-50 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800">
                    <tr><th className="p-4">ID / Rota</th><th className="p-4">Tipo</th><th className="p-4">Valores</th><th className="p-4">Atores</th><th className="p-4">Status</th></tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {store.orders.map(o => (
                        <tr key={o.id} className={`hover:bg-zinc-50 dark:hover:bg-zinc-800/50 ${o.status === 'cancelado' ? 'opacity-50' : ''}`}>
                            <td className="p-4 font-bold text-zinc-800 dark:text-zinc-200">
                                {o.id}<br/>
                                <button onClick={() => setMapModal({ open: true, origem: o.origemId, destino: o.destinoId, motorista: o.motoristaId })} className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline">🗺️ Ver {o.distancia.toFixed(1)} km</button>
                                <div className="mt-1 flex flex-col gap-0.5">
                                    {o.createdAt && <span className="text-[9px] text-zinc-500 font-normal">🕒 {new Date(o.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>}
                                    {o.acceptedAt && <span className="text-[9px] text-purple-500 font-normal">👨‍🍳 {new Date(o.acceptedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>}
                                    {o.readyAt && <span className="text-[9px] text-orange-500 font-normal">🛎️ {new Date(o.readyAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>}
                                    {o.pickedUpAt && <span className="text-[9px] text-blue-500 font-normal">📦 {new Date(o.pickedUpAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>}
                                    {o.deliveredAt && <span className="text-[9px] text-teal-500 font-normal">📍 {new Date(o.deliveredAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>}
                                    {o.receivedAt && <span className="text-[9px] text-green-500 font-normal">✅ {new Date(o.receivedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>}
                                </div>
                            </td>
                            <td className="p-4"><span className="bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded text-[10px] font-bold text-zinc-700 dark:text-zinc-300">{o.type}</span></td>
                            <td className="p-4 text-xs text-zinc-600 dark:text-zinc-400">Prod: {formatMoney(o.valor)}<br/>Frete: {formatMoney(getDynamicTaxes(o).entregaTotal)}</td>
                            <td className="p-4 text-xs text-zinc-500">
                                <span className="block">Cliente: {o.clienteNome || store.users[o.clienteId!]?.name || '—'}</span>
                                <span className="block">Loja: {o.lojaNome || store.users[o.lojaId!]?.name || '—'}</span>
                                <span className="block text-purple-600 dark:text-purple-400 font-medium">Mot: {o.motoristaNome || '---'}</span>
                            </td>
                            <td className="p-4">
                                {o.status === 'pendente' && <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-[10px] font-bold uppercase">Pendente</span>}
                                {o.status === 'preparo' && <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-[10px] font-bold uppercase">Preparo</span>}
                                {o.status === 'em_rota' && <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-[10px] font-bold uppercase">Em Transporte</span>}
                                {o.status === 'aguardando_cliente' && (
                                  <div className="flex flex-col gap-1 items-start">
                                    <span className="bg-teal-100 text-teal-800 px-2 py-1 rounded text-[10px] font-bold uppercase">Aguard. PIN</span>
                                    <button onClick={() => { if(confirm('Forçar baixa manual do pedido? (Use apenas se o cliente perdeu o PIN)')) store.acaoPedido(o.id, 'forcar_baixa'); }} className="bg-zinc-800 hover:bg-black text-white px-2 py-1.5 rounded text-[9px] font-bold w-full transition">Forçar Baixa</button>
                                  </div>
                                )}
                                {(o.status === 'entregue' || o.status === 'arquivado') && <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-[10px] font-bold uppercase">Concluído</span>}
                                {o.status === 'cancelado' && <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-[10px] font-bold uppercase">Cancelado</span>}
                            </td>
                        </tr>
                    ))}
                    {store.orders.length === 0 && (
                        <tr><td colSpan={5} className="text-center p-6 text-zinc-500">Nenhum pedido gerado na plataforma ainda.</td></tr>
                    )}
                </tbody>
            </table>
            </div>
          </div>
        )}

        {activeTab === 'usuarios' && (
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
            <h3 className="font-bold text-lg text-zinc-700 dark:text-zinc-200 border-b border-zinc-200 dark:border-zinc-800 pb-2">👥 Gestão de Usuários e Parceiros</h3>
            
            <div className="flex flex-col sm:flex-row gap-3 mt-4">
            <input type="text" placeholder="Buscar por Nome, E-mail ou Bairro..." value={userFilterText} onChange={e => setUserFilterText(e.target.value)} className="flex-1 border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-purple-500" />
            <select value={userFilterRole} onChange={e => setUserFilterRole(e.target.value)} className="w-full sm:w-auto border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-purple-500">
                <option value="all">Todos os Tipos</option>
                <option value="cliente">Clientes</option>
                <option value="loja">Batedeiras (Lojas)</option>
                <option value="fornecedor">Fornecedores</option>
                <option value="motorista">Motoristas / Logística</option>
            </select>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-x-auto mt-4 mb-10">
            <table className="w-full text-left text-sm min-w-max">
                <thead className="bg-zinc-50 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800">
                    <tr><th className="p-4">Usuário</th><th className="p-4">Contato / Local</th><th className="p-4">Tipo</th><th className="p-4">Status</th><th className="p-4 text-right">Ações</th></tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {filteredUsers.map(u => (
                        <tr key={u.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                            <td className="p-4">
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-2">
                                      <span className="text-xl">{u.icon}</span>
                                      <div>
                                          <p className="font-bold text-zinc-800 dark:text-zinc-200">{u.name}</p>
                                          <p className="text-[10px] text-zinc-500 font-mono">{u.id}</p>
                                      </div>
                                  </div>
                                  {u.role === 'motorista' && (
                                    (() => {
                                      const pendingOrders = store.orders.filter(o => o.motoristaId === u.id && o.status === 'entregue');
                                      const amountOwed = pendingOrders.reduce((acc, curr) => acc + (curr.taxas?.entregaMotorista || getDynamicTaxes(curr).repasseMoto || 0), 0);
                                      if (pendingOrders.length > 0) {
                                        return (
                                          <div className="mt-2 bg-green-50 border border-green-200 p-2 rounded-lg flex items-center justify-between flex-wrap gap-2">
                                            <div className="flex items-center gap-2">
                                              <span className="text-xs font-bold text-green-700">A Pagar: {formatMoney(amountOwed)}</span>
                                              {u.pixKey && <span className="text-[10px] text-zinc-500 bg-zinc-200 px-2 py-0.5 rounded font-mono">PIX: {u.pixKey}</span>}
                                            </div>
                                            <button onClick={() => { if(confirm(`Confirmar o pagamento via Pix de ${formatMoney(amountOwed)} para ${u.name}? O saldo será zerado.`)) store.acaoPedido(u.id, 'pagar_motorista'); }} className="bg-green-600 hover:bg-green-700 text-white text-[10px] font-bold px-2 py-1 rounded shadow-sm">
                                              Pagar e Zerar
                                            </button>
                                          </div>
                                        );
                                      }
                                      return <div className="mt-2 text-[10px] text-zinc-400">Nenhum repasse pendente.</div>;
                                    })()
                                  )}
                                </div>
                            </td>
                            <td className="p-4 text-xs text-zinc-600 dark:text-zinc-400">
                                <div>{u.email || 'Sem e-mail'}</div>
                                <div className="font-bold mt-0.5">{u.bairro || 'Sem bairro'}</div>
                            </td>
                            <td className="p-4">
                                <span className="bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded text-[10px] font-bold text-zinc-700 dark:text-zinc-300 capitalize">{u.role}</span>
                                {u.veiculo && <span className="ml-1 text-[10px] text-zinc-500">({u.veiculo})</span>}
                            </td>
                            <td className="p-4">
                                {!u.status || u.status === 'active' ? <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-[10px] font-bold uppercase">Ativo</span> : 
                                 u.status === 'paused' ? <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-[10px] font-bold uppercase">Pausado</span> : 
                                 <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-[10px] font-bold uppercase">Bloqueado</span>}
                            </td>
                            <td className="p-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                    {u.role !== 'admin' && (
                                        <button onClick={() => store.updateUserStatus(u.id, u.status === 'blocked' ? 'active' : 'blocked')} className={`px-2 py-1.5 text-[10px] font-bold rounded shadow-sm ${u.status === 'blocked' ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'}`}>
                                            {u.status === 'blocked' ? '🔓 Desbloquear' : '🚫 Bloquear'}
                                        </button>
                                    )}
                                    {u.role !== 'admin' && (
                                        <button onClick={() => { if(confirm('Tem certeza que deseja excluir esta conta? Esta ação não pode ser desfeita.')) store.deleteUser(u.id); }} className="px-2 py-1.5 text-[10px] font-bold rounded shadow-sm bg-red-600 text-white hover:bg-red-700 transition">
                                            🗑️
                                        </button>
                                    )}
                                </div>
                            </td>
                        </tr>
                    ))}
                    {filteredUsers.length === 0 && (
                        <tr><td colSpan={5} className="text-center p-6 text-zinc-500">Nenhum usuário encontrado com estes filtros.</td></tr>
                    )}
                </tbody>
            </table>
        </div>
          </div>
        )}

        {activeTab === 'cidades' && (
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
            <h3 className="font-bold text-lg text-zinc-700 dark:text-zinc-200 border-b border-zinc-200 dark:border-zinc-800 pb-2">🌍 Gestão de Cidades e Expansão</h3>
            
            <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-4">
                <h4 className="font-bold mb-3 text-sm">Adicionar Nova Cidade</h4>
                <div className="flex gap-2">
                    <input type="text" value={newCityName} onChange={e => setNewCityName(e.target.value)} placeholder="Ex: Marabá" className="flex-1 border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-purple-500" />
                    <button onClick={() => { if(newCityName) { store.addCity(newCityName); setNewCityName(''); } }} className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl font-bold transition">Adicionar</button>
                </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-x-auto mt-4 mb-10">
                <table className="w-full text-left text-sm min-w-max">
                    <thead className="bg-zinc-50 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800">
                        <tr><th className="p-4">Nome da Cidade</th><th className="p-4">Status</th><th className="p-4 text-right">Ações</th></tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {store.cities.map(c => (
                            <tr key={c.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                                <td className="p-4 font-bold text-zinc-800 dark:text-zinc-200">{c.name}</td>
                                <td className="p-4">
                                    {c.status === 'active' ? <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-[10px] font-bold uppercase">Ativa</span> : <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-[10px] font-bold uppercase">Pausada</span>}
                                </td>
                                <td className="p-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <button onClick={() => store.updateCityStatus(c.id, c.status === 'active' ? 'paused' : 'active')} className={`px-2 py-1.5 text-[10px] font-bold rounded shadow-sm ${c.status === 'active' ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200' : 'bg-green-100 text-green-800 hover:bg-green-200'}`}>
                                            {c.status === 'active' ? 'Pausar' : 'Ativar'}
                                        </button>
                                        <button onClick={() => { if(confirm(`Tem certeza que deseja excluir a cidade ${c.name}?`)) store.deleteCity(c.id); }} className="px-2 py-1.5 text-[10px] font-bold rounded shadow-sm bg-red-600 text-white hover:bg-red-700 transition">
                                            🗑️ Excluir
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {store.cities.length === 0 && (
                            <tr><td colSpan={3} className="text-center p-6 text-zinc-500">Nenhuma cidade cadastrada.</td></tr>
                        )}
                    </tbody>
                </table>
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

      {ratesModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-purple-900 text-white p-5 flex justify-between items-center shrink-0">
                <h3 className="font-bold text-lg">⚙️ Configuração do Triplo Split</h3>
                <button onClick={() => setRatesModalOpen(false)} className="text-white hover:text-red-300 font-bold text-2xl leading-none">&times;</button>
            </div>
            
            <div className="p-6 space-y-6 overflow-y-auto">
              <div className="border-b border-zinc-200 dark:border-zinc-800 pb-4">
                  <h4 className="font-bold text-zinc-700 dark:text-zinc-200 mb-3 flex items-center gap-2"><span>🛵</span> B2C (Açaí Pronto - Motoboy)</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div><label className="text-[10px] uppercase text-zinc-500 font-bold">App na Venda (%)</label><input type="number" value={localRates.b2c_plat} onChange={e => setLocalRates({...localRates, b2c_plat: Number(e.target.value)})} className="w-full border dark:border-zinc-700 bg-transparent rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-purple-500"/></div>
                      <div>
                        <label className="text-[10px] uppercase text-zinc-500 font-bold">Modalidade</label>
                        <select value={localRates.courier_payment_mode || 'KM'} onChange={e => setLocalRates({...localRates, courier_payment_mode: e.target.value as 'KM' | 'FIXED'})} className="w-full border dark:border-zinc-700 bg-transparent rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-purple-500">
                          <option value="KM">Por KM</option>
                          <option value="FIXED">Valor Fixo</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] uppercase text-zinc-500 font-bold">{localRates.courier_payment_mode === 'FIXED' ? 'Frete Fixo (R$)' : 'Valor por KM (R$)'}</label>
                        <input type="number" step="0.1" value={localRates.courier_payment_mode === 'FIXED' ? (localRates.courier_fixed_fee ?? 8) : localRates.b2c_km} onChange={e => setLocalRates(localRates.courier_payment_mode === 'FIXED' ? {...localRates, courier_fixed_fee: Number(e.target.value)} : {...localRates, b2c_km: Number(e.target.value)})} className="w-full border dark:border-zinc-700 bg-transparent rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-purple-500"/>
                      </div>
                      <div><label className="text-[10px] uppercase text-purple-600 font-bold">App no Frete (%)</label><input type="number" value={localRates.b2c_mot_plat} onChange={e => setLocalRates({...localRates, b2c_mot_plat: Number(e.target.value)})} className="w-full border border-purple-300 bg-purple-50 dark:bg-purple-900/20 dark:border-purple-800 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-purple-500"/></div>
                  </div>
              </div>
              <div className="border-b border-zinc-200 dark:border-zinc-800 pb-4">
                  <h4 className="font-bold text-zinc-700 dark:text-zinc-200 mb-3 flex items-center gap-2"><span>🚚</span> B2B (Fruto - Caminhão)</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div><label className="text-[10px] uppercase text-zinc-500 font-bold">App na Venda (%)</label><input type="number" value={localRates.b2b_plat} onChange={e => setLocalRates({...localRates, b2b_plat: Number(e.target.value)})} className="w-full border dark:border-zinc-700 bg-transparent rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-purple-500"/></div>
                      <div>
                        <label className="text-[10px] uppercase text-zinc-500 font-bold">Modalidade</label>
                        <select value={localRates.transporter_payment_mode || 'KM'} onChange={e => setLocalRates({...localRates, transporter_payment_mode: e.target.value as 'KM' | 'FIXED'})} className="w-full border dark:border-zinc-700 bg-transparent rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-purple-500">
                          <option value="KM">Por KM</option>
                          <option value="FIXED">Valor Fixo</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] uppercase text-zinc-500 font-bold">{localRates.transporter_payment_mode === 'FIXED' ? 'Frete Fixo (R$)' : 'Valor por KM (R$)'}</label>
                        <input type="number" step="0.1" value={localRates.transporter_payment_mode === 'FIXED' ? (localRates.transporter_fixed_fee ?? 150) : localRates.b2b_km} onChange={e => setLocalRates(localRates.transporter_payment_mode === 'FIXED' ? {...localRates, transporter_fixed_fee: Number(e.target.value)} : {...localRates, b2b_km: Number(e.target.value)})} className="w-full border dark:border-zinc-700 bg-transparent rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-purple-500"/>
                      </div>
                      <div><label className="text-[10px] uppercase text-purple-600 font-bold">App no Frete (%)</label><input type="number" value={localRates.b2b_mot_plat} onChange={e => setLocalRates({...localRates, b2b_mot_plat: Number(e.target.value)})} className="w-full border border-purple-300 bg-purple-50 dark:bg-purple-900/20 dark:border-purple-800 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-purple-500"/></div>
                  </div>
              </div>
              <div className="pb-2">
                  <h4 className="font-bold text-zinc-700 dark:text-zinc-200 mb-3 flex items-center gap-2"><span>🚛</span> Coleta Log. Reversa (Caroço - EcoPoint)</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-[10px] uppercase text-zinc-500 font-bold">Modalidade</label>
                        <select value={localRates.ecopoint_payment_mode || 'KM'} onChange={e => setLocalRates({...localRates, ecopoint_payment_mode: e.target.value as 'KM' | 'FIXED'})} className="w-full border dark:border-zinc-700 bg-transparent rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-purple-500">
                          <option value="KM">Por KM</option>
                          <option value="FIXED">Valor Fixo</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] uppercase text-zinc-500 font-bold">{localRates.ecopoint_payment_mode === 'FIXED' ? 'Coleta Fixa (R$)' : 'Valor por KM (R$)'}</label>
                        <input type="number" step="0.1" value={localRates.ecopoint_payment_mode === 'FIXED' ? (localRates.ecopoint_fixed_fee ?? 50) : localRates.col_km} onChange={e => setLocalRates(localRates.ecopoint_payment_mode === 'FIXED' ? {...localRates, ecopoint_fixed_fee: Number(e.target.value)} : {...localRates, col_km: Number(e.target.value)})} className="w-full border dark:border-zinc-700 bg-transparent rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-purple-500"/>
                      </div>
                      <div><label className="text-[10px] uppercase text-purple-600 font-bold">App no Frete (%)</label><input type="number" value={localRates.col_mot_plat} onChange={e => setLocalRates({...localRates, col_mot_plat: Number(e.target.value)})} className="w-full border border-purple-300 bg-purple-50 dark:bg-purple-900/20 dark:border-purple-800 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-purple-500"/></div>
                  </div>
              </div>
              <div className="pb-2 border-t border-zinc-200 dark:border-zinc-800 pt-4">
                  <h4 className="font-bold text-zinc-700 dark:text-zinc-200 mb-3 flex items-center gap-2"><span>⏰</span> Fechamento de Caixa (Motoboys)</h4>
                  <div className="grid grid-cols-1 gap-3">
                      <div><label className="text-[10px] uppercase text-zinc-500 font-bold">Horário Programado para Pix</label><input type="time" value={localRates.payout_time || '22:00'} onChange={e => setLocalRates({...localRates, payout_time: e.target.value})} className="w-full sm:w-1/3 border dark:border-zinc-700 bg-transparent rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-purple-500"/></div>
                  </div>
              </div>
            </div>

            <div className="p-5 bg-zinc-50 dark:bg-zinc-900/50 flex justify-end gap-3 border-t border-zinc-200 dark:border-zinc-800">
                <button onClick={() => setRatesModalOpen(false)} className="px-5 py-2.5 text-zinc-600 bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 rounded-xl font-bold transition">Cancelar</button>
                <button onClick={handleSaveRates} className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold transition">Salvar Triplo Split</button>
            </div>
          </div>
        </div>
      )}
      {passwordModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col">
            <div className="bg-zinc-800 text-white p-5 flex justify-between items-center shrink-0">
                <h3 className="font-bold text-lg">🔑 Alterar Senha Admin</h3>
                <button onClick={() => setPasswordModalOpen(false)} className="text-zinc-400 hover:text-white font-bold text-2xl leading-none">&times;</button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs uppercase text-zinc-500 font-bold mb-1 block">Nova Senha</label>
                <input 
                  type="password" 
                  value={newAdminPassword} 
                  onChange={e => setNewAdminPassword(e.target.value)} 
                  className="w-full border dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Digite a nova senha..."
                />
              </div>
            </div>

            <div className="p-5 bg-zinc-50 dark:bg-zinc-900/50 flex justify-end gap-3 border-t border-zinc-200 dark:border-zinc-800">
                <button onClick={() => setPasswordModalOpen(false)} className="px-4 py-2 text-zinc-600 bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 rounded-xl font-bold transition">Cancelar</button>
                <button 
                  onClick={() => {
                    if (newAdminPassword.length < 3) return alert('A senha deve ter pelo menos 3 caracteres.');
                    store.changePassword(store.currentUser!.id, newAdminPassword);
                    setPasswordModalOpen(false);
                    setNewAdminPassword('');
                    alert('Senha alterada com sucesso!');
                  }} 
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold transition"
                >
                  Salvar
                </button>
            </div>
          </div>
        </div>
      )}


    </div>
  );
}
