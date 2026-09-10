"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Headphones, Send, CheckCircle2, MessageSquare, Phone, User, RefreshCw, 
  Search, ShieldCheck, Clock, ExternalLink, Settings2, Sliders, ToggleLeft, ToggleRight, X, Save
} from "lucide-react";
import { SupportMessageItem, SupportConfig, DEFAULT_SUPPORT_CONFIG } from "@/app/api/support/route";
import { playChatDing } from "@/lib/soundAlerts";
import { supabase } from "@/lib/supabase";

export function AdminSupportSection() {
  const [allMessages, setAllMessages] = useState<SupportMessageItem[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [filterStatus, setFilterStatus] = useState<"all" | "open" | "resolved">("open");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [supportConfig, setSupportConfig] = useState<SupportConfig>(DEFAULT_SUPPORT_CONFIG);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadAllSupportMessagesAndConfig = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/support?all=true");
      if (res.ok) {
        const data = await res.json();
        if (data.messages && Array.isArray(data.messages)) {
          setAllMessages(data.messages);
        }
        if (data.config) {
          setSupportConfig(data.config);
        }
      }
    } catch (_err) {
      console.warn("Erro ao carregar suporte admin:", _err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllSupportMessagesAndConfig();
    const interval = setInterval(loadAllSupportMessagesAndConfig, 6000);

    // Canal Realtime Supabase
    const channel = supabase
      .channel("admin-support-global-channel")
      .on(
        "postgres_changes" as any,
        { event: "INSERT", schema: "public", table: "support_messages" },
        (payload: any) => {
          if (payload.new) {
            setAllMessages((prev) => {
              if (prev.some((m) => m.id === payload.new.id)) return prev;
              if (payload.new.sender === "user") {
                playChatDing();
              }
              return [...prev, payload.new];
            });
            setTimeout(scrollToBottom, 60);
          }
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, []);

  const handleSaveConfig = async (updatedConfig: Partial<SupportConfig>) => {
    const finalConfig = { ...supportConfig, ...updatedConfig };
    setSupportConfig(finalConfig);
    setIsSavingConfig(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const authHeaders: any = { "Content-Type": "application/json" };
      if (session?.access_token) {
        authHeaders["Authorization"] = `Bearer ${session.access_token}`;
      }

      const res = await fetch("/api/support", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          action: "save_config",
          config: finalConfig
        })
      });
      if (res.ok) {
        showToast("✅ Configurações de Atendimento salvas com sucesso!");
        setConfigModalOpen(false);
      } else {
        alert("Erro ao salvar configurações de suporte.");
      }
    } catch (e: any) {
      alert("Erro ao salvar: " + e.message);
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Agrupamento de conversas por user_id
  const threadsMap = new Map<string, {
    userId: string;
    userName: string;
    userRole: string;
    userPhone?: string;
    userEmail?: string;
    lastMessage: SupportMessageItem;
    unreadCount: number;
    status: "aberto" | "em_atendimento" | "resolvido";
    messages: SupportMessageItem[];
  }>();

  allMessages.forEach((msg) => {
    const uId = msg.user_id;
    if (!threadsMap.has(uId)) {
      threadsMap.set(uId, {
        userId: uId,
        userName: msg.user_name || "Usuário",
        userRole: msg.user_role || "cliente",
        userPhone: msg.user_phone,
        userEmail: msg.user_email,
        lastMessage: msg,
        unreadCount: 0,
        status: msg.status || "aberto",
        messages: [],
      });
    }

    const thread = threadsMap.get(uId)!;
    thread.messages.push(msg);
    thread.lastMessage = msg;
    if (msg.user_phone) thread.userPhone = msg.user_phone;
    if (msg.user_email) thread.userEmail = msg.user_email;
    if (msg.status) thread.status = msg.status;
    if (msg.sender === "user" && !msg.is_read) {
      thread.unreadCount += 1;
    }
  });

  const threads = Array.from(threadsMap.values()).sort(
    (a, b) => new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime()
  );

  const filteredThreads = threads.filter((t) => {
    if (filterStatus === "open" && t.status === "resolvido") return false;
    if (filterStatus === "resolved" && t.status !== "resolvido") return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = t.userName.toLowerCase().includes(q);
      const matchPhone = (t.userPhone || "").toLowerCase().includes(q);
      const matchRole = t.userRole.toLowerCase().includes(q);
      return matchName || matchPhone || matchRole;
    }
    return true;
  });

  const activeThread = selectedUserId ? threadsMap.get(selectedUserId) : null;

  const handleAdminSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !selectedUserId || sending || !activeThread) return;

    const text = inputText.trim();
    setInputText("");
    setSending(true);

    const newMsg: SupportMessageItem = {
      id: `sup-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      user_id: selectedUserId,
      user_name: "Suporte AçaíFood (Admin)",
      user_role: "admin",
      content: text,
      sender: "admin",
      is_read: true,
      status: "em_atendimento",
      created_at: new Date().toISOString(),
    };

    setAllMessages((prev) => [...prev, newMsg]);
    setTimeout(scrollToBottom, 60);

    try {
      await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send",
          message: newMsg,
          userId: selectedUserId,
        }),
      });
    } catch (_err) {
      console.warn("Erro ao enviar resposta do admin:", _err);
    } finally {
      setSending(false);
    }
  };

  const handleResolveTicket = async (userId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const authHeaders: any = { "Content-Type": "application/json" };
      if (session?.access_token) {
        authHeaders["Authorization"] = `Bearer ${session.access_token}`;
      }

      await fetch("/api/support", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          action: "resolve",
          userId,
          status: "resolvido",
        }),
      });
      setAllMessages((prev) =>
        prev.map((m) => (m.user_id === userId ? { ...m, status: "resolvido" } : m))
      );
    } catch (_err) {}
  };

  const getRoleBadge = (role: string) => {
    switch (role.toLowerCase()) {
      case "loja":
        return <span className="bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded text-[10px] font-bold">🏪 Batedeira</span>;
      case "motorista":
        return <span className="bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded text-[10px] font-bold">🛵 Entregador</span>;
      case "fornecedor":
        return <span className="bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded text-[10px] font-bold">🌾 Fornecedor</span>;
      default:
        return <span className="bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded text-[10px] font-bold">👤 Cliente</span>;
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
      {toastMsg && (
        <div className="fixed top-5 right-5 z-[300] bg-zinc-900 text-white border border-zinc-700 px-4 py-3 rounded-xl shadow-xl font-bold flex items-center gap-3 animate-in fade-in slide-in-from-top-3 duration-200">
          <span className="text-sm">{toastMsg}</span>
          <button onClick={() => setToastMsg(null)} className="text-zinc-400 hover:text-white font-bold text-lg leading-none">&times;</button>
        </div>
      )}

      {/* HEADER DA SEÇÃO COM CONTROLE RÁPIDO DE STATUS E BOTÃO DE CONFIGURAÇÕES */}
      <div className="p-4 sm:p-5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/50 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h3 className="text-lg font-extrabold text-zinc-900 dark:text-white flex items-center gap-2">
            <Headphones className="text-purple-600" size={20} />
            Central de Atendimento & Suporte Geral
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            Converse ao vivo com clientes, batedeiras, entregadores e fornecedores.
          </p>
        </div>

        {/* CONTROLES DE STATUS / HORÁRIOS */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-start lg:justify-end">
          {/* SELETOR RÁPIDO DE MODO DE OPERAÇÃO */}
          <div className="flex items-center bg-zinc-200/80 dark:bg-zinc-800 p-1 rounded-xl text-xs font-bold">
            <button
              onClick={() => handleSaveConfig({ mode: "auto" })}
              className={`px-3 py-1.5 rounded-lg transition ${
                supportConfig.mode === "auto"
                  ? "bg-white dark:bg-zinc-900 text-purple-700 dark:text-purple-300 shadow-xs"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
              }`}
              title="Abre e fecha automaticamente de acordo com o relógio"
            >
              🕒 Auto (Relógio)
            </button>
            <button
              onClick={() => handleSaveConfig({ mode: "open" })}
              className={`px-3 py-1.5 rounded-lg transition ${
                supportConfig.mode === "open"
                  ? "bg-emerald-500 text-white shadow-xs"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
              }`}
              title="Forçar atendimento como Aberto/Online agora"
            >
              🟢 Forçar Aberto
            </button>
            <button
              onClick={() => handleSaveConfig({ mode: "closed" })}
              className={`px-3 py-1.5 rounded-lg transition ${
                supportConfig.mode === "closed"
                  ? "bg-red-500 text-white shadow-xs"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
              }`}
              title="Forçar atendimento como Fechado/Pausado agora"
            >
              🔴 Forçar Fechado
            </button>
          </div>

          <button
            onClick={() => setConfigModalOpen(true)}
            className="text-xs bg-purple-100 hover:bg-purple-200 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 font-bold px-3 py-2 rounded-xl border border-purple-300 dark:border-purple-800 flex items-center gap-1.5 shadow-2xs transition active:scale-95 cursor-pointer shrink-0"
          >
            <Settings2 size={15} /> Ajustar Horários
          </button>

          <button
            onClick={loadAllSupportMessagesAndConfig}
            disabled={loading}
            className="p-2 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 rounded-xl border border-zinc-200 dark:border-zinc-700 transition active:scale-95 cursor-pointer shrink-0"
            title="Atualizar conversas"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* PAINEL DE DOIS LADOS: LISTA DE CONVERSAS + CAIXA DE CHAT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[500px]">
        {/* LISTA LATERAL DE CHAMADOS */}
        <div className="lg:col-span-4 border-r border-zinc-200 dark:border-zinc-800 flex flex-col">
          {/* BARRA DE FILTROS & BUSCA */}
          <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 space-y-2">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por nome, fone..."
                className="w-full bg-zinc-100 dark:bg-zinc-800 text-xs px-3 py-2 pl-8 rounded-xl outline-none focus:ring-1 focus:ring-purple-500 text-zinc-900 dark:text-white"
              />
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            </div>

            <div className="flex items-center gap-1 text-[11px]">
              <button
                onClick={() => setFilterStatus("open")}
                className={`flex-1 py-1 rounded-lg font-bold transition text-center ${
                  filterStatus === "open"
                    ? "bg-purple-600 text-white"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                }`}
              >
                Pendentes ({threads.filter((t) => t.status !== "resolvido").length})
              </button>
              <button
                onClick={() => setFilterStatus("all")}
                className={`flex-1 py-1 rounded-lg font-bold transition text-center ${
                  filterStatus === "all"
                    ? "bg-purple-600 text-white"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                }`}
              >
                Todos ({threads.length})
              </button>
              <button
                onClick={() => setFilterStatus("resolved")}
                className={`flex-1 py-1 rounded-lg font-bold transition text-center ${
                  filterStatus === "resolved"
                    ? "bg-purple-600 text-white"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                }`}
              >
                Resolvidos ({threads.filter((t) => t.status === "resolvido").length})
              </button>
            </div>
          </div>

          {/* LISTA DE CONVERSAS */}
          <div className="flex-1 overflow-y-auto max-h-[550px] divide-y divide-zinc-100 dark:divide-zinc-800/60">
            {filteredThreads.length === 0 ? (
              <div className="p-8 text-center text-zinc-400 text-xs">
                <MessageSquare size={28} className="mx-auto mb-2 opacity-40" />
                Nenhum chamado de suporte encontrado.
              </div>
            ) : (
              filteredThreads.map((thread) => {
                const isSelected = selectedUserId === thread.userId;
                return (
                  <button
                    key={thread.userId}
                    onClick={() => {
                      setSelectedUserId(thread.userId);
                      setTimeout(scrollToBottom, 60);
                    }}
                    className={`w-full p-3.5 text-left transition flex flex-col gap-1.5 cursor-pointer ${
                      isSelected
                        ? "bg-purple-50 dark:bg-purple-950/40 border-l-4 border-purple-600"
                        : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-zinc-900 dark:text-white truncate">
                        {thread.userName}
                      </span>
                      <span className="text-[10px] text-zinc-400">
                        {new Date(thread.lastMessage.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {getRoleBadge(thread.userRole)}
                      {thread.status === "resolvido" && (
                        <span className="text-[9px] bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-1.5 py-0.5 rounded font-bold">
                          Resolvido
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                      {thread.lastMessage.sender === "admin" ? "Você: " : ""}
                      {thread.lastMessage.content}
                    </p>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ÁREA PRINCIPAL DE CHAT / RESPOSTA */}
        <div className="lg:col-span-8 flex flex-col bg-zinc-50/40 dark:bg-zinc-950/20">
          {activeThread ? (
            <>
              {/* TOPO DO CHAT SELECIONADO */}
              <div className="p-3.5 sm:p-4 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-extrabold text-sm text-zinc-900 dark:text-white truncate">
                      {activeThread.userName}
                    </h4>
                    {getRoleBadge(activeThread.userRole)}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-zinc-500 mt-0.5 flex-wrap">
                    {activeThread.userPhone && (
                      <span className="flex items-center gap-1">
                        📞 {activeThread.userPhone}
                      </span>
                    )}
                    {activeThread.userEmail && (
                      <span className="flex items-center gap-1">
                        ✉️ {activeThread.userEmail}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {activeThread.userPhone && (
                    <a
                      href={`https://wa.me/55${activeThread.userPhone.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 font-bold px-3 py-1.5 rounded-xl border border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100 flex items-center gap-1"
                    >
                      <Phone size={13} /> WhatsApp
                    </a>
                  )}
                  {activeThread.status !== "resolvido" && (
                    <button
                      onClick={() => handleResolveTicket(activeThread.userId)}
                      className="text-xs bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-700 dark:text-zinc-300 font-bold px-3 py-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700 flex items-center gap-1 transition cursor-pointer"
                    >
                      <CheckCircle2 size={13} /> Resolver
                    </button>
                  )}
                </div>
              </div>

              {/* CORPO DE MENSAGENS */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[350px] max-h-[420px]">
                {activeThread.messages.map((m) => {
                  const isAdmin = m.sender === "admin";
                  return (
                    <div key={m.id} className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[80%] p-3.5 rounded-2xl text-xs shadow-xs ${
                          isAdmin
                            ? "bg-purple-600 text-white rounded-tr-sm"
                            : "bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 rounded-tl-sm"
                        }`}
                      >
                        <div className="text-[10px] font-bold opacity-80 mb-1">
                          {isAdmin ? "Suporte AçaíFood" : m.user_name}
                        </div>
                        <p className="leading-relaxed whitespace-pre-wrap">{m.content}</p>
                        <span className={`block text-[9px] mt-1 text-right ${isAdmin ? "text-purple-200" : "text-zinc-400"}`}>
                          {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* FORMULÁRIO DE ENVIO DO ADMIN */}
              <form onSubmit={handleAdminSend} className="p-3 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 flex items-center gap-2">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={`Responder para ${activeThread.userName}...`}
                  className="flex-1 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl px-4 py-3 text-xs text-zinc-900 dark:text-white outline-none focus:border-purple-500"
                />
                <button
                  type="submit"
                  disabled={!inputText.trim() || sending}
                  className="bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white p-3 rounded-2xl font-bold transition shadow-sm active:scale-95 cursor-pointer"
                >
                  <Send size={16} />
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-zinc-400">
              <Headphones size={40} className="text-purple-400 mb-3 opacity-60" />
              <p className="font-bold text-zinc-700 dark:text-zinc-300 text-sm">Selecione uma conversa para atender</p>
              <p className="text-xs text-zinc-500 mt-1 max-w-sm">
                Quando clientes, batedeiras ou motoristas enviarem mensagens pelo botão de suporte, elas aparecerão listadas à esquerda.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* MODAL DE CONFIGURAÇÃO DE HORÁRIOS E CHAVE DE ATENDIMENTO */}
      {configModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-[250] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-purple-200 dark:border-zinc-800 animate-in zoom-in-95">
            <div className="bg-gradient-to-r from-purple-800 to-indigo-900 text-white p-5 flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <Settings2 size={20} />
                <h3 className="font-extrabold text-base">Configurar Horários & Chave do Suporte</h3>
              </div>
              <button
                onClick={() => setConfigModalOpen(false)}
                className="text-white/80 hover:text-white text-2xl font-bold leading-none cursor-pointer"
              >
                &times;
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* MODO DE FUNCIONAMENTO */}
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-2">
                  Modo de Operação do Canal:
                </label>
                <div className="grid grid-cols-3 gap-2 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setSupportConfig(prev => ({ ...prev, mode: "auto" }))}
                    className={`p-2.5 rounded-xl border text-center transition ${
                      supportConfig.mode === "auto"
                        ? "bg-purple-600 text-white border-purple-600 shadow-xs"
                        : "bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700"
                    }`}
                  >
                    🕒 Automático (Relógio)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSupportConfig(prev => ({ ...prev, mode: "open" }))}
                    className={`p-2.5 rounded-xl border text-center transition ${
                      supportConfig.mode === "open"
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                        : "bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700"
                    }`}
                  >
                    🟢 Forçar Aberto
                  </button>
                  <button
                    type="button"
                    onClick={() => setSupportConfig(prev => ({ ...prev, mode: "closed" }))}
                    className={`p-2.5 rounded-xl border text-center transition ${
                      supportConfig.mode === "closed"
                        ? "bg-red-600 text-white border-red-600 shadow-xs"
                        : "bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700"
                    }`}
                  >
                    🔴 Forçar Fechado
                  </button>
                </div>
              </div>

              {/* INTERRUPTOR CANAL ATIVO */}
              <div className="flex items-center justify-between p-3.5 bg-purple-50/50 dark:bg-purple-950/30 rounded-2xl border border-purple-100 dark:border-purple-900/40">
                <div>
                  <p className="text-xs font-bold text-zinc-900 dark:text-white">Exibir Botão de Suporte no App</p>
                  <p className="text-[11px] text-zinc-500">Se desativado, o botão flutuante ficará invisível para os usuários</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSupportConfig(prev => ({ ...prev, channelEnabled: !prev.channelEnabled }))}
                  className="cursor-pointer text-purple-600 dark:text-purple-400"
                >
                  {supportConfig.channelEnabled ? (
                    <ToggleRight size={32} className="text-emerald-500" />
                  ) : (
                    <ToggleLeft size={32} className="text-zinc-400" />
                  )}
                </button>
              </div>

              {/* HORÁRIOS SEGUNDA A SÁBADO */}
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  🗓️ Segunda a Sábado:
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[10px] text-zinc-400 block mb-1">Abertura:</span>
                    <input
                      type="time"
                      value={supportConfig.weekdayOpen}
                      onChange={(e) => setSupportConfig(prev => ({ ...prev, weekdayOpen: e.target.value }))}
                      className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-2.5 text-xs font-bold text-zinc-800 dark:text-white outline-none focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-400 block mb-1">Fechamento:</span>
                    <input
                      type="time"
                      value={supportConfig.weekdayClose}
                      onChange={(e) => setSupportConfig(prev => ({ ...prev, weekdayClose: e.target.value }))}
                      className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-2.5 text-xs font-bold text-zinc-800 dark:text-white outline-none focus:border-purple-500"
                    />
                  </div>
                </div>
              </div>

              {/* HORÁRIOS DOMINGOS E FERIADOS */}
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  ☀️ Domingos e Feriados:
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[10px] text-zinc-400 block mb-1">Abertura:</span>
                    <input
                      type="time"
                      value={supportConfig.weekendOpen}
                      onChange={(e) => setSupportConfig(prev => ({ ...prev, weekendOpen: e.target.value }))}
                      className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-2.5 text-xs font-bold text-zinc-800 dark:text-white outline-none focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-400 block mb-1">Fechamento:</span>
                    <input
                      type="time"
                      value={supportConfig.weekendClose}
                      onChange={(e) => setSupportConfig(prev => ({ ...prev, weekendClose: e.target.value }))}
                      className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-2.5 text-xs font-bold text-zinc-800 dark:text-white outline-none focus:border-purple-500"
                    />
                  </div>
                </div>
              </div>

              {/* WHATSAPP OFICIAL DE PLANTÃO */}
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  📞 WhatsApp Oficial de Plantão (com DDD):
                </label>
                <input
                  type="text"
                  value={supportConfig.whatsappNumber}
                  onChange={(e) => setSupportConfig(prev => ({ ...prev, whatsappNumber: e.target.value }))}
                  placeholder="5591981244876"
                  className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-2.5 text-xs font-bold text-zinc-800 dark:text-white outline-none focus:border-purple-500"
                />
              </div>

              {/* BOTÕES DE AÇÃO */}
              <div className="pt-3 flex items-center justify-end gap-2 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setConfigModalOpen(false)}
                  className="px-4 py-2.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-700 dark:text-zinc-300 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isSavingConfig}
                  onClick={() => handleSaveConfig(supportConfig)}
                  className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs rounded-xl shadow-md transition active:scale-95 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Save size={14} /> {isSavingConfig ? "Salvando..." : "Salvar Configurações"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
