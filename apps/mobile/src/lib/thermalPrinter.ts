import { Order, User } from '@/store/useAppStore';
import { supabase } from '@/lib/supabase';
import { 
  isBluetoothPrinterConnected, 
  printOrderBluetooth, 
  printTestTicketBluetooth,
  buildOrderEscPosBuffer,
  sendViaRawBT,
  EscPosFormattingOptions,
  autoReconnectBluetoothPrinter,
  getConnectedBluetoothDeviceName,
  connectBluetoothPrinter,
  disconnectBluetoothPrinter,
  subscribeBluetoothStatus,
  isWebBluetoothSupported
} from '@/lib/bluetoothPrinter';

export {
  autoReconnectBluetoothPrinter,
  isBluetoothPrinterConnected,
  getConnectedBluetoothDeviceName,
  connectBluetoothPrinter,
  disconnectBluetoothPrinter,
  subscribeBluetoothStatus,
  isWebBluetoothSupported
};

export type PrintType = 'PREPARO' | 'ENTREGA' | 'ENTREGA_ATUALIZADO';
export type PrintTrigger = 'SYSTEM' | 'MANUAL';
export type ConnectionType = 'bluetooth' | 'browser' | 'rawbt';
export type PrinterProfile = 
  | 'generic-58mm' 
  | 'generic-80mm' 
  | 'compact-58mm' 
  | 'large-80mm' 
  | 'custom';

export type PaperSavingMode = 'ultra' | 'standard' | 'spacious';
export type TicketLayout = 'detailed' | 'compact';

export interface PrinterConfig {
  connectionType: ConnectionType;
  paperWidth: '58mm' | '80mm';
  profile: PrinterProfile;
  paperSavingMode: PaperSavingMode;
  ticketLayout: TicketLayout; // 'detailed' = completo e operacional; 'compact' = ultra compacto econômico
  printMode: 'manual' | 'auto'; // 'manual' = botão sob demanda, 'auto' = impressão automática em transições de status
  copies: 1 | 2;
  customColumns?: number; // 32, 40, 42, 48
  hasCutter?: boolean;
  feedLines?: number;
  enabled: boolean;
}

