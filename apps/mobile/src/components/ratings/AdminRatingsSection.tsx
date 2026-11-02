"use client";

import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Star, EyeOff, Eye, RefreshCw, AlertTriangle, CheckCircle2 } from "lucide-react";

export function AdminRatingsSection() {
  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState<any[]>([]);
  const [ratings, setRatings] = useState<any[]>([]);
  const [subTab, setSubTab] = useState<"reports" | "all">("reports");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [moderatingId, setModeratingId] = useState<string | null>(null);
  const [windowDays, setWindowDays] = useState<number>(7);
  const [minCountDisplay, setMinCountDisplay] = useState<number>(3);
  const [commentsEnabled, setCommentsEnabled] = useState<boolean>(true);
  const [savingGlobal, setSavingGlobal] = useState(false);

  const loadModeration = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data }, { data: ps }] = await Promise.all([
        supabase.rpc("admin_get_ratings_moderation"),
        supabase
          .from("platform_settings")
          .select("rating_window_days, rating_min_count_display, rating_comments_enabled")
          .limit(1)
          .maybeSingle(),
      ]);
      if (data?.success) {
        setReports(Array.isArray(data.reports) ? data.reports : []);
        setRatings(Array.isArray(data.ratings) ? data.ratings : []);
      }
      if (ps) {
        if (ps.rating_window_days != null) setWindowDays(Number(ps.rating_window_days));
        if (ps.rating_min_count_display != null) setMinCountDisplay(Number(ps.rating_min_count_display));
        if (ps.rating_comments_enabled != null) setCommentsEnabled(Boolean(ps.rating_comments_enabled));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSaveGlobalParams = async () => {
    setSavingGlobal(true);
    try {
      const { error } = await supabase
        .from("platform_settings")
        .update({
          rating_window_days: Math.max(1, Number(windowDays) || 7),
          rating_min_count_display: Math.max(1, Number(minCountDisplay) || 3),
          rating_comments_enabled: Boolean(commentsEnabled),
        })
        .not("id", "is", null);
      if (error) {
        setFeedback(error.message);
      } else {
        setFeedback("Parâmetros globais de avaliação salvos com sucesso!");
      }
    } finally {
      setSavingGlobal(false);
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  useEffect(() => {
    loadModeration();
  }, [loadModeration]);

  const handleModerate = async (ratingId: string, status: "VISIBLE" | "HIDDEN") => {
    const resolution =
      status === "HIDDEN"
        ? prompt("Informe o motivo da ocultação (para auditoria):", "Comentário inadequado") || "Ocultado pela moderação"
        : "Mantido visível pela moderação";

    setModeratingId(ratingId);
    try {
      const { data, error } = await supabase.rpc("admin_rating_moderate", {
        p_rating_id: ratingId,
        p_status: status,
        p_resolution: resolution
      });
      if (error || !data?.success) {
        setFeedback(data?.error || error?.message || "Erro ao moderar avaliação.");
      } else {
        setFeedback(
          status === "HIDDEN"
            ? "Avaliação ocultada com sucesso (registrado no log de auditoria)."
            : "Avaliação mantida visível (denúncias encerradas)."
        );
        await loadModeration();
      }
    } finally {
      setModeratingId(null);
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  const openReportsCount = reports.filter((r) => r.report_status === "OPEN").length;

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-3">
        <div>
          <h3 className="font-black text-base sm:text-lg text-zinc-900 dark:text-white flex items-center gap-2">
            <Star size={18} className="fill-amber-400 text-amber-400" />
            Moderação de Avaliações e Denúncias (R39)
          </h3>
          <p className="text-xs text-zinc-500">
            Analise comentários denunciados e oculte ou mantenha avaliações com registro no log de auditoria.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSubTab("reports")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              subTab === "reports"
                ? "bg-amber-600 text-white"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
            }`}
          >
            <AlertTriangle size={13} />
            Denúncias ({openReportsCount} abertas)
          </button>
          <button
            type="button"
            onClick={() => setSubTab("all")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              subTab === "all"
                ? "bg-purple-600 text-white"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
            }`}
          >
            Últimas Avaliações ({ratings.length})
          </button>
          <button
            type="button"
            onClick={loadModeration}
            className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 cursor-pointer"
            title="Recarregar"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {feedback && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-bold text-emerald-800 dark:text-emerald-300">
          {feedback}
        </div>
      )}

      {/* Parâmetros Globais de Avaliação (platform_settings) */}
      <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
          <div>
            <label className="text-[10px] uppercase text-zinc-500 font-bold block mb-1">
              Janela para avaliar (dias)
            </label>
            <input
              type="number"
              min={1}
              max={60}
              value={windowDays}
              onChange={(e) => setWindowDays(Math.max(1, Number(e.target.value) || 7))}
              className="w-full border dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded-lg p-2 text-xs outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase text-zinc-500 font-bold block mb-1">
              Mínimo de notas para exibir média
            </label>
            <input
              type="number"
              min={1}
              max={50}
              value={minCountDisplay}
              onChange={(e) => setMinCountDisplay(Math.max(1, Number(e.target.value) || 3))}
              className="w-full border dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded-lg p-2 text-xs outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div className="flex items-center pt-4">
            <label className="flex items-center gap-2 text-xs font-bold text-zinc-700 dark:text-zinc-300 cursor-pointer">
              <input
                type="checkbox"
                checked={commentsEnabled}
                onChange={(e) => setCommentsEnabled(e.target.checked)}
                className="w-4 h-4 accent-purple-600"
              />
              Permitir comentários escritos (máx. 280 caract.)
            </label>
          </div>
        </div>
        <button
          type="button"
          disabled={savingGlobal}
          onClick={handleSaveGlobalParams}
          className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-bold transition shrink-0 cursor-pointer"
        >
          {savingGlobal ? "Salvando..." : "Salvar Regras Globais"}
        </button>
      </div>

      {subTab === "reports" ? (
        reports.length === 0 ? (
          <div className="text-center py-8 text-xs text-zinc-500">
            Nenhuma denúncia de avaliação registrada até o momento.
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map((rep) => (
              <div
                key={rep.report_id}
                className={`p-3.5 rounded-xl border flex flex-col sm:flex-row justify-between gap-3 ${
                  rep.report_status === "OPEN"
                    ? "bg-amber-50/50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800"
                    : "bg-zinc-50 dark:bg-zinc-950/50 border-zinc-200 dark:border-zinc-800 opacity-75"
                }`}
              >
                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-[10px] font-black px-2 py-0.5 rounded uppercase ${
                        rep.report_status === "OPEN"
                          ? "bg-amber-500 text-white"
                          : "bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                      }`}
                    >
                      {rep.report_status}
                    </span>
                    <span className="font-bold text-zinc-800 dark:text-zinc-200">
                      {rep.rater_name || rep.rater_role} → {rep.ratee_name || rep.ratee_role} ({rep.flow})
                    </span>
                    <span className="font-black text-amber-600">★ {rep.stars}/5</span>
                    <span className="text-[10px] text-zinc-400">
                      Status da nota: <strong>{rep.rating_status}</strong>
                    </span>
                  </div>
                  {rep.comment && (
                    <p className="text-zinc-700 dark:text-zinc-300 italic">
                      Comentário: &ldquo;{rep.comment}&rdquo;
                    </p>
                  )}
                  <p className="text-red-600 dark:text-red-400 font-semibold">
                    Motivo da denúncia ({rep.reporter_name || "Usuário"}): {rep.reason}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <button
                    type="button"
                    disabled={moderatingId === rep.rating_id}
                    onClick={() => handleModerate(rep.rating_id, "HIDDEN")}
                    className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <EyeOff size={12} />
                    Ocultar
                  </button>
                  <button
                    type="button"
                    disabled={moderatingId === rep.rating_id}
                    onClick={() => handleModerate(rep.rating_id, "VISIBLE")}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <CheckCircle2 size={12} />
                    Manter Visível
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : ratings.length === 0 ? (
        <div className="text-center py-8 text-xs text-zinc-500">
          Nenhuma avaliação registrada até o momento.
        </div>
      ) : (
        <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
          {ratings.map((r) => (
            <div
              key={r.rating_id}
              className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row justify-between gap-2 text-xs"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`text-[10px] font-black px-2 py-0.5 rounded uppercase ${
                      r.status === "VISIBLE"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                    }`}
                  >
                    {r.status}
                  </span>
                  <span className="font-bold text-zinc-800 dark:text-zinc-200">
                    {r.rater_name || r.rater_role} → {r.ratee_name || r.ratee_role} ({r.flow})
                  </span>
                  <span className="font-black text-amber-600">★ {r.stars}/5</span>
                </div>
                {r.comment && (
                  <p className="text-zinc-700 dark:text-zinc-300 italic">
                    &ldquo;{r.comment}&rdquo;
                  </p>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                {r.status === "VISIBLE" ? (
                  <button
                    type="button"
                    disabled={moderatingId === r.rating_id}
                    onClick={() => handleModerate(r.rating_id, "HIDDEN")}
                    className="px-2.5 py-1 rounded-lg bg-red-100 hover:bg-red-200 text-red-700 text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <EyeOff size={12} />
                    Ocultar
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={moderatingId === r.rating_id}
                    onClick={() => handleModerate(r.rating_id, "VISIBLE")}
                    className="px-2.5 py-1 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-700 text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Eye size={12} />
                    Restaurar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
