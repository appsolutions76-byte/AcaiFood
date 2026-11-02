"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAppStore } from "@/store/useAppStore";
import { RatingBadge } from "@/components/ratings/RatingBadge";
import { Check, X, AlertCircle, LogIn, UserPlus, ArrowLeft, ShieldCheck } from "lucide-react";

export default function ConvitePage() {
  const params = useParams();
  const router = useRouter();
  const token = String(params?.token || "");
  const currentUser = useAppStore((s: any) => s.currentUser);
  const cities = useAppStore((s: any) => s.cities);
  const fetchCities = useAppStore((s: any) => s.fetchCities);

  const [invite, setInvite] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [acceptedMsg, setAcceptedMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchCities();
  }, [fetchCities]);

  useEffect(() => {
    if (!token) {
      setErrorMsg("Link de convite inválido.");
      setLoading(false);
      return;
    }

    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.rpc("referral_get_invite", { p_token: token });
        if (error || !data?.success) {
          setErrorMsg(data?.error || error?.message || "Convite inválido ou expirado.");
        } else {
          setInvite(data);
        }
      } catch (e: any) {
        setErrorMsg(e?.message || "Erro ao consultar convite.");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const handleAccept = async () => {
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const { data, error } = await supabase.rpc("referral_accept_invite", { p_token: token });
      if (error || !data?.success) {
        setErrorMsg(data?.error || error?.message || "Não foi possível aceitar o convite.");
      } else {
        setAcceptedMsg("Convite aceito com sucesso! Você já é um parceiro indicado ativo.");
        setTimeout(() => {
          const veic = String(currentUser?.veiculo || "").toLowerCase();
          if (veic.includes("caminh") || veic.includes("caçamb") || invite?.flow === "B2B" || invite?.flow === "COLETA") {
            router.push("/parceiros/caminhao");
          } else {
            router.push("/parceiros/motoboy");
          }
        }, 1800);
      }
    } catch (e: any) {
      setErrorMsg(e?.message || "Erro ao aceitar convite.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = () => {
    router.push("/");
  };

  const returnPath = `/convite/${encodeURIComponent(token)}`;
  const isDriverLogged =
    currentUser &&
    ["motorista", "motoboy", "caminhao", "courier", "driver"].includes(
      String(currentUser.role || "").toLowerCase()
    );

  const cityObj = (cities || []).find(
    (c: any) =>
      String(c.name || "").toLowerCase().trim() ===
      String(invite?.partner_cidade || "").toLowerCase().trim()
  );
  const ratingsEnabled = Boolean(
    cityObj?.ratings_enabled || cityObj?.rates?.ratings_enabled
  );

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-lg p-6 space-y-5">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:text-purple-600 flex items-center gap-1"
          >
            <ArrowLeft size={14} /> Início
          </Link>
          <span className="text-[11px] font-black uppercase tracking-wider text-purple-600">
            Convite de Indicação
          </span>
        </div>

        {loading ? (
          <div className="py-10 text-center text-sm text-zinc-500">
            Verificando convite...
          </div>
        ) : errorMsg && !invite ? (
          <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-center space-y-3">
            <AlertCircle className="mx-auto text-red-600" size={28} />
            <p className="text-sm font-bold text-red-700 dark:text-red-300">{errorMsg}</p>
            <Link
              href="/"
              className="inline-block bg-zinc-900 text-white text-xs font-bold px-4 py-2 rounded-xl"
            >
              Voltar ao início
            </Link>
          </div>
        ) : invite ? (
          <div className="space-y-4">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 flex items-center justify-center mx-auto font-black text-xl">
                <ShieldCheck size={28} />
              </div>
              <h1 className="text-lg font-black text-zinc-900 dark:text-white">
                A loja {invite.partner_name} convidou você para ser um parceiro indicado
              </h1>
              <div className="flex items-center justify-center gap-2">
                {invite.partner_bairro && (
                  <span className="text-xs text-zinc-500">
                    {invite.partner_bairro} • {invite.partner_cidade}
                  </span>
                )}
                <RatingBadge
                  avgStars={invite.partner_avg_stars}
                  ratingCount={invite.partner_rating_count}
                  ratingsEnabled={ratingsEnabled}
                />
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                Ao aceitar, você passa a ser um parceiro indicado ativo deste estabelecimento e continua livre para atender outras lojas no app.
              </p>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs font-bold text-red-700 dark:text-red-300 text-center">
                {errorMsg}
              </div>
            )}

            {acceptedMsg ? (
              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-bold text-emerald-700 dark:text-emerald-300 text-center">
                {acceptedMsg}
              </div>
            ) : !currentUser ? (
              <div className="space-y-3 pt-2">
                <p className="text-xs text-center text-zinc-600 dark:text-zinc-400 font-medium">
                  Entre na sua conta de motorista ou crie seu cadastro para responder a este convite:
                </p>
                <div className="grid grid-cols-2 gap-2.5">
                  <Link
                    href={`/login?returnUrl=${encodeURIComponent(returnPath)}`}
                    className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5"
                  >
                    <LogIn size={14} /> Entrar
                  </Link>
                  <Link
                    href={`/cadastro?role=motorista&returnUrl=${encodeURIComponent(returnPath)}`}
                    className="bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-white text-xs font-bold py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5"
                  >
                    <UserPlus size={14} /> Criar conta
                  </Link>
                </div>
              </div>
            ) : !isDriverLogged ? (
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 text-center space-y-2">
                <p className="font-bold">
                  Você está conectado como {currentUser.name} ({currentUser.role}).
                </p>
                <p>Apenas contas de motorista podem aceitar convites de indicação.</p>
                <Link
                  href={`/login?returnUrl=${encodeURIComponent(returnPath)}`}
                  className="inline-block bg-purple-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg"
                >
                  Trocar de conta
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleAccept}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-1.5 transition"
                >
                  <Check size={15} /> {submitting ? "Aceitando..." : "Aceitar convite"}
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleReject}
                  className="bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-1.5 transition"
                >
                  <X size={15} /> Recusar
                </button>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
