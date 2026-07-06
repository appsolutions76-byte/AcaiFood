import React from "react";
import Link from "next/link";
import { ArrowLeft, PackageOpen, LayoutList } from "lucide-react";

export default function FornecedorDashboard() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950">
      <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 p-4">
        <div className="flex items-center gap-3">
          <Link href="/parceiros">
            <ArrowLeft className="text-zinc-600 dark:text-zinc-400" />
          </Link>
          <PackageOpen className="text-emerald-600" />
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white">Painel do Atacado</h1>
        </div>
      </header>
      <main className="p-6">
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm text-center">
          <LayoutList className="mx-auto text-zinc-400 mb-4" size={48} />
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">Estoque B2B</h2>
          <p className="text-zinc-500 dark:text-zinc-400 mt-2">Cadastre seus lotes de fruto ou caixas de açaí para as lojas comprarem.</p>
        </div>
      </main>
    </div>
  );
}
