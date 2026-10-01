"use client";

import React, { useState } from "react";
import { X, BookOpen, Settings, Users, DollarSign, ShieldCheck, MapPin, Truck, RefreshCw, ArrowDownToLine, Headphones, Megaphone, CheckCircle2 } from "lucide-react";

interface AdminManualModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Section = 'visao_geral' | 'taxas' | 'usuarios' | 'saques' | 'pagamentos' | 'operacao_radar' | 'seguranca' | 'ocorrencias' | 'suporte_anuncios';

const sections: { key: Section; label: string; icon: React.ReactNode }[] = [
  { key: 'visao_geral',      label: '1. Visão Geral',             icon: <BookOpen size={13} /> },
  { key: 'taxas',            label: '2. Taxas & Cidades',         icon: <Settings size={13} /> },
  { key: 'usuarios',         label: '3. Usuários & Repasses',     icon: <Users size={13} /> },
  { key: 'saques',           label: '4. Gestão de Saques',        icon: <ArrowDownToLine size={13} /> },
  { key: 'pagamentos',       label: '5. Pix, Split & Comprovantes', icon: <DollarSign size={13} /> },
  { key: 'operacao_radar',   label: '6. Radar & Rotas OSRM',      icon: <Truck size={13} /> },
  { key: 'seguranca',        label: '7. Segurança, Reset & PIN',  icon: <ShieldCheck size={13} /> },
  { key: 'ocorrencias',      label: '8. Relatório de Ocorrências', icon: <BookOpen size={13} /> },
  { key: 'suporte_anuncios', label: '9. Suporte & Anúncios',      icon: <Headphones size={13} /> },
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
              <h2 className="font-extrabold text-base sm:text-lg">📖 Manual de Operação do Administrador</h2>
              <p className="text-xs text-purple-300">Controle mestre financeiro, logístico e territorial do AçaíFood</p>
            </div>
          </div>
          <button onClick={onClose} className="text-purple-200 hover:text-white p-1 rounded-lg hover:bg-purple-800 transition">
            <X size={22} />
          </button>
        </div>

        {/* Tab Nav */}
        <div className="bg-purple-950/30 border-b border-zinc-200 dark:border-zinc-800 px-3 flex gap-1.5 overflow-x-auto shrink-0 py-2">
          {sections.map((s) => (
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
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">🥑 Visão Geral do Painel Administrativo</h3>
              <p>
                Como <strong>Administrador Master</strong>, você possui controle irrestrito sobre o faturamento global, comissões retidas, tarifas de frete municipais, esteira de aprovação de saques, auditoria de pedidos e liquidações aos parceiros.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-purple-50 dark:bg-purple-950/40 p-3 rounded-xl border border-purple-200 dark:border-purple-800">
                  <span className="font-bold text-purple-900 dark:text-purple-300 text-xs block mb-1">🛒 Mercado Varejo (B2C)</span>
                  <p className="text-xs text-purple-700 dark:text-purple-300">Açaí fresco das batedeiras entregue por motoboys diretamente ao cliente com PIN.</p>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-950/40 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800">
                  <span className="font-bold text-emerald-900 dark:text-emerald-300 text-xs block mb-1">🏭 Mercado Atacado (B2B)</span>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300">Lotes de frutos e paneiros dos fornecedores entregues às batedeiras via caminhões.</p>
                </div>
                <div className="bg-amber-50 dark:bg-amber-950/40 p-3 rounded-xl border border-amber-200 dark:border-amber-800">
                  <span className="font-bold text-amber-900 dark:text-amber-300 text-xs block mb-1">🚛 Logística Reversa ESG</span>
                  <p className="text-xs text-amber-700 dark:text-amber-300">Coleta e descarte de caroços em caçambas destinadas a Ecopontos credenciados.</p>
                </div>
              </div>
              <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs space-y-1.5">
                <p className="font-bold text-zinc-800 dark:text-white mb-2">🖥️ Abas Principais de Controle:</p>
                <p>📊 <strong>Visão Geral & Balanços</strong>: KPIs de volume transacionado, receita líquida da plataforma e saldo acumulado.</p>
                <p>💸 <strong>Gestão de Saques</strong>: Esteira de aprovação/rejeição de saques solicitados pelos parceiros.</p>
                <p>👥 <strong>Usuários</strong>: Gestão de cadastros com liquidação manual e em lote.</p>
                <p>🛒 <strong>Histórico de Pedidos</strong>: Auditoria completa, rotas no mapa, comprovantes e baixa de contingência.</p>
                <p>🌍 <strong>Cidades / Expansão</strong>: Parametrização tarifária independente por município.</p>
                <p>🎧 <strong>Suporte & Anúncios</strong>: Atendimento em tempo real e moderação de publicidade.</p>
              </div>
            </div>
          )}

          {activeSection === 'taxas' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">⚙️ Gestão de Taxas e Expansão Territorial</h3>
              <p>Configure a política de monetização da plataforma em escala nacional:</p>

              <div className="space-y-2 text-xs bg-zinc-50 dark:bg-zinc-950 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
                <p className="font-bold text-zinc-900 dark:text-white mb-2">💰 Comissões Retidas pela Plataforma (%):</p>
                <p>• <strong>Comissão B2C (%)</strong>: % retida do subtotal dos produtos vendidos pela batedeira ao consumidor.</p>
                <p>• <strong>Comissão B2B (%)</strong>: % retida do subtotal dos produtos vendidos pelo fornecedor à batedeira.</p>
                <p>• <strong>Comissão de Logística (%)</strong>: % retida sobre o frete de motoboys e caminhoneiros.</p>
              </div>

              <div className="space-y-2 text-xs bg-blue-50 dark:bg-blue-950/40 p-4 rounded-xl border border-blue-200 dark:border-blue-800">
                <p className="font-bold text-blue-900 dark:text-blue-300 mb-2">🚗 Modalidades de Frete (KM vs. Valor Fixo):</p>
                <p>• <strong>KM</strong>: O frete é calculado dinamicamente com base na distância de rota pelas ruas (distância × taxa por km).</p>
                <p>• <strong>FIXED</strong>: Aplica uma taxa fixa pré-definida para todas as entregas na cidade, independente da distância.</p>
                <p className="mt-2 text-blue-700 dark:text-blue-300 italic">Cada cidade cadastrada na aba <em>Cidades / Expansão</em> pode ter suas próprias taxas locais!</p>
              </div>

              <div className="text-xs bg-zinc-50 dark:bg-zinc-950 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
                <p className="font-bold text-zinc-900 dark:text-white mb-2">🛡️ Taxa de Homologação / Ativação de Parceiros:</p>
                <p>Na aba <em>Ativações</em>, ative ou desative a cobrança de taxa de adesão Pix para novas lojas e configure a quantidade de vagas promocionais gratuitas de fundadores.</p>
              </div>
            </div>
          )}

          {activeSection === 'usuarios' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">👥 Gestão de Parceiros & Liquidação</h3>
              <p>Na aba <strong>👥 Usuários</strong>, você gerencia cada parceiro e acompanha as pendências financeiras:</p>

              <div className="bg-emerald-50 dark:bg-emerald-950/40 p-4 rounded-xl border border-emerald-200 dark:border-emerald-800 text-xs space-y-2">
                <p className="font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                  <DollarSign size={15} /> Liquidação Manual e em Lote:
                </p>
                <p className="text-emerald-800 dark:text-emerald-300">
                  • <strong>Individual:</strong> Clique em <em>"💸 Pagar e Zerar"</em> no card do parceiro para enviar o Pix e quitar os pedidos concluídos.<br/>
                  • <strong>Liquidação Geral em Lote:</strong> No topo da aba, selecione <em>"🌐 Todas as Cidades"</em> e clique em <em>"⚡ Pagar Todos (Geral)"</em>.<br/>
                  • <strong>Liquidação por Cidade:</strong> Selecione a cidade desejada e liquide apenas os parceiros daquela praça específica.
                </p>
              </div>

              <div className="text-xs bg-zinc-50 dark:bg-zinc-950 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-1.5">
                <p className="font-bold text-zinc-900 dark:text-white mb-2">📋 Controles Operacionais de Usuários:</p>
                <p>✅ <strong>Ativar</strong>: Permite operar e receber pedidos normalmente.</p>
                <p>⏸️ <strong>Pausar</strong>: Desativa temporariamente a visibilidade da loja ou entregador.</p>
                <p>🚫 <strong>Bloquear</strong>: Bloqueia acesso à conta e cancela sessões ativas.</p>
                <p>🗑️ <strong>Excluir Conta</strong>: Remove o usuário do banco e encerra a subconta Asaas vinculada.</p>
              </div>
            </div>
          )}

          {activeSection === 'saques' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">💸 Gestão da Esteira de Saques</h3>
              <p>Na aba <strong>💸 Saques</strong>, a administração audita e aprova as solicitações de transferência enviadas pelos parceiros:</p>

              <div className="bg-purple-50 dark:bg-purple-950/40 p-4 rounded-xl border border-purple-200 dark:border-purple-800 text-xs space-y-2">
                <p className="font-bold text-purple-900 dark:text-purple-300">🔍 Como Funciona a Aprovação de Saques:</p>
                <p>1. <strong>Solicitação do Parceiro</strong>: Batedeiras, fornecedores e entregadores solicitam saques do saldo de pedidos entregues com PIN.</p>
                <p>2. <strong>Auditoria de Segurança</strong>: O sistema valida se a chave Pix pertence ao mesmo CPF/CNPJ cadastrado e se o valor atinge o mínimo configurado.</p>
                <p>3. <strong>Aprovar</strong>: Dispara a transferência Pix na subconta Asaas e marca os pedidos correspondentes como pagos.</p>
                <p>4. <strong>Rejeitar</strong>: Caso haja divergência ou disputa, o administrador pode recusar com justificativa registrada no histórico do parceiro.</p>
              </div>
            </div>
          )}

          {activeSection === 'pagamentos' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">💳 Fluxo Pix, Split Asaas, Estornos & Comprovantes</h3>

              <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs space-y-2.5">
                <p className="font-bold text-zinc-900 dark:text-white">⚡ Ciclo de Vida Financeiro:</p>
                <p>1. <strong>Criação do Pedido</strong>: O cliente gera o Pix dinâmico via Asaas (<code>asaas-checkout</code>).</p>
                <p>2. <strong>Confirmação via Webhook</strong>: Ao pagar no banco, o Asaas aciona o webhook em tempo real, que atualiza o pedido para <code>PAID</code>.</p>
                <p>3. <strong>Divisão Automática (Triple Split)</strong>:</p>
                <div className="pl-3 space-y-1 text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-900 p-2.5 rounded-lg">
                  <p>💜 <strong>Plataforma</strong>: Comissão Venda (%) + Comissão Frete (%).</p>
                  <p>🏪 <strong>Vendedor</strong>: Subtotal dos Produtos − Comissão Venda − Subsídio de Frete.</p>
                  <p>🛵 <strong>Entregador</strong>: Valor do Frete − Comissão de Frete.</p>
                </div>
                <p>4. <strong>📄 Comprovante Oficial Asaas</strong>: O sistema gera o comprovante oficial com selo/logo Asaas, ID da transação e favorecido Eletromecânica Baia Ltda para impressão térmica ou em PDF.</p>
                <p>5. <strong>Estorno Automático Pix (Refund)</strong>: Cancelamentos realizados antes do preparo acionam <code>POST /api/asaas/refund</code>, devolvendo 100% do valor ao cliente em segundos.</p>
              </div>
            </div>
          )}

          {activeSection === 'operacao_radar' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">📡 Funcionamento do Radar e Rotas OSRM</h3>

              <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs space-y-2.5">
                <p className="font-bold text-zinc-900 dark:text-white">🚀 Regra do Radar sob Demanda:</p>
                <p>• <strong>B2C</strong>: O pedido <strong>só entra no radar dos motoboys</strong> quando a batedeira clica em <em>"Chamar Moto"</em> (após embalar o produto), evitando esperas na porta da loja.</p>
                <p>• <strong>B2B</strong>: A carga <strong>só entra no radar dos caminhoneiros</strong> quando o fornecedor clica em <em>"Chamar Caminhão"</em>.</p>
                <p>• <strong>OSRM & Cartografia</strong>: O sistema calcula rotas reais por vias de trânsito em vez de linhas retas, exibindo no mapa o traçado azul (loja ➔ cliente) e o traçado laranja (entregador ➔ loja).</p>
                <p>• <strong>Auditoria de Pedidos</strong>: No histórico administrativo de pedidos, clique em qualquer pedido para inspecionar no mapa a rota executada, dados das partes e valores divididos.</p>
              </div>
            </div>
          )}

          {activeSection === 'seguranca' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">🛡️ Segurança, Reset Total & Validação de PIN</h3>

              <div className="bg-red-50 dark:bg-red-950/40 p-4 rounded-xl border border-red-200 dark:border-red-800 text-xs space-y-2">
                <p className="font-bold text-red-900 dark:text-red-300">🗑️ Poder Total do Botão "Limpar" (Reset Geral):</p>
                <p className="text-red-800 dark:text-red-300">
                  O botão <strong>"Limpar"</strong> possui poder total sobre todo o sistema. Ao ser acionado com a senha de segurança, ele exclui em cascata todos os pedidos, mensagens de chat, itens, splits e histórico, e <strong>zera completamente a tabela <code>admin_balances</code></strong> para todos os períodos.
                </p>
              </div>

              <div className="bg-blue-50 dark:bg-blue-950/40 p-4 rounded-xl border border-blue-200 dark:border-blue-800 text-xs space-y-2">
                <p className="font-bold text-blue-900 dark:text-blue-300">🔐 PIN de Segurança (Retirada e Entrega):</p>
                <p className="text-blue-800 dark:text-blue-300">
                  O sistema emprega PIN aleatório gerado pelo banco de dados. O entregador precisa digitar o PIN correto para liberar o pedido para <code>RECEIVED</code>. O banco bloqueia automaticamente após 5 tentativas incorretas.
                </p>
              </div>

              <div className="bg-amber-50 dark:bg-amber-950/40 p-4 rounded-xl border border-amber-200 dark:border-amber-800 text-xs space-y-2">
                <p className="font-bold text-amber-900 dark:text-amber-300">⚠️ Contingência de Baixa Manual ("Forçar Baixa"):</p>
                <p className="text-amber-800 dark:text-amber-300">
                  Na aba <em>Histórico de Pedidos</em>, o botão <strong>"Forçar Baixa"</strong> permite homologar a entrega em casos excepcionais auditados.
                </p>
              </div>
            </div>
          )}

          {activeSection === 'ocorrencias' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">📋 Relatório de Ocorrências & Auditoria</h3>
              <p>
                A aba <strong>📋 Ocorrências & Auditoria</strong> consolida todos os problemas e eventos críticos ocorridos na plataforma:
              </p>

              <div className="bg-purple-50 dark:bg-purple-950/40 p-4 rounded-xl border border-purple-200 dark:border-purple-800 text-xs space-y-2">
                <p className="font-bold text-purple-900 dark:text-purple-300">🔍 Estrutura Completa de Cada Caso:</p>
                <p>• <strong>Quem</strong>: Nome completo, papel, telefone e e-mail do usuário envolvido.</p>
                <p>• <strong>Quando</strong>: Data (DD/MM/AAAA) e horário exato (HH:MM:SS).</p>
                <p>• <strong>O Quê</strong>: Categoria (Cancelamento, Estorno Pix, Erro de PIN, Disputa, Bloqueio, Reclamação) e descrição.</p>
                <p>• <strong>Gravidade & Status</strong>: Pendente, Em Análise, Resolvido.</p>
              </div>

              <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs space-y-2">
                <p className="font-bold text-zinc-900 dark:text-white">🖨️ Emissão e Exportação de Relatórios:</p>
                <p>• <strong>Imprimir / Salvar PDF</strong>: Gera instantaneamente documento oficial formatado em A4.</p>
                <p>• <strong>Exportar CSV</strong>: Baixa planilha formatada para Excel e Google Planilhas.</p>
              </div>
            </div>
          )}

          {activeSection === 'suporte_anuncios' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">🎧 Central de Suporte & Gestão de Anúncios</h3>
              
              <div className="bg-purple-50 dark:bg-purple-950/40 p-4 rounded-xl border border-purple-200 dark:border-purple-800 text-xs space-y-2">
                <p className="font-bold text-purple-900 dark:text-purple-300 flex items-center gap-1.5">
                  <Headphones size={15} /> Atendimento ao Vivo em Tempo Real:
                </p>
                <p className="text-purple-800 dark:text-purple-300">
                  Na aba <strong>Suporte</strong>, a administração recebe mensagens de chat enviadas por qualquer cliente ou parceiro, respondendo em tempo real com indicador sonoro e histórico de atendimento.
                </p>
              </div>

              <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs space-y-2">
                <p className="font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                  <Megaphone size={15} /> Banners e Stories Patrocinados:
                </p>
                <p className="text-zinc-600 dark:text-zinc-400">
                  Na aba <strong>Anúncios</strong>, cadastre banners promocionais e stories com fotos de produtos para exibição na vitrine inicial do app, aumentando as vendas de lojas parceiras selecionadas.
                </p>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 bg-zinc-50 dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-2 shrink-0 flex-wrap">
          <a
            href="/apresentacao"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-purple-100 hover:bg-purple-200 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 font-bold rounded-xl text-xs transition border border-purple-300 dark:border-purple-800 flex items-center gap-1.5"
          >
            ✨ <span>Ver Apresentação do App</span>
          </a>

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
