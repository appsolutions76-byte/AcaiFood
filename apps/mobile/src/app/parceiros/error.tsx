'use client';

import React, { useEffect } from 'react';
import { RefreshCw, AlertTriangle, ArrowLeft } from 'lucide-react';

export default function ParceirosError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Parceiros dashboard error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/30 rounded-3xl flex items-center justify-center text-amber-400 mb-4 shadow-xl">
        <AlertTriangle size={32} />
      </div>

      <h1 className="text-2xl font-black tracking-tight text-white mb-2">
        Sincronizando Painel do Parceiro
      </h1>

      <p className="text-sm text-zinc-400 max-w-md mb-4 leading-relaxed">
        Não foi possível atualizar todas as informações em tempo real. Clique em recarregar para reestabelecer o painel operacional.
      </p>

      {error?.message && (
        <div className="bg-red-950/60 border border-red-800/80 text-red-200 text-xs p-3 rounded-2xl mb-6 max-w-md w-full font-mono text-left overflow-auto max-h-32">
          <strong>Detalhe do erro:</strong> {error.message}
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-xs">
        <button
          onClick={() => {
            try {
              reset();
            } catch (_) {}
            if (typeof window !== 'undefined') {
              window.location.href = window.location.pathname;
            }
          }}
          className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 px-5 rounded-2xl transition shadow-lg active:scale-95 flex items-center justify-center gap-2 text-sm cursor-pointer"
        >
          <RefreshCw size={16} /> Recarregar Painel
        </button>

        <a
          href="/login"
          className="w-full bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-bold py-3 px-5 rounded-2xl transition border border-zinc-800 active:scale-95 flex items-center justify-center gap-2 text-sm text-center"
        >
          <ArrowLeft size={16} /> Ir para Login
        </a>
      </div>
    </div>
  );
}
