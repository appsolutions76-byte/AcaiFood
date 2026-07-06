"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Store, Truck, Bike, PackageOpen, ArrowLeft, User, ShieldCheck, Recycle } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";

export default function ParceirosOnboarding() {
  const router = useRouter();
  const authorizeMercadoPago = useAppStore(state => state.authorizeMercadoPago);
  const login = useAppStore(state => state.login);
  
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<{ path: string; name: string; mockUserId: string } | null>(null);

  const handleRoleSelect = (path: string, name: string, mockUserId: string) => {
    setSelectedRole({ path, name, mockUserId });
    setModalOpen(true);
  };

  const handleAuthorize = () => {
    if (!selectedRole) return;
    
    // Simular o fluxo OAuth do Mercado Pago
    const mockToken = `APP_USR-${Math.random().toString(36).substring(2, 15)}`;
    authorizeMercadoPago(selectedRole.mockUserId, mockToken);
    
    // Fazer login na loja (como se o backend tivesse logado o usuário recém criado)
    login(selectedRole.mockUserId);
    
    setModalOpen(false);
    router.push(selectedRole.path);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 flex flex-col relative">
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
          <div onClick={() => handleRoleSelect('/parceiros/batedeira', 'Batedeira', 'loja_1')} className="group">
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
          </div>

          {/* Fornecedor */}
          <div onClick={() => handleRoleSelect('/parceiros/fornecedor', 'Fornecedor', 'forn_1')} className="group">
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
          </div>

          {/* Motoboy */}
          <div onClick={() => handleRoleSelect('/parceiros/motoboy', 'Entregador (Motoboy)', 'mot_1')} className="group">
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
          </div>

          {/* Caminhão */}
          <div onClick={() => handleRoleSelect('/parceiros/caminhao', 'Caminhão Fruto Açaí', 'mot_2')} className="group">
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
          </div>
          
          {/* Caçamba Logística Reversa */}
          <div onClick={() => handleRoleSelect('/parceiros/caminhao', 'Caçamba (Logística Reversa)', 'mot_3')} className="group">
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
          </div>

        </div>
      </main>

      {/* Mercado Pago OAuth Modal */}
      {modalOpen && selectedRole && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="bg-blue-600 p-6 text-white text-center shrink-0">
              <div className="bg-white/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
                <ShieldCheck size={32} />
              </div>
              <h3 className="text-xl font-bold">Conectar Mercado Pago</h3>
              <p className="text-blue-100 text-sm mt-1">Garantia do Triplo Split</p>
            </div>
            
            <div className="p-6 text-center">
              <p className="text-zinc-600 dark:text-zinc-400 mb-6">
                Para atuar como <strong className="text-zinc-900 dark:text-white">{selectedRole.name}</strong>, você precisa vincular sua conta bancária. 
                Isso garante que sua comissão caia direto na sua conta instantaneamente a cada venda!
              </p>
              
              <button 
                onClick={handleAuthorize}
                className="w-full bg-[#009EE3] hover:bg-[#008ACB] text-white font-bold py-4 rounded-xl transition shadow-lg flex justify-center items-center gap-2 mb-3 active:scale-95"
              >
                Autorizar com Mercado Pago
              </button>

              <button 
                onClick={handleAuthorize}
                className="w-full bg-zinc-800 hover:bg-zinc-900 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-bold py-3 rounded-xl transition shadow mb-3 active:scale-95"
              >
                Pular e Acessar Painel (Modo Teste)
              </button>
              
              <button 
                onClick={() => setModalOpen(false)}
                className="w-full bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold py-3 rounded-xl transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
