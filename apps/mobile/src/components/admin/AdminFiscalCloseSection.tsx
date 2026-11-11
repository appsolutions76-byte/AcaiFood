"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { getAuthHeaders } from "@/store/useAppStore";
import { StoreIcon } from "@/components/StoreIcon";

// R43 — Fechamento mensal para notas fiscais (somente leitura)

type PartnerRow = {
  partnerId: string;
  papel: 'VENDEDOR' | 'ENTREGADOR';
  tipo: string;
  nome: string;
  documento: string;
  email: string;
  telefone: string;
  cidade: string;
  pedidos: number;
  valorBase: number;
  comissao: number;
  tarifaAsaas: number;
  freteSubsidiado: number;
  repasseLiquido: number;
  pedidosEstimados: number;
  // R50: taxa de vendas (papel vendedor) x taxa de transporte (papel entregador)
  taxaVendas?: number;
  taxaTransporte?: number;
};

type Totals = {
  pedidos: number;
  pedidosEstimados: number;
  produtos: number;
  fretes: number;
  comissaoVendas: number;
  comissaoFrete: number;
  comissaoTotal: number;
  tarifaAsaasTotal: number;
  tarifaAsaasPlataforma: number;
  receitaLiquida: number;
};

const formatMoney = (v: number) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const currentMonthBelem = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 7);
const previousMonth = (m: string) => {
  const [y, mm] = m.split('-').map(Number);
  return mm === 1 ? `${y - 1}-12` : `${y}-${String(mm - 1).padStart(2, '0')}`;
};
const monthLabel = (m: string) => {
  const [y, mm] = m.split('-').map(Number);
  const names = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  return `${names[(mm || 1) - 1]} de ${y}`;
};

