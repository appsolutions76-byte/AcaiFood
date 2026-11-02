"use client";

import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { RatingBadge } from "@/components/ratings/RatingBadge";
import { Star, Flag, RefreshCw } from "lucide-react";

interface MyReceivedRatingsSectionProps {
  userId: string;
  ratingsEnabled?: boolean;
}

export function MyReceivedRatingsSection({
  userId,
  ratingsEnabled = false
}: MyReceivedRatingsSectionProps) {
  const [loading, setLoading] = useState(false);
  const [avgStars, setAvgStars] = useState<number | null>(null);
  const [ratingCount, setRatingCount] = useState<number>(0);
  const [minDisplay, setMinDisplay] = useState<number>(3);
  const [comments, setComments] = useState<any[]>([]);
  const [reportingId, setReportingId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!ratingsEnabled || !userId) return;
    setLoading(true);
    try {
      const { data } = await supabase.rpc("get_public_ratings_for_user", {
        p_ratee_id: userId
      });
      if (data?.success) {
        setAvgStars(data.avg_stars !== null ? Number(data.avg_stars) : null);
        setRatingCount(Number(data.rating_count || 0));
        setMinDisplay(Number(data.min_count_display || 3));
        setComments(Array.isArray(data.comments) ? data.comments : []);
      }
    } finally {
      setLoading(false);
    }
  }, [ratingsEnabled, userId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (!ratingsEnabled || !userId) return null;

  const handleReport = async (ratingId: string) => {
    const reason = reportReason.trim();
    if (!reason) return;
    const { data, error } = await supabase.rpc("rating_report_create", {
      p_rating_id: ratingId,
      p_reason: reason
    });
    if (error || !data?.success) {
      setFeedback(data?.error || error?.message || "Erro ao enviar denúncia.");
    } else {
      setFeedback(data.message || "Denúncia enviada para análise da moderação.");
      setReportingId(null);
      setReportReason("");
    }
    setTimeout(() => setFeedback(null), 4000);
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 sm:p-5 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <Star size={18} className="fill-amber-400 text-amber-400" />
          <div>
            <h4 className="font-black text-sm text-zinc-900 dark:text-white">
              Suas Avaliações Recebidas
            </h4>
            <p className="text-[11px] text-zinc-500">
              Nota pública exibida após {minDisplay} avaliações concluídas.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <RatingBadge
            avgStars={avgStars}
            ratingCount={ratingCount}
            minCountDisplay={minDisplay}
            ratingsEnabled={ratingsEnabled}
          />
          <button
            type="button"
            onClick={loadData}
            className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 transition cursor-pointer"
            title="Atualizar avaliações"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {feedback && (
        <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs font-bold text-amber-800 dark:text-amber-300">
          {feedback}
        </div>
      )}

      {comments.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-800 max-h-60 overflow-y-auto pr-1">
          {comments.map((c: any) => (
            <div
              key={c.id}
              className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/70 dark:border-zinc-800 flex flex-col gap-1.5"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={n}
                      size={12}
                      className={
                        n <= c.stars
                          ? "fill-amber-400 text-amber-400"
                          : "text-zinc-300 dark:text-zinc-700"
                      }
                    />
                  ))}
                  <span className="text-[10px] font-bold text-zinc-400 ml-1">
                    {c.created_at
                      ? new Date(c.created_at).toLocaleDateString("pt-BR")
                      : ""}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setReportingId(reportingId === c.id ? null : c.id);
                    setReportReason("");
                  }}
                  className="text-[10px] font-bold text-red-600 dark:text-red-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Flag size={10} />
                  Denunciar comentário
                </button>
              </div>

              <p className="text-xs text-zinc-700 dark:text-zinc-300">
                &ldquo;{c.comment}&rdquo;
              </p>

              {reportingId === c.id && (
                <div className="flex gap-1.5 pt-1">
                  <input
                    type="text"
                    maxLength={300}
                    placeholder="Motivo da denúncia (ex: ofensa, dado pessoal)"
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    className="flex-1 bg-white dark:bg-zinc-900 border border-red-200 dark:border-red-800 rounded-lg px-2.5 py-1 text-xs outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleReport(c.id)}
                    className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-3 py-1 rounded-lg cursor-pointer"
                  >
                    Enviar
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
