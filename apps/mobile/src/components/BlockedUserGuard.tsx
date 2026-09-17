"use client";

import React, { useEffect, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { ShieldAlert, LogOut } from 'lucide-react';

export function BlockedUserGuard() {
  const [mounted, setMounted] = useState(false);
  const currentUser = useAppStore(state => state.currentUser);
  const logout = useAppStore(state => state.logout);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !currentUser) return null;

  const isBlocked = currentUser.role !== 'admin' && currentUser.status === 'blocked';

  if (!isBlocked) return null;

  return (
    <div className="fixed inset-0 z-[999999] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-red-900/60 rounded-3xl max-w-md w-full p-6 text-center shadow-2xl space-y-5">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-red-950/80 border border-red-700/50 flex items-center justify-center text-red-500 shadow-inner">
          <ShieldAlert size={36} />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-black text-white tracking-tight">
            Conta Bloqueada
          </h2>
          <p className="text-sm text-zinc-400 font-medium leading-relaxed">
            Sua conta foi suspensa ou bloqueada pelo administrador da plataforma <strong className="text-purple-400">AçaíFood</strong>.
          </p>
        </div>

        <div className="bg-red-950/40 border border-red-900/40 rounded-xl p-3 text-xs text-red-300 font-semibold">
          🚫 Seus privilégios de acesso e pedidos foram temporariamente desativados.
        </div>

        <div className="pt-2">
          <button
            type="button"
            onClick={() => {
              logout();
              if (typeof window !== 'undefined') window.location.href = '/login';
            }}
            className="w-full py-3.5 px-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-lg transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer text-sm"
          >
            <LogOut size={16} /> Sair da Conta
          </button>
        </div>
      </div>
    </div>
  );
}
