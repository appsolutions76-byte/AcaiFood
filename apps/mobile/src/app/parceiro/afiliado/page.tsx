'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import {
  Link as LinkIcon,
  Copy,
  Check,
  Share2,
  Users,
  DollarSign,
  TrendingUp,
  Wallet,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowUpRight,
  ShieldCheck,
  RefreshCw,
  LogOut,
  Sparkles,
  ChevronRight,
  Percent,
  Calendar,
  Layers,
  BookOpen,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

const PartnerManualModal = dynamic(() => import('@/components/PartnerManualModal').then(m => m.PartnerManualModal), { ssr: false });

export default function PainelAfiliadoPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [manualOpen, setManualOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [requestingWithdrawal, setRequestingWithdrawal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawPixKey, setWithdrawPixKey] = useState('');
  const [withdrawMsg, setWithdrawMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError('');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login?returnUrl=/parceiro/afiliado');
        return;
      }

      const res = await fetch('/api/affiliates/dashboard', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || 'Erro ao carregar dados do painel');
      }

      setData(resData);
    } catch (err: any) {
      setError(err.message || 'Falha na conexão.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const handleCopyLink = () => {
    if (!data?.referral_code) return;
    const link = `https://www.acaifood.app.br/r/${data.referral_code}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleShareWhatsapp = () => {
    if (!data?.referral_code) return;
    const link = `https://www.acaifood.app.br/r/${data.referral_code}`;
    const text = encodeURIComponent(
      `Peça o melhor açaí artesanal de Belém direto pelo app AçaíFood! Acesse pelo meu convite: ${link}`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  const handleRequestWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    setWithdrawMsg(null);
    const amountNum = Number(withdrawAmount.replace(',', '.'));

    if (!amountNum || amountNum <= 0) {
      setWithdrawMsg({ type: 'error', text: 'Informe um valor válido para saque.' });
      return;
    }

    if (amountNum > (data?.metrics?.available_balance || 0)) {
      setWithdrawMsg({ type: 'error', text: 'Valor superior ao saldo disponível.' });
      return;
    }

    setRequestingWithdrawal(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/asaas/withdrawals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token || ''}`,
        },
        body: JSON.stringify({
          amount: amountNum,
          pix_key: withdrawPixKey.trim() || undefined,
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || 'Falha ao solicitar saque');
      }

      setWithdrawMsg({
        type: 'success',
        text: 'Solicitação de saque enviada com sucesso! Aguarde o processamento via Pix.',
      });
      setWithdrawAmount('');
      loadDashboard();
    } catch (err: any) {
      setWithdrawMsg({ type: 'error', text: err.message || 'Erro ao processar saque.' });
    } finally {
      setRequestingWithdrawal(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-4">
        <RefreshCw className="w-8 h-8 text-purple-500 animate-spin mb-3" />
        <p className="text-zinc-400 text-sm">Carregando painel de parceiro...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-white mb-2">Acesso ao Painel</h2>
          <p className="text-xs text-zinc-400 mb-6">{error}</p>
          <div className="flex gap-2 justify-center">
            <button
              onClick={loadDashboard}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-xl text-xs font-bold text-white cursor-pointer"
            >
              Tentar novamente
            </button>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-xs font-medium text-zinc-300 cursor-pointer"
            >
              Sair
            </button>
          </div>
        </div>
      </div>
    );
  }

  const referralLink = `https://www.acaifood.app.br/r/${data?.referral_code}`;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      {/* Barra Superior */}
      <header className="sticky top-0 z-30 bg-zinc-900/90 backdrop-blur-md border-b border-zinc-800 px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center overflow-hidden">
              <Image src="/icon.png" alt="AçaíFood" width={28} height={28} className="object-contain" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-sm text-white">AçaíFood Parceiros</span>
                <span className="text-[10px] bg-purple-500/20 text-purple-300 font-bold px-2 py-0.5 rounded-full border border-purple-500/30">
                  Afiliado
                </span>
              </div>
              <p className="text-[11px] text-zinc-400">Olá, {data?.affiliate?.name || 'Parceiro'}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setManualOpen(true)}
              className="text-xs bg-purple-900/60 hover:bg-purple-800 text-purple-200 border border-purple-700/60 px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition cursor-pointer"
              title="Abrir Manual do Parceiro Afiliado"
            >
              <BookOpen size={14} />
              <span className="hidden sm:inline">Manual</span>
            </button>
            <button
              onClick={loadDashboard}
              title="Atualizar dados"
              className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition cursor-pointer"
            >
              <RefreshCw size={16} />
            </button>
            <button
              onClick={handleLogout}
              title="Sair"
              className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-red-400 transition cursor-pointer"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 space-y-6">
        
        {/* Seção 1: MEU LINK DE AFILIADO */}
        <div className="bg-gradient-to-r from-purple-950/60 via-zinc-900 to-zinc-900 border border-purple-500/30 rounded-3xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-300 bg-purple-500/10 px-2.5 py-0.5 rounded-full border border-purple-500/20">
                <Sparkles size={12} /> Seu Link Rastreável
              </div>
              <h2 className="text-lg sm:text-xl font-black text-white">Divulgue e Receba Bônus & Comissões</h2>
              <p className="text-xs text-zinc-400">
                Compartilhe com clientes, batedeiras e entregadores. O cookie tem validade de 7 dias!
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <div className="flex items-center bg-zinc-950/80 border border-zinc-700 rounded-2xl px-3.5 py-2.5 text-xs font-mono text-purple-300 select-all overflow-x-auto">
                <LinkIcon size={14} className="mr-2 text-zinc-500 shrink-0" />
                <span className="truncate">{referralLink}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyLink}
                  className="flex-1 sm:flex-none px-4 py-2.5 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition cursor-pointer shrink-0"
                >
                  {copiedLink ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copiedLink ? 'Copiado!' : 'Copiar'}</span>
                </button>
                <button
                  onClick={handleShareWhatsapp}
                  className="flex-1 sm:flex-none px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition cursor-pointer shrink-0"
                >
                  <Share2 size={14} />
                  <span>WhatsApp</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* CARDS DE MÉTRICAS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <div className="flex items-center justify-between text-zinc-400 text-xs mb-2">
              <span>Indicações</span>
              <Users size={16} className="text-purple-400" />
            </div>
            <div className="text-2xl font-black text-white">{data?.metrics?.referrals_count || 0}</div>
            <p className="text-[11px] text-zinc-500 mt-1">Usuários cadastrados</p>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <div className="flex items-center justify-between text-zinc-400 text-xs mb-2">
              <span>Ganhos Mês</span>
              <TrendingUp size={16} className="text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-emerald-400">
              R$ {(data?.metrics?.total_earned_month || 0).toFixed(2)}
            </div>
            <p className="text-[11px] text-zinc-500 mt-1">Mês corrente</p>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <div className="flex items-center justify-between text-zinc-400 text-xs mb-2">
              <span>Total Histórico</span>
              <DollarSign size={16} className="text-amber-400" />
            </div>
            <div className="text-2xl font-black text-white">
              R$ {(data?.metrics?.total_earned_history || 0).toFixed(2)}
            </div>
            <p className="text-[11px] text-zinc-500 mt-1">Acumulado desde o início</p>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <div className="flex items-center justify-between text-zinc-400 text-xs mb-2">
              <span>Saldo Disponível</span>
              <Wallet size={16} className="text-blue-400" />
            </div>
            <div className="text-2xl font-black text-blue-400">
              R$ {(data?.metrics?.available_balance || 0).toFixed(2)}
            </div>
            <p className="text-[11px] text-zinc-500 mt-1">Liberado para saque</p>
          </div>
        </div>

        {/* GRID PRINCIPAL: SAQUE & MINHAS REGRAS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Seção 4: SALDO E SAQUE */}
          <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-3xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <Wallet size={16} className="text-purple-400" /> Solicitar Saque via Pix
              </h3>
              <span className="text-xs text-zinc-400">
                Disponível: <strong className="text-white">R$ {(data?.metrics?.available_balance || 0).toFixed(2)}</strong>
              </span>
            </div>

            {withdrawMsg && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  withdrawMsg.type === 'success'
                    ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-300'
                    : 'bg-red-950/60 border border-red-500/40 text-red-300'
                }`}
              >
                {withdrawMsg.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                <span>{withdrawMsg.text}</span>
              </div>
            )}

            <form onSubmit={handleRequestWithdrawal} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">Valor do Saque (R$)</label>
                  <input
                    type="text"
                    required
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">Chave Pix (Opcional se já cadastrada)</label>
                  <input
                    type="text"
                    value={withdrawPixKey}
                    onChange={(e) => setWithdrawPixKey(e.target.value)}
                    placeholder="CPF, E-mail ou Telefone"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <p className="text-[11px] text-zinc-500">
                  Modo de saque atual: <strong className="text-purple-300 uppercase">{data?.rules?.withdrawal_mode || 'manual'}</strong>
                </p>
                <button
                  type="submit"
                  disabled={requestingWithdrawal || (data?.metrics?.available_balance || 0) <= 0}
                  className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 cursor-pointer transition"
                >
                  {requestingWithdrawal ? <RefreshCw size={14} className="animate-spin" /> : <ArrowUpRight size={15} />}
                  <span>Solicitar Saque</span>
                </button>
              </div>
            </form>

            {/* Histórico de saques */}
            <div className="pt-4 border-t border-zinc-800">
              <h4 className="text-xs font-bold text-zinc-400 mb-2">Histórico de Saques</h4>
              {(!data?.withdrawals || data.withdrawals.length === 0) ? (
                <p className="text-xs text-zinc-600 py-3 text-center">Nenhum saque solicitado até o momento.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-zinc-800 text-zinc-500">
                        <th className="py-2">Data</th>
                        <th className="py-2">Valor</th>
                        <th className="py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60">
                      {data.withdrawals.map((w: any) => (
                        <tr key={w.id} className="text-zinc-300">
                          <td className="py-2">{new Date(w.created_at).toLocaleDateString('pt-BR')}</td>
                          <td className="py-2 font-bold text-white">R$ {Number(w.amount || 0).toFixed(2)}</td>
                          <td className="py-2">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                w.status === 'PAGO'
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : w.status === 'FALHOU' || w.status === 'REJEITADO'
                                  ? 'bg-red-500/20 text-red-400'
                                  : 'bg-amber-500/20 text-amber-300'
                              }`}
                            >
                              {w.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Seção 5: MINHAS REGRAS */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 sm:p-6 space-y-4">
            <h3 className="font-bold text-sm text-white flex items-center gap-2 border-b border-zinc-800 pb-3">
              <ShieldCheck size={16} className="text-purple-400" /> Minhas Regras e Comissões
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-3 rounded-2xl bg-zinc-800/60 border border-zinc-800">
                <span className="text-zinc-400">Bônus por Loja</span>
                <strong className="text-white text-sm">R$ {Number(data?.rules?.bonus_per_store || 0).toFixed(2)}</strong>
              </div>

              <div className="flex items-center justify-between p-3 rounded-2xl bg-zinc-800/60 border border-zinc-800">
                <span className="text-zinc-400">Bônus por Cliente</span>
                <strong className="text-white text-sm">R$ {Number(data?.rules?.bonus_per_client || 0).toFixed(2)}</strong>
              </div>

              <div className="flex items-center justify-between p-3 rounded-2xl bg-zinc-800/60 border border-zinc-800">
                <span className="text-zinc-400">Comissão por Pedido</span>
                <strong className="text-purple-300 text-sm">{(Number(data?.rules?.commission_pct || 0) * 100).toFixed(1)}%</strong>
              </div>

              <div className="flex items-center justify-between p-3 rounded-2xl bg-zinc-800/60 border border-zinc-800">
                <span className="text-zinc-400">Duração da Comissão</span>
                <strong className="text-white text-sm">{data?.rules?.commission_months || 6} meses</strong>
              </div>

              <div className="flex items-center justify-between p-3 rounded-2xl bg-zinc-800/60 border border-zinc-800">
                <span className="text-zinc-400">Início da Validade</span>
                <strong className="text-zinc-300">
                  {data?.rules?.commission_start
                    ? new Date(data.rules.commission_start).toLocaleDateString('pt-BR')
                    : 'Na ativação'}
                </strong>
              </div>
            </div>

            <div className="p-3 bg-purple-950/30 border border-purple-500/20 rounded-2xl text-[11px] text-purple-300">
              💡 As comissões são calculadas sobre a taxa de intermediação cobrada pela plataforma em cada pedido concluído.
            </div>
          </div>
        </div>

        {/* Seção 2: INDICAÇÕES */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <Users size={16} className="text-purple-400" /> Pessoas Indicadas ({data?.referrals?.length || 0})
            </h3>
            <span className="text-xs text-zinc-500">Cadastradas com seu código</span>
          </div>

          {(!data?.referrals || data.referrals.length === 0) ? (
            <p className="text-xs text-zinc-500 py-6 text-center">
              Você ainda não possui indicações. Compartilhe seu link para começar a pontuar!
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-500">
                    <th className="py-2.5">Indicado</th>
                    <th className="py-2.5">Papel</th>
                    <th className="py-2.5">Data Cadastro</th>
                    <th className="py-2.5">Status Bônus</th>
                    <th className="py-2.5 text-right">Valor Bônus</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {data.referrals.map((r: any) => (
                    <tr key={r.id} className="text-zinc-300">
                      <td className="py-2.5 font-medium text-white">{r.users?.name || 'Usuário'}</td>
                      <td className="py-2.5 capitalize">{r.referred_role || 'Cliente'}</td>
                      <td className="py-2.5 text-zinc-400">{new Date(r.referred_at).toLocaleDateString('pt-BR')}</td>
                      <td className="py-2.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            r.bonus_paid
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-zinc-800 text-zinc-400'
                          }`}
                        >
                          {r.bonus_paid ? 'Pago (1º Pedido)' : 'Pendente 1º Pedido'}
                        </span>
                      </td>
                      <td className="py-2.5 text-right font-bold text-purple-300">
                        R$ {Number(r.bonus_amount || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Seção 3: COMISSÕES (LEDGER) */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <Layers size={16} className="text-purple-400" /> Histórico de Comissões por Pedido (Últimos 20)
            </h3>
            <span className="text-xs text-zinc-500">Créditos em tempo real</span>
          </div>

          {(!data?.ledger || data.ledger.length === 0) ? (
            <p className="text-xs text-zinc-500 py-6 text-center">
              Nenhuma comissão registrada até o momento. Quando seus indicados fizerem pedidos, elas aparecerão aqui!
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-500">
                    <th className="py-2.5">Data & Hora</th>
                    <th className="py-2.5">Pedido</th>
                    <th className="py-2.5">Comissão Plataforma</th>
                    <th className="py-2.5">Percentual</th>
                    <th className="py-2.5 text-right">Crédito Afiliado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {data.ledger.map((l: any) => (
                    <tr key={l.id} className="text-zinc-300">
                      <td className="py-2.5 text-zinc-400">
                        {new Date(l.credited_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                      <td className="py-2.5 font-mono text-zinc-300">
                        #{l.order_id ? l.order_id.slice(0, 8) : 'BÔNUS'}
                      </td>
                      <td className="py-2.5">
                        R$ {Number(l.platform_commission || 0).toFixed(2)}
                      </td>
                      <td className="py-2.5">
                        {l.affiliate_pct ? `${(Number(l.affiliate_pct) * 100).toFixed(1)}%` : 'Bônus'}
                      </td>
                      <td className="py-2.5 text-right font-black text-emerald-400">
                        + R$ {Number(l.affiliate_amount || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </main>

      <PartnerManualModal
        isOpen={manualOpen}
        onClose={() => setManualOpen(false)}
        role="afiliado"
      />
    </div>
  );
}
