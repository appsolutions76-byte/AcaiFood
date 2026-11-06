"use client";

import React from "react";
import { ARCHITECTURE_MAP_HTML } from "@/components/admin/architectureMapHtml";

export function AdminArchitectureTab() {
  return (
    <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
      <div className="bg-white dark:bg-zinc-900 p-4 sm:p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
        <h2 className="text-base sm:text-lg font-black text-zinc-900 dark:text-white flex items-center gap-2">
          <span>🧭</span>
          <span>Estrutura AçaíFood</span>
        </h2>
        <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 mt-1">
          Como o app funciona por dentro: quem fala com quem em cada fluxo, do cadastro ao saque. Use “Ligar animação completa” para ver tudo em sequência.
        </p>
      </div>

      <div className="bg-white dark:bg-zinc-900 p-2 sm:p-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        <iframe
          srcDoc={ARCHITECTURE_MAP_HTML}
          title="Estrutura AçaíFood"
          style={{ width: "100%", height: "calc(100vh - 140px)", minHeight: 640, border: 0, borderRadius: 16 }}
        />
      </div>
    </div>
  );
}

export default AdminArchitectureTab;
