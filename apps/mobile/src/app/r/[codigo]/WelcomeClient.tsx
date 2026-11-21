'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Sparkles, Download, UserPlus, ArrowRight } from 'lucide-react';

interface WelcomeClientProps {
  partnerName: string;
  referralCode: string;
}

export default function WelcomeClient({ partnerName, referralCode }: WelcomeClientProps) {
  const router = useRouter();
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    // Também garante no client-side a gravação do cookie
    if (typeof document !== 'undefined') {
      const maxAge = 7 * 24 * 60 * 60;
      document.cookie = `affiliate_ref=${encodeURIComponent(referralCode)}; path=/; max-age=${maxAge}; SameSite=Lax`;
    }

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          router.push('/cadastro');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [referralCode, router]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-950 via-zinc-950 to-black text-white flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Luz de fundo decorativa */}
      <div className="absolute top-1/4 -left-20 w-80 h-80 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-zinc-900/90 border border-purple-500/30 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl flex flex-col items-center text-center relative z-10 animate-fade-in">
        
        {/* Logo / Ícone */}
        <div className="w-24 h-24 mb-4 rounded-3xl bg-gradient-to-tr from-purple-700 to-purple-500 p-0.5 shadow-lg shadow-purple-600/30 flex items-center justify-center">
          <div className="w-full h-full bg-zinc-950 rounded-[22px] flex items-center justify-center overflow-hidden relative">
            <Image
              src="/icon.png"
              alt="AçaíFood Logo"
              width={72}
              height={72}
              className="object-contain"
              priority
            />
          </div>
        </div>

        {/* Tag de Convite Especial */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 text-xs font-semibold mb-4">
          <Sparkles size={14} className="text-purple-400" />
          <span>Convite Especial</span>
        </div>

        {/* Título com Nome do Parceiro */}
        <h1 className="text-xl sm:text-2xl font-black text-white mb-2 leading-tight">
          Você foi convidado por <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-amber-300">{partnerName}</span> para conhecer o AçaíFood!
        </h1>

        {/* Subtexto */}
        <p className="text-sm text-zinc-400 mb-6 font-medium">
          O aplicativo de açaí de Belém do Pará
        </p>

        {/* Countdown pill */}
        <div className="w-full bg-zinc-800/80 border border-zinc-700/60 rounded-xl py-2 px-3 mb-6 text-xs text-zinc-300 flex items-center justify-center gap-2">
          <div className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />
          <span>
            Redirecionando para o cadastro em <strong className="text-purple-300 font-bold">{countdown}s</strong>...
          </span>
        </div>

        {/* Ações */}
        <div className="w-full space-y-3">
          {/* Botão primário: Play Store */}
          <a
            href="https://play.google.com/store/apps/details?id=br.app.acaifood"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 text-white font-bold text-sm shadow-lg shadow-purple-900/40 flex items-center justify-center gap-2.5 transition transform active:scale-95"
          >
            <Download size={18} />
            <span>Baixar na Play Store</span>
          </a>

          {/* Botão secundário: Cadastrar agora */}
          <Link
            href="/cadastro"
            className="w-full py-3.5 px-4 rounded-2xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-100 font-bold text-sm flex items-center justify-center gap-2.5 transition transform active:scale-95"
          >
            <UserPlus size={18} />
            <span>Cadastrar agora</span>
            <ArrowRight size={16} className="text-zinc-400" />
          </Link>
        </div>

        <div className="mt-6 text-[11px] text-zinc-500">
          Código de indicação: <span className="font-mono text-zinc-400">{referralCode}</span>
        </div>
      </div>
    </div>
  );
}
