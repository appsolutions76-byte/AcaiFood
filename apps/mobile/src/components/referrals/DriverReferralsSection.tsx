"use client";

import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAppStore } from "@/store/useAppStore";
import { RatingBadge } from "@/components/ratings/RatingBadge";
import {
  Search,
  Check,
  X,
  Trash2,
  Send,
  RefreshCw,
  Clock,
  ShieldCheck,
  Store
} from "lucide-react";

interface DriverReferralsSectionProps {
  flow: "B2C" | "B2B" | "COLETA";
  partnerLabel?: "loja" | "fornecedor";
  ratingsEnabled?: boolean;
  minCountDisplay?: number;
  onReferralsChanged?: (referrals: any[]) => void;
}

export function DriverReferralsSection({
  flow,
  partnerLabel = "loja",
  ratingsEnabled = false,
  minCountDisplay = 5,
  onReferralsChanged
}: DriverReferralsSectionProps) {
  const currentUser = useAppStore((s: any) => s.currentUser);
  const [serveMode, setServeMode] = useState<"ALL" | "SELECTED">(
    (currentUser?.serve_mode as any) || "ALL"
  );
  const [referrals, setReferrals] = useState<any[]>([]);
  const [partners, setPartners] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [savingMode, setSavingMode] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    if (currentUser?.serve_mode) {
      setServeMode(currentUser.serve_mode);
    }
  }, [currentUser?.serve_mode]);

  const loadReferrals = useCallback(async () => {
    if (!currentUser?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_my_referrals", { p_flow: flow });
      if (!error && Array.isArray(data)) {
        setReferrals(data);
        if (onReferralsChanged) onReferralsChanged(data);
      }
    } catch (e) {
      console.warn("Aviso ao carregar indicações do motorista:", e);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.id, flow, onReferralsChanged]);

  const searchPartners = useCallback(
    async (q: string) => {
      if (!currentUser?.id) return;
      setSearching(true);
      try {
        const { data, error } = await supabase.rpc("search_city_partners_for_referral", {
          p_flow: flow,
          p_query: q
        });
        if (!error && Array.isArray(data)) {
          setPartners(data);
        }
      } catch (e) {
        console.warn("Aviso ao buscar parceiros na cidade:", e);
      } finally {
        setSearching(false);
      }
    },
    [currentUser?.id, flow]
  );

  useEffect(() => {
    loadReferrals();
    searchPartners("");
  }, [loadReferrals, searchPartners]);

  const handleSetServeMode = async (mode: "ALL" | "SELECTED") => {
    if (savingMode || mode === serveMode) return;
    setSavingMode(true);
    setFeedback(null);
    try {
      const { data, error } = await supabase.rpc("driver_set_serve_mode", { p_mode: mode });
      if (error || !data?.success) {
        setFeedback({
          type: "err",
          text: data?.error || error?.message || "Não foi possível alterar o modo de atendimento."
        });
      } else {
        setServeMode(mode);
        useAppStore.setState((state: any) => ({
          currentUser: state.currentUser ? { ...state.currentUser, serve_mode: mode } : null,
          users: state.currentUser
            ? {
                ...state.users,
                [state.currentUser.id]: { ...state.users[state.currentUser.id], serve_mode: mode }
              }
            : state.users
        }));
        setFeedback({ type: "ok", text: "Modo de atendimento atualizado!" });
        if (currentUser?.id) {
          useAppStore.getState().fetchOrders(currentUser.id, true);
        }
      }
    } catch (e: any) {
      setFeedback({ type: "err", text: e?.message || "Erro ao atualizar modo." });
    } finally {
      setSavingMode(false);
    }
  };

  const handleRespondInvite = async (referralId: string, accept: boolean) => {
    setFeedback(null);
    const { data, error } = await supabase.rpc("referral_respond", {
      p_referral_id: referralId,
      p_accept: accept
    });
    if (error || !data?.success) {
      setFeedback({
        type: "err",
        text: data?.error || error?.message || "Não foi possível responder ao convite."
      });
    } else {
      setFeedback({
        type: "ok",
        text: accept ? "Convite aceito! Agora você é um parceiro indicado." : "Convite recusado."
      });
      await loadReferrals();
      await searchPartners(searchQuery);
    }
  };

  const handleToggleServes = async (referralId: string, nextVal: boolean) => {
    setFeedback(null);
    const { data, error } = await supabase.rpc("referral_set_driver_serves", {
      p_referral_id: referralId,
      p_serves: nextVal
    });
    if (error || !data?.success) {
      setFeedback({
        type: "err",
        text: data?.error || error?.message || "Não foi possível alterar o atendimento."
      });
    } else {
      await loadReferrals();
      if (currentUser?.id) {
        useAppStore.getState().fetchOrders(currentUser.id, true);
      }
    }
  };

  const handleRemove = async (referralId: string, partnerName: string) => {
    if (!window.confirm(`Deseja remover a indicação com ${partnerName}?`)) return;
    setFeedback(null);
    const { data, error } = await supabase.rpc("referral_remove", { p_referral_id: referralId });
    if (error || !data?.success) {
      setFeedback({
        type: "err",
        text: data?.error || error?.message || "Não foi possível remover a indicação."
      });
    } else {
      setFeedback({ type: "ok", text: "Indicação removida." });
      await loadReferrals();
      await searchPartners(searchQuery);
    }
  };

  const handleRequestReferral = async (partnerId: string) => {
    setFeedback(null);
    const { data, error } = await supabase.rpc("referral_request", {
      p_partner_id: partnerId,
      p_flow: flow
    });
    if (error || !data?.success) {
      setFeedback({
        type: "err",
        text: data?.error || error?.message || "Não foi possível enviar o pedido de indicação."
      });
    } else {
      setFeedback({
        type: "ok",
        text: "Pedido de indicação enviado! Aguarde a resposta do estabelecimento."
      });
      await loadReferrals();
      await searchPartners(searchQuery);
    }
  };

  const pendingInvitesReceived = referrals.filter(
    (r) => r.status === "PENDING" && r.origin === "PARTNER_INVITE"
  );
  const pendingRequestsSent = referrals.filter(
    (r) => r.status === "PENDING" && r.origin === "DRIVER_REQUEST"
  );
  const activeReferrals = referrals.filter((r) => r.status === "ACTIVE");

  const pluralPartner = partnerLabel === "fornecedor" ? "fornecedores" : "lojas";
  const thisPartner = partnerLabel === "fornecedor" ? "este fornecedor" : "esta loja";

  return (
    <div className="space-y-4">
      {/* Chave: Atender Todas as lojas / Só algumas */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-black text-zinc-900 dark:text-white flex items-center gap-1.5">
              <ShieldCheck size={16} className="text-purple-600" />
              Atender: Todas as {pluralPartner} / Só algumas
            </h3>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Você pode mudar quando quiser.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              loadReferrals();
              searchPartners(searchQuery);
            }}
            className="text-xs text-zinc-500 hover:text-purple-600 p-1.5 rounded-lg"
            title="Atualizar"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={savingMode}
            onClick={() => handleSetServeMode("ALL")}
            className={`p-3 rounded-xl border text-left transition ${
              serveMode === "ALL"
                ? "border-purple-600 bg-purple-50/70 dark:bg-purple-950/30"
                : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
            }`}
          >
            <div className="text-xs font-extrabold text-zinc-900 dark:text-white">
              Todas as {pluralPartner}
            </div>
            <p className="text-[10px] text-zinc-500 mt-0.5">
              Vê corridas de indicados e do radar geral
            </p>
          </button>

          <button
            type="button"
            disabled={savingMode}
            onClick={() => handleSetServeMode("SELECTED")}
            className={`p-3 rounded-xl border text-left transition ${
              serveMode === "SELECTED"
                ? "border-purple-600 bg-purple-50/70 dark:bg-purple-950/30"
                : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
            }`}
          >
            <div className="text-xs font-extrabold text-zinc-900 dark:text-white">
              Só algumas
            </div>
            <p className="text-[10px] text-zinc-500 mt-0.5">
              Apenas {pluralPartner} com indicação marcada abaixo
            </p>
          </button>
        </div>

        {feedback && (
          <div
            className={`p-2.5 rounded-xl text-xs font-bold ${
              feedback.type === "ok"
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-800"
            }`}
          >
            {feedback.text}
          </div>
        )}
      </div>

      {/* Convites Pendentes Recebidos */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-3">
        <h4 className="text-xs font-black text-zinc-900 dark:text-white flex items-center gap-1.5">
          <Clock size={14} className="text-amber-500" />
          Pendentes ({pendingInvitesReceived.length})
        </h4>

        {pendingInvitesReceived.length === 0 ? (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Nenhum convite recebido aguardando sua resposta.
          </p>
        ) : (
          <div className="space-y-2">
            {pendingInvitesReceived.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-2 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                      {item.partner_name || "Estabelecimento"}
                    </span>
                    <RatingBadge
                      avgStars={item.partner_avg_stars}
                      ratingCount={item.partner_rating_count}
                      minCountDisplay={minCountDisplay}
                      ratingsEnabled={ratingsEnabled}
                    />
                  </div>
                  <p className="text-[11px] text-zinc-500">
                    Convidou você para ser parceiro indicado
                  </p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleRespondInvite(item.id, true)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1"
                  >
                    <Check size={13} /> Aceitar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRespondInvite(item.id, false)}
                    className="bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1"
                  >
                    <X size={13} /> Recusar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {pendingRequestsSent.length > 0 && (
          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 space-y-1.5">
            <span className="text-[11px] font-bold text-zinc-500">
              Solicitações enviadas por você ({pendingRequestsSent.length})
            </span>
            {pendingRequestsSent.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between text-xs p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/30"
              >
                <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                  {item.partner_name || "Estabelecimento"} (aguardando aceite)
                </span>
                <button
                  type="button"
                  onClick={() => handleRemove(item.id, item.partner_name || "estabelecimento")}
                  className="text-[11px] text-red-600 hover:underline font-bold"
                >
                  Cancelar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Indicações Ativas */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-3">
        <h4 className="text-xs font-black text-zinc-900 dark:text-white">
          Indicações ativas ({activeReferrals.length})
        </h4>

        {activeReferrals.length === 0 ? (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Você ainda não possui indicações ativas neste fluxo.
          </p>
        ) : (
          <div className="space-y-2">
            {activeReferrals.map((item) => (
              <div
                key={item.id}
                className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                        {item.partner_name || "Estabelecimento"}
                      </span>
                      <RatingBadge
                        avgStars={item.partner_avg_stars}
                        ratingCount={item.partner_rating_count}
                        minCountDisplay={minCountDisplay}
                        ratingsEnabled={ratingsEnabled}
                      />
                    </div>
                    <p className="text-[11px] text-zinc-500">
                      {item.partner_bairro ? `Bairro: ${item.partner_bairro}` : "Parceiro ativo"}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemove(item.id, item.partner_name || "este estabelecimento")}
                    className="text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1 shrink-0 transition"
                  >
                    <Trash2 size={13} /> Remover
                  </button>
                </div>

                <label className="flex items-center justify-between pt-2 border-t border-zinc-200/70 dark:border-zinc-700/60 cursor-pointer">
                  <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Atender {thisPartner}
                  </span>
                  <input
                    type="checkbox"
                    checked={Boolean(item.driver_serves)}
                    onChange={(e) => handleToggleServes(item.id, e.target.checked)}
                    className="h-4 w-4 accent-purple-600 rounded cursor-pointer"
                  />
                </label>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pedir Indicação: busca de lojas/fornecedores da cidade */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-3">
        <div>
          <h4 className="text-xs font-black text-zinc-900 dark:text-white flex items-center gap-1.5">
            <Store size={14} className="text-purple-600" />
            Pedir indicação ({pluralPartner} da sua cidade)
          </h4>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            Busque {pluralPartner} em {currentUser?.cidade || "sua cidade"} para pedir indicação.
          </p>
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                searchPartners(e.target.value);
              }}
              placeholder={`Buscar ${partnerLabel} por nome ou bairro...`}
              className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white"
            />
          </div>
        </div>

        {searching ? (
          <p className="text-xs text-zinc-500">Buscando...</p>
        ) : partners.length === 0 ? (
          <p className="text-xs text-zinc-500">
            Nenhum estabelecimento encontrado na sua cidade com esse filtro.
          </p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {partners.map((p) => {
              const status = p.existing_status;
              return (
                <div
                  key={p.partner_id}
                  className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                        {p.name}
                      </span>
                      <RatingBadge
                        avgStars={p.avg_stars}
                        ratingCount={p.rating_count}
                        minCountDisplay={minCountDisplay}
                        ratingsEnabled={ratingsEnabled}
                      />
                    </div>
                    <p className="text-[11px] text-zinc-500">
                      {p.bairro ? `${p.bairro} • ${p.cidade || ""}` : p.cidade || ""}
                    </p>
                  </div>

                  {status === "ACTIVE" ? (
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 shrink-0">
                      Indicado ativo
                    </span>
                  ) : status === "PENDING" ? (
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 shrink-0">
                      Pendente
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleRequestReferral(p.partner_id)}
                      className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1 shrink-0 transition"
                    >
                      <Send size={12} /> Pedir indicação
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
