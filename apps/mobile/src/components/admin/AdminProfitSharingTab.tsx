"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Users,
  DollarSign,
  Plus,
  RefreshCw,
  Calculator,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  Edit,
  ShieldAlert,
  ArrowRight,
  Receipt,
  AlertCircle,
  FileText,
  Calendar,
  Lock,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

export function AdminProfitSharingTab() {
  const [activeSubTab, setActiveSubTab] = useState<"partners" | "payouts">("partners");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Sócios
  const [partners, setPartners] = useState<any[]>([]);
  const [activeCount, setActiveCount] = useState(0);

  // Repasses
  const [payouts, setPayouts] = useState<any[]>([]);

  // Modal Cadastrar / Editar Sócio
  const [partnerModalOpen, setPartnerModalOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<any | null>(null);
  const [partnerForm, setPartnerForm] = useState({
    name: "",
    pix_key: "",
    pix_key_type: "cpf",
    share_pct: 0.05,
    start_date: new Date().toISOString().slice(0, 10),
    notes: "",
  });
  const [savingPartner, setSavingPartner] = useState(false);

  // Formulário de Cálculo de Repasse
  const [selectedPartnerId, setSelectedPartnerId] = useState("");
  const [periodStart, setPeriodStart] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() - 1, 1).toISOString().slice(0, 10);
  });
  const [periodEnd, setPeriodEnd] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 0).toISOString().slice(0, 10);
  });

  const [calcDraft, setCalcDraft] = useState<{
    platform_fees: number;
    activation_fees: number;
    gross_revenue: number;
    asaas_fees: number;
    affiliate_costs: number;
    other_costs: number;
    other_costs_note: string;
    net_revenue: number;
    share_pct: number;
    amount: number;
  } | null>(null);

  const [calculating, setCalculating] = useState(false);
  const [registeringPayout, setRegisteringPayout] = useState(false);

  // Modal Pagar Repasse
  const [payModal, setPayModal] = useState<{
    open: boolean;
    payout: any | null;
    pix_key_used: string;
    receipt_note: string;
  }>({ open: false, payout: null, pix_key_used: "", receipt_note: "" });
  const [paying, setPaying] = useState(false);

  // Modal Detalhes do Repasse
  const [detailModal, setDetailModal] = useState<{ open: boolean; payout: any | null }>({
    open: false,
    payout: null,
  });

  const getHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token || ""}`,
    };
  };

  const loadAll = useCallback(async () => {
    try {
      setRefreshing(true);
      const headers = await getHeaders();

      // Carregar sócios
      const resP = await fetch("/api/profit-sharing/partners", { headers });
      const dataP = await resP.json();
      if (resP.ok) {
        setPartners(dataP.partners || []);
        setActiveCount(dataP.active_count || 0);
        if (!selectedPartnerId && dataP.partners?.length > 0) {
          const firstActive = dataP.partners.find((p: any) => p.active);
          if (firstActive) setSelectedPartnerId(firstActive.id);
        }
      }

      // Carregar repasses
      const resPay = await fetch("/api/profit-sharing/payouts", { headers });
      const dataPay = await resPay.json();
      if (resPay.ok) {
        setPayouts(dataPay.payouts || []);
      }
    } catch (err) {
      console.error("Erro ao carregar dados de sócios:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedPartnerId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Recalcular valores dinâmicos quando o admin editar campos do cálculo
  const updateCalcDraft = (updates: Partial<typeof calcDraft>) => {
    if (!calcDraft) return;
    const merged = { ...calcDraft, ...updates };
    const gross = Number((Number(merged.platform_fees || 0) + Number(merged.activation_fees || 0)).toFixed(2));
    const net = Number(
      (
        gross -
        Number(merged.asaas_fees || 0) -
        Number(merged.affiliate_costs || 0) -
        Number(merged.other_costs || 0)
      ).toFixed(2)
    );
    const amt = Number((net * Number(merged.share_pct || 0)).toFixed(2));

    setCalcDraft({
      ...merged,
      gross_revenue: gross,
      net_revenue: net,
      amount: Math.max(0, amt),
    });
  };

  const handleCalculate = async () => {
    if (!selectedPartnerId) {
      alert("Selecione um sócio ativo.");
      return;
    }

    setCalculating(true);
    try {
      const headers = await getHeaders();
      const res = await fetch("/api/profit-sharing/calculate", {
        method: "POST",
        headers,
        body: JSON.stringify({
          partner_id: selectedPartnerId,
          period_start: periodStart,
          period_end: periodEnd,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Erro ao calcular valores.");
        return;
      }

      setCalcDraft(data.calculation);
    } catch (err: any) {
      alert(err.message || "Falha no cálculo.");
    } finally {
      setCalculating(false);
    }
  };

  const handleRegisterPayout = async () => {
    if (!calcDraft || !selectedPartnerId) return;

    setRegisteringPayout(true);
    try {
      const headers = await getHeaders();
      const res = await fetch("/api/profit-sharing/payouts", {
        method: "POST",
        headers,
        body: JSON.stringify({
          partner_id: selectedPartnerId,
          ...calcDraft,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Erro ao registrar repasse.");
        return;
      }

      alert("Repasse registrado com sucesso com status Pendente!");
      setCalcDraft(null);
      loadAll();
      setActiveSubTab("payouts");
    } catch (err: any) {
      alert(err.message || "Erro inesperado.");
    } finally {
      setRegisteringPayout(false);
    }
  };

  const handleSavePartner = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPartner(true);
    try {
      const headers = await getHeaders();
      const isEditing = !!editingPartner;
      const url = isEditing
        ? `/api/profit-sharing/partners/${editingPartner.id}`
        : "/api/profit-sharing/partners";
      const method = isEditing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(partnerForm),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Erro ao salvar sócio.");
        return;
      }

      alert(isEditing ? "Sócio atualizado com sucesso!" : "Sócio cadastrado com sucesso!");
      setPartnerModalOpen(false);
      setEditingPartner(null);
      loadAll();
    } catch (err: any) {
      alert(err.message || "Falha ao salvar.");
    } finally {
      setSavingPartner(false);
    }
  };

  const handleTogglePartnerActive = async (partner: any) => {
    const nextState = !partner.active;
    if (nextState && activeCount >= 3) {
      alert("Limite de 3 sócios investidores ativos atingido. Desative outro sócio antes de ativar este.");
      return;
    }

    const actionText = nextState ? "ativar" : "desativar";
    if (!confirm(`Deseja realmente ${actionText} o sócio ${partner.name}?`)) return;

    try {
      const headers = await getHeaders();
      const res = await fetch(`/api/profit-sharing/partners/${partner.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ active: nextState }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Erro ao alterar status do sócio.");
        return;
      }

      loadAll();
    } catch (err: any) {
      alert(err.message || "Erro inesperado.");
    }
  };

  const handleConfirmPay = async () => {
    if (!payModal.payout) return;

    setPaying(true);
    try {
      const headers = await getHeaders();
      const res = await fetch(`/api/profit-sharing/payouts/${payModal.payout.id}/pay`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          pix_key_used: payModal.pix_key_used,
          receipt_note: payModal.receipt_note,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Erro ao marcar como pago.");
        return;
      }

      alert("Repasse marcado como PAGO com sucesso!");
      setPayModal({ open: false, payout: null, pix_key_used: "", receipt_note: "" });
      loadAll();
    } catch (err: any) {
      alert(err.message || "Falha ao registrar pagamento.");
    } finally {
      setPaying(false);
    }
  };

  const handleCancelPayout = async (payoutId: string) => {
    if (!confirm("Deseja cancelar este repasse?")) return;

    try {
      const headers = await getHeaders();
      const res = await fetch(`/api/profit-sharing/payouts/${payoutId}/cancel`, {
        method: "POST",
        headers,
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Erro ao cancelar repasse.");
        return;
      }

      alert("Repasse cancelado.");
      loadAll();
    } catch (err: any) {
      alert(err.message || "Erro inesperado.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900 border border-zinc-800 rounded-3xl p-5 sm:p-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold mb-2">
            <DollarSign size={13} /> Divisão de Lucros & Investidores
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white">Sócios Investidores (Profit Sharing)</h2>
          <p className="text-xs text-zinc-400">
            Gerencie até 3 sócios ativos, calcule os repasses líquidos mensais e registre os pagamentos via Pix.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadAll}
            title="Atualizar"
            className="p-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-2xl transition cursor-pointer"
          >
            <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
          </button>
          
          <button
            onClick={() => {
              setEditingPartner(null);
              setPartnerForm({
                name: "",
                pix_key: "",
                pix_key_type: "cpf",
                share_pct: 0.05,
                start_date: new Date().toISOString().slice(0, 10),
                notes: "",
              });
              setPartnerModalOpen(true);
            }}
            disabled={activeCount >= 3}
            title={activeCount >= 3 ? "Limite de 3 sócios ativos atingido" : "Cadastrar novo sócio"}
            className="px-4 py-3 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs rounded-2xl flex items-center gap-2 shadow-lg shadow-amber-900/30 transition cursor-pointer"
          >
            <Plus size={16} />
            <span>Cadastrar Sócio ({activeCount}/3)</span>
          </button>
        </div>
      </div>

      {/* Sub-abas */}
      <div className="flex border-b border-zinc-800 gap-2">
        <button
          onClick={() => setActiveSubTab("partners")}
          className={`pb-3 px-4 text-xs font-bold border-b-2 transition flex items-center gap-2 cursor-pointer ${
            activeSubTab === "partners"
              ? "border-amber-500 text-amber-400"
              : "border-transparent text-zinc-400 hover:text-white"
          }`}
        >
          <Users size={15} />
          <span>Sócios Cadastrados ({partners.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab("payouts")}
          className={`pb-3 px-4 text-xs font-bold border-b-2 transition flex items-center gap-2 cursor-pointer ${
            activeSubTab === "payouts"
              ? "border-amber-500 text-amber-400"
              : "border-transparent text-zinc-400 hover:text-white"
          }`}
        >
          <Receipt size={15} />
          <span>Gerar e Consultar Repasses ({payouts.length})</span>
        </button>
      </div>

      {/* 7.1 SUB-ABA: SÓCIOS */}
      {activeSubTab === "partners" && (
        <div className="space-y-4">
          {activeCount >= 3 && (
            <div className="p-3 bg-amber-950/40 border border-amber-500/30 rounded-2xl text-amber-300 text-xs flex items-center gap-2">
              <Lock size={15} className="shrink-0" />
              <span>Limite máximo de 3 sócios investidores ativos atingido. Para adicionar outro, desative um dos existentes.</span>
            </div>
          )}

          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden">
            {partners.length === 0 ? (
              <div className="p-10 text-center text-zinc-500 text-xs">
                Nenhum sócio investidor cadastrado até o momento.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-zinc-800 text-zinc-500 bg-zinc-950/40">
                      <th className="py-3 px-4">Nome</th>
                      <th className="py-3 px-4">Chave Pix</th>
                      <th className="py-3 px-4 text-center">Participação (%)</th>
                      <th className="py-3 px-4">Desde</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {partners.map((p) => (
                      <tr key={p.id} className="text-zinc-300 hover:bg-zinc-800/30 transition">
                        <td className="py-3 px-4">
                          <div className="font-bold text-white">{p.name}</div>
                          {p.notes && <div className="text-[11px] text-zinc-500">{p.notes}</div>}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-mono text-zinc-300">{p.pix_key}</span>
                          <span className="text-[10px] text-zinc-500 ml-1.5 uppercase">({p.pix_key_type})</span>
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-amber-300 text-sm">
                          {(Number(p.share_pct) * 100).toFixed(1)}%
                        </td>
                        <td className="py-3 px-4 text-zinc-400">
                          {new Date(p.start_date).toLocaleDateString("pt-BR")}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              p.active
                                ? "bg-emerald-500/20 text-emerald-400"
                                : "bg-zinc-800 text-zinc-400"
                            }`}
                          >
                            {p.active ? "Ativo" : "Inativo"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => {
                                setEditingPartner(p);
                                setPartnerForm({
                                  name: p.name,
                                  pix_key: p.pix_key,
                                  pix_key_type: p.pix_key_type,
                                  share_pct: Number(p.share_pct),
                                  start_date: p.start_date,
                                  notes: p.notes || "",
                                });
                                setPartnerModalOpen(true);
                              }}
                              title="Editar Sócio"
                              className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg cursor-pointer"
                            >
                              <Edit size={13} />
                            </button>
                            <button
                              onClick={() => handleTogglePartnerActive(p)}
                              title={p.active ? "Desativar Sócio" : "Reativar Sócio"}
                              className={`p-1.5 rounded-lg cursor-pointer ${
                                p.active
                                  ? "bg-zinc-800 hover:bg-zinc-700 text-red-400"
                                  : "bg-emerald-950/40 hover:bg-emerald-900/40 text-emerald-300"
                              }`}
                            >
                              <ShieldAlert size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 7.2 SUB-ABA: REPASSES */}
      {activeSubTab === "payouts" && (
        <div className="space-y-6">
          {/* Formulário de Geração de Repasse */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 sm:p-6 space-y-4">
            <h3 className="font-bold text-sm text-white flex items-center gap-2 border-b border-zinc-800 pb-3">
              <Calculator size={16} className="text-amber-400" /> Gerar Novo Repasse Mensal
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1">Sócio Ativo *</label>
                <select
                  value={selectedPartnerId}
                  onChange={(e) => setSelectedPartnerId(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white"
                >
                  <option value="">Selecione um sócio</option>
                  {partners
                    .filter((p) => p.active)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({(Number(p.share_pct) * 100).toFixed(1)}%)
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1">Período Início *</label>
                <input
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1">Período Fim *</label>
                <input
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
            </div>

            <div className="flex justify-start">
              <button
                type="button"
                onClick={handleCalculate}
                disabled={calculating || !selectedPartnerId}
                className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center gap-2 cursor-pointer shadow-md transition"
              >
                {calculating ? <RefreshCw size={14} className="animate-spin" /> : <Calculator size={14} />}
                <span>Calcular Automaticamente</span>
              </button>
            </div>

            {/* Resultado do Cálculo e Campos Editáveis */}
            {calcDraft && (
              <div className="bg-zinc-950/80 border border-amber-500/30 rounded-2xl p-4 sm:p-5 space-y-4 animate-fade-in">
                <div className="text-xs font-bold text-amber-300">
                  Revisão dos Valores Calculados para o Período
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-400 mb-1">Taxas de Plataforma (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={calcDraft.platform_fees}
                      onChange={(e) => updateCalcDraft({ platform_fees: Number(e.target.value) })}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-zinc-400 mb-1">Taxas de Ativação (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={calcDraft.activation_fees}
                      onChange={(e) => updateCalcDraft({ activation_fees: Number(e.target.value) })}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-zinc-400 mb-1">Taxas Asaas (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={calcDraft.asaas_fees}
                      onChange={(e) => updateCalcDraft({ asaas_fees: Number(e.target.value) })}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-zinc-400 mb-1">Custos Afiliados (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={calcDraft.affiliate_costs}
                      onChange={(e) => updateCalcDraft({ affiliate_costs: Number(e.target.value) })}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-400 mb-1">Outros Custos / Deduções (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={calcDraft.other_costs}
                      onChange={(e) => updateCalcDraft({ other_costs: Number(e.target.value) })}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-400 mb-1">Descrição de Outros Custos</label>
                    <input
                      type="text"
                      placeholder="Ex: Servidores AWS, contabilidade..."
                      value={calcDraft.other_costs_note}
                      onChange={(e) => updateCalcDraft({ other_costs_note: e.target.value })}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs text-white"
                    />
                  </div>
                </div>

                {/* Totais Read-Only */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-zinc-900 rounded-xl border border-zinc-800 text-xs">
                  <div>
                    <span className="text-zinc-500">Faturamento Bruto:</span>
                    <div className="font-bold text-white text-sm">R$ {calcDraft.gross_revenue.toFixed(2)}</div>
                  </div>
                  <div>
                    <span className="text-zinc-500">Faturamento Líquido:</span>
                    <div className="font-bold text-emerald-400 text-sm">R$ {calcDraft.net_revenue.toFixed(2)}</div>
                  </div>
                  <div>
                    <span className="text-zinc-500">Valor do Repasse ({(calcDraft.share_pct * 100).toFixed(1)}%):</span>
                    <div className="font-black text-amber-300 text-base">R$ {calcDraft.amount.toFixed(2)}</div>
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={handleRegisterPayout}
                    disabled={registeringPayout || calcDraft.amount <= 0}
                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer transition flex items-center gap-2"
                  >
                    {registeringPayout ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={15} />}
                    <span>Registrar Repasse</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Histórico de Repasses */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden space-y-3 p-4 sm:p-6">
            <h4 className="font-bold text-sm text-white flex items-center gap-2">
              <FileText size={16} className="text-purple-400" /> Histórico de Repasses de Sócios
            </h4>

            {payouts.length === 0 ? (
              <p className="text-xs text-zinc-500 py-6 text-center">Nenhum repasse gerado até o momento.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-zinc-800 text-zinc-500 bg-zinc-950/40">
                      <th className="py-2.5 px-3">Sócio</th>
                      <th className="py-2.5 px-3">Período</th>
                      <th className="py-2.5 px-3">Faturamento Bruto</th>
                      <th className="py-2.5 px-3">Faturamento Líquido</th>
                      <th className="py-2.5 px-3 text-center">%</th>
                      <th className="py-2.5 px-3">Valor Repasse</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                      <th className="py-2.5 px-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {payouts.map((p) => (
                      <tr key={p.id} className="text-zinc-300 hover:bg-zinc-800/30 transition">
                        <td className="py-2.5 px-3 font-bold text-white">{p.profit_sharing_partners?.name || "Sócio"}</td>
                        <td className="py-2.5 px-3 text-zinc-400">
                          {p.period_start} a {p.period_end}
                        </td>
                        <td className="py-2.5 px-3">R$ {Number(p.gross_revenue || 0).toFixed(2)}</td>
                        <td className="py-2.5 px-3 text-emerald-400">R$ {Number(p.net_revenue || 0).toFixed(2)}</td>
                        <td className="py-2.5 px-3 text-center">{(Number(p.share_pct) * 100).toFixed(1)}%</td>
                        <td className="py-2.5 px-3 font-black text-amber-300">R$ {Number(p.amount || 0).toFixed(2)}</td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              p.status === "paid"
                                ? "bg-emerald-500/20 text-emerald-400"
                                : p.status === "cancelled"
                                ? "bg-red-500/20 text-red-400"
                                : "bg-amber-500/20 text-amber-300"
                            }`}
                          >
                            {p.status === "paid" ? "Pago" : p.status === "cancelled" ? "Cancelado" : "Pendente"}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {p.status === "pending" && (
                              <>
                                <button
                                  onClick={() =>
                                    setPayModal({
                                      open: true,
                                      payout: p,
                                      pix_key_used: p.profit_sharing_partners?.pix_key || "",
                                      receipt_note: "",
                                    })
                                  }
                                  title="Marcar como Pago"
                                  className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold cursor-pointer"
                                >
                                  Pagar Pix
                                </button>
                                <button
                                  onClick={() => handleCancelPayout(p.id)}
                                  title="Cancelar"
                                  className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-red-400 rounded-lg text-[10px] font-bold cursor-pointer"
                                >
                                  Cancelar
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => setDetailModal({ open: true, payout: p })}
                              title="Ver Detalhes"
                              className="p-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg cursor-pointer"
                            >
                              <FileText size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: CADASTRAR / EDITAR SÓCIO */}
      {partnerModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="font-bold text-white text-base">
                {editingPartner ? "Editar Sócio Investidor" : "Cadastrar Sócio Investidor"}
              </h3>
              <button
                onClick={() => setPartnerModalOpen(false)}
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePartner} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1">Nome Completo *</label>
                <input
                  type="text"
                  required
                  value={partnerForm.name}
                  onChange={(e) => setPartnerForm({ ...partnerForm, name: e.target.value })}
                  placeholder="Nome do sócio"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1">Tipo de Chave Pix *</label>
                  <select
                    value={partnerForm.pix_key_type}
                    onChange={(e) => setPartnerForm({ ...partnerForm, pix_key_type: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="cpf">CPF</option>
                    <option value="cnpj">CNPJ</option>
                    <option value="email">E-mail</option>
                    <option value="telefone">Telefone</option>
                    <option value="aleatoria">Aleatória (EVP)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1">Chave Pix *</label>
                  <input
                    type="text"
                    required
                    value={partnerForm.pix_key}
                    onChange={(e) => setPartnerForm({ ...partnerForm, pix_key: e.target.value })}
                    placeholder="Chave Pix"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1">Participação % (ex: 0.05 = 5%) *</label>
                  <input
                    type="number"
                    step="0.001"
                    min={0.001}
                    max={1}
                    required
                    value={partnerForm.share_pct}
                    onChange={(e) => setPartnerForm({ ...partnerForm, share_pct: Number(e.target.value) })}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1">Data Início *</label>
                  <input
                    type="date"
                    required
                    value={partnerForm.start_date}
                    onChange={(e) => setPartnerForm({ ...partnerForm, start_date: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1">Observações</label>
                <textarea
                  rows={2}
                  value={partnerForm.notes}
                  onChange={(e) => setPartnerForm({ ...partnerForm, notes: e.target.value })}
                  placeholder="Informações adicionais do investimento..."
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white resize-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setPartnerModalOpen(false)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingPartner}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl cursor-pointer shadow-md transition"
                >
                  {savingPartner ? "Salvando..." : "Salvar Sócio"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PAGAR REPASSE */}
      {payModal.open && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="font-bold text-white text-base">Registrar Pagamento Pix</h3>
              <button
                onClick={() => setPayModal({ open: false, payout: null, pix_key_used: "", receipt_note: "" })}
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-2xl text-xs space-y-1">
              <div>Sócio: <strong className="text-white">{payModal.payout?.profit_sharing_partners?.name}</strong></div>
              <div>Valor do Repasse: <strong className="text-amber-300 text-sm">R$ {Number(payModal.payout?.amount || 0).toFixed(2)}</strong></div>
              <div>Período: <span className="text-zinc-400">{payModal.payout?.period_start} a {payModal.payout?.period_end}</span></div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1">Chave Pix Utilizada *</label>
                <input
                  type="text"
                  required
                  value={payModal.pix_key_used}
                  onChange={(e) => setPayModal({ ...payModal, pix_key_used: e.target.value })}
                  placeholder="Chave Pix do pagamento"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1">Comprovante / Observação</label>
                <textarea
                  rows={2}
                  value={payModal.receipt_note}
                  onChange={(e) => setPayModal({ ...payModal, receipt_note: e.target.value })}
                  placeholder="Código de transação bancária ou link do comprovante..."
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white resize-none"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-zinc-800">
              <button
                onClick={() => setPayModal({ open: false, payout: null, pix_key_used: "", receipt_note: "" })}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmPay}
                disabled={paying || !payModal.pix_key_used}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl cursor-pointer shadow-md transition flex items-center gap-1.5"
              >
                {paying ? <RefreshCw size={13} className="animate-spin" /> : <CheckCircle2 size={14} />}
                <span>Confirmar Pagamento</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DETALHES DO REPASSE */}
      {detailModal.open && detailModal.payout && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="font-bold text-white text-base">Detalhamento do Repasse</h3>
              <button
                onClick={() => setDetailModal({ open: false, payout: null })}
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2.5 text-xs text-zinc-300">
              <div className="flex justify-between border-b border-zinc-800/60 pb-2">
                <span className="text-zinc-500">Sócio:</span>
                <strong className="text-white">{detailModal.payout.profit_sharing_partners?.name}</strong>
              </div>
              <div className="flex justify-between border-b border-zinc-800/60 pb-2">
                <span className="text-zinc-500">Período:</span>
                <span>{detailModal.payout.period_start} a {detailModal.payout.period_end}</span>
              </div>
              <div className="flex justify-between border-b border-zinc-800/60 pb-2">
                <span className="text-zinc-500">Taxas de Plataforma:</span>
                <span>R$ {Number(detailModal.payout.platform_fees || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-b border-zinc-800/60 pb-2">
                <span className="text-zinc-500">Taxas de Ativação:</span>
                <span>R$ {Number(detailModal.payout.activation_fees || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-b border-zinc-800/60 pb-2">
                <span className="text-zinc-500">Faturamento Bruto:</span>
                <strong className="text-white">R$ {Number(detailModal.payout.gross_revenue || 0).toFixed(2)}</strong>
              </div>
              <div className="flex justify-between border-b border-zinc-800/60 pb-2">
                <span className="text-zinc-500">Taxas Asaas:</span>
                <span className="text-red-400">- R$ {Number(detailModal.payout.asaas_fees || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-b border-zinc-800/60 pb-2">
                <span className="text-zinc-500">Custos com Afiliados:</span>
                <span className="text-red-400">- R$ {Number(detailModal.payout.affiliate_costs || 0).toFixed(2)}</span>
              </div>
              {detailModal.payout.other_costs > 0 && (
                <div className="flex justify-between border-b border-zinc-800/60 pb-2">
                  <span className="text-zinc-500">Outros Custos ({detailModal.payout.other_costs_note || "Diversos"}):</span>
                  <span className="text-red-400">- R$ {Number(detailModal.payout.other_costs || 0).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between border-b border-zinc-800/60 pb-2">
                <span className="text-zinc-500">Faturamento Líquido:</span>
                <strong className="text-emerald-400">R$ {Number(detailModal.payout.net_revenue || 0).toFixed(2)}</strong>
              </div>
              <div className="flex justify-between border-b border-zinc-800/60 pb-2">
                <span className="text-zinc-500">Percentual de Participação:</span>
                <span>{(Number(detailModal.payout.share_pct) * 100).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between pt-1 text-sm font-black">
                <span className="text-white">Valor do Repasse:</span>
                <span className="text-amber-300">R$ {Number(detailModal.payout.amount || 0).toFixed(2)}</span>
              </div>

              {detailModal.payout.pix_key_used && (
                <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 text-[11px] space-y-1 mt-2">
                  <div>Chave Pix Paga: <span className="font-mono text-purple-300">{detailModal.payout.pix_key_used}</span></div>
                  {detailModal.payout.paid_at && (
                    <div>Pago em: <span className="text-zinc-400">{new Date(detailModal.payout.paid_at).toLocaleString("pt-BR")}</span></div>
                  )}
                  {detailModal.payout.receipt_note && (
                    <div>Comprovante: <span className="text-zinc-400">{detailModal.payout.receipt_note}</span></div>
                  )}
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setDetailModal({ open: false, payout: null })}
                className="px-5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold rounded-xl cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
