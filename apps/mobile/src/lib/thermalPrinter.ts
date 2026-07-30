import { Order, User } from '@/store/useAppStore';

export interface PrinterConfig {
  paperWidth: '58mm' | '80mm';
  printMode: 'manual' | 'auto'; // 'manual' = manual print button, 'auto' = auto print when order confirmed
  copies: 1 | 2;
  enabled: boolean;
}

export const DEFAULT_PRINTER_CONFIG: PrinterConfig = {
  paperWidth: '80mm',
  printMode: 'manual',
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

export function generateSingleTicketHTML(
  order: Order,
  storeName: string = 'Batedeira AçaíFood',
  paperWidth: '58mm' | '80mm' = '80mm',
  viaNumber: number = 1,
  totalVias: number = 1,
  allUsers?: Record<string, User> | null,
  clientUser?: User | null
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

  const formattedTotal = order.valor
    ? order.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : 'R$ 0,00';

  const itemsList = order.items && order.items.length > 0
    ? order.items
    : order.title
    ? [{ id: '1', name: `${order.title} (x${order.quantity || 1})`, quantity: order.quantity || 1, price: order.valor }]
    : [{ id: '1', name: 'Pedido Açaí', quantity: 1, price: order.valor }];

  const isB2B = order.type === 'B2B';
  const isColeta = order.type === 'COLETA';

  // Resolução inteligente do comprador (Batedeira no B2B, Cliente no B2C)
  const buyerUser = clientUser 
    || (allUsers && isB2B && order.lojaId ? allUsers[order.lojaId] : undefined)
    || (allUsers && order.clienteId ? allUsers[order.clienteId] : undefined) 
    || (allUsers && order.destinoId ? allUsers[order.destinoId] : undefined) 
    || (allUsers && order.criadoPor ? allUsers[order.criadoPor] : undefined);

  const buyerRoleLabel = isB2B ? 'BATEDEIRA (COMPRADOR FRUTO)' : isColeta ? 'LOJA (SOLICITANTE CAÇAMBA)' : 'CLIENTE (AÇAÍ BATIDO)';
  const buyerName = isB2B 
    ? (buyerUser?.name || order.lojaNome || 'Batedeira Açaí') 
    : (order.clienteNome || buyerUser?.name || 'Cliente AçaíFood');

  const buyerPhone = order.clienteTelefone || buyerUser?.telefone || buyerUser?.email || 'Não informado';
  const buyerAddress = order.deliveryAddress 
    || buyerUser?.endereco 
    || (buyerUser?.bairro ? `${buyerUser.bairro}, ${buyerUser.cidade || 'Belém'}` : '') 
    || 'Endereço não informado';

  const viaTitle = totalVias > 1 
    ? (viaNumber === 1 ? (isB2B ? '*** VIA 1: EXPEDIÇÃO / FORNECEDOR ***' : '*** VIA 1: PREPARO / BATEDEIRA ***') : (isB2B ? '*** VIA 2: TRANSPORTE / CAMINHÃO ***' : '*** VIA 2: ENTREGA / MOTOBOY ***'))
    : (isB2B ? '*** COMANDA DE SAÍDA - AÇAÍ FRUTO ***' : '*** COMANDA DE PREPARO - AÇAÍ BATIDO ***');

  return `
    <div class="thermal-ticket" style="
      width: ${widthPx};
      font-family: 'Courier New', Courier, monospace;
      font-size: ${fontSize};
      line-height: 1.2;
      color: #000;
      background: #fff;
      padding: 4px;
      margin: 0 auto;
      text-align: left;
      box-sizing: border-box;
    ">
      <!-- HEADER -->
      <div style="text-align: center; border-bottom: 2px dashed #000; padding-bottom: 6px; margin-bottom: 6px;">
        <h2 style="margin: 0; font-size: ${is58 ? '14px' : '16px'}; font-weight: bold; text-transform: uppercase;">AÇAÍFOOD</h2>
        <p style="margin: 2px 0 0 0; font-size: ${is58 ? '10px' : '11px'}; font-weight: bold;">${storeName}</p>
        <p style="margin: 4px 0 0 0; font-weight: bold; font-size: ${is58 ? '11px' : '12px'};">${viaTitle}</p>
      </div>

      <!-- DETALHES DO PEDIDO -->
      <div style="border-bottom: 1px dashed #000; padding-bottom: 6px; margin-bottom: 6px;">
        <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: ${is58 ? '12px' : '14px'};">
          <span>PEDIDO: #${orderNum}</span>
          <span>${order.type || 'B2C'}</span>
        </div>
        <div style="font-size: ${is58 ? '10px' : '11px'}; margin-top: 2px;">Data/Hora: ${dateStr}</div>
        <div style="font-size: ${is58 ? '10px' : '11px'}; font-weight: bold; margin-top: 2px;">
          Status: ${(order.status || '').toUpperCase()}
        </div>
      </div>

      <!-- CLIENTE / BATEDEIRA & ENTREGA -->
      <div style="border-bottom: 1px dashed #000; padding-bottom: 6px; margin-bottom: 6px;">
        <div style="font-weight: bold; font-size: ${is58 ? '11px' : '13px'}; text-transform: uppercase;">
          ${buyerRoleLabel}: ${buyerName}
        </div>
        <div style="font-size: ${is58 ? '10px' : '11px'}; font-weight: bold; margin-top: 2px;">
          📞 TEL: ${buyerPhone}
        </div>
        <div style="font-size: ${is58 ? '10px' : '11px'}; margin-top: 2px;">
          <strong>📍 ENDEREÇO:</strong> ${buyerAddress}
        </div>
        ${order.deliveryReference ? `
          <div style="font-size: ${is58 ? '9px' : '10px'}; font-style: italic; margin-top: 2px;">Ref: ${order.deliveryReference}</div>
        ` : ''}

        <!-- PIN Seguro: Apenas lembrete de solicitar ao cliente na entrega -->
        <div style="
          border: 1px dashed #000;
          padding: 2px 4px;
          font-weight: bold;
          font-size: ${is58 ? '10px' : '11px'};
          text-align: center;
          margin: 4px 0;
        ">
          PIN ENTREGA: Pedir ao Cliente
        </div>
      </div>

      <!-- ITENS / PRODUTOS -->
      <div style="border-bottom: 2px dashed #000; padding-bottom: 6px; margin-bottom: 6px;">
        <div style="font-weight: bold; text-decoration: underline; margin-bottom: 4px;">ITENS DO PEDIDO:</div>
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
      <div style="text-align: right; font-weight: bold; font-size: ${is58 ? '12px' : '14px'}; margin-bottom: 6px;">
        TOTAL DO PEDIDO: ${formattedTotal}
      </div>

      <!-- RODAPÉ -->
      <div style="text-align: center; font-size: ${is58 ? '9px' : '10px'}; border-top: 1px dashed #000; padding-top: 6px; margin-top: 6px;">
        <p style="margin: 0;">--- AçaíFood Delivery ---</p>
        <p style="margin: 2px 0 0 0;">Obrigado pela preferência!</p>
        <br />
        <p style="margin: 0; font-size: 8px;">.</p> <!-- Espaço para corte de papel -->
      </div>
    </div>
  `;
}

export function printOrderTicket(
  order: Order,
  storeName: string = 'Batedeira AçaíFood',
  customConfig?: PrinterConfig,
  allUsers?: Record<string, User> | null,
  clientUser?: User | null
): void {
  if (typeof window === 'undefined') return;

  const config = customConfig || getPrinterConfig();
  const copies = Math.max(1, Math.min(2, config.copies || 1));

  let container = document.getElementById('thermal-print-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'thermal-print-container';
    document.body.appendChild(container);
  }

  let fullHTML = '';
  for (let via = 1; via <= copies; via++) {
    fullHTML += generateSingleTicketHTML(order, storeName, config.paperWidth, via, copies, allUsers, clientUser);
    if (via < copies) {
      fullHTML += `<div style="page-break-after: always; height: 15px; border-bottom: 2px dashed #000; margin: 15px 0;"></div>`;
    }
  }

  container.innerHTML = fullHTML;

  // Small timeout to allow browser DOM rendering before triggering system print dialog
  setTimeout(() => {
    try {
      window.print();
    } catch (e) {
      console.error('Erro ao disparar impressão:', e);
    }
  }, 150);
}

export function printTestTicket(
  storeName: string = 'Batedeira AçaíFood',
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
    status: 'preparo',
    criadoPor: 'cliente_gabriel',
    origemId: 'loja_123',
    destinoId: 'cliente_gabriel',
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
    deliveryReference: 'Próximo ao Basílica de Nazaré',
    clienteNome: 'Gabriel (Teste Impressora)',
    clienteTelefone: '(91) 98877-6655',
    lojaNome: storeName
  };

  printOrderTicket(testOrder, storeName, config);
}

