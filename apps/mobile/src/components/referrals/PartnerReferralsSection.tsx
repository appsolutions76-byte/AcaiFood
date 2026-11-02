"use client";

import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAppStore } from "@/store/useAppStore";
import { RatingBadge } from "@/components/ratings/RatingBadge";
import {
  UserPlus,
  Check,
  X,
  Trash2,
  Copy,
  Share2,
  QrCode,
  AlertTriangle,
  RefreshCw,
  Clock,
  ShieldCheck
} from "lucide-react";

interface PartnerReferralsSectionProps {
  flow: "B2C" | "B2B" | "COLETA";
  driverLabel?: "motoboy" | "caminhoneiro" | "caçamba";
  ratingsEnabled?: boolean;
  minCountDisplay?: number;
}

export function PartnerReferralsSection({
  flow,
  driverLabel = "motoboy",
  ratingsEnabled = false,
  minCountDisplay = 5
}: PartnerReferralsSectionProps) {
  const currentUser = useAppStore((s: any) => s.currentUser);
  const [dispatchMode, setDispatchMode] = useState<"ALL" | "REFERRED_FIRST" | "REFERRED_ONLY">(
    (currentUser?.dispatch_mode as any) || "ALL"
  );
  const [referrals, setReferrals] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingMode, setSavingMode] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [inviteExpiresAt, setInviteExpiresAt] = useState<string | null>(null);
  const [creatingLink, setCreatingLink] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    if (currentUser?.dispatch_mode) {
      setDispatchMode(currentUser.dispatch_mode);
    }
  }, [currentUser?.dispatch_mode]);

  const loadReferrals = useCallback(async () => {
    if (!currentUser?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_my_referrals", { p_flow: flow });
      if (!error && Array.isArray(data)) {
        setReferrals(data);
      }
    } catch (e) {
      console.warn("Aviso ao carregar indicações:", e);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.id, flow]);

  useEffect(() => {
    loadReferrals();
  }, [loadReferrals]);

  const handleSetDispatchMode = async (mode: "ALL" | "REFERRED_FIRST" | "REFERRED_ONLY") => {
    if (savingMode || mode === dispatchMode) return;
    setSavingMode(true);
    setFeedback(null);
    try {
      const { data, error } = await supabase.rpc("partner_set_dispatch_mode", { p_mode: mode });
      if (error || !data?.success) {
        setFeedback({
          type: "err",
          text: data?.error || error?.message || "Não foi possível atualizar o modo de despacho."
        });
      } else {
        setDispatchMode(mode);
        useAppStore.setState((state: any) => ({
          currentUser: state.currentUser ? { ...state.currentUser, dispatch_mode: mode } : null,
          users: state.currentUser
            ? {
                ...state.users,
                [state.currentUser.id]: { ...state.users[state.currentUser.id], dispatch_mode: mode }
              }
            : state.users
        }));
        setFeedback({ type: "ok", text: "Preferência salva! Vale para os próximos pedidos." });
      }
    } catch (e: any) {
      setFeedback({ type: "err", text: e?.message || "Erro ao salvar preferência." });
    } finally {
      setSavingMode(false);
    }
  };

  const handleCreateInvite = async () => {
    setCreatingLink(true);
    setFeedback(null);
    try {
      const { data, error } = await supabase.rpc("referral_create_invite_link", { p_flow: flow });
      if (error || !data?.success) {
        setFeedback({
          type: "err",
          text: data?.error || error?.message || "Não foi possível gerar o link de convite."
        });
      } else {
        const origin =
          typeof window !== "undefined" && window.location.origin
            ? window.location.origin
            : "https://www.acaifood.app.br";
        setInviteUrl(`${origin}/convite/${data.token}`);
        setInviteExpiresAt(data.expires_at || null);
      }
    } catch (e: any) {
      setFeedback({ type: "err", text: e?.message || "Erro ao criar convite." });
    } finally {
      setCreatingLink(false);
    }
  };

  const handleCopyInvite = () => {
    if (!inviteUrl) return;
    navigator.clipboard.writeText(inviteUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleShareWhatsApp = () => {
    if (!inviteUrl) return;
    const storeName = currentUser?.name || "nossa loja";
    const text = `Olá! A ${storeName} convidou você para ser um parceiro indicado no AçaíFood (${flow}). Acesse o link para ver e aceitar o convite: ${inviteUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  };

  const handleRespond = async (referralId: string, accept: boolean) => {
    setFeedback(null);
    const { data, error } = await supabase.rpc("referral_respond", {
      p_referral_id: referralId,
      p_accept: accept
    });
    if (error || !data?.success) {
      setFeedback({
        type: "err",
        text: data?.error || error?.message || "Não foi possível responder à solicitação."
      });
    } else {
      setFeedback({
        type: "ok",
        text: accept ? "Parceiro indicado aceito com sucesso!" : "Solicitação recusada."
      });
      await loadReferrals();
    }
  };

  const handleRemove = async (referralId: string, driverName: string) => {
    if (!window.confirm(`Deseja remover a indicação de ${driverName}?`)) return;
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
    }
  };

  const pendingDriverRequests = referrals.filter(
    (r) => r.status === "PENDING" && r.origin === "DRIVER_REQUEST"
  );
  const pendingInvitesSent = referrals.filter(
    (r) => r.status === "PENDING" && r.origin === "PARTNER_INVITE"
  );
  const activeReferrals = referrals.filter((r) => r.status === "ACTIVE");

  const driverArticle = driverLabel === "caçamba" ? "A caçamba" : `O ${driverLabel}`;
  const pronoun = driverLabel === "caçamba" ? "Ela" : "Ele";

  return (
    <div className="space-y-4">
      {/* Chave: Quem recebe suas corridas */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-black text-zinc-900 dark:text-white flex items-center gap-1.5">
              <ShieldCheck size={16} className="text-purple-600" />
              Quem recebe suas corridas
            </h3>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Vale para os próximos pedidos.
            </p>
          </div>
          <button
            type="button"
            onClick={loadReferrals}
            className="text-xs text-zinc-500 hover:text-purple-600 p-1.5 rounded-lg"
            title="Atualizar lista"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-2">
          <button
            type="button"
            disabled={savingMode}
            onClick={() => handleSetDispatchMode("ALL")}
            className={`text-left p-3 rounded-xl border transition ${
              dispatchMode === "ALL"
                ? "border-purple-600 bg-purple-50/70 dark:bg-purple-950/30"
                : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-zinc-900 dark:text-white">
                Todos do app (padrão)
              </span>
              {dispatchMode === "ALL" && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-600 text-white">
                  Ativo
                </span>
              )}
            </div>
            <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-0.5">
              Qualquer entregador disponível no radar pode aceitar suas corridas imediatamente.
            </p>
          </button>

          <button
            type="button"
            disabled={savingMode}
            onClick={() => handleSetDispatchMode("REFERRED_FIRST")}
            className={`text-left p-3 rounded-xl border transition ${
              dispatchMode === "REFERRED_FIRST"
                ? "border-purple-600 bg-purple-50/70 dark:bg-purple-950/30"
                : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-zinc-900 dark:text-white">
                Indicados primeiro + app
              </span>
              {dispatchMode === "REFERRED_FIRST" && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-600 text-white">
                  Ativo
                </span>
              )}
            </div>
            <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-0.5">
              Seus indicados recebem primeiro; se ninguém aceitar no tempo de exclusividade, abre para todos do app.
            </p>
          </button>

          <button
            type="button"
            disabled={savingMode}
            onClick={() => handleSetDispatchMode("REFERRED_ONLY")}
            className={`text-left p-3 rounded-xl border transition ${
              dispatchMode === "REFERRED_ONLY"
                ? "border-purple-600 bg-purple-50/70 dark:bg-purple-950/30"
                : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-zinc-900 dark:text-white">
                Só indicados
              </span>
              {dispatchMode === "REFERRED_ONLY" && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-600 text-white">
                  Ativo
                </span>
              )}
            </div>
            <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-0.5">
              Apenas seus parceiros indicados ativos veem e aceitam suas corridas.
            </p>
          </button>
        </div>

        {dispatchMode === "REFERRED_ONLY" && activeReferrals.length === 0 && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            <span>Você ainda não tem indicados ativos. Seus pedidos podem ficar parados.</span>
          </div>
        )}

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

      {/* Botão Convidar */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h4 className="text-xs font-black text-zinc-900 dark:text-white">
              Convidar {driverLabel}
            </h4>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              {driverArticle} precisa aceitar o convite. {pronoun} continua livre para atender outras lojas.
            </p>
          </div>
          <button
            type="button"
            disabled={creatingLink}
            onClick={handleCreateInvite}
            className="shrink-0 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-xs transition"
          >
            <UserPlus size={14} />
            {creatingLink ? "Gerando..." : `Convidar ${driverLabel}`}
          </button>
        </div>

        {inviteUrl && (
          <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1">
                <QrCode size={13} className="text-purple-600" /> Link de convite (válido por 7 dias)
              </span>
              {inviteExpiresAt && (
                <span className="text-[10px] text-zinc-500">
                  Expira em {new Date(inviteExpiresAt).toLocaleDateString("pt-BR")}
                </span>
              )}
            </div>

            <div className="p-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-[11px] font-mono break-all text-zinc-700 dark:text-zinc-300">
              {inviteUrl}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleCopyInvite}
                className="flex-1 min-w-[120px] bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-white text-xs font-bold py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition"
              >
                <Copy size={13} />
                {copiedLink ? "Link copiado!" : "Copiar link"}
              </button>
              <button
                type="button"
                onClick={handleShareWhatsApp}
                className="flex-1 min-w-[140px] bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition"
              >
                <Share2 size={13} />
                Compartilhar no WhatsApp
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Solicitações Pendentes */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-3">
        <h4 className="text-xs font-black text-zinc-900 dark:text-white flex items-center gap-1.5">
          <Clock size={14} className="text-amber-500" />
          Pendentes ({pendingDriverRequests.length})
        </h4>

        {pendingDriverRequests.length === 0 ? (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Nenhum pedido de indicação pendente no momento.
          </p>
        ) : (
          <div className="space-y-2">
            {pendingDriverRequests.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-2 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                      {item.driver_name || "Motorista"}
                    </span>
                    <RatingBadge
                      avgStars={item.driver_avg_stars}
                      ratingCount={item.driver_rating_count}
                      minCountDisplay={minCountDisplay}
                      ratingsEnabled={ratingsEnabled}
                    />
                  </div>
                  <p className="text-[11px] text-zinc-500">
                    {item.driver_bairro ? `Bairro: ${item.driver_bairro}` : "Pediu indicação"}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleRespond(item.id, true)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1"
                  >
                    <Check size={13} /> Aceitar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRespond(item.id, false)}
                    className="bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1"
                  >
                    <X size={13} /> Recusar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {pendingInvitesSent.length > 0 && (
          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 space-y-1.5">
            <span className="text-[11px] font-bold text-zinc-500">
              Convites enviados aguardando resposta ({pendingInvitesSent.length})
            </span>
            {pendingInvitesSent.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between text-xs p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/30"
              >
                <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                  {item.driver_name || "Motorista convidado"}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemove(item.id, item.driver_name || "convidado")}
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
            Você ainda não possui parceiros indicados ativos neste fluxo.
          </p>
        ) : (
          <div className="space-y-2">
            {activeReferrals.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-2 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                      {item.driver_name || "Parceiro indicado"}
                    </span>
                    <RatingBadge
                      avgStars={item.driver_avg_stars}
                      ratingCount={item.driver_rating_count}
                      minCountDisplay={minCountDisplay}
                      ratingsEnabled={ratingsEnabled}
                    />
                    {!item.driver_serves && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300">
                        Pausou atendimento
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-500">
                    {item.driver_bairro ? `Bairro: ${item.driver_bairro}` : "Parceiro indicado ativo"}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleRemove(item.id, item.driver_name || "este parceiro")}
                  className="text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1 shrink-0 transition"
                >
                  <Trash2 size={13} /> Remover
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
