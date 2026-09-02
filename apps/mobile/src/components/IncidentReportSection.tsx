"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
  AlertTriangle, 
  FileText, 
  Download, 
  Printer, 
  Plus, 
  Filter, 
  Search, 
  CheckCircle, 
  Clock, 
  X,
  Phone,
  Mail,
  User as UserIcon,
  ShieldAlert
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Order, User } from "@/store/useAppStore";

export interface Incident {
  id: string;
  userId?: string;
  userName: string;
  userRole: string;
  userPhone?: string;
  userEmail?: string;
  orderId?: string;
  category: 'CANCELAMENTO' | 'ESTORNO_PIX' | 'ERRO_PIN' | 'PIN_BLOQUEADO' | 'DISPUTA' | 'BLOQUEIO_CONTA' | 'RECLAMACAO' | 'OUTRO';
  title: string;
  description: string;
  severity: 'BAIXA' | 'MEDIA' | 'ALTA' | 'CRITICA';
  status: 'PENDENTE' | 'EM_ANALISE' | 'RESOLVIDO';
  resolutionNotes?: string;
  createdAt: string;
}

interface IncidentReportSectionProps {
  orders: Order[];
  users: Record<string, User>;
  showToast: (msg: string) => void;
}

export function IncidentReportSection({ orders, users, showToast }: IncidentReportSectionProps) {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string>('TODAS');
  const [periodFilter, setPeriodFilter] = useState<string>('TODOS');
  const [roleFilter, setRoleFilter] = useState<string>('TODOS');
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  // Modal de Nova Ocorrência Manual
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [newTargetUserId, setNewTargetUserId] = useState<string>('');
  const [newCategory, setNewCategory] = useState<Incident['category']>('RECLAMACAO');
  const [newTitle, setNewTitle] = useState<string>('');
  const [newDescription, setNewDescription] = useState<string>('');
  const [newSeverity, setNewSeverity] = useState<Incident['severity']>('MEDIA');
  const [isSaving, setIsSaving] = useState(false);

  // Carregar ocorrências do banco e agregar com ocorrências detectadas no sistema
  const fetchIncidents = async () => {
    setLoading(true);
    try {
      const { data: dbIncidents, error } = await supabase
        .from('incident_logs')
        .select('*')
        .order('created_at', { ascending: false });

      const loadedList: Incident[] = [];

      if (!error && dbIncidents && dbIncidents.length > 0) {
        dbIncidents.forEach((item: any) => {
          loadedList.push({
            id: item.id,
            userId: item.user_id,
            userName: item.user_name || 'Usuário Não Identificado',
            userRole: item.user_role || 'CLIENTE',
            userPhone: item.user_phone,
            orderId: item.order_id,
            category: item.category as any,
            title: item.title,
            description: item.description,
            severity: item.severity as any,
            status: item.status as any,
            resolutionNotes: item.resolution_notes,
            createdAt: item.created_at
          });
        });
      }

      // Agregação automática: Pedidos cancelados, disputas e usuários bloqueados
      orders.forEach(o => {
        if (o.status === 'cancelado') {
          const u = o.clienteId ? users[o.clienteId] : null;
          const exists = loadedList.some(i => i.orderId === o.id && i.category === 'CANCELAMENTO');
          if (!exists) {
            loadedList.push({
              id: `auto-cancel-${o.id}`,
              userId: o.clienteId,
              userName: o.clienteNome || u?.name || 'Cliente',
              userRole: 'cliente',
              userPhone: o.clienteTelefone || u?.telefone,
              userEmail: u?.email,
              orderId: o.id,
              category: 'CANCELAMENTO',
              title: `Cancelamento de Pedido #${String(o.id).substring(0, 8)}`,
              description: `Pedido cancelado antes da entrega. Valor: R$ ${(o.valor || 0).toFixed(2)}. Loja: ${o.lojaNome || 'N/A'}.`,
              severity: 'MEDIA',
              status: 'RESOLVIDO',
              createdAt: o.createdAt || new Date().toISOString()
            });
          }
        }
      });

      // Usuários bloqueados pelo admin
      Object.values(users).forEach(u => {
        if (u.status === 'blocked') {
          const exists = loadedList.some(i => i.userId === u.id && i.category === 'BLOQUEIO_CONTA');
          if (!exists) {
            loadedList.push({
              id: `auto-block-${u.id}`,
              userId: u.id,
              userName: u.name,
              userRole: u.role,
              userPhone: u.telefone,
              userEmail: u.email,
              category: 'BLOQUEIO_CONTA',
              title: `Conta Suspensa/Bloqueada`,
              description: `A conta de ${u.name} (${u.role}) encontra-se bloqueada administrativamente.`,
              severity: 'ALTA',
              status: 'EM_ANALISE',
              createdAt: new Date().toISOString()
            });
          }
        }
      });

      setIncidents(loadedList);
    } catch (e) {
      console.warn("Aviso ao carregar incidentes:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
  }, [orders, users]);

  // Formatação de data, hora e dia da semana
  const formatDateTimeFull = (isoString: string) => {
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return { dateStr: 'Data N/D', timeStr: '--:--', dayOfWeek: 'N/D' };
      
      const dias = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
      const dayOfWeek = dias[d.getDay()];
      const dateStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const timeStr = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      return { dateStr, timeStr, dayOfWeek };
    } catch {
      return { dateStr: 'Data N/D', timeStr: '--:--', dayOfWeek: 'N/D' };
    }
  };

  // Filtragem dos dados
  const filteredIncidents = useMemo(() => {
    return incidents.filter(item => {
      // Categoria
      if (categoryFilter !== 'TODAS' && item.category !== categoryFilter) return false;

      // Papel
      if (roleFilter !== 'TODOS' && item.userRole.toLowerCase() !== roleFilter.toLowerCase()) return false;

      // Período
      if (periodFilter !== 'TODOS') {
        const itemDate = new Date(item.createdAt);
        const now = new Date();
        if (periodFilter === 'HOJE') {
          if (itemDate.getDate() !== now.getDate() || itemDate.getMonth() !== now.getMonth() || itemDate.getFullYear() !== now.getFullYear()) {
            return false;
          }
        } else if (periodFilter === 'ESTA_SEMANA') {
          const diffDays = (now.getTime() - itemDate.getTime()) / (1000 * 3600 * 24);
          if (diffDays > 7) return false;
        } else if (periodFilter === 'ESTE_MES') {
          if (itemDate.getMonth() !== now.getMonth() || itemDate.getFullYear() !== now.getFullYear()) {
            return false;
          }
        }
      }

      // Busca por texto
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchName = item.userName.toLowerCase().includes(term);
        const matchDesc = item.description.toLowerCase().includes(term);
        const matchTitle = item.title.toLowerCase().includes(term);
        const matchOrder = item.orderId?.toLowerCase().includes(term);
        if (!matchName && !matchDesc && !matchTitle && !matchOrder) return false;
      }

      return true;
    });
  }, [incidents, categoryFilter, roleFilter, periodFilter, searchTerm]);

  // Salvar Nova Ocorrência Manual
  const handleCreateIncident = async () => {
    if (!newTitle.trim() || !newDescription.trim()) {
      alert("Por favor, preencha o título e a descrição da ocorrência.");
      return;
    }

    setIsSaving(true);
    try {
      const selectedUser = newTargetUserId ? users[newTargetUserId] : null;
      const payload = {
        user_id: selectedUser?.id || null,
        user_name: selectedUser?.name || 'Usuário Externo',
        user_role: selectedUser?.role || 'CLIENTE',
        user_phone: selectedUser?.telefone || null,
        category: newCategory,
        title: newTitle.trim(),
        description: newDescription.trim(),
        severity: newSeverity,
        status: 'PENDENTE'
      };

      const { error } = await supabase.from('incident_logs').insert(payload);
      if (error) throw error;

      showToast("✅ Ocorrência registrada com sucesso!");
      setNewModalOpen(false);
      setNewTitle('');
      setNewDescription('');
      setNewTargetUserId('');
      fetchIncidents();
    } catch (err: any) {
      alert("Erro ao salvar ocorrência: " + (err.message || 'Erro interno'));
    } finally {
      setIsSaving(false);
    }
  };

  // Alterar Status da Ocorrência
  const handleUpdateStatus = async (id: string, newStatus: Incident['status']) => {
    try {
      if (id.startsWith('auto-')) {
        setIncidents(prev => prev.map(i => i.id === id ? { ...i, status: newStatus } : i));
        showToast(`Status atualizado para ${newStatus}`);
        return;
      }

      const { error } = await supabase
        .from('incident_logs')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      showToast(`Status atualizado para ${newStatus}`);
      fetchIncidents();
    } catch (e: any) {
      alert("Erro ao atualizar status: " + e.message);
    }
  };

  // Exportar para CSV
  const handleExportCSV = () => {
    if (filteredIncidents.length === 0) {
      alert("Não há ocorrências filtradas para exportar.");
      return;
    }

    const headers = [
      "ID",
      "Data",
      "Hora",
      "Dia da Semana",
      "Usuário",
      "Papel",
      "Telefone",
      "Pedido ID",
      "Categoria",
      "Título",
      "Descrição",
      "Gravidade",
      "Status"
    ];

    const rows = filteredIncidents.map(item => {
      const dt = formatDateTimeFull(item.createdAt);
      return [
        `"${item.id}"`,
        `"${dt.dateStr}"`,
        `"${dt.timeStr}"`,
        `"${dt.dayOfWeek}"`,
        `"${item.userName.replace(/"/g, '""')}"`,
        `"${item.userRole}"`,
        `"${item.userPhone || ''}"`,
        `"${item.orderId || ''}"`,
        `"${item.category}"`,
        `"${item.title.replace(/"/g, '""')}"`,
        `"${item.description.replace(/"/g, '""')}"`,
        `"${item.severity}"`,
        `"${item.status}"`
      ].join(";");
    });

    const csvContent = "\uFEFF" + [headers.join(";"), ...rows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `AcaíFood_Relatorio_Ocorrencias_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Imprimir / Salvar PDF Oficial A4
  const handlePrintPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Permita pop-ups no navegador para gerar a impressão do relatório em PDF.");
      return;
    }

    const now = new Date();
    const emissionStr = `${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR')}`;

    const tableRows = filteredIncidents.map((i, idx) => {
      const dt = formatDateTimeFull(i.createdAt);
      return `
        <tr style="border-bottom: 1px solid #e5e7eb; background: ${idx % 2 === 0 ? '#ffffff' : '#f9fafb'};">
          <td style="padding: 8px; font-size: 11px; font-weight: bold; color: #374151;">${idx + 1}</td>
          <td style="padding: 8px; font-size: 11px; color: #111827;">
            <strong>${dt.dateStr}</strong><br/>
            <span style="color: #6b7280; font-size: 10px;">${dt.timeStr} (${dt.dayOfWeek})</span>
          </td>
          <td style="padding: 8px; font-size: 11px; color: #111827;">
            <strong>${i.userName}</strong><br/>
            <span style="font-size: 10px; color: #6b7280;">${i.userRole.toUpperCase()} ${i.userPhone ? '• ' + i.userPhone : ''}</span>
          </td>
          <td style="padding: 8px; font-size: 11px;">
            <span style="background: #f3e8ff; color: #6b21a8; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 10px;">
              ${i.category}
            </span>
            ${i.orderId ? `<br/><span style="font-size: 9.5px; color: #4b5563; font-family: monospace;">Ref: #${String(i.orderId).substring(0, 8)}</span>` : ''}
          </td>
          <td style="padding: 8px; font-size: 11px; color: #374151;">
            <strong>${i.title}</strong><br/>
            <span style="color: #4b5563; font-size: 10.5px;">${i.description}</span>
          </td>
          <td style="padding: 8px; font-size: 11px; font-weight: bold; color: ${
            i.severity === 'CRITICA' || i.severity === 'ALTA' ? '#dc2626' : '#d97706'
          };">
            ${i.severity}
          </td>
          <td style="padding: 8px; font-size: 11px; font-weight: bold; color: ${
            i.status === 'RESOLVIDO' ? '#16a34a' : '#ea580c'
          };">
            ${i.status}
          </td>
        </tr>
      `;
    }).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>Relatório de Ocorrências e Problemas — AçaíFood</title>
        <style>
          @page { size: A4 landscape; margin: 12mm; }
          body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; color: #1f2937; line-height: 1.4; }
          .header { text-align: center; border-bottom: 2px solid #7c3aed; padding-bottom: 12px; margin-bottom: 15px; }
          .header h1 { margin: 0 0 4px 0; color: #581c87; font-size: 18px; }
          .header p { margin: 0; font-size: 11px; color: #6b7280; }
          .meta-bar { display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 12px; color: #4b5563; background: #f3f4f6; padding: 6px 10px; border-radius: 6px; }
          table { width: 100%; border-collapse: collapse; text-align: left; }
          th { background: #f3e8ff; color: #581c87; padding: 8px; font-size: 10.5px; text-transform: uppercase; border-bottom: 2px solid #d8b4fe; }
          .footer { text-align: center; margin-top: 20px; font-size: 9.5px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 8px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🥑 AÇAÍFOOD — RELATÓRIO DE OCORRÊNCIAS & AUDITORIA DE USUÁRIOS</h1>
          <p>Documento de Auditoria e Casos Operacionais (Quem, Quando, O Quê, Data, Hora e Dia)</p>
        </div>

        <div class="meta-bar">
          <div><strong>Emissão:</strong> ${emissionStr} | <strong>Ambiente:</strong> https://www.acaifood.app.br/</div>
          <div><strong>Total de Casos Filtrados:</strong> ${filteredIncidents.length}</div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 30px;">#</th>
              <th style="width: 130px;">Quando (Data/Hora)</th>
              <th style="width: 170px;">Quem (Usuário)</th>
              <th style="width: 110px;">Categoria</th>
              <th>O Quê (Detalhes da Ocorrência)</th>
              <th style="width: 75px;">Gravidade</th>
              <th style="width: 85px;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows || '<tr><td colspan="7" style="text-align: center; padding: 20px; color: #6b7280;">Nenhuma ocorrência encontrada.</td></tr>'}
          </tbody>
        </table>

        <div class="footer">
          AçaíFood © 2026 • Sistema de Auditoria Interna e Segurança Operacional • Impresso em ${emissionStr}
        </div>

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const getCategoryBadge = (cat: string) => {
    switch(cat) {
      case 'CANCELAMENTO': return 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300';
      case 'ESTORNO_PIX': return 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300';
      case 'ERRO_PIN':
      case 'PIN_BLOQUEADO': return 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300';
      case 'DISPUTA': return 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300';
      case 'BLOQUEIO_CONTA': return 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300';
      default: return 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Top Header Card */}
      <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <ShieldAlert className="text-purple-600" size={22} />
            Relatório de Ocorrências & Problemas
          </h2>
          <p className="text-xs text-zinc-500 mt-1">
            Auditoria completa de incidentes: <strong>quem</strong>, <strong>quando</strong> (data, hora e dia) e <strong>o quê</strong> ocorreu com cada usuário.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 items-center w-full md:w-auto">
          <button
            onClick={() => setNewModalOpen(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-sm transition flex items-center gap-1.5"
          >
            <Plus size={15} /> Nova Ocorrência
          </button>
          <button
            onClick={handleExportCSV}
            className="bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 font-bold text-xs px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 transition flex items-center gap-1.5"
          >
            <Download size={15} /> Exportar CSV
          </button>
          <button
            onClick={handlePrintPDF}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-sm transition flex items-center gap-1.5"
          >
            <Printer size={15} /> Imprimir / Salvar PDF
          </button>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Busca por texto */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 text-zinc-400" size={16} />
          <input
            type="text"
            placeholder="Buscar por usuário, pedido ou descrição..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs font-medium text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-purple-500"
          />
        </div>

        {/* Filtro por Categoria */}
        <div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs font-bold text-zinc-700 dark:text-zinc-300 focus:outline-none focus:border-purple-500"
          >
            <option value="TODAS">📁 Categoria: Todas</option>
            <option value="CANCELAMENTO">🚫 Cancelamento de Pedido</option>
            <option value="ESTORNO_PIX">↩️ Estorno Pix</option>
            <option value="ERRO_PIN">🔐 Erro de PIN</option>
            <option value="PIN_BLOQUEADO">🔒 PIN Bloqueado (5 Erros)</option>
            <option value="DISPUTA">⚖️ Disputa Aberta</option>
            <option value="BLOQUEIO_CONTA">🚫 Conta Bloqueada</option>
            <option value="RECLAMACAO">⚠️ Reclamação / Suporte</option>
            <option value="OUTRO">📌 Outras Ocorrências</option>
          </select>
        </div>

        {/* Filtro por Período */}
        <div>
          <select
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value)}
            className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs font-bold text-zinc-700 dark:text-zinc-300 focus:outline-none focus:border-purple-500"
          >
            <option value="TODOS">🗓️ Período: Todo o Histórico</option>
            <option value="HOJE">Hoje</option>
            <option value="ESTA_SEMANA">Últimos 7 dias</option>
            <option value="ESTE_MES">Este Mês</option>
          </select>
        </div>

        {/* Filtro por Papel */}
        <div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs font-bold text-zinc-700 dark:text-zinc-300 focus:outline-none focus:border-purple-500"
          >
            <option value="TODOS">👥 Papel: Todos os Usuários</option>
            <option value="cliente">🛒 Clientes</option>
            <option value="loja">🏪 Batedeiras / Lojas</option>
            <option value="fornecedor">🏭 Fornecedores</option>
            <option value="motorista">🛵 Motoboys / Caminhoneiros</option>
          </select>
        </div>
      </div>

      {/* Contadores Resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/50 p-3 rounded-xl">
          <p className="text-[10px] font-bold text-purple-700 dark:text-purple-400 uppercase">Total Ocorrências</p>
          <p className="text-xl font-extrabold text-purple-900 dark:text-purple-200 mt-0.5">{filteredIncidents.length}</p>
        </div>
        <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900/50 p-3 rounded-xl">
          <p className="text-[10px] font-bold text-orange-700 dark:text-orange-400 uppercase">Pendentes</p>
          <p className="text-xl font-extrabold text-orange-900 dark:text-orange-200 mt-0.5">
            {filteredIncidents.filter(i => i.status === 'PENDENTE').length}
          </p>
        </div>
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 p-3 rounded-xl">
          <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase">Em Análise</p>
          <p className="text-xl font-extrabold text-amber-900 dark:text-amber-200 mt-0.5">
            {filteredIncidents.filter(i => i.status === 'EM_ANALISE').length}
          </p>
        </div>
        <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/50 p-3 rounded-xl">
          <p className="text-[10px] font-bold text-green-700 dark:text-green-400 uppercase">Resolvidas</p>
          <p className="text-xl font-extrabold text-green-900 dark:text-green-200 mt-0.5">
            {filteredIncidents.filter(i => i.status === 'RESOLVIDO').length}
          </p>
        </div>
      </div>

      {/* Tabela de Ocorrências */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-700 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                <th className="p-3.5">Quando (Data / Hora)</th>
                <th className="p-3.5">Quem (Usuário)</th>
                <th className="p-3.5">Categoria</th>
                <th className="p-3.5">O Quê (Ocorrência)</th>
                <th className="p-3.5">Gravidade</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-xs">
              {filteredIncidents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-zinc-500">
                    Nenhuma ocorrência encontrada com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredIncidents.map(item => {
                  const dt = formatDateTimeFull(item.createdAt);
                  return (
                    <tr key={item.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition">
                      
                      {/* QUANDO */}
                      <td className="p-3.5 whitespace-nowrap">
                        <div className="font-bold text-zinc-800 dark:text-zinc-200">{dt.dateStr}</div>
                        <div className="text-[10px] text-zinc-500">{dt.timeStr} • {dt.dayOfWeek}</div>
                      </td>

                      {/* QUEM */}
                      <td className="p-3.5">
                        <div className="font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                          <span className="text-sm">
                            {item.userRole === 'loja' ? '🏪' : item.userRole === 'fornecedor' ? '🏭' : item.userRole === 'motorista' ? '🛵' : '🛒'}
                          </span>
                          {item.userName}
                        </div>
                        <div className="text-[10px] text-zinc-500 flex items-center gap-2 mt-0.5">
                          <span className="capitalize font-medium">{item.userRole}</span>
                          {item.userPhone && (
                            <a href={`tel:${item.userPhone}`} className="text-purple-600 hover:underline flex items-center gap-0.5">
                              <Phone size={10} /> {item.userPhone}
                            </a>
                          )}
                        </div>
                      </td>

                      {/* CATEGORIA */}
                      <td className="p-3.5 whitespace-nowrap">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getCategoryBadge(item.category)}`}>
                          {item.category}
                        </span>
                        {item.orderId && (
                          <div className="text-[10px] text-zinc-400 font-mono mt-0.5">
                            Ref: #{String(item.orderId).substring(0, 8)}
                          </div>
                        )}
                      </td>

                      {/* O QUÊ */}
                      <td className="p-3.5 max-w-xs">
                        <div className="font-bold text-zinc-800 dark:text-zinc-200">{item.title}</div>
                        <div className="text-[11px] text-zinc-500 line-clamp-2 mt-0.5">{item.description}</div>
                      </td>

                      {/* GRAVIDADE */}
                      <td className="p-3.5 whitespace-nowrap">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          item.severity === 'CRITICA' ? 'bg-red-600 text-white' :
                          item.severity === 'ALTA' ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300' :
                          item.severity === 'MEDIA' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300' :
                          'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                        }`}>
                          {item.severity}
                        </span>
                      </td>

                      {/* STATUS */}
                      <td className="p-3.5 whitespace-nowrap">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          item.status === 'RESOLVIDO' ? 'bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300' :
                          item.status === 'EM_ANALISE' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-300' :
                          'bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300'
                        }`}>
                          {item.status}
                        </span>
                      </td>

                      {/* AÇÃO */}
                      <td className="p-3.5 text-right whitespace-nowrap">
                        {item.status !== 'RESOLVIDO' ? (
                          <button
                            onClick={() => handleUpdateStatus(item.id, 'RESOLVIDO')}
                            className="bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 dark:bg-green-950/30 dark:border-green-800 text-[10px] font-bold px-2.5 py-1 rounded-md transition flex items-center gap-1 ml-auto"
                          >
                            <CheckCircle size={12} /> Resolver
                          </button>
                        ) : (
                          <button
                            onClick={() => handleUpdateStatus(item.id, 'EM_ANALISE')}
                            className="bg-zinc-100 hover:bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 text-[10px] font-bold px-2 py-1 rounded-md transition flex items-center gap-1 ml-auto"
                          >
                            Reabrir
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Nova Ocorrência Manual */}
      {newModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-800/50">
              <h3 className="font-bold text-sm text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
                <Plus size={16} className="text-purple-600" />
                Registrar Nova Ocorrência / Problema
              </h3>
              <button onClick={() => setNewModalOpen(false)} className="text-zinc-400 hover:text-zinc-600">&times;</button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Usuário Envolvido (Quem):
                </label>
                <select
                  value={newTargetUserId}
                  onChange={(e) => setNewTargetUserId(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs font-medium text-zinc-800 dark:text-zinc-200"
                >
                  <option value="">Selecione o usuário (ou deixe vazio se externo)...</option>
                  {Object.values(users).map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.role}) — {u.telefone || u.email || u.id}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    Categoria:
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as any)}
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs font-medium text-zinc-800 dark:text-zinc-200"
                  >
                    <option value="RECLAMACAO">Reclamação de Atendimento</option>
                    <option value="CANCELAMENTO">Cancelamento</option>
                    <option value="ESTORNO_PIX">Estorno Pix</option>
                    <option value="ERRO_PIN">Erro de PIN / Validação</option>
                    <option value="DISPUTA">Disputa de Carga / Entrega</option>
                    <option value="BLOQUEIO_CONTA">Suspensão de Conta</option>
                    <option value="OUTRO">Outro Motivo</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    Gravidade:
                  </label>
                  <select
                    value={newSeverity}
                    onChange={(e) => setNewSeverity(e.target.value as any)}
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs font-medium text-zinc-800 dark:text-zinc-200"
                  >
                    <option value="BAIXA">Baixa</option>
                    <option value="MEDIA">Média</option>
                    <option value="ALTA">Alta</option>
                    <option value="CRITICA">Crítica</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Título Resumido:
                </label>
                <input
                  type="text"
                  placeholder="Ex: Cliente relatou que entregador atrasou mais de 40 min"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs font-medium text-zinc-800 dark:text-zinc-200"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Descrição Completa do Caso (O Quê):
                </label>
                <textarea
                  rows={4}
                  placeholder="Descreva detalhadamente o ocorrido, contexto, números de telefone contatados e providências tomadas..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs font-medium text-zinc-800 dark:text-zinc-200"
                />
              </div>
            </div>

            <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-2">
              <button
                disabled={isSaving}
                onClick={() => setNewModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-zinc-600 hover:text-zinc-800 dark:text-zinc-400"
              >
                Cancelar
              </button>
              <button
                disabled={isSaving}
                onClick={handleCreateIncident}
                className="bg-purple-600 hover:bg-purple-700 disabled:bg-zinc-400 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-sm transition flex items-center gap-1"
              >
                {isSaving ? 'Salvando...' : 'Salvar Ocorrência'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
