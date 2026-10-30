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
  const [tab, setTab] = useState<'comprar' | 'complementos' | 'endereco' | 'pix' | 'rastreio_pin' | 'comprovante'>('comprar');

  return (
    <div className="space-y-4 text-sm">
      <div className="flex gap-2 flex-wrap">
        {[
          ['comprar', '🛒 Como Comprar'],
          ['complementos', '🍽️ Açaí & Complementos'],
          ['endereco', '📍 Endereço & GPS'],
          ['pix', '💳 Pix & Estorno'],
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
            <ShoppingBag size={16} className="text-purple-600" /> Passo a Passo de Compra no Marketplace
          </h4>
          <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs space-y-2.5">
            <p>1. 🏙️ <strong>Seleção de Cidade</strong>: O app exibe as batedeiras e lojas da sua cidade. Certifique-se de que sua praça/município está correto no topo da tela.</p>
            <p>2. 🔍 <strong>Busca & Filtros Inteligentes</strong>: Mesmo com centenas de lojas cadastradas, encontre rapidamente o que procura:</p>
            <ul className="pl-4 space-y-1 list-disc text-zinc-600 dark:text-zinc-400">
              <li><strong>📍 Mais Próximas</strong>: Ordena as batedeiras por proximidade GPS do seu local.</li>
              <li><strong>🟢 Abertas Agora</strong>: Mostra apenas estabelecimentos disponíveis no momento.</li>
              <li><strong>⚡ Frete Promocional</strong>: Lojas com taxa de entrega reduzida ou subsidiada pela casa.</li>
              <li><strong>🥣 Açaí Grosso / Branco / Menor Preço</strong>: Filtra na hora pelo padrão de polpa ou melhor valor.</li>
              <li><strong>🔎 Barra de Busca</strong>: Digite o nome da loja, bairro ou produto desejado.</li>
            </ul>
            <p>3. 🏪 <strong>Escolha a Loja</strong>: Toque em <em>"Ver Cardápio & Pedir"</em> para abrir a vitrine oficial do estabelecimento.</p>
            <p>4. 🛍️ <strong>Monte seu Pedido</strong>: Escolha seu açaí favorito, refeições, bebidas e adicionais.</p>
          </div>
          <div className="bg-purple-50 dark:bg-purple-950/40 p-3 rounded-xl border border-purple-200 dark:border-purple-800 text-xs">
            <p className="font-bold text-purple-900 dark:text-purple-300">💡 Dica de Economia:</p>
            <p className="text-purple-800 dark:text-purple-300 mt-1">Lojas com <strong>Frete Promocional / Subsidiado</strong> assumem parte ou 100% da taxa de entrega para você economizar no pedido!</p>
          </div>
        </div>
      )}

      {tab === 'complementos' && (
        <div className="space-y-3 animate-in fade-in duration-150">
          <h4 className="font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
            <ShoppingBag size={16} className="text-purple-600" /> Os 5 Tipos de Açaí & Complementos de Pratos
          </h4>

          {/* 5 Tipos de Açaí */}
          <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs space-y-2">
            <p className="font-bold text-purple-900 dark:text-purple-300 text-sm">🥣 Os 5 Tipos Oficiais de Açaí:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
              <div className="p-2.5 rounded-lg border border-purple-200 dark:border-purple-900/60 bg-purple-50/50 dark:bg-purple-950/30">
                <span className="font-bold text-purple-900 dark:text-purple-300">🍇 Açaí Popular (1L)</span>
                <p className="text-zinc-600 dark:text-zinc-400 text-[11px] mt-0.5">Leve, refrescante e acessível para o dia a dia.</p>
              </div>
              <div className="p-2.5 rounded-lg border border-purple-200 dark:border-purple-900/60 bg-purple-50/50 dark:bg-purple-950/30">
                <span className="font-bold text-purple-900 dark:text-purple-300">🍇 Açaí Médio (1L)</span>
                <p className="text-zinc-600 dark:text-zinc-400 text-[11px] mt-0.5">O clássico equilíbrio paraense. Textura padrão de alta aceitação.</p>
              </div>
              <div className="p-2.5 rounded-lg border border-purple-200 dark:border-purple-900/60 bg-purple-50/50 dark:bg-purple-950/30">
                <span className="font-bold text-purple-900 dark:text-purple-300">🍇 Açaí Grosso (1L)</span>
                <p className="text-zinc-600 dark:text-zinc-400 text-[11px] mt-0.5">Polpa densa, encorpada e super concentrada para quem ama açaí raiz.</p>
              </div>
              <div className="p-2.5 rounded-lg border border-purple-200 dark:border-purple-900/60 bg-purple-50/50 dark:bg-purple-950/30">
                <span className="font-bold text-purple-900 dark:text-purple-300">🥥 Açaí Branco (1L)</span>
                <p className="text-zinc-600 dark:text-zinc-400 text-[11px] mt-0.5">Raridade amazônica. Frutos verdes com sabor suave, fino e amanteigado.</p>
              </div>
              <div className="sm:col-span-2 p-2.5 rounded-lg border border-teal-200 dark:border-teal-900/60 bg-teal-50/60 dark:bg-teal-950/30">
                <span className="font-bold text-teal-800 dark:text-teal-300 flex items-center gap-1">❄️ Açaí Congelado para Viagem (1L)</span>
                <p className="text-zinc-600 dark:text-zinc-400 text-[11px] mt-0.5">
                  Especial para transporte e viagens de longa distância. Já embalado e ultra-congelado para chegar intacto e gelado ao seu destino final, sem necessitar de personalização.
                </p>
              </div>
            </div>
          </div>

          {/* Complementos e Pratos */}
          <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs space-y-2.5">
            <p className="font-bold text-zinc-900 dark:text-white text-sm">🍽️ Como Escolher Opções e Acompanhamentos de Pratos:</p>
            <p>Em pratos executivos, churrascos e refeições, os produtos exibem o selo <strong>🍽️ Opções</strong>. Ao clicar em <strong>🛒 + (Adicionar)</strong>, abre a janela <em>"Personalize seu Prato"</em>:</p>
            <div className="space-y-2 pl-2 border-l-2 border-purple-500">
              <p>🥩 <strong>1. Ponto da Carne</strong>: Selecione seu ponto preferido (<em>Ao ponto</em>, <em>Bem assado</em> ou <em>Mal passado</em>).</p>
              <p>🍚 <strong>2. Acompanhamentos</strong>: Marque os itens desejados respeitando o limite máximo configurado pela loja (ex: até 2 entre <em>Arroz branco</em>, <em>Baião de dois</em>, <em>Salada de maionese</em>, <em>Farofa crocante</em> ou <em>Vinagrete</em>).</p>
              <p>✍️ <strong>3. Observações Especiais</strong>: Escreva instruções pontuais para a cozinha (ex: <em>"sem cebola"</em>, <em>"vinagrete em potinho separado"</em>).</p>
            </div>
            <p className="text-zinc-600 dark:text-zinc-400 mt-1">
              Todas as escolhas aparecem detalhadas na sua sacola, no comprovante e saem impressas diretamente na comanda da cozinha do restaurante!
            </p>
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
            <p>2. 📱 <strong>Pague no seu Banco</strong>: Abra o aplicativo do seu banco, escolha Pix Copia e Cola, cole o código e confirme. O recebedor que aparece no banco é <strong>a própria loja</strong> que vendeu (conta Asaas da loja). A comissão do AçaíFood é separada automaticamente pelo Asaas no mesmo Pix.</p>
            <p>⏳ <strong>Validade</strong>: O Pix vale por 60 minutos. Se não for pago nesse prazo, o pedido é cancelado sozinho.</p>
            <p>3. ⏱️ <strong>Confirmação em Segundos</strong>: A validação ocorre em tempo real via Webhook Asaas e Supabase Realtime.</p>
            <p>4. ↩️ <strong>Garantia de Estorno Pix Automático (Refund)</strong>: Se a batedeira não puder atender ou se você cancelar antes do preparo, <strong>100% do valor é estornado pelo Asaas para a conta de onde saiu o Pix</strong>. Você pode cancelar até a loja iniciar o preparo; depois disso, fale com o suporte.</p>
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
            <div className="bg-amber-50 dark:bg-amber-950/40 p-3 rounded-xl border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-300 space-y-1.5">
              <p>• O <strong>PIN de 4 dígitos</strong> aparece em destaque no card do seu pedido.</p>
              <p>• <strong>IMPORTANTE:</strong> Somente dite o código PIN para o motoboy <strong>após receber o seu pedido em mãos</strong>.</p>
              <p>• A digitação desse PIN pelo motoboy no aplicativo dele é a comprovação de que a entrega foi concluída. É esse PIN que faz o app pagar a corrida ao motoboy. Se ditar antes de receber, você confirma uma entrega que não aconteceu.</p>
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
              <li>Selo e logomarca oficial do <strong>Asaas Gestão Financeira Instituição de Pagamento S.A.</strong></li>
              <li>ID da transação e o favorecido: a loja vendedora (conta Asaas da loja)</li>
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
  const [tab, setTab] = useState<'operacao' | 'cardapio' | 'impressao' | 'b2b' | 'financeiro'>('operacao');
  return (
    <div className="space-y-4 text-sm">
      <div className="flex gap-2 flex-wrap">
        {[
          ['operacao','📦 Operação B2C & Radar'],
          ['cardapio','🍽️ Cardápio & Opções de Pratos'],
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
            <p>4. 🏍️ <strong>Acionamento sob Demanda (Chamar Moto)</strong>: Quando o açaí e os pratos estiverem embalados e prontos, clique em <strong>"Chamar Moto"</strong>. O pedido entra no radar dos entregadores disponíveis da praça.</p>
            <p>5. 🗺️ <strong>Acompanhamento no Mapa</strong>: Visualize em tempo real o trajeto real do motoboy até sua loja e da loja até o cliente.</p>
            <p>6. 💬 <strong>Chat Integrado & Suporte</strong>: Comunique-se com o cliente/motoboy pelo chat do pedido ou acione o suporte central.</p>
            <p>7. ↩️ <strong>Cancelamento com Estorno</strong>: Você pode recusar ou cancelar até o pedido ficar pronto (antes da retirada). O Asaas devolve 100% ao cliente a partir da sua conta, e a comissão do app volta junto.</p>
          </div>
          <div className="bg-purple-50 dark:bg-purple-950/40 p-3 rounded-xl border border-purple-200 dark:border-purple-800 text-xs">
            <p className="font-bold text-purple-900 dark:text-purple-300">💡 Gestão de Frete Promocional:</p>
            <p className="text-purple-800 dark:text-purple-300 mt-1">Na aba <em>Cardápio & Preços</em>, configure o <strong>Subsídio de Frete</strong> (de 0% a 100%): a parte subsidiada sai do seu valor de venda para atrair mais clientes na sua região.</p>
          </div>
        </div>
      )}

      {tab === 'cardapio' && (
        <div className="space-y-3 animate-in fade-in duration-150">
          <h4 className="font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
            <Store size={16} className="text-purple-600" /> Cardápio dos 5 Açaís & Personalização de Pratos
          </h4>
          <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs space-y-3">
            <div>
              <p className="font-bold text-purple-900 dark:text-purple-300 text-sm">🥣 1. Tabela dos 5 Tipos Oficiais de Açaí (Por Litro):</p>
              <p className="text-zinc-600 dark:text-zinc-400 mt-1">
                Na aba <em>Cardápio & Preços</em>, você ativa/desativa com 1 clique e define o preço por litro (R$/L) dos 5 padrões:
              </p>
              <ul className="pl-4 mt-1.5 space-y-1 list-disc text-zinc-600 dark:text-zinc-400">
                <li><strong>Popular</strong>: Opção mais econômica e fluida.</li>
                <li><strong>Médio</strong>: O equilíbrio clássico do açaí paraense batido no dia.</li>
                <li><strong>Grosso</strong>: Polpa concentrada e de alta viscosidade.</li>
                <li><strong>Branco</strong>: Fruto verde especial de sabor amanteigado.</li>
                <li><strong>❄️ Congelado (P/ Viagem)</strong>: Tipo especial pronto e ultra-congelado para transporte de longa distância, sem necessidade de complementos.</li>
              </ul>
            </div>

            <div className="border-t border-zinc-200 dark:border-zinc-800 pt-3">
              <p className="font-bold text-purple-900 dark:text-purple-300 text-sm">🍽️ 2. Pratos Extras & Complementos (Churrasco, Carnes, Peixes):</p>
              <p className="text-zinc-600 dark:text-zinc-400 mt-1">
                Na seção <em>"📦 PRODUTOS EXTRAS & CARDÁPIO COMPLETO"</em>, cadastre suas refeições com complementos:
              </p>
              <div className="space-y-2 mt-2 pl-2 border-l-2 border-purple-500">
                <p>⚡ <strong>Atalho Modelo Churrasco</strong>: Ao clicar em <em>"⚡ Modelo Churrasco"</em> no modal de edição, o app já cria automaticamente:</p>
                <ul className="pl-4 space-y-0.5 list-disc text-zinc-500 dark:text-zinc-400">
                  <li><strong>Ponto da Carne</strong> (Obrigatório, Escolha 1): <em>Ao ponto, Bem assado, Mal passado</em>.</li>
                  <li><strong>Acompanhamentos</strong> (Opcional, Até 2 escolhas): <em>Arroz branco, Baião de dois, Salada de maionese, Vinagrete, Farofa crocante</em>.</li>
                </ul>
                <p>➕ <strong>Criação de Grupos Livres</strong>: Use o botão <em>"+ Grupo"</em> para criar opções exclusivas do seu restaurante, definindo:</p>
                <ul className="pl-4 space-y-0.5 list-disc text-zinc-500 dark:text-zinc-400">
                  <li>Se a seleção é obrigatória ou opcional.</li>
                  <li>Limite máximo de itens que o cliente pode marcar.</li>
                  <li>Preço adicional para cada opção (ex: + R$ 3,00) ou sem custo extra (+ R$ 0,00).</li>
                </ul>
                <p>🤖 <strong>Anexo Inteligente</strong>: Ao cadastrar um produto novo com nomes como "churrasco", "maminha" ou "picanha", o sistema já anexa o modelo de acompanhamentos para você economizar tempo!</p>
              </div>
            </div>
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
              <li>Itens detalhados com <strong>Ponto da Carne, Acompanhamentos e Observações da Cozinha</strong> com recuo especial</li>
              <li>Valor total pago via Pix dinâmico Asaas</li>
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
            <DollarSign size={16} className="text-purple-600" /> Recebimento Líquido, Subcontas Asaas & Saques Pix
          </h4>
          <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs space-y-2.5">
            <p>• <strong>Você recebe na hora do Pix</strong>: O cliente paga direto na <strong>sua conta Asaas</strong>. No mesmo Pix, o Asaas separa a comissão do AçaíFood (percentual sobre a venda e sobre o frete, definidos por cidade). Venda + frete ficam com você.</p>
            <p>• <strong>Valor reservado</strong>: Enquanto o pedido não é entregue, o valor fica <strong>reservado</strong> na sua conta (para um eventual estorno). Depois da entrega ele vira saldo livre.</p>
            <p>• <strong>Pagamento da corrida (automático)</strong>: Quando o motoboy digita o PIN do cliente, o app transfere o valor da corrida da sua conta para a conta dele. Você não precisa fazer nada. Corridas ainda não pagas também ficam reservadas.</p>
            <div className="bg-purple-50 dark:bg-purple-950/40 p-3 rounded-xl border border-purple-200 dark:border-purple-800 space-y-1.5">
              <p><strong>Exemplo:</strong> pedido de R$ 42,00 (venda R$ 36,00 + frete R$ 6,00). O Asaas separa a comissão do app, desconta a parte da tarifa Pix e o restante fica na sua conta. Após o PIN, a corrida vai para o motoboy. O que sobra é seu saldo livre para saque. Os valores de cada pedido aparecem no seu Financeiro.</p>
            </div>
            <p>• <strong>Saque</strong>: Peça o saque na aba Financeiro. Ele sai da sua conta Asaas por Pix para uma chave <strong>CPF ou CNPJ do mesmo titular</strong>. O administrador aprova (ou é automático, se ativado), e o saque só aparece como pago quando o Asaas confirma. A tarifa Pix do Asaas é descontada do valor enviado. Um saque por vez.</p>
            <p>• <strong>Valor Mínimo de Saque</strong>: O valor mínimo configurado na plataforma é de R$ 20,00.</p>
          </div>
          <div className="bg-amber-50 dark:bg-amber-950/40 p-3 rounded-xl border border-amber-200 dark:border-amber-800 text-xs space-y-1.5">
            <p className="font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
              🛡️ Mesma Titularidade Obrigatória (Resoluções BCB / Asaas):
            </p>
            <p className="text-amber-800 dark:text-amber-300">
              Conforme as <strong>Resoluções BCB nº 1/2020 e nº 80/2021 do Banco Central do Brasil</strong> e as normas de segurança do Asaas, todo saque é processado <strong>exclusivamente para a conta bancária do mesmo titular (mesmo CPF ou CNPJ)</strong> cadastrado na plataforma, impedindo qualquer desvio de valores.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ===================== FORNECEDOR =====================
function ManualFornecedor() {
  const [tab, setTab] = useState<'catalogo' | 'despacho' | 'impressao' | 'financeiro'>('catalogo');

  return (
    <div className="space-y-4 text-sm">
      <div className="flex gap-2 flex-wrap">
        {[
          ['catalogo', '📦 Sacas & Catálogo B2B'],
          ['despacho', '🚛 Despacho & Chamar Caminhão'],
          ['impressao', '🖨️ Romaneio & Impressão'],
          ['financeiro', '💰 Split Asaas & Saques Pix']
        ].map(([k, l]) => (
          <button
            key={k}
            onClick={() => setTab(k as any)}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs transition ${
              tab === k
                ? 'bg-emerald-600 text-white'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-emerald-100 dark:hover:bg-zinc-700'
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {tab === 'catalogo' && (
        <div className="space-y-3 animate-in fade-in duration-150">
          <h4 className="font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
            <Factory size={16} className="text-emerald-600" /> Catálogo Atacadista de Sacas & Frutos
          </h4>
          <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs space-y-2.5">
            <p>1. 📦 <strong>Tabela de Sacas e Lotes</strong>: Na aba <em>Catálogo & Preços</em>, configure os tipos de frutos colhidos (Padrão, Chumbinho, BRS Pará, etc.), definindo:</p>
            <ul className="pl-4 space-y-1 list-disc text-zinc-600 dark:text-zinc-400">
              <li>Preço por saca (60kg) ou por lata/paneiro.</li>
              <li>Quantidade em estoque disponível para venda imediata.</li>
              <li>Status de disponibilidade ativa ou pausada.</li>
            </ul>
            <p>2. 🌿 <strong>Produtos & Insumos Extras</strong>: Você também pode cadastrar sacarias extras, gelo, aditivos autorizados e embalagens para as batedeiras.</p>
          </div>
          <div className="bg-emerald-50 dark:bg-emerald-950/40 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800 text-xs space-y-1">
            <p className="font-bold text-emerald-900 dark:text-emerald-300">📌 Escopo do Fornecedor:</p>
            <p className="text-emerald-700 dark:text-emerald-300">O fornecedor atua exclusivamente na colheita e venda dos frutos frescos e <strong>não recebe caroços de volta</strong>. O caroço é recolhido por caçambas da batedeira para destinação ecológica.</p>
          </div>
        </div>
      )}

      {tab === 'despacho' && (
        <div className="space-y-3 animate-in fade-in duration-150">
          <h4 className="font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
            <Truck size={16} className="text-emerald-600" /> Pedidos B2B & Acionamento de Caminhão
          </h4>
          <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs space-y-2.5">
            <p>1. 🔔 <strong>Alerta de Ordem de Compra</strong>: Quando uma batedeira realiza o pagamento via Pix Asaas, seu painel avisa com sinal sonoro e a ordem entra com status <code>pago</code>.</p>
            <p>2. 📦 <strong>Separar o Lote</strong>: Faça a pesagem e amarração das sacas no armazém ou porto.</p>
            <p>3. 🚛 <strong>Chamar Caminhão</strong>: Clique em <strong>"Chamar Caminhão"</strong> para lançar o chamado no radar dos caminhoneiros pesados disponíveis na sua praça.</p>
            <p>4. 💬 <strong>Comunicação em Tempo Real</strong>: Use o chat integrado para alinhar portão de embarque e doca com o caminhoneiro.</p>
            <p>5. 🔑 <strong>Entrega Concluída com PIN</strong>: A batedeira confere as sacas na descarga e digita seu PIN de 4 dígitos. A entrega fecha no ato.</p>
          </div>
        </div>
      )}

      {tab === 'impressao' && (
        <div className="space-y-3 animate-in fade-in duration-150">
          <h4 className="font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
            <Printer size={16} className="text-emerald-600" /> Romaneio de Carga & Comanda Térmica
          </h4>
          <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs space-y-2">
            <p>1. 📄 <strong>Romaneio de Expedição</strong>: Imprima o cupom térmico (58mm/80mm) para entregar ao caminhoneiro no momento do carregamento.</p>
            <p>2. 📋 <strong>Dados Inclusos no Documento</strong>:</p>
            <ul className="pl-4 space-y-1 list-disc text-zinc-600 dark:text-zinc-400">
              <li>Dados do Fornecedor e da Batedeira Compradora (Endereço, Contato e Responsável).</li>
              <li>Quantidade exata de sacas, peso estimado e valor total pago via Pix.</li>
              <li>Instruções de rota e identificação oficial do processamento Asaas.</li>
            </ul>
          </div>
        </div>
      )}

      {tab === 'financeiro' && (
        <div className="space-y-3 animate-in fade-in duration-150">
          <h4 className="font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
            <DollarSign size={16} className="text-emerald-600" /> Split Asaas, PIN B2B & Saques Pix
          </h4>
          <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs space-y-2.5">
            <p>• <strong>Pix Direto na Conta</strong>: A batedeira compradora paga o Pix direto para a sua conta Asaas. A comissão da plataforma AçaíFood é retida no mesmo split automático.</p>
            <p>• <strong>Valor Reservado</strong>: O saldo fica reservado durante o transporte e se torna livre no momento em que a batedeira valida o PIN do caminhoneiro.</p>
            <p>• <strong>Pagamento do Frete Pesado</strong>: Logo após o PIN, o app transfere automaticamente o valor do frete para o caminhoneiro a partir da sua conta Asaas.</p>
            <p>• <strong>Saques por Pix</strong>: Solicite saques a qualquer momento para sua chave Pix (mesmo CPF ou CNPJ de cadastro, conforme normas do Banco Central).</p>
          </div>
        </div>
      )}
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
        <p>5. 🔐 <strong>Validação Obrigatória do PIN de 4 Dígitos</strong>: Peça o PIN ao cliente, digite na tela e confirme. Sem o PIN correto, a entrega não fecha e a corrida não é paga.</p>
      </div>
      <div className="bg-zinc-50 dark:bg-zinc-950 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs space-y-2">
        <p className="font-bold text-purple-900 dark:text-purple-300">💸 Como você recebe a corrida:</p>
        <p className="text-zinc-600 dark:text-zinc-400">
          • <strong>Autônomo:</strong> Você atende qualquer loja da sua cidade, sem contrato com a loja. Para aceitar corridas, sua conta Asaas precisa estar aprovada.
        </p>
        <p className="text-zinc-600 dark:text-zinc-400">
          • <strong>Pago após o PIN:</strong> Logo depois que você digita o PIN do cliente, o app transfere o valor da corrida <strong>da conta da loja para a sua conta Asaas</strong>. Se houver troca de motoboy antes da entrega, só quem finaliza recebe. O valor mostrado no radar já é o líquido (descontada a comissão do app sobre o frete e a sua parte da tarifa Pix, quando houver).
        </p>
        <p className="text-zinc-600 dark:text-zinc-400">
          • <strong>Saque:</strong> Peça na aba Financeiro. Sai da sua conta Asaas por Pix para chave CPF do próprio titular, com a tarifa Pix do Asaas descontada do valor enviado.
        </p>
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
      <div className="bg-blue-50 dark:bg-blue-950/40 p-3 rounded-xl border border-blue-200 dark:border-blue-800 text-xs space-y-2">
        <p className="font-bold text-blue-900 dark:text-blue-300">💰 Como você recebe o frete:</p>
        <p className="text-blue-700 dark:text-blue-300">
          • <strong>Frete B2B:</strong> após o PIN no destino, o app transfere o frete da conta Asaas do fornecedor para a sua conta Asaas.
        </p>
        <p className="text-blue-700 dark:text-blue-300">
          • <strong>Coleta (caçamba):</strong> a loja paga o frete à plataforma; após o PIN no destino, a plataforma transfere o valor para a sua conta Asaas.
        </p>
        <p className="text-blue-700 dark:text-blue-300">
          • <strong>Saque:</strong> sai da sua conta Asaas por Pix para chave CPF/CNPJ do mesmo titular, com a tarifa Pix do Asaas descontada.
        </p>
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
              <span className="font-bold block mb-1">🛒 1. Varejo B2C Completo</span>
              <p className="text-zinc-600 dark:text-zinc-400">Clientes compram os 5 tipos de açaí (incluindo Congelado para Viagem), refeições com complementos (churrascos ao ponto, acompanhamentos) e recebem com motoboy via GPS e validação de PIN.</p>
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
              <p className="text-zinc-600 dark:text-zinc-400">O cliente paga o Pix direto à loja, o Asaas separa a comissão do app (split), a corrida é paga ao entregador após o PIN e cada parceiro saca da própria conta Asaas.</p>
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
              <p>• Parceiros aceitam os Termos, o Mandato e o Consentimento Pix. Com isso, o app abre a sua <strong>conta Asaas em seu nome</strong> (subconta); envie os documentos pedidos pelo Asaas.</p>
              <p>• Lojas e fornecedores só recebem pedidos, e motoboys e caminhoneiros só aceitam corridas, com a conta Asaas <strong>aprovada</strong>.</p>
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
