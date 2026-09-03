import { Order, User } from '@/store/useAppStore';
import { supabase } from '@/lib/supabase';

export type PrintType = 'PREPARO' | 'ENTREGA' | 'ENTREGA_ATUALIZADO';
export type PrintTrigger = 'SYSTEM' | 'MANUAL';

export interface PrinterConfig {
  paperWidth: '58mm' | '80mm';
  printMode: 'manual' | 'auto'; // 'manual' = botão sob demanda, 'auto' = impressão automática em transições de status
  copies: 1 | 2;
  enabled: boolean;
}

export const DEFAULT_PRINTER_CONFIG: PrinterConfig = {
  paperWidth: '80mm',
  printMode: 'auto',
  copies: 1,
  enabled: true,
};

export function getPrinterConfig(): PrinterConfig {
  if (typeof window === 'undefined') return DEFAULT_PRINTER_CONFIG;
  try {
    const saved = localStorage.getItem('acaifood_printer_config');
    if (saved) {
      return { ...DEFAULT_PRINTER_CONFIG, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.error('Erro ao carregar configurações de impressora:', e);
  }
  return DEFAULT_PRINTER_CONFIG;
}

export function savePrinterConfig(config: PrinterConfig): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('acaifood_printer_config', JSON.stringify(config));
  } catch (e) {
    console.error('Erro ao salvar configurações de impressora:', e);
  }
}

/**
 * Registra o log de impressão no Supabase para fins de auditoria
 */
export async function logPrintAudit(orderId: string, printType: PrintType, triggeredBy: PrintTrigger, success: boolean = true) {
  try {
    if (!orderId || orderId.startsWith('TEST-') || orderId.startsWith('PED-')) return;
    await supabase.rpc('log_order_print', {
      p_order_id: orderId,
      p_print_type: printType,
      p_triggered_by: triggeredBy,
      p_success: success
    });
  } catch (err) {
    console.warn("Aviso ao registrar log de impressão:", err);
  }
}

