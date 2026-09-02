"use client";

import React, { useState, useEffect, useMemo, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Settings, Trash2, Search, BookOpen, Zap, ShieldAlert } from "lucide-react";
import { useAppStore, Order, City, getRatesForCity } from "@/store/useAppStore";
import { supabase } from "@/lib/supabase";
import { MapModal, MapPoint } from "@/components/MapModal";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AdminManualModal } from "@/components/AdminManualModal";
import { IncidentReportSection } from "@/components/IncidentReportSection";

const emptySubscribe = () => () => {};

class AdminErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: any }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Admin Dashboard caught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 flex flex-col items-center justify-center p-6 text-center">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 rounded-2xl shadow-xl max-w-lg w-full">
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">Painel de Administração</h2>
            <p className="text-xs text-red-500 font-mono bg-red-50 dark:bg-red-950/40 p-3 rounded-lg border border-red-200 mb-6 text-left overflow-auto max-h-32 break-all">
              {this.state.error?.toString() || 'Erro na renderização dos dados'}
            </p>
            <button 
              onClick={() => { this.setState({ hasError: false }); window.location.reload(); }} 
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-6 py-3 rounded-xl transition w-full shadow-lg"
            >
              🔄 Recarregar Painel
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function AdminDashboardContent() {
  // 1. Instanciar Store e Router
  const store = useAppStore();
  const router = useRouter();

  // 2. TODOS os Hooks de Estado (useState) DEVEM ficar no topo sem retornos antecipados
  const orders = store.orders || [];
  const users = store.users || {};
  const cities = store.cities || [];
  const rates = store.rates || {
    b2c_plat: 0, b2c_km: 0, b2c_mot_plat: 0,
    b2b_plat: 0, b2b_km: 0, b2b_mot_plat: 0,
    col_plat: 0, col_km: 0, col_mot_plat: 0, col_valor: 0,
    payout_time: '22:00',
    courier_payment_mode: 'KM',
    courier_fixed_fee: 0,
    transporter_payment_mode: 'KM',
    transporter_fixed_fee: 0,
    ecopoint_payment_mode: 'KM',
    ecopoint_fixed_fee: 0
  };

  const [mapModal, setMapModal] = useState<{
    open: boolean;
    origem: MapPoint | null;
    destino: MapPoint | null;
    motorista?: MapPoint | null;
  }>({ open: false, origem: null, destino: null, motorista: null });
  const [ratesModalOpen, setRatesModalOpen] = useState(false);
  const [localRates, setLocalRates] = useState(() => rates);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'usuarios' | 'pedidos' | 'cidades' | 'ocorrencias'>('dashboard');
  const [isPayingAll, setIsPayingAll] = useState(false);
  const [payAllProgress, setPayAllProgress] = useState<{ current: number; total: number; name: string } | null>(null);
  const [selectedCityToPay, setSelectedCityToPay] = useState<string>('ALL');
  const [newCityName, setNewCityName] = useState('');
  const [citySearchText, setCitySearchText] = useState<string>('');
  const [userFilterRole, setUserFilterRole] = useState<string>('all');
  const [userFilterText, setUserFilterText] = useState<string>('');
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [pwdModalOpen, setPwdModalOpen] = useState(false);
  const [pwdInputText, setPwdInputText] = useState('');
  const [pwdModalMode, setPwdModalMode] = useState<'create' | 'verify'>('verify');
  const [selectedCityForRates, setSelectedCityForRates] = useState<City | null>(null);
  const [isSavingRates, setIsSavingRates] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [adminManualOpen, setAdminManualOpen] = useState(false);
  const [payingPartnerId, setPayingPartnerId] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<'historical' | 'monthly' | 'daily'>('historical');
  const [adminBalances, setAdminBalances] = useState<{
    historical: any;
    monthly: any;
    daily: any;
  } | null>(null);

  const fetchAdminBalances = async () => {
    try {
      const { data, error } = await supabase.from('admin_balances').select('*');
      if (error) throw error;
      if (data && data.length > 0) {
        const hist = data.find(d => d.id === 'historical');
        const month = data.find(d => d.id === 'monthly');
        const day = data.find(d => d.id === 'daily');
        setAdminBalances({
          historical: hist || null,
          monthly: month || null,
          daily: day || null
        });
      }
    } catch (err) {
      console.warn("Tabela admin_balances não encontrada ou erro ao carregar. Usando cálculo dinâmico local de fallback.", err);
    }
  };

  const handleResetBalance = async (balanceId: 'historical' | 'monthly' | 'daily') => {
    const label = balanceId === 'historical' ? 'Acumulado Histórico' : balanceId === 'monthly' ? 'Balanço Mensal' : 'Balanço Diário';
    if (!confirm(`Tem certeza de que deseja ZERAR o ${label} financeiro?\n\n(Esta ação não afetará os pedidos concluídos, apenas redefinirá os totalizadores na tela)`)) return;

    try {
      const { error } = await supabase.from('admin_balances').update({
        total_orders: 0,
        total_volume: 0,
        app_revenue: 0,
        fornecedores_bruto: 0,
        fornecedores_liquido: 0,
        batedeiras_bruto: 0,
        batedeiras_liquido: 0,
        motoristas_bruto: 0,
        motoristas_liquido: 0,
        caminhoes_bruto: 0,
        caminhoes_liquido: 0
      }).eq('id', balanceId);

      if (error) {
        alert("Erro ao zerar acumulador no banco de dados: " + error.message);
      } else {
        showToast(`✅ ${label} zerado com sucesso!`);
        fetchAdminBalances();
      }
    } catch (err: any) {
      alert("Erro ao atualizar: " + err.message);
    }
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  // Função de pagamento individual de parceiro via Pix
  const pagarParceiro = async (u: any, pendingOrders: Order[], amountOwed: number) => {
    let pixKey = u.pixKey || u.cpfCnpj || u.email;
    if (!pixKey) {
      const inputPix = prompt(`Informe a Chave Pix externa de ${u.name} (CPF, Celular, E-mail ou Aleatória):`);
      if (inputPix && inputPix.trim()) {
        pixKey = inputPix.trim();
      } else {
        showToast(`❌ Operação cancelada: ${u.name} não possui Chave Pix cadastrada.`);
        return;
      }
    }

    if (!confirm(`Confirmar pagamento de ${(amountOwed).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} via Pix para ${u.name}?\n\nChave Pix: ${pixKey}\nPedidos a liquidar: ${pendingOrders.length}`)) return;
    setPayingPartnerId(u.id);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const authHeaders: any = { 
        'Content-Type': 'application/json',
        'x-internal-secret': process.env.NEXT_PUBLIC_INTERNAL_API_SECRET || 'acaifood_2026_@AppS76_seguro'
      };
      if (session?.access_token) {
        authHeaders['Authorization'] = `Bearer ${session.access_token}`;
      }

      const res = await fetch('/api/asaas/transfer', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ 
          pixKey, 
          value: amountOwed, 
          description: `Repasse Manual AçaíFood – ${u.name}` 
        })
      });
      const data = await res.json();
      if (data.success || data.transferId) {
        const field = u.role === 'motorista' ? 'payout_driver_done' : 'payout_seller_done';
        for (const order of pendingOrders) {
          await supabase.from('orders').update({ [field]: true }).eq('id', order.id);
        }
        showToast(`✅ Pix de ${(amountOwed).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} enviado para ${u.name}! (ID: ${data.transferId})`);
        if (store.currentUser?.id && typeof store.fetchOrders === 'function') store.fetchOrders(store.currentUser.id, true);
        fetchAdminBalances();
      } else {
        const errorMsg = data.error || 'Erro desconhecido retornado pelo gateway';
        alert(`❌ Falha no pagamento Asaas para ${u.name}:\n\n${errorMsg}`);
        showToast(`❌ Falha no Pix: ${errorMsg}`);
      }
    } catch (e: any) {
      alert(`❌ Erro de conexão ao disparar Pix para ${u.name}:\n\n${e.message}`);
      showToast(`❌ Erro ao pagar: ${e.message}`);
    } finally {
      setPayingPartnerId(null);
    }
  };

  // Função de Liquidação em Lote para Todos os Parceiros (Geral ou por Cidade)
  const pagarTodosParceiros = async (
    partnersWithOwed: Array<{ user: any; pendingOrders: Order[]; amountOwed: number }>,
    cidadeNome?: string
  ) => {
    if (partnersWithOwed.length === 0) {
      alert(`Não há parceiros com pagamentos pendentes ${cidadeNome ? `em ${cidadeNome}` : 'no momento'}.`);
      return;
    }

    const totalOwedAll = partnersWithOwed.reduce((acc, p) => acc + p.amountOwed, 0);
    const escopoDesc = cidadeNome ? `da cidade de ${cidadeNome}` : 'de TODAS as cidades (Geral)';
    const confirmMsg = `⚡ CONFIRMAR LIQUIDAÇÃO EM LOTE?\n\n` +
      `Escopo: ${escopoDesc}\n` +
      `Total a Liquidar: ${formatMoney(totalOwedAll)}\n` +
      `Quantidade de Parceiros: ${partnersWithOwed.length}\n\n` +
      `O sistema enviará os pagamentos Pix via Asaas para cada parceiro e quitará todos os pedidos correspondentes. Deseja prosseguir?`;

    if (!confirm(confirmMsg)) return;

    setIsPayingAll(true);
    const { data: { session } } = await supabase.auth.getSession();
    const authHeaders: any = { 
      'Content-Type': 'application/json',
      'x-internal-secret': process.env.NEXT_PUBLIC_INTERNAL_API_SECRET || 'acaifood_2026_@AppS76_seguro'
    };
    if (session?.access_token) {
      authHeaders['Authorization'] = `Bearer ${session.access_token}`;
    }

    let successCount = 0;
    let failCount = 0;
    const failureDetails: string[] = [];

    for (let i = 0; i < partnersWithOwed.length; i++) {
      const p = partnersWithOwed[i];
      const u = p.user;
      const pixKey = u.pixKey || u.cpfCnpj || u.email;

      setPayAllProgress({ current: i + 1, total: partnersWithOwed.length, name: u.name });

      if (!pixKey) {
        failCount++;
        failureDetails.push(`${u.name}: Sem Chave Pix`);
        continue;
      }

      try {
        const res = await fetch('/api/asaas/transfer', {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({ 
            pixKey, 
            value: p.amountOwed, 
            description: `Liquidação AçaíFood (${cidadeNome || 'Geral'}) – ${u.name}` 
          })
        });
        const data = await res.json();
        if (data.success || data.transferId) {
          const field = u.role === 'motorista' ? 'payout_driver_done' : 'payout_seller_done';
          for (const order of p.pendingOrders) {
            await supabase.from('orders').update({ [field]: true }).eq('id', order.id);
          }
          successCount++;
        } else {
          failCount++;
          failureDetails.push(`${u.name}: ${data.error || 'Recusado'}`);
        }
      } catch (_err: any) {
        failCount++;
        failureDetails.push(`${u.name}: ${_err.message}`);
      }
    }

    setIsPayingAll(false);
    setPayAllProgress(null);

    if (failCount > 0) {
      alert(`Relatório de Liquidação (${cidadeNome || 'Geral'}):\n\n✅ Sucessos: ${successCount}\n❌ Falhas: ${failCount}\n\nDetalhes:\n${failureDetails.join('\n')}`);
    }

    showToast(`✅ Liquidação concluída (${cidadeNome || 'Geral'}): ${successCount} parceiro(s) pago(s) com sucesso! ${failCount > 0 ? `(${failCount} falha/sem pix)` : ''}`);
    if (store.currentUser?.id && typeof store.fetchOrders === 'function') store.fetchOrders(store.currentUser.id, true);
    fetchAdminBalances();
  };

  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  // 3. Efeitos (useEffect)
  const isAdmin = !!store.currentUser && (
    store.currentUser.role === 'admin' || 
    (store.currentUser.role as string)?.toLowerCase() === 'admin'
  );

  useEffect(() => {
    if (isAdmin) {
       const s = useAppStore.getState();
       if (typeof s.fetchAllUsers === 'function') s.fetchAllUsers();
       if (typeof s.startRealtime === 'function') s.startRealtime();
       if (typeof s.fetchOrders === 'function' && s.currentUser?.id) s.fetchOrders(s.currentUser.id);
       if (typeof s.fetchCities === 'function') s.fetchCities();
       if (typeof s.fetchRates === 'function') s.fetchRates();
       fetchAdminBalances();
    }
  }, [isAdmin]);

  // 4. Funções auxiliares
  const formatMoney = (val?: number | null) => (val ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const safeTime = (dateStr?: string | null) => {
    if (!dateStr) return null;
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return null;
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (_e) {
      return null;
    }
  };

  const filteredUsers = Object.values(users).filter(u => {
    if (!u) return false;
    if (userFilterRole !== 'all' && u.role !== userFilterRole) return false;
    const search = userFilterText.toLowerCase();
    if (search) {
       const nameMatch = (u.name || '').toLowerCase().includes(search);
       const emailMatch = (u.email || '').toLowerCase().includes(search);
       const bairroMatch = (u.bairro || '').toLowerCase().includes(search);
       if (!nameMatch && !emailMatch && !bairroMatch) return false;
    }
    return true;
  });

  const filteredCities = (cities || []).filter(c => {
    if (!c || !c.name) return false;
    if (!citySearchText.trim()) return true;
    return c.name.toLowerCase().includes(citySearchText.toLowerCase().trim());
  });

  // 5. Retornos condicionais ocorrem APENAS APÓS TODOS os Hooks declarados
  if (!mounted) {
    return <div className="min-h-screen flex items-center justify-center p-6"><p>Carregando...</p></div>;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-2xl font-bold mb-4">Acesso Restrito</h1>
        <p className="text-zinc-500 mb-6">Você precisa estar logado como Administrador para acessar esta página.</p>
        <button onClick={() => router.push('/login')} className="bg-purple-600 text-white px-6 py-3 rounded-xl font-bold">Ir para Login</button>
      </div>
    );
  }

  // 6. Cálculos de Dashboard
  const concluidos = orders.filter(o => o && (o.status === 'entregue' || o.status === 'arquivado'));
  
  const getDynamicTaxes = (o: Order) => {
    let repasseLoja = 0, repasseForn = 0, repasseMoto = 0, platVenda = 0, platEntrega = 0, entregaTotal = 0;
    if (!o) return { repasseLoja, repasseForn, repasseMoto, platVenda, platEntrega, entregaTotal };
    
    // Resolve as taxas da cidade de origem do pedido
    const orderCity = (o as any).cidadeOrigem || (o.lojaId && users[o.lojaId] ? users[o.lojaId]?.cidade : undefined);
    const activeRates = getRatesForCity(orderCity, rates, cities);

    const dist = o.distancia || 0;
    
    if (o.type === 'B2C') {
        entregaTotal = o.taxas?.entregaTotal || (activeRates.courier_payment_mode === 'FIXED' ? (activeRates.courier_fixed_fee ?? 8) : dist * (activeRates.b2c_km || 2));
        const sub = (o.lojaId && users[o.lojaId] ? users[o.lojaId]?.freteSubsidyPct || 0 : 0) / 100;
        const freteLoja = entregaTotal * sub;
        
        platVenda = (o.valor || 0) * ((activeRates.b2c_plat || 10) / 100);
        platEntrega = entregaTotal * ((activeRates.b2c_mot_plat || 10) / 100);
        
        repasseLoja = (o.valor || 0) - platVenda - freteLoja;
        repasseMoto = entregaTotal - platEntrega;
    } else if (o.type === 'B2B') {
        entregaTotal = o.taxas?.entregaTotal || (activeRates.transporter_payment_mode === 'FIXED' ? (activeRates.transporter_fixed_fee ?? 150) : dist * (activeRates.b2b_km || 4));
        const sub = (o.fornecedorId && users[o.fornecedorId] ? users[o.fornecedorId]?.freteSubsidyPct || 0 : 0) / 100;
        const freteForn = entregaTotal * sub;
        
        platVenda = (o.valor || 0) * ((activeRates.b2b_plat || 10) / 100);
        platEntrega = entregaTotal * ((activeRates.b2b_mot_plat || 10) / 100);
        
        repasseForn = (o.valor || 0) - platVenda - freteForn;
        repasseMoto = entregaTotal - platEntrega;
    } else if (o.type === 'COLETA') {
        entregaTotal = o.taxas?.entregaTotal || (activeRates.ecopoint_payment_mode === 'FIXED' ? (activeRates.ecopoint_fixed_fee ?? 50) : dist * (activeRates.col_km || 8));
        platEntrega = entregaTotal * ((activeRates.col_mot_plat || 10) / 100);
        repasseMoto = entregaTotal - platEntrega;
    }
    
    return { repasseLoja, repasseForn, repasseMoto, platVenda, platEntrega, entregaTotal };
  };

  const isMoto = (motId?: string | null) => { 
    if (!motId || typeof motId !== 'string') return false;
    const m = users[motId];
    if (!m) return false;
    const roleStr = String(m.role || '').toLowerCase();
    const veicStr = String(m.veiculo || '').toLowerCase();
    return roleStr === 'motoboy' || (roleStr === 'motorista' && (!veicStr || veicStr.includes('moto'))) || veicStr.includes('moto'); 
  };

  const isCaminhao = (motId?: string | null) => { 
    if (!motId || typeof motId !== 'string') return false;
    const m = users[motId];
    if (!m) return false;
    const roleStr = String(m.role || '').toLowerCase();
    const veicStr = String(m.veiculo || '').toLowerCase();
    return roleStr === 'caminhao' || (roleStr === 'motorista' && (veicStr.includes('caminh') || veicStr.includes('caçamb'))) || veicStr.includes('caminh') || veicStr.includes('caçamb'); 
  };

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
      totaisVendas += dyn.platVenda || 0;
      totaisFretes += dyn.platEntrega || 0;
      movimentacaoTotal += (o.valor || 0) + (dyn.entregaTotal || 0);
      
      if (o.type === 'B2C') {
          fatLiqBatedeiras += dyn.repasseLoja || 0;
          fatBrutoBatedeiras += (o.valor || 0);
      } else if (o.type === 'B2B') {
          fatLiqFornecedores += dyn.repasseForn || 0;
          fatBrutoFornecedores += (o.valor || 0);
      }
      
      if (isMoto(o.motoristaId)) {
          fatLiqMotos += dyn.repasseMoto || 0;
          fatBrutoMotos += dyn.entregaTotal || 0;
      } else if (isCaminhao(o.motoristaId)) {
          fatLiqCaminhoes += dyn.repasseMoto || 0;
          fatBrutoCaminhoes += dyn.entregaTotal || 0;
      }
  });

  const getFilteredLocalStats = (period: 'historical' | 'monthly' | 'daily') => {
    let list = concluidos;
    const now = new Date();
    if (period === 'daily') {
      list = concluidos.filter(o => {
        if (!o.createdAt) return false;
        const d = new Date(o.createdAt);
        return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      });
    } else if (period === 'monthly') {
      list = concluidos.filter(o => {
        if (!o.createdAt) return false;
        const d = new Date(o.createdAt);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      });
    }

    let localVendas = 0, localFretes = 0, localMov = 0;
    let localBatBruto = 0, localBatLiq = 0;
    let localFornBruto = 0, localFornLiq = 0;
    let localMotBruto = 0, localMotLiq = 0;
    let localCamBruto = 0, localCamLiq = 0;

    list.forEach(o => {
      const dyn = getDynamicTaxes(o);
      localVendas += dyn.platVenda || 0;
      localFretes += dyn.platEntrega || 0;
      localMov += (o.valor || 0) + (dyn.entregaTotal || 0);

      if (o.type === 'B2C') {
        localBatBruto += o.valor || 0;
        localBatLiq += dyn.repasseLoja || 0;
      } else if (o.type === 'B2B') {
        localFornBruto += o.valor || 0;
        localFornLiq += dyn.repasseForn || 0;
      }

      if (isMoto(o.motoristaId)) {
        localMotBruto += dyn.entregaTotal || 0;
        localMotLiq += dyn.repasseMoto || 0;
      } else if (isCaminhao(o.motoristaId)) {
        localCamBruto += dyn.entregaTotal || 0;
        localCamLiq += dyn.repasseMoto || 0;
      }
    });

    const totalPedidosFiltered = period === 'historical' ? orders.length : list.length;
    const aceitosFiltered = period === 'historical' 
      ? orders.filter(o => o && ['preparo', 'em_rota', 'entregue'].includes(o.status)).length 
      : list.filter(o => o && ['preparo', 'em_rota', 'entregue'].includes(o.status)).length;
    const canceladosFiltered = period === 'historical'
      ? orders.filter(o => o && o.status === 'cancelado').length
      : orders.filter(o => {
          if (o.status !== 'cancelado') return false;
          if (!o.createdAt) return false;
          const d = new Date(o.createdAt);
          if (period === 'daily') {
            return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
          } else {
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
          }
        }).length;

    return {
      ordersCount: totalPedidosFiltered,
      aceitos: aceitosFiltered,
      cancelados: canceladosFiltered,
      concluidosCount: list.length,
      volume: localMov,
      appRev: localVendas + localFretes,
      fornBruto: localFornBruto,
      fornLiq: localFornLiq,
      batBruto: localBatBruto,
      batLiq: localBatLiq,
      motBruto: localMotBruto,
      motLiq: localMotLiq,
      camBruto: localCamBruto,
      camLiq: localCamLiq
    };
  };

  const localStats = getFilteredLocalStats(selectedPeriod);

  const currentOrdersCount = (adminBalances?.[selectedPeriod]?.total_orders && adminBalances[selectedPeriod].total_orders > 0) ? adminBalances[selectedPeriod].total_orders : localStats.ordersCount;
  const currentConcluidosCount = (adminBalances?.[selectedPeriod]?.total_orders && adminBalances[selectedPeriod].total_orders > 0) ? adminBalances[selectedPeriod].total_orders : localStats.concluidosCount;
  const currentAppRevenue = (adminBalances?.[selectedPeriod]?.app_revenue && adminBalances[selectedPeriod].app_revenue > 0) ? adminBalances[selectedPeriod].app_revenue : localStats.appRev;
  const currentVolumeTotal = (adminBalances?.[selectedPeriod]?.total_volume && adminBalances[selectedPeriod].total_volume > 0) ? adminBalances[selectedPeriod].total_volume : localStats.volume;
  
  const currentFornBruto = (adminBalances?.[selectedPeriod]?.fornecedores_bruto && adminBalances[selectedPeriod].fornecedores_bruto > 0) ? adminBalances[selectedPeriod].fornecedores_bruto : localStats.fornBruto;
  const currentFornLiq = (adminBalances?.[selectedPeriod]?.fornecedores_liquido && adminBalances[selectedPeriod].fornecedores_liquido > 0) ? adminBalances[selectedPeriod].fornecedores_liquido : localStats.fornLiq;
  
  const currentBatBruto = (adminBalances?.[selectedPeriod]?.batedeiras_bruto && adminBalances[selectedPeriod].batedeiras_bruto > 0) ? adminBalances[selectedPeriod].batedeiras_bruto : localStats.batBruto;
  const currentBatLiq = (adminBalances?.[selectedPeriod]?.batedeiras_liquido && adminBalances[selectedPeriod].batedeiras_liquido > 0) ? adminBalances[selectedPeriod].batedeiras_liquido : localStats.batLiq;
  
  const currentMotBruto = (adminBalances?.[selectedPeriod]?.motoristas_bruto && adminBalances[selectedPeriod].motoristas_bruto > 0) ? adminBalances[selectedPeriod].motoristas_bruto : localStats.motBruto;
  const currentMotLiq = (adminBalances?.[selectedPeriod]?.motoristas_liquido && adminBalances[selectedPeriod].motoristas_liquido > 0) ? adminBalances[selectedPeriod].motoristas_liquido : localStats.motLiq;
  
  const currentCamBruto = (adminBalances?.[selectedPeriod]?.caminhoes_bruto && adminBalances[selectedPeriod].caminhoes_bruto > 0) ? adminBalances[selectedPeriod].caminhoes_bruto : localStats.camBruto;
  const currentCamLiq = (adminBalances?.[selectedPeriod]?.caminhoes_liquido && adminBalances[selectedPeriod].caminhoes_liquido > 0) ? adminBalances[selectedPeriod].caminhoes_liquido : localStats.camLiq;

  const totais = {
      pedidos: currentOrdersCount,
      aceitos: selectedPeriod === 'historical' ? orders.filter(o => o && ['preparo', 'em_rota', 'entregue'].includes(o.status)).length : localStats.aceitos,
      cancelados: selectedPeriod === 'historical' ? orders.filter(o => o && o.status === 'cancelado').length : localStats.cancelados,
      concluidos: currentConcluidosCount,
      emRota: orders.filter(o => o && o.status === 'em_rota').length,
      receitaVendas: currentAppRevenue,
      receitaFretes: 0
  };

  const partnersWithPendingPayouts = useMemo(() => {
    const list: Array<{ user: any; pendingOrders: Order[]; amountOwed: number }> = [];
    Object.values(users).forEach(u => {
      if (u.role === 'motorista' || u.role === 'loja' || u.role === 'fornecedor') {
        let pendingOrders: Order[] = [];
        let amountOwed = 0;
        if (u.role === 'motorista') {
          pendingOrders = orders.filter(o => o && o.motoristaId === u.id && o.status === 'entregue' && !(o as any).payout_driver_done);
          amountOwed = pendingOrders.reduce((acc, curr) => acc + (curr.taxas?.entregaMotorista || getDynamicTaxes(curr).repasseMoto || 0), 0);
        } else if (u.role === 'loja') {
          pendingOrders = orders.filter(o => o && o.lojaId === u.id && o.status === 'entregue' && !(o as any).payout_seller_done);
          amountOwed = pendingOrders.reduce((acc, curr) => acc + (curr.taxas?.repasse || getDynamicTaxes(curr).repasseLoja || 0), 0);
        } else {
          pendingOrders = orders.filter(o => o && o.fornecedorId === u.id && o.status === 'entregue' && !(o as any).payout_seller_done);
          amountOwed = pendingOrders.reduce((acc, curr) => acc + (curr.taxas?.repasse || getDynamicTaxes(curr).repasseForn || 0), 0);
        }
        if (amountOwed > 0) {
          list.push({ user: u, pendingOrders, amountOwed });
        }
      }
    });
    return list;
  }, [users, orders]);

  const totalOwedAllPartners = useMemo(() => {
    return partnersWithPendingPayouts.reduce((acc, curr) => acc + curr.amountOwed, 0);
  }, [partnersWithPendingPayouts]);

  const pendingPayoutsByCity = useMemo(() => {
    const map: Record<string, { cityName: string; partners: typeof partnersWithPendingPayouts; totalOwed: number }> = {};
    partnersWithPendingPayouts.forEach(item => {
      const rawCity = (item.user.cidade || (item.pendingOrders[0] as any)?.cidade || 'Belém').trim();
      const city = rawCity || 'Belém';
      if (!map[city]) {
        map[city] = { cityName: city, partners: [], totalOwed: 0 };
      }
      map[city].partners.push(item);
      map[city].totalOwed += item.amountOwed;
    });
    return map;
  }, [partnersWithPendingPayouts]);

  const currentActivePartners = useMemo(() => {
    if (selectedCityToPay === 'ALL') {
      return partnersWithPendingPayouts;
    }
    return pendingPayoutsByCity[selectedCityToPay]?.partners || [];
  }, [selectedCityToPay, partnersWithPendingPayouts, pendingPayoutsByCity]);

  const currentActiveOwedTotal = useMemo(() => {
    return currentActivePartners.reduce((acc, curr) => acc + curr.amountOwed, 0);
  }, [currentActivePartners]);

  const handleSaveRates = async () => {
    if (isSavingRates) return;
    setIsSavingRates(true);
    try {
      if (selectedCityForRates) {
        if (typeof store.saveCityRates === 'function') {
          await store.saveCityRates(selectedCityForRates.id, localRates);
        }
        setRatesModalOpen(false);
        showToast(`✅ Taxas de ${selectedCityForRates.name} salvas com sucesso!`);
      } else {
        if (typeof store.saveRates === 'function') {
          await store.saveRates(localRates);
        }
        setRatesModalOpen(false);
        showToast("✅ Taxas Globais salvas com sucesso!");
      }
    } catch (_e) {
      console.error("Erro ao salvar taxas:", _e);
      showToast("❌ Erro ao salvar taxas.");
    } finally {
      setIsSavingRates(false);
    }
  };

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      if (typeof store.fetchAllUsers === 'function') await store.fetchAllUsers();
      if (typeof store.fetchOrders === 'function') {
        const uid = store.currentUser?.id || 'admin';
        await store.fetchOrders(uid);
      }
      if (typeof store.fetchCities === 'function') await store.fetchCities();
      if (typeof store.fetchRates === 'function') await store.fetchRates();
      if (store.rates) setLocalRates(store.rates);
      await fetchAdminBalances();
      showToast("🔄 Painel atualizado com sucesso!");
    } catch (_e) {
      console.error("Erro ao atualizar painel:", _e);
      showToast("❌ Erro ao atualizar painel.");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleClearData = () => {
    setPwdInputText('');
    if (!store.clearPassword) {
       setPwdModalMode('create');
    } else {
       setPwdModalMode('verify');
    }
    setPwdModalOpen(true);
  };

  const handleConfirmPasswordModal = () => {
    if (!pwdInputText) return;
    if (pwdModalMode === 'create') {
       if (typeof store.setClearPassword === 'function') store.setClearPassword(pwdInputText);
       setPwdModalOpen(false);
       setPwdInputText('');
       alert("Senha de segurança criada com sucesso! Clique em Limpar novamente para prosseguir.");
    } else {
       if (pwdInputText !== store.clearPassword) {
          alert("Senha incorreta!");
          return;
       }
       setPwdModalOpen(false);
       setPwdInputText('');
        if (confirm("🚨 ATENÇÃO: Tem certeza que deseja apagar DEFINITIVAMENTE todos os pedidos, mensagens, balanços e registros do banco de dados para recomeçar o sistema do zero?")) {
           if (typeof store.clearData === 'function') {
             store.clearData().then(() => {
               setAdminBalances({
                 historical: { total_orders: 0, total_volume: 0, app_revenue: 0, fornecedores_bruto: 0, fornecedores_liquido: 0, batedeiras_bruto: 0, batedeiras_liquido: 0, motoristas_bruto: 0, motoristas_liquido: 0, caminhoes_bruto: 0, caminhoes_liquido: 0 },
                 monthly: { total_orders: 0, total_volume: 0, app_revenue: 0, fornecedores_bruto: 0, fornecedores_liquido: 0, batedeiras_bruto: 0, batedeiras_liquido: 0, motoristas_bruto: 0, motoristas_liquido: 0, caminhoes_bruto: 0, caminhoes_liquido: 0 },
                 daily: { total_orders: 0, total_volume: 0, app_revenue: 0, fornecedores_bruto: 0, fornecedores_liquido: 0, batedeiras_bruto: 0, batedeiras_liquido: 0, motoristas_bruto: 0, motoristas_liquido: 0, caminhoes_bruto: 0, caminhoes_liquido: 0 }
               });
               showToast("✅ Sistema 100% resetado: Todos os pedidos e acumuladores foram zerados!");
               fetchAdminBalances();
             });
           }
        }
    }
  };


  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 pb-24">
      <AdminManualModal isOpen={adminManualOpen} onClose={() => setAdminManualOpen(false)} />
      {toastMsg && (
        <div className="fixed top-5 right-5 z-[300] bg-zinc-900 text-white border border-zinc-700 px-4 py-3 rounded-xl shadow-xl font-bold flex items-center gap-3 animate-in fade-in slide-in-from-top-3 duration-200">
          <span className="text-sm">{toastMsg}</span>
          <button onClick={() => setToastMsg(null)} className="text-zinc-400 hover:text-white font-bold text-lg leading-none">&times;</button>
        </div>
      )}
      <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 p-4 sticky top-0 z-30">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 max-w-7xl mx-auto w-full">
          <div className="flex items-center gap-3">
            <Settings className="text-purple-600" />
            <h1 className="text-xl font-bold text-zinc-900 dark:text-white">Admin: AçaíFood</h1>
          </div>
          <div className="flex flex-wrap gap-2 items-center justify-start sm:justify-end">
              <button onClick={() => setAdminManualOpen(true)} className="text-xs bg-amber-100 hover:bg-amber-200 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 shadow-sm transition-all">
                <BookOpen size={13} /> Manual
              </button>
              <button disabled={isRefreshing} onClick={handleRefresh} className="text-xs bg-indigo-100 hover:bg-indigo-200 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 shadow-sm transition-all disabled:opacity-50">
                {isRefreshing ? '🔄 Atualizando...' : '🔄 Atualizar'}
              </button>
              <button onClick={() => { if(navigator.share) { navigator.share({title: 'AçaíFood', text: 'Conheça o AçaíFood!', url: window.location.origin}) } else { alert('Seu navegador não suporta compartilhamento.') } }} className="text-[10px] bg-purple-100 hover:bg-purple-200 text-purple-700 px-2 py-1.5 rounded-lg font-bold shadow-sm transition-all">📲 Compartilhar</button>
              <ThemeToggle />
              <button onClick={() => setPasswordModalOpen(true)} className="bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 px-3 py-1.5 rounded-xl font-bold flex items-center gap-2 transition text-xs">
                  🔑 Senha
              </button>
              <button onClick={handleClearData} className="bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1.5 rounded-xl font-bold flex items-center gap-2 transition text-xs">
                  <Trash2 size={14} /> Limpar
              </button>
              <button onClick={() => { if(typeof store.logout === 'function') store.logout(); router.push('/login'); }} className="text-sm font-bold text-red-600 hover:text-red-800 ml-1 underline">Sair</button>
          </div>
        </div>
      </header>

      <div className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 mb-6 flex overflow-x-auto">
          <button onClick={() => setActiveTab('dashboard')} className={`py-4 px-4 font-bold text-sm border-b-2 transition whitespace-nowrap ${activeTab === 'dashboard' ? 'border-purple-600 text-purple-600' : 'border-transparent text-zinc-500 hover:text-zinc-800'}`}>📊 Visão Geral</button>
          <button onClick={() => setActiveTab('usuarios')} className={`py-4 px-4 font-bold text-sm border-b-2 transition whitespace-nowrap ${activeTab === 'usuarios' ? 'border-purple-600 text-purple-600' : 'border-transparent text-zinc-500 hover:text-zinc-800'}`}>👥 Usuários</button>
          <button onClick={() => setActiveTab('pedidos')} className={`py-4 px-4 font-bold text-sm border-b-2 transition whitespace-nowrap ${activeTab === 'pedidos' ? 'border-purple-600 text-purple-600' : 'border-transparent text-zinc-500 hover:text-zinc-800'}`}>🛒 Histórico de Pedidos</button>
          <button onClick={() => setActiveTab('ocorrencias')} className={`py-4 px-4 font-bold text-sm border-b-2 transition whitespace-nowrap ${activeTab === 'ocorrencias' ? 'border-purple-600 text-purple-600' : 'border-transparent text-zinc-500 hover:text-zinc-800'}`}>📋 Ocorrências & Auditoria</button>
          <button onClick={() => setActiveTab('cidades')} className={`py-4 px-4 font-bold text-sm border-b-2 transition whitespace-nowrap ${activeTab === 'cidades' ? 'border-purple-600 text-purple-600' : 'border-transparent text-zinc-500 hover:text-zinc-800'}`}>🌍 Cidades / Expansão</button>
      </div>

      <main className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
        
        {activeTab === 'dashboard' && (
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300 font-medium">
            {/* Seletor de Períodos e Botão Zerar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
              <div className="flex flex-col">
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">🗓️ Balanço do Período</span>
                <div className="flex gap-1.5 bg-zinc-100 dark:bg-zinc-800/60 p-1 rounded-lg mt-1">
                  <button onClick={() => setSelectedPeriod('historical')} className={`py-1.5 px-3 rounded-md text-xs font-bold transition-all ${selectedPeriod === 'historical' ? 'bg-white dark:bg-zinc-900 text-purple-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}>Geral Acumulado</button>
                  <button onClick={() => setSelectedPeriod('monthly')} className={`py-1.5 px-3 rounded-md text-xs font-bold transition-all ${selectedPeriod === 'monthly' ? 'bg-white dark:bg-zinc-900 text-purple-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}>Mensal Parcial</button>
                  <button onClick={() => setSelectedPeriod('daily')} className={`py-1.5 px-3 rounded-md text-xs font-bold transition-all ${selectedPeriod === 'daily' ? 'bg-white dark:bg-zinc-900 text-purple-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}>Diário Parcial</button>
                </div>
              </div>
              <button 
                onClick={() => handleResetBalance(selectedPeriod)}
                className="bg-red-50 hover:bg-red-100 dark:bg-red-950/20 text-red-600 border border-red-200 dark:border-red-900/50 hover:border-red-300 font-bold px-4 py-2 rounded-xl text-xs transition flex items-center gap-1.5 shadow-sm mt-2 sm:mt-0 active:scale-95"
              >
                🗑️ Zerar {selectedPeriod === 'historical' ? 'Acumulado Histórico' : selectedPeriod === 'monthly' ? 'Balanço Mensal' : 'Balanço Diário'}
              </button>
            </div>

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
                <p className="text-xl font-bold text-purple-800 dark:text-purple-300">{formatMoney(totais.receitaVendas)}</p>
            </div>
        </div>

        <div className="bg-gradient-to-r from-indigo-900 to-purple-800 text-white p-6 rounded-xl shadow-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
                <h3 className="text-lg font-bold flex items-center gap-2">🌍 Movimentação Total da Cadeia do Açaí</h3>
                <p className="text-purple-200 text-xs mt-1">Volume Financeiro Total (Produto + Frete transacionados com sucesso)</p>
            </div>
            <div className="text-left sm:text-right">
                <p className="text-4xl font-extrabold text-green-400">{formatMoney(currentVolumeTotal)}</p>
            </div>
        </div>

        <h3 className="font-bold text-lg text-zinc-700 dark:text-zinc-200 mt-6 border-b border-zinc-200 dark:border-zinc-800 pb-2">💰 Faturamento dos Parceiros (Bruto x Líquido)</h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Fornecedores */}
            <div className="bg-emerald-50 dark:bg-emerald-900/10 p-5 rounded-xl shadow-sm border border-emerald-200 dark:border-emerald-900 flex flex-col justify-center">
                <p className="text-emerald-800 dark:text-emerald-400 text-sm font-bold flex items-center justify-center gap-1 mb-3"><span>👨🌾</span> Fornecedores</p>
                <div className="flex justify-between items-center w-full">
                    <div><p className="text-[10px] text-emerald-600 dark:text-emerald-500 uppercase font-bold">Bruto</p><p className="text-lg font-bold text-emerald-900 dark:text-emerald-100">{formatMoney(currentFornBruto)}</p></div>
                    <div className="text-right"><p className="text-[10px] text-green-600 dark:text-green-500 uppercase font-bold">Líquido</p><p className="text-lg font-bold text-green-700 dark:text-green-400">{formatMoney(currentFornLiq)}</p></div>
                </div>
            </div>
            
            {/* Batedeiras */}
            <div className="bg-indigo-50 dark:bg-indigo-900/10 p-5 rounded-xl shadow-sm border border-indigo-200 dark:border-indigo-900 flex flex-col justify-center">
                <p className="text-indigo-800 dark:text-indigo-400 text-sm font-bold flex items-center justify-center gap-1 mb-3"><span>🏪</span> Batedeiras</p>
                <div className="flex justify-between items-center w-full">
                    <div><p className="text-[10px] text-indigo-500 uppercase font-bold">Bruto</p><p className="text-lg font-bold text-indigo-900 dark:text-indigo-100">{formatMoney(currentBatBruto)}</p></div>
                    <div className="text-right"><p className="text-[10px] text-green-600 dark:text-green-500 uppercase font-bold">Líquido</p><p className="text-lg font-bold text-green-700 dark:text-green-400">{formatMoney(currentBatLiq)}</p></div>
                </div>
            </div>
            
            {/* Motoboys */}
            <div className="bg-amber-50 dark:bg-amber-900/10 p-5 rounded-xl shadow-sm border border-amber-200 dark:border-amber-900 flex flex-col justify-center">
                <p className="text-amber-800 dark:text-amber-400 text-sm font-bold flex items-center justify-center gap-1 mb-3"><span>🛵</span> Motociclistas</p>
                <div className="flex justify-between items-center w-full">
                    <div><p className="text-[10px] text-amber-600 dark:text-amber-500 uppercase font-bold">Frete Bruto</p><p className="text-lg font-bold text-amber-900 dark:text-amber-100">{formatMoney(currentMotBruto)}</p></div>
                    <div className="text-right"><p className="text-[10px] text-green-600 dark:text-green-500 uppercase font-bold">Líquido</p><p className="text-lg font-bold text-green-700 dark:text-green-400">{formatMoney(currentMotLiq)}</p></div>
                </div>
            </div>
            
            {/* Caminhões */}
            <div className="bg-blue-50 dark:bg-blue-900/10 p-5 rounded-xl shadow-sm border border-blue-200 dark:border-blue-900 flex flex-col justify-center">
                <p className="text-blue-800 dark:text-blue-400 text-sm font-bold flex items-center justify-center gap-1 mb-3"><span>🚚</span> Caminhões</p>
                <div className="flex justify-between items-center w-full">
                    <div><p className="text-[10px] text-blue-500 uppercase font-bold">Frete Bruto</p><p className="text-lg font-bold text-blue-900 dark:text-blue-100">{formatMoney(currentCamBruto)}</p></div>
                    <div className="text-right"><p className="text-[10px] text-green-600 dark:text-green-500 uppercase font-bold">Líquido</p><p className="text-lg font-bold text-green-700 dark:text-green-400">{formatMoney(currentCamLiq)}</p></div>
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
                    {orders.map(o => (
                        <tr key={o.id} className={`hover:bg-zinc-50 dark:hover:bg-zinc-800/50 ${o.status === 'cancelado' ? 'opacity-50' : ''}`}>
                            <td className="p-4 font-bold text-zinc-800 dark:text-zinc-200">
                                {o.id}<br/>
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
                                  className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline"
                                >
                                  🗺️ Ver {(o.distancia || 0).toFixed(1)} km
                                </button>
                                <div className="mt-1 flex flex-col gap-0.5">
                                    {safeTime(o.createdAt) && <span className="text-[9px] text-zinc-500 font-normal">🕒 {safeTime(o.createdAt)}</span>}
                                    {safeTime(o.acceptedAt) && <span className="text-[9px] text-purple-500 font-normal">👨‍🍳 {safeTime(o.acceptedAt)}</span>}
                                    {safeTime(o.readyAt) && <span className="text-[9px] text-orange-500 font-normal">🛎️ {safeTime(o.readyAt)}</span>}
                                    {safeTime(o.pickedUpAt) && <span className="text-[9px] text-blue-500 font-normal">📦 {safeTime(o.pickedUpAt)}</span>}
                                    {safeTime(o.deliveredAt) && <span className="text-[9px] text-teal-500 font-normal">📍 {safeTime(o.deliveredAt)}</span>}
                                    {safeTime(o.receivedAt) && <span className="text-[9px] text-green-500 font-normal">✅ {safeTime(o.receivedAt)}</span>}
                                </div>
                            </td>
                            <td className="p-4"><span className="bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded text-[10px] font-bold text-zinc-700 dark:text-zinc-300">{o.type}</span></td>
                            <td className="p-4 text-xs text-zinc-600 dark:text-zinc-400">Prod: {formatMoney(o.valor)}<br/>Frete: {formatMoney(getDynamicTaxes(o).entregaTotal)}</td>
                            <td className="p-4 text-xs text-zinc-500">
                                <span className="block">Cliente: {o.clienteNome || (o.clienteId && users[o.clienteId] ? users[o.clienteId]?.name : '') || '—'}</span>
                                <span className="block">Loja: {o.lojaNome || (o.lojaId && users[o.lojaId] ? users[o.lojaId]?.name : '') || '—'}</span>
                                <span className="block text-purple-600 dark:text-purple-400 font-medium">Mot: {o.motoristaNome || '---'}</span>
                            </td>
                            <td className="p-4">
                                {o.status === 'pendente' && <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-[10px] font-bold uppercase">Pendente</span>}
                                {o.status === 'preparo' && <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-[10px] font-bold uppercase">Preparo</span>}
                                {o.status === 'em_rota' && <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-[10px] font-bold uppercase">Em Transporte</span>}
                                {o.status === 'aguardando_cliente' && (
                                  <div className="flex flex-col gap-1 items-start">
                                    <span className="bg-teal-100 text-teal-800 px-2 py-1 rounded text-[10px] font-bold uppercase">Aguard. PIN</span>
                                    <button onClick={() => { if(confirm('Forçar baixa manual do pedido? (Use apenas se o cliente perdeu o PIN)')) if(typeof store.acaoPedido === 'function') store.acaoPedido(o.id, 'forcar_baixa'); }} className="bg-zinc-800 hover:bg-black text-white px-2 py-1.5 rounded text-[9px] font-bold w-full transition">Forçar Baixa</button>
                                  </div>
                                )}
                                {((o as any).status === 'PIN_LOCKED' || (o as any).status === 'bloqueado_pin') && (
                                  <div className="flex flex-col gap-1 items-start">
                                    <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-[10px] font-bold uppercase">PIN Bloqueado</span>
                                    <button onClick={async () => {
                                      if (confirm('Deseja resetar o PIN deste pedido e gerar um novo código?')) {
                                        try {
                                          const { data: newPin, error } = await supabase.rpc('generate_delivery_pin', { p_order_id: o.id });
                                          if (!error) {
                                            alert(`✅ Novo PIN de 4 dígitos gerado com sucesso: ${newPin}`);
                                            store.fetchOrders(store.currentUser?.id || 'admin', true);
                                          } else {
                                            alert(`Erro ao resetar PIN: ${error.message}`);
                                          }
                                        } catch (e: any) {
                                          alert(`Exceção: ${e.message}`);
                                        }
                                      }
                                    }} className="bg-purple-600 hover:bg-purple-700 text-white px-2 py-1.5 rounded text-[9px] font-bold w-full transition">Resetar PIN</button>
                                  </div>
                                )}
                                {(o.status === 'entregue' || o.status === 'arquivado') && <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-[10px] font-bold uppercase">Concluído</span>}
                                {o.status === 'cancelado' && <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-[10px] font-bold uppercase">Cancelado</span>}
                            </td>
                        </tr>
                    ))}
                    {orders.length === 0 && (
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
            
            {/* Card de Liquidação Geral em Lote & Por Cidade */}
            <div className="bg-gradient-to-r from-purple-900/10 via-indigo-900/10 to-purple-900/5 dark:from-purple-950/40 dark:via-indigo-950/40 dark:to-zinc-900 border border-purple-200 dark:border-purple-800/60 p-4 sm:p-5 rounded-2xl flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 shadow-sm">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-950/60 px-2 py-0.5 rounded-md">
                    ⚡ Fechamento Financeiro & Liquidação
                  </span>
                  {selectedCityToPay !== 'ALL' && (
                    <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md">
                      🏙️ Praça: {selectedCityToPay}
                    </span>
                  )}
                </div>

                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white">
                    {formatMoney(currentActiveOwedTotal)}
                  </span>
                  <span className="text-xs text-zinc-500 font-medium">
                    pendente de repasse ({currentActivePartners.length} parceiro(s){selectedCityToPay !== 'ALL' ? ` em ${selectedCityToPay}` : ' no total'})
                  </span>
                </div>

                <p className="text-[11px] text-zinc-500">
                  Liquide todos os pendentes de <strong>uma cidade específica</strong> ou de <strong>todas as cidades de uma só vez</strong>.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full lg:w-auto">
                {/* Seletor de Cidades com Saldos Pendentes */}
                <select
                  value={selectedCityToPay}
                  onChange={(e) => setSelectedCityToPay(e.target.value)}
                  className="bg-white dark:bg-zinc-900 border border-purple-300 dark:border-purple-700 text-xs font-bold text-zinc-800 dark:text-zinc-200 rounded-xl px-3 py-2.5 shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
                >
                  <option value="ALL">🌐 Todas as Cidades ({formatMoney(totalOwedAllPartners)})</option>
                  {Object.values(pendingPayoutsByCity).map(c => (
                    <option key={c.cityName} value={c.cityName}>
                      🏙️ {c.cityName} ({formatMoney(c.totalOwed)} • {c.partners.length} parc.)
                    </option>
                  ))}
                </select>

                {/* Botão de Disparo */}
                {currentActivePartners.length > 0 && (
                  <button
                    disabled={isPayingAll}
                    onClick={() => pagarTodosParceiros(currentActivePartners, selectedCityToPay === 'ALL' ? undefined : selectedCityToPay)}
                    className="bg-purple-600 hover:bg-purple-700 disabled:bg-zinc-400 text-white font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 whitespace-nowrap active:scale-95"
                  >
                    <Zap size={16} className={isPayingAll ? 'animate-spin' : ''} />
                    {isPayingAll 
                      ? (payAllProgress ? `⏳ Pagando ${payAllProgress.current}/${payAllProgress.total} (${payAllProgress.name})...` : 'Processando...')
                      : (selectedCityToPay === 'ALL' 
                          ? '⚡ Pagar Todos (Geral)' 
                          : `⚡ Pagar Todos de ${selectedCityToPay}`)}
                  </button>
                )}
              </div>
            </div>
            
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
                                  {(u.role === 'motorista' || u.role === 'loja' || u.role === 'fornecedor') && (() => {
                                    // Calcular saldo pendente por tipo de parceiro
                                    let pendingOrders: Order[];
                                    let amountOwed: number;

                                    if (u.role === 'motorista') {
                                      pendingOrders = orders.filter(o =>
                                        o && o.motoristaId === u.id &&
                                        o.status === 'entregue' &&
                                        !(o as any).payout_driver_done
                                      );
                                      amountOwed = pendingOrders.reduce((acc, curr) =>
                                        acc + (curr.taxas?.entregaMotorista || getDynamicTaxes(curr).repasseMoto || 0), 0
                                      );
                                    } else if (u.role === 'loja') {
                                      pendingOrders = orders.filter(o =>
                                        o && o.lojaId === u.id &&
                                        o.status === 'entregue' &&
                                        !(o as any).payout_seller_done
                                      );
                                      amountOwed = pendingOrders.reduce((acc, curr) =>
                                        acc + (curr.taxas?.repasse || getDynamicTaxes(curr).repasseLoja || 0), 0
                                      );
                                    } else {
                                      // fornecedor
                                      pendingOrders = orders.filter(o =>
                                        o && o.fornecedorId === u.id &&
                                        o.status === 'entregue' &&
                                        !(o as any).payout_seller_done
                                      );
                                      amountOwed = pendingOrders.reduce((acc, curr) =>
                                        acc + (curr.taxas?.repasse || getDynamicTaxes(curr).repasseForn || 0), 0
                                      );
                                    }

                                    const isPaying = payingPartnerId === u.id;
                                    const pixKey = u.pixKey || u.cpfCnpj || u.email;

                                    return (
                                      <div className={`mt-2 border p-2 rounded-lg flex items-center justify-between flex-wrap gap-2 ${
                                        amountOwed > 0
                                          ? 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800'
                                          : 'bg-zinc-50 border-zinc-200 dark:bg-zinc-800/50 dark:border-zinc-700'
                                      }`}>
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className={`text-xs font-bold ${
                                            amountOwed > 0 ? 'text-green-700 dark:text-green-400' : 'text-zinc-400 dark:text-zinc-500'
                                          }`}>
                                            {amountOwed > 0 ? `A Pagar: ${formatMoney(amountOwed)}` : 'Repasse: R$ 0,00'}
                                          </span>
                                          {pixKey && (
                                            <span className="text-[10px] text-zinc-500 bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-300 px-2 py-0.5 rounded font-mono">
                                              PIX: {pixKey}
                                            </span>
                                          )}
                                        </div>
                                        {amountOwed > 0 && (
                                          <button
                                            disabled={isPaying}
                                            onClick={() => pagarParceiro(u, pendingOrders, amountOwed)}
                                            className="bg-green-600 hover:bg-green-700 disabled:bg-zinc-400 text-white text-[10px] font-bold px-3 py-1 rounded shadow-sm transition flex items-center gap-1"
                                          >
                                            {isPaying ? '⏳ Pagando...' : '💸 Pagar e Zerar'}
                                          </button>
                                        )}
                                      </div>
                                    );
                                  })()}
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
                                        <button onClick={() => { if(typeof store.updateUserStatus === 'function') { store.updateUserStatus(u.id, u.status === 'blocked' ? 'active' : 'blocked'); showToast(u.status === 'blocked' ? `🔓 Usuário ${u.name} desbloqueado` : `🚫 Usuário ${u.name} bloqueado`); } }} className={`px-2 py-1.5 text-[10px] font-bold rounded shadow-sm ${u.status === 'blocked' ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'}`}>
                                            {u.status === 'blocked' ? '🔓 Desbloquear' : '🚫 Bloquear'}
                                        </button>
                                    )}
                                    {u.role !== 'admin' && (
                                        <button onClick={() => { if(confirm('Tem certeza que deseja excluir esta conta? Esta ação não pode ser desfeita.')) { if(typeof store.deleteUser === 'function') store.deleteUser(u.id); showToast("🗑️ Solicitação de exclusão enviada!"); } }} className="px-2 py-1.5 text-[10px] font-bold rounded shadow-sm bg-red-600 text-white hover:bg-red-700 transition">
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

        {activeTab === 'ocorrencias' && (
          <IncidentReportSection orders={orders} users={users} showToast={showToast} />
        )}

        {activeTab === 'cidades' && (
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
            <h3 className="font-bold text-lg text-zinc-700 dark:text-zinc-200 border-b border-zinc-200 dark:border-zinc-800 pb-2">🌍 Gestão de Cidades e Expansão</h3>
            
            <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-4">
                <h4 className="font-bold mb-3 text-sm">Adicionar Nova Cidade</h4>
                <div className="flex gap-2">
                    <input type="text" value={newCityName} onChange={e => setNewCityName(e.target.value)} placeholder="Ex: Marabá" className="flex-1 border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-purple-500" />
                    <button onClick={() => { if(newCityName) { if(typeof store.addCity === 'function') store.addCity(newCityName); setNewCityName(''); showToast("🌍 Cidade adicionada com sucesso!"); } }} className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl font-bold transition">Adicionar</button>
                </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-4 mt-4">
                <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
                    <div className="relative w-full sm:w-80">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-zinc-400" />
                        <input 
                            type="text" 
                            value={citySearchText} 
                            onChange={e => setCitySearchText(e.target.value)} 
                            placeholder="Pesquisar cidade por nome..." 
                            className="w-full pl-9 pr-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 font-medium" 
                        />
                    </div>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400 font-bold">
                        {filteredCities.length} {filteredCities.length === 1 ? 'cidade cadastrada' : 'cidades encontradas'}
                    </span>
                </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-x-auto mt-4 mb-10">
                <table className="w-full text-left text-sm min-w-max">
                    <thead className="bg-zinc-50 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800">
                        <tr><th className="p-4">Nome da Cidade</th><th className="p-4">Status</th><th className="p-4">Repasses Pendentes</th><th className="p-4 text-right">Ações</th></tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {filteredCities.map(c => {
                            const cityPending = pendingPayoutsByCity[c.name];
                            return (
                            <tr key={c.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                                <td className="p-4 font-bold text-zinc-800 dark:text-zinc-200">{c.name}</td>
                                <td className="p-4">
                                    {c.status === 'active' ? <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-[10px] font-bold uppercase">Ativa</span> : <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-[10px] font-bold uppercase">Pausada</span>}
                                </td>
                                <td className="p-4">
                                    {cityPending && cityPending.totalOwed > 0 ? (
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-xs text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-950/60 px-2.5 py-1 rounded-lg">
                                                {formatMoney(cityPending.totalOwed)} ({cityPending.partners.length} parc.)
                                            </span>
                                            <button
                                                disabled={isPayingAll}
                                                onClick={() => pagarTodosParceiros(cityPending.partners, c.name)}
                                                className="bg-purple-600 hover:bg-purple-700 disabled:bg-zinc-400 text-white text-[10px] font-bold px-2.5 py-1 rounded-md shadow-sm transition flex items-center gap-1 active:scale-95"
                                                title={`Liquidar todos os parceiros pendentes de ${c.name}`}
                                            >
                                                <Zap size={11} /> Liquidar
                                            </button>
                                        </div>
                                    ) : (
                                        <span className="text-zinc-400 text-xs italic">Sem pendências</span>
                                    )}
                                </td>
                                <td className="p-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <button 
                                            onClick={() => {
                                                setSelectedCityForRates(c);
                                                setLocalRates(getRatesForCity(c.name, rates, cities));
                                                setRatesModalOpen(true);
                                            }}
                                            className="px-2.5 py-1.5 text-[10px] font-bold rounded shadow-sm bg-purple-600 hover:bg-purple-700 text-white transition flex items-center gap-1"
                                        >
                                            ⚙️ Taxas da Cidade
                                        </button>
                                        <button onClick={() => { if(typeof store.updateCityStatus === 'function') { store.updateCityStatus(c.id, c.status === 'active' ? 'paused' : 'active'); showToast(`Cidade ${c.name} ${c.status === 'active' ? 'pausada' : 'ativada'}`); } }} className={`px-2 py-1.5 text-[10px] font-bold rounded shadow-sm ${c.status === 'active' ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200' : 'bg-green-100 text-green-800 hover:bg-green-200'}`}>
                                            {c.status === 'active' ? 'Pausar' : 'Ativar'}
                                        </button>
                                        <button onClick={() => { if(confirm(`Tem certeza que deseja excluir a cidade ${c.name}?`)) { if(typeof store.deleteCity === 'function') store.deleteCity(c.id); showToast(`Cidade ${c.name} excluída`); } }} className="px-2 py-1.5 text-[10px] font-bold rounded shadow-sm bg-red-600 text-white hover:bg-red-700 transition">
                                            🗑️ Excluir
                                        </button>
                                    </div>
                                </td>
                            </tr>
                            );
                        })}
                        {filteredCities.length === 0 && (
                            <tr><td colSpan={4} className="text-center p-6 text-zinc-500">Nenhuma cidade encontrada com este nome.</td></tr>
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
        origem={mapModal.origem} 
        destino={mapModal.destino} 
        motorista={mapModal.motorista} 
      />

      {ratesModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-purple-900 text-white p-5 flex justify-between items-center shrink-0">
                <h3 className="font-bold text-lg flex items-center gap-2">
                    ⚙️ Configuração do Triplo Split {selectedCityForRates ? `— ${selectedCityForRates.name}` : '(Padrão Geral)'}
                </h3>
                <button onClick={() => setRatesModalOpen(false)} className="text-white hover:text-red-300 font-bold text-2xl leading-none">&times;</button>
            </div>
            
            <div className="p-6 space-y-6 overflow-y-auto">
              <div className="border-b border-zinc-200 dark:border-zinc-800 pb-4">
                  <h4 className="font-bold text-zinc-700 dark:text-zinc-200 mb-3 flex items-center gap-2"><span>🛵</span> B2C (Açaí Pronto - Motoboy)</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div><label className="text-[10px] uppercase text-zinc-500 font-bold">App na Venda (%)</label><input type="number" value={localRates?.b2c_plat ?? 10} onChange={e => setLocalRates({...localRates, b2c_plat: Number(e.target.value)})} className="w-full border dark:border-zinc-700 bg-transparent rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-purple-500"/></div>
                      <div>
                        <label className="text-[10px] uppercase text-zinc-500 font-bold">Modalidade</label>
                        <select value={localRates?.courier_payment_mode || 'KM'} onChange={e => {
                          const mode = e.target.value as 'KM' | 'FIXED';
                          const fee = mode === 'FIXED' ? (localRates?.courier_fixed_fee ?? localRates?.b2c_km ?? 8) : (localRates?.b2c_km ?? 2);
                          setLocalRates({...localRates, courier_payment_mode: mode, courier_fixed_fee: fee, b2c_km: fee});
                        }} className="w-full border dark:border-zinc-700 bg-transparent rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-purple-500">
                          <option value="KM">Por KM</option>
                          <option value="FIXED">Valor Fixo</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] uppercase text-zinc-500 font-bold">{localRates?.courier_payment_mode === 'FIXED' ? 'Frete Fixo (R$)' : 'Valor por KM (R$)'}</label>
                        <input type="number" step="0.1" value={localRates?.courier_payment_mode === 'FIXED' ? (localRates?.courier_fixed_fee ?? 8) : (localRates?.b2c_km ?? 2)} onChange={e => {
                          const val = Number(e.target.value);
                          if (localRates?.courier_payment_mode === 'FIXED') {
                            setLocalRates({...localRates, courier_fixed_fee: val, b2c_km: val});
                          } else {
                            setLocalRates({...localRates, b2c_km: val});
                          }
                        }} className="w-full border dark:border-zinc-700 bg-transparent rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-purple-500"/>
                      </div>
                      <div><label className="text-[10px] uppercase text-purple-600 font-bold">App no Frete (%)</label><input type="number" value={localRates?.b2c_mot_plat ?? 10} onChange={e => setLocalRates({...localRates, b2c_mot_plat: Number(e.target.value)})} className="w-full border border-purple-300 bg-purple-50 dark:bg-purple-900/20 dark:border-purple-800 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-purple-500"/></div>
                  </div>
              </div>
              <div className="border-b border-zinc-200 dark:border-zinc-800 pb-4">
                  <h4 className="font-bold text-zinc-700 dark:text-zinc-200 mb-3 flex items-center gap-2"><span>🚚</span> B2B (Fruto - Caminhão)</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div><label className="text-[10px] uppercase text-zinc-500 font-bold">App na Venda (%)</label><input type="number" value={localRates?.b2b_plat ?? 10} onChange={e => setLocalRates({...localRates, b2b_plat: Number(e.target.value)})} className="w-full border dark:border-zinc-700 bg-transparent rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-purple-500"/></div>
                      <div>
                        <label className="text-[10px] uppercase text-zinc-500 font-bold">Modalidade</label>
                        <select value={localRates?.transporter_payment_mode || 'KM'} onChange={e => {
                          const mode = e.target.value as 'KM' | 'FIXED';
                          const fee = mode === 'FIXED' ? (localRates?.transporter_fixed_fee ?? localRates?.b2b_km ?? 150) : (localRates?.b2b_km ?? 4);
                          setLocalRates({...localRates, transporter_payment_mode: mode, transporter_fixed_fee: fee, b2b_km: fee});
                        }} className="w-full border dark:border-zinc-700 bg-transparent rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-purple-500">
                          <option value="KM">Por KM</option>
                          <option value="FIXED">Valor Fixo</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] uppercase text-zinc-500 font-bold">{localRates?.transporter_payment_mode === 'FIXED' ? 'Frete Fixo (R$)' : 'Valor por KM (R$)'}</label>
                        <input type="number" step="0.1" value={localRates?.transporter_payment_mode === 'FIXED' ? (localRates?.transporter_fixed_fee ?? 150) : (localRates?.b2b_km ?? 4)} onChange={e => {
                          const val = Number(e.target.value);
                          if (localRates?.transporter_payment_mode === 'FIXED') {
                            setLocalRates({...localRates, transporter_fixed_fee: val, b2b_km: val});
                          } else {
                            setLocalRates({...localRates, b2b_km: val});
                          }
                        }} className="w-full border dark:border-zinc-700 bg-transparent rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-purple-500"/>
                      </div>
                      <div><label className="text-[10px] uppercase text-purple-600 font-bold">App no Frete (%)</label><input type="number" value={localRates?.b2b_mot_plat ?? 10} onChange={e => setLocalRates({...localRates, b2b_mot_plat: Number(e.target.value)})} className="w-full border border-purple-300 bg-purple-50 dark:bg-purple-900/20 dark:border-purple-800 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-purple-500"/></div>
                  </div>
              </div>
              <div className="pb-2">
                  <h4 className="font-bold text-zinc-700 dark:text-zinc-200 mb-3 flex items-center gap-2"><span>🚛</span> Coleta Log. Reversa (Caroço - EcoPoint)</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-[10px] uppercase text-zinc-500 font-bold">Modalidade</label>
                        <select value={localRates?.ecopoint_payment_mode || 'KM'} onChange={e => {
                          const mode = e.target.value as 'KM' | 'FIXED';
                          const fee = mode === 'FIXED' ? (localRates?.ecopoint_fixed_fee ?? localRates?.col_km ?? 50) : (localRates?.col_km ?? 8);
                          setLocalRates({...localRates, ecopoint_payment_mode: mode, ecopoint_fixed_fee: fee, col_km: fee});
                        }} className="w-full border dark:border-zinc-700 bg-transparent rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-purple-500">
                          <option value="KM">Por KM</option>
                          <option value="FIXED">Valor Fixo</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] uppercase text-zinc-500 font-bold">{localRates?.ecopoint_payment_mode === 'FIXED' ? 'Coleta Fixa (R$)' : 'Valor por KM (R$)'}</label>
                        <input type="number" step="0.1" value={localRates?.ecopoint_payment_mode === 'FIXED' ? (localRates?.ecopoint_fixed_fee ?? 50) : (localRates?.col_km ?? 8)} onChange={e => {
                          const val = Number(e.target.value);
                          if (localRates?.ecopoint_payment_mode === 'FIXED') {
                            setLocalRates({...localRates, ecopoint_fixed_fee: val, col_km: val});
                          } else {
                            setLocalRates({...localRates, col_km: val});
                          }
                        }} className="w-full border dark:border-zinc-700 bg-transparent rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-purple-500"/>
                      </div>
                      <div><label className="text-[10px] uppercase text-purple-600 font-bold">App no Frete (%)</label><input type="number" value={localRates?.col_mot_plat ?? 10} onChange={e => setLocalRates({...localRates, col_mot_plat: Number(e.target.value)})} className="w-full border border-purple-300 bg-purple-50 dark:bg-purple-900/20 dark:border-purple-800 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-purple-500"/></div>
                  </div>
              </div>
              <div className="pb-2 border-t border-zinc-200 dark:border-zinc-800 pt-4">
                  <h4 className="font-bold text-zinc-700 dark:text-zinc-200 mb-1 flex items-center gap-2"><span>⏰</span> Horário do Pix Automático Diário (Todos os Parceiros)</h4>
                  <p className="text-xs text-zinc-500 mb-3">Define o horário de varredura diária no Asaas para enviar o saldo acumulado via Pix para as Lojas, Fornecedores e Motoristas.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                      <div><label className="text-[10px] uppercase text-zinc-500 font-bold">Horário Programado para Pix</label><input type="time" value={localRates?.payout_time || '22:00'} onChange={e => setLocalRates({...localRates, payout_time: e.target.value})} className="w-full border dark:border-zinc-700 bg-transparent rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-purple-500"/></div>
                      <div>
                        <button 
                          type="button" 
                          onClick={async () => {
                            if (confirm("Deseja executar a varredura e envio de Pix pendentes do dia agora mesmo?")) {
                              try {
                                const { data, error } = await supabase.functions.invoke('payout-sweep');
                                if (error) throw error;
                                alert(`✅ Varredura concluída com sucesso!\n\nPedidos Processados: ${data?.processedOrders || 0}\nRepasses Lojas: ${data?.sellerPayoutsCount || 0}\nRepasses Motoristas: ${data?.driverPayoutsCount || 0}\nTotal Transferido: R$ ${(data?.totalAmountTransferred || 0).toFixed(2)}`);
                              } catch (err: any) {
                                alert("Erro ao disparar varredura: " + (err.message || JSON.stringify(err)));
                              }
                            }
                          }}
                          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 rounded-lg transition shadow flex items-center justify-center gap-2"
                        >
                          🚀 Executar Varredura de Pix Agora
                        </button>
                      </div>
                  </div>
              </div>

              <div className="pb-2 border-t border-zinc-200 dark:border-zinc-800 pt-4">
                  <h4 className="font-bold text-zinc-700 dark:text-zinc-200 mb-1 flex items-center gap-2"><span>🔑</span> Chave de API Asaas (Produção)</h4>
                  <p className="text-xs text-zinc-500 mb-3">Chave de Produção oficial ($aact_prod_...). Usada para confirmação instantânea de Pix no Asaas e Estorno automático.</p>
                  <div className="grid grid-cols-1 gap-2">
                      <input 
                        type="password" 
                        placeholder="$aact_prod_..." 
                        value={(localRates as any)?.asaas_api_key || ''} 
                        onChange={e => setLocalRates({...localRates, asaas_api_key: e.target.value} as any)} 
                        className="w-full border border-purple-300 dark:border-zinc-700 bg-purple-50/50 dark:bg-zinc-900 rounded-lg p-2.5 text-sm font-mono outline-none focus:ring-2 focus:ring-purple-500"
                      />
                  </div>
              </div>
            </div>

            <div className="p-5 bg-zinc-50 dark:bg-zinc-900/50 flex justify-end gap-3 border-t border-zinc-200 dark:border-zinc-800">
                <button onClick={() => setRatesModalOpen(false)} className="px-5 py-2.5 text-zinc-600 bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 rounded-xl font-bold transition">Cancelar</button>
                <button disabled={isSavingRates} onClick={handleSaveRates} className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl font-bold transition flex items-center gap-2">
                  {isSavingRates ? 'Salvando...' : 'Salvar Triplo Split'}
                </button>
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
                    if (store.currentUser?.id && typeof store.changePassword === 'function') store.changePassword(store.currentUser.id, newAdminPassword);
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

      {pwdModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col animate-in fade-in zoom-in-95">
            <div className="bg-purple-900 text-white p-5 flex justify-between items-center shrink-0">
                <h3 className="font-bold text-lg">🔑 {pwdModalMode === 'create' ? 'Criar Senha de Segurança' : 'Senha de Segurança'}</h3>
                <button onClick={() => setPwdModalOpen(false)} className="text-white hover:text-red-300 font-bold text-2xl leading-none">&times;</button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                  <label className="text-xs uppercase text-zinc-500 font-bold mb-1 block">
                    {pwdModalMode === 'create' ? 'Crie uma senha para habilitar o botão Limpar:' : 'Digite a senha para limpar o banco:'}
                  </label>
                  <input 
                    type="password" 
                    autoFocus
                    value={pwdInputText} 
                    onChange={e => setPwdInputText(e.target.value)} 
                    onKeyDown={e => { if (e.key === 'Enter') handleConfirmPasswordModal(); }}
                    className="w-full border border-zinc-300 dark:border-zinc-700 bg-transparent rounded-lg p-3 outline-none focus:ring-2 focus:ring-purple-500 font-bold text-lg text-center tracking-widest"
                    placeholder="***"
                  />
              </div>
            </div>

            <div className="p-5 bg-zinc-50 dark:bg-zinc-900/50 flex justify-end gap-3 border-t border-zinc-200 dark:border-zinc-800">
                <button onClick={() => setPwdModalOpen(false)} className="px-4 py-2 text-zinc-600 bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 rounded-xl font-bold transition text-xs">Cancelar</button>
                <button onClick={handleConfirmPasswordModal} className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold transition text-xs shadow-md">
                    {pwdModalMode === 'create' ? 'Criar Senha' : 'Confirmar'}
                </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default function AdminDashboard() {
  return (
    <AdminErrorBoundary>
      <AdminDashboardContent />
    </AdminErrorBoundary>
  );
}
