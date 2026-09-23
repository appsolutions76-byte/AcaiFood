"use client";

import React, { useEffect, useState, useRef } from "react";
import { 
  MessageSquare, Phone, Send, X, Shield, PhoneCall, Headphones, 
  AlertTriangle, CheckCircle2, ChevronDown, Sparkles, HelpCircle, ArrowRight
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAppStore } from "@/store/useAppStore";
import { playChatDing } from "@/lib/soundAlerts";

export interface OrderMessage {
  id: string;
  order_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: string;
  content: string;
  created_at: string;
}

export const INCIDENT_CAUSES: Record<string, { id: string; label: string; severity: 'BAIXA' | 'MEDIA' | 'ALTA' | 'CRITICA' }[]> = {
  cliente: [
    { id: "ITEM_FALTANDO", label: "📦 Item Faltando ou Pedido Incorreto", severity: "MEDIA" },
    { id: "QUALIDADE_EMBALAGEM", label: "🥣 Açaí Derretido / Embalagem Violada ou Danificada", severity: "ALTA" },
    { id: "NAO_RECEBIDO", label: "🚫 Não Recebi o Pedido (Consta como entregue)", severity: "CRITICA" },
    { id: "COBRANCA_INDEVIDA", label: "💰 Cobrança / Valor Indevido no Pix ou Cartão", severity: "ALTA" },
    { id: "ATRASO_EXCESSIVO", label: "⏳ Atraso Excessivo na Entrega", severity: "MEDIA" },
    { id: "CONDUTA_INADEQUADA", label: "⚠️ Problema de Conduta do Entregador ou da Loja", severity: "ALTA" },
    { id: "OUTRO", label: "📝 Outro Motivo (especificar abaixo)", severity: "MEDIA" },
  ],
  loja: [
    { id: "CLIENTE_AUSENTE", label: "🚪 Cliente Ausente / Endereço Não Localizado", severity: "MEDIA" },
    { id: "ENTREGADOR_NAO_COMPARECEU", label: "🛵 Entregador Não Compareceu para Coleta", severity: "ALTA" },
    { id: "DIVERGENCIA_PAGAMENTO", label: "💳 Divergência de Taxa / Repasse Financeiro", severity: "ALTA" },
    { id: "CLIENTE_RECUSOU", label: "❌ Cliente Recusou o Pedido", severity: "MEDIA" },
    { id: "PROBLEMA_FORNECEDOR_B2B", label: "🚛 Problema com Fornecedor de Frutos (B2B)", severity: "ALTA" },
    { id: "OUTRO", label: "📝 Outro Motivo (especificar abaixo)", severity: "MEDIA" },
  ],
  motorista: [
    { id: "CLIENTE_AUSENTE", label: "🚪 Cliente Ausente / Não Atendeu no Endereço", severity: "MEDIA" },
    { id: "ENDERECO_INCORRETO", label: "📍 Endereço Incorreto / Área Sem Acesso ou Risco", severity: "ALTA" },
    { id: "DEMORA_COLETA", label: "⏳ Demora Excessiva no Ponto de Coleta", severity: "MEDIA" },
    { id: "DIVERGENCIA_ROTA_FRETE", label: "🗺️ Divergência de Rota ou Valor do Frete", severity: "MEDIA" },
    { id: "PANE_ACIDENTE", label: "🔧 Acidente ou Pane Mecânica no Trajeto", severity: "CRITICA" },
    { id: "OUTRO", label: "📝 Outro Motivo (especificar abaixo)", severity: "MEDIA" },
  ],
  caminhoneiro: [
    { id: "CLIENTE_AUSENTE", label: "🚪 Comprador Ausente / Não Recebeu a Carga", severity: "ALTA" },
    { id: "ENDERECO_INCORRETO", label: "📍 Local de Descarregamento Sem Acesso", severity: "ALTA" },
    { id: "DEMORA_COLETA", label: "⏳ Demora Excessiva no Ponto de Embarque / Balsa", severity: "MEDIA" },
    { id: "DIVERGENCIA_ROTA_FRETE", label: "🗺️ Divergência no Frete / Pedágio / Balsa", severity: "MEDIA" },
    { id: "PANE_ACIDENTE", label: "🔧 Pane Mecânica no Caminhão ou Acidente", severity: "CRITICA" },
    { id: "OUTRO", label: "📝 Outro Motivo (especificar abaixo)", severity: "MEDIA" },
  ],
  fornecedor: [
    { id: "DIVERGENCIA_PESO_CARGA", label: "⚖️ Divergência de Paneiros / Caixas / Peso", severity: "ALTA" },
    { id: "ATRASO_TRANSPORTE", label: "🚢 Atraso no Transporte / Logística Fluvial ou Rodoviária", severity: "MEDIA" },
    { id: "RECUSA_COMPRADOR", label: "❌ Recusa do Comprador na Entrega", severity: "ALTA" },
    { id: "OUTRO", label: "📝 Outro Motivo (especificar abaixo)", severity: "MEDIA" },
  ],
  admin: [
    { id: "INTERVENCAO_SUPORTE", label: "🎧 Intervenção do Atendimento & Suporte", severity: "MEDIA" },
    { id: "ESTORNO_DISPUTA", label: "💰 Mediação de Estorno / Reembolso Asaas", severity: "ALTA" },
    { id: "OUTRO", label: "📝 Outro Registro Administrativo", severity: "MEDIA" },
  ]
};

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
  initialMode?: 'chat' | 'report';
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
  driverPhone,
  initialMode = 'chat'
}: OrderChatModalProps) {
  const store = useAppStore();
  const currentOrder = (store.orders || []).find((o: any) => o.id === orderId);
  const isB2B = currentOrder?.type === 'B2B';
  const isFinishedOrder = (currentOrder?.status as string) === 'entregue' || 
                           (currentOrder?.status as string) === 'cancelado' || 
                           (currentOrder?.status as string) === 'arquivado' || 
                           (currentOrder?.status as string) === 'concluido' || 
                           (currentOrder?.status as string) === 'finalizado';

  const [activeTab, setActiveTab] = useState<'chat' | 'report'>(initialMode);
  const [messages, setMessages] = useState<OrderMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [hasIncident, setHasIncident] = useState(false);
  const [incidentData, setIncidentData] = useState<any>(null);

  // Formulário de Reportar Problema
  const normalizedRole = (() => {
    const r = (currentUserRole || 'cliente').toLowerCase();
    if (r === 'caminhao' || r === 'caminhão' || r === 'caminhoneiro') return 'caminhoneiro';
    if (r === 'motorista' || r === 'motoboy' || r === 'entregador') return 'motorista';
    if (r === 'loja' || r === 'batedeira') return 'loja';
    if (r === 'fornecedor') return 'fornecedor';
    if (r === 'admin') return 'admin';
    return 'cliente';
  })();

  const causesList = INCIDENT_CAUSES[normalizedRole] || INCIDENT_CAUSES.cliente;
  const [selectedCauseId, setSelectedCauseId] = useState<string>(causesList[0]?.id || 'OUTRO');
  const [reportDescription, setReportDescription] = useState("");
  const [submittingReport, setSubmittingReport] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const cleanPhone = (otherParticipantPhone || "").replace(/\D/g, "");
  const cleanClientPhone = (clientPhone || "").replace(/\D/g, "");
  const cleanStorePhone = (storePhone || "").replace(/\D/g, "");
  const cleanDriverPhone = (driverPhone || "").replace(/\D/g, "");

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Reset tab when initialMode changes or modal reopens
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialMode);
      setReportSuccess(false);
    }
  }, [isOpen, initialMode]);

  // Verificar se há incidentes no banco para este pedido
  const checkExistingIncident = async () => {
    if (!orderId) return;
    try {
      const { data, error } = await supabase
        .from('incident_logs')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        setHasIncident(true);
        setIncidentData(data);
      }
    } catch (_e) {}
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
    checkExistingIncident();

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
          if (newMsg.sender_id !== currentUserId) {
            playChatDing();
          }
          setTimeout(scrollToBottom, 100);
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [isOpen, orderId, currentUserId]);

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

  const handleReportIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCauseId || submittingReport) return;

    setSubmittingReport(true);
    const selectedCauseObj = causesList.find(c => c.id === selectedCauseId) || causesList[0];
    const causeTitle = selectedCauseObj?.label || "Problema no Pedido";
    const causeSeverity = selectedCauseObj?.severity || "MEDIA";
    const fullDesc = reportDescription.trim() || causeTitle;

    try {
      // 1. Criar registro oficial em incident_logs
      const incidentPayload = {
        user_id: currentUserId,
        user_name: currentUserName,
        user_role: currentUserRole,
        order_id: orderId,
        category: 'RECLAMACAO',
        title: `[${causeTitle}] Pedido #${orderId.slice(-5)}`,
        description: fullDesc,
        severity: causeSeverity,
        status: 'PENDENTE',
        created_at: new Date().toISOString()
      };

      await supabase.from('incident_logs').insert(incidentPayload);

      // 2. Enviar mensagem de sistema no chat conectando o Atendimento & Suporte
      const systemMessage = `🚨 Ocorrência aberta por ${currentUserName} (${currentUserRole.toUpperCase()}):\n📌 Causa: ${causeTitle}\n📝 Detalhes: ${fullDesc}\n\n🎧 A equipe de Atendimento & Suporte Oficial AçaíFood foi adicionada a esta conversa para acompanhar e solucionar o problema.`;

      const msgPayload = {
        order_id: orderId,
        sender_id: currentUserId,
        sender_name: "🎧 Atendimento & Suporte",
        sender_role: "admin",
        content: systemMessage
      };

      const { data: newMsg } = await supabase
        .from("order_messages")
        .insert(msgPayload)
        .select()
        .single();

      if (newMsg) {
        setMessages((prev) => [...prev, newMsg as OrderMessage]);
      }

      setHasIncident(true);
      setIncidentData(incidentPayload);
      setReportSuccess(true);
      playChatDing();

      // Transiciona para a aba de chat após 1.2s
      setTimeout(() => {
        setActiveTab('chat');
        setReportSuccess(false);
        setTimeout(scrollToBottom, 100);
      }, 1200);

    } catch (err) {
      console.warn("Erro ao reportar ocorrência:", err);
    } finally {
      setSubmittingReport(false);
    }
  };

  const getRoleBadge = (msg: OrderMessage) => {
    const sId = msg.sender_id;
    const sName = (msg.sender_name || "").toLowerCase().trim();
    const sRole = (msg.sender_role || "").toLowerCase().trim();
    const user = store.users ? store.users[sId] : null;

    // 0. ADMIN / SUPORTE
    if (sRole === "admin" || sRole === "suporte" || sRole === "support" || user?.role === "admin" || sName.includes("suporte") || sName.includes("atendimento")) {
      return { 
        label: "🎧 Atendimento & Suporte", 
        class: "bg-purple-600 text-white font-extrabold shadow-xs border border-purple-400/40" 
      };
    }

    // 1. CLIENTE CONSUMIDOR FINAL (B2C)
    const isCustomer = sRole === "cliente" || 
                       sRole === "customer" || 
                       sRole === "buyer" ||
                       user?.role === "cliente" ||
                       (!isB2B && currentOrder && (
                         currentOrder.clienteId === sId || 
                         currentOrder.criadoPor === sId || 
                         currentOrder.destinoId === sId ||
                         (currentOrder.clienteNome && sName === currentOrder.clienteNome.toLowerCase().trim())
                       ));

    if (isCustomer) {
      return { 
        label: "👤 Cliente", 
        class: "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800" 
      };
    }

    // 2. FORNECEDOR / USINA
    const isSupplier = sRole === "fornecedor" || 
                       sRole === "supplier" || 
                       sRole === "usina" || 
                       sRole === "vendedor" ||
                       user?.role === "fornecedor" ||
                       (currentOrder && (currentOrder.fornecedorId === sId || (isB2B && currentOrder.origemId === sId) || (currentOrder as any)?.sellerStorefrontId === sId)) ||
                       (isB2B && currentOrder?.lojaNome && sName === currentOrder.lojaNome.toLowerCase().trim()) ||
                       sName.includes("bianca");

    if (isSupplier) {
      return { 
        label: "🏭 Fornecedor", 
        class: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800" 
      };
    }

    // 3. TRANSPORTE / CAMINHÃO
    const isTruck = sRole === "caminhoneiro" || 
                    sRole === "caminhao" || 
                    sRole === "caminhão" || 
                    sRole === "transporte" || 
                    sRole === "transporter" ||
                    user?.veiculo === "Caminhão" || 
                    user?.veiculo === "Caçamba" ||
                    (isB2B && (currentOrder?.motoristaId === sId || (currentOrder?.motoristaNome && sName === currentOrder.motoristaNome.toLowerCase().trim()))) ||
                    sName.includes("juliana");

    if (isTruck) {
      return { 
        label: "🚛 Transporte", 
        class: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800" 
      };
    }

    // 4. MOTOBOY / ENTREGA RÁPIDA
    const isMotoboy = sRole === "motoboy" || 
                      sRole === "motorista" || 
                      sRole === "entregador" || 
                      sRole === "courier" || 
                      sRole === "driver" ||
                      user?.veiculo === "Moto" ||
                      (!isB2B && (user?.role === "motorista" || currentOrder?.motoristaId === sId));

    if (isMotoboy) {
      return { 
        label: "🏍️ Motoboy", 
        class: "bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300 border border-orange-200 dark:border-orange-800" 
      };
    }

    // 5. LOJA / BATEDEIRA
    const isStore = sRole === "loja" || 
                    sRole === "batedeira" || 
                    sRole === "partner" || 
                    user?.role === "loja" ||
                    (currentOrder && (currentOrder.lojaId === sId || (!isB2B && currentOrder.origemId === sId) || (isB2B && currentOrder.destinoId === sId))) ||
                    sName.includes("ponto do açaí") ||
                    sName.includes("ponto do acai");

    if (isStore) {
      return { 
        label: isB2B ? "🏪 Loja Compradora" : "🏪 Loja/Batedeira", 
        class: "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800" 
      };
    }

    // 6. CLIENTE CONSUMIDOR FINAL (B2C)
    return { 
      label: "👤 Usuário", 
      class: "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700" 
    };
  };

  if (!isOpen) return null;

  const resolvedHeaderSubtitle = (() => {
    if (otherParticipantName) {
      let roleLabel = otherParticipantRole;
      const lowerName = otherParticipantName.toLowerCase();
      if (lowerName.includes("ponto do açaí") || lowerName.includes("ponto do acai")) {
        roleLabel = isB2B ? "Loja Compradora" : "Loja";
      } else if (lowerName.includes("bianca")) {
        roleLabel = "Fornecedor";
      } else if (lowerName.includes("juliana")) {
        roleLabel = isB2B ? "Transporte" : "Motoboy";
      }
      return `${roleLabel ? `[${roleLabel}] ` : ''}${otherParticipantName}`;
    }
    return isB2B 
      ? 'Canal Integrado (Loja • Transporte • Fornecedor)' 
      : 'Canal Integrado (Cliente • Loja • Motoboy)';
  })();

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-900 rounded-3xl max-w-lg w-full h-[88vh] sm:h-[650px] flex flex-col shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden animate-in zoom-in-95">
        
        {/* Header Principal */}
        <div className="p-3.5 sm:p-4 bg-gradient-to-r from-purple-800 via-indigo-900 to-purple-950 text-white flex items-center justify-between border-b border-purple-700/60 shrink-0 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-xl shadow-inner shrink-0">
              {hasIncident ? '🎧' : '💬'}
            </div>
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="font-extrabold text-sm sm:text-base leading-tight">
                  Pedido #{orderId.slice(-5)}
                </h3>
                {hasIncident && (
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 font-extrabold px-2 py-0.5 rounded-full border border-amber-400/30 flex items-center gap-1">
                    🛡️ Suporte Ativo
                  </span>
                )}
              </div>
              <p className="text-[11px] text-purple-200/80">
                {resolvedHeaderSubtitle}
              </p>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-xl transition active:scale-95 cursor-pointer"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Abas de Navegação (Conversa vs Reportar Problema) */}
        <div className="bg-zinc-100 dark:bg-zinc-950/80 p-1.5 px-3 flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('chat')}
            className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer ${
              activeTab === 'chat'
                ? 'bg-white dark:bg-zinc-800 text-purple-700 dark:text-purple-300 shadow-xs border border-zinc-200 dark:border-zinc-700'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <MessageSquare size={14} />
            <span>Mensagens ({messages.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('report')}
            className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer ${
              activeTab === 'report'
                ? 'bg-amber-500 text-white shadow-xs'
                : hasIncident
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-amber-600 dark:hover:text-amber-400'
            }`}
          >
            <AlertTriangle size={14} />
            <span>{hasIncident ? 'Ver Ocorrência / Suporte' : 'Reportar Problema'}</span>
          </button>
        </div>

        {/* Banner Informativo de Suporte Conectado quando Ocorrência Aberta */}
        {hasIncident && (
          <div className="bg-gradient-to-r from-purple-950 via-indigo-950 to-purple-950 text-white px-3.5 py-2 border-b border-purple-800/60 flex items-center justify-between gap-2 shrink-0 text-xs shadow-inner">
            <div className="flex items-center gap-2 font-bold text-[11px] text-purple-200">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <span>🎧 Atendimento & Suporte Oficial Conectado</span>
            </div>
            <span className="text-[10px] bg-purple-800/60 border border-purple-500/40 text-purple-200 px-2 py-0.5 rounded-md font-bold">
              Status: {incidentData?.status || 'EM_ANALISE'}
            </span>
          </div>
        )}

        {/* CORPO: ABA 1 - CHAT DE MENSAGENS */}
        {activeTab === 'chat' && (
          <>
            {/* Action Bar - Voice Call & WhatsApp */}
            <div className="bg-zinc-50 dark:bg-zinc-900/60 p-2 px-3.5 flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 dark:border-zinc-800 shrink-0 text-xs">
              <div className="flex items-center gap-1 text-zinc-600 dark:text-zinc-400 font-semibold text-[11px]">
                <Shield size={13} className="text-emerald-500 shrink-0" />
                <span>Contato Direto:</span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {cleanPhone ? (
                  <>
                    <a
                      href={`tel:${cleanPhone}`}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold px-2.5 py-1 rounded-xl flex items-center gap-1 shadow-xs transition active:scale-95"
                    >
                      <Phone size={11} /> Ligar
                    </a>
                    <a
                      href={`https://wa.me/55${cleanPhone}?text=Ol%C3%A1%2C%20estou%20entrando%20em%20contato%20sobre%20o%20pedido%20%23${orderId.slice(-5)}%20no%20A%C3%A7a%C3%ADFood`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-green-600 hover:bg-green-700 text-white text-[11px] font-bold px-2.5 py-1 rounded-xl flex items-center gap-1 shadow-xs transition active:scale-95"
                    >
                      <PhoneCall size={11} /> WhatsApp
                    </a>
                  </>
                ) : cleanClientPhone || cleanStorePhone || cleanDriverPhone ? (
                  <>
                    {cleanClientPhone && (
                      <a
                        href={`https://wa.me/55${cleanClientPhone}?text=Ol%C3%A1%2C%20estou%20entrando%20em%20contato%20sobre%20o%20pedido%20%23${orderId.slice(-5)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1 shadow-xs transition"
                      >
                        {isB2B ? '🏪 Loja' : '👤 Cliente'}
                      </a>
                    )}
                    {cleanStorePhone && (
                      <a
                        href={`https://wa.me/55${cleanStorePhone}?text=Ol%C3%A1%2C%20estou%20entrando%20em%20contato%20sobre%20o%20pedido%20%23${orderId.slice(-5)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1 shadow-xs transition"
                      >
                        {isB2B ? '🏭 Fornecedor' : '🏪 Loja'}
                      </a>
                    )}
                    {cleanDriverPhone && (
                      <a
                        href={`https://wa.me/55${cleanDriverPhone}?text=Ol%C3%A1%2C%20estou%20entrando%20em%20contato%20sobre%20o%20pedido%20%23${orderId.slice(-5)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-orange-600 hover:bg-orange-700 text-white text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1 shadow-xs transition"
                      >
                        {isB2B ? '🚛 Transporte' : '🏍️ Motoboy'}
                      </a>
                    )}
                  </>
                ) : (
                  <span className="text-[10px] text-zinc-400 italic">Telefone indisponível</span>
                )}
              </div>
            </div>

            {/* Message Feed */}
            <div className="flex-1 p-3.5 sm:p-4 overflow-y-auto space-y-3 bg-zinc-50/60 dark:bg-zinc-950/60">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3 text-zinc-400">
                  <div className="w-14 h-14 rounded-2xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center text-2xl shadow-inner">
                    💬
                  </div>
                  <div className="space-y-1 max-w-xs">
                    <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Nenhuma mensagem ainda neste pedido.</p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                      Converse em tempo real com as partes envolvidas. Se o pedido foi concluído e houve algum imprevisto, clique em <strong>Reportar Problema</strong>.
                    </p>
                  </div>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMe = msg.sender_id === currentUserId;
                  const isSupportAdmin = msg.sender_role === 'admin' || msg.sender_role === 'suporte' || msg.sender_name.includes('Suporte') || msg.sender_name.includes('Atendimento');
                  const formattedTime = new Date(msg.created_at).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit"
                  });
                  const badge = getRoleBadge(msg);

                  if (isSupportAdmin) {
                    return (
                      <div key={msg.id} className="w-full my-2 bg-gradient-to-r from-purple-900/30 via-indigo-900/20 to-purple-900/30 border border-purple-500/40 rounded-2xl p-3.5 shadow-sm text-left animate-in fade-in">
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-base">🎧</span>
                            <span className="font-black text-xs text-purple-700 dark:text-purple-300 uppercase tracking-wider">
                              {msg.sender_name}
                            </span>
                            <span className="text-[9px] bg-purple-600 text-white font-extrabold px-1.5 py-0.5 rounded-full">
                              OFICIAL
                            </span>
                          </div>
                          <span className="text-[10px] text-zinc-400 font-semibold">{formattedTime}</span>
                        </div>
                        <p className="text-xs text-zinc-800 dark:text-zinc-100 font-medium leading-relaxed whitespace-pre-wrap">
                          {msg.content}
                        </p>
                      </div>
                    );
                  }

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
                        className={`max-w-[85%] p-3 rounded-2xl text-xs leading-relaxed shadow-xs ${
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
                placeholder={hasIncident ? "Escreva para o Atendimento & Suporte..." : "Digite sua mensagem..."}
                className="flex-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white text-xs p-3 rounded-xl border border-zinc-300 dark:border-zinc-700 focus:ring-2 focus:ring-purple-500 outline-none"
              />
              <button
                type="submit"
                disabled={!inputText.trim() || sending}
                className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white p-3 rounded-xl transition flex items-center justify-center shrink-0 shadow-md active:scale-95 cursor-pointer"
                aria-label="Enviar Mensagem"
              >
                <Send size={16} />
              </button>
            </form>
          </>
        )}

        {/* CORPO: ABA 2 - REPORTAR PROBLEMA / CENTRAL DE SUPORTE */}
        {activeTab === 'report' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-zinc-50 dark:bg-zinc-950 space-y-4">
            
            {reportSuccess ? (
              <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 p-6 rounded-3xl text-center space-y-3 animate-in zoom-in-95">
                <div className="w-14 h-14 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto text-2xl shadow-lg">
                  ✓
                </div>
                <h4 className="text-base font-black text-emerald-900 dark:text-emerald-200">
                  Chamado Aberto com Sucesso!
                </h4>
                <p className="text-xs text-emerald-700 dark:text-emerald-300 leading-relaxed max-w-sm mx-auto">
                  A ocorrência foi registrada e nossa equipe de <strong>🎧 Atendimento & Suporte</strong> já foi conectada ao chat deste pedido para solucionar o problema.
                </p>
                <p className="text-[11px] text-zinc-500">Redirecionando para o chat...</p>
              </div>
            ) : hasIncident ? (
              <div className="space-y-4">
                <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-2xl space-y-2">
                  <div className="flex items-center gap-2 text-amber-500 font-extrabold text-sm">
                    <AlertTriangle size={16} />
                    <span>Ocorrência Registrada para Este Pedido</span>
                  </div>
                  <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
                    <strong>Título:</strong> {incidentData?.title}
                  </p>
                  {incidentData?.description && (
                    <p className="text-xs text-zinc-600 dark:text-zinc-400">
                      <strong>Descrição:</strong> {incidentData.description}
                    </p>
                  )}
                  <div className="pt-2 flex items-center justify-between text-[11px] text-zinc-500 border-t border-amber-500/20">
                    <span>Gravidade: <strong>{incidentData?.severity || 'MEDIA'}</strong></span>
                    <span>Status: <strong className="text-amber-500 uppercase">{incidentData?.status || 'PENDENTE'}</strong></span>
                  </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-3 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400 flex items-center justify-center mx-auto text-xl">
                    🎧
                  </div>
                  <h4 className="font-bold text-sm text-zinc-900 dark:text-white">
                    Equipe de Atendimento Conectada
                  </h4>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-xs mx-auto">
                    Nossos analistas estão acompanhando esta ocorrência. Você pode enviar mensagens adicionais ou comprovantes diretamente na aba de <strong>Mensagens</strong>.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('chat')}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition active:scale-95 cursor-pointer"
                  >
                    <span>Ir para o Chat de Atendimento</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleReportIncident} className="space-y-4">
                
                {/* Banner Header do Formulário */}
                <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-purple-950 text-white p-4 rounded-2xl shadow-md space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🎧</span>
                    <h4 className="font-extrabold text-sm">Atendimento & Suporte Oficial</h4>
                  </div>
                  <p className="text-[11px] text-purple-200/90 leading-relaxed">
                    Houve algum problema com o Pedido #{orderId.slice(-5)}? Selecione a causa abaixo para acionar a equipe de suporte central.
                  </p>
                </div>

                {/* 1. Lista Suspensa de Causas (Dropdown) */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-black uppercase text-zinc-700 dark:text-zinc-300">
                    Motivo / Causa do Problema <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={selectedCauseId}
                      onChange={(e) => setSelectedCauseId(e.target.value)}
                      required
                      className="w-full appearance-none bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-xs font-semibold p-3.5 pr-10 rounded-xl border border-zinc-300 dark:border-zinc-700 focus:ring-2 focus:ring-purple-500 outline-none shadow-xs cursor-pointer"
                    >
                      {causesList.map((cause) => (
                        <option key={cause.id} value={cause.id} className="py-1">
                          {cause.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                  </div>
                </div>

                {/* 2. Campo de Detalhes / Descrição */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-black uppercase text-zinc-700 dark:text-zinc-300">
                    Descrição dos Detalhes (Opcional)
                  </label>
                  <textarea
                    value={reportDescription}
                    onChange={(e) => setReportDescription(e.target.value)}
                    placeholder="Descreva o que aconteceu para que o suporte possa avaliar e resolver mais rápido..."
                    rows={4}
                    className="w-full bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-xs p-3 rounded-xl border border-zinc-300 dark:border-zinc-700 focus:ring-2 focus:ring-purple-500 outline-none shadow-xs leading-relaxed resize-none"
                  />
                </div>

                {/* 3. Garantias do Suporte */}
                <div className="bg-purple-50 dark:bg-purple-950/30 p-3 rounded-xl border border-purple-200 dark:border-purple-800 text-[11px] text-purple-900 dark:text-purple-300 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <Shield size={13} className="text-emerald-500" />
                    <span>Mediação Segura AçaíFood</span>
                  </div>
                  <p className="leading-relaxed text-zinc-600 dark:text-zinc-300">
                    Nossa equipe tem acesso às fotos, PIN de entrega, rota e comprovante Pix via Asaas para resolver qualquer divergência de forma justa e rápida.
                  </p>
                </div>

                {/* Botão de Envio */}
                <button
                  type="submit"
                  disabled={submittingReport}
                  className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 disabled:opacity-50 text-white font-extrabold py-3.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg transition active:scale-95 cursor-pointer"
                >
                  <Headphones size={16} />
                  <span>{submittingReport ? "Abrindo Chamado..." : "Acionar Atendimento & Suporte"}</span>
                </button>

              </form>
            )}

          </div>
        )}

      </div>
    </div>
  );
}

export default OrderChatModal;