export function generateSingleTicketHTML(
  order: Order,
  storeName: string = 'Loja/Batedeira AçaíFood',
  paperWidth: '58mm' | '80mm' = '80mm',
  viaNumber: number = 1,
  totalVias: number = 1,
  allUsers?: Record<string, User> | null,
  clientUser?: User | null,
  printType: PrintType = 'PREPARO'
): string {
  const is58 = paperWidth === '58mm';
  const widthPx = is58 ? '48mm' : '72mm';
  const fontSize = is58 ? '11px' : '13px';

  const orderNum = order.id.slice(-6).toUpperCase();
  const dateStr = order.createdAt
    ? new Date(order.createdAt).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : new Date().toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });

  const isB2B = order.type === 'B2B';
  const isColeta = order.type === 'COLETA';

  // Itens e Cálculo do Subtotal dos Produtos
  const itemsList = order.items && order.items.length > 0
    ? order.items
    : order.title
    ? [{ id: '1', name: `${order.title} (x${order.quantity || 1})`, quantity: order.quantity || 1, price: (order as any).products_subtotal ? (Number((order as any).products_subtotal) / (order.quantity || 1)) : (order.valor || 0) }]
    : [{ id: '1', name: 'Pedido Açaí', quantity: 1, price: (order as any).products_subtotal || order.valor || 0 }];

  // 1. Subtotal exato dos itens
  let itemsSubtotal = itemsList.reduce((acc, i) => acc + (Number(i.price || 0) * Number(i.quantity || 1)), 0);
  if (itemsSubtotal === 0 && (order as any).products_subtotal) {
    itemsSubtotal = Number((order as any).products_subtotal);
  }
  if (itemsSubtotal === 0 && order.valor) {
    itemsSubtotal = Number(order.valor);
  }

  // 2. Taxa de Entrega / Frete
  const deliveryFee = Number(
    order.taxas?.entregaCliente ?? 
    (order as any).total_delivery_fee ?? 
    order.taxas?.entregaTotal ?? 
    (order.taxas as any)?.frete ?? 
    0
  );

  // 3. Soma Total do Pedido: Produtos + Frete
  const totalCalculado = itemsSubtotal + deliveryFee;
  const totalFinal = (order as any).total_amount ? Number((order as any).total_amount) : totalCalculado;

  const formattedItemsSubtotal = itemsSubtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const formattedDeliveryFee = deliveryFee.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const formattedTotal = totalFinal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  // Resolução do comprador (Loja/Batedeira no B2B, Cliente no B2C)
  const buyerUser = clientUser 
    || (allUsers && (order as any).buyerId ? allUsers[(order as any).buyerId] : undefined)
    || (allUsers && isB2B && order.lojaId ? allUsers[order.lojaId] : undefined)
    || (allUsers && order.clienteId ? allUsers[order.clienteId] : undefined) 
    || (allUsers && order.destinoId ? allUsers[order.destinoId] : undefined) 
    || (allUsers && order.criadoPor ? allUsers[order.criadoPor] : undefined);

  const buyerName = order.clienteNome 
    || buyerUser?.name 
    || (isB2B ? (order.lojaNome || 'Loja/Batedeira Açaí') : 'Cliente AçaíFood');

  const buyerPhone = order.clienteTelefone 
    || buyerUser?.telefone 
    || (buyerUser as any)?.phone 
    || buyerUser?.email 
    || 'Não Informado';

  const buyerAddress = order.deliveryAddress 
    || buyerUser?.endereco 
    || (buyerUser?.bairro ? `${buyerUser.bairro}, ${buyerUser.cidade || 'Belém'}` : '') 
    || 'Retirada no Balcão / Entrega Local';

  const deliveryRef = order.deliveryReference || (buyerUser as any)?.referencia || '';

  // Resolução do Motoboy / Condutor
  const driverUser = order.motoristaId && allUsers ? allUsers[order.motoristaId] : null;
  const driverName = order.motoristaNome || driverUser?.name || (order.motoristaId ? `Entregador #${order.motoristaId.substring(0, 5)}` : null);
  const driverPhone = driverUser?.telefone || (driverUser as any)?.phone || 'Disponível no App';

  let motoboyStatusLabel = 'Aguardando aceite';
  if (printType === 'ENTREGA' && !driverName) {
    motoboyStatusLabel = 'Aguardando motoboy';
  } else if (driverName) {
    motoboyStatusLabel = `${driverName} (${driverPhone})`;
  }

  // Título da Via conforme o Tipo de Cupom (Regras Parte A e B)
  let ticketHeaderTitle = '*** CUPOM DE PREPARO ***';
  if (printType === 'ENTREGA') {
    ticketHeaderTitle = '*** CUPOM DE ENTREGA ***';
  } else if (printType === 'ENTREGA_ATUALIZADO') {
    ticketHeaderTitle = '*** CUPOM DE ENTREGA (MOTOBOY ATRIBUÍDO) ***';
  }

  if (totalVias > 1) {
    ticketHeaderTitle = viaNumber === 1 
      ? `*** VIA 1: PREPARO / COZINHA (${ticketHeaderTitle.replace(/\*/g, '').trim()}) ***`
      : `*** VIA 2: ENTREGA / MOTOBOY (${ticketHeaderTitle.replace(/\*/g, '').trim()}) ***`;
  }

  return `
    <div class="thermal-ticket" style="
      width: ${widthPx};
      font-family: 'Courier New', Courier, monospace;
      font-size: ${fontSize};
      line-height: 1.25;
      color: #000;
      background: #fff;
      padding: 4px;
      margin: 0 auto;
      text-align: left;
      box-sizing: border-box;
    ">
      <!-- CABEÇALHO -->
      <div style="text-align: center; border-bottom: 2px dashed #000; padding-bottom: 6px; margin-bottom: 6px;">
        <h2 style="margin: 0; font-size: ${is58 ? '14px' : '16px'}; font-weight: bold; text-transform: uppercase;">AÇAÍFOOD DELIVERY</h2>
        <p style="margin: 2px 0 0 0; font-size: ${is58 ? '10px' : '11px'}; font-weight: bold;">${storeName}</p>
        <p style="margin: 4px 0 0 0; font-weight: bold; font-size: ${is58 ? '11px' : '12px'};">${ticketHeaderTitle}</p>
      </div>

      <!-- DETALHES DO PEDIDO -->
      <div style="border-bottom: 1px dashed #000; padding-bottom: 6px; margin-bottom: 6px;">
        <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: ${is58 ? '12px' : '14px'};">
          <span>PEDIDO: #${orderNum}</span>
          <span>${order.type || 'B2C'}</span>
        </div>
        <div style="font-size: ${is58 ? '10px' : '11px'}; margin-top: 2px;">📅 Data/Hora: ${dateStr}</div>
        <div style="font-size: ${is58 ? '10px' : '11px'}; font-weight: bold; margin-top: 2px;">
          Status: ${(order.status || '').toUpperCase()}
        </div>
        <div style="font-size: ${is58 ? '10px' : '11px'}; margin-top: 2px; font-weight: bold; color: #111;">
          🛵 Motoboy: ${motoboyStatusLabel}
        </div>
        ${order.distancia ? `
          <div style="font-size: ${is58 ? '9px' : '10px'}; margin-top: 2px;">📏 Distância Estimada: ${order.distancia.toFixed(1)} km</div>
        ` : ''}
      </div>

      <!-- CLIENTE & DADOS DE ENTREGA -->
      <div style="border-bottom: 1px dashed #000; padding-bottom: 6px; margin-bottom: 6px;">
        <div style="font-weight: bold; font-size: ${is58 ? '11px' : '12px'}; text-decoration: underline; margin-bottom: 4px; text-transform: uppercase;">
          --- DADOS DO CLIENTE ---
        </div>
        <div style="font-weight: bold; font-size: ${is58 ? '11px' : '13px'}; margin-top: 2px;">
          👤 NOME: ${buyerName}
        </div>
        <div style="font-size: ${is58 ? '11px' : '12px'}; font-weight: bold; margin-top: 3px;">
          📞 TEL: ${buyerPhone}
        </div>
        <div style="font-size: ${is58 ? '10px' : '11px'}; margin-top: 3px; font-weight: bold;">
          📍 ENDEREÇO: ${buyerAddress}
        </div>
        ${deliveryRef ? `
          <div style="font-size: ${is58 ? '9px' : '10px'}; font-style: italic; margin-top: 2px;">
            🏢 REF: ${deliveryRef}
          </div>
        ` : ''}
      </div>

      <!-- ITENS / PRODUTOS -->
      <div style="border-bottom: 2px dashed #000; padding-bottom: 6px; margin-bottom: 6px;">
        <div style="font-weight: bold; text-decoration: underline; margin-bottom: 4px; font-size: ${is58 ? '10px' : '12px'};">--- ITENS DO PEDIDO ---</div>
        <table style="width: 100%; border-collapse: collapse; font-size: ${is58 ? '10px' : '12px'};">
          <thead>
            <tr style="border-bottom: 1px solid #000; text-align: left;">
              <th style="padding: 2px 0;">Qtd</th>
              <th style="padding: 2px 0;">Item</th>
              <th style="padding: 2px 0; text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsList.map(item => `
              <tr style="vertical-align: top;">
                <td style="padding: 3px 0; font-weight: bold; width: 15%;">${item.quantity}x</td>
                <td style="padding: 3px 0; font-weight: bold; width: 60%;">${item.name}</td>
                <td style="padding: 3px 0; text-align: right; width: 25%;">R$ ${(item.price * item.quantity).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- TOTAL & PAGAMENTO -->
      <div style="border-bottom: 1px dashed #000; padding-bottom: 6px; margin-bottom: 6px;">
        <div style="display: flex; justify-content: space-between; font-size: ${is58 ? '10px' : '12px'}; margin-bottom: 2px;">
          <span>Subtotal Produtos:</span>
          <span style="font-weight: bold;">${formattedItemsSubtotal}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: ${is58 ? '10px' : '12px'}; margin-bottom: 2px;">
          <span>Frete / Entrega:</span>
          <span style="font-weight: bold;">${deliveryFee > 0 ? formattedDeliveryFee : 'R$ 0,00 (Grátis)'}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: ${is58 ? '12px' : '14px'}; border-top: 1px dashed #000; padding-top: 4px; margin-top: 4px;">
          <span>TOTAL DO PEDIDO:</span>
          <span>${formattedTotal}</span>
        </div>
        <div style="font-size: ${is58 ? '10px' : '11px'}; font-weight: bold; margin-top: 4px; text-align: right; color: #000;">
          💳 Pagamento: PIX (Confirmado ✅)
        </div>
      </div>

      <!-- RODAPÉ -->
      <div style="text-align: center; font-size: ${is58 ? '9px' : '10px'}; padding-top: 4px;">
        <p style="margin: 0; font-weight: bold;">--- AçaíFood Delivery Oficial ---</p>
        <p style="margin: 2px 0 0 0;">www.acaifood.app.br</p>
        <br />
        <p style="margin: 0; font-size: 8px;">.</p>
      </div>
    </div>
  `;
}

export function printOrderTicket(
  order: Order,
  storeName: string = 'Loja/Batedeira AçaíFood',
  customConfig?: PrinterConfig,
  allUsers?: Record<string, User> | null,
  clientUser?: User | null,
  printType: PrintType = 'PREPARO',
  triggeredBy: PrintTrigger = 'MANUAL'
): void {
  if (typeof window === 'undefined') return;

  const config = customConfig || getPrinterConfig();
  if (!config.enabled) return;

  const copies = Math.max(1, Math.min(2, config.copies || 1));

  let container = document.getElementById('thermal-print-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'thermal-print-container';
    document.body.appendChild(container);
  }

  let fullHTML = '';
  for (let via = 1; via <= copies; via++) {
    fullHTML += generateSingleTicketHTML(order, storeName, config.paperWidth, via, copies, allUsers, clientUser, printType);
    if (via < copies) {
      fullHTML += `<div style="page-break-after: always; height: 15px; border-bottom: 2px dashed #000; margin: 15px 0;"></div>`;
    }
  }

  container.innerHTML = fullHTML;

  // Registrar auditoria no Supabase sem bloquear a impressão
  logPrintAudit(order.id, printType, triggeredBy, true);

  setTimeout(() => {
    try {
      window.print();
    } catch (e) {
      console.error('Erro ao disparar impressão:', e);
      logPrintAudit(order.id, printType, triggeredBy, false);
    }
  }, 150);
}

export function printTestTicket(
  storeName: string = 'Loja/Batedeira AçaíFood',
  config?: PrinterConfig
): void {
  const testOrder: Order = {
    id: `TEST-${Math.floor(1000 + Math.random() * 9000)}`,
    type: 'B2C',
    title: 'Açaí 500ml Grosso Especial',
    quantity: 2,
    items: [
      { id: '1', name: 'Açaí Grosso 500ml', quantity: 2, price: 25.00 },
      { id: '2', name: 'Adicional: Leite em Pó', quantity: 2, price: 3.00 },
      { id: '3', name: 'Adicional: Bananas fatiadas', quantity: 1, price: 2.00 }
    ],
    status: 'PREPARING' as any,
    criadoPor: 'cliente_teste',
    origemId: 'loja_teste',
    destinoId: 'cliente_teste',
    distancia: 2.5,
    confirmacao: { entregador: false, recebedor: false },
    motoristaId: null,
    valor: 58.00,
    taxas: {
      entregaTotal: 5.00,
      entregaMotorista: 4.00,
      entregaCliente: 5.00,
      entregaLoja: 0,
      entregaFornecedor: 0,
      plataformaVenda: 2.00,
      plataformaEntrega: 1.00,
      plataformaTotal: 3.00,
      repasse: 53.00
    },
    createdAt: new Date().toISOString(),
    deliveryPin: '4829',
    deliveryAddress: 'Av. Nazaré, 1050 - Apt 302, Belém/PA',
    deliveryReference: 'Próximo à Basílica de Nazaré',
    clienteNome: 'Gabriel (Teste Impressora)',
    clienteTelefone: '(91) 98877-6655',
    lojaNome: storeName
  };

  printOrderTicket(testOrder, storeName, config, null, null, 'PREPARO', 'MANUAL');
}
