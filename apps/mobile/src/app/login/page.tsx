"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/store/useAppStore";
import { KeyRound, Mail, BookOpen } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PartnerManualModal } from "@/components/PartnerManualModal";

export default function LoginPage() {
  const router = useRouter();
  const loginWithCredentials = useAppStore(state => state.loginWithCredentials);
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loginManualOpen, setLoginManualOpen] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const success = await loginWithCredentials(email, password);
    if (success) {
      const store = useAppStore.getState();
      const user = store.currentUser;
      const roleStr = String(user?.role || '').toLowerCase();
      const veicStr = String(user?.veiculo || '').toLowerCase();

      if (roleStr === 'admin') router.push('/admin');
      else if (roleStr === 'loja') router.push('/parceiros/batedeira');
      else if (roleStr === 'fornecedor') router.push('/parceiros/fornecedor');
      else if (roleStr === 'caminhao' || (roleStr === 'motorista' && (veicStr.includes('caminh') || veicStr.includes('caçamb')))) router.push('/parceiros/caminhao');
      else if (roleStr === 'motoboy' || roleStr === 'motorista') router.push('/parceiros/motoboy');
      else router.push('/'); // Cliente
    } else {
      setError("E-mail ou senha incorretos.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative">
      <PartnerManualModal isOpen={loginManualOpen} onClose={() => setLoginManualOpen(false)} role="login" />
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center mb-4">
          <img src="/banner.png" alt="Marca Oficial AçaíFood" className="w-44 h-44 rounded-2xl shadow-xl border-2 border-purple-500 object-cover" />
        </div>
        <h2 className="text-center text-3xl font-extrabold text-zinc-900 dark:text-white">
          Entrar no AçaíFood
        </h2>
        <p className="mt-2 text-center text-sm text-zinc-600 dark:text-zinc-400">
          Ou <Link href="/cadastro" className="font-medium text-purple-600 hover:text-purple-500">crie sua conta gratuitamente</Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-zinc-900 py-8 px-4 shadow sm:rounded-2xl sm:px-10 border border-zinc-200 dark:border-zinc-800">
          <form className="space-y-6" onSubmit={handleLogin}>
            {error && (
              <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm font-bold border border-red-200 text-center">
                {error}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                E-mail
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-zinc-400" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="block w-full pl-10 sm:text-sm border-zinc-300 dark:border-zinc-700 rounded-xl p-3 bg-zinc-50 dark:bg-zinc-800 dark:text-white focus:ring-purple-500 focus:border-purple-500 outline-none border"
                  placeholder="seu@email.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Senha
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <KeyRound className="h-5 w-5 text-zinc-400" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="block w-full pl-10 sm:text-sm border-zinc-300 dark:border-zinc-700 rounded-xl p-3 bg-zinc-50 dark:bg-zinc-800 dark:text-white focus:ring-purple-500 focus:border-purple-500 outline-none border"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition active:scale-95"
              >
                Entrar na Plataforma
              </button>
            </div>
          </form>

          <div className="mt-4">
            <button
              type="button"
              onClick={() => setLoginManualOpen(true)}
              className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-amber-300 dark:border-amber-700 rounded-xl text-sm font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition active:scale-95"
            >
              <BookOpen size={16} />
              Manual de Uso &amp; Cadastro
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
