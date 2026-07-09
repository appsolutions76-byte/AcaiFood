"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Store, Truck, Bike, PackageOpen, User, Recycle } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";


export default function ParceirosOnboarding() {


  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 flex flex-col relative">
      <header className="p-4 flex justify-between items-center max-w-5xl mx-auto w-full">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white">Portal do Parceiro</h1>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link href="/login" className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition shadow-sm">
            Já sou parceiro (Entrar)
          </Link>
        </div>
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          
          {/* Cliente */}
          <Link href="/" className="group md:col-span-2 lg:col-span-3 mb-2">
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 hover:border-pink-500 dark:hover:border-pink-500 hover:shadow-lg transition-all cursor-pointer flex items-center justify-center gap-4 h-full">
              <div className="bg-pink-100 dark:bg-pink-900/30 p-4 rounded-xl text-pink-600 dark:text-pink-400 group-hover:scale-110 transition-transform">
                <User size={32} />
              </div>
              <div className="text-left">
                <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-1">Cliente (Consumidor Final)</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Quero apenas pedir açaí para mim ou para minha família.
                </p>
              </div>
            </div>
          </Link>
          
          {/* Batedeira */}
          <Link href="/cadastro?role=loja" className="group">
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
          <Link href="/cadastro?role=fornecedor" className="group">
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
          <Link href="/cadastro?role=motorista" className="group">
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
          <Link href="/cadastro?role=motorista" className="group">
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-lg transition-all cursor-pointer flex items-start gap-4 h-full">
              <div className="bg-blue-100 dark:bg-blue-900/30 p-4 rounded-xl text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                <Truck size={32} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-1">Caminhão Fruto Açaí</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Logística pesada B2B. Transporte cargas de fruto e caixas até as lojas.
                </p>
              </div>
            </div>
          </Link>
          
          {/* Caçamba Logística Reversa */}
          <Link href="/cadastro?role=motorista" className="group">
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 hover:border-amber-500 dark:hover:border-amber-500 hover:shadow-lg transition-all cursor-pointer flex items-start gap-4 h-full">
              <div className="bg-amber-100 dark:bg-amber-900/30 p-4 rounded-xl text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform">
                <Recycle size={32} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-1">Caçamba Logística Reversa</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Retirada de caroço de açaí nas batedeiras para levar ao ecoponto.
                </p>
              </div>
            </div>
          </Link>

        </div>
      </main>


    </div>
  );
}
