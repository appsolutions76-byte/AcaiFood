"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAppStore } from "@/store/useAppStore";
import { Star, Check, Edit2, Send } from "lucide-react";

interface OrderRatingCardProps {
  order: any;
  viewerId: string;
  viewerRole: "cliente" | "loja" | "fornecedor" | "motorista" | "caminhao";
  ratingsEnabled?: boolean;
}

interface RatingTarget {
  rateeId: string;
  roleLabel: string;
  name: string;
}

export function OrderRatingCard({
  order,
  viewerId,
  viewerRole,
  ratingsEnabled = false
}: OrderRatingCardProps) {
  const users = useAppStore((s: any) => s.users || {});
  const [existingRatings, setExistingRatings] = useState<Record<string, { stars: number; comment: string | null }>>({});
  const [starsDraft, setStarsDraft] = useState<Record<string, number>>({});
  const [commentDraft, setCommentDraft] = useState<Record<string, string>>({});
  const [editingTarget, setEditingTarget] = useState<Record<string, boolean>>({});
  const [submittingTarget, setSubmittingTarget] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, { type: "ok" | "err"; text: string }>>({});
  const [commentsEnabled, setCommentsEnabled] = useState(true);
  const [windowDays, setWindowDays] = useState(7);

  const isCompleted = (() => {
    const st = String(order?.status || "").toLowerCase().trim();
    return ["entregue", "received", "completed", "concluido", "concluído", "arquivado"].includes(st);
  })();

  useEffect(() => {
    if (!ratingsEnabled || !isCompleted || !order?.id || !viewerId) return;
    supabase.rpc("get_order_ratings_for_me", { p_order_id: order.id }).then(({ data }) => {
      if (data?.success) {
        if (typeof data.rating_comments_enabled === "boolean") {
          setCommentsEnabled(data.rating_comments_enabled);
        }
        if (typeof data.rating_window_days === "number") {
          setWindowDays(data.rating_window_days);
        }
        const map: Record<string, { stars: number; comment: string | null }> = {};
        const sDraft: Record<string, number> = {};
        const cDraft: Record<string, string> = {};
        for (const r of data.ratings || []) {
          map[r.ratee_id] = { stars: r.stars, comment: r.comment || null };
          sDraft[r.ratee_id] = r.stars;
          cDraft[r.ratee_id] = r.comment || "";
        }
        setExistingRatings(map);
        setStarsDraft((prev) => ({ ...sDraft, ...prev }));
        setCommentDraft((prev) => ({ ...cDraft, ...prev }));
      }
    });
  }, [ratingsEnabled, isCompleted, order?.id, viewerId]);

  if (!ratingsEnabled || !isCompleted || !order || !viewerId) return null;

  // Verificar janela de tempo
  const refTimeStr = order.receivedAt || order.deliveredAt || order.createdAt;
  if (refTimeStr) {
    const refMs = new Date(refTimeStr).getTime();
    if (!isNaN(refMs) && Date.now() - refMs > windowDays * 86400 * 1000) {
      if (Object.keys(existingRatings).length === 0) return null;
    }
  }

  const flow = (order.type || "B2C") as "B2C" | "B2B" | "COLETA";
  const selfDelivery = Boolean(order.self_delivery);
  const driverId = selfDelivery ? null : order.motoristaId || null;
  const buyerId = order.buyerId || (flow === "B2B" ? order.destinoId || order.lojaId : order.destinoId);
  const sellerId = flow === "B2B" ? order.fornecedorId || order.origemId : order.lojaId || order.origemId;

  const targets: RatingTarget[] = [];
  const addTarget = (id: string | undefined | null, roleLabel: string, fallbackName: string) => {
    if (!id || id === viewerId) return;
    if (targets.some((t) => t.rateeId === id)) return;
    const uName = users[id]?.name || fallbackName;
    targets.push({ rateeId: id, roleLabel, name: uName });
  };

  if (flow === "B2C") {
    if (viewerRole === "cliente") {
      addTarget(sellerId, "Loja", order.lojaNome || "Loja");
      if (driverId) addTarget(driverId, "Motoboy", order.motoristaNome || "Motoboy");
    } else if (viewerRole === "loja") {
      addTarget(buyerId, "Cliente", order.clienteNome || "Cliente");
      if (driverId) addTarget(driverId, "Motoboy", order.motoristaNome || "Motoboy");
    } else if (viewerRole === "motorista") {
      addTarget(sellerId, "Loja", order.lojaNome || "Loja");
      addTarget(buyerId, "Cliente", order.clienteNome || "Cliente");
    }
  } else if (flow === "B2B") {
    if (viewerRole === "loja") {
      addTarget(sellerId, "Fornecedor", order.lojaNome || "Fornecedor");
      if (driverId) addTarget(driverId, "Caminhoneiro", order.motoristaNome || "Caminhoneiro");
    } else if (viewerRole === "fornecedor") {
      addTarget(buyerId, "Loja Compradora", order.clienteNome || "Loja Compradora");
      if (driverId) addTarget(driverId, "Caminhoneiro", order.motoristaNome || "Caminhoneiro");
    } else if (viewerRole === "caminhao") {
      addTarget(sellerId, "Fornecedor", order.lojaNome || "Fornecedor");
      addTarget(buyerId, "Loja Compradora", order.clienteNome || "Loja Compradora");
    }
  } else if (flow === "COLETA") {
    if (viewerRole === "loja") {
      if (driverId) addTarget(driverId, "Caçamba", order.motoristaNome || "Caçamba");
    } else if (viewerRole === "caminhao") {
      addTarget(buyerId || sellerId, "Loja", order.lojaNome || "Loja");
    }
  }

  if (targets.length === 0) return null;

  const handleSubmit = async (rateeId: string) => {
    const stars = starsDraft[rateeId] || 0;
    if (stars < 1 || stars > 5) {
      setFeedback((prev) => ({
        ...prev,
        [rateeId]: { type: "err", text: "Selecione de 1 a 5 estrelas." }
      }));
      return;
    }

    setSubmittingTarget(rateeId);
    setFeedback((prev) => {
      const next = { ...prev };
      delete next[rateeId];
      return next;
    });

    try {
      const comment = commentsEnabled ? (commentDraft[rateeId] || "").trim() || null : null;
      const { data, error } = await supabase.rpc("rating_submit", {
        p_order_id: order.id,
        p_ratee_id: rateeId,
        p_stars: stars,
        p_comment: comment
      });

      if (error || !data?.success) {
        setFeedback((prev) => ({
          ...prev,
          [rateeId]: {
            type: "err",
            text: data?.error || error?.message || "Erro ao enviar avaliação."
          }
        }));
      } else {
        setExistingRatings((prev) => ({
          ...prev,
          [rateeId]: { stars, comment }
        }));
        setEditingTarget((prev) => ({ ...prev, [rateeId]: false }));
        setFeedback((prev) => ({
          ...prev,
          [rateeId]: { type: "ok", text: "Avaliação salva!" }
        }));
      }
    } catch (e: any) {
      setFeedback((prev) => ({
        ...prev,
        [rateeId]: { type: "err", text: e?.message || "Erro ao avaliar." }
      }));
    } finally {
      setSubmittingTarget(null);
    }
  };

  return (
    <div className="mt-3 pt-3 border-t border-zinc-200/80 dark:border-zinc-800 space-y-2.5 w-full">
      <p className="text-[11px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1">
        <Star size={12} className="fill-amber-400 text-amber-400" />
        Avaliar este pedido
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {targets.map((t) => {
          const saved = existingRatings[t.rateeId];
          const isEditing = editingTarget[t.rateeId] || !saved;
          const curStars = starsDraft[t.rateeId] ?? saved?.stars ?? 0;
          const curComment = commentDraft[t.rateeId] ?? saved?.comment ?? "";
          const fb = feedback[t.rateeId];

          return (
            <div
              key={t.rateeId}
              className="p-2.5 rounded-xl bg-amber-50/50 dark:bg-zinc-950/60 border border-amber-200/70 dark:border-zinc-800 flex flex-col gap-1.5"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-[10px] font-bold uppercase text-zinc-400 block">
                    {t.roleLabel}
                  </span>
                  <span className="text-xs font-extrabold text-zinc-800 dark:text-zinc-100 truncate block">
                    {t.name}
                  </span>
                </div>

                {saved && !isEditing && (
                  <button
                    type="button"
                    onClick={() => setEditingTarget((prev) => ({ ...prev, [t.rateeId]: true }))}
                    className="text-[10px] font-bold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <Edit2 size={10} />
                    Editar
                  </button>
                )}
              </div>

              {saved && !isEditing ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star
                        key={n}
                        size={14}
                        className={
                          n <= saved.stars
                            ? "fill-amber-400 text-amber-400"
                            : "text-zinc-300 dark:text-zinc-700"
                        }
                      />
                    ))}
                    <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 ml-1 flex items-center gap-0.5">
                      <Check size={11} /> Enviada
                    </span>
                  </div>
                  {saved.comment && (
                    <p className="text-[11px] text-zinc-600 dark:text-zinc-400 italic">
                      &ldquo;{saved.comment}&rdquo;
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() =>
                          setStarsDraft((prev) => ({ ...prev, [t.rateeId]: n }))
                        }
                        className="p-0.5 transition hover:scale-110 cursor-pointer"
                        title={`${n} estrela(s)`}
                      >
                        <Star
                          size={18}
                          className={
                            n <= curStars
                              ? "fill-amber-400 text-amber-400"
                              : "text-zinc-300 dark:text-zinc-600"
                          }
                        />
                      </button>
                    ))}
                    {curStars > 0 && (
                      <span className="text-xs font-black text-amber-700 dark:text-amber-300 ml-1">
                        {curStars}/5
                      </span>
                    )}
                  </div>

                  {commentsEnabled && curStars > 0 && (
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        maxLength={280}
                        placeholder="Comentário curto (opcional, sem dados pessoais)"
                        value={curComment}
                        onChange={(e) =>
                          setCommentDraft((prev) => ({
                            ...prev,
                            [t.rateeId]: e.target.value
                          }))
                        }
                        className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-amber-500 text-zinc-900 dark:text-white"
                      />
                      <button
                        type="button"
                        disabled={submittingTarget === t.rateeId}
                        onClick={() => handleSubmit(t.rateeId)}
                        className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 transition cursor-pointer shrink-0"
                      >
                        <Send size={12} />
                        Salvar
                      </button>
                    </div>
                  )}

                  {!commentsEnabled && curStars > 0 && (
                    <button
                      type="button"
                      disabled={submittingTarget === t.rateeId}
                      onClick={() => handleSubmit(t.rateeId)}
                      className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 transition cursor-pointer w-fit"
                    >
                      <Send size={12} />
                      Salvar nota
                    </button>
                  )}
                </div>
              )}

              {fb && (
                <p
                  className={`text-[11px] font-bold ${
                    fb.type === "ok"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {fb.text}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
