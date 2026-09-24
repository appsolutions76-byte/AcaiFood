"use client";

import React, { useState, useEffect } from "react";
import { 
  AlertTriangle, CheckCircle, XCircle, Search, RefreshCw, 
  ExternalLink, DollarSign, ShieldAlert, User, Phone, Clock, FileText, ArrowRight
} from "lucide-react";
import { getAuthHeaders } from "@/store/useAppStore";

interface OrderPendingReconciliation {
  id: string;
  buyer_id: string;
  seller_storefront_id: string;
  order_type: 'B2C' | 'B2B' | 'COLETA';
  status: string;
  products_subtotal: number;
  delivery_distance_km: number;
  asaas_payment_id: string;
  asaas_charge_status: string;
  payment_reconciled_manually?: boolean;
  created_at: string;
  delivery_pin?: string;
  pickup_pin?: string;
  buyer?: {
    id: string;
    name: string;
    email: string;
    phone: string;
    cpf_cnpj: string;
  };
  store?: {
    id: string;
    store_name: string;
    partner_id: string;
  };
}

interface ReconciledOrder {
  id: string;
  buyer_id: string;
  order_type: string;
  status: string;
  products_subtotal: number;
  asaas_payment_id: string;
  payment_reconciled_manually: boolean;
  pix_end_to_end_id: string;
  charged_amount: number;
  reconciled_at: string;
  created_at: string;
  buyer?: {
    id: string;
    name: string;
    email: string;
    phone: string;
  };
}

