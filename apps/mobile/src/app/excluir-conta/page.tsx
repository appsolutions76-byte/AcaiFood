"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Trash2, ShieldCheck, Mail, CheckCircle2 } from "lucide-react";
import { supabase, getAuthHeaders } from "@/lib/supabase";

// Página pública exigida pelo Google Play: como pedir a exclusão da conta e dos dados.
// Logado: o pedido entra no canal de suporte (categoria "outro") e o admin conclui pela
// rota /api/admin/delete-user (que já encerra a subconta Asaas e guarda o que a lei exige).
export default function ExcluirContaPage() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }: any) => setLoggedIn(!!data?.session)).catch(() => setLoggedIn(false));
  }, []);

  const requestDeletion = async () => {
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          action: "send",
          message: {
            category: "outro",
            content: `[PEDIDO DE EXCLUSÃO DE CONTA] O usuário pediu, pelo app, a exclusão da conta e dos dados pessoais.${reason.trim() ? ` Motivo: ${reason.trim().slice(0, 500)}` : ""}`,
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Não foi possível enviar o pedido agora.");
      setDone(true);
    } catch (e: any) {
      setError(e?.message || "Não foi possível enviar o pedido agora. Tente de novo ou use o e-mail abaixo.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans p-4 sm:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <Link href="/" className="flex items-center gap-2 text-purple-400 hover:text-purple-300 font-bold text-sm transition">
            <ArrowLeft size={16} /> Voltar para o AçaíFood
          </Link>
          <Image src="/logo-header-escuro.svg" alt="AçaíFood" width={608} height={124} unoptimized className="h-8 w-auto object-contain" />
        </div>

        <div className="bg-red-950/40 border border-red-900/60 p-6 rounded-3xl space-y-2">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center gap-2">
            <Trash2 size={24} className="text-red-400" /> Excluir minha conta
          </h1>
          <p className="text-sm text-red-200">
            AçaíFood: Eletromecânica Baia Ltda (CNPJ 42.035.623/0001-40). Vale para clientes, lojas, motoboys, fornecedores e caminhoneiros.
          </p>
        </div>

        <div className="space-y-5 text-sm text-zinc-300 leading-relaxed bg-zinc-900/60 p-6 rounded-3xl border border-zinc-800">
          <section className="space-y-2">
            <h2 className="text-base font-bold text-white">Como pedir a exclusão</h2>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Entre no app com a sua conta.</li>
              <li>Abra o menu e toque em <strong>Excluir minha conta</strong> (ou abra esta página: acaifood.app.br/excluir-conta).</li>
              <li>Digite <strong>EXCLUIR</strong> e toque em <strong>Enviar pedido de exclusão</strong>.</li>
              <li>A nossa equipe confere se não há pedido em andamento ou saldo a sacar e conclui a exclusão em até <strong>15 dias</strong>. Você recebe a confirmação no e-mail cadastrado.</li>
            </ol>
            <p className="text-zinc-400">
              Se não conseguir entrar no app, envie um e-mail para <strong className="text-purple-300">appsolutions76@gmail.com</strong> a partir do e-mail cadastrado, com o assunto <strong>&quot;Excluir minha conta&quot;</strong> e o seu nome.
            </p>
          </section>

          <hr className="border-zinc-800" />

          <section className="space-y-2">
            <h2 className="text-base font-bold text-white flex items-center gap-2"><ShieldCheck size={16} className="text-purple-400" /> O que é apagado e o que é guardado</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Apagados:</strong> perfil, nome, telefone, e-mail, endereço, localização, fotos, avaliações, favoritos e o acesso à conta.</li>
              <li><strong>Encerrada:</strong> a subconta de pagamentos no Asaas (para lojas e entregadores), depois de sacado o saldo.</li>
              <li><strong>Guardados pelo prazo exigido em lei</strong> (obrigações fiscais, contábeis e de prevenção à lavagem de dinheiro): registros de pedidos pagos, Pix, repasses, saques e notas fiscais. Esses dados ficam bloqueados e não são usados para outra finalidade.</li>
            </ul>
            <p className="text-zinc-400">Antes de pedir a exclusão, saque o saldo da sua carteira, se houver.</p>
          </section>

          <hr className="border-zinc-800" />

          <section className="space-y-3">
            <h2 className="text-base font-bold text-white">Enviar pedido de exclusão</h2>

            {loggedIn === null && <p className="text-zinc-500">Carregando…</p>}

            {loggedIn === false && (
              <div className="space-y-3">
                <p>Para pedir pelo app, entre na sua conta primeiro.</p>
                <Link href="/login" className="inline-block bg-purple-600 hover:bg-purple-500 text-white font-bold px-5 py-2.5 rounded-xl">
                  Entrar na minha conta
                </Link>
                <p className="flex items-center gap-2 text-zinc-400"><Mail size={14} /> Ou pelo e-mail appsolutions76@gmail.com</p>
              </div>
            )}

            {loggedIn && !done && (
              <div className="space-y-3">
                <label className="block">
                  <span className="text-xs text-zinc-400">Motivo (opcional)</span>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    maxLength={500}
                    rows={2}
                    className="mt-1 w-full rounded-xl bg-zinc-950 border border-zinc-700 p-3 text-sm text-white"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-zinc-400">Digite EXCLUIR para confirmar</span>
                  <input
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    className="mt-1 w-full rounded-xl bg-zinc-950 border border-zinc-700 p-3 text-sm text-white uppercase"
                    autoComplete="off"
                  />
                </label>
                {error && <p className="text-red-400 text-xs font-bold">{error}</p>}
                <button
                  onClick={requestDeletion}
                  disabled={sending || confirmText.trim().toUpperCase() !== "EXCLUIR"}
                  className="w-full sm:w-auto bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-extrabold px-5 py-3 rounded-xl flex items-center justify-center gap-2"
                >
                  <Trash2 size={16} /> {sending ? "Enviando…" : "Enviar pedido de exclusão"}
                </button>
              </div>
            )}

            {done && (
              <div className="flex items-start gap-2 bg-emerald-950/40 border border-emerald-800/60 p-4 rounded-2xl text-emerald-200">
                <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
                <p>Pedido recebido. A exclusão será concluída em até 15 dias e você receberá a confirmação no e-mail cadastrado.</p>
              </div>
            )}
          </section>
        </div>

        <p className="text-center text-xs text-zinc-500 pb-8">
          Veja também a <Link href="/politica-de-privacidade" className="underline">Política de Privacidade</Link>.
        </p>
      </div>
    </div>
  );
}
