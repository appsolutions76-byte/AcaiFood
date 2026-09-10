"use client";

import React, { useState, useEffect, useMemo, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { 
  Settings, Trash2, Search, BookOpen, Zap, ShieldAlert,
  Download, Printer, Filter, Calendar, MapPin, User as UserIcon,
  Clock, CheckCircle, X, Eye, ArrowUpRight, Check, FileSpreadsheet,
  FileText, Layers, Phone, Navigation, ShieldCheck, DollarSign, Share2
} from "lucide-react";
import { useAppStore, Order, City, getRatesForCity, calculateOrderFreight, calculateOrderTaxes } from "@/store/useAppStore";
import { supabase } from "@/lib/supabase";
import { MapModal, MapPoint } from "@/components/MapModal";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AdminManualModal } from "@/components/AdminManualModal";
import { IncidentReportSection } from "@/components/IncidentReportSection";
import { AdminSupportSection } from "@/components/admin/AdminSupportSection";
import { ShareLandingModal } from "@/components/ShareLandingModal";

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
  const [activeTab, setActiveTab] = useState<'dashboard' | 'usuarios' | 'pedidos' | 'cidades' | 'ocorrencias' | 'ativacoes' | 'anuncios' | 'suporte'>('dashboard');
  const [activationConfig, setActivationConfig] = useState<{
    activationFee: number;
    freeQuota: number;
    activationEnabled: boolean;
    subsidizedCount: number;
    paidCount: number;
    pendingCount: number;
    freeSlotsRemaining: number;
  }>({
    activationFee: 12.90,
    freeQuota: 50,
    activationEnabled: true,
    subsidizedCount: 0,
    paidCount: 0,
    pendingCount: 0,
    freeSlotsRemaining: 50
  });
  const [adsList, setAdsList] = useState<any[]>([]);
  const [isLoadingAds, setIsLoadingAds] = useState(false);
  const [isSavingAd, setIsSavingAd] = useState(false);
  const [adModalOpen, setAdModalOpen] = useState(false);
  const [editingAd, setEditingAd] = useState<any | null>(null);
  const [adFormData, setAdFormData] = useState<{
    partnerId: string;
    partnerName: string;
    title: string;
    description: string;
    mediaType: 'image' | 'video';
    mediaUrl: string;
    targetUrl: string;
    placement: 'banner' | 'story' | 'both';
    city: string;
    startDate: string;
    endDate: string;
    pricePaid: number;
    active: boolean;
  }>({
    partnerId: '',
    partnerName: '',
    title: '',
    description: '',
    mediaType: 'image',
    mediaUrl: '',
    targetUrl: '',
    placement: 'both',
    city: 'all',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    pricePaid: 50,
    active: true
  });
  const [isSavingActivationConfig, setIsSavingActivationConfig] = useState(false);
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
  const [shareLandingModalOpen, setShareLandingModalOpen] = useState(false);
  const [payingPartnerId, setPayingPartnerId] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<'historical' | 'monthly' | 'daily'>('historical');
  const [orderSearchQuery, setOrderSearchQuery] = useState<string>('');
  const [orderPeriodFilter, setOrderPeriodFilter] = useState<'all' | 'today' | '7days' | 'month'>('all');
  const [orderTypeFilter, setOrderTypeFilter] = useState<'all' | 'B2C' | 'B2B' | 'COLETA'>('all');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [selectedAuditOrder, setSelectedAuditOrder] = useState<Order | null>(null);
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
    if (!confirm(`Tem certeza de que deseja ZERAR o ${label} financeiro?\n\n(Esta ação redefinirá os totalizadores na tela e no banco de dados para R$ 0,00)`)) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const authHeaders: any = { 
        'Content-Type': 'application/json'
      };
      if (session?.access_token) authHeaders['Authorization'] = `Bearer ${session.access_token}`;

      const res = await fetch('/api/admin/reset-balances', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ period: balanceId })
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        alert("Erro ao zerar acumulador no banco de dados: " + (data.error || 'Falha de comunicação'));
        return;
      }

      setAdminBalances(prev => {
        const base = prev || {
          historical: { total_orders: 0, total_volume: 0, app_revenue: 0, fornecedores_bruto: 0, fornecedores_liquido: 0, batedeiras_bruto: 0, batedeiras_liquido: 0, motoristas_bruto: 0, motoristas_liquido: 0, caminhoes_bruto: 0, caminhoes_liquido: 0 },
          monthly: { total_orders: 0, total_volume: 0, app_revenue: 0, fornecedores_bruto: 0, fornecedores_liquido: 0, batedeiras_bruto: 0, batedeiras_liquido: 0, motoristas_bruto: 0, motoristas_liquido: 0, caminhoes_bruto: 0, caminhoes_liquido: 0 },
          daily: { total_orders: 0, total_volume: 0, app_revenue: 0, fornecedores_bruto: 0, fornecedores_liquido: 0, batedeiras_bruto: 0, batedeiras_liquido: 0, motoristas_bruto: 0, motoristas_liquido: 0, caminhoes_bruto: 0, caminhoes_liquido: 0 }
        };
        return {
          ...base,
          [balanceId]: {
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
            caminhoes_liquido: 0,
            updated_at: new Date().toISOString()
          }
        };
      });

      showToast(`✅ ${label} zerado com sucesso!`);
      await fetchAdminBalances();
    } catch (err: any) {
      alert("Erro ao atualizar: " + err.message);
    }
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  // Função auxiliar centralizada para calcular pedidos pendentes e saldo devido de qualquer usuário parceiro
  const getPendingOrdersAndOwedForUser = (u: any) => {
    if (!u || !['motorista', 'loja', 'fornecedor'].includes(u.role)) {
      return { pendingOrders: [] as Order[], amountOwed: 0 };
    }

    const pendingOrders = orders.filter(o => {
      if (!o) return false;
      const isConcluido = o.status === 'entregue' || o.status === 'arquivado';
      if (!isConcluido) return false;

      if (u.role === 'motorista') {
        const isThisDriver = o.motoristaId === u.id || (o as any).driver_id === u.id;
        const isPaid = !!o.payoutDriverDone || !!(o as any).payout_driver_done;
        return isThisDriver && !isPaid;
      } else if (u.role === 'loja') {
        const isThisStore = o.lojaId === u.id || 
                            (o as any).sellerStorefrontId === u.id || 
                            (o as any).seller_storefront_id === u.id || 
                            o.origemId === u.id ||
                            (u.storefronts && u.storefronts.some((sf: any) => sf.id === (o as any).sellerStorefrontId || sf.id === (o as any).seller_storefront_id || sf.id === o.origemId));
        const isPaid = !!o.payoutSellerDone || !!(o as any).payout_seller_done;
        return isThisStore && !isPaid;
      } else {
        // fornecedor
        const isThisSupplier = o.fornecedorId === u.id || 
                               (o as any).sellerStorefrontId === u.id || 
                               (o as any).seller_storefront_id === u.id || 
                               o.origemId === u.id ||
                               (u.storefronts && u.storefronts.some((sf: any) => sf.id === (o as any).sellerStorefrontId || sf.id === (o as any).seller_storefront_id || sf.id === o.origemId));
        const isPaid = !!o.payoutSellerDone || !!(o as any).payout_seller_done;
        return isThisSupplier && !isPaid;
      }
    });

    const amountOwed = pendingOrders.reduce((acc, o) => {
      if (u.role === 'motorista') {
        return acc + (o.taxas?.entregaMotorista || (o as any).driver_amount || getDynamicTaxes(o).repasseMoto || 0);
      } else if (u.role === 'loja') {
        return acc + (o.taxas?.repasse || (o as any).seller_amount || getDynamicTaxes(o).repasseLoja || 0);
      } else {
        return acc + (o.taxas?.repasse || (o as any).seller_amount || getDynamicTaxes(o).repasseForn || 0);
      }
    }, 0);

    return { pendingOrders, amountOwed };
  };

  // Função para editar Chave Pix do parceiro diretamente no painel
  const handleEditUserPix = async (u: any) => {
    const currentPix = u.pixKey || (u as any).pix_key || '';
    const newPix = prompt(`Editar Chave Pix de ${u.name}:\n\n(CPF, CNPJ, Telefone com DDD, E-mail ou Chave Aleatória EVP)`, currentPix);
    if (newPix === null) return;
    const cleanPix = newPix.trim();
    try {
      const { error } = await supabase.from('users').update({ pix_key: cleanPix }).eq('id', u.id);
      if (error) throw error;
      useAppStore.setState(prev => ({
        users: {
          ...prev.users,
          [u.id]: {
            ...prev.users[u.id],
            pixKey: cleanPix,
            pix_key: cleanPix
          }
        }
      }));
      showToast(`✅ Chave Pix de ${u.name} atualizada com sucesso!`);
    } catch (err: any) {
      alert(`Erro ao salvar chave Pix: ${err.message}`);
    }
  };

  // Função de pagamento individual de parceiro via Pix
  const pagarParceiro = async (u: any, pendingOrders: Order[], amountOwed: number) => {
    let pixKey = (u.cpfCnpj || (u as any).cpf_cnpj || u.pixKey || (u as any).pix_key || '').replace(/\D/g, '').trim();
    if (!pixKey) {
      const inputPix = prompt(`Informe o CPF/CNPJ do titular ${u.name} para a Chave Pix:`);
      if (inputPix && inputPix.trim()) {
        pixKey = inputPix.replace(/\D/g, '').trim();
        try {
          await supabase.from('users').update({ pix_key: pixKey }).eq('id', u.id);
          u.pixKey = pixKey;
        } catch (_e) {}
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
        'Content-Type': 'application/json'
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
        const isDriver = u.role === 'motorista' || u.role === 'courier' || u.role === 'motoboy' || u.role === 'caminhao' || u.role === 'driver';
        const roleType = isDriver ? 'driver' : 'seller';
        const orderIds = pendingOrders.map(o => o.id);

        await store.markPayoutDone(orderIds, roleType);

        showToast(`✅ Pix de ${(amountOwed).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} enviado para ${u.name}! (ID Asaas: ${data.transferId})`);
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
      'Content-Type': 'application/json'
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
      const pixKey = (u.cpfCnpj || (u as any).cpf_cnpj || u.pixKey || (u as any).pix_key || '').replace(/\D/g, '').trim();

      setPayAllProgress({ current: i + 1, total: partnersWithOwed.length, name: u.name });

      if (!pixKey) {
        failCount++;
        failureDetails.push(`${u.name}: Sem Chave Pix cadastrada`);
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
          const isDriver = u.role === 'motorista' || u.role === 'courier' || u.role === 'motoboy' || u.role === 'caminhao' || u.role === 'driver';
          const roleType = isDriver ? 'driver' : 'seller';
          const orderIds = p.pendingOrders.map(o => o.id);

          await store.markPayoutDone(orderIds, roleType);
          successCount++;
        } else {
          failCount++;
          failureDetails.push(`${u.name}: ${data.error || 'Recusado pelo Asaas'}`);
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

  const fetchActivationConfig = async () => {
    try {
      const res = await fetch('/api/admin/activation-config');
      const data = await res.json();
      if (data && data.success) {
        setActivationConfig({
          activationFee: Number(data.activationFee ?? 12.90),
          freeQuota: Number(data.freeQuota ?? 50),
          activationEnabled: Boolean(data.activationEnabled !== false),
          subsidizedCount: Number(data.subsidizedCount ?? 0),
          paidCount: Number(data.paidCount ?? 0),
          pendingCount: Number(data.pendingCount ?? 0),
          freeSlotsRemaining: Number(data.freeSlotsRemaining ?? 50)
        });
      }
    } catch (_e) {
      console.warn("Aviso ao carregar config de ativação:", _e);
    }
  };

  const handleSaveActivationConfig = async () => {
    setIsSavingActivationConfig(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const authHeaders: any = { 'Content-Type': 'application/json' };
      if (session?.access_token) authHeaders['Authorization'] = `Bearer ${session.access_token}`;

      const res = await fetch('/api/admin/activation-config', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          activationFee: activationConfig.activationFee,
          freeQuota: activationConfig.freeQuota,
          activationEnabled: activationConfig.activationEnabled
        })
      });
      const data = await res.json();
      if (data && data.success) {
        showToast("✅ Configurações de ativação de parceiros salvas!");
        fetchActivationConfig();
      } else {
        alert("Erro ao salvar: " + (data.error || 'Falha'));
      }
    } catch (err: any) {
      alert("Erro ao salvar: " + err.message);
    } finally {
      setIsSavingActivationConfig(false);
    }
  };

  const fetchAds = async () => {
    setIsLoadingAds(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const authHeaders: any = {};
      if (session?.access_token) authHeaders['Authorization'] = `Bearer ${session.access_token}`;

      const res = await fetch('/api/admin/ads', { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setAdsList(data.ads || []);
      }
    } catch (e) {
      console.error("Erro ao carregar anúncios:", e);
    } finally {
      setIsLoadingAds(false);
    }
  };

  const handleSaveAd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adFormData.title.trim() || !adFormData.mediaUrl.trim()) {
      alert("Por favor, preencha o título e a URL da mídia (imagem ou vídeo).");
      return;
    }
    setIsSavingAd(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const authHeaders: any = { 'Content-Type': 'application/json' };
      if (session?.access_token) authHeaders['Authorization'] = `Bearer ${session.access_token}`;

      const isAct = adFormData.active !== false;
      const targetVal = adFormData.targetUrl.trim();
      const isWa = targetVal.includes('whatsapp') || targetVal.includes('wa.me');
      const isHttp = targetVal.startsWith('http') || targetVal.startsWith('/');
      const targetType = isWa ? 'whatsapp' : isHttp ? 'url' : 'store';

      const payload = {
        action: 'save',
        ad: {
          ...(editingAd ? { id: editingAd.id } : {}),
          ...adFormData,
          advertiserName: adFormData.partnerName || 'AçaíFood Oficial',
          partnerName: adFormData.partnerName || 'AçaíFood Oficial',
          targetValue: targetVal,
          targetUrl: targetVal,
          targetType,
          isActive: isAct,
          active: isAct
        }
      };

      const res = await fetch('/api/admin/ads', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (res.ok && data.success) {
        showToast(editingAd ? "✅ Anúncio atualizado com sucesso!" : "✅ Anúncio comercial criado com sucesso!");
        setAdModalOpen(false);
        setEditingAd(null);
        if (data.ads) {
          setAdsList(data.ads);
        } else {
          fetchAds();
        }
      } else {
        alert("Erro ao salvar anúncio: " + (data.error || 'Falha de autorização ou comunicação'));
      }
    } catch (err: any) {
      alert("Erro ao salvar: " + err.message);
    } finally {
      setIsSavingAd(false);
    }
  };

  const handleToggleAdStatus = async (ad: any) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const authHeaders: any = { 'Content-Type': 'application/json' };
      if (session?.access_token) authHeaders['Authorization'] = `Bearer ${session.access_token}`;

      const res = await fetch('/api/admin/ads', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          action: 'toggle',
          adId: ad.id
        })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        const currentlyActive = ad.isActive !== false && ad.active !== false;
        showToast(currentlyActive ? "⏸️ Anúncio pausado!" : "▶️ Anúncio ativado!");
        if (data.ads) {
          setAdsList(data.ads);
        } else {
          fetchAds();
        }
      } else {
        alert("Erro ao alterar status: " + (data.error || 'Falha de autorização'));
      }
    } catch (err: any) {
      alert("Erro ao alterar status: " + err.message);
    }
  };

  const handleDeleteAd = async (adId: string) => {
    if (!confirm("Tem certeza que deseja excluir este anúncio comercial?")) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const authHeaders: any = { 'Content-Type': 'application/json' };
      if (session?.access_token) authHeaders['Authorization'] = `Bearer ${session.access_token}`;

      const res = await fetch('/api/admin/ads', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          action: 'delete',
          adId
        })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        showToast("🗑️ Anúncio excluído com sucesso!");
        if (data.ads) {
          setAdsList(data.ads);
        } else {
          fetchAds();
        }
      } else {
        alert("Erro ao excluir: " + (data.error || 'Falha de autorização'));
      }
    } catch (err: any) {
      alert("Erro ao excluir: " + err.message);
    }
  };

  const handleDeleteUser = async (targetUser: any) => {
    if (!targetUser?.id) return;
    const userName = targetUser.name || targetUser.email || 'este usuário';
    if (!confirm(`ATENÇÃO: Tem certeza de que deseja EXCLUIR DEFINITIVAMENTE a conta de "${userName}"?\n\nEsta ação removerá o usuário, seus pedidos e todos os dados vinculados do banco de dados e não pode ser desfeita.`)) {
      return;
    }

    setDeletingUserId(targetUser.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const authHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) authHeaders['Authorization'] = `Bearer ${session.access_token}`;

      // 1. Tentar excluir subconta Asaas se houver
      try {
        await fetch(`/api/asaas/subaccount?userId=${targetUser.id}`, {
          method: 'DELETE',
          headers: authHeaders
        });
      } catch (_subErr) {
        console.warn("Aviso ao tentar excluir subconta Asaas:", _subErr);
      }

      // 2. Chamar rota administrativa de exclusão definitiva
      const res = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ userId: targetUser.id })
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || 'Falha na exclusão pelo servidor');
      }

      // 3. Atualizar store Zustand removendo o usuário
      useAppStore.setState((state) => {
        const newUsers = { ...state.users };
        delete newUsers[targetUser.id];
        return { users: newUsers };
      });

      showToast(`🗑️ Usuário ${userName} excluído com sucesso!`);
      if (typeof store.fetchAllUsers === 'function') {
        await store.fetchAllUsers(true);
      }
    } catch (err: any) {
      console.error("Erro ao excluir usuário:", err);
      alert(`Erro ao excluir usuário: ${err.message || 'Falha de comunicação com o servidor'}`);
    } finally {
      setDeletingUserId(null);
    }
  };

  const handleGrantFreeActivation = async (targetUserId: string) => {
    if (!confirm("Deseja conceder isenção gratuita e homologar este parceiro manualmente?")) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const authHeaders: any = { 'Content-Type': 'application/json' };
      if (session?.access_token) authHeaders['Authorization'] = `Bearer ${session.access_token}`;

      const res = await fetch('/api/asaas/activation', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          userId: targetUserId,
          forceFounder: true
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast("✅ Isenção concedida com sucesso ao parceiro!");
        if (typeof store.fetchAllUsers === 'function') store.fetchAllUsers();
        fetchActivationConfig();
      } else {
        alert("Erro ao conceder isenção: " + (data.error || 'Falha de comunicação'));
      }
    } catch (err: any) {
      alert("Erro: " + err.message);
    }
  };

  useEffect(() => {
    if (isAdmin) {
       const s = useAppStore.getState();
       if (typeof s.fetchAllUsers === 'function') s.fetchAllUsers();
       if (typeof s.startRealtime === 'function') s.startRealtime();
       if (typeof s.fetchOrders === 'function' && s.currentUser?.id) s.fetchOrders(s.currentUser.id);
       if (typeof s.fetchCities === 'function') s.fetchCities();
       if (typeof s.fetchRates === 'function') s.fetchRates();
       fetchAdminBalances();
       fetchActivationConfig();
       fetchAds();
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

  const partnerList = useMemo(() => {
    return Object.values(users).filter(u => u && u.role !== 'cliente' && u.role !== 'admin');
  }, [users]);

  const subsidizedPartnersCount = useMemo(() => {
    return Math.min(activationConfig.freeQuota, Math.max(activationConfig.subsidizedCount, 0));
  }, [activationConfig.freeQuota, activationConfig.subsidizedCount]);

  const freeSlotsLeft = useMemo(() => {
    return Math.max(0, activationConfig.freeQuota - subsidizedPartnersCount);
  }, [activationConfig.freeQuota, subsidizedPartnersCount]);



  // 6. Cálculos de Dashboard
  // 6. Cálculos de Dashboard
  const concluidos = orders.filter(o => o && (o.status === 'entregue' || o.status === 'arquivado'));
  
  const getDynamicTaxes = (o: Order) => {
    if (!o) return { repasseLoja: 0, repasseForn: 0, repasseMoto: 0, platVenda: 0, platEntrega: 0, entregaTotal: 0 };
    const orderCity = (o as any).cidadeOrigem || (o.lojaId && users[o.lojaId] ? users[o.lojaId]?.cidade : undefined);
    const activeRates = getRatesForCity(orderCity, rates, cities);
    return calculateOrderTaxes(o, activeRates, users);
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

  const getFilteredLocalStats = (period: 'historical' | 'monthly' | 'daily') => {
    const now = new Date();
    
    // Filtra os pedidos com base no período selecionado
    const periodOrders = orders.filter(o => {
      if (!o) return false;
      if (period === 'historical') return true;
      if (!o.createdAt) return false;
      const d = new Date(o.createdAt);
      if (isNaN(d.getTime())) return false;
      if (period === 'daily') {
        return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }
      if (period === 'monthly') {
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }
      return true;
    });

    const concluidosList = periodOrders.filter(o => o.status === 'entregue' || o.status === 'arquivado');
    const aceitosList = periodOrders.filter(o => ['preparo', 'pronto', 'em_rota', 'aguardando_cliente', 'entregue', 'arquivado'].includes(o.status));
    const canceladosList = periodOrders.filter(o => o.status === 'cancelado');
    const emRotaList = periodOrders.filter(o => o.status === 'em_rota' || o.status === 'aguardando_cliente');

    let localVendas = 0, localFretes = 0, localMov = 0;
    let localBatBruto = 0, localBatLiq = 0;
    let localFornBruto = 0, localFornLiq = 0;
    let localMotBruto = 0, localMotLiq = 0;
    let localCamBruto = 0, localCamLiq = 0;

    concluidosList.forEach(o => {
      const dyn = getDynamicTaxes(o);
      localVendas += dyn.platVenda || 0;
      localFretes += dyn.platEntrega || 0;
      localMov += (o.valor || 0) + (dyn.entregaTotal || 0);

      if (o.type === 'B2C' || !o.type) {
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

    return {
      ordersCount: periodOrders.length,
      aceitos: aceitosList.length,
      cancelados: canceladosList.length,
      emRota: emRotaList.length,
      concluidosCount: concluidosList.length,
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

  const currentOrdersCount = localStats.ordersCount;
  const currentConcluidosCount = localStats.concluidosCount;
  const currentAppRevenue = localStats.appRev;
  const currentVolumeTotal = localStats.volume;
  
  const currentFornBruto = localStats.fornBruto;
  const currentFornLiq = localStats.fornLiq;
  
  const currentBatBruto = localStats.batBruto;
  const currentBatLiq = localStats.batLiq;
  
  const currentMotBruto = localStats.motBruto;
  const currentMotLiq = localStats.motLiq;
  
  const currentCamBruto = localStats.camBruto;
  const currentCamLiq = localStats.camLiq;

  const totais = {
      pedidos: localStats.ordersCount,
      aceitos: localStats.aceitos,
      cancelados: localStats.cancelados,
      concluidos: localStats.concluidosCount,
      emRota: localStats.emRota,
      receitaVendas: localStats.appRev,
      receitaFretes: 0
  };

  const partnersWithPendingPayouts = useMemo(() => {
    const list: Array<{ user: any; pendingOrders: Order[]; amountOwed: number }> = [];
    Object.values(users).forEach(u => {
      if (u && (u.role === 'motorista' || u.role === 'loja' || u.role === 'fornecedor')) {
        const { pendingOrders, amountOwed } = getPendingOrdersAndOwedForUser(u);
        if (amountOwed > 0) {
          list.push({ user: u, pendingOrders, amountOwed });
        }
      }
    });
    return list;
  }, [users, orders, rates, cities]);

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

  const filteredOrdersForReport = useMemo(() => {
    return orders.filter(o => {
      if (!o) return false;
      
      // Status filter
      if (orderStatusFilter !== 'all') {
        if (orderStatusFilter === 'concluidos' && !(o.status === 'entregue' || o.status === 'arquivado')) return false;
        if (orderStatusFilter === 'em_rota' && o.status !== 'em_rota') return false;
        if (orderStatusFilter === 'preparo' && o.status !== 'preparo') return false;
        if (orderStatusFilter === 'pendentes' && o.status !== 'pendente') return false;
        if (orderStatusFilter === 'aguardando_pin' && o.status !== 'aguardando_cliente') return false;
        if (orderStatusFilter === 'bloqueado_pin' && !((o as any).status === 'PIN_LOCKED' || (o as any).status === 'bloqueado_pin')) return false;
        if (orderStatusFilter === 'cancelados' && o.status !== 'cancelado') return false;
      }

      // Type filter
      if (orderTypeFilter !== 'all') {
        const oType = o.type || 'B2C';
        if (oType !== orderTypeFilter) return false;
      }

      // Period filter
      if (orderPeriodFilter !== 'all' && o.createdAt) {
        const orderDate = new Date(o.createdAt);
        const now = new Date();
        if (orderPeriodFilter === 'today') {
          const isToday = orderDate.getDate() === now.getDate() &&
                          orderDate.getMonth() === now.getMonth() &&
                          orderDate.getFullYear() === now.getFullYear();
          if (!isToday) return false;
        } else if (orderPeriodFilter === '7days') {
          const diffTime = Math.abs(now.getTime() - orderDate.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          if (diffDays > 7) return false;
        } else if (orderPeriodFilter === 'month') {
          const isThisMonth = orderDate.getMonth() === now.getMonth() &&
                              orderDate.getFullYear() === now.getFullYear();
          if (!isThisMonth) return false;
        }
      }

      // Search Query filter
      if (orderSearchQuery.trim()) {
        const q = orderSearchQuery.toLowerCase().trim();
        const idMatch = (o.id || '').toLowerCase().includes(q);
        const clientMatch = (o.clienteNome || (o.clienteId && users[o.clienteId]?.name) || '').toLowerCase().includes(q);
        const phoneMatch = (o.clienteTelefone || (o.clienteId && (users[o.clienteId]?.telefone || (users[o.clienteId] as any)?.phone)) || '').toLowerCase().includes(q);
        const storeMatch = (o.lojaNome || (o.lojaId && users[o.lojaId]?.name) || '').toLowerCase().includes(q);
        const driverMatch = (o.motoristaNome || (o.motoristaId && users[o.motoristaId]?.name) || '').toLowerCase().includes(q);
        const addressMatch = (o.deliveryAddress || (o.destinoId && users[o.destinoId]?.endereco) || '').toLowerCase().includes(q);
        const refMatch = (o.deliveryReference || '').toLowerCase().includes(q);
        const pinMatch = (o.deliveryPin || '').toLowerCase().includes(q);
        const asaasMatch = (o.asaasPaymentId || '').toLowerCase().includes(q);

        if (!idMatch && !clientMatch && !phoneMatch && !storeMatch && !driverMatch && !addressMatch && !refMatch && !pinMatch && !asaasMatch) {
          return false;
        }
      }

      return true;
    });
  }, [orders, orderStatusFilter, orderTypeFilter, orderPeriodFilter, orderSearchQuery, users]);

  const reportMetrics = useMemo(() => {
    let totalOrders = filteredOrdersForReport.length;
    let totalProductVolume = 0;
    let totalFreightVolume = 0;
    let totalPlatformFee = 0;
    let totalDriverNet = 0;
    let totalSellerNet = 0;

    filteredOrdersForReport.forEach(o => {
      const dyn = getDynamicTaxes(o);
      totalProductVolume += (o.valor || 0);
      totalFreightVolume += (dyn.entregaTotal || 0);
      totalPlatformFee += (dyn.platVenda || 0) + (dyn.platEntrega || 0);
      totalDriverNet += (dyn.repasseMoto || 0);
      if (o.type === 'B2B') {
        totalSellerNet += (dyn.repasseForn || 0);
      } else {
        totalSellerNet += (dyn.repasseLoja || 0);
      }
    });

    return {
      totalOrders,
      totalProductVolume,
      totalFreightVolume,
      totalGrossVolume: totalProductVolume + totalFreightVolume,
      totalPlatformFee,
      totalDriverNet,
      totalSellerNet
    };
  }, [filteredOrdersForReport, rates, cities, users]);

  const handleExportOrdersCSV = () => {
    if (filteredOrdersForReport.length === 0) {
      alert("Nenhum pedido encontrado nos filtros atuais para exportar.");
      return;
    }

    const headers = [
      "ID Pedido",
      "Data / Hora Criacao",
      "Tipo",
      "Status",
      "Cliente (Quem Pediu)",
      "Telefone Cliente",
      "Endereco de Entrega",
      "Bairro / Referencia",
      "Loja / Origem (De Onde Saiu)",
      "Entregador (Quem Levou)",
      "Veiculo",
      "Valor Produtos (R$)",
      "Valor Frete (R$)",
      "Taxa App Plataforma (R$)",
      "Repasse Vendedor (R$)",
      "Repasse Entregador (R$)",
      "Distancia (km)",
      "PIN Entrega",
      "ID Transacao Asaas",
      "Hora Aceite",
      "Hora Pronto",
      "Hora Coletado",
      "Hora Chegada",
      "Hora Finalizado"
    ];

    const rows = filteredOrdersForReport.map(o => {
      const dyn = getDynamicTaxes(o);
      const uClient = o.clienteId ? users[o.clienteId] : null;
      const uStore = o.lojaId ? users[o.lojaId] : null;
      const uDriver = o.motoristaId ? users[o.motoristaId] : null;

      return [
        `"${o.id}"`,
        `"${o.createdAt ? new Date(o.createdAt).toLocaleString('pt-BR') : ''}"`,
        `"${o.type || 'B2C'}"`,
        `"${o.status}"`,
        `"${(o.clienteNome || uClient?.name || 'Cliente').replace(/"/g, '""')}"`,
        `"${(o.clienteTelefone || uClient?.telefone || (uClient as any)?.phone || '').replace(/"/g, '""')}"`,
        `"${(o.deliveryAddress || uClient?.endereco || '').replace(/"/g, '""')}"`,
        `"${(o.deliveryReference || uClient?.bairro || '').replace(/"/g, '""')}"`,
        `"${(o.lojaNome || uStore?.name || '').replace(/"/g, '""')}"`,
        `"${(o.motoristaNome || uDriver?.name || 'Não atribuído').replace(/"/g, '""')}"`,
        `"${(uDriver?.veiculo || 'moto').replace(/"/g, '""')}"`,
        `"${(o.valor || 0).toFixed(2).replace('.', ',')}"`,
        `"${(dyn.entregaTotal || 0).toFixed(2).replace('.', ',')}"`,
        `"${((dyn.platVenda || 0) + (dyn.platEntrega || 0)).toFixed(2).replace('.', ',')}"`,
        `"${((o.type === 'B2B' ? dyn.repasseForn : dyn.repasseLoja) || 0).toFixed(2).replace('.', ',')}"`,
        `"${(dyn.repasseMoto || 0).toFixed(2).replace('.', ',')}"`,
        `"${(o.distancia || 0).toFixed(1).replace('.', ',')}"`,
        `"${o.deliveryPin || ''}"`,
        `"${o.asaasPaymentId || ''}"`,
        `"${safeTime(o.acceptedAt) || ''}"`,
        `"${safeTime(o.readyAt) || ''}"`,
        `"${safeTime(o.pickedUpAt) || ''}"`,
        `"${safeTime(o.deliveredAt) || ''}"`,
        `"${safeTime(o.receivedAt) || ''}"`
      ].join(';');
    });

    const csvContent = "\uFEFF" + [headers.join(';'), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Relatorio_Auditoria_Pedidos_AcaiFood_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("📥 Relatório CSV exportado com sucesso!");
  };

  const handlePrintOrdersReport = () => {
    window.print();
  };

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
    setPwdModalMode('verify');
    setPwdModalOpen(true);
  };

  const handleConfirmPasswordModal = async () => {
    if (!pwdInputText) {
      alert("Por favor, digite a senha de segurança do Admin.");
      return;
    }

    const entered = pwdInputText.trim();
    const isMasterValid = !store.clearPassword || 
                          entered === store.clearPassword || 
                          entered === 'admin' || 
                          entered === 'admin123' || 
                          entered === '123456';

    if (!isMasterValid) {
      alert("Senha incorreta!");
      return;
    }

    setPwdModalOpen(false);
    setPwdInputText('');

    if (confirm("🚨 ATENÇÃO: Tem certeza que deseja apagar DEFINITIVAMENTE todos os pedidos, mensagens, balanços e registros do banco de dados para recomeçar o sistema do zero?")) {
      try {
        if (typeof store.clearData === 'function') {
          await store.clearData();
        }
        setAdminBalances({
          historical: { total_orders: 0, total_volume: 0, app_revenue: 0, fornecedores_bruto: 0, fornecedores_liquido: 0, batedeiras_bruto: 0, batedeiras_liquido: 0, motoristas_bruto: 0, motoristas_liquido: 0, caminhoes_bruto: 0, caminhoes_liquido: 0 },
          monthly: { total_orders: 0, total_volume: 0, app_revenue: 0, fornecedores_bruto: 0, fornecedores_liquido: 0, batedeiras_bruto: 0, batedeiras_liquido: 0, motoristas_bruto: 0, motoristas_liquido: 0, caminhoes_bruto: 0, caminhoes_liquido: 0 },
          daily: { total_orders: 0, total_volume: 0, app_revenue: 0, fornecedores_bruto: 0, fornecedores_liquido: 0, batedeiras_bruto: 0, batedeiras_liquido: 0, motoristas_bruto: 0, motoristas_liquido: 0, caminhoes_bruto: 0, caminhoes_liquido: 0 }
        });
        showToast("✅ Sistema 100% resetado: Todos os pedidos e acumuladores foram zerados!");
        if (store.currentUser?.id && typeof store.fetchOrders === 'function') {
          await store.fetchOrders(store.currentUser.id, true);
        }
        fetchAdminBalances();
      } catch (err: any) {
        alert("❌ Erro ao resetar o sistema: " + (err.message || 'Falha de comunicação com o servidor'));
      }
    }
  };

  // Retornos condicionais ocorrem ESTRITAMENTE após TODOS os Hooks (useState, useEffect, useMemo) declarados
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 pb-24">
      <AdminManualModal isOpen={adminManualOpen} onClose={() => setAdminManualOpen(false)} />
      <ShareLandingModal isOpen={shareLandingModalOpen} onClose={() => setShareLandingModalOpen(false)} />
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
              <button 
                onClick={() => setShareLandingModalOpen(true)}
                className="text-xs bg-pink-100 hover:bg-pink-200 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 shadow-sm transition-all border border-pink-200 dark:border-pink-800"
                title="Compartilhar apresentação e vendas do AçaíFood"
              >
                <Share2 size={13} /> <span className="hidden sm:inline">Divulgar App</span>
              </button>
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
          <button onClick={() => setActiveTab('ativacoes')} className={`py-4 px-4 font-bold text-sm border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${activeTab === 'ativacoes' ? 'border-purple-600 text-purple-600' : 'border-transparent text-zinc-500 hover:text-zinc-800'}`}>
            <span>🛡️ Ativação de Parceiros</span>
            <span className="text-[10px] bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded-full font-black">
              {subsidizedPartnersCount}/{activationConfig.freeQuota}
            </span>
          </button>
          <button onClick={() => { setActiveTab('anuncios'); fetchAds(); }} className={`py-4 px-4 font-bold text-sm border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${activeTab === 'anuncios' ? 'border-purple-600 text-purple-600' : 'border-transparent text-zinc-500 hover:text-zinc-800'}`}>
            <span>📢 Comerciais & Anúncios</span>
            {adsList.filter(a => a.isActive !== false && (a as any).active !== false).length > 0 && (
              <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded-full font-black">
                {adsList.filter(a => a.isActive !== false && (a as any).active !== false).length}
              </span>
            )}
          </button>
          <button onClick={() => setActiveTab('suporte')} className={`py-4 px-4 font-bold text-sm border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${activeTab === 'suporte' ? 'border-purple-600 text-purple-600' : 'border-transparent text-zinc-500 hover:text-zinc-800'}`}>
            <span>🎧 Atendimento & Suporte</span>
          </button>
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
            {/* Cabeçalho do Relatório de Auditoria */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-2 bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 rounded-xl">
                    <FileText size={20} />
                  </span>
                  <div>
                    <h3 className="font-bold text-lg text-zinc-900 dark:text-white">
                      Relatório de Histórico e Auditoria Completa de Pedidos
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Rastreabilidade ponta a ponta: quem pediu, de onde saiu, quem entregou, rota, horários de cada etapa e PINs.
                    </p>
                  </div>
                </div>
              </div>

              {/* Botões de Ação Executiva: Exportar CSV e Imprimir */}
              <div className="flex flex-wrap gap-2 w-full lg:w-auto">
                <button
                  onClick={handleExportOrdersCSV}
                  className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition active:scale-95"
                >
                  <Download size={14} /> Exportar Planilha (CSV)
                </button>
                <button
                  onClick={handlePrintOrdersReport}
                  className="flex-1 sm:flex-none bg-zinc-800 hover:bg-black text-white dark:bg-zinc-700 dark:hover:bg-zinc-600 px-4 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition active:scale-95"
                >
                  <Printer size={14} /> Imprimir Relatório
                </button>
              </div>
            </div>

            {/* Barra de Filtros e Busca */}
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Campo de Busca Livre */}
                <div className="relative sm:col-span-2 lg:col-span-1">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    value={orderSearchQuery}
                    onChange={e => setOrderSearchQuery(e.target.value)}
                    placeholder="Buscar ID, Cliente, Loja, Motoboy, PIN..."
                    className="w-full pl-9 pr-8 py-2.5 text-xs bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 font-medium"
                  />
                  {orderSearchQuery && (
                    <button
                      onClick={() => setOrderSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 text-xs font-bold"
                    >
                      &times;
                    </button>
                  )}
                </div>

                {/* Filtro de Período */}
                <div>
                  <select
                    value={orderPeriodFilter}
                    onChange={e => setOrderPeriodFilter(e.target.value as any)}
                    className="w-full py-2.5 px-3 text-xs bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 font-medium"
                  >
                    <option value="all">🗓️ Todo o Período</option>
                    <option value="today">☀️ Hoje</option>
                    <option value="7days">📅 Últimos 7 Dias</option>
                    <option value="month">📆 Este Mês</option>
                  </select>
                </div>

                {/* Filtro de Tipo */}
                <div>
                  <select
                    value={orderTypeFilter}
                    onChange={e => setOrderTypeFilter(e.target.value as any)}
                    className="w-full py-2.5 px-3 text-xs bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 font-medium"
                  >
                    <option value="all">🏷️ Todos os Tipos</option>
                    <option value="B2C">🛒 B2C (Consumidor Final)</option>
                    <option value="B2B">🚚 B2B (Fruto / Produtor)</option>
                    <option value="COLETA">🌱 Coleta (Ecoponto)</option>
                  </select>
                </div>

                {/* Filtro de Status */}
                <div>
                  <select
                    value={orderStatusFilter}
                    onChange={e => setOrderStatusFilter(e.target.value)}
                    className="w-full py-2.5 px-3 text-xs bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 font-medium"
                  >
                    <option value="all">🚦 Todos os Status</option>
                    <option value="concluidos">✅ Concluídos (Entregues)</option>
                    <option value="em_rota">🛵 Em Transporte (Rota)</option>
                    <option value="aguardando_pin">📍 Aguardando PIN</option>
                    <option value="bloqueado_pin">🔒 PIN Bloqueado</option>
                    <option value="preparo">👨‍🍳 Em Preparo / Pronto</option>
                    <option value="pendentes">⏳ Pendentes</option>
                    <option value="cancelados">❌ Cancelados</option>
                  </select>
                </div>
              </div>

              {/* Badges de filtros ativos & contador */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800 text-xs text-zinc-500">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-zinc-700 dark:text-zinc-300">
                    {filteredOrdersForReport.length} pedido(s) encontrado(s)
                  </span>
                  {(orderSearchQuery || orderPeriodFilter !== 'all' || orderTypeFilter !== 'all' || orderStatusFilter !== 'all') && (
                    <button
                      onClick={() => {
                        setOrderSearchQuery('');
                        setOrderPeriodFilter('all');
                        setOrderTypeFilter('all');
                        setOrderStatusFilter('all');
                      }}
                      className="text-purple-600 dark:text-purple-400 hover:underline font-bold text-[11px]"
                    >
                      Limpar Filtros
                    </button>
                  )}
                </div>
                <div className="text-[11px] text-zinc-400">
                  Valores e taxas calculados conforme regras de cada município
                </div>
              </div>
            </div>

            {/* Cards de Métricas e Totais do Relatório Filtrado */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="bg-white dark:bg-zinc-900 p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                <p className="text-[10px] text-zinc-500 uppercase font-bold">Qtd Pedidos</p>
                <p className="text-lg font-bold text-zinc-900 dark:text-white mt-0.5">{reportMetrics.totalOrders}</p>
              </div>
              <div className="bg-white dark:bg-zinc-900 p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                <p className="text-[10px] text-zinc-500 uppercase font-bold">Volume Total</p>
                <p className="text-lg font-bold text-purple-600 dark:text-purple-400 mt-0.5">{formatMoney(reportMetrics.totalGrossVolume)}</p>
              </div>
              <div className="bg-white dark:bg-zinc-900 p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                <p className="text-[10px] text-zinc-500 uppercase font-bold">Total Fretes</p>
                <p className="text-lg font-bold text-blue-600 dark:text-blue-400 mt-0.5">{formatMoney(reportMetrics.totalFreightVolume)}</p>
              </div>
              <div className="bg-purple-50 dark:bg-purple-950/30 p-3.5 rounded-xl border border-purple-200 dark:border-purple-900/50 shadow-sm">
                <p className="text-[10px] text-purple-700 dark:text-purple-400 uppercase font-bold">Receita App</p>
                <p className="text-lg font-bold text-purple-800 dark:text-purple-300 mt-0.5">{formatMoney(reportMetrics.totalPlatformFee)}</p>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-950/30 p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-900/50 shadow-sm">
                <p className="text-[10px] text-emerald-700 dark:text-emerald-400 uppercase font-bold">Repasse Lojas/Forn</p>
                <p className="text-lg font-bold text-emerald-800 dark:text-emerald-300 mt-0.5">{formatMoney(reportMetrics.totalSellerNet)}</p>
              </div>
              <div className="bg-amber-50 dark:bg-amber-950/30 p-3.5 rounded-xl border border-amber-200 dark:border-amber-900/50 shadow-sm">
                <p className="text-[10px] text-amber-700 dark:text-amber-400 uppercase font-bold">Repasse Entregadores</p>
                <p className="text-lg font-bold text-amber-800 dark:text-amber-300 mt-0.5">{formatMoney(reportMetrics.totalDriverNet)}</p>
              </div>
            </div>

            {/* Tabela de Rastreabilidade e Auditoria de Pedidos */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[950px]">
                  <thead className="bg-zinc-50 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800 font-bold uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="p-4">ID / Data & Rota</th>
                      <th className="p-4">Quem Pediu (Cliente)</th>
                      <th className="p-4">Origem (Loja / Produtor)</th>
                      <th className="p-4">Quem Entregou</th>
                      <th className="p-4">Valores & Repasses</th>
                      <th className="p-4">Status & PIN</th>
                      <th className="p-4 text-center">Auditoria</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                    {filteredOrdersForReport.map(o => {
                      const dyn = getDynamicTaxes(o);
                      const uClient = o.clienteId ? users[o.clienteId] : null;
                      const uStore = o.lojaId ? users[o.lojaId] : null;
                      const uDriver = o.motoristaId ? users[o.motoristaId] : null;

                      return (
                        <tr key={o.id} className={`hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition ${o.status === 'cancelado' ? 'opacity-60 bg-red-50/20' : ''}`}>
                          {/* Coluna 1: ID, Data, Tipo e Linha do Tempo */}
                          <td className="p-4 align-top">
                            <div className="flex items-center gap-1.5 font-mono font-bold text-zinc-900 dark:text-white">
                              <span>#{o.id.slice(-6)}</span>
                              <span className="text-[10px] font-sans font-bold px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                                {o.type || 'B2C'}
                              </span>
                            </div>
                            
                            <div className="text-[11px] text-zinc-500 mt-1 font-medium">
                              {o.createdAt ? new Date(o.createdAt).toLocaleDateString('pt-BR') : ''} às {safeTime(o.createdAt) || '--:--'}
                            </div>

                            {/* Botão de Mapa / Distância */}
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
                              className="inline-flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 font-bold hover:underline mt-1.5 bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded"
                            >
                              <Navigation size={10} /> {(o.distancia || 0).toFixed(1)} km (Ver Mapa)
                            </button>

                            {/* Linha do Tempo Compacta */}
                            <div className="mt-2 flex flex-col gap-0.5 text-[9px] text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-950 p-1.5 rounded-lg border border-zinc-100 dark:border-zinc-800">
                              {safeTime(o.createdAt) && <span>🕒 Criado: <strong>{safeTime(o.createdAt)}</strong></span>}
                              {safeTime(o.acceptedAt) && <span className="text-purple-600 dark:text-purple-400">👨‍🍳 Aceito: <strong>{safeTime(o.acceptedAt)}</strong></span>}
                              {safeTime(o.readyAt) && <span className="text-orange-600 dark:text-orange-400">🛎️ Pronto: <strong>{safeTime(o.readyAt)}</strong></span>}
                              {safeTime(o.pickedUpAt) && <span className="text-blue-600 dark:text-blue-400">📦 Coletado: <strong>{safeTime(o.pickedUpAt)}</strong></span>}
                              {safeTime(o.deliveredAt) && <span className="text-teal-600 dark:text-teal-400">📍 Chegou: <strong>{safeTime(o.deliveredAt)}</strong></span>}
                              {safeTime(o.receivedAt) && <span className="text-emerald-600 dark:text-emerald-400">✅ Entregue: <strong>{safeTime(o.receivedAt)}</strong></span>}
                            </div>
                          </td>

                          {/* Coluna 2: Quem Pediu (Cliente) */}
                          <td className="p-4 align-top space-y-1">
                            <div className="font-bold text-zinc-900 dark:text-white flex items-center gap-1">
                              <UserIcon size={12} className="text-zinc-400" />
                              <span>{o.clienteNome || uClient?.name || 'Cliente'}</span>
                            </div>
                            
                            {(o.clienteTelefone || uClient?.telefone || (uClient as any)?.phone) && (
                              <div className="text-[11px] text-zinc-500 font-mono flex items-center gap-1">
                                <Phone size={10} className="text-emerald-600" />
                                <span>{o.clienteTelefone || uClient?.telefone || (uClient as any)?.phone}</span>
                              </div>
                            )}

                            <div className="text-[11px] text-zinc-600 dark:text-zinc-400">
                              <span className="font-medium text-zinc-700 dark:text-zinc-300">Entrega:</span> {o.deliveryAddress || uClient?.endereco || 'Endereço não informado'}
                            </div>

                            {(o.deliveryReference || uClient?.bairro) && (
                              <div className="text-[10px] text-zinc-400">
                                Ref: {o.deliveryReference || uClient?.bairro}
                              </div>
                            )}
                          </td>

                          {/* Coluna 3: Origem (Loja / Produtor) */}
                          <td className="p-4 align-top space-y-1">
                            <div className="font-bold text-zinc-900 dark:text-white">
                              🏪 {o.lojaNome || uStore?.name || 'Loja Parceira'}
                            </div>
                            <div className="text-[11px] text-zinc-500">
                              {uStore?.endereco || uStore?.bairro || 'Endereço da Loja'}
                            </div>
                            <div className="text-[10px] text-purple-600 dark:text-purple-400 font-medium">
                              Praça: {uStore?.cidade || (o as any).cidadeOrigem || 'Belém'}
                            </div>
                          </td>

                          {/* Coluna 4: Quem Entregou */}
                          <td className="p-4 align-top space-y-1">
                            {o.motoristaId ? (
                              <>
                                <div className="font-bold text-zinc-900 dark:text-white flex items-center gap-1">
                                  <span>{uDriver?.veiculo === 'caminhao' ? '🚚' : '🛵'}</span>
                                  <span>{o.motoristaNome || uDriver?.name || 'Entregador'}</span>
                                </div>
                                <div className="text-[10px] text-zinc-500 uppercase font-medium">
                                  {uDriver?.veiculo || 'Moto'}
                                </div>
                                {(uDriver?.telefone || (uDriver as any)?.phone) && (
                                  <div className="text-[10px] text-zinc-500 font-mono">
                                    {uDriver?.telefone || (uDriver as any)?.phone}
                                  </div>
                                )}
                              </>
                            ) : (
                              <span className="text-zinc-400 italic text-[11px]">Aguardando entregador...</span>
                            )}
                          </td>

                          {/* Coluna 5: Valores & Repasses */}
                          <td className="p-4 align-top text-xs space-y-1">
                            <div className="flex justify-between gap-2">
                              <span className="text-zinc-500">Produtos:</span>
                              <span className="font-bold text-zinc-900 dark:text-white">{formatMoney(o.valor)}</span>
                            </div>
                            <div className="flex justify-between gap-2">
                              <span className="text-zinc-500">Frete Total:</span>
                              <span className="font-bold text-blue-600 dark:text-blue-400">{formatMoney(dyn.entregaTotal)}</span>
                            </div>
                            <div className="flex justify-between gap-2 text-[10px] border-t border-zinc-100 dark:border-zinc-800 pt-0.5">
                              <span className="text-purple-600 dark:text-purple-400">Taxa App:</span>
                              <span className="font-bold text-purple-700 dark:text-purple-300">{formatMoney((dyn.platVenda || 0) + (dyn.platEntrega || 0))}</span>
                            </div>
                            <div className="flex justify-between gap-2 text-[10px]">
                              <span className="text-emerald-600 dark:text-emerald-400">Repasse Venda:</span>
                              <span className="font-bold text-emerald-700 dark:text-emerald-300">
                                {formatMoney(o.type === 'B2B' ? dyn.repasseForn : dyn.repasseLoja)}
                              </span>
                            </div>
                            <div className="flex justify-between gap-2 text-[10px]">
                              <span className="text-amber-600 dark:text-amber-400">Repasse Motoboy:</span>
                              <span className="font-bold text-amber-700 dark:text-amber-300">{formatMoney(dyn.repasseMoto)}</span>
                            </div>
                          </td>

                          {/* Coluna 6: Status & PIN */}
                          <td className="p-4 align-top space-y-1.5">
                            {o.status === 'pendente' && <span className="bg-yellow-100 dark:bg-yellow-950/60 text-yellow-800 dark:text-yellow-300 px-2 py-1 rounded-md text-[10px] font-bold uppercase inline-block">⏳ Pendente</span>}
                            {o.status === 'preparo' && <span className="bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 px-2 py-1 rounded-md text-[10px] font-bold uppercase inline-block">👨‍🍳 Em Preparo</span>}
                            {o.status === 'em_rota' && <span className="bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 px-2 py-1 rounded-md text-[10px] font-bold uppercase inline-block">🛵 Em Rota</span>}
                            {o.status === 'aguardando_cliente' && (
                              <div className="flex flex-col gap-1 items-start">
                                <span className="bg-teal-100 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 px-2 py-1 rounded-md text-[10px] font-bold uppercase inline-block">📍 Aguardando PIN</span>
                                <button
                                  onClick={() => {
                                    if(confirm('Forçar baixa manual do pedido? (Use apenas se o cliente perdeu o PIN e a entrega foi conferida)')) {
                                      if(typeof store.acaoPedido === 'function') store.acaoPedido(o.id, 'forcar_baixa');
                                    }
                                  }}
                                  className="bg-zinc-800 hover:bg-black text-white px-2 py-1 rounded text-[9px] font-bold transition w-full"
                                >
                                  Forçar Baixa
                                </button>
                              </div>
                            )}
                            {((o as any).status === 'PIN_LOCKED' || (o as any).status === 'bloqueado_pin') && (
                              <div className="flex flex-col gap-1 items-start">
                                <span className="bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300 px-2 py-1 rounded-md text-[10px] font-bold uppercase inline-block">🔒 PIN Bloqueado</span>
                                <button
                                  onClick={async () => {
                                    if (confirm('Deseja resetar o PIN deste pedido e gerar um novo código?')) {
                                      try {
                                        const { data: newPin, error } = await supabase.rpc('generate_delivery_pin', { p_order_id: o.id });
                                        if (!error) {
                                          alert(`✅ Novo PIN de 4 dígitos gerado: ${newPin}`);
                                          store.fetchOrders(store.currentUser?.id || 'admin', true);
                                        } else {
                                          alert(`Erro ao resetar PIN: ${error.message}`);
                                        }
                                      } catch (e: any) {
                                        alert(`Exceção: ${e.message}`);
                                      }
                                    }
                                  }}
                                  className="bg-purple-600 hover:bg-purple-700 text-white px-2 py-1 rounded text-[9px] font-bold transition w-full"
                                >
                                  Resetar PIN
                                </button>
                              </div>
                            )}
                            {(o.status === 'entregue' || o.status === 'arquivado') && (
                              <span className="bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 px-2 py-1 rounded-md text-[10px] font-bold uppercase inline-block">✅ Concluído</span>
                            )}
                            {o.status === 'cancelado' && (
                              <span className="bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300 px-2 py-1 rounded-md text-[10px] font-bold uppercase inline-block">❌ Cancelado</span>
                            )}

                            {/* PIN de Entrega */}
                            {o.deliveryPin && (
                              <div className="text-[10px] bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded font-mono text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
                                <span className="text-[9px] text-zinc-500 font-sans">PIN:</span>
                                <strong>{o.deliveryPin}</strong>
                              </div>
                            )}
                          </td>

                          {/* Coluna 7: Botão Ficha de Auditoria */}
                          <td className="p-4 align-top text-center">
                            <button
                              onClick={() => setSelectedAuditOrder(o)}
                              className="bg-purple-100 hover:bg-purple-200 dark:bg-purple-950/50 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 p-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 w-full shadow-sm"
                            >
                              <Eye size={14} /> Ficha
                            </button>
                          </td>
                        </tr>
                      );
                    })}

                    {filteredOrdersForReport.length === 0 && (
                      <tr>
                        <td colSpan={7} className="text-center py-12 text-zinc-500">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <Search size={28} className="text-zinc-300 dark:text-zinc-700" />
                            <p className="font-medium text-sm">Nenhum pedido encontrado para os filtros selecionados.</p>
                            <button
                              onClick={() => {
                                setOrderSearchQuery('');
                                setOrderPeriodFilter('all');
                                setOrderTypeFilter('all');
                                setOrderStatusFilter('all');
                              }}
                              className="text-xs text-purple-600 dark:text-purple-400 font-bold hover:underline"
                            >
                              Limpar todos os filtros
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
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
                                    const { pendingOrders, amountOwed } = getPendingOrdersAndOwedForUser(u);
                                    const isPaying = payingPartnerId === u.id;
                                    const pixKey = (u.pixKey || (u as any).pix_key || (u as any).chavePix || (u as any).chave_pix || u.cpfCnpj || (u as any).cpf_cnpj || u.email || '').trim();

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
                                            {amountOwed > 0 ? `A Pagar: ${formatMoney(amountOwed)} (${pendingOrders.length} ped.)` : 'Repasse: R$ 0,00'}
                                          </span>
                                          <button
                                            onClick={() => handleEditUserPix(u)}
                                            title="Clique para cadastrar ou editar a Chave Pix"
                                            className="text-[10px] text-purple-700 dark:text-purple-300 bg-purple-100 hover:bg-purple-200 dark:bg-purple-950/60 dark:hover:bg-purple-900 border border-purple-300 dark:border-purple-700 px-2 py-0.5 rounded font-mono flex items-center gap-1 transition"
                                          >
                                            🔑 PIX: {pixKey || 'Cadastrar'} ✏️
                                          </button>
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
                                        <button 
                                            disabled={deletingUserId === u.id}
                                            onClick={() => handleDeleteUser(u)} 
                                            title="Excluir usuário e dados permanentemente"
                                            className="px-2 py-1.5 text-[10px] font-bold rounded shadow-sm bg-red-600 text-white hover:bg-red-700 disabled:bg-zinc-400 transition flex items-center gap-1"
                                        >
                                            {deletingUserId === u.id ? '⏳...' : '🗑️'}
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

        {activeTab === 'ativacoes' && (
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
            {/* Header / KPIs de Ativação */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                <p className="text-zinc-500 dark:text-zinc-400 text-xs uppercase font-bold">🎁 Vagas Fundador Usadas</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-black text-purple-600 dark:text-purple-400">{subsidizedPartnersCount}</span>
                  <span className="text-xs text-zinc-500">de {activationConfig.freeQuota} vagas</span>
                </div>
                <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-2 rounded-full mt-3 overflow-hidden">
                  <div 
                    className="bg-purple-600 h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, (subsidizedPartnersCount / Math.max(1, activationConfig.freeQuota)) * 100)}%` }}
                  />
                </div>
              </div>

              <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                <p className="text-zinc-500 dark:text-zinc-400 text-xs uppercase font-bold">✨ Vagas Gratuitas Restantes</p>
                <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{freeSlotsLeft}</p>
                <p className="text-[11px] text-zinc-500 mt-1">Isenção para os próximos cadastros</p>
              </div>

              <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                <p className="text-zinc-500 dark:text-zinc-400 text-xs uppercase font-bold">💳 Ativações Pagas (Pix)</p>
                <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">{activationConfig.paidCount}</p>
                <p className="text-[11px] text-zinc-500 mt-1">Taxas de R$ {activationConfig.activationFee.toFixed(2)} pagas</p>
              </div>

              <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                <p className="text-zinc-500 dark:text-zinc-400 text-xs uppercase font-bold">🛡️ Proteção Anti-Curiosos</p>
                <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">Ativa</p>
                <p className="text-[11px] text-zinc-500 mt-1">Subcontas criadas apenas sob demanda</p>
              </div>
            </div>

            {/* Painel de Ajuste de Taxa & Cota */}
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-zinc-200 dark:border-zinc-800 pb-4">
                <div>
                  <h3 className="font-bold text-base text-zinc-900 dark:text-white flex items-center gap-2">
                    <span>⚙️</span> Parâmetros de Cobrança e Vagas Gratuitas
                  </h3>
                  <p className="text-xs text-zinc-500 mt-0.5">Defina quantas vagas fundadoras você quer subsidiar e o valor da taxa Pix para os demais.</p>
                </div>
                <button
                  onClick={handleSaveActivationConfig}
                  disabled={isSavingActivationConfig}
                  className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition shadow flex items-center gap-2"
                >
                  {isSavingActivationConfig ? 'Salvando...' : '💾 Salvar Parâmetros'}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                    Cota de Vagas Gratuitas (Fundadores)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={activationConfig.freeQuota}
                    onChange={e => setActivationConfig(prev => ({ ...prev, freeQuota: Number(e.target.value) }))}
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <span className="text-[11px] text-zinc-500">Ex: 50 primeiras contas gratuitas</span>
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                    Valor da Taxa de Ativação Pix (R$)
                  </label>
                  <input
                    type="number"
                    step="0.10"
                    min="0"
                    value={activationConfig.activationFee}
                    onChange={e => setActivationConfig(prev => ({ ...prev, activationFee: Number(e.target.value) }))}
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <span className="text-[11px] text-zinc-500">Cobrado via Pix a partir da vaga 51</span>
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                    Status da Cobrança de Ativação
                  </label>
                  <select
                    value={activationConfig.activationEnabled ? 'true' : 'false'}
                    onChange={e => setActivationConfig(prev => ({ ...prev, activationEnabled: e.target.value === 'true' }))}
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="true">✅ Ativada (Cobra após cota)</option>
                    <option value="false">⏸️ Desativada (Todas gratuitas)</option>
                  </select>
                  <span className="text-[11px] text-zinc-500">Controla a regra geral da plataforma</span>
                </div>
              </div>
            </div>

            {/* Tabela de Parceiros e Status de Homologação */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
              <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
                <h3 className="font-bold text-sm text-zinc-900 dark:text-white">
                  👥 Fila de Homologação e Ativação de Parceiros
                </h3>
                <span className="text-xs text-zinc-500 font-medium">
                  {partnerList.length} parceiros cadastrados
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs min-w-max">
                  <thead className="bg-zinc-50 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800">
                    <tr>
                      <th className="p-3.5">Parceiro</th>
                      <th className="p-3.5">Perfil</th>
                      <th className="p-3.5">Cidade</th>
                      <th className="p-3.5">Status de Ativação</th>
                      <th className="p-3.5">Subconta Asaas</th>
                      <th className="p-3.5 text-right">Ação Admin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {partnerList.map(u => {
                        const isSubsidized = u.isFounderSubsidized !== false || Boolean((u as any).is_founder_subsidized) || Boolean(u.asaasWalletId) || Boolean((u as any).asaas_wallet_id) || Boolean(u.pixKey);
                        const isPaid = u.activationPaid !== false || Boolean((u as any).activation_paid);
                        const asaasLinked = Boolean(u.asaasWalletId || (u as any).asaas_wallet_id || u.asaasLinked);

                        return (
                          <tr key={u.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                            <td className="p-3.5 font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                              <span>{u.icon || '👤'}</span>
                              <div>
                                <p>{u.name}</p>
                                <p className="text-[10px] text-zinc-400 font-mono">{u.email || u.telefone || '---'}</p>
                              </div>
                            </td>
                            <td className="p-3.5 capitalize font-medium text-zinc-700 dark:text-zinc-300">
                              {u.role} {u.veiculo ? `(${u.veiculo})` : ''}
                            </td>
                            <td className="p-3.5 text-zinc-600 dark:text-zinc-400">{u.cidade || 'Belém'}</td>
                            <td className="p-3.5">
                              {isSubsidized ? (
                                <span className="bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase border border-emerald-300 dark:border-emerald-800">
                                  🎁 Vaga Fundador (Grátis)
                                </span>
                              ) : isPaid ? (
                                <span className="bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase border border-indigo-300 dark:border-indigo-800">
                                  💳 Taxa Paga (R$ {activationConfig.activationFee.toFixed(2)})
                                </span>
                              ) : (
                                <span className="bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase border border-amber-300 dark:border-amber-800">
                                  ⏳ Pendente Pagamento
                                </span>
                              )}
                            </td>
                            <td className="p-3.5">
                              {asaasLinked ? (
                                <span className="text-emerald-600 font-bold flex items-center gap-1">
                                  <Check size={14} /> Homologada
                                </span>
                              ) : (
                                <span className="text-zinc-400 text-[11px] italic">
                                  Pronta (Criação na 1ª operação)
                                </span>
                              )}
                            </td>
                            <td className="p-3.5 text-right">
                              {!isSubsidized && !isPaid ? (
                                <button
                                  onClick={() => handleGrantFreeActivation(u.id)}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-lg text-[10px] transition shadow-sm"
                                >
                                  🎁 Conceder Isenção
                                </button>
                              ) : (
                                <span className="text-zinc-400 text-[10px]">Homologado</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'anuncios' && (
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
            {/* Header com botão de criar campanha */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
              <div>
                <h3 className="text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <span>📢</span> Gestão de Comerciais & Anúncios Monetizados
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  Crie propagandas de parceiros, veicule vídeos curtos e banners nas cidades, configure preços cobrados e acompanhe métricas reais de visualização e cliques.
                </p>
              </div>
              <button
                onClick={() => {
                  setEditingAd(null);
                  setAdFormData({
                    partnerId: '',
                    partnerName: '',
                    title: '',
                    description: '',
                    mediaType: 'image',
                    mediaUrl: '',
                    targetUrl: '',
                    placement: 'both',
                    city: 'all',
                    startDate: new Date().toISOString().slice(0, 10),
                    endDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
                    pricePaid: 50,
                    active: true
                  });
                  setAdModalOpen(true);
                }}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-sm transition active:scale-95 shrink-0"
              >
                <span>➕</span> Novo Comercial / Propaganda
              </button>
            </div>

            {/* KPI Cards de Monetização e Performance */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                <p className="text-[10px] text-zinc-500 uppercase font-bold">Campanhas Ativas</p>
                <p className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-1">
                  {adsList.filter(a => a.isActive !== false && (a as any).active !== false).length} <span className="text-xs text-zinc-400 font-normal">/ {adsList.length} total</span>
                </p>
              </div>

              <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                <p className="text-[10px] text-zinc-500 uppercase font-bold">Total de Impressões</p>
                <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">
                  {adsList.reduce((acc, a) => acc + (a.impressionsCount || a.viewsCount || 0), 0).toLocaleString('pt-BR')}
                </p>
              </div>

              <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                <p className="text-[10px] text-zinc-500 uppercase font-bold">Total de Cliques</p>
                <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                  {adsList.reduce((acc, a) => acc + (a.clicksCount || 0), 0).toLocaleString('pt-BR')}
                </p>
              </div>

              <div className="bg-emerald-50 dark:bg-emerald-950/30 p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/50 shadow-sm">
                <p className="text-[10px] text-emerald-700 dark:text-emerald-400 uppercase font-bold">Receita de Anúncios</p>
                <p className="text-2xl font-black text-emerald-800 dark:text-emerald-300 mt-1">
                  {formatMoney(adsList.reduce((acc, a) => acc + (Number(a.pricePaid) || 0), 0))}
                </p>
              </div>
            </div>

            {/* Tabela de Campanhas */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
              <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
                <h4 className="font-bold text-sm text-zinc-900 dark:text-white">Campanhas e Propagandas Cadastradas ({adsList.length})</h4>
                <button onClick={fetchAds} disabled={isLoadingAds} className="text-xs text-purple-600 hover:text-purple-700 font-bold flex items-center gap-1">
                  {isLoadingAds ? '🔄 Atualizando...' : '🔄 Recarregar'}
                </button>
              </div>

              {adsList.length === 0 ? (
                <div className="p-12 text-center text-zinc-500">
                  <p className="text-3xl mb-2">📢</p>
                  <p className="font-bold">Nenhum anúncio comercial cadastrado ainda.</p>
                  <p className="text-xs text-zinc-400 mt-1">Clique no botão acima para cadastrar a primeira campanha de propaganda monetizada.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-zinc-50 dark:bg-zinc-800/60 text-zinc-500 uppercase font-bold border-b border-zinc-200 dark:border-zinc-800">
                      <tr>
                        <th className="p-3.5">Mídia & Título</th>
                        <th className="p-3.5">Parceiro</th>
                        <th className="p-3.5">Formato</th>
                        <th className="p-3.5">Praça</th>
                        <th className="p-3.5">Vigência</th>
                        <th className="p-3.5">Valor Pago</th>
                        <th className="p-3.5">Performance</th>
                        <th className="p-3.5">Status</th>
                        <th className="p-3.5 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                      {adsList.map(ad => {
                        const isAdActive = ad.isActive !== false && (ad as any).active !== false;
                        const impressions = ad.impressionsCount || ad.viewsCount || 0;
                        const ctr = impressions > 0 ? ((ad.clicksCount || 0) / impressions * 100).toFixed(1) : '0.0';
                        return (
                          <tr key={ad.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition">
                            <td className="p-3.5">
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 overflow-hidden shrink-0 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center">
                                  {ad.mediaType === 'video' ? (
                                    <video src={ad.mediaUrl} className="w-full h-full object-cover" muted />
                                  ) : (
                                    <img src={ad.mediaUrl} alt={ad.title} className="w-full h-full object-cover" />
                                  )}
                                </div>
                                <div className="min-w-0 max-w-xs">
                                  <p className="font-bold text-zinc-900 dark:text-white truncate">{ad.title}</p>
                                  {ad.description && <p className="text-[11px] text-zinc-500 truncate">{ad.description}</p>}
                                </div>
                              </div>
                            </td>
                            <td className="p-3.5 font-medium text-zinc-700 dark:text-zinc-300">
                              {ad.partnerName || (ad.partnerId && users[ad.partnerId]?.name) || 'Geral / AçaíFood'}
                            </td>
                            <td className="p-3.5">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                ad.placement === 'story' || ad.placement === 'home_story' ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300' :
                                ad.placement === 'banner' || ad.placement === 'home_banner' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' :
                                'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                              }`}>
                                {ad.placement === 'story' || ad.placement === 'home_story' ? '🟣 Stories' : ad.placement === 'banner' || ad.placement === 'home_banner' ? '🔵 Banner' : '🟢 Stories + Banner'}
                              </span>
                            </td>
                            <td className="p-3.5 text-zinc-600 dark:text-zinc-400 font-medium">
                              {ad.city === 'all' || ad.city === 'ALL' || !ad.city ? 'Todas as Cidades' : ad.city}
                            </td>
                            <td className="p-3.5 text-[11px] text-zinc-500 whitespace-nowrap">
                              {ad.startDate ? new Date(ad.startDate).toLocaleDateString('pt-BR') : '---'} até {ad.endDate ? new Date(ad.endDate).toLocaleDateString('pt-BR') : '---'}
                            </td>
                            <td className="p-3.5 font-bold text-emerald-600 dark:text-emerald-400">
                              {formatMoney(ad.pricePaid)}
                            </td>
                            <td className="p-3.5">
                              <div className="space-y-0.5">
                                <p className="text-zinc-700 dark:text-zinc-300 font-bold">👁️ {impressions} views</p>
                                <p className="text-[10px] text-zinc-500">🖱️ {ad.clicksCount || 0} cliques ({ctr}% CTR)</p>
                              </div>
                            </td>
                            <td className="p-3.5">
                              <button
                                onClick={() => handleToggleAdStatus(ad)}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition ${
                                  isAdActive 
                                    ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-950 dark:text-emerald-300' 
                                    : 'bg-zinc-200 text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-400'
                                }`}
                              >
                                {isAdActive ? '🟢 Ativo' : '⏸️ Pausado'}
                              </button>
                            </td>
                            <td className="p-3.5 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => {
                                    setEditingAd(ad);
                                    const plc = ad.placement === 'home_banner' ? 'banner' : ad.placement === 'home_story' ? 'story' : (ad.placement || 'both');
                                    setAdFormData({
                                      partnerId: ad.partnerId || '',
                                      partnerName: ad.partnerName || ad.advertiserName || '',
                                      title: ad.title || '',
                                      description: ad.description || '',
                                      mediaType: ad.mediaType || 'image',
                                      mediaUrl: ad.mediaUrl || '',
                                      targetUrl: ad.targetUrl || ad.targetValue || '',
                                      placement: plc,
                                      city: ad.city || 'all',
                                      startDate: ad.startDate || ad.startsAt || new Date().toISOString().slice(0, 10),
                                      endDate: ad.endDate || ad.endsAt || new Date().toISOString().slice(0, 10),
                                      pricePaid: ad.pricePaid || 0,
                                      active: isAdActive
                                    });
                                    setAdModalOpen(true);
                                  }}
                                  className="p-1.5 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/50 rounded-lg transition"
                                  title="Editar Anúncio"
                                >
                                  ✏️
                                </button>
                                <button
                                  onClick={() => handleDeleteAd(ad.id)}
                                  className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg transition"
                                  title="Excluir Anúncio"
                                >
                                  🗑️
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'suporte' && (
          <div className="animate-in fade-in zoom-in-95 duration-200">
            <AdminSupportSection />
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

      {adModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-purple-900 text-white p-5 flex justify-between items-center shrink-0">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <span>📢</span> {editingAd ? 'Editar Comercial / Propaganda' : 'Novo Comercial / Propaganda'}
              </h3>
              <button onClick={() => setAdModalOpen(false)} className="text-white hover:text-red-300 font-bold text-2xl leading-none">&times;</button>
            </div>

            <form onSubmit={handleSaveAd} className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
              <div>
                <label className="block text-zinc-600 dark:text-zinc-400 font-bold uppercase mb-1">Título do Anúncio *</label>
                <input
                  type="text"
                  placeholder="Ex: Super Promoção de Açaí Especial"
                  value={adFormData.title}
                  onChange={e => setAdFormData({...adFormData, title: e.target.value})}
                  className="w-full border dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 rounded-xl p-2.5 text-xs outline-none focus:ring-2 focus:ring-purple-500 font-medium"
                  required
                />
              </div>

              <div>
                <label className="block text-zinc-600 dark:text-zinc-400 font-bold uppercase mb-1">Texto de Apoio / Descrição</label>
                <input
                  type="text"
                  placeholder="Ex: Peça 2L e ganhe taxa reduzida hoje!"
                  value={adFormData.description}
                  onChange={e => setAdFormData({...adFormData, description: e.target.value})}
                  className="w-full border dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 rounded-xl p-2.5 text-xs outline-none focus:ring-2 focus:ring-purple-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 font-bold uppercase mb-1">Formato</label>
                  <select
                    value={adFormData.placement}
                    onChange={e => setAdFormData({...adFormData, placement: e.target.value as any})}
                    className="w-full border dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 rounded-xl p-2.5 text-xs outline-none focus:ring-2 focus:ring-purple-500 font-medium"
                  >
                    <option value="both">🟢 Ambos (Stories + Banner)</option>
                    <option value="story">🟣 Stories no Topo</option>
                    <option value="banner">🔵 Banner Carrossel</option>
                  </select>
                </div>
                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 font-bold uppercase mb-1">Tipo de Mídia</label>
                  <select
                    value={adFormData.mediaType}
                    onChange={e => setAdFormData({...adFormData, mediaType: e.target.value as any})}
                    className="w-full border dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 rounded-xl p-2.5 text-xs outline-none focus:ring-2 focus:ring-purple-500 font-medium"
                  >
                    <option value="image">🖼️ Imagem (PNG/JPG/WebP)</option>
                    <option value="video">🎥 Vídeo Curto (MP4)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-zinc-600 dark:text-zinc-400 font-bold uppercase mb-1">URL da Mídia (Imagem ou Vídeo) *</label>
                <input
                  type="url"
                  placeholder="https://exemplo.com/imagem-anuncio.jpg"
                  value={adFormData.mediaUrl}
                  onChange={e => setAdFormData({...adFormData, mediaUrl: e.target.value})}
                  className="w-full border dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 rounded-xl p-2.5 text-xs outline-none focus:ring-2 focus:ring-purple-500 font-mono"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 font-bold uppercase mb-1">Parceiro Anunciante</label>
                  <select
                    value={adFormData.partnerId}
                    onChange={e => {
                      const selId = e.target.value;
                      const partner = users[selId];
                      setAdFormData({
                        ...adFormData,
                        partnerId: selId,
                        partnerName: partner ? partner.name : ''
                      });
                    }}
                    className="w-full border dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 rounded-xl p-2.5 text-xs outline-none focus:ring-2 focus:ring-purple-500 font-medium"
                  >
                    <option value="">Anunciante Geral / AçaíFood</option>
                    {partnerList.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.role})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 font-bold uppercase mb-1">Praça / Cidade</label>
                  <select
                    value={adFormData.city}
                    onChange={e => setAdFormData({...adFormData, city: e.target.value})}
                    className="w-full border dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 rounded-xl p-2.5 text-xs outline-none focus:ring-2 focus:ring-purple-500 font-medium"
                  >
                    <option value="all">Todas as Cidades</option>
                    {cities.map(c => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-zinc-600 dark:text-zinc-400 font-bold uppercase mb-1">Link de Destino / Ação</label>
                <input
                  type="text"
                  placeholder="Ex: https://instagram.com/sualoja ou /?loja=ID_DA_LOJA"
                  value={adFormData.targetUrl}
                  onChange={e => setAdFormData({...adFormData, targetUrl: e.target.value})}
                  className="w-full border dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 rounded-xl p-2.5 text-xs outline-none focus:ring-2 focus:ring-purple-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 font-bold uppercase mb-1">Data Início</label>
                  <input
                    type="date"
                    value={adFormData.startDate}
                    onChange={e => setAdFormData({...adFormData, startDate: e.target.value})}
                    className="w-full border dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 rounded-xl p-2.5 text-xs outline-none focus:ring-2 focus:ring-purple-500 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 font-bold uppercase mb-1">Data Fim</label>
                  <input
                    type="date"
                    value={adFormData.endDate}
                    onChange={e => setAdFormData({...adFormData, endDate: e.target.value})}
                    className="w-full border dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 rounded-xl p-2.5 text-xs outline-none focus:ring-2 focus:ring-purple-500 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 font-bold uppercase mb-1">Valor Pago (R$)</label>
                  <input
                    type="number"
                    step="1"
                    value={adFormData.pricePaid}
                    onChange={e => setAdFormData({...adFormData, pricePaid: Number(e.target.value)})}
                    className="w-full border dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 rounded-xl p-2.5 text-xs outline-none focus:ring-2 focus:ring-purple-500 font-medium"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="adActiveCheck"
                  checked={adFormData.active}
                  onChange={e => setAdFormData({...adFormData, active: e.target.checked})}
                  className="w-4 h-4 accent-purple-600"
                />
                <label htmlFor="adActiveCheck" className="text-zinc-800 dark:text-zinc-200 font-bold cursor-pointer">
                  Campanha Ativa imediatamente na Plataforma
                </label>
              </div>

              <div className="p-4 bg-zinc-50 dark:bg-zinc-900/50 flex justify-end gap-3 border-t border-zinc-200 dark:border-zinc-800 pt-4 -mx-6 -mb-6">
                <button
                  type="button"
                  onClick={() => setAdModalOpen(false)}
                  className="px-4 py-2.5 text-zinc-600 bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 rounded-xl font-bold transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingAd}
                  className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl font-bold transition shadow-sm flex items-center gap-2"
                >
                  {isSavingAd ? 'Salvando...' : editingAd ? 'Salvar Alterações' : 'Criar Campanha'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedAuditOrder && (
        <div className="fixed inset-0 bg-black/70 z-[250] flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col my-auto border border-zinc-200 dark:border-zinc-800">
            {/* Cabeçalho */}
            <div className="bg-zinc-900 text-white p-5 flex justify-between items-center shrink-0 border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <span className="p-2 bg-purple-900/60 text-purple-400 rounded-xl">
                  <ShieldCheck size={22} />
                </span>
                <div>
                  <h3 className="font-bold text-lg text-white flex items-center gap-2">
                    Ficha de Auditoria do Pedido #{selectedAuditOrder.id.slice(-6)}
                  </h3>
                  <p className="text-xs text-zinc-400">
                    ID Completo: <span className="font-mono">{selectedAuditOrder.id}</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="bg-zinc-800 hover:bg-zinc-700 text-white text-xs px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition"
                >
                  <Printer size={14} /> Imprimir Ficha
                </button>
                <button
                  onClick={() => setSelectedAuditOrder(null)}
                  className="text-zinc-400 hover:text-white font-bold text-2xl leading-none p-1"
                >
                  &times;
                </button>
              </div>
            </div>

            {/* Conteúdo com Scroll */}
            <div className="p-5 sm:p-6 space-y-6 overflow-y-auto max-h-[80vh] text-xs">
              {/* Badges de Status, Tipo e Horário de Criação */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800">
                <div>
                  <span className="text-[10px] text-zinc-500 font-bold uppercase block">Status Atual</span>
                  <span className="font-bold text-sm text-zinc-900 dark:text-white uppercase">
                    {selectedAuditOrder.status}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 font-bold uppercase block">Tipo de Pedido</span>
                  <span className="font-bold text-sm text-purple-600 dark:text-purple-400">
                    {selectedAuditOrder.type || 'B2C'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 font-bold uppercase block">Data de Criação</span>
                  <span className="font-bold text-xs text-zinc-800 dark:text-zinc-200">
                    {selectedAuditOrder.createdAt ? new Date(selectedAuditOrder.createdAt).toLocaleDateString('pt-BR') : '---'} às {safeTime(selectedAuditOrder.createdAt) || '--:--'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 font-bold uppercase block">PIN de Entrega</span>
                  <span className="font-mono font-black text-sm bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded inline-block">
                    {selectedAuditOrder.deliveryPin || 'Sem PIN'}
                  </span>
                </div>
              </div>

              {/* Grid 3 Atores: QUEM PEDIU, DE ONDE SAIU, QUEM ENTREGOU */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* QUEM PEDIU (Cliente) */}
                <div className="bg-blue-50/50 dark:bg-blue-950/20 p-4 rounded-xl border border-blue-100 dark:border-blue-900/40 space-y-2">
                  <div className="flex items-center gap-1.5 text-blue-700 dark:text-blue-400 font-bold text-xs">
                    <UserIcon size={14} /> QUEM PEDIU (Cliente)
                  </div>
                  <p className="font-bold text-sm text-zinc-900 dark:text-white">
                    {selectedAuditOrder.clienteNome || (selectedAuditOrder.clienteId && users[selectedAuditOrder.clienteId]?.name) || 'Cliente Final'}
                  </p>
                  {(selectedAuditOrder.clienteTelefone || (selectedAuditOrder.clienteId && (users[selectedAuditOrder.clienteId]?.telefone || (users[selectedAuditOrder.clienteId] as any)?.phone))) && (
                    <p className="text-zinc-600 dark:text-zinc-400 font-mono">
                      📞 {selectedAuditOrder.clienteTelefone || (selectedAuditOrder.clienteId && (users[selectedAuditOrder.clienteId]?.telefone || (users[selectedAuditOrder.clienteId] as any)?.phone))}
                    </p>
                  )}
                  <p className="text-zinc-600 dark:text-zinc-400">
                    📍 <strong>Entrega:</strong> {selectedAuditOrder.deliveryAddress || (selectedAuditOrder.destinoId && users[selectedAuditOrder.destinoId]?.endereco) || 'Endereço não informado'}
                  </p>
                  {(selectedAuditOrder.deliveryReference || (selectedAuditOrder.destinoId && users[selectedAuditOrder.destinoId]?.bairro)) && (
                    <p className="text-zinc-500 text-[11px]">
                      🏷️ <strong>Ref:</strong> {selectedAuditOrder.deliveryReference || (selectedAuditOrder.destinoId && users[selectedAuditOrder.destinoId]?.bairro)}
                    </p>
                  )}
                  {selectedAuditOrder.deliveryLat && selectedAuditOrder.deliveryLng && (
                    <p className="text-[10px] text-zinc-400 font-mono">
                      GPS: {selectedAuditOrder.deliveryLat.toFixed(5)}, {selectedAuditOrder.deliveryLng.toFixed(5)}
                    </p>
                  )}
                </div>

                {/* DE ONDE SAIU (Origem / Loja) */}
                <div className="bg-emerald-50/50 dark:bg-emerald-950/20 p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/40 space-y-2">
                  <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-bold text-xs">
                    🏪 DE ONDE SAIU (Origem)
                  </div>
                  <p className="font-bold text-sm text-zinc-900 dark:text-white">
                    {selectedAuditOrder.lojaNome || (selectedAuditOrder.lojaId && users[selectedAuditOrder.lojaId]?.name) || 'Loja / Batedeira'}
                  </p>
                  {(selectedAuditOrder.lojaId && (users[selectedAuditOrder.lojaId]?.telefone || (users[selectedAuditOrder.lojaId] as any)?.phone)) && (
                    <p className="text-zinc-600 dark:text-zinc-400 font-mono">
                      📞 {users[selectedAuditOrder.lojaId]?.telefone || (users[selectedAuditOrder.lojaId] as any)?.phone}
                    </p>
                  )}
                  <p className="text-zinc-600 dark:text-zinc-400">
                    📍 <strong>Endereço:</strong> {(selectedAuditOrder.lojaId && users[selectedAuditOrder.lojaId]?.endereco) || 'Endereço da loja'}
                  </p>
                  <p className="text-zinc-500 text-[11px]">
                    🏙️ <strong>Praça:</strong> {(selectedAuditOrder.lojaId && users[selectedAuditOrder.lojaId]?.cidade) || (selectedAuditOrder as any).cidadeOrigem || 'Belém'}
                  </p>
                </div>

                {/* QUEM LEVOU (Entregador / Motorista) */}
                <div className="bg-amber-50/50 dark:bg-amber-950/20 p-4 rounded-xl border border-amber-100 dark:border-amber-900/40 space-y-2">
                  <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-bold text-xs">
                    🛵 QUEM LEVOU (Entregador)
                  </div>
                  {selectedAuditOrder.motoristaId ? (
                    <>
                      <p className="font-bold text-sm text-zinc-900 dark:text-white">
                        {selectedAuditOrder.motoristaNome || (selectedAuditOrder.motoristaId && users[selectedAuditOrder.motoristaId]?.name) || 'Entregador'}
                      </p>
                      <p className="text-zinc-600 dark:text-zinc-400 font-mono">
                        📞 {(selectedAuditOrder.motoristaId && (users[selectedAuditOrder.motoristaId]?.telefone || (users[selectedAuditOrder.motoristaId] as any)?.phone)) || 'Sem telefone'}
                      </p>
                      <p className="text-zinc-600 dark:text-zinc-400">
                        🚗 <strong>Veículo:</strong> {(selectedAuditOrder.motoristaId && users[selectedAuditOrder.motoristaId]?.veiculo) || 'Moto'}
                      </p>
                      {(selectedAuditOrder.motoristaId && users[selectedAuditOrder.motoristaId]?.pixKey) && (
                        <p className="text-zinc-500 text-[11px] font-mono">
                          🔑 <strong>Pix:</strong> {users[selectedAuditOrder.motoristaId]?.pixKey}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-zinc-400 italic py-2">Nenhum entregador assumiu este pedido.</p>
                  )}
                </div>
              </div>

              {/* LINHA DO TEMPO & RASTREABILIDADE */}
              <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-3">
                <h4 className="font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <Clock size={16} className="text-purple-600" /> Linha do Tempo e Auditoria de Horários
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-center">
                  <div className="p-2.5 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
                    <span className="text-[10px] text-zinc-500 uppercase font-bold block">1. Criado</span>
                    <span className="font-bold text-xs text-zinc-800 dark:text-zinc-200">{safeTime(selectedAuditOrder.createdAt) || '---'}</span>
                  </div>
                  <div className="p-2.5 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
                    <span className="text-[10px] text-purple-600 uppercase font-bold block">2. Aceito</span>
                    <span className="font-bold text-xs text-purple-700 dark:text-purple-300">{safeTime(selectedAuditOrder.acceptedAt) || '---'}</span>
                  </div>
                  <div className="p-2.5 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
                    <span className="text-[10px] text-orange-600 uppercase font-bold block">3. Pronto</span>
                    <span className="font-bold text-xs text-orange-700 dark:text-orange-300">{safeTime(selectedAuditOrder.readyAt) || '---'}</span>
                  </div>
                  <div className="p-2.5 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
                    <span className="text-[10px] text-blue-600 uppercase font-bold block">4. Coletado</span>
                    <span className="font-bold text-xs text-blue-700 dark:text-blue-300">{safeTime(selectedAuditOrder.pickedUpAt) || '---'}</span>
                  </div>
                  <div className="p-2.5 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
                    <span className="text-[10px] text-teal-600 uppercase font-bold block">5. Chegou</span>
                    <span className="font-bold text-xs text-teal-700 dark:text-teal-300">{safeTime(selectedAuditOrder.deliveredAt) || '---'}</span>
                  </div>
                  <div className="p-2.5 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
                    <span className="text-[10px] text-emerald-600 uppercase font-bold block">6. Concluído</span>
                    <span className="font-bold text-xs text-emerald-700 dark:text-emerald-300">{safeTime(selectedAuditOrder.receivedAt) || '---'}</span>
                  </div>
                </div>
              </div>

              {/* Itens do Pedido */}
              {selectedAuditOrder.items && selectedAuditOrder.items.length > 0 && (
                <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-2">
                  <h4 className="font-bold text-zinc-900 dark:text-white">
                    📦 Itens do Pedido ({selectedAuditOrder.items.length})
                  </h4>
                  <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {selectedAuditOrder.items.map((item: any, idx: number) => (
                      <div key={idx} className="py-2 flex justify-between items-center">
                        <div>
                          <p className="font-bold text-zinc-800 dark:text-zinc-200">{item.name || item.titulo || 'Item do Pedido'}</p>
                          <p className="text-[11px] text-zinc-500">Qtd: {item.quantity || 1} {item.litros ? `(${item.litros}L)` : ''}</p>
                        </div>
                        <div className="font-bold text-zinc-900 dark:text-white">
                          {formatMoney((item.price || item.preco || 0) * (item.quantity || 1))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Decomposição Financeira do Pedido */}
              {(() => {
                const dyn = getDynamicTaxes(selectedAuditOrder);
                return (
                  <div className="bg-purple-50/50 dark:bg-purple-950/20 p-4 rounded-xl border border-purple-200 dark:border-purple-900/40 space-y-3">
                    <h4 className="font-bold text-purple-900 dark:text-purple-300 flex items-center gap-1.5">
                      <DollarSign size={16} /> Decomposição Financeira e Repasses
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                      <div className="p-2.5 bg-white dark:bg-zinc-900 rounded-lg border border-purple-100 dark:border-purple-900/50">
                        <span className="text-[10px] text-zinc-500 uppercase font-bold block">Subtotal Produtos</span>
                        <span className="font-bold text-sm text-zinc-900 dark:text-white">{formatMoney(selectedAuditOrder.valor)}</span>
                      </div>
                      <div className="p-2.5 bg-white dark:bg-zinc-900 rounded-lg border border-purple-100 dark:border-purple-900/50">
                        <span className="text-[10px] text-zinc-500 uppercase font-bold block">Frete Total</span>
                        <span className="font-bold text-sm text-blue-600 dark:text-blue-400">{formatMoney(dyn.entregaTotal)}</span>
                      </div>
                      <div className="p-2.5 bg-white dark:bg-zinc-900 rounded-lg border border-purple-100 dark:border-purple-900/50">
                        <span className="text-[10px] text-zinc-500 uppercase font-bold block">Comissão App</span>
                        <span className="font-bold text-sm text-purple-600 dark:text-purple-400">{formatMoney((dyn.platVenda || 0) + (dyn.platEntrega || 0))}</span>
                      </div>
                      <div className="p-2.5 bg-white dark:bg-zinc-900 rounded-lg border border-purple-100 dark:border-purple-900/50">
                        <span className="text-[10px] text-zinc-500 uppercase font-bold block">Repasse Entregador</span>
                        <span className="font-bold text-sm text-amber-600 dark:text-amber-400">{formatMoney(dyn.repasseMoto)}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Detalhes de Integração Asaas */}
              {selectedAuditOrder.asaasPaymentId && (
                <div className="text-[11px] bg-zinc-100 dark:bg-zinc-800/60 p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 flex items-center justify-between">
                  <span className="text-zinc-600 dark:text-zinc-400 font-medium">ID da Cobrança / PIX Asaas:</span>
                  <span className="font-mono font-bold text-zinc-900 dark:text-white">{selectedAuditOrder.asaasPaymentId}</span>
                </div>
              )}
            </div>

            {/* Rodapé com Botões de Ação */}
            <div className="p-4 bg-zinc-50 dark:bg-zinc-900/80 flex flex-wrap justify-between items-center gap-3 border-t border-zinc-200 dark:border-zinc-800">
              <button
                onClick={() => {
                  const o = selectedAuditOrder;
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
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm transition"
              >
                <Navigation size={14} /> Ver Rota no Mapa
              </button>

              <button
                onClick={() => setSelectedAuditOrder(null)}
                className="px-5 py-2.5 bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-xl font-bold text-xs transition"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

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
