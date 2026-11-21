'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Lock,
  Mail,
  User,
  Phone,
  Megaphone,
  ArrowRight,
  ShieldCheck,
  Loader2,
} from 'lucide-react';

function ConviteAfiliadoForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams?.get('token') || '';

  const [loadingToken, setLoadingToken] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [partnerData, setPartnerData] = useState<{ name: string; contact?: string; referral_code?: string } | null>(null);
  const [tokenError, setTokenError] = useState('');

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [howWillPromote, setHowWillPromote] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [success, setSuccess] = useState(false);

  // Validação do token na carga
  useEffect(() => {
    if (!token) {
      setLoadingToken(false);
      setTokenValid(false);
      setTokenError('Link de convite inválido ou incompleto (token ausente).');
      return;
    }

    async function checkToken() {
      try {
        const res = await fetch(`/api/affiliates/invite-check?token=${encodeURIComponent(token)}`);
        const data = await res.json();
        if (res.ok && data.valid) {
          setTokenValid(true);
          setPartnerData(data.partner);
          setName(data.partner?.name || '');
          setPhone(data.partner?.contact || '');
        } else {
          setTokenValid(false);
          setTokenError(data.error || 'Convite inválido ou prazo expirado.');
        }
      } catch (err: any) {
        setTokenValid(false);
        setTokenError('Erro ao verificar convite. Tente novamente mais tarde.');
      } finally {
        setLoadingToken(false);
      }
    }

    checkToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');

    if (!name.trim() || !email.trim() || !password) {
      setSubmitError('Preencha todos os campos obrigatórios.');
      return;
    }

    if (password.length < 6) {
      setSubmitError('A senha deve possuir pelo menos 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setSubmitError('As senhas não coincidem.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/affiliates/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          how_will_promote: howWillPromote.trim(),
          password,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao registrar parceiro afiliado.');
      }

      setSuccess(true);
    } catch (err: any) {
      setSubmitError(err.message || 'Erro inesperado.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingToken) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-4">
        <Loader2 className="w-10 h-10 text-purple-500 animate-spin mb-4" />
        <p className="text-zinc-400 text-sm">Validando convite de parceiro...</p>
      </div>
    );
  }

  if (!tokenValid) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-zinc-900 border border-red-500/30 rounded-3xl p-6 sm:p-8 text-center shadow-2xl">
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 mx-auto flex items-center justify-center mb-4">
            <AlertCircle size={32} />
          </div>
          <h1 className="text-xl font-black text-white mb-2">Convite Indisponível</h1>
          <p className="text-sm text-zinc-400 mb-6">{tokenError}</p>
          <div className="space-y-3">
            <Link
              href="/"
              className="block w-full py-3 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 font-bold text-sm text-white transition text-center"
            >
              Ir para o Início
            </Link>
            <a
              href="https://wa.me/5591981234567?text=Olá,%20preciso%20de%20ajuda%20com%20meu%20convite%20de%20parceiro%20AçaíFood"
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full py-3 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 font-medium text-xs text-zinc-300 transition text-center"
            >
              Falar com o Suporte
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-zinc-900 border border-emerald-500/30 rounded-3xl p-6 sm:p-8 text-center shadow-2xl">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center mb-4">
            <CheckCircle2 size={32} />
          </div>
          <h1 className="text-2xl font-black text-white mb-2">Cadastro Realizado!</h1>
          <p className="text-sm text-zinc-300 mb-4">
            Parabéns, <strong className="text-white">{name}</strong>! Seus dados foram registrados com sucesso no programa de parceiros AçaíFood.
          </p>
          <div className="bg-zinc-800/80 border border-zinc-700 rounded-2xl p-4 text-xs text-zinc-400 mb-6 text-left space-y-1.5">
            <p>• Seu código de indicação preliminar: <strong className="text-purple-300 font-mono">{partnerData?.referral_code}</strong></p>
            <p>• Sua conta será ativada pelo administrador após a configuração dos bônus e subconta.</p>
            <p>• Você já pode acessar a plataforma para acompanhar o status.</p>
          </div>
          <Link
            href="/login"
            className="block w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 font-bold text-sm text-white transition text-center shadow-lg shadow-purple-900/30"
          >
            Fazer Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-950/40 via-zinc-950 to-black text-white flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-lg bg-zinc-900/90 border border-purple-500/30 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl">
        
        {/* Cabeçalho */}
        <div className="flex items-center gap-3 mb-6 pb-6 border-b border-zinc-800">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-700 to-purple-500 p-0.5 shadow-md shrink-0 flex items-center justify-center">
            <div className="w-full h-full bg-zinc-950 rounded-[14px] flex items-center justify-center overflow-hidden">
              <Image src="/icon.png" alt="AçaíFood" width={42} height={42} className="object-contain" />
            </div>
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 text-[10px] font-bold uppercase tracking-wider mb-1">
              <Sparkles size={11} /> Programa de Afiliados
            </div>
            <h1 className="text-lg sm:text-xl font-black text-white">Cadastro de Parceiro</h1>
            <p className="text-xs text-zinc-400">Complete seus dados para começar a divulgar</p>
          </div>
        </div>

        {submitError && (
          <div className="mb-6 p-3.5 bg-red-950/60 border border-red-500/40 rounded-xl text-red-300 text-xs flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0 text-red-400" />
            <span>{submitError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nome completo */}
          <div>
            <label className="block text-xs font-bold text-zinc-300 mb-1.5 flex items-center gap-1.5">
              <User size={13} className="text-purple-400" /> Nome Completo *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Seu nome completo"
              className="w-full bg-zinc-800/90 border border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition"
            />
          </div>

          {/* E-mail */}
          <div>
            <label className="block text-xs font-bold text-zinc-300 mb-1.5 flex items-center gap-1.5">
              <Mail size={13} className="text-purple-400" /> E-mail de Acesso *
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seuemail@exemplo.com"
              className="w-full bg-zinc-800/90 border border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition"
            />
          </div>

          {/* WhatsApp / Contato */}
          <div>
            <label className="block text-xs font-bold text-zinc-300 mb-1.5 flex items-center gap-1.5">
              <Phone size={13} className="text-purple-400" /> WhatsApp / Telefone
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(91) 98000-0000"
              className="w-full bg-zinc-800/90 border border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition"
            />
          </div>

          {/* Como pretende divulgar */}
          <div>
            <label className="block text-xs font-bold text-zinc-300 mb-1.5 flex items-center gap-1.5">
              <Megaphone size={13} className="text-purple-400" /> Como pretende divulgar o AçaíFood?
            </label>
            <textarea
              rows={2}
              value={howWillPromote}
              onChange={(e) => setHowWillPromote(e.target.value)}
              placeholder="Ex: Redes sociais (Instagram, TikTok), grupos de WhatsApp de Belém, panfletagem em comércios locais..."
              className="w-full bg-zinc-800/90 border border-zinc-700/80 rounded-xl px-3.5 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition resize-none"
            />
          </div>

          {/* Senha e confirmação */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-xs font-bold text-zinc-300 mb-1.5 flex items-center gap-1.5">
                <Lock size={13} className="text-purple-400" /> Senha (mín. 6) *
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
                className="w-full bg-zinc-800/90 border border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-300 mb-1.5 flex items-center gap-1.5">
                <Lock size={13} className="text-purple-400" /> Confirmar Senha *
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••"
                className="w-full bg-zinc-800/90 border border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition"
              />
            </div>
          </div>

          <div className="pt-3">
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 disabled:opacity-50 text-white font-bold text-sm shadow-lg shadow-purple-900/40 flex items-center justify-center gap-2 transition cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Cadastrando...</span>
                </>
              ) : (
                <>
                  <span>Concluir Cadastro de Parceiro</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        </form>

        <div className="mt-6 pt-4 border-t border-zinc-800 text-center">
          <p className="text-xs text-zinc-500">
            Já possui cadastro?{' '}
            <Link href="/login" className="text-purple-400 hover:underline font-bold">
              Fazer login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ConviteAfiliadoPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
        </div>
      }
    >
      <ConviteAfiliadoForm />
    </Suspense>
  );
}