export function AdminFiscalCloseSection() {
  // Nos primeiros 10 dias do mês, abre no mês anterior (época de emitir as notas)
  const initialMonth = useMemo(() => {
    const cur = currentMonthBelem();
    const day = Number(new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(8, 10));
    return day <= 10 ? previousMonth(cur) : cur;
  }, []);

  const [month, setMonth] = useState(initialMonth);
  const [tipo, setTipo] = useState<'all' | 'Batedeira' | 'Fornecedor' | 'Motoboy' | 'Caminhão'>('Batedeira');
  const [search, setSearch] = useState('');
  // R47: a nota é por pessoa (CPF/CNPJ). Junta as contas do mesmo documento numa linha.
  const [groupByDoc, setGroupByDoc] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [partners, setPartners] = useState<PartnerRow[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/fiscal-close?month=${encodeURIComponent(month)}`, { headers: await getAuthHeaders(), cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) throw new Error(json?.error || `Erro ${res.status}`);
      setPartners(Array.isArray(json.partners) ? json.partners : []);
      setTotals(json.totals || null);
    } catch (e: any) {
      setError(e?.message || 'Falha ao carregar o fechamento');
      setPartners([]);
      setTotals(null);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => {
    const q = search.toLowerCase().trim();
    const filtered = partners.filter(p => {
      if (tipo !== 'all' && p.tipo !== tipo) return false;
      if (q && !(`${p.nome} ${p.documento} ${p.email} ${p.cidade}`.toLowerCase().includes(q))) return false;
      return true;
    }).map(p => ({
      ...p,
      taxaVendas: p.papel === 'VENDEDOR' ? p.comissao : 0,
      taxaTransporte: p.papel === 'ENTREGADOR' ? p.comissao : 0,
    }));
    if (!groupByDoc) return filtered;
    const byDoc = new Map<string, PartnerRow>();
    for (const p of filtered) {
      const key = String(p.documento || '').replace(/\D/g, '') || `sem-doc:${p.partnerId}:${p.papel}`;
      const cur = byDoc.get(key);
      if (!cur) { byDoc.set(key, { ...p }); continue; }
      byDoc.set(key, {
        ...cur,
        nome: cur.nome.includes(p.nome) ? cur.nome : `${cur.nome} + ${p.nome}`,
        tipo: cur.tipo.includes(p.tipo) ? cur.tipo : `${cur.tipo} + ${p.tipo}`,
        pedidos: cur.pedidos + p.pedidos,
        valorBase: cur.valorBase + p.valorBase,
        comissao: cur.comissao + p.comissao,
        taxaVendas: (cur.taxaVendas || 0) + (p.taxaVendas || 0),
        taxaTransporte: (cur.taxaTransporte || 0) + (p.taxaTransporte || 0),
        tarifaAsaas: cur.tarifaAsaas + p.tarifaAsaas,
        freteSubsidiado: cur.freteSubsidiado + p.freteSubsidiado,
        repasseLiquido: cur.repasseLiquido + p.repasseLiquido,
        pedidosEstimados: cur.pedidosEstimados + p.pedidosEstimados,
      });
    }
    return Array.from(byDoc.values());
  }, [partners, tipo, search, groupByDoc]);

  const visibleTotals = useMemo(() => visible.reduce((a, p) => ({
    pedidos: a.pedidos + p.pedidos,
    valorBase: a.valorBase + p.valorBase,
    comissao: a.comissao + p.comissao,
    taxaVendas: a.taxaVendas + (p.taxaVendas || 0),
    taxaTransporte: a.taxaTransporte + (p.taxaTransporte || 0),
    tarifaAsaas: a.tarifaAsaas + p.tarifaAsaas,
    repasseLiquido: a.repasseLiquido + p.repasseLiquido,
  }), { pedidos: 0, valorBase: 0, comissao: 0, taxaVendas: 0, taxaTransporte: 0, tarifaAsaas: 0, repasseLiquido: 0 }), [visible]);

  const downloadCsv = async () => {
    try {
      const res = await fetch(`/api/admin/fiscal-close?format=csv&month=${encodeURIComponent(month)}`, { headers: await getAuthHeaders(), cache: 'no-store' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err?.error || `Erro ${res.status} ao gerar a planilha.`);
        return;
      }
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = `fechamento_notas_fiscais_${month}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 1000);
    } catch (e: any) {
      alert('Erro ao baixar: ' + (e?.message || 'falha de rede'));
    }
  };

  const tipos: Array<{ id: typeof tipo; label: React.ReactNode }> = [
    { id: 'Batedeira', label: <><StoreIcon size={12} /> Batedeiras</> },
    { id: 'Motoboy', label: '🏍️ Motoboys' },
    { id: 'Fornecedor', label: '🏭 Fornecedores' },
    { id: 'Caminhão', label: '🚛 Caminhões' },
    { id: 'all', label: 'Todos' },
  ];

  return (
    <div className="space-y-5">
      <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
        <div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Fechamento Mensal / Notas Fiscais</h2>
          <p className="text-xs text-zinc-500 mt-1">
            Quanto cada parceiro pagou à plataforma no mês (comissões), com os valores gravados em cada pedido no pagamento.
            Competência pela data de conclusão do pedido; só pedidos concluídos (cancelados e estornados ficam fora).
          </p>
        </div>

        {/* R50: mês da competência sempre visível */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/50 px-4 py-3">
          <p className="text-sm font-black text-purple-900 dark:text-purple-200 uppercase">📅 Competência: {monthLabel(month)}</p>
          <div className="flex gap-2">
            <button onClick={() => setMonth(previousMonth(month))} className="px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-purple-200 dark:border-purple-800 text-xs font-bold text-purple-700 dark:text-purple-300 cursor-pointer">◀ Mês anterior</button>
            <button onClick={() => setMonth(currentMonthBelem())} disabled={month === currentMonthBelem()} className="px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-purple-200 dark:border-purple-800 text-xs font-bold text-purple-700 dark:text-purple-300 disabled:opacity-40 cursor-pointer">Mês atual ▶</button>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs font-bold text-zinc-600 dark:text-zinc-400">
            Mês de referência
            <input
              type="month"
              value={month}
              max={currentMonthBelem()}
              onChange={e => e.target.value && setMonth(e.target.value)}
              className="px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-bold text-zinc-600 dark:text-zinc-400 flex-1 min-w-[180px]">
            Buscar parceiro
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Nome, CPF/CNPJ, e-mail ou cidade"
              className="px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white text-sm"
            />
          </label>
          <button onClick={load} disabled={loading} className="px-4 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-bold text-sm border border-zinc-200 dark:border-zinc-700 disabled:opacity-50 cursor-pointer">
            {loading ? 'Carregando...' : '🔄 Atualizar'}
          </button>
          <button onClick={downloadCsv} disabled={loading || partners.length === 0} className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm disabled:opacity-50 cursor-pointer">
            📥 Exportar CSV para o contador
          </button>
        </div>

        <label className="flex items-center gap-2 text-xs font-bold text-zinc-700 dark:text-zinc-300 cursor-pointer">
          <input type="checkbox" checked={groupByDoc} onChange={e => setGroupByDoc(e.target.checked)} />
          Agrupar por CPF/CNPJ (várias lojas ou papéis da mesma pessoa numa linha só)
        </label>

        <div className="flex flex-wrap gap-2">
          {tipos.map(t => (
            <button
              key={t.id}
              onClick={() => setTipo(t.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border cursor-pointer ${tipo === t.id ? 'bg-purple-600 text-white border-purple-600' : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-sm text-red-700 dark:text-red-300">{error}</div>
      )}

      {totals && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-white dark:bg-zinc-900 p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800">
            <p className="text-[10px] text-zinc-500 uppercase font-bold">Pedidos concluídos</p>
            <p className="text-lg font-bold text-zinc-900 dark:text-white">{totals.pedidos}</p>
          </div>
          <div className="bg-white dark:bg-zinc-900 p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800">
            <p className="text-[10px] text-zinc-500 uppercase font-bold"><StoreIcon size={12} /> Taxas de vendas</p>
            <p className="text-lg font-bold text-purple-700 dark:text-purple-300">{formatMoney(totals.comissaoVendas)}</p>
          </div>
          <div className="bg-white dark:bg-zinc-900 p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800">
            <p className="text-[10px] text-zinc-500 uppercase font-bold">🛵 Taxas de transporte</p>
            <p className="text-lg font-bold text-purple-700 dark:text-purple-300">{formatMoney(totals.comissaoFrete)}</p>
          </div>
          <div className="bg-purple-50 dark:bg-purple-950/30 p-3.5 rounded-xl border border-purple-200 dark:border-purple-900/50">
            <p className="text-[10px] text-purple-700 dark:text-purple-400 uppercase font-bold">Valor total das notas</p>
            <p className="text-lg font-bold text-purple-800 dark:text-purple-300">{formatMoney(totals.comissaoTotal)}</p>
          </div>
          <div className="bg-white dark:bg-zinc-900 p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800">
            <p className="text-[10px] text-zinc-500 uppercase font-bold">Tarifa Asaas da plataforma</p>
            <p className="text-lg font-bold text-red-600 dark:text-red-400">− {formatMoney(totals.tarifaAsaasPlataforma)}</p>
            <p className="text-[9px] text-zinc-400">Total de todos: {formatMoney(totals.tarifaAsaasTotal)}</p>
          </div>
          <div className="bg-emerald-50 dark:bg-emerald-950/30 p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-900/50">
            <p className="text-[10px] text-emerald-700 dark:text-emerald-400 uppercase font-bold">Líquido na conta</p>
            <p className="text-lg font-bold text-emerald-800 dark:text-emerald-300">{formatMoney(totals.receitaLiquida)}</p>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[1100px]">
            <thead className="bg-zinc-50 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 uppercase text-[10px] font-bold">
              <tr>
                <th className="p-3">Parceiro</th>
                <th className="p-3">CPF/CNPJ</th>
                <th className="p-3 text-right">Pedidos</th>
                <th className="p-3 text-right">Vendas / Fretes</th>
                <th className="p-3 text-right">Taxa vendas</th>
                <th className="p-3 text-right">Taxa transporte</th>
                <th className="p-3 text-right">Valor da nota</th>
                <th className="p-3 text-right">Tarifa Asaas paga</th>
                <th className="p-3 text-right">Frete pago pela loja</th>
                <th className="p-3 text-right">Repasse líquido</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {loading ? (
                <tr><td colSpan={10} className="p-6 text-center text-zinc-400">Carregando {monthLabel(month)}...</td></tr>
              ) : visible.length === 0 ? (
                <tr><td colSpan={10} className="p-6 text-center text-zinc-400">Nenhum parceiro com pedidos concluídos em {monthLabel(month)} neste filtro.</td></tr>
              ) : visible.map(p => (
                <tr key={`${p.papel}:${p.partnerId}`} className="align-top">
                  <td className="p-3">
                    <div className="font-bold text-zinc-900 dark:text-white">{p.nome || '—'}</div>
                    <div className="text-[10px] text-zinc-500">{p.tipo}{p.cidade ? ` · ${p.cidade}` : ''}{p.email ? ` · ${p.email}` : ''}</div>
                    {p.pedidosEstimados > 0 && (
                      <div className="text-[10px] text-amber-600">{p.pedidosEstimados} pedido(s) antigo(s) com valor estimado</div>
                    )}
                  </td>
                  <td className="p-3 font-mono">{p.documento || <span className="text-red-500">sem cadastro</span>}</td>
                  <td className="p-3 text-right">{p.pedidos}</td>
                  <td className="p-3 text-right">{formatMoney(p.valorBase)}</td>
                  <td className="p-3 text-right text-indigo-700 dark:text-indigo-300">{p.taxaVendas ? formatMoney(p.taxaVendas) : '—'}</td>
                  <td className="p-3 text-right text-amber-700 dark:text-amber-300">{p.taxaTransporte ? formatMoney(p.taxaTransporte) : '—'}</td>
                  <td className="p-3 text-right font-bold text-purple-700 dark:text-purple-300">{formatMoney(p.comissao)}</td>
                  <td className="p-3 text-right text-red-600 dark:text-red-400">{formatMoney(p.tarifaAsaas)}</td>
                  <td className="p-3 text-right">{p.papel === 'VENDEDOR' ? formatMoney(p.freteSubsidiado) : '—'}</td>
                  <td className="p-3 text-right text-emerald-700 dark:text-emerald-300">{formatMoney(p.repasseLiquido)}</td>
                </tr>
              ))}
            </tbody>
            {!loading && visible.length > 0 && (
              <tfoot className="bg-zinc-50 dark:bg-zinc-950 font-bold">
                <tr>
                  <td className="p-3" colSpan={2}>Total do filtro ({visible.length} parceiro(s))</td>
                  <td className="p-3 text-right">{visibleTotals.pedidos}</td>
                  <td className="p-3 text-right">{formatMoney(visibleTotals.valorBase)}</td>
                  <td className="p-3 text-right text-indigo-700 dark:text-indigo-300">{formatMoney(visibleTotals.taxaVendas)}</td>
                  <td className="p-3 text-right text-amber-700 dark:text-amber-300">{formatMoney(visibleTotals.taxaTransporte)}</td>
                  <td className="p-3 text-right text-purple-700 dark:text-purple-300">{formatMoney(visibleTotals.comissao)}</td>
                  <td className="p-3 text-right text-red-600 dark:text-red-400">{formatMoney(visibleTotals.tarifaAsaas)}</td>
                  <td className="p-3 text-right">—</td>
                  <td className="p-3 text-right text-emerald-700 dark:text-emerald-300">{formatMoney(visibleTotals.repasseLiquido)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <p className="text-[11px] text-zinc-500">
        &quot;Valor da nota&quot; = taxa de vendas + taxa de transporte: a comissão bruta que a plataforma cobrou do parceiro (base da NFS-e e do DAS). A tarifa Pix do Asaas
        aparece separada. Confirme com o seu contador qual valor usar na nota fiscal.
      </p>
    </div>
  );
}

export default AdminFiscalCloseSection;