export function AdminReconciliationSection() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingOrders, setPendingOrders] = useState<OrderPendingReconciliation[]>([]);
  const [reconciledOrders, setReconciledOrders] = useState<ReconciledOrder[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSubTab, setActiveSubTab] = useState<'pendentes' | 'historico'>('pendentes');

  // Modais de Ação
  const [confirmModalOrder, setConfirmModalOrder] = useState<OrderPendingReconciliation | null>(null);
  const [pixEndToEndId, setPixEndToEndId] = useState("");
  const [confirmedAmount, setConfirmedAmount] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [submittingAction, setSubmittingAction] = useState(false);

  const [cancelModalOrder, setCancelModalOrder] = useState<OrderPendingReconciliation | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const formatMoney = (val?: number) =>
    (val ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const fetchReconciliationData = async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/admin/reconcile-payment', { credentials: 'include', headers });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Erro ao carregar dados de conciliação');
      }
      const data = await res.json();
      setPendingOrders(data.pendingOrders || []);
      setReconciledOrders(data.reconciledOrders || []);
    } catch (err: any) {
      setError(err.message || 'Falha ao buscar conciliações');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReconciliationData();
  }, []);

  const handleOpenConfirmModal = (o: OrderPendingReconciliation) => {
    setConfirmModalOrder(o);
    setConfirmedAmount(String(o.products_subtotal || 0));
    setPixEndToEndId("");
    setNotes("");
  };

  const handleExecuteConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmModalOrder) return;
    if (!pixEndToEndId.trim()) {
      alert("Por favor, digite o ID / End-to-End do Pix recebido (ex: comprovante bancário).");
      return;
    }
    const num = Number(confirmedAmount.replace(',', '.'));
    if (isNaN(num) || num <= 0) {
      alert("Por favor, informe um valor válido recebido.");
      return;
    }

    setSubmittingAction(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/admin/reconcile-payment', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'confirm_manual',
          orderId: confirmModalOrder.id,
          pixEndToEndId: pixEndToEndId.trim(),
          confirmedAmount: num,
          notes: notes.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao processar conciliação');

      alert(`✅ ${data.message || 'Pagamento conciliado com sucesso!'}`);
      setConfirmModalOrder(null);
      await fetchReconciliationData();
    } catch (err: any) {
      alert(`⚠️ Erro: ${err.message}`);
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleExecuteCancelAndRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelModalOrder) return;

    setSubmittingAction(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/admin/reconcile-payment', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'cancel_and_refund',
          orderId: cancelModalOrder.id,
          reason: cancelReason.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao cancelar pedido');

      alert(`✅ ${data.message || 'Pedido cancelado com sucesso!'}`);
      setCancelModalOrder(null);
      await fetchReconciliationData();
    } catch (err: any) {
      alert(`⚠️ Erro: ${err.message}`);
    } finally {
      setSubmittingAction(false);
    }
  };

  const filteredPending = pendingOrders.filter(o => {
    const q = searchQuery.toLowerCase();
    const idMatch = o.id.toLowerCase().includes(q);
    const buyerMatch = o.buyer?.name?.toLowerCase().includes(q) || o.buyer?.phone?.toLowerCase().includes(q) || o.buyer?.cpf_cnpj?.toLowerCase().includes(q);
    const storeMatch = o.store?.store_name?.toLowerCase().includes(q);
    const asaasMatch = o.asaas_payment_id?.toLowerCase().includes(q);
    return idMatch || buyerMatch || storeMatch || asaasMatch;
  });

  const totalPendingAmount = pendingOrders.reduce((acc, o) => acc + (o.products_subtotal || 0), 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header & Estatísticas */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-zinc-900 dark:text-white flex items-center gap-2">
              <span>⚖️</span> Conciliação de Pagamentos Pix
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Pedidos que foram pagos por chave estática fora do Asaas e estão aguardando confirmação manual.
            </p>
          </div>
          <button
            onClick={fetchReconciliationData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition shadow-sm disabled:opacity-50 self-start md:self-auto cursor-pointer"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Atualizar Lista
          </button>
        </div>

        {/* Alerta de Regra Financeira */}
        <div className="mt-4 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
          <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <strong className="font-bold">Regra Crítica de Repasse Manual:</strong>
            <p className="mt-0.5 text-[11px] leading-relaxed">
              Pedidos confirmados manualmente <strong>NÃO possuem split automático nem saque automático no Asaas</strong>, pois o dinheiro foi recebido diretamente na conta bancária da chave. O repasse aos lojistas, fornecedores e entregadores desses pedidos deve ser realizado manualmente e registrado pela administração.
            </p>
          </div>
        </div>

        {/* Métricas */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
          <div className="bg-zinc-50 dark:bg-zinc-800/50 p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800">
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">Aguardando Conciliação</span>
            <div className="text-xl font-extrabold text-amber-600 dark:text-amber-400 mt-0.5">
              {pendingOrders.length} {pendingOrders.length === 1 ? 'pedido' : 'pedidos'}
            </div>
          </div>
          <div className="bg-zinc-50 dark:bg-zinc-800/50 p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800">
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">Volume a Conciliar</span>
            <div className="text-xl font-extrabold text-zinc-900 dark:text-white mt-0.5">
              {formatMoney(totalPendingAmount)}
            </div>
          </div>
          <div className="bg-zinc-50 dark:bg-zinc-800/50 p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800">
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">Já Conciliados Manualmente</span>
            <div className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">
              {reconciledOrders.length} pedidos
            </div>
          </div>
        </div>
      </div>

      {/* Tabs & Busca */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex bg-zinc-200 dark:bg-zinc-800 p-1 rounded-xl w-full sm:w-auto">
          <button
            onClick={() => setActiveSubTab('pendentes')}
            className={`flex-1 sm:flex-none px-4 py-1.5 text-xs font-bold rounded-lg transition ${
              activeSubTab === 'pendentes'
                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
            }`}
          >
            Pendentes ({pendingOrders.length})
          </button>
          <button
            onClick={() => setActiveSubTab('historico')}
            className={`flex-1 sm:flex-none px-4 py-1.5 text-xs font-bold rounded-lg transition ${
              activeSubTab === 'historico'
                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
            }`}
          >
            Histórico Conciliado ({reconciledOrders.length})
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search size={14} className="absolute left-3 top-3 text-zinc-400" />
          <input
            type="text"
            placeholder="Buscar pedido, cliente, telefone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-purple-500 text-zinc-900 dark:text-white"
          />
        </div>
      </div>

      {/* Conteúdo da Aba: Pendentes */}
      {activeSubTab === 'pendentes' && (
        <div className="space-y-3">
          {loading ? (
            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-12 text-center border border-zinc-200 dark:border-zinc-800">
              <RefreshCw size={28} className="animate-spin mx-auto text-purple-600 mb-3" />
              <p className="text-xs text-zinc-500">Carregando pedidos pendentes para conciliação...</p>
            </div>
          ) : error ? (
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-2xl p-6 text-center text-red-600 dark:text-red-400 text-xs">
              ⚠️ {error}
            </div>
          ) : filteredPending.length === 0 ? (
            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-12 text-center border border-zinc-200 dark:border-zinc-800">
              <CheckCircle size={36} className="mx-auto text-emerald-500 mb-2" />
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Tudo em dia!</h3>
              <p className="text-xs text-zinc-500 mt-1">
                Não há pedidos pendentes de conciliação manual criados desde 23/09.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {filteredPending.map((o) => (
                <div
                  key={o.id}
                  className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-bold text-xs bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-md">
                        #{o.id.slice(0, 8)}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                        {o.order_type}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 flex items-center gap-1">
                        <Clock size={10} /> Aguardando Pagamento
                      </span>
                      <span className="text-[11px] text-zinc-400">
                        {formatDate(o.created_at)}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1 text-xs text-zinc-700 dark:text-zinc-300">
                      <div>
                        <span className="text-zinc-400 block text-[10px]">Cliente:</span>
                        <strong className="font-medium">{o.buyer?.name || 'Cliente'}</strong>
                        {o.buyer?.phone && <span className="text-zinc-400 block text-[11px]">{o.buyer.phone}</span>}
                        {o.buyer?.cpf_cnpj && <span className="text-zinc-400 block text-[10px] font-mono">CPF: {o.buyer.cpf_cnpj}</span>}
                      </div>
                      <div>
                        <span className="text-zinc-400 block text-[10px]">Estabelecimento / Loja:</span>
                        <strong className="font-medium">{o.store?.store_name || 'Loja AçaíFood'}</strong>
                      </div>
                      <div>
                        <span className="text-zinc-400 block text-[10px]">Cobrança Asaas:</span>
                        <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400 block truncate max-w-[180px]">
                          {o.asaas_payment_id || 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center gap-3 border-t md:border-t-0 pt-3 md:pt-0 border-zinc-100 dark:border-zinc-800">
                    <div className="text-right">
                      <span className="text-[10px] text-zinc-400 block">Valor do Pedido</span>
                      <span className="text-lg font-black text-purple-600 dark:text-purple-400">
                        {formatMoney(o.products_subtotal)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleOpenConfirmModal(o)}
                        className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <CheckCircle size={14} />
                        Confirmar Pix Recebido
                      </button>
                      <button
                        onClick={() => { setCancelModalOrder(o); setCancelReason(""); }}
                        className="px-3 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-red-100 dark:hover:bg-red-950 text-zinc-700 dark:text-zinc-300 hover:text-red-600 dark:hover:text-red-400 font-bold text-xs rounded-xl transition cursor-pointer"
                      >
                        Cancelar / Devolver
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Conteúdo da Aba: Histórico */}
      {activeSubTab === 'historico' && (
        <div className="space-y-3">
          {reconciledOrders.length === 0 ? (
            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-12 text-center border border-zinc-200 dark:border-zinc-800">
              <p className="text-xs text-zinc-500">Nenhum pedido conciliado manualmente até o momento.</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-zinc-700 dark:text-zinc-300">
                  <thead className="bg-zinc-50 dark:bg-zinc-800/60 text-zinc-400 text-[11px] uppercase tracking-wider font-semibold border-b border-zinc-200 dark:border-zinc-800">
                    <tr>
                      <th className="px-4 py-3">Pedido</th>
                      <th className="px-4 py-3">Cliente</th>
                      <th className="px-4 py-3">Valor Conciliado</th>
                      <th className="px-4 py-3">Pix End-to-End ID</th>
                      <th className="px-4 py-3">Data Conciliação</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {reconciledOrders.map((ro) => (
                      <tr key={ro.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition">
                        <td className="px-4 py-3 font-mono font-bold text-purple-600 dark:text-purple-400">
                          #{ro.id.slice(0, 8)}
                        </td>
                        <td className="px-4 py-3">
                          <strong className="block font-medium">{ro.buyer?.name || 'Cliente'}</strong>
                          <span className="text-[10px] text-zinc-400">{ro.buyer?.phone || '-'}</span>
                        </td>
                        <td className="px-4 py-3 font-bold text-zinc-900 dark:text-white">
                          {formatMoney(ro.charged_amount || ro.products_subtotal)}
                        </td>
                        <td className="px-4 py-3 font-mono text-[10px] text-zinc-500 dark:text-zinc-400 max-w-[150px] truncate">
                          {ro.pix_end_to_end_id || 'Não registrado'}
                        </td>
                        <td className="px-4 py-3 text-zinc-500">
                          {formatDate(ro.reconciled_at || ro.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                            <CheckCircle size={10} /> Conciliado Manualmente
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal: Confirmar Pagamento Manual */}
      {confirmModalOrder && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 max-w-md w-full shadow-2xl border border-zinc-200 dark:border-zinc-800 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h3 className="font-bold text-sm text-zinc-900 dark:text-white flex items-center gap-2">
                <CheckCircle size={18} className="text-emerald-500" />
                Confirmar Pagamento Recebido Fora do Asaas
              </h3>
              <button
                onClick={() => setConfirmModalOrder(null)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <div className="bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded-xl p-3 text-xs space-y-1">
              <p><strong>Pedido:</strong> #{confirmModalOrder.id.slice(0, 8)} ({confirmModalOrder.order_type})</p>
              <p><strong>Cliente:</strong> {confirmModalOrder.buyer?.name || 'Cliente'} - {confirmModalOrder.buyer?.phone || ''}</p>
              <p><strong>Cobrança Asaas:</strong> <span className="font-mono">{confirmModalOrder.asaas_payment_id || 'N/A'}</span></p>
            </div>

            <form onSubmit={handleExecuteConfirm} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  ID / End-to-End do Pix Recebido *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: E00038166202609232300001..."
                  value={pixEndToEndId}
                  onChange={(e) => setPixEndToEndId(e.target.value)}
                  className="w-full text-xs font-mono p-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
                <span className="text-[10px] text-zinc-400 mt-0.5 block">
                  Identificador da transação no extrato da conta detentora da chave.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Valor Confirmado (R$) *
                </label>
                <input
                  type="text"
                  required
                  value={confirmedAmount}
                  onChange={(e) => setConfirmedAmount(e.target.value)}
                  className="w-full text-xs font-bold p-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Observações Internas (Opcional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Detalhes adicionais sobre a compensação ou comprovante..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full text-xs p-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-2.5 text-[11px] text-amber-800 dark:text-amber-300">
                ⚠️ Ao confirmar: A cobrança pendente no Asaas será cancelada imediatamente, o pedido será marcado como PAGO, e o PIN de entrega será gerado.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmModalOrder(null)}
                  disabled={submittingAction}
                  className="px-4 py-2 text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingAction}
                  className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition shadow-md disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {submittingAction ? <RefreshCw size={12} className="animate-spin" /> : <CheckCircle size={14} />}
                  Confirmar e Liberar Pedido
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Cancelar e Devolver */}
      {cancelModalOrder && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 max-w-md w-full shadow-2xl border border-zinc-200 dark:border-zinc-800 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h3 className="font-bold text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
                <XCircle size={18} />
                Cancelar Pedido e Registrar Devolução
              </h3>
              <button
                onClick={() => setCancelModalOrder(null)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <div className="bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 text-xs space-y-1">
              <p><strong>Pedido:</strong> #{cancelModalOrder.id.slice(0, 8)}</p>
              <p><strong>Cliente:</strong> {cancelModalOrder.buyer?.name || 'Cliente'} ({cancelModalOrder.buyer?.phone || '-'})</p>
              <p><strong>Valor:</strong> {formatMoney(cancelModalOrder.products_subtotal)}</p>
            </div>

            <form onSubmit={handleExecuteCancelAndRefund} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Motivo do Cancelamento / Registro de Devolução *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Descreva o motivo (ex: cliente desistiu e Pix estornado manualmente para a chave dele)..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full text-xs p-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCancelModalOrder(null)}
                  disabled={submittingAction}
                  className="px-4 py-2 text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  disabled={submittingAction}
                  className="px-4 py-2 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl transition shadow-md disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {submittingAction ? <RefreshCw size={12} className="animate-spin" /> : <XCircle size={14} />}
                  Confirmar Cancelamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
