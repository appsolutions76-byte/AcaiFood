"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/store/useAppStore";
import { ArrowLeft, KeyRound, Mail } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const loginWithCredentials = useAppStore(state => state.loginWithCredentials);
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const success = loginWithCredentials(email, password);
    if (success) {
      const store = useAppStore.getState();
      const user = store.currentUser;
      if (user?.role === 'admin') router.push('/admin');
      else if (user?.role === 'loja') router.push('/parceiros/batedeira');
      else if (user?.role === 'fornecedor') router.push('/parceiros/fornecedor');
      else if (user?.role === 'motorista' && (user.veiculo === 'Caminhão' || user.veiculo === 'Caçamba')) router.push('/parceiros/caminhao');
      else if (user?.role === 'motorista' && user.veiculo === 'Moto') router.push('/parceiros/motoboy');
      else router.push('/'); // Cliente
    } else {
      setError("E-mail ou senha incorretos.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center text-4xl mb-4">🥣</div>
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
          
          <div className="mt-6">
            <Link href="/" className="flex items-center justify-center gap-2 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition">
              <ArrowLeft size={16} /> Voltar para a loja
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
