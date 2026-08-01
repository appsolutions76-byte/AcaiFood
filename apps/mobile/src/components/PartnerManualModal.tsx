"use client";

import React, { useState } from "react";
import { X, BookOpen } from "lucide-react";

export type PartnerRole = 'batedeira' | 'fornecedor' | 'motoboy' | 'caminhao' | 'login';

interface PartnerManualModalProps {
  isOpen: boolean;
  onClose: () => void;
  role: PartnerRole;
}

// ===================== BATEDEIRA =====================
function ManualBatedeira() {
  const [tab, setTab] = useState<'operacao' | 'b2b' | 'financeiro'>('operacao');
  return (
    <div className="space-y-4 text-sm">
      <div className="flex gap-2 flex-wrap">
        {[['operacao','📦 Operação B2C'], ['b2b','🏭 Abastecimento B2B'], ['financeiro','💰 Financeiro & Pix']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k as any)}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs transition ${tab === k ? 'bg-purple-600 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-purple-100'}`}
          >{l}</button>
        ))}
      </div>

      {tab === 'operacao' && (
        <div className="space-y-3 animate-in fade-in duration-150">
          <h4 className="font-bold text-zinc-900 dark:text-white">🏪 Operação de Vendas B2C</h4>
          <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs space-y-2">
            <p>1. 📊 <strong>Visão Geral</strong>: Acompanhe seu saldo de repasses do dia e status da conta Asaas.</p>
            <p>2. 📦 <strong>Pedidos</strong>: Veja os pedidos dos clientes em tempo real.</p>
            <p>3. ✅ Pedido chega com <strong>Pagamento Confirmado (Pix pago)</strong> → Clique em <em>Aceitar e Preparar</em>.</p>
            <p>4. 🏍️ Ao finalizar o preparo → Clique em <em>Chamar Moto</em>. Um motoboy disponível receberá o chamado.</p>
            <p>5. 🗺️ Clique em <em>Ver Rota no Mapa</em> para visualizar trajeto Loja → Cliente e posição do motoboy.</p>
            <p>6. ✅ Quando o motoboy entregar e o PIN for validado, o pedido é finalizado automaticamente e o repasse Pix é enviado para sua conta.</p>
          </div>
          <div className="bg-purple-50 dark:bg-purple-950/40 p-3 rounded-xl border border-purple-200 dark:border-purple-800 text-xs">
            <p className="font-bold text-purple-900 dark:text-purple-300">💡 Configurações da Vitrine:</p>
            <p className="text-purple-800 dark:text-purple-300 mt-1">Na <em>Visão Geral</em>, você pode editar os preços do seu açaí (Popular, Médio, Grosso), adicionar produtos extras ao cardápio e configurar o <strong>Subsídio de Frete</strong> (% do frete que você paga para atrair mais clientes).</p>
          </div>
        </div>
      )}

      {tab === 'b2b' && (
        <div className="space-y-3 animate-in fade-in duration-150">
          <h4 className="font-bold text-zinc-900 dark:text-white">🏭 Abastecimento B2B e Coleta</h4>
          <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs space-y-2">
            <p>1. Na aba <strong>🛒 Abastecimento B2B</strong>, visualize os fornecedores de açaí disponíveis na sua cidade.</p>
            <p>2. Selecione o fornecedor e a quantidade de latas/sacos desejada.</p>
            <p>3. Clique em <em>Comprar</em> → Um QR Code Pix é gerado para pagamento.</p>
            <p>4. Após o pagamento, o fornecedor recebe a notificação e aciona um caminhoneiro para entrega.</p>
            <p>5. O caminhoneiro valida a entrega com PIN de segurança. O frete do B2B é cobrado da batedeira.</p>
          </div>
          <div className="bg-amber-50 dark:bg-amber-950/40 p-3 rounded-xl border border-amber-200 dark:border-amber-800 text-xs">
            <p className="font-bold text-amber-900 dark:text-amber-300">🚛 Solicitar Coleta de Caroço:</p>
            <p className="text-amber-700 dark:text-amber-300 mt-1">Também na aba B2B, você pode solicitar a remoção de caroços/resíduos de açaí via Caçamba para um Ecoponto. O serviço é cobrado com taxa de coleta (fixa ou por KM).</p>
          </div>
        </div>
      )}

      {tab === 'financeiro' && (
        <div className="space-y-3 animate-in fade-in duration-150">
          <h4 className="font-bold text-zinc-900 dark:text-white">💰 Recebimento & Pix</h4>
          <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs space-y-2">
            <p>• Para receber os repasses automáticos, vincule sua <strong>Chave Pix</strong> (CPF, E-mail, Celular ou Aleatória) ou Carteira Asaas clicando em <em>🤝 Vincular Conta / Carteira Asaas</em>.</p>
            <p>• O repasse da venda líquida (<em>Subtotal - Comissão da plataforma - Subsídio de frete que você configurou</em>) é enviado automaticamente após a entrega ser confirmada com PIN.</p>
            <p>• O botão <em>💸 Saque Instantâneo Pix</em> permite sacar o saldo disponível imediatamente para seu banco.</p>
            <p>• Caso o saldo esteja na sua subconta Asaas, a varredura automática (<strong>Payout Sweep</strong>) realiza a transferência no horário configurado pelo Admin (geralmente às 22:00).</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ===================== FORNECEDOR =====================
function ManualFornecedor() {
  return (
    <div className="space-y-3 text-sm animate-in fade-in duration-150">
      <h4 className="font-bold text-zinc-900 dark:text-white">🏭 Operação do Fornecedor B2B</h4>
      <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs space-y-2">
        <p>1. 📊 <strong>Visão Geral</strong>: Acompanhe o saldo de repasses de vendas e pedidos em processamento.</p>
        <p>2. ➕ <strong>Produtos Extras</strong>: Adicione insumos além do açaí padrão ao seu catálogo B2B (ex: creme de leite, polpa de frutas).</p>
        <p>3. 🚚 <strong>Gestão de Pedidos</strong>: Visualize as ordens de compra enviadas pelas batedeiras.</p>
        <p>4. Ao receber um pedido <strong>pago</strong> → Prepare a carga → Clique em <em>Chamar Caminhão</em>.</p>
        <p>5. Um caminhoneiro disponível na sua cidade aceita o frete e vai buscar a carga.</p>
        <p>6. O caminhoneiro valida a entrega com PIN de segurança → Repasse Pix automático é enviado para sua conta.</p>
      </div>
      <div className="bg-emerald-50 dark:bg-emerald-950/40 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800 text-xs">
        <p className="font-bold text-emerald-900 dark:text-emerald-300">💡 Subsídio de Frete B2B:</p>
        <p className="text-emerald-700 dark:text-emerald-300 mt-1">Configure um <strong>% de subsídio de frete</strong> para absorver parte do custo logístico e oferecer condições mais atrativas para as batedeiras comprarem de você.</p>
      </div>
      <div className="bg-zinc-50 dark:bg-zinc-950 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs">
        <p className="font-bold">💰 Recebimento:</p>
        <p className="mt-1">Vincule sua <strong>Chave Pix</strong> ou Carteira Asaas para receber os repasses das vendas B2B diretamente no seu banco após a confirmação da entrega com PIN.</p>
      </div>
    </div>
  );
}

// ===================== MOTOBOY =====================
function ManualMotoboy() {
  return (
    <div className="space-y-3 text-sm animate-in fade-in duration-150">
      <h4 className="font-bold text-zinc-900 dark:text-white">🛵 Operação do Motoboy B2C</h4>
      <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs space-y-2">
        <p>1. 📡 <strong>Radar B2C</strong>: Visualize os chamados de entrega disponíveis para a sua cidade.</p>
        <p>2. Veja o valor líquido da corrida e o trajeto estimado antes de aceitar.</p>
        <p>3. Clique em <em>🗺️ Ver Rota no Mapa</em> para visualizar no mapa onde fica a loja (📍) e o cliente (🏁).</p>
        <p>4. Clique em <em>Aceitar Corrida</em> → Vá até a loja retirar o açaí.</p>
        <p>5. Desloque-se até o endereço do cliente informado no pedido.</p>
        <p>6. Na entrega, clique em <em>📍 Confirmar Chegada</em>.</p>
        <p>7. <strong>Peça o PIN de 4 dígitos ao cliente</strong> → Digite na tela → Clique <em>Validar e Finalizar</em>.</p>
        <p>8. ✅ PIN correto → Entrega concluída → Repasse do frete enviado automaticamente ao seu Pix.</p>
      </div>
      <div className="bg-amber-50 dark:bg-amber-950/40 p-3 rounded-xl border border-amber-200 dark:border-amber-800 text-xs">
        <p className="font-bold text-amber-900 dark:text-amber-300">🔐 Sobre o PIN de Segurança:</p>
        <p className="text-amber-700 dark:text-amber-300 mt-1">O PIN é gerado no momento da compra e enviado ao cliente. Ele é <strong>obrigatório</strong> para finalizar a entrega. Sem o PIN correto, o sistema não confirma a entrega e o repasse não é liberado. Isso protege o cliente e garante que você entregou ao destinatário certo.</p>
      </div>
      <div className="bg-zinc-50 dark:bg-zinc-950 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs">
        <p className="font-bold">💸 Saque Instantâneo:</p>
        <p className="mt-1">Clique em <em>💸 Saque Instantâneo Pix</em> para transferir seu saldo disponível imediatamente para seu banco externo (CPF, E-mail, Celular ou Chave Aleatória).</p>
      </div>
    </div>
  );
}

// ===================== CAMINHAO =====================
function ManualCaminhao() {
  return (
    <div className="space-y-3 text-sm animate-in fade-in duration-150">
      <h4 className="font-bold text-zinc-900 dark:text-white">🚛 Operação do Caminhoneiro (B2B & Coleta)</h4>
      <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs space-y-2">
        <p>1. 📡 <strong>Radar de Fretes</strong>: Visualize ordens disponíveis na sua cidade (Fretes B2B e Coleta de Caçamba).</p>
        <p>2. Veja o valor líquido do frete e o destino antes de aceitar.</p>
        <p>3. Clique em <em>🗺️ Ver Rota no Mapa</em> para visualizar onde buscar (fornecedor/batedeira) e onde entregar (batedeira/ecoponto).</p>
        <p>4. Clique em <em>Aceitar Frete</em> → Vá ao local de origem buscar a carga.</p>
        <p>5. Transporte e entregue no destino indicado.</p>
        <p>6. Clique em <em>Confirmar Chegada</em> → <strong>Solicite o PIN de 4 dígitos</strong> ao responsável no destino.</p>
        <p>7. Digite o PIN → <em>Validar e Finalizar</em> → Frete concluído → Repasse Pix enviado ao seu banco.</p>
      </div>
      <div className="bg-blue-50 dark:bg-blue-950/40 p-3 rounded-xl border border-blue-200 dark:border-blue-800 text-xs">
        <p className="font-bold text-blue-900 dark:text-blue-300">🚛 Tipos de Fretes Disponíveis:</p>
        <ul className="text-blue-700 dark:text-blue-300 mt-1 space-y-1">
          <li>• <strong>B2B</strong>: Transporte de lotes de açaí do Fornecedor para a Batedeira.</li>
          <li>• <strong>COLETA (Caçamba)</strong>: Remoção de caroços/resíduos da Batedeira para o Ecoponto.</li>
        </ul>
      </div>
      <div className="bg-zinc-50 dark:bg-zinc-950 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs">
        <p className="font-bold">💰 Recebimento:</p>
        <p className="mt-1">Vincule sua Chave Pix ou Carteira Asaas para receber os fretes diretamente no seu banco. Use <em>💸 Saque Instantâneo Pix</em> para receber imediatamente após as entregas.</p>
      </div>
    </div>
  );
}

// ===================== TELA DE LOGIN =====================
function ManualLogin() {
  const [tab, setTab] = useState<'como_funciona' | 'cadastro' | 'login'>('como_funciona');
  return (
    <div className="space-y-4 text-sm">
      <div className="flex gap-2 flex-wrap">
        {[['como_funciona','🥑 Como Funciona'], ['cadastro','📝 Como se Cadastrar'], ['login','🔑 Como Entrar']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k as any)}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs transition ${tab === k ? 'bg-purple-600 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-purple-100'}`}
          >{l}</button>
        ))}
      </div>

      {tab === 'como_funciona' && (
        <div className="space-y-3 animate-in fade-in duration-150">
          <h4 className="font-bold text-zinc-900 dark:text-white">🥑 O que é o AçaíFood?</h4>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">O AçaíFood é uma plataforma digital que conecta toda a cadeia do açaí na sua região.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="bg-purple-50 dark:bg-purple-950/30 p-3 rounded-xl border border-purple-200 dark:border-purple-800">
              <span className="font-bold block mb-1">👤 Para Consumidores</span>
              <p className="text-zinc-600 dark:text-zinc-400">Peça açaí fresquinho (Popular, Médio, Grosso) diretamente das batedeiras mais próximas com entrega por motoboy. Pague pelo Pix e acompanhe em tempo real.</p>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-950/30 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800">
              <span className="font-bold block mb-1">🏪 Para Batedeiras</span>
              <p className="text-zinc-600 dark:text-zinc-400">Receba pedidos automaticamente, gerencie seu cardápio, acione motoboys e receba repasses diretamente no seu Pix.</p>
            </div>
            <div className="bg-amber-50 dark:bg-amber-950/30 p-3 rounded-xl border border-amber-200 dark:border-amber-800">
              <span className="font-bold block mb-1">🛵 Para Motoboys</span>
              <p className="text-zinc-600 dark:text-zinc-400">Veja corridas disponíveis, aceite entregas e receba seu frete instantaneamente via Pix após confirmar a entrega com PIN.</p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-950/30 p-3 rounded-xl border border-blue-200 dark:border-blue-800">
              <span className="font-bold block mb-1">🚛 Para Fornecedores & Caminhoneiros</span>
              <p className="text-zinc-600 dark:text-zinc-400">Venda insumos B2B para batedeiras, transporte lotes de açaí e realize serviços de coleta de caroços. Tudo com pagamento automático via Pix.</p>
            </div>
          </div>
        </div>
      )}

      {tab === 'cadastro' && (
        <div className="space-y-3 animate-in fade-in duration-150">
          <h4 className="font-bold text-zinc-900 dark:text-white">📝 Como se Cadastrar no AçaíFood</h4>
          <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs space-y-2">
            <p>1. Clique em <strong>"Crie sua conta gratuitamente"</strong> abaixo do formulário de login, ou acesse <strong>/cadastro</strong>.</p>
            <p>2. Informe seu <strong>Nome completo, E-mail e Senha</strong> (mínimo 6 caracteres).</p>
            <p>3. Selecione o seu <strong>Perfil de Acesso</strong>:
              <br />• 👤 <em>Cliente</em>: Para fazer pedidos de açaí.
              <br />• 🏪 <em>Batedeira</em>: Para vender açaí.
              <br />• 🏭 <em>Fornecedor</em>: Para vender insumos em lote (B2B).
              <br />• 🛵 <em>Motoboy</em>: Para fazer entregas B2C.
              <br />• 🚛 <em>Caminhoneiro / Caçamba</em>: Para fretes B2B e coleta.
            </p>
            <p>4. Informe seu <strong>CPF/CNPJ</strong> (necessário para receber repasses Pix).</p>
            <p>5. Adicione seu <strong>endereço completo</strong> com cidade e bairro (usado para cálculo de distância e frete).</p>
            <p>6. Clique em <strong>Criar Conta</strong>. Uma subconta Asaas é criada automaticamente para parceiros com CPF/CNPJ.</p>
          </div>
          <div className="bg-blue-50 dark:bg-blue-950/40 p-3 rounded-xl border border-blue-200 dark:border-blue-800 text-xs">
            <p className="font-bold text-blue-900 dark:text-blue-300">💡 Dica:</p>
            <p className="text-blue-700 dark:text-blue-300 mt-1">Se você receber um SMS do Asaas após o cadastro, não se preocupe. Sua conta AçaíFood já está ativa e pronta para uso. O SMS é apenas a confirmação da criação da conta de pagamentos.</p>
          </div>
        </div>
      )}

      {tab === 'login' && (
        <div className="space-y-3 animate-in fade-in duration-150">
          <h4 className="font-bold text-zinc-900 dark:text-white">🔑 Como Fazer Login</h4>
          <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs space-y-2">
            <p>1. Informe o <strong>E-mail</strong> cadastrado no campo correspondente.</p>
            <p>2. Informe a <strong>Senha</strong> definida no cadastro.</p>
            <p>3. Clique em <strong>Entrar na Plataforma</strong>.</p>
            <p>4. O sistema identifica seu perfil e redireciona automaticamente para a tela correta:
              <br />• Admin → Painel do Administrador
              <br />• Batedeira → Painel da Batedeira
              <br />• Fornecedor → Painel do Fornecedor
              <br />• Motoboy → Painel do Motoboy
              <br />• Caminhoneiro → Painel de Fretes
              <br />• Cliente → Marketplace de Açaí
            </p>
          </div>
          <div className="bg-amber-50 dark:bg-amber-950/40 p-3 rounded-xl border border-amber-200 dark:border-amber-800 text-xs">
            <p className="font-bold text-amber-900 dark:text-amber-300">⚠️ Conta bloqueada?</p>
            <p className="text-amber-700 dark:text-amber-300 mt-1">Se sua conta foi bloqueada pelo administrador da plataforma, entre em contato com o suporte do AçaíFood.</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ===================== MAIN COMPONENT =====================
const config: Record<PartnerRole, { title: string; subtitle: string; color: string; Content: React.FC }> = {
  batedeira:   { title: '📖 Manual da Batedeira',      subtitle: 'Operação completa: vendas B2C, abastecimento B2B e financeiro', color: 'bg-purple-900', Content: ManualBatedeira },
  fornecedor:  { title: '📖 Manual do Fornecedor',     subtitle: 'Operação de vendas B2B e recebimento de repasses', color: 'bg-emerald-900', Content: ManualFornecedor },
  motoboy:     { title: '📖 Manual do Motoboy',        subtitle: 'Corridas B2C, PIN de segurança e saque Pix', color: 'bg-zinc-800', Content: ManualMotoboy },
  caminhao:    { title: '📖 Manual do Caminhoneiro',   subtitle: 'Fretes B2B, coleta de caçamba e saque Pix', color: 'bg-blue-900', Content: ManualCaminhao },
  login:       { title: '📖 Manual de Uso do AçaíFood',subtitle: 'Como funciona, como se cadastrar e como entrar', color: 'bg-zinc-900', Content: ManualLogin },
};

export function PartnerManualModal({ isOpen, onClose, role }: PartnerManualModalProps) {
  if (!isOpen) return null;
  const cfg = config[role];
  const { Content } = cfg;

  return (
    <div className="fixed inset-0 bg-black/75 z-[250] flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col border border-zinc-200 dark:border-zinc-800 overflow-hidden">

        {/* Header */}
        <div className={`${cfg.color} text-white p-4 sm:p-5 flex justify-between items-center shrink-0`}>
          <div className="flex items-center gap-3">
            <div className="bg-white/10 p-2 rounded-xl">
              <BookOpen className="w-5 h-5 text-white/90" />
            </div>
            <div>
              <h2 className="font-extrabold text-base sm:text-lg">{cfg.title}</h2>
              <p className="text-xs text-white/70">{cfg.subtitle}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition">
            <X size={22} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto text-zinc-700 dark:text-zinc-300">
          <Content />
        </div>

        {/* Footer */}
        <div className="p-4 bg-zinc-50 dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-zinc-800 hover:bg-black dark:bg-zinc-700 dark:hover:bg-zinc-600 text-white font-bold rounded-xl text-xs transition shadow-md active:scale-95"
          >
            Fechar Manual
          </button>
        </div>

      </div>
    </div>
  );
}
