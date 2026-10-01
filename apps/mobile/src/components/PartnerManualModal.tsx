"use client";

import React, { useState } from "react";
import { X, BookOpen, ShoppingBag, Store, Factory, Bike, Truck, ShieldCheck, MapPin, QrCode, MessageSquare, Printer, DollarSign, FileText, Headphones } from "lucide-react";

export type PartnerRole = 'batedeira' | 'fornecedor' | 'motoboy' | 'caminhao' | 'login';

interface PartnerManualModalProps {
  isOpen: boolean;
  onClose: () => void;
  role: PartnerRole;
}

// ===================== CLIENTE (CONSUMIDOR) =====================
function ManualCliente() {
  const [tab, setTab] = useState<'comprar' | 'endereco' | 'pix' | 'rastreio_pin' | 'comprovante'>('comprar');

  return (
    <div className="space-y-4 text-sm">
      <div className="flex gap-2 flex-wrap">
        {[
          ['comprar', '🛒 Como Fazer Pedidos'],
          ['endereco', '📍 Endereço & GPS'],
          ['pix', '💳 Pagamento Pix & Estorno'],
          ['rastreio_pin', '🔐 Rastreio, Chat & PIN'],
          ['comprovante', '📄 Comprovante & Suporte']
        ].map(([k, l]) => (
          <button
            key={k}
            onClick={() => setTab(k as any)}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs transition ${
              tab === k
                ? 'bg-purple-600 text-white'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-purple-100'
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {tab === 'comprar' && (
        <div className="space-y-3 animate-in fade-in duration-150">
          <h4 className="font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
            <ShoppingBag size={16} className="text-purple-600" /> Passo a Passo de Compra
          </h4>
          <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs space-y-2.5">
            <p>1. 🏙️ <strong>Seleção de Cidade</strong>: O app exibe as batedeiras e lojas da sua cidade. Certifique-se de que sua cidade está correta no topo da tela.</p>
            <p>2. 🏪 <strong>Escolha a Loja</strong>: Toque na batedeira de sua preferência para abrir o cardápio de açaí fresco e adicionais.</p>
            <p>3. 🥣 <strong>Personalize o Açaí</strong>: Escolha a consistência (<em>Popular, Médio, Grosso ou Branco</em>), quantidade e adicionais (tapioca, farinha d’água, leite condensado, frutas, churrasco, etc.).</p>
            <p>4. 🛍️ <strong>Sacola de Compras</strong>: Revise os itens, quantidades e o resumo de valores (subtotal + taxa de entrega).</p>
          </div>
          <div className="bg-purple-50 dark:bg-purple-950/40 p-3 rounded-xl border border-purple-200 dark:border-purple-800 text-xs">
            <p className="font-bold text-purple-900 dark:text-purple-300">💡 Dica de Economia:</p>
            <p className="text-purple-800 dark:text-purple-300 mt-1">Lojas com <strong>Frete Promocional / Subsidiado</strong> assumem parte ou 100% da taxa de entrega para você economizar no pedido!</p>
          </div>
        </div>
      )}

      {tab === 'endereco' && (
        <div className="space-y-3 animate-in fade-in duration-150">
          <h4 className="font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
            <MapPin size={16} className="text-purple-600" /> 3 Opções Flexíveis de Entrega
          </h4>
          <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs space-y-2.5">
            <p>No momento de fechar o pedido, escolha o modo mais conveniente para sua localização:</p>
            <div className="space-y-2 pl-1">
              <p>🏠 <strong>1. Endereço do Perfil</strong>: Utiliza o endereço cadastrado na sua conta com rua, número e bairro.</p>
              <p>🛰️ <strong>2. GPS ao Vivo (Localização Atual)</strong>: Captura suas coordenadas geográficas exatas com precisão métrica. Ideal para quando você estiver na casa de amigos ou na rua.</p>
              <p>📍 <strong>3. Ponto de Encontro com Referência</strong>: Ideal para entregas em portos, trapiches, praças ou feiras. Digite um ponto de referência claro (ex: <em>"Porto do Açaí, portão 2, perto do quiosque azul"</em>) para que o motoboy o encontre rapidamente.</p>
            </div>
          </div>
        </div>
      )}

      {tab === 'pix' && (
        <div className="space-y-3 animate-in fade-in duration-150">
          <h4 className="font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
            <QrCode size={16} className="text-purple-600" /> Pagamento Pix Instantâneo & Estorno
          </h4>
          <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs space-y-2.5">
            <p>1. ⚡ <strong>Aprovação Automática</strong>: Ao finalizar, o app gera o <strong>QR Code Pix</strong> e a chave <strong>Pix Copia e Cola</strong> oficial do Asaas.</p>
            <p>2. 📱 <strong>Pague no seu Banco</strong>: Abra o aplicativo do seu banco, escolha Pix Copia e Cola, cole o código e confirme. O recebedor formal é <strong>Eletromecânica Baia Ltda</strong> (empresa detentora da AçaíFood).</p>
            <p>3. ⏱️ <strong>Confirmação em Segundos</strong>: A validação ocorre em tempo real via Webhook Asaas e Supabase Realtime.</p>
            <p>4. ↩️ <strong>Garantia de Estorno Pix Automático (Refund)</strong>: Se a batedeira não puder atender ou se você cancelar antes do preparo, <strong>100% do valor é estornado automaticamente para a sua conta bancária</strong> via Pix em segundos.</p>
          </div>
        </div>
      )}

      {tab === 'rastreio_pin' && (
        <div className="space-y-3 animate-in fade-in duration-150">
          <h4 className="font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
            <ShieldCheck size={16} className="text-purple-600" /> Rastreamento, Chat e PIN de Segurança
          </h4>
          <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs space-y-2.5">
            <p>🗺️ <strong>Rastreamento em Tempo Real</strong>: Acompanhe no mapa interativo o trajeto real pelas ruas da cidade (linhas coloridas OSRM) e o motoboy em deslocamento ao vivo.</p>
            <p>💬 <strong>Chat Integrado no Pedido</strong>: Converse diretamente com a batedeira ou com o motoboy. Há também atalho direto para discar ou abrir WhatsApp.</p>
            <p className="font-bold text-purple-900 dark:text-purple-300">🔐 Regra de Ouro do PIN de 4 Dígitos:</p>
            <div className="bg-amber-50 dark:bg-amber-950/40 p-3 rounded-xl border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-300 space-y-1">
              <p>• O <strong>PIN de 4 dígitos</strong> aparece em destaque no card do seu pedido.</p>
              <p>• <strong>IMPORTANTE:</strong> Somente dite o código PIN para o motoboy <strong>após receber o seu pedido em mãos</strong>.</p>
              <p>• A digitação desse PIN pelo motoboy no aplicativo dele é a comprovação digital irrevogável de que a entrega foi concluída com sucesso.</p>
            </div>
          </div>
        </div>
      )}

      {tab === 'comprovante' && (
        <div className="space-y-3 animate-in fade-in duration-150">
          <h4 className="font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
            <FileText size={16} className="text-purple-600" /> Comprovante Oficial Asaas & Suporte ao Vivo
          </h4>
          <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs space-y-2.5">
            <p>📄 <strong>Comprovante com Logomarca Asaas</strong>: Em qualquer pedido pago ou histórico, clique no botão <strong>"📄 Comprovante Asaas"</strong> para abrir o documento oficial contendo:</p>
            <ul className="pl-4 space-y-1 list-disc text-zinc-600 dark:text-zinc-400">
              <li>Selo e logomarca oficial do <strong>Asaas IP S.A.</strong></li>
              <li>ID da transação bancária e dados fiscais da Eletromecânica Baia Ltda</li>
              <li>Detalhamento de produtos, frete, estabelecimento e data/hora</li>
              <li>Botão para <strong>Imprimir / Salvar em PDF</strong> ou cupom térmico</li>
            </ul>
            <p>🎧 <strong>Suporte em Tempo Real</strong>: Toque no botão flutuante de atendimento para abrir o <strong>Chat de Suporte ao Vivo</strong> com analistas e administradores da plataforma.</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ===================== BATEDEIRA =====================
function ManualBatedeira() {
  const [tab, setTab] = useState<'operacao' | 'impressao' | 'b2b' | 'financeiro'>('operacao');
  return (
    <div className="space-y-4 text-sm">
      <div className="flex gap-2 flex-wrap">
        {[
          ['operacao','📦 Operação B2C & Radar'],
          ['impressao','🖨️ Impressão Térmica & PIN Balcão'],
          ['b2b','🏭 Abastecimento B2B & Coleta'],
          ['financeiro','💰 Financeiro, Saques & Asaas']
        ].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k as any)}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs transition ${tab === k ? 'bg-purple-600 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-purple-100'}`}
          >{l}</button>
        ))}
      </div>

      {tab === 'operacao' && (
        <div className="space-y-3 animate-in fade-in duration-150">
          <h4 className="font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
            <Store size={16} className="text-purple-600" /> Operação de Vendas B2C & Fluxo do Radar
          </h4>
          <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs space-y-2.5">
            <p>1. 🔔 <strong>Chegada de Pedido</strong>: O pedido chega com status <strong>Pagamento Confirmado (Pix Pago)</strong> e emite aviso sonoro.</p>
            <p>2. 👨‍🍳 <strong>Aceitar e Preparar</strong>: Clique em <em>Aceitar e Preparar</em>. O pedido passa para o status <code>preparo</code>.</p>
            <p>3. 🔑 <strong>PIN de Balcão (Retirada Segura)</strong>: A comanda e o app geram o PIN de Balcão da loja. Ao entregar o pacote ao motoboy, confirme este código.</p>
            <p>4. 🏍️ <strong>Acionamento sob Demanda (Chamar Moto)</strong>: Quando o açaí estiver embalado e pronto, clique em <strong>"Chamar Moto"</strong>. O pedido entra no radar dos entregadores disponíveis.</p>
            <p>5. 🗺️ <strong>Acompanhamento no Mapa</strong>: Visualize em tempo real o trajeto real do motoboy até sua loja e da loja até o cliente.</p>
            <p>6. 💬 <strong>Chat Integrado & Suporte</strong>: Comunique-se com o cliente/motoboy pelo chat do pedido ou acione o suporte central.</p>
            <p>7. ↩️ <strong>Cancelamento com Estorno Pix Automático</strong>: Caso precise recusar antes do envio, o estorno de 100% é feito automaticamente pelo Asaas.</p>
          </div>
          <div className="bg-purple-50 dark:bg-purple-950/40 p-3 rounded-xl border border-purple-200 dark:border-purple-800 text-xs">
            <p className="font-bold text-purple-900 dark:text-purple-300">💡 Gestão da Vitrine & Frete Promocional:</p>
            <p className="text-purple-800 dark:text-purple-300 mt-1">Na aba <em>Visão Geral</em>, ajuste preços (Popular, Médio, Grosso, Branco), adicione produtos extras (carnes, frutas, bebidas) e configure o <strong>Subsídio de Frete</strong>.</p>
          </div>
        </div>
      )}

      {tab === 'impressao' && (
        <div className="space-y-3 animate-in fade-in duration-150">
          <h4 className="font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
            <Printer size={16} className="text-purple-600" /> Impressão Térmica de Comandas & PIN
          </h4>
          <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs space-y-2">
            <p>1. 🖨️ <strong>Conexão da Impressora</strong>: Suporte automático a impressoras térmicas padrão de <strong>58mm e 80mm</strong> (USB/Rede/Windows).</p>
            <p>2. 🔄 <strong>Modo de Disparo</strong>: Escolha entre <em>Impressão Automática</em> (ao aceitar o pedido) ou <em>Impressão Manual</em> pelo botão do card.</p>
            <p>3. 📄 <strong>Vias de Comanda</strong>: Imprima a <em>VIA 1 (Cozinha/Preparo)</em> e a <em>VIA 2 (Entrega/Motoboy)</em>.</p>
            <p>4. 📋 <strong>Elementos Oficiais no Cupom</strong>:</p>
            <ul className="pl-4 space-y-1 list-disc text-zinc-600 dark:text-zinc-400">
              <li>Nome do Cliente, Telefone e Endereço com Ponto de Referência</li>
              <li>Itens, adicionais e valor total pago via Pix</li>
              <li><strong>🔑 PIN DE RETIRADA (BALCÃO)</strong> em destaque no cupom</li>
              <li>Identificação oficial: <strong>[ PAGAMENTO PROCESSADO VIA ASAAS ]</strong></li>
            </ul>
          </div>
        </div>
      )}

      {tab === 'b2b' && (
        <div className="space-y-3 animate-in fade-in duration-150">
          <h4 className="font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
            <Factory size={16} className="text-purple-600" /> Abastecimento B2B e Coleta de Caroço
          </h4>
          <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs space-y-2">
            <p>1. Na aba <strong>🛒 Abastecimento B2B</strong>, visualize produtores e fornecedores da sua região.</p>
            <p>2. Escolha o lote (latas, sacas, paneiros de frutos) e pague com Pix dinâmico Asaas.</p>
            <p>3. O fornecedor prepara a carga e despacha um Caminhão para entrega.</p>
            <p>4. 🔑 <strong>PIN B2B</strong>: Na entrega das latas, confira o produto e forneça o seu <strong>PIN de 4 dígitos</strong> ao caminhoneiro para concluir o recebimento.</p>
          </div>
          <div className="bg-amber-50 dark:bg-amber-950/40 p-3 rounded-xl border border-amber-200 dark:border-amber-800 text-xs space-y-1">
            <p className="font-bold text-amber-900 dark:text-amber-300">🚛 Solicitação de Caçamba (Coleta de Caroço ESG):</p>
            <p className="text-amber-700 dark:text-amber-300">Solicite caçambas para descarte sustentável de caroços até os Ecopontos e Usinas credenciadas da cidade. O caroço vai para usinas de biomassa/adubo e <strong>não retorna ao produtor</strong>.</p>
          </div>
        </div>
      )}

      {tab === 'financeiro' && (
        <div className="space-y-3 animate-in fade-in duration-150">
          <h4 className="font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
            <DollarSign size={16} className="text-purple-600" /> Recebimento Líquido & Solicitação de Saques
          </h4>
          <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs space-y-2">
            <p>• <strong>Divisão Automática (Split)</strong>: A cada pedido entregue com PIN, o sistema calcula seu valor líquido: <code>Subtotal − Comissão (%) − Subsídio de Frete</code>.</p>
            <p>• <strong>Painel de Saques</strong>: Na aba Financeiro, acompanhe seu saldo disponível e envie <strong>Solicitações de Saque</strong> (valor mínimo padrão de R$ 20,00).</p>
            <p>• <strong>Aprovação & Auditoria</strong>: A equipe administrativa audita e aprova os saques para liquidação direta na sua conta bancária via Pix Asaas.</p>
          </div>
          <div className="bg-amber-50 dark:bg-amber-950/40 p-3 rounded-xl border border-amber-200 dark:border-amber-800 text-xs space-y-1.5">
            <p className="font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
              🛡️ Regra do Banco Central — Mesma Titularidade Obrigatória (Pix CPF/CNPJ):
            </p>
            <p className="text-amber-800 dark:text-amber-300">
              Conforme as <strong>Resoluções BCB nº 1/2020 e nº 80/2021 do Banco Central do Brasil</strong> e as normas de segurança do Asaas, todo saque é processado <strong>exclusivamente para a conta bancária do mesmo titular (mesmo CPF ou CNPJ)</strong> cadastrado na plataforma, impedindo desvio de valores.
            </p>
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
      <h4 className="font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
        <Factory size={16} className="text-emerald-600" /> Operação do Fornecedor de Frutos (B2B)
      </h4>
      <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs space-y-2.5">
        <p>1. 📦 <strong>Catálogo Atacadista</strong>: Configure preços por lata, paneiro ou saca, além de insumos adicionais.</p>
        <p>2. 🔔 <strong>Recebimento de Pedido B2B</strong>: Ao receber uma ordem de compra com Pix confirmado, separe o lote no armazém ou porto.</p>
        <p>3. 🚛 <strong>Despacho com "Chamar Caminhão"</strong>: Após a carga estar pronta, clique em <strong>"Chamar Caminhão"</strong> para que a rota apareça no radar dos caminhoneiros credenciados.</p>
        <p>4. 🖨️ <strong>Comanda de Saída B2B</strong>: Imprima o romaneio de expedição com dados completos da batedeira compradora e identificação Asaas.</p>
        <p>5. 💬 <strong>Chat do Transporte & Suporte</strong>: Comunique-se em tempo real com o motorista e a loja compradora.</p>
        <p>6. 🔐 <strong>Conclusão e PIN</strong>: O caminhoneiro valida a entrega no destino mediante o PIN fornecido pela batedeira, liberando seu repasse financeiro.</p>
      </div>
      <div className="bg-emerald-50 dark:bg-emerald-950/40 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800 text-xs space-y-1">
        <p className="font-bold text-emerald-900 dark:text-emerald-300">📌 Escopo do Fornecedor:</p>
        <p className="text-emerald-700 dark:text-emerald-300">O fornecedor atua exclusivamente na venda dos frutos frescos colhidos e <strong>não recebe caroços de volta</strong>.</p>
      </div>
      <div className="bg-zinc-50 dark:bg-zinc-950 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs space-y-1.5">
        <p className="font-bold">💰 Painel de Saques & Mesma Titularidade (BCB/Asaas):</p>
        <p className="text-zinc-600 dark:text-zinc-400">Solicite saques do seu saldo disponível (mínimo R$ 20,00). O valor é creditado unicamente na conta bancária do CPF/CNPJ cadastrado.</p>
      </div>
    </div>
  );
}

// ===================== MOTOBOY =====================
function ManualMotoboy() {
  return (
    <div className="space-y-3 text-sm animate-in fade-in duration-150">
      <h4 className="font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
        <Bike size={16} className="text-purple-600" /> Operação do Motoboy Urbano (B2C)
      </h4>
      <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs space-y-2.5">
        <p>1. 📡 <strong>Status Online & GPS</strong>: Marque como <em>Online</em> para transmitir seu posicionamento em tempo real e receber chamados da sua praça.</p>
        <p>2. 🏍️ <strong>Radar de Prontos</strong>: Você só recebe chamados de pedidos que a batedeira já preparou e acionou <em>"Chamar Moto"</em>, eliminando tempo de espera na loja.</p>
        <p>3. 👁️ <strong>Transparência de Ganhos</strong>: Veja o valor líquido do frete, a distância em km e o mapa da rota antes de aceitar.</p>
        <p>4. 🧭 <strong>Navegação GPS & Chegada</strong>:</p>
        <ul className="pl-4 space-y-1 list-disc text-zinc-600 dark:text-zinc-400">
          <li>Toque em <em>"🚀 GPS p/ Retirada"</em> para navegar até a loja.</li>
          <li>Ao chegar, clique em <em>"🏪 Confirmar Chegada na Loja"</em> e retire os pacotes.</li>
          <li>Toque em <em>"🏁 GPS p/ Cliente"</em> para navegar até o destino.</li>
          <li>Ao chegar ao cliente, clique em <em>"Confirmar Chegada no Cliente"</em>.</li>
        </ul>
        <p>5. 🔐 <strong>Validação Obrigatória do PIN de 4 Dígitos</strong>: Peça o PIN ao cliente, digite na tela e confirme. Sem o PIN correto, a entrega não fecha e o frete não é liberado.</p>
      </div>
      <div className="bg-zinc-50 dark:bg-zinc-950 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs space-y-1.5">
        <p className="font-bold">💸 Solicitação de Saques Pix (Regra Banco Central):</p>
        <p className="text-zinc-600 dark:text-zinc-400">Acompanhe seu saldo em tempo real na aba Financeiro e utilize o botão <em>Solicitar Saque</em> (mínimo R$ 20,00). O valor é transferido para sua conta bancária vinculada ao seu CPF cadastrado.</p>
      </div>
    </div>
  );
}

// ===================== CAMINHAO =====================
function ManualCaminhao() {
  return (
    <div className="space-y-3 text-sm animate-in fade-in duration-150">
      <h4 className="font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
        <Truck size={16} className="text-blue-600" /> Operação do Caminhoneiro (B2B & Coleta ESG)
      </h4>
      <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs space-y-2.5">
        <p>1. 📡 <strong>Ficar Online</strong>: Ative seu GPS para receber notificações de fretes pesados na sua região.</p>
        <p>2. 🚛 <strong>2 Modalidades no Radar</strong>:</p>
        <ul className="pl-4 space-y-1 list-disc text-zinc-600 dark:text-zinc-400">
          <li><strong>Frete B2B</strong>: Transporte de sacas, latas e paneiros do Fornecedor para a Batedeira (acionado via <em>Chamar Caminhão</em>).</li>
          <li><strong>Coleta de Resíduos (Caçamba)</strong>: Remoção de caroços da Batedeira para Ecopontos e Usinas.</li>
        </ul>
        <p>3. 🗺️ <strong>Rotas & Navegação</strong>: Visualize origem, destino, traçado pelas vias principais e valor líquido do frete.</p>
        <p>4. 🧭 <strong>Botões de GPS</strong>: Use os atalhos <em>"🚀 GPS p/ Retirada"</em> e <em>"🏁 GPS p/ Destino"</em> para abrir no Google Maps.</p>
        <p>5. 🔐 <strong>PIN de Conclusão</strong>: Ao descarregar, solicite o PIN de 4 dígitos ao responsável no destino (loja ou ecoponto) e valide na tela.</p>
      </div>
      <div className="bg-blue-50 dark:bg-blue-950/40 p-3 rounded-xl border border-blue-200 dark:border-blue-800 text-xs space-y-1.5">
        <p className="font-bold text-blue-900 dark:text-blue-300">💰 Repasses & Solicitação de Saque (Regra Banco Central):</p>
        <p className="text-blue-700 dark:text-blue-300">Solicite saques do seu saldo acumulado diretamente no painel. O repasse é efetuado na conta bancária vinculada ao CPF/CNPJ de mesma titularidade.</p>
      </div>
    </div>
  );
}

// ===================== TELA DE LOGIN / CADASTRO / GERAL =====================
function ManualLogin() {
  const [tab, setTab] = useState<'cliente' | 'como_funciona' | 'cadastro' | 'login'>('cliente');
  return (
    <div className="space-y-4 text-sm">
      <div className="flex gap-2 flex-wrap">
        {[
          ['cliente', '🛒 Sou Cliente (Como Comprar)'],
          ['como_funciona', '🥑 Visão do Ecossistema'],
          ['cadastro', '📝 Cadastro & Perfis'],
          ['login', '🔑 Como Entrar']
        ].map(([k, l]) => (
          <button
            key={k}
            onClick={() => setTab(k as any)}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs transition ${
              tab === k
                ? 'bg-purple-600 text-white'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-purple-100'
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {tab === 'cliente' && <ManualCliente />}

      {tab === 'como_funciona' && (
        <div className="space-y-3 animate-in fade-in duration-150">
          <h4 className="font-bold text-zinc-900 dark:text-white">🥑 O que é a Rede AçaíFood?</h4>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">Plataforma multisserviço integrada que conecta o consumidor, as batedeiras de açaí, os produtores atacadistas, a logística urbana/pesada e a sustentabilidade ecológica no Brasil.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="bg-purple-50 dark:bg-purple-950/30 p-3 rounded-xl border border-purple-200 dark:border-purple-800">
              <span className="font-bold block mb-1">🛒 1. Varejo B2C</span>
              <p className="text-zinc-600 dark:text-zinc-400">Clientes compram açaí fresco direto das batedeiras locais com entrega ágil via Motoboys e segurança de PIN.</p>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-950/30 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800">
              <span className="font-bold block mb-1">🏭 2. Atacado B2B</span>
              <p className="text-zinc-600 dark:text-zinc-400">Batedeiras compram paneiros e sacas de frutos direto dos Fornecedores com frete pesado via Caminhão.</p>
            </div>
            <div className="bg-amber-50 dark:bg-amber-950/30 p-3 rounded-xl border border-amber-200 dark:border-amber-800">
              <span className="font-bold block mb-1">🚛 3. Logística Reversa ESG</span>
              <p className="text-zinc-600 dark:text-zinc-400">Coleta e descarte sustentável de caroços transportados por caçambas até os Ecopontos credenciados.</p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-950/30 p-3 rounded-xl border border-blue-200 dark:border-blue-800">
              <span className="font-bold block mb-1">💳 4. Motor Financeiro Asaas</span>
              <p className="text-zinc-600 dark:text-zinc-400">Pagamentos Pix com aprovação instantânea, divisão automática (Triple Split), comprovantes oficiais e esteira de saques.</p>
            </div>
          </div>
        </div>
      )}

      {tab === 'cadastro' && (
        <div className="space-y-3 animate-in fade-in duration-150">
          <h4 className="font-bold text-zinc-900 dark:text-white">📝 Como se Cadastrar</h4>
          <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs space-y-2">
            <p>1. Acesse <strong>/cadastro</strong> ou clique em <em>"Crie sua conta gratuitamente"</em>.</p>
            <p>2. Preencha seu <strong>Nome, E-mail, Senha e Telefone com DDD</strong>.</p>
            <p>3. Selecione o seu <strong>Perfil de Atuação</strong>:
              <br />• 👤 <strong>Cliente</strong>: Para pedir açaí.
              <br />• 🏪 <strong>Batedeira</strong>: Para vender açaí e comprar insumos.
              <br />• 🏭 <strong>Fornecedor</strong>: Para vender açaí em grande escala no atacado.
              <br />• 🛵 <strong>Motoboy</strong>: Para fazer entregas urbanas B2C.
              <br />• 🚛 <strong>Caminhoneiro / Caçamba</strong>: Para fretes B2B e coleta de resíduos.
            </p>
            <p>4. Informe seu <strong>CPF ou CNPJ do Titular (Chave Pix Obrigatória)</strong>.</p>
            <div className="bg-amber-50 dark:bg-amber-950/40 p-3 rounded-xl border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-300 space-y-1">
              <p className="font-bold flex items-center gap-1">🛡️ Regra de Segurança do Banco Central (Resolução BCB):</p>
              <p className="text-[11px] leading-relaxed">
                Por determinação legal do <strong>Banco Central do Brasil</strong> e conformidade com o <strong>Asaas</strong>, a conta bancária para recebimento e o cadastro no aplicativo <strong>devem pertencer obrigatoriamente à mesma titularidade (mesmo CPF ou CNPJ)</strong>.
              </p>
            </div>
            <p>5. Complete o endereço com <strong>Cidade e Bairro</strong> para cálculo territorial correto.</p>
            <div className="bg-purple-50 dark:bg-purple-950/40 p-3 rounded-xl border border-purple-200 dark:border-purple-800 text-purple-900 dark:text-purple-300 mt-2 space-y-1">
              <p className="font-bold">🛡️ Ativação Inteligente Asaas:</p>
              <p>• Contas contam com ativação conforme limite de vagas de fundadores liberadas pela administração.</p>
              <p>• A subconta digital Asaas para split de pagamentos é conectada <strong>automaticamente assim que você concluir sua 1ª venda ou corrida</strong>.</p>
            </div>
          </div>
        </div>
      )}

      {tab === 'login' && (
        <div className="space-y-3 animate-in fade-in duration-150">
          <h4 className="font-bold text-zinc-900 dark:text-white">🔑 Como Fazer Login</h4>
          <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs space-y-2">
            <p>1. Digite o <strong>E-mail</strong> cadastrado.</p>
            <p>2. Digite sua <strong>Senha</strong> secreta.</p>
            <p>3. Clique em <strong>Entrar na Plataforma</strong>.</p>
            <p>4. O sistema reconhece seu perfil e direciona automaticamente para o seu painel de operação.</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ===================== CONFIGURAÇÃO DOS MODAIS =====================
const config: Record<PartnerRole, { title: string; subtitle: string; color: string; Content: React.FC }> = {
  batedeira:   { title: '📖 Manual da Batedeira (Loja)', subtitle: 'Operação de vendas B2C, acionamento de motoboy e financeiro', color: 'bg-purple-900', Content: ManualBatedeira },
  fornecedor:  { title: '📖 Manual do Fornecedor (B2B)', subtitle: 'Vendas atacadistas, despacho de caminhões e repasses', color: 'bg-emerald-900', Content: ManualFornecedor },
  motoboy:     { title: '📖 Manual do Motoboy Urbano', subtitle: 'Radar de corridas sob demanda, rotas OSRM e PIN de entrega', color: 'bg-zinc-800', Content: ManualMotoboy },
  caminhao:    { title: '📖 Manual do Caminhoneiro', subtitle: 'Fretes atacadistas B2B, caçambas de resíduos e saque Pix', color: 'bg-blue-900', Content: ManualCaminhao },
  login:       { title: '📖 Guia do Usuário & Manual AçaíFood', subtitle: 'Guia completo para clientes, lojas, fornecedores e transportadores', color: 'bg-zinc-900', Content: ManualLogin },
};

export function PartnerManualModal({ isOpen, onClose, role }: PartnerManualModalProps) {
  if (!isOpen) return null;
  const cfg = config[role] || config.login;
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
            className="px-6 py-2.5 bg-zinc-800 hover:bg-black dark:bg-zinc-700 dark:hover:bg-zinc-600 text-white font-bold rounded-xl text-xs transition shadow-md active:scale-95"
          >
            Fechar Manual
          </button>
        </div>

      </div>
    </div>
  );
}
