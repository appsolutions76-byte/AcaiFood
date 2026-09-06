"use client";

import React, { useState, useEffect, useRef } from "react";
import { MessageSquare, Send, X, Headphones, Phone, Mail, CheckCheck, Sparkles, User, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { playChatDing } from "@/lib/soundAlerts";
import { SupportMessageItem } from "@/app/api/support/route";

interface SupportChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: {
    id: string;
    name: string;
    role: string;
    telefone?: string;
    email?: string;
    cidade?: string;
  } | null;
}

export function SupportChatModal({ isOpen, onClose, currentUser }: SupportChatModalProps) {
  const [messages, setMessages] = useState<SupportMessageItem[]>([]);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ID persistente para usuários anônimos / visitantes
  const [sessionId, setSessionId] = useState<string>("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      let sId = localStorage.getItem("acaifood_support_session_id");
      if (!sId) {
        sId = `guest-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        localStorage.setItem("acaifood_support_session_id", sId);
      }
      setSessionId(sId);
    }
  }, []);

  const activeUserId = currentUser?.id || sessionId;
  const activeUserName = currentUser?.name || guestName || "Cliente / Visitante";
  const activeUserRole = currentUser?.role || "visitante";
  const activeUserPhone = currentUser?.telefone || guestPhone || "";

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadMessages = async () => {
    if (!activeUserId) return;
    try {
      const res = await fetch(`/api/support?userId=${encodeURIComponent(activeUserId)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.messages && Array.isArray(data.messages)) {
          setMessages((prev) => {
            // Se houver mensagem nova do admin, emite o som
            if (data.messages.length > prev.length) {
              const last = data.messages[data.messages.length - 1];
              if (last.sender === "admin" && prev.length > 0) {
                playChatDing();
              }
            }
            return data.messages;
          });
          setTimeout(scrollToBottom, 80);
        }
      }
    } catch (_err) {}
  };

  useEffect(() => {
    if (!isOpen || !activeUserId) return;

    loadMessages();
    const interval = setInterval(loadMessages, 4000);

    // Canal Realtime leve do Supabase
    const channel = supabase
      .channel(`support-channel-${activeUserId}`)
      .on(
        "postgres_changes" as any,
        { event: "INSERT", schema: "public", table: "support_messages", filter: `user_id=eq.${activeUserId}` },
        (payload: any) => {
          if (payload.new) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === payload.new.id)) return prev;
              if (payload.new.sender === "admin") {
                playChatDing();
              }
              return [...prev, payload.new];
            });
            setTimeout(scrollToBottom, 80);
          }
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [isOpen, activeUserId]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || sending) return;

    const textToSend = inputText.trim();
    setInputText("");
    setSending(true);

    const newMsg: SupportMessageItem = {
      id: `sup-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      user_id: activeUserId,
      user_name: activeUserName,
      user_role: activeUserRole,
      user_phone: activeUserPhone,
      user_email: currentUser?.email || "",
      content: textToSend,
      sender: "user",
      is_read: false,
      status: "aberto",
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, newMsg]);
    setTimeout(scrollToBottom, 60);

    try {
      await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send",
          message: newMsg,
          userId: activeUserId,
        }),
      });
    } catch (_err) {
      console.warn("Erro ao enviar mensagem de suporte:", _err);
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  // Cálculo dinâmico do horário de funcionamento
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Domingo, 1 = Segunda, ..., 6 = Sábado
  const currentHour = now.getHours() + now.getMinutes() / 60;
  const isSunday = dayOfWeek === 0;
  const isWithinHours = isSunday ? (currentHour >= 9 && currentHour < 18) : (currentHour >= 8 && currentHour < 22);

  const whatsappNumber = "5591981244876"; // Central WhatsApp Oficial
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
    `Olá, Suporte AçaíFood! Meu nome é ${activeUserName} (${activeUserRole.toUpperCase()}) e preciso de atendimento.`
  )}`;

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-xs z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-zinc-900 w-full sm:max-w-lg h-[92vh] sm:h-[630px] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-purple-200 dark:border-zinc-800 animate-in slide-in-from-bottom-6 sm:zoom-in-95">
        {/* CABEÇALHO DO CHAT */}
        <div className="bg-gradient-to-r from-purple-800 via-indigo-900 to-purple-950 text-white p-4 sm:p-4.5 flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-xl shadow-inner">
                🎧
              </div>
              <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 border-2 border-purple-950 rounded-full ${isWithinHours ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`} />
            </div>
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="font-extrabold text-sm sm:text-base leading-tight">Suporte Oficial AçaíFood</h3>
                {isWithinHours ? (
                  <span className="text-[9px] bg-emerald-500/20 text-emerald-300 font-extrabold px-2 py-0.5 rounded-full border border-emerald-400/30 flex items-center gap-1">
                    🟢 Online Agora
                  </span>
                ) : (
                  <span className="text-[9px] bg-amber-500/20 text-amber-300 font-extrabold px-2 py-0.5 rounded-full border border-amber-400/30 flex items-center gap-1">
                    🌙 Fora de Horário
                  </span>
                )}
              </div>
              <p className="text-[11px] text-purple-200/80">Atendimento ao Cliente, Lojas & Entregadores</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-xl transition active:scale-95 cursor-pointer"
            aria-label="Fechar Suporte"
          >
            <X size={18} />
          </button>
        </div>

        {/* FAIXA INFORMATIVA DE HORÁRIO DE ATENDIMENTO */}
        <div className="bg-purple-900/40 border-b border-purple-200/60 dark:border-purple-900/40 px-3.5 py-1.5 flex items-center justify-between text-[11px] text-purple-900 dark:text-purple-200">
          <div className="flex items-center gap-1.5 font-semibold">
            <span>🕒</span>
            <span><strong>Horário:</strong> Seg a Sáb das <strong>08h às 22h</strong> | Dom e Feriados das <strong>09h às 18h</strong></span>
          </div>
        </div>

        {/* ATALHOS RÁPIDOS (WHATSAPP & E-MAIL) */}
        <div className="bg-purple-50/80 dark:bg-zinc-950/80 px-3.5 py-2 border-b border-purple-100 dark:border-zinc-800/80 flex items-center justify-between gap-2 shrink-0 text-xs">
          <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium hidden sm:inline">
            Plantão ou dúvidas urgentes:
          </span>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1 rounded-xl text-[11px] flex items-center gap-1.5 shadow-xs transition active:scale-95 shrink-0"
            >
              <Phone size={12} /> WhatsApp Plantão
            </a>
            <a
              href="mailto:appsolutions76@gmail.com"
              className="bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold px-2.5 py-1 rounded-xl text-[11px] flex items-center gap-1 transition shrink-0"
            >
              <Mail size={12} /> E-mail
            </a>
          </div>
        </div>

        {/* AVISO QUANDO FORA DO HORÁRIO */}
        {!isWithinHours && (
          <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900/50 p-2.5 px-3.5 text-xs text-amber-800 dark:text-amber-200 flex items-center gap-2">
            <span>🌙</span>
            <span className="text-[11px] leading-tight">
              Estamos fora do horário de atendimento ao vivo no momento. Você pode enviar sua mensagem que nossa equipe responderá assim que abrirmos!
            </span>
          </div>
        )}

        {/* FORMULÁRIO RÁPIDO PARA NÃO LOGADOS */}
        {!currentUser && messages.length === 0 && (
          <div className="p-3 bg-indigo-50/60 dark:bg-indigo-950/30 border-b border-indigo-100 dark:border-indigo-900/30 text-xs">
            <p className="text-[11px] font-bold text-indigo-900 dark:text-indigo-300 mb-1.5">
              👋 Olá! Identifique-se para facilitarmos seu atendimento:
            </p>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Seu Nome"
                className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs text-zinc-800 dark:text-white outline-none focus:border-purple-500"
              />
              <input
                type="tel"
                value={guestPhone}
                onChange={(e) => setGuestPhone(e.target.value)}
                placeholder="Seu WhatsApp (com DDD)"
                className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs text-zinc-800 dark:text-white outline-none focus:border-purple-500"
              />
            </div>
          </div>
        )}

        {/* CORPO DE MENSAGENS */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-zinc-50/50 dark:bg-zinc-950/40">
          {/* Mensagem de Boas-vindas Padrão do Sistema */}
          <div className="flex justify-start">
            <div className="max-w-[85%] bg-white dark:bg-zinc-800 p-3.5 rounded-2xl rounded-tl-sm shadow-xs border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-800 dark:text-zinc-200">
              <div className="flex items-center gap-1.5 font-extrabold text-purple-600 dark:text-purple-400 mb-1">
                <ShieldCheck size={14} /> Atendimento AçaíFood
              </div>
              <p className="leading-relaxed">
                Olá{currentUser ? `, ${currentUser.name.split(" ")[0]}` : ""}! Como podemos ajudar você hoje? Envie sua
                dúvida, sugestão ou relato de pedido que nossa equipe responderá aqui em tempo real.
              </p>
              <span className="block text-[9px] text-zinc-400 mt-1.5 text-right">Agora</span>
            </div>
          </div>

          {messages.map((m) => {
            const isUser = m.sender === "user";
            return (
              <div key={m.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] p-3.5 rounded-2xl shadow-xs text-xs ${
                    isUser
                      ? "bg-gradient-to-br from-purple-600 to-indigo-600 text-white rounded-tr-sm"
                      : "bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 rounded-tl-sm"
                  }`}
                >
                  {!isUser && (
                    <div className="flex items-center gap-1 font-extrabold text-purple-600 dark:text-purple-400 text-[10px] mb-1">
                      <ShieldCheck size={12} /> Suporte Admin
                    </div>
                  )}
                  <p className="leading-relaxed whitespace-pre-wrap">{m.content}</p>
                  <div className={`flex items-center justify-end gap-1 mt-1 text-[9px] ${isUser ? "text-purple-200" : "text-zinc-400"}`}>
                    <span>{new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    {isUser && <CheckCheck size={12} />}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* INPUT DE MENSAGEM */}
        <form onSubmit={handleSendMessage} className="p-3 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 flex items-center gap-2 shrink-0">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Digite sua mensagem para o suporte..."
            className="flex-1 bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-2xl px-4 py-3 text-xs text-zinc-900 dark:text-white outline-none focus:border-purple-500 transition shadow-inner"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || sending}
            className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-40 text-white p-3 rounded-2xl font-bold transition-all shadow-md active:scale-95 cursor-pointer shrink-0"
            aria-label="Enviar Mensagem"
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}
