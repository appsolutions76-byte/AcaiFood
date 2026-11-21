"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  Copy,
  Check,
  Settings,
  Share2,
  AlertCircle,
  RefreshCw,
  Plus,
  ExternalLink,
  ChevronRight,
  DollarSign,
  Layers,
  Edit,
  ShieldAlert,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

export function AdminAffiliatesTab() {
  const [activeSubTab, setActiveSubTab] = useState<"pending" | "active" | "config">("pending");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingList, setPendingList] = useState<any[]>([]);
  const [activeList, setActiveList] = useState<any[]>([]);
  const [config, setConfig] = useState({
    invite_expiry_days: 7,
    cookie_days: 7,
    min_withdrawal: 20.0,
  });

  // Estado para aprovação inline de pendentes
  const [approvalDrafts, setApprovalDrafts] = useState<Record<string, {
    bonus_per_store: number;
    bonus_per_client: number;
    commission_pct: number;
    commission_months: number;
    withdrawal_mode: "manual" | "auto";
  }>>({});
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Modal Gerar Convite
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteContact, setInviteContact] = useState("");
  const [inviteExpiry, setInviteExpiry] = useState(7);
  const [generatedInvite, setGeneratedInvite] = useState<{ link: string; code: string } | null>(null);
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);

  // Modal Detalhes (Indicações / Ledger)
  const [detailsModal, setDetailsModal] = useState<{
    open: boolean;
    affiliate: any | null;
    type: "referrals" | "ledger" | "edit";
  }>({ open: false, affiliate: null, type: "referrals" });
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsData, setDetailsData] = useState<any[]>([]);

  // Edição de Afiliado
  const [editDraft, setEditDraft] = useState<any>({});

  const getHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token || ""}`,
    };
  };

  const loadData = useCallback(async () => {
    try {
      setRefreshing(true);
      const headers = await getHeaders();

      // Carregar lista de afiliados
      const res = await fetch("/api/affiliates/list", { headers });
      const data = await res.json();
      if (res.ok) {
        setPendingList(data.pending || []);
        setActiveList(data.active || []);

        // Inicializar rascunhos para os pendentes
        const initialDrafts: Record<string, any> = {};
        (data.pending || []).forEach((p: any) => {
          initialDrafts[p.id] = {
            bonus_per_store: Number(p.bonus_per_store || 0),
            bonus_per_client: Number(p.bonus_per_client || 0),
            commission_pct: Number(p.commission_pct || 0.015),
            commission_months: Number(p.commission_months || 6),
            withdrawal_mode: p.withdrawal_mode || "manual",
          };
        });
        setApprovalDrafts(initialDrafts);
      }

      // Carregar configurações gerais
      const cfgRes = await fetch("/api/affiliates/config", { headers });
      const cfgData = await cfgRes.json();
      if (cfgRes.ok && cfgData.config) {
        setConfig(cfgData.config);
      }
    } catch (err) {
      console.error("Erro ao carregar afiliados:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleApprove = async (affiliateId: string) => {
    const draft = approvalDrafts[affiliateId] || {
      bonus_per_store: 0,
      bonus_per_client: 0,
      commission_pct: 0.015,
      commission_months: 6,
      withdrawal_mode: "manual",
    };

    setProcessingId(affiliateId);
    try {
      const headers = await getHeaders();
      const res = await fetch("/api/affiliates/approve", {
        method: "POST",
        headers,
        body: JSON.stringify({
          affiliate_id: affiliateId,
          action: "approve",
          ...draft,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Erro ao aprovar afiliado");
        return;
      }

      alert("Afiliado aprovado e ativado com sucesso!");
      loadData();
    } catch (err: any) {
      alert(err.message || "Falha na aprovação.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (affiliateId: string) => {
    if (!confirm("Tem certeza que deseja recusar este parceiro afiliado?")) return;

    setProcessingId(affiliateId);
    try {
      const headers = await getHeaders();
      const res = await fetch("/api/affiliates/approve", {
        method: "POST",
        headers,
        body: JSON.stringify({
          affiliate_id: affiliateId,
          action: "reject",
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Erro ao recusar afiliado");
        return;
      }

      alert("Afiliado recusado.");
      loadData();
    } catch (err: any) {
      alert(err.message || "Erro ao recusar.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const headers = await getHeaders();
      const res = await fetch("/api/affiliates/config", {
        method: "PATCH",
        headers,
        body: JSON.stringify(config),
      });

      if (!res.ok) {
        alert("Erro ao salvar configurações de afiliados.");
        return;
      }

      alert("Configurações de parceiros afiliados atualizadas com sucesso!");
    } catch (err: any) {
      alert(err.message || "Erro inesperado.");
    }
  };

  const handleGenerateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteName.trim()) return;

    setGeneratingInvite(true);
    try {
      const headers = await getHeaders();
      const res = await fetch("/api/affiliates/invite", {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: inviteName.trim(),
          contact: inviteContact.trim(),
          expiry_days: Number(inviteExpiry) || 7,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Erro ao gerar link de convite");
        return;
      }

      setGeneratedInvite({
        link: data.invite_link,
        code: data.referral_code,
      });
      loadData();
    } catch (err: any) {
      alert(err.message || "Erro ao gerar convite.");
    } finally {
      setGeneratingInvite(false);
    }
  };

  const openDetails = async (affiliate: any, type: "referrals" | "ledger" | "edit") => {
    setDetailsModal({ open: true, affiliate, type });
    if (type === "edit") {
      setEditDraft({
        bonus_per_store: Number(affiliate.bonus_per_store || 0),
        bonus_per_client: Number(affiliate.bonus_per_client || 0),
        commission_pct: Number(affiliate.commission_pct || 0),
        commission_months: Number(affiliate.commission_months || 6),
        withdrawal_mode: affiliate.withdrawal_mode || "manual",
        status: affiliate.status || "active",
      });
      return;
    }

    setDetailsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers = { Authorization: `Bearer ${session?.access_token || ""}` };
      const res = await fetch(`/api/affiliates/dashboard?affiliate_id=${affiliate.id}`, { headers });
      const data = await res.json();
      if (res.ok) {
        if (type === "referrals") setDetailsData(data.referrals || []);
        if (type === "ledger") setDetailsData(data.ledger || []);
      }
    } catch (err) {
      console.error("Erro ao carregar detalhes:", err);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!detailsModal.affiliate) return;
    try {
      const headers = await getHeaders();
      const res = await fetch(`/api/affiliates/${detailsModal.affiliate.id}/settings`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(editDraft),
      });

      if (!res.ok) {
        alert("Erro ao salvar alterações do afiliado.");
        return;
      }

      alert("Afiliado atualizado com sucesso!");
      setDetailsModal({ open: false, affiliate: null, type: "referrals" });
      loadData();
    } catch (err: any) {
      alert(err.message || "Erro inesperado.");
    }
  };

  const handleToggleSuspend = async (affiliate: any) => {
    const newStatus = affiliate.status === "active" ? "suspended" : "active";
    const msg = newStatus === "suspended" ? "Deseja suspender este afiliado?" : "Deseja reativar este afiliado?";
    if (!confirm(msg)) return;

    try {
      const headers = await getHeaders();
      await fetch(`/api/affiliates/${affiliate.id}/settings`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ status: newStatus }),
      });
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Ações */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900 border border-zinc-800 rounded-3xl p-5 sm:p-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 text-xs font-bold mb-2">
            <Sparkles size={13} /> Gestão de Parceiros Afiliados
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white">Programa de Afiliados AçaíFood</h2>
          <p className="text-xs text-zinc-400">
            Aprove cadastros, gerencie comissões, acompanhe indicações e defina as regras gerais.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            title="Atualizar"
            className="p-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-2xl transition cursor-pointer"
          >
            <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
          </button>
          <button
            onClick={() => {
              setGeneratedInvite(null);
              setInviteName("");
              setInviteContact("");
              setInviteModalOpen(true);
            }}
            className="px-4 py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-2xl flex items-center gap-2 shadow-lg shadow-purple-900/30 transition cursor-pointer"
          >
            <Plus size={16} />
            <span>Gerar Convite</span>
          </button>
        </div>
      </div>

      {/* Sub-abas de Navegação */}
      <div className="flex border-b border-zinc-800 gap-2">
        <button
          onClick={() => setActiveSubTab("pending")}
          className={`pb-3 px-4 text-xs font-bold border-b-2 transition flex items-center gap-2 cursor-pointer ${
            activeSubTab === "pending"
              ? "border-purple-600 text-purple-400"
              : "border-transparent text-zinc-400 hover:text-white"
          }`}
        >
          <Clock size={15} />
          <span>Aguardando Aprovação</span>
          {pendingList.length > 0 && (
            <span className="bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full text-[10px] font-black">
              {pendingList.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveSubTab("active")}
          className={`pb-3 px-4 text-xs font-bold border-b-2 transition flex items-center gap-2 cursor-pointer ${
            activeSubTab === "active"
              ? "border-purple-600 text-purple-400"
              : "border-transparent text-zinc-400 hover:text-white"
          }`}
        >
          <Users size={15} />
          <span>Parceiros Ativos ({activeList.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab("config")}
          className={`pb-3 px-4 text-xs font-bold border-b-2 transition flex items-center gap-2 cursor-pointer ${
            activeSubTab === "config"
              ? "border-purple-600 text-purple-400"
              : "border-transparent text-zinc-400 hover:text-white"
          }`}
        >
          <Settings size={15} />
          <span>Configurações Gerais</span>
        </button>
      </div>

      {/* 4.1 SUB-ABA: AGUARDANDO APROVAÇÃO */}
      {activeSubTab === "pending" && (
        <div className="space-y-4">
          {pendingList.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-10 text-center text-zinc-500 text-xs">
              <CheckCircle2 size={36} className="mx-auto mb-2 text-zinc-600" />
              Nenhum parceiro afiliado aguardando aprovação no momento.
            </div>
          ) : (
            pendingList.map((aff) => {
              const draft = approvalDrafts[aff.id] || {
                bonus_per_store: 0,
                bonus_per_client: 0,
                commission_pct: 0.015,
                commission_months: 6,
                withdrawal_mode: "manual",
              };

              return (
                <div
                  key={aff.id}
                  className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 sm:p-6 space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-black text-white text-base">{aff.name}</h3>
                        <span className="font-mono text-xs bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-md">
                          {aff.referral_code}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        Contato: {aff.contact || aff.users?.phone || "Não informado"} | Email: {aff.users?.email || "Sem email vinculado"}
                      </p>
                      {aff.how_will_promote && (
                        <p className="text-xs text-zinc-300 mt-2 bg-zinc-800/80 p-2.5 rounded-xl border border-zinc-700/50">
                          <strong>Plano de Divulgação:</strong> {aff.how_will_promote}
                        </p>
                      )}
                    </div>
                    <div className="text-right text-[11px] text-zinc-500 shrink-0">
                      Cadastrado em {new Date(aff.created_at).toLocaleDateString("pt-BR")}
                    </div>
                  </div>

                  {/* Formulário Inline de Aprovação */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-1">
                    <div>
                      <label className="block text-[11px] font-bold text-zinc-400 mb-1">Bônus Loja (R$)</label>
                      <input
                        type="number"
                        step="0.50"
                        value={draft.bonus_per_store}
                        onChange={(e) =>
                          setApprovalDrafts({
                            ...approvalDrafts,
                            [aff.id]: { ...draft, bonus_per_store: Number(e.target.value) },
                          })
                        }
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-zinc-400 mb-1">Bônus Cliente (R$)</label>
                      <input
                        type="number"
                        step="0.50"
                        value={draft.bonus_per_client}
                        onChange={(e) =>
                          setApprovalDrafts({
                            ...approvalDrafts,
                            [aff.id]: { ...draft, bonus_per_client: Number(e.target.value) },
                          })
                        }
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-zinc-400 mb-1">Comissão % (ex: 0.015 = 1.5%)</label>
                      <input
                        type="number"
                        step="0.001"
                        value={draft.commission_pct}
                        onChange={(e) =>
                          setApprovalDrafts({
                            ...approvalDrafts,
                            [aff.id]: { ...draft, commission_pct: Number(e.target.value) },
                          })
                        }
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-zinc-400 mb-1">Meses Duração</label>
                      <input
                        type="number"
                        value={draft.commission_months}
                        onChange={(e) =>
                          setApprovalDrafts({
                            ...approvalDrafts,
                            [aff.id]: { ...draft, commission_months: Number(e.target.value) },
                          })
                        }
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-zinc-400 mb-1">Modo Saque</label>
                      <select
                        value={draft.withdrawal_mode}
                        onChange={(e) =>
                          setApprovalDrafts({
                            ...approvalDrafts,
                            [aff.id]: { ...draft, withdrawal_mode: e.target.value as any },
                          })
                        }
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs text-white"
                      >
                        <option value="manual">Manual</option>
                        <option value="auto">Automático</option>
                      </select>
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
                    <button
                      onClick={() => handleReject(aff.id)}
                      disabled={processingId === aff.id}
                      className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-red-400 font-bold text-xs rounded-xl cursor-pointer"
                    >
                      Recusar
                    </button>
                    <button
                      onClick={() => handleApprove(aff.id)}
                      disabled={processingId === aff.id}
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-md"
                    >
                      {processingId === aff.id ? <RefreshCw size={13} className="animate-spin" /> : <CheckCircle2 size={14} />}
                      <span>Aprovar e Ativar</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 4.2 SUB-ABA: PARCEIROS ATIVOS */}
      {activeSubTab === "active" && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden">
          {activeList.length === 0 ? (
            <div className="p-10 text-center text-zinc-500 text-xs">
              Nenhum parceiro ativo no momento. Use o botão &quot;Gerar Convite&quot; para convidar parceiros.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-500 bg-zinc-950/40">
                    <th className="py-3 px-4">Código</th>
                    <th className="py-3 px-4">Nome & Contato</th>
                    <th className="py-3 px-4 text-center">Indicações</th>
                    <th className="py-3 px-4">Comissão Acumulada</th>
                    <th className="py-3 px-4">Saldo Disponível</th>
                    <th className="py-3 px-4">Modo Saque</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {activeList.map((aff) => (
                    <tr key={aff.id} className="text-zinc-300 hover:bg-zinc-800/30 transition">
                      <td className="py-3 px-4 font-mono font-bold text-purple-300">{aff.referral_code}</td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-white">{aff.name}</div>
                        <div className="text-[11px] text-zinc-500">{aff.contact || aff.users?.email}</div>
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-white">
                        <button
                          onClick={() => openDetails(aff, "referrals")}
                          className="hover:underline text-purple-400 cursor-pointer"
                        >
                          {aff.referrals_count || 0}
                        </button>
                      </td>
                      <td className="py-3 px-4 font-bold text-emerald-400">
                        R$ {Number(aff.total_earned || 0).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 font-bold text-blue-400">
                        R$ {Number(aff.asaas_balance || 0).toFixed(2)}
                      </td>
                      <td className="py-3 px-4">
                        <span className="uppercase text-[10px] font-bold bg-zinc-800 px-2 py-0.5 rounded-full text-zinc-400">
                          {aff.withdrawal_mode}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openDetails(aff, "edit")}
                            title="Editar comissões"
                            className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg cursor-pointer"
                          >
                            <Edit size={13} />
                          </button>
                          <button
                            onClick={() => openDetails(aff, "referrals")}
                            title="Ver indicações"
                            className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-purple-300 rounded-lg cursor-pointer"
                          >
                            <Users size={13} />
                          </button>
                          <button
                            onClick={() => openDetails(aff, "ledger")}
                            title="Ver ledger de comissões"
                            className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-emerald-300 rounded-lg cursor-pointer"
                          >
                            <DollarSign size={13} />
                          </button>
                          <button
                            onClick={() => handleToggleSuspend(aff)}
                            title="Suspender/Reativar"
                            className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-amber-400 rounded-lg cursor-pointer"
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
      )}

      {/* 4.3 SUB-ABA: CONFIGURAÇÕES GERAIS */}
      {activeSubTab === "config" && (
        <form onSubmit={handleSaveConfig} className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 max-w-xl space-y-4">
          <h3 className="font-bold text-sm text-white flex items-center gap-2 border-b border-zinc-800 pb-3">
            <Settings size={16} className="text-purple-400" /> Parâmetros Globais de Afiliados
          </h3>

          <div>
            <label className="block text-xs font-bold text-zinc-300 mb-1">Validade do Convite (dias)</label>
            <input
              type="number"
              required
              min={1}
              value={config.invite_expiry_days}
              onChange={(e) => setConfig({ ...config, invite_expiry_days: Number(e.target.value) })}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white"
            />
            <p className="text-[11px] text-zinc-500 mt-1">Tempo limite para o parceiro aceitar o convite gerado.</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-300 mb-1">Duração do Cookie de Indicação (dias)</label>
            <input
              type="number"
              required
              min={1}
              value={config.cookie_days}
              onChange={(e) => setConfig({ ...config, cookie_days: Number(e.target.value) })}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white"
            />
            <p className="text-[11px] text-zinc-500 mt-1">
              Período em que o navegador do convidado mantém o código salvo até o cadastro.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-300 mb-1">Saque Mínimo (R$)</label>
            <input
              type="number"
              step="0.01"
              required
              min={1}
              value={config.min_withdrawal}
              onChange={(e) => setConfig({ ...config, min_withdrawal: Number(e.target.value) })}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white"
            />
            <p className="text-[11px] text-zinc-500 mt-1">Valor mínimo permitido para solicitação de saque Pix.</p>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="px-6 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer transition"
            >
              Salvar Configurações
            </button>
          </div>
        </form>
      )}

      {/* 4.4 MODAL: GERAR CONVITE */}
      {inviteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="font-bold text-white text-base">Novo Convite de Afiliado</h3>
              <button
                onClick={() => setInviteModalOpen(false)}
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            {!generatedInvite ? (
              <form onSubmit={handleGenerateInvite} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1">Nome Completo *</label>
                  <input
                    type="text"
                    required
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    placeholder="Ex: João da Silva"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1">WhatsApp / Contato</label>
                  <input
                    type="text"
                    value={inviteContact}
                    onChange={(e) => setInviteContact(e.target.value)}
                    placeholder="(91) 98000-0000"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1">Validade do Link (dias)</label>
                  <input
                    type="number"
                    min={1}
                    value={inviteExpiry}
                    onChange={(e) => setInviteExpiry(Number(e.target.value))}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={generatingInvite}
                    className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer transition flex items-center justify-center gap-2"
                  >
                    {generatingInvite ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
                    <span>Gerar Link de Convite</span>
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-emerald-950/40 border border-emerald-500/30 rounded-2xl text-emerald-300 text-xs text-center">
                  Link gerado com sucesso para o código <strong className="font-mono text-white">{generatedInvite.code}</strong>!
                </div>

                <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl text-xs font-mono text-purple-300 break-all select-all">
                  {generatedInvite.link}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(generatedInvite.link);
                      setCopiedInvite(true);
                      setTimeout(() => setCopiedInvite(false), 2000);
                    }}
                    className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {copiedInvite ? <Check size={14} /> : <Copy size={14} />}
                    <span>{copiedInvite ? "Copiado!" : "Copiar Link"}</span>
                  </button>
                  <button
                    onClick={() => setInviteModalOpen(false)}
                    className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs rounded-xl cursor-pointer"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: DETALHES (Indicações / Ledger / Editar) */}
      {detailsModal.open && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 max-w-2xl w-full shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <h3 className="font-bold text-white text-base">
                  {detailsModal.type === "referrals" && `Indicações de ${detailsModal.affiliate?.name}`}
                  {detailsModal.type === "ledger" && `Comissões de ${detailsModal.affiliate?.name}`}
                  {detailsModal.type === "edit" && `Editar Regras: ${detailsModal.affiliate?.name}`}
                </h3>
                <p className="text-xs text-zinc-500 font-mono">Código: {detailsModal.affiliate?.referral_code}</p>
              </div>
              <button
                onClick={() => setDetailsModal({ open: false, affiliate: null, type: "referrals" })}
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3">
              {detailsLoading ? (
                <div className="py-12 text-center text-zinc-400 text-xs">
                  <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-purple-500" />
                  Carregando informações...
                </div>
              ) : detailsModal.type === "edit" ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-zinc-400 mb-1">Bônus por Loja (R$)</label>
                      <input
                        type="number"
                        step="0.50"
                        value={editDraft.bonus_per_store}
                        onChange={(e) => setEditDraft({ ...editDraft, bonus_per_store: Number(e.target.value) })}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-zinc-400 mb-1">Bônus por Cliente (R$)</label>
                      <input
                        type="number"
                        step="0.50"
                        value={editDraft.bonus_per_client}
                        onChange={(e) => setEditDraft({ ...editDraft, bonus_per_client: Number(e.target.value) })}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-zinc-400 mb-1">Comissão % (ex: 0.015 = 1.5%)</label>
                      <input
                        type="number"
                        step="0.001"
                        value={editDraft.commission_pct}
                        onChange={(e) => setEditDraft({ ...editDraft, commission_pct: Number(e.target.value) })}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-zinc-400 mb-1">Meses de Duração</label>
                      <input
                        type="number"
                        value={editDraft.commission_months}
                        onChange={(e) => setEditDraft({ ...editDraft, commission_months: Number(e.target.value) })}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-zinc-400 mb-1">Modo de Saque</label>
                      <select
                        value={editDraft.withdrawal_mode}
                        onChange={(e) => setEditDraft({ ...editDraft, withdrawal_mode: e.target.value })}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white"
                      >
                        <option value="manual">Manual</option>
                        <option value="auto">Automático</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-zinc-400 mb-1">Status</label>
                      <select
                        value={editDraft.status}
                        onChange={(e) => setEditDraft({ ...editDraft, status: e.target.value })}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white"
                      >
                        <option value="active">Ativo</option>
                        <option value="suspended">Suspenso</option>
                        <option value="revoked">Revogado</option>
                      </select>
                    </div>
                  </div>

                  <div className="pt-3 flex justify-end gap-2 border-t border-zinc-800">
                    <button
                      onClick={() => setDetailsModal({ open: false, affiliate: null, type: "referrals" })}
                      className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold rounded-xl cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleSaveEdit}
                      className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl cursor-pointer"
                    >
                      Salvar Alterações
                    </button>
                  </div>
                </div>
              ) : detailsData.length === 0 ? (
                <div className="py-8 text-center text-zinc-500 text-xs">
                  Nenhum registro encontrado para este parceiro.
                </div>
              ) : detailsModal.type === "referrals" ? (
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-zinc-800 text-zinc-500">
                      <th className="py-2">Indicado</th>
                      <th className="py-2">Papel</th>
                      <th className="py-2">Data</th>
                      <th className="py-2">Bônus</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {detailsData.map((r: any) => (
                      <tr key={r.id} className="text-zinc-300">
                        <td className="py-2 font-medium text-white">{r.users?.name || "Usuário"}</td>
                        <td className="py-2 capitalize">{r.referred_role || "Cliente"}</td>
                        <td className="py-2">{new Date(r.referred_at).toLocaleDateString("pt-BR")}</td>
                        <td className="py-2 font-bold text-purple-300">
                          R$ {Number(r.bonus_amount || 0).toFixed(2)} ({r.bonus_paid ? "Pago" : "Pendente"})
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-zinc-800 text-zinc-500">
                      <th className="py-2">Data</th>
                      <th className="py-2">Pedido</th>
                      <th className="py-2">Taxa Plataforma</th>
                      <th className="py-2 text-right">Comissão Afiliado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {detailsData.map((l: any) => (
                      <tr key={l.id} className="text-zinc-300">
                        <td className="py-2">{new Date(l.credited_at).toLocaleDateString("pt-BR")}</td>
                        <td className="py-2 font-mono">#{l.order_id ? l.order_id.slice(0, 8) : "BÔNUS"}</td>
                        <td className="py-2">R$ {Number(l.platform_commission || 0).toFixed(2)}</td>
                        <td className="py-2 text-right font-black text-emerald-400">
                          + R$ {Number(l.affiliate_amount || 0).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
