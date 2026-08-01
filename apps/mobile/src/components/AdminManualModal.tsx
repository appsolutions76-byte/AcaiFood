"use client";

import React, { useState } from "react";
import { X, BookOpen, Settings, Users, DollarSign, ShieldCheck } from "lucide-react";

interface AdminManualModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Section = 'visao_geral' | 'taxas' | 'usuarios' | 'pagamentos' | 'seguranca';

const sections: { key: Section; label: string; icon: React.ReactNode }[] = [
  { key: 'visao_geral', label: '1. Visão Geral', icon: <BookOpen size={13} /> },
  { key: 'taxas',       label: '2. Taxas & Cidades', icon: <Settings size={13} /> },
  { key: 'usuarios',   label: '3. Usuários', icon: <Users size={13} /> },
  { key: 'pagamentos', label: '4. Pix & Split', icon: <DollarSign size={13} /> },
  { key: 'seguranca',  label: '5. Segurança & PIN', icon: <ShieldCheck size={13} /> },
];

export function AdminManualModal({ isOpen, onClose }: AdminManualModalProps) {
  const [activeSection, setActiveSection] = useState<Section>('visao_geral');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/75 z-[250] flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col border border-zinc-200 dark:border-zinc-800 overflow-hidden">

        {/* Header */}
        <div className="bg-purple-900 text-white p-4 sm:p-5 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-purple-800 p-2 rounded-xl">
              <BookOpen className="w-5 h-5 text-purple-200" />
            </div>
            <div>
              <h2 className="font-extrabold text-base sm:text-lg">📖 Manual do Administrador</h2>
              <p className="text-xs text-purple-300">Operação completa do ecossistema AçaíFood</p>
            </div>
          </div>
          <button onClick={onClose} className="text-purple-200 hover:text-white p-1 rounded-lg hover:bg-purple-800 transition">
            <X size={22} />
          </button>
        </div>

        {/* Tab Nav */}
        <div className="bg-purple-950/30 border-b border-zinc-200 dark:border-zinc-800 px-3 flex gap-1.5 overflow-x-auto shrink-0 py-2">
          {sections.map(s => (
            <button
              key={s.key}
              onClick={() => setActiveSection(s.key)}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition whitespace-nowrap ${
                activeSection === s.key
                  ? 'bg-purple-600 text-white shadow'
                  : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              {s.icon} {s.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed space-y-4">

          {activeSection === 'visao_geral' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">🥑 Arquitetura do Ecossistema AçaíFood</h3>
              <p>
                O AçaíFood é uma plataforma multisserviço que conecta toda a cadeia de suprimentos do açaí.
                Como <strong>Administrador</strong>, você controla faturamento global, regras de comissionamento,
                tarifas de frete por cidade e aprovação dos parceiros.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-purple-50 dark:bg-purple-950/40 p-3 rounded-xl border border-purple-200 dark:border-purple-800">
                  <span className="font-bold text-purple-900 dark:text-purple-300 text-xs block mb-1">🛒 Mercado B2C</span>
                  <p className="text-xs text-purple-700 dark:text-purple-300">Açaí da Batedeira ao Consumidor Final entregue por Motoboy.</p>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-950/40 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800">
                  <span className="font-bold text-emerald-900 dark:text-emerald-300 text-xs block mb-1">🏭 Mercado B2B</span>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300">Lotes de açaí do Fornecedor para a Batedeira via Caminhão.</p>
                </div>
                <div className="bg-amber-50 dark:bg-amber-950/40 p-3 rounded-xl border border-amber-200 dark:border-amber-800">
                  <span className="font-bold text-amber-900 dark:text-amber-300 text-xs block mb-1">🚛 Coleta de Resíduos</span>
                  <p className="text-xs text-amber-700 dark:text-amber-300">Remoção de caroços de açaí das batedeiras para Ecopontos via Caçamba.</p>
                </div>
              </div>
              <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs space-y-1">
                <p className="font-bold text-zinc-800 dark:text-white mb-2">🖥️ Painéis de Controle por Aba:</p>
                <p>📊 <strong>Visão Geral</strong>: KPIs de movimentação financeira, faturamento por segmento e totais da plataforma.</p>
                <p>👥 <strong>Usuários</strong>: Gestão de todos os cadastros (ativar, pausar, bloquear, excluir).</p>
                <p>🛒 <strong>Histórico de Pedidos</strong>: Lista de todos os pedidos com detalhamento financeiro e mapa do trajeto.</p>
                <p>🌍 <strong>Cidades / Expansão</strong>: Adicionar novas cidades e configurar tarifas regionais independentes.</p>
              </div>
            </div>
          )}

          {activeSection === 'taxas' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">⚙️ Configuração de Taxas Globais e por Cidade</h3>
              <p>Acesse pelo botão <strong>⚙️ Taxas & Repasses Pix</strong> no cabeçalho para configurar as taxas globais. Na aba <strong>🌍 Cidades</strong> você pode definir tarifas específicas por cidade que <strong>sobrepõem</strong> as globais.</p>

              <div className="space-y-2 text-xs bg-zinc-50 dark:bg-zinc-950 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
                <p className="font-bold text-zinc-900 dark:text-white mb-2">💰 Taxas de Comissão da Plataforma:</p>
                <p>• <strong>Comissão B2C (%)</strong>: % retida do subtotal de produtos em vendas Batedeira → Cliente.</p>
                <p>• <strong>Comissão B2B (%)</strong>: % retida do subtotal em vendas Fornecedor → Batedeira.</p>
                <p>• <strong>Comissão de Frete (%)</strong>: % retida sobre o valor do frete (de Motoboy, Caminhão ou Coleta).</p>
              </div>

              <div className="space-y-2 text-xs bg-blue-50 dark:bg-blue-950/40 p-4 rounded-xl border border-blue-200 dark:border-blue-800">
                <p className="font-bold text-blue-900 dark:text-blue-300 mb-2">🚗 Modalidade de Frete (por tipo de entregador):</p>
                <p>• <strong>Por KM (KM)</strong>: O frete é calculado multiplicando a distância em km (da Loja ao Cliente via Haversine) pela tarifa de R$/KM configurada.</p>
                <p>• <strong>Valor Fixo (FIXED)</strong>: Aplica uma tarifa única para todas as entregas, independente da distância.</p>
                <p className="mt-2 text-blue-700 dark:text-blue-300 italic">⚠️ Alterar o modo de Fixo para KM ou vice-versa afeta o cálculo de todos os novos pedidos da cidade.</p>
              </div>

              <div className="text-xs bg-zinc-50 dark:bg-zinc-950 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
                <p className="font-bold text-zinc-900 dark:text-white mb-2">🕐 Horário do Payout Automático:</p>
                <p>Define a hora em que a varredura financeira automática (<strong>payout-sweep</strong>) executa e transfere os saldos da Subconta Asaas para os bancos externos dos parceiros.</p>
              </div>
            </div>
          )}

          {activeSection === 'usuarios' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">👥 Gestão Completa de Usuários</h3>
              <p>Na aba <strong>👥 Usuários</strong>, visualize e filtre todos os cadastros por perfil:</p>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-purple-50 dark:bg-purple-950/30 p-2.5 rounded-lg border border-purple-200 dark:border-purple-800">
                  <span className="font-bold block mb-0.5">🏪 Batedeiras (Loja)</span>
                  <p className="text-zinc-600 dark:text-zinc-400">Vendem B2C, compram B2B, solicitam coleta.</p>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-950/30 p-2.5 rounded-lg border border-emerald-200 dark:border-emerald-800">
                  <span className="font-bold block mb-0.5">🏭 Fornecedores</span>
                  <p className="text-zinc-600 dark:text-zinc-400">Vendem insumos e açaí em lotes para batedeiras.</p>
                </div>
                <div className="bg-amber-50 dark:bg-amber-950/30 p-2.5 rounded-lg border border-amber-200 dark:border-amber-800">
                  <span className="font-bold block mb-0.5">🛵 Motoboys</span>
                  <p className="text-zinc-600 dark:text-zinc-400">Realizam entregas B2C (açaí ao consumidor).</p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-950/30 p-2.5 rounded-lg border border-blue-200 dark:border-blue-800">
                  <span className="font-bold block mb-0.5">🚛 Caminhoneiros</span>
                  <p className="text-zinc-600 dark:text-zinc-400">Fretes B2B e coletas de resíduos (Caçamba).</p>
                </div>
              </div>

              <div className="text-xs bg-zinc-50 dark:bg-zinc-950 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-2">
                <p className="font-bold text-zinc-900 dark:text-white">📋 Ações Disponíveis:</p>
                <p>✅ <strong>Ativar</strong>: Usuário visível e operando normalmente na plataforma.</p>
                <p>⏸️ <strong>Pausar</strong>: Loja ou Entregador temporariamente invisível (sem receber pedidos).</p>
                <p>🚫 <strong>Bloquear</strong>: Impede login e operação completamente.</p>
                <p>🗑️ <strong>Excluir</strong>: Remove o usuário do banco e encerra a subconta Asaas automaticamente.</p>
                <p>💳 <strong>Vincular Asaas</strong>: Permite vincular manualmente a Wallet Asaas de um parceiro para habilitar o Split de pagamentos.</p>
              </div>
            </div>
          )}

          {activeSection === 'pagamentos' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">💳 Fluxo de Pagamento Pix & Split Asaas</h3>

              <ol className="list-decimal list-inside space-y-3 text-xs">
                <li>
                  <strong>Cliente finaliza a compra</strong>: O pedido é criado com status <code>PENDING</code> no Supabase.
                </li>
                <li>
                  <strong>Geração do Pix (Edge Function `asaas-checkout`)</strong>: A plataforma cria a cobrança Pix no Asaas com as regras de Split embutidas.
                </li>
                <li>
                  <strong>Split automático de receita</strong>:
                  <div className="mt-1 ml-4 bg-zinc-100 dark:bg-zinc-800 p-2.5 rounded-lg space-y-0.5">
                    <p>💜 <strong>Plataforma</strong> = Comissão Venda (%) + Comissão Frete (%)</p>
                    <p>🏪 <strong>Vendedor</strong> = Subtotal − Comissão Venda − Subsídio de Frete da loja</p>
                    <p>🛵 <strong>Entregador</strong> = Valor do Frete − Comissão Frete</p>
                  </div>
                </li>
                <li>
                  <strong>Confirmação via Webhook</strong>: Quando o cliente paga o Pix no app do banco, o Asaas aciona o Webhook configurado que atualiza automaticamente o status do pedido para <code>PAID</code> no Supabase. O Supabase Realtime notifica a batedeira e o cliente instantaneamente.
                </li>
                <li>
                  <strong>Payout automático pós-entrega</strong>: Após a validação do PIN de segurança (entrega confirmada), a API <code>/api/asaas/transfer</code> dispara as transferências Pix de repasse diretamente para os bancos externos dos parceiros.
                </li>
              </ol>

              <div className="bg-emerald-50 dark:bg-emerald-950/40 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800 text-xs">
                <p className="font-bold text-emerald-900 dark:text-emerald-300">💡 Dica Admin — Subconta Asaas:</p>
                <p className="text-emerald-800 dark:text-emerald-300 mt-1">
                  Todo parceiro com CPF/CNPJ cadastrado recebe uma <strong>subconta White-Label Asaas</strong> criada automaticamente no cadastro. Isso viabiliza o Split direto sem necessidade de intervenção manual para cada repasse.
                </p>
              </div>
            </div>
          )}

          {activeSection === 'seguranca' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">🛡️ Mecanismos de Segurança</h3>

              <div className="bg-blue-50 dark:bg-blue-950/40 p-4 rounded-xl border border-blue-200 dark:border-blue-800 text-xs space-y-3">
                <p className="font-bold text-blue-900 dark:text-blue-300">🔒 Triggers de Proteção no PostgreSQL:</p>
                <div>
                  <p className="font-bold text-blue-800 dark:text-blue-300">1. `protect_order_financials`</p>
                  <p className="text-blue-700 dark:text-blue-400 mt-0.5">Impede que qualquer usuário (exceto Admin) altere valores de produtos, distâncias, taxas ou fretes após a criação do pedido. Protege contra manipulação financeira.</p>
                </div>
                <div>
                  <p className="font-bold text-blue-800 dark:text-blue-300">2. `validate_delivery_pin_trigger`</p>
                  <p className="text-blue-700 dark:text-blue-400 mt-0.5">Bloqueia a transição para <code>RECEIVED</code> (Entregue) caso o entregador não forneça o PIN de 4 dígitos exato gerado no momento da criação do pedido. O PIN é limpo do banco após a validação para segurança máxima.</p>
                </div>
              </div>

              <div className="bg-amber-50 dark:bg-amber-950/40 p-4 rounded-xl border border-amber-200 dark:border-amber-800 text-xs space-y-2">
                <p className="font-bold text-amber-900 dark:text-amber-300">⚠️ Função de Limpeza de Dados (Admin):</p>
                <p className="text-amber-700 dark:text-amber-300">O botão <strong>🗑️ Limpar</strong> no cabeçalho requer uma senha de segurança e confirmação dupla antes de apagar pedidos arquivados do banco. Isso evita limpezas acidentais.</p>
              </div>

              <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs">
                <p className="font-bold text-zinc-900 dark:text-white mb-2">🔑 Row Level Security (RLS) no Supabase:</p>
                <p>Políticas de segurança em nível de linha garantem que cada usuário só acessa os pedidos e dados pertinentes ao seu perfil, mesmo que tente manipular a URL ou a API diretamente.</p>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 bg-zinc-50 dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs transition shadow-md active:scale-95"
          >
            Fechar Manual
          </button>
        </div>

      </div>
    </div>
  );
}
