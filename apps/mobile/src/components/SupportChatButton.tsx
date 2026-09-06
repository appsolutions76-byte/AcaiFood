"use client";

import React, { useState } from "react";
import { Headphones, MessageSquare } from "lucide-react";
import { SupportChatModal } from "./SupportChatModal";

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

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={
          positionClassName ||
          "fixed bottom-5 right-5 z-[140] bg-gradient-to-r from-purple-700 via-indigo-700 to-purple-800 hover:from-purple-800 hover:to-indigo-800 text-white font-bold p-3.5 sm:px-4 sm:py-3 rounded-full shadow-2xl border-2 border-purple-300/40 dark:border-purple-500/30 flex items-center gap-2 transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer group"
        }
        title="Central de Atendimento & Suporte AçaíFood"
        aria-label="Falar com o Suporte AçaíFood"
      >
        <div className="relative flex items-center justify-center">
          <Headphones size={20} className="group-hover:rotate-12 transition-transform duration-200" />
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 border-2 border-purple-900 rounded-full animate-pulse" />
        </div>
        <span className="hidden sm:inline text-xs font-extrabold tracking-wide">
          Atendimento & Suporte
        </span>
      </button>

      <SupportChatModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        currentUser={currentUser}
      />
    </>
  );
}
