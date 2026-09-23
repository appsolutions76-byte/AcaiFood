'use client';

import React, { useEffect } from 'react';
import { RefreshCw, AlertTriangle, Home } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Unhandled app runtime error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/30 rounded-3xl flex items-center justify-center text-amber-400 mb-4 shadow-xl">
        <AlertTriangle size={32} />
      </div>

      <h1 className="text-2xl font-black tracking-tight text-white mb-2">
        Recarregando Painel
      </h1>

      <p className="text-sm text-zinc-400 max-w-md mb-6 leading-relaxed">
        Ocorreu uma oscilação temporária de conexão ou carregamento de dados. Clique abaixo para restabelecer a sincronização.
      </p>

      <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-xs">
        <button
          onClick={() => {
            if (typeof window !== 'undefined') {
              window.location.reload();
            } else {
              reset();
            }
          }}
          className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 px-5 rounded-2xl transition shadow-lg active:scale-95 flex items-center justify-center gap-2 text-sm cursor-pointer"
        >
          <RefreshCw size={16} /> Recarregar Painel
        </button>

        <a
          href="/"
          className="w-full bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-bold py-3 px-5 rounded-2xl transition border border-zinc-800 active:scale-95 flex items-center justify-center gap-2 text-sm text-center"
        >
          <Home size={16} /> Início
        </a>
      </div>
    </div>
  );
}
