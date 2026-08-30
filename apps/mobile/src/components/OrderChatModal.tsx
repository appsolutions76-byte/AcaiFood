"use client";

import React, { useEffect, useState, useRef } from "react";
import { MessageSquare, Phone, Send, X, Shield, PhoneCall } from "lucide-react";
import { supabase } from "@/lib/supabase";

export interface OrderMessage {
  id: string;
  order_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: string;
  content: string;
  created_at: string;
}

interface OrderChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  currentUserId: string;
  currentUserName: string;
  currentUserRole: string;
  otherParticipantName?: string;
  otherParticipantPhone?: string;
  otherParticipantRole?: string;
  clientName?: string;
  clientPhone?: string;
  storeName?: string;
  storePhone?: string;
  driverName?: string;
  driverPhone?: string;
}

export function OrderChatModal({
  isOpen,
  onClose,
  orderId,
  currentUserId,
  currentUserName,
  currentUserRole,
  otherParticipantName,
  otherParticipantPhone,
  otherParticipantRole,
  clientName,
  clientPhone,
  storeName,
  storePhone,
  driverName,
  driverPhone
}: OrderChatModalProps) {
  const [messages, setMessages] = useState<OrderMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const cleanPhone = (otherParticipantPhone || "").replace(/\D/g, "");
  const cleanClientPhone = (clientPhone || "").replace(/\D/g, "");
  const cleanStorePhone = (storePhone || "").replace(/\D/g, "");
  const cleanDriverPhone = (driverPhone || "").replace(/\D/g, "");

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (!isOpen || !orderId) return;

    let isMounted = true;

    // 1. Buscar histórico de mensagens
    const loadMessages = async () => {
      try {
        const { data, error } = await supabase
          .from("order_messages")
          .select("*")
          .eq("order_id", orderId)
          .order("created_at", { ascending: true });

        if (!error && data && isMounted) {
          setMessages(data as OrderMessage[]);
          setTimeout(scrollToBottom, 100);
        }
      } catch (err) {
        console.warn("Erro ao carregar mensagens do chat:", err);
      }
    };

    loadMessages();

    // 2. Escutar novas mensagens em tempo real via Realtime canal leve filtrado por order_id
    const channel = supabase
      .channel(`chat-order-${orderId}`)
      .on(
        "postgres_changes" as any,
        {
          event: "INSERT",
          schema: "public",
          table: "order_messages",
          filter: `order_id=eq.${orderId}`
        },
        (payload: { new: Record<string, any> }) => {
          const newMsg = payload.new as OrderMessage;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          setTimeout(scrollToBottom, 100);
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [isOpen, orderId]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || sending) return;

    const content = inputText.trim();
    setInputText("");
    setSending(true);

    try {
      const payload = {
        order_id: orderId,
        sender_id: currentUserId,
        sender_name: currentUserName || "Usuário",
        sender_role: currentUserRole || "cliente",
        content: content
      };

      const { data, error } = await supabase
        .from("order_messages")
        .insert(payload)
        .select()
        .single();

      if (!error && data) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.id)) return prev;
          return [...prev, data as OrderMessage];
        });
        setTimeout(scrollToBottom, 100);
      }
    } catch (err) {
      console.warn("Erro ao enviar mensagem:", err);
    } finally {
      setSending(false);
    }
  };

  const getRoleBadge = (role: string) => {
    const r = (role || "").toLowerCase();
    if (r === "motoboy" || r === "motorista") {
      return { label: "🏍️ Motoboy", class: "bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300 border border-orange-200 dark:border-orange-800" };
    }
    if (r === "loja" || r === "batedeira") {
      return { label: "🏪 Loja/Batedeira", class: "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800" };
    }
    if (r === "admin") {
      return { label: "🛡️ Admin", class: "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border border-red-200 dark:border-red-800" };
    }
    return { label: "👤 Cliente", class: "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800" };
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-900 rounded-3xl max-w-lg w-full h-[85vh] flex flex-col shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        
        {/* Header */}
        <div className="p-4 bg-purple-700 dark:bg-purple-950 text-white flex items-center justify-between border-b border-purple-600 dark:border-purple-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-purple-600 dark:bg-purple-900 p-2.5 rounded-2xl">
              <MessageSquare size={20} className="text-purple-200" />
            </div>
            <div>
              <h3 className="font-bold text-sm leading-tight flex items-center gap-1.5">
                Chat do Pedido #{orderId.slice(-5)}
              </h3>
              <p className="text-xs text-purple-200">
                {otherParticipantName ? `${otherParticipantRole ? `[${otherParticipantRole}] ` : ''}${otherParticipantName}` : 'Canal Integrado (Cliente • Loja • Motoboy)'}
              </p>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="p-2 hover:bg-purple-600/50 rounded-xl transition text-purple-200 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        {/* Action Bar - Voice Call & WhatsApp with Multi-participant support */}
        <div className="bg-zinc-100 dark:bg-zinc-800/80 p-2.5 px-4 flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 dark:border-zinc-800 shrink-0 text-xs">
          <div className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300 font-bold">
            <Shield size={14} className="text-emerald-500" />
            <span>Comunicação Direta:</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {cleanPhone ? (
              <>
                <a
                  href={`tel:${cleanPhone}`}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold px-2.5 py-1.5 rounded-xl flex items-center gap-1 shadow-sm transition active:scale-95"
                  title="Fazer ligação de voz convencional"
                >
                  <Phone size={12} /> Voz
                </a>
                <a
                  href={`https://wa.me/55${cleanPhone}?text=Ol%C3%A1%2C%20estou%20entrando%20em%20contato%20sobre%20o%20pedido%20%23${orderId.slice(-5)}%20no%20A%C3%A7a%C3%ADFood`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-green-500 hover:bg-green-600 text-white text-[11px] font-bold px-2.5 py-1.5 rounded-xl flex items-center gap-1 shadow-sm transition active:scale-95"
                  title="Abrir WhatsApp"
                >
                  <PhoneCall size={12} /> WhatsApp
                </a>
              </>
            ) : cleanClientPhone || cleanStorePhone || cleanDriverPhone ? (
              <>
                {cleanClientPhone && (
                  <a
                    href={`https://wa.me/55${cleanClientPhone}?text=Ol%C3%A1%2C%20estou%20entrando%20em%20contato%20sobre%20o%20pedido%20%23${orderId.slice(-5)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1 shadow-sm transition"
                  >
                    👤 Cliente
                  </a>
                )}
                {cleanStorePhone && (
                  <a
                    href={`https://wa.me/55${cleanStorePhone}?text=Ol%C3%A1%2C%20estou%20entrando%20em%20contato%20sobre%20o%20pedido%20%23${orderId.slice(-5)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1 shadow-sm transition"
                  >
                    🏪 Loja
                  </a>
                )}
                {cleanDriverPhone && (
                  <a
                    href={`https://wa.me/55${cleanDriverPhone}?text=Ol%C3%A1%2C%20estou%20entrando%20em%20contato%20sobre%20o%20pedido%20%23${orderId.slice(-5)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-orange-600 hover:bg-orange-700 text-white text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1 shadow-sm transition"
                  >
                    🏍️ Motoboy
                  </a>
                )}
              </>
            ) : (
              <span className="text-[11px] text-zinc-400 italic">Telefone indisponível</span>
            )}
          </div>
        </div>

        {/* Message Feed */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-zinc-50 dark:bg-zinc-950">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2 text-zinc-400">
              <MessageSquare size={32} className="text-purple-400 opacity-60" />
              <p className="text-xs font-medium">Nenhuma mensagem ainda neste pedido.</p>
              <p className="text-[11px]">Envie uma mensagem abaixo para conversar em tempo real com o cliente, a loja ou o motoboy.</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.sender_id === currentUserId;
              const formattedTime = new Date(msg.created_at).toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit"
              });
              const badge = getRoleBadge(msg.sender_role);

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                >
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-500 dark:text-zinc-400 mb-1 px-1">
                    <span>{msg.sender_name}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${badge.class}`}>
                      {badge.label}
                    </span>
                  </div>

                  <div
                    className={`max-w-[80%] p-3 rounded-2xl text-xs leading-relaxed shadow-sm ${
                      isMe
                        ? "bg-purple-600 text-white rounded-tr-none"
                        : "bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 rounded-tl-none border border-zinc-200 dark:border-zinc-700"
                    }`}
                  >
                    <p className="break-words whitespace-pre-wrap">{msg.content}</p>
                    <span
                      className={`block text-[9px] text-right mt-1 font-medium ${
                        isMe ? "text-purple-200" : "text-zinc-400"
                      }`}
                    >
                      {formattedTime}
                    </span>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Form */}
        <form
          onSubmit={handleSendMessage}
          className="p-3 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 flex items-center gap-2 shrink-0"
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Digite sua mensagem..."
            className="flex-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white text-xs p-3 rounded-xl border border-zinc-300 dark:border-zinc-700 focus:ring-2 focus:ring-purple-500 outline-none"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || sending}
            className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white p-3 rounded-xl transition flex items-center justify-center shrink-0 shadow-md active:scale-95"
          >
            <Send size={16} />
          </button>
        </form>

      </div>
    </div>
  );
}