export const DEFAULT_PRINTER_CONFIG: PrinterConfig = {
  connectionType: 'bluetooth',
  paperWidth: '58mm',
  profile: 'generic-58mm',
  paperSavingMode: 'standard',
  ticketLayout: 'detailed', // Padrão completo e operacional
  printMode: 'auto',
  copies: 1,
  customColumns: 32,
  hasCutter: false,
  feedLines: 2,
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

export function resolveFormattingOptions(config: PrinterConfig): EscPosFormattingOptions {
  const isUltra = config.paperSavingMode === 'ultra';
  const isSpacious = config.paperSavingMode === 'spacious';
  const feedCount = config.feedLines ?? (isUltra ? 2 : (isSpacious ? 4 : 2));
  const layout = config.ticketLayout || (isUltra ? 'compact' : 'detailed');

  if (config.profile === 'generic-58mm') {
    return { 
      columns: isUltra ? 42 : 32, 
      hasCutter: false, 
      feedLines: feedCount, 
      condensedFont: isUltra,
      paperSavingMode: config.paperSavingMode,
      ticketLayout: layout
    };
  }
  if (config.profile === 'compact-58mm') {
    return { 
      columns: 42, 
      hasCutter: false, 
      feedLines: feedCount, 
      condensedFont: true,
      paperSavingMode: config.paperSavingMode,
      ticketLayout: layout
    };
  }
  if (config.profile === 'generic-80mm') {
    return { 
      columns: 48, 
      hasCutter: true, 
      feedLines: feedCount, 
      condensedFont: false,
      paperSavingMode: config.paperSavingMode,
      ticketLayout: layout
    };
  }
  if (config.profile === 'large-80mm') {
    return { 
      columns: 42, 
      hasCutter: true, 
      feedLines: feedCount, 
      condensedFont: false,
      paperSavingMode: config.paperSavingMode,
      ticketLayout: layout
    };
  }
  return {
    columns: config.customColumns || (config.paperWidth === '58mm' ? 32 : 48),
    hasCutter: config.hasCutter ?? (config.paperWidth === '80mm'),
    feedLines: feedCount,
    condensedFont: (config.customColumns || 32) > 40 && config.paperWidth === '58mm',
    paperSavingMode: config.paperSavingMode,
    ticketLayout: layout
  };
}

export function generateSingleTicketHTML(
  order: Order,
  storeName: string = 'Loja/Batedeira AçaíFood',
  paperWidth: '58mm' | '80mm' = '58mm',
  viaNumber: number = 1,
  totalVias: number = 1,
  allUsers?: Record<string, User> | null,
  clientUser?: User | null,
  printType: PrintType = 'PREPARO',
  ticketLayout: TicketLayout = 'detailed'
): string {
  const is58 = paperWidth === '58mm';
  const widthPx = is58 ? '48mm' : '72mm';
  const fontSize = is58 ? '10px' : '12px';
  const isDetailed = ticketLayout === 'detailed';

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

  // Itens e Cálculo do Subtotal dos Produtos
  let rawItems: { id: string; name: string; quantity: number; price: number }[] = [];

  if (order.items && order.items.length > 0) {
    rawItems = order.items.map((it, idx) => ({
      id: it.id || String(idx + 1),
      name: (it.name || 'Produto').replace(/^\d+x\s*/i, '').trim(),
      quantity: Number(it.quantity || 1),
      price: Number(it.price || 0)
    }));
  } else if (order.title) {
    const rawTitle = order.title.trim();
    const parts = rawTitle.split(',').map(p => p.trim()).filter(Boolean);
    const subtotal = (order as any).products_subtotal ? Number((order as any).products_subtotal) : Number(order.valor || 0);
    const partPrice = parts.length > 0 ? (subtotal / parts.length) : subtotal;

    rawItems = parts.map((part, idx) => {
      const match = part.match(/^(\d+)x\s*(.+)$/i);
      if (match) {
        const qty = parseInt(match[1], 10) || 1;
        return {
          id: String(idx + 1),
          name: match[2].replace(/^\d+x\s*/i, '').trim(),
          quantity: qty,
          price: partPrice / qty
        };
      }
      return {
        id: String(idx + 1),
        name: part.replace(/^\d+x\s*/i, '').trim(),
        quantity: order.quantity || 1,
        price: partPrice / (order.quantity || 1)
      };
    });
  }

  if (rawItems.length === 0) {
    rawItems = [{
      id: '1',
      name: (order.title || 'Produto').replace(/^\d+x\s*/i, '').trim(),
      quantity: order.quantity || 1,
      price: (order as any).products_subtotal || order.valor || 0
    }];
  }

  const itemsList = rawItems;

  let itemsSubtotal = itemsList.reduce((acc, i) => acc + (Number(i.price || 0) * Number(i.quantity || 1)), 0);
  if (itemsSubtotal === 0 && (order as any).products_subtotal) {
    itemsSubtotal = Number((order as any).products_subtotal);
  }
  if (itemsSubtotal === 0 && order.valor) {
    itemsSubtotal = Number(order.valor);
  }

  const totalDeliveryFee = Number(
    order.taxas?.entregaTotal ?? 
    order.taxas?.entregaCliente ?? 
    0
  );

  const clientDeliveryFee = Number(
    order.taxas?.entregaCliente ?? totalDeliveryFee
  );

  const storeDeliveryDiscount = Math.max(0, totalDeliveryFee - clientDeliveryFee);

  const totalFinal = order.totalValue !== undefined && Number(order.totalValue) > 0
    ? Number(order.totalValue)
    : Number((itemsSubtotal + clientDeliveryFee).toFixed(2));

  const formattedItemsSubtotal = itemsSubtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const formattedTotalDelivery = totalDeliveryFee.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const formattedStoreDiscount = storeDeliveryDiscount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const formattedClientDelivery = clientDeliveryFee.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const formattedTotal = totalFinal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

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
    || '';

  const buyerAddress = order.deliveryAddress 
    || buyerUser?.endereco 
    || (buyerUser?.bairro ? `${buyerUser.bairro}, ${buyerUser.cidade || 'Belém'}` : '') 
    || 'Retirada no Balcão';

  let deliveryRef = order.deliveryReference || (buyerUser as any)?.referencia || '';
  if (deliveryRef.includes('Distancia estimada') || deliveryRef.includes('Valor Fixo da Moto')) {
    deliveryRef = '';
  }

  const driverUser = order.motoristaId && allUsers ? allUsers[order.motoristaId] : null;
  const driverName = order.motoristaNome || driverUser?.name || (order.motoristaId ? `Entregador #${order.motoristaId.substring(0, 5)}` : null);
  const driverPhone = driverUser?.telefone || (driverUser as any)?.phone || '';

  let motoboyStatusLabel = 'Aguardando';
  if (driverName) {
    motoboyStatusLabel = driverPhone ? `${driverName} (${driverPhone})` : driverName;
  }

  let ticketHeaderTitle = printType === 'ENTREGA' ? 'CUPOM DE ENTREGA' : 'CUPOM DE PREPARO';
  if (totalVias > 1) {
    ticketHeaderTitle = viaNumber === 1 ? `VIA 1: COZINHA` : `VIA 2: ENTREGA`;
  }

  return `
    <div class="thermal-ticket" style="
      width: ${widthPx};
      font-family: 'Courier New', Courier, monospace;
      font-size: ${fontSize};
      line-height: 1.15;
      color: #000;
      background: #fff;
      padding: 2px;
      margin: 0 auto;
      text-align: left;
      box-sizing: border-box;
    ">
      <!-- CABEÇALHO -->
      <div style="text-align: center; border-bottom: 1px dashed #000; padding-bottom: 3px; margin-bottom: 3px;">
        <h2 style="margin: 0; font-size: ${is58 ? '13px' : '15px'}; font-weight: bold;">AÇAÍFOOD DELIVERY</h2>
        <p style="margin: 1px 0 0 0; font-size: ${is58 ? '10px' : '11px'}; font-weight: bold;">${storeName}</p>
        <p style="margin: 2px 0 0 0; font-weight: bold; font-size: ${is58 ? '10px' : '11px'};">*** ${ticketHeaderTitle} ***</p>
      </div>

      <!-- DETALHES DO PEDIDO -->
      <div style="border-bottom: 1px dashed #000; padding-bottom: 3px; margin-bottom: 3px;">
        <div style="display: flex; justify-content: space-between; font-weight: bold;">
          <span>PEDIDO: #${orderNum}</span>
          <span>${order.type || 'B2C'}</span>
        </div>
        <div style="font-size: ${is58 ? '9px' : '10px'};">📅 ${dateStr} [${(order.status || '').toUpperCase()}]</div>
        ${isDetailed && order.distancia && Number(order.distancia) > 0 ? `<div style="font-size: ${is58 ? '9px' : '10px'};">📏 Distância Estimada: ${Number(order.distancia).toFixed(1)} km</div>` : ''}
        <div style="font-size: ${is58 ? '9px' : '10px'}; font-weight: bold;">🛵 Motoboy: ${motoboyStatusLabel}</div>
      </div>

      <!-- CLIENTE & DADOS DE ENTREGA -->
      <div style="border-bottom: 1px dashed #000; padding-bottom: 3px; margin-bottom: 3px;">
        <div style="font-weight: bold;">👤 ${buyerName} ${buyerPhone ? `(${buyerPhone})` : ''}</div>
        <div style="font-size: ${is58 ? '9px' : '10px'};">📍 ${buyerAddress}</div>
        ${deliveryRef ? `<div style="font-size: ${is58 ? '9px' : '10px'};">🏢 ${deliveryRef.substring(0, 32)}</div>` : ''}
      </div>

      <!-- ITENS / PRODUTOS -->
      <div style="border-bottom: 1px dashed #000; padding-bottom: 3px; margin-bottom: 3px;">
        <table style="width: 100%; border-collapse: collapse; font-size: ${is58 ? '9px' : '11px'};">
          <thead>
            <tr style="border-bottom: 1px solid #000; text-align: left;">
              <th style="padding: 1px 0;">Qtd Item</th>
              <th style="padding: 1px 0; text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsList.map(item => `
              <tr style="vertical-align: top;">
                <td style="padding: 1px 0; font-weight: bold;">${item.quantity}x ${(item.name || 'Produto').replace(/^\d+x\s*/i, '').trim()}</td>
                <td style="padding: 1px 0; text-align: right; font-weight: bold;">R$ ${(item.price * item.quantity).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- TOTAL & PAGAMENTO -->
      <div style="border-bottom: 1px dashed #000; padding-bottom: 3px; margin-bottom: 3px;">
        ${isDetailed ? `
          <div style="display: flex; justify-content: space-between; font-size: ${is58 ? '9px' : '10px'};">
            <span>Subtotal Itens:</span>
            <span>${formattedItemsSubtotal}</span>
          </div>
          ${storeDeliveryDiscount > 0 ? `
            <div style="display: flex; justify-content: space-between; font-size: ${is58 ? '9px' : '10px'};">
              <span>Frete Total:</span>
              <span>${formattedTotalDelivery}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: ${is58 ? '9px' : '10px'}; color: #047857;">
              <span>Desc. Frete Loja:</span>
              <span>- ${formattedStoreDiscount}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: ${is58 ? '9px' : '10px'};">
              <span>Frete Pago Cliente:</span>
              <span>${formattedClientDelivery}</span>
            </div>
          ` : `
            <div style="display: flex; justify-content: space-between; font-size: ${is58 ? '9px' : '10px'};">
              <span>Taxa de Entrega:</span>
              <span>${clientDeliveryFee > 0 ? formattedClientDelivery : 'Grátis'}</span>
            </div>
          `}
        ` : `
          <div style="display: flex; justify-content: space-between; font-size: ${is58 ? '9px' : '10px'};">
            <span>Subtotal: ${formattedItemsSubtotal}</span>
            <span>Frete: ${clientDeliveryFee > 0 ? formattedClientDelivery : 'Grátis'}</span>
          </div>
        `}
        <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: ${is58 ? '11px' : '13px'}; border-top: 1px dashed #000; padding-top: 2px; margin-top: 2px;">
          <span>TOTAL:</span>
          <span>${formattedTotal}</span>
        </div>
        <div style="font-size: ${is58 ? '9px' : '10px'}; text-align: right;">
          💳 Pagamento: PIX (Asaas IP S.A.)
        </div>
      </div>

      <!-- PIN DE RETIRADA / BALCÃO -->
      ${(order.pickupPin || (order as any).pickup_pin) ? `
        <div style="border: 1px solid #000; padding: 3px; margin-top: 3px; margin-bottom: 3px; text-align: center;">
          <span style="font-size: ${is58 ? '9px' : '10px'}; font-weight: bold;">PIN RETIRADA: </span>
          <span style="font-size: ${is58 ? '14px' : '16px'}; font-weight: 900; letter-spacing: 2px;">${order.pickupPin || (order as any).pickup_pin}</span>
          ${isDetailed ? `<div style="font-size: 8px; margin-top: 1px;">(Informe ao entregador no balcão)</div>` : ''}
        </div>
      ` : ''}

      <!-- RODAPÉ OFICIAL (ASAAS + AÇAÍFOOD) -->
      <div style="text-align: center; font-size: ${is58 ? '8.5px' : '9.5px'}; padding-top: 3px; border-top: 1px dashed #000; margin-top: 3px;">
        <p style="margin: 0; font-weight: bold; font-size: ${is58 ? '8.5px' : '9.5px'};">[ PAGAMENTO PROCESSADO VIA ASAAS ]</p>
        <p style="margin: 1px 0 0 0; font-size: 7.5px;">Asaas Gestão Financeira Inst. de Pagamento S.A.</p>
        <p style="margin: 2px 0 0 0; font-weight: bold;">--- AçaíFood Delivery Oficial ---</p>
        <p style="margin: 1px 0 0 0;">www.acaifood.app.br</p>
      </div>
    </div>
  `;
}

const recentPrints = new Set<string>();

export async function printOrderTicket(
  order: Order,
  storeName: string = 'Loja/Batedeira AçaíFood',
  customConfig?: PrinterConfig,
  allUsers?: Record<string, User> | null,
  clientUser?: User | null,
  printType: PrintType = 'PREPARO',
  triggeredBy: PrintTrigger = 'MANUAL'
): Promise<void> {
  if (typeof window === 'undefined') return;

  const config = customConfig || getPrinterConfig();
  if (!config.enabled) return;

  const dedupeKey = `${order.id}-${printType}`;
  if (triggeredBy === 'SYSTEM') {
    if (recentPrints.has(dedupeKey)) {
      return;
    }
    recentPrints.add(dedupeKey);
    setTimeout(() => {
      recentPrints.delete(dedupeKey);
    }, 15000);
  }

  const copies = Math.max(1, Math.min(2, config.copies || 1)) as 1 | 2;
  const formattingOptions = resolveFormattingOptions(config);

  // 1. Modo RawBT (App Android)
  if (config.connectionType === 'rawbt') {
    for (let via = 1; via <= copies; via++) {
      const buffer = buildOrderEscPosBuffer(
        order,
        storeName,
        config.paperWidth,
        via,
        copies,
        allUsers,
        clientUser,
        printType,
        formattingOptions
      );
      sendViaRawBT(buffer);
    }
    logPrintAudit(order.id, printType, triggeredBy, true);
    return;
  }

  // 2. Modo Bluetooth Direto (ESC/POS)
  if (isBluetoothPrinterConnected() && config.connectionType !== 'browser') {
    try {
      const res = await printOrderBluetooth(
        order,
        storeName,
        config.paperWidth,
        copies,
        allUsers,
        clientUser,
        printType,
        formattingOptions
      );
      logPrintAudit(order.id, printType, triggeredBy, res.success);
      if (res.success) {
        return;
      }
      console.warn('Fallback para impressão do navegador:', res.error);
    } catch (e) {
      console.error('Erro na impressão Bluetooth direta, recorrendo ao navegador:', e);
    }
  }

  // 3. Modo Navegador / Sistema via CSS térmico
  let container = document.getElementById('thermal-print-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'thermal-print-container';
    document.body.appendChild(container);
  }

  let fullHTML = '';
  for (let via = 1; via <= copies; via++) {
    fullHTML += generateSingleTicketHTML(order, storeName, config.paperWidth, via, copies, allUsers, clientUser, printType, config.ticketLayout);
    if (via < copies) {
      fullHTML += `<div style="page-break-after: always; height: 10px; border-bottom: 1px dashed #000; margin: 10px 0;"></div>`;
    }
  }

  container.innerHTML = fullHTML;
  logPrintAudit(order.id, printType, triggeredBy, true);

  setTimeout(() => {
    try {
      window.print();
    } catch (e) {
      console.error('Erro ao disparar impressão do navegador:', e);
      logPrintAudit(order.id, printType, triggeredBy, false);
    }
  }, 150);
}

export async function printTestTicket(
  storeName: string = 'Loja/Batedeira AçaíFood',
  config?: PrinterConfig
): Promise<{ success: boolean; message?: string }> {
  const activeConfig = config || getPrinterConfig();
  const formattingOptions = resolveFormattingOptions(activeConfig);

  if (activeConfig.connectionType === 'rawbt') {
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
      pickupPin: '6838',
      deliveryPin: '6838',
      deliveryAddress: 'Av. Nazaré, 1050, Belém/PA',
      deliveryReference: 'Próximo à Basílica',
      clienteNome: 'Gabriel (Teste Econômico)',
      clienteTelefone: '(91) 98877-6655',
      lojaNome: storeName
    };
    const buffer = buildOrderEscPosBuffer(testOrder, storeName, activeConfig.paperWidth, 1, 1, null, null, 'PREPARO', formattingOptions);
    sendViaRawBT(buffer);
    return { success: true, message: 'Enviado para o aplicativo RawBT.' };
  }

  if (isBluetoothPrinterConnected() && activeConfig.connectionType !== 'browser') {
    const res = await printTestTicketBluetooth(storeName, activeConfig.paperWidth, activeConfig.copies, formattingOptions);
    return res;
  }

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
    pickupPin: '6838',
    deliveryPin: '6838',
    deliveryAddress: 'Av. Nazaré, 1050, Belém/PA',
    deliveryReference: 'Próximo à Basílica',
    clienteNome: 'Gabriel (Teste Econômico)',
    clienteTelefone: '(91) 98877-6655',
    lojaNome: storeName
  };

  printOrderTicket(testOrder, storeName, activeConfig, null, null, 'PREPARO', 'MANUAL');
  return { success: true, message: 'Janela de impressão aberta.' };
}
