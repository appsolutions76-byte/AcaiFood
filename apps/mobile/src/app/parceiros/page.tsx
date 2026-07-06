import React from "react";
import Link from "next/link";
import { Store, Truck, Bike, PackageOpen, ArrowLeft } from "lucide-react";

export default function ParceirosOnboarding() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 flex flex-col">
      <header className="p-4 flex items-center gap-3">
        <Link href="/">
          <div className="p-2 hover:bg-gray-200 dark:hover:bg-zinc-800 rounded-full transition">
            <ArrowLeft className="text-zinc-600 dark:text-zinc-400" />
          </div>
        </Link>
        <h1 className="text-xl font-bold text-zinc-900 dark:text-white">Portal do Parceiro</h1>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full p-6 flex flex-col justify-center">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-extrabold text-zinc-900 dark:text-white tracking-tight mb-3">
            Quem é você na cadeia do Açaí?
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 text-lg max-w-lg mx-auto">
            Escolha o seu perfil de atuação para acessar as ferramentas focadas no seu negócio.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Batedeira */}
          <Link href="/parceiros/batedeira" className="group">
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 hover:border-purple-500 dark:hover:border-purple-500 hover:shadow-lg transition-all cursor-pointer flex items-start gap-4 h-full">
              <div className="bg-purple-100 dark:bg-purple-900/30 p-4 rounded-xl text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform">
                <Store size={32} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-1">Batedeira (Ponto de Açaí)</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Para quem bate e vende o açaí pronto (Varejo B2C). Receba pedidos de clientes.
                </p>
              </div>
            </div>
          </Link>

          {/* Fornecedor */}
          <Link href="/parceiros/fornecedor" className="group">
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 hover:border-emerald-500 dark:hover:border-emerald-500 hover:shadow-lg transition-all cursor-pointer flex items-start gap-4 h-full">
              <div className="bg-emerald-100 dark:bg-emerald-900/30 p-4 rounded-xl text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
                <PackageOpen size={32} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-1">Fornecedor (Atacadista)</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Para quem vende o fruto bruto ou caixas de açaí (Atacado B2B) para as batedeiras.
                </p>
              </div>
            </div>
          </Link>

          {/* Motoboy */}
          <Link href="/parceiros/motoboy" className="group">
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 hover:border-amber-500 dark:hover:border-amber-500 hover:shadow-lg transition-all cursor-pointer flex items-start gap-4 h-full">
              <div className="bg-amber-100 dark:bg-amber-900/30 p-4 rounded-xl text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform">
                <Bike size={32} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-1">Entregador (Motoboy)</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Logística leve B2C. Entregue pedidos fracionados aos clientes finais.
                </p>
              </div>
            </div>
          </Link>

          {/* Caminhão */}
          <Link href="/parceiros/caminhao" className="group">
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-lg transition-all cursor-pointer flex items-start gap-4 h-full">
              <div className="bg-blue-100 dark:bg-blue-900/30 p-4 rounded-xl text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                <Truck size={32} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-1">Transporte (Caçamba)</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Logística pesada B2B. Transporte cargas de fruto e caixas até as lojas.
                </p>
              </div>
            </div>
          </Link>

        </div>
      </main>
    </div>
  );
}
