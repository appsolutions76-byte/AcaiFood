"use client";

import React from "react";
import { ExternalLink } from "lucide-react";

export function AdminSimulatorTab() {
  return (
    <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-zinc-900 p-4 sm:p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
        <div>
          <h2 className="text-base sm:text-lg font-black text-zinc-900 dark:text-white flex items-center gap-2">
            <span>📊</span>
            <span>Simulador de Viabilidade Financeira</span>
          </h2>
          <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 mt-1">
            Simule comissão, tarifa Pix, adesão das batedeiras e custos. Os valores não alteram as taxas reais do app.
          </p>
        </div>
        <a
          href="/ferramentas/simulador-viabilidade.html"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs sm:text-sm transition-all shadow-md shadow-purple-600/20 shrink-0 cursor-pointer"
        >
          <ExternalLink size={16} />
          <span>Abrir em tela cheia</span>
        </a>
      </div>

      <div className="bg-white dark:bg-zinc-900 p-2 sm:p-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        <iframe
          src="/ferramentas/simulador-viabilidade.html"
          title="Simulador de viabilidade"
          loading="lazy"
          style={{ width: "100%", height: "calc(100vh - 140px)", border: 0, borderRadius: 16 }}
        />
      </div>
    </div>
  );
}

export default AdminSimulatorTab;
