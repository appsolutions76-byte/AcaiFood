"use client";

import React, { useState, useEffect } from "react";
import { Headphones, Lock } from "lucide-react";
import { SupportChatModal } from "./SupportChatModal";
import { SupportConfig, DEFAULT_SUPPORT_CONFIG } from "@/app/api/support/route";
import { useAppStore } from "@/store/useAppStore";

interface SupportChatButtonProps {
  currentUser?: {
    id: string;
    name: string;
    role: string;
    telefone?: string;
    email?: string;
    cidade?: string;
  } | null;
  positionClassName?: string;
}

export function SupportChatButton({ currentUser, positionClassName }: SupportChatButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<SupportConfig>(DEFAULT_SUPPORT_CONFIG);

  const storeUser = useAppStore((state) => state.currentUser);
  const activeUser = currentUser ?? storeUser;
  const isRegisteredUser = Boolean(activeUser && activeUser.id);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await fetch("/api/support?config=true");
        if (res.ok) {
          const data = await res.json();
          if (data?.config) {
            setConfig(data.config);
          }
        }
      } catch (_e) {}
    };

    fetchConfig();
  }, []);

  // Se o administrador desativou a exibição do canal de atendimento
  if (config.channelEnabled === false) {
    return null;
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={
          positionClassName ||
          "fixed bottom-5 right-5 z-[140] bg-gradient-to-r from-purple-700 via-indigo-700 to-purple-800 hover:from-purple-800 hover:to-indigo-800 text-white font-bold p-3.5 sm:px-4 sm:py-3 rounded-full shadow-2xl border-2 border-purple-300/40 dark:border-purple-500/30 flex items-center gap-2 transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer group"
        }
        title={isRegisteredUser ? "Central de Atendimento & Suporte AçaíFood" : "Suporte AçaíFood (Exclusivo para Cadastrados)"}
        aria-label="Falar com o Suporte AçaíFood"
      >
        <div className="relative flex items-center justify-center">
          <Headphones size={20} className="group-hover:rotate-12 transition-transform duration-200" />
          {isRegisteredUser ? (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 border-2 border-purple-900 rounded-full animate-pulse" />
          ) : (
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 text-zinc-950 font-black text-[8px] rounded-full flex items-center justify-center border border-purple-950 shadow-xs" title="Exclusivo para contas cadastradas">
              🔒
            </span>
          )}
        </div>
        <span className="hidden sm:inline text-xs font-extrabold tracking-wide">
          {isRegisteredUser ? "Atendimento & Suporte" : "Suporte (Cadastrados)"}
        </span>
      </button>

      <SupportChatModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        currentUser={activeUser}
        config={config}
      />
    </>
  );
}
