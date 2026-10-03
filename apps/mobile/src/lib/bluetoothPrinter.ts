/**
 * Módulo Universal de Impressão ESC/POS e Web Bluetooth para AçaíFood
 * Compatível com QUALQUER modelo térmico de 58mm ou 80mm do mercado:
 * - TOUSEI TECH DIR-E58V
 * - GOLDENSKY GS-MTP265 / PT-265
 * - ELGIN (i7, i8, i9, Elgin Mini, Bambini)
 * - EPSON (TM-T20, TM-T88, Mobilink)
 * - BEMATECH (MP-4200 TH, MP-2800, MP-100 S)
 * - DARUMA (DR-700, DR-800)
 * - XPRINTER / POS-58 / POS-80 / GOOJPRT / NETUM / MILESTONE / SUNMI / ZEBRA
 */

import { Order, User } from '@/store/useAppStore';

// Lista exaustiva de UUIDs de Serviços BLE padrão usados por todos os fabricantes mundiais
export const KNOWN_PRINTER_SERVICES = [
  // Padrão Bluetooth SIG e POS Universal
  '000018f0-0000-1000-8000-00805f9b34fb', // Standard POS BLE
  '000018f1-0000-1000-8000-00805f9b34fb', 
  
  // Fabricantes Chineses e Genéricas (Tousei, GoldenSky, Xprinter, Goojprt, Milestone, Netum)
  '0000ff00-0000-1000-8000-00805f9b34fb', 
  '0000fff0-0000-1000-8000-00805f9b34fb', 
  '0000ffe0-0000-1000-8000-00805f9b34fb', 
  '0000ffe5-0000-1000-8000-00805f9b34fb', 
  '0000ae00-0000-1000-8000-00805f9b34fb', 
  '0000af30-0000-1000-8000-00805f9b34fb', 
  '0000fee7-0000-1000-8000-00805f9b34fb', 
  '0000abf0-0000-1000-8000-00805f9b34fb',
  '0000de00-0000-1000-8000-00805f9b34fb',

  // Protocolos Seriais Transparentes (SPP over BLE / ISSC / Nordic / TI)
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC Microchip SPP
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // Bluetooth POS
  '6e400001-b5a3-f393-e0a9-e50e24dcca9e', // Nordic UART Service (Zebra, Elgin, Sunmi)
  '0000e0ff-0000-1000-8000-00805f9b34fb',
  '0000fef5-0000-1000-8000-00805f9b34fb',
  '00001101-0000-1000-8000-00805f9b34fb', // Standard Serial Port Profile
];

export interface BluetoothDeviceInfo {
  id: string;
  name: string;
  connected: boolean;
}

export type BluetoothPrintResult = {
  success: boolean;
  message?: string;
  error?: string;
};

export interface EscPosFormattingOptions {
  columns?: number; // 32 para 58mm padrão, 42 ou 48 para 80mm
  hasCutter?: boolean; // guilhotina automática
  feedLines?: number; // linhas de avanço final (padrão: 4)
  condensedFont?: boolean; // Fonte B compacta
  codePage?: 'ASCII' | 'CP860' | 'CP850';
}

// Estado global em memória da conexão Bluetooth
let activeBluetoothDevice: any = null;
let activeCharacteristic: any = null;
let connectionListeners: ((status: boolean, deviceName?: string) => void)[] = [];

/**
 * Inscreve ouvintes para mudanças no status da conexão Bluetooth
 */
export function subscribeBluetoothStatus(callback: (status: boolean, deviceName?: string) => void) {
  connectionListeners.push(callback);
  const isConn = isBluetoothPrinterConnected();
  const name = getConnectedBluetoothDeviceName();
  callback(isConn, name);

  return () => {
    connectionListeners = connectionListeners.filter(cb => cb !== callback);
  };
}

function notifyBluetoothStatus(status: boolean, deviceName?: string) {
  connectionListeners.forEach(cb => {
    try {
      cb(status, deviceName);
    } catch (e) {
      console.error('Erro no listener de status Bluetooth:', e);
    }
  });
}

/**
 * Verifica se a API Web Bluetooth é suportada no navegador atual
 */
export function isWebBluetoothSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
}

/**
 * Verifica se há uma impressora Bluetooth conectada no momento
 */
export function isBluetoothPrinterConnected(): boolean {
  return !!(activeBluetoothDevice && activeBluetoothDevice.gatt && activeBluetoothDevice.gatt.connected && activeCharacteristic);
}

/**
 * Retorna o nome da impressora conectada ou salva no cache local
 */
export function getConnectedBluetoothDeviceName(): string | undefined {
  if (activeBluetoothDevice && activeBluetoothDevice.name) {
    return activeBluetoothDevice.name;
  }
  if (typeof window !== 'undefined') {
    return localStorage.getItem('acaifood_bt_printer_name') || undefined;
  }
  return undefined;
}

/**
 * Busca e conecta a qualquer impressora Bluetooth (genérica ou de marca)
 */
export async function connectBluetoothPrinter(): Promise<{ success: boolean; name?: string; error?: string }> {
  if (!isWebBluetoothSupported()) {
    return {
      success: false,
      error: 'Seu navegador não suporta Web Bluetooth. Recomendamos o Google Chrome, Edge ou Opera no Android/Windows.'
    };
  }

  try {
    // Abre a busca do navegador com suporte universal a todos os dispositivos
    const device = await (navigator as any).bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: KNOWN_PRINTER_SERVICES
    });

    if (!device) {
      return { success: false, error: 'Nenhum dispositivo selecionado.' };
    }

    const deviceName = device.name || 'Impressora Bluetooth Térmica';

    // Ouvinte de desconexão acidental ou manual
    device.addEventListener('gattserverdisconnected', () => {
      activeCharacteristic = null;
      notifyBluetoothStatus(false, deviceName);
    });

    // Conecta ao servidor GATT
    const server = await device.gatt.connect();

    let foundCharacteristic: any = null;

    // 1. Tenta encontrar serviço conhecido na lista de fabricantes
    for (const serviceUuid of KNOWN_PRINTER_SERVICES) {
      try {
        const service = await server.getPrimaryService(serviceUuid);
        if (service) {
          const characteristics = await service.getCharacteristics();
          for (const char of characteristics) {
            if (char.properties.write || char.properties.writeWithoutResponse) {
              foundCharacteristic = char;
              break;
            }
          }
        }
      } catch {
        // Continua
      }
      if (foundCharacteristic) break;
    }

    // 2. Se for um modelo não catalogado, varre dinamicamente todos os serviços do dispositivo
    if (!foundCharacteristic) {
      try {
        const services = await server.getPrimaryServices();
        for (const service of services) {
          try {
            const characteristics = await service.getCharacteristics();
            for (const char of characteristics) {
              if (char.properties.write || char.properties.writeWithoutResponse) {
                foundCharacteristic = char;
                break;
              }
            }
          } catch {}
          if (foundCharacteristic) break;
        }
      } catch {}
    }

    if (!foundCharacteristic) {
      if (server.connected) {
        device.gatt.disconnect();
      }
      return {
        success: false,
        error: `Dispositivo "${deviceName}" pareado, mas não foi localizado canal de transmissão ESC/POS compatível.`
      };
    }

    activeBluetoothDevice = device;
    activeCharacteristic = foundCharacteristic;

    if (typeof window !== 'undefined') {
      localStorage.setItem('acaifood_bt_printer_name', deviceName);
      localStorage.setItem('acaifood_bt_printer_id', device.id || '');
    }

    notifyBluetoothStatus(true, deviceName);

    return {
      success: true,
      name: deviceName
    };
  } catch (err: any) {
    console.error('Erro ao conectar impressora Bluetooth:', err);
    if (err.name === 'NotFoundError') {
      return { success: false, error: 'Pareamento cancelado pelo usuário.' };
    }
    return {
      success: false,
      error: err.message || 'Falha ao conectar à impressora Bluetooth.'
    };
  }
}

/**
 * Desconecta a impressora Bluetooth ativa
 */
export async function disconnectBluetoothPrinter(): Promise<void> {
  if (activeBluetoothDevice && activeBluetoothDevice.gatt && activeBluetoothDevice.gatt.connected) {
    try {
      activeBluetoothDevice.gatt.disconnect();
    } catch (e) {
      console.warn('Aviso ao desconectar:', e);
    }
  }
  activeBluetoothDevice = null;
  activeCharacteristic = null;

  if (typeof window !== 'undefined') {
    localStorage.removeItem('acaifood_bt_printer_name');
    localStorage.removeItem('acaifood_bt_printer_id');
  }

  notifyBluetoothStatus(false);
}

/**
 * Envia bytes ESC/POS em pacotes para a característica Bluetooth
 */
export async function sendEscPosToBluetooth(data: Uint8Array): Promise<BluetoothPrintResult> {
  if (!isBluetoothPrinterConnected()) {
    return {
      success: false,
      error: 'Nenhuma impressora Bluetooth conectada.'
    };
  }

  try {
    // Chunks de 100 bytes para máxima estabilidade em microcontroladores de impressoras térmicas
    const chunkSize = 100;
    const totalChunks = Math.ceil(data.length / chunkSize);

    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, data.length);
      const chunk = data.slice(start, end);

      if (activeCharacteristic.properties.writeWithoutResponse) {
        await activeCharacteristic.writeValueWithoutResponse(chunk);
      } else {
        await activeCharacteristic.writeValue(chunk);
      }

      await new Promise(resolve => setTimeout(resolve, 20));
    }

    return {
      success: true,
      message: 'Comanda impressa com sucesso!'
    };
  } catch (err: any) {
    console.error('Erro ao enviar dados para a impressora:', err);
    return {
      success: false,
      error: err.message || 'Erro ao transmitir dados via Bluetooth.'
    };
  }
}

/**
 * Dispara comando para o aplicativo RawBT Print Service no Android (Fallback para USB/Bluetooth Clássico)
 */
export function sendViaRawBT(bytes: Uint8Array): boolean {
  if (typeof window === 'undefined') return false;
  try {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = window.btoa(binary);
    window.location.href = `rawbt:data:base64,${base64}`;
    return true;
  } catch (e) {
    console.error('Erro ao chamar RawBT:', e);
    return false;
  }
}

/**
 * Sanitiza texto em português para compatibilidade total com 100% dos chipsets térmicos mundiais
 */
export function sanitizeTextForEscPos(text: string): string {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Converte caracteres acentuados para suas bases (ã->a, é->e, ç->c)
    .replace(/[^\x20-\x7E\n\r\t]/g, ''); // Garante apenas caracteres ASCII imprimíveis
}

/**
 * Alinha e formata linha com texto à esquerda e texto à direita respeitando a largura de colunas
 */
export function formatCols2(left: string, right: string, width: number = 32): string {
  const cleanLeft = sanitizeTextForEscPos(left);
  const cleanRight = sanitizeTextForEscPos(right);
  const spaces = width - cleanLeft.length - cleanRight.length;
  if (spaces <= 0) {
    const maxLeftLen = width - cleanRight.length - 1;
    return cleanLeft.substring(0, Math.max(0, maxLeftLen)) + ' ' + cleanRight;
  }
  return cleanLeft + ' '.repeat(spaces) + cleanRight;
}

/**
 * Cria linha divisória com caractere especificado
 */
export function divider(char: string = '-', width: number = 32): string {
  return char.repeat(width) + '\n';
}

/**
 * Constrói os bytes binários ESC/POS genéricos para qualquer impressora térmica (58mm ou 80mm)
 */
export function buildOrderEscPosBuffer(
  order: Order,
  storeName: string = 'Loja/Batedeira AçaíFood',
  paperWidth: '58mm' | '80mm' = '58mm',
  viaNumber: number = 1,
  totalVias: number = 1,
  allUsers?: Record<string, User> | null,
  clientUser?: User | null,
  printType: 'PREPARO' | 'ENTREGA' | 'ENTREGA_ATUALIZADO' = 'PREPARO',
  options?: EscPosFormattingOptions
): Uint8Array {
  const defaultCols = paperWidth === '58mm' ? 32 : 48;
  const width = options?.columns || defaultCols;
  const feedCount = options?.feedLines ?? 4;
  const hasCutter = options?.hasCutter ?? (paperWidth === '80mm');
  const bytes: number[] = [];

  const addBytes = (...b: number[]) => bytes.push(...b);
  const addText = (t: string) => {
    const clean = sanitizeTextForEscPos(t);
    for (let i = 0; i < clean.length; i++) {
      bytes.push(clean.charCodeAt(i));
    }
  };
  const addLine = (t: string = '') => {
    addText(t);
    addBytes(0x0A); // LF
  };

  // 1. Inicializa Impressora (ESC @)
  addBytes(0x1B, 0x40);

  // 2. Modo de Fonte Normal / Condensada
  if (options?.condensedFont) {
    addBytes(0x1B, 0x4D, 0x01); // Fonte B
  } else {
    addBytes(0x1B, 0x4D, 0x00); // Fonte A
  }

  // --- CABEÇALHO CENTRALIZADO ---
  addBytes(0x1B, 0x61, 0x01); // Alinhamento Central
  addBytes(0x1B, 0x45, 0x01); // Negrito ON
  addBytes(0x1D, 0x21, 0x11); // Tamanho Duplo (Altura + Largura)
  addLine('ACAIFOOD DELIVERY');
  
  addBytes(0x1D, 0x21, 0x00); // Tamanho Normal
  addBytes(0x1B, 0x45, 0x01); // Negrito ON
  addLine(storeName);

  // Título do Cupom
  let viaLabel = printType === 'ENTREGA' ? 'CUPOM DE ENTREGA' : 'CUPOM DE PREPARO';
  if (totalVias > 1) {
    viaLabel = viaNumber === 1 ? `VIA 1: COZINHA/PREPARO` : `VIA 2: ENTREGA/MOTOBOY`;
  }
  addBytes(0x1B, 0x45, 0x00); // Negrito OFF
  addLine(`*** ${viaLabel} ***`);
  addLine(divider('=', width));

  // --- DETALHES DO PEDIDO ---
  addBytes(0x1B, 0x61, 0x00); // Alinhamento à Esquerda
  addBytes(0x1B, 0x45, 0x01); // Negrito ON
  const orderNum = order.id.slice(-6).toUpperCase();
  addLine(formatCols2(`PEDIDO: #${orderNum}`, (order.type || 'B2C').toUpperCase(), width));
  
  addBytes(0x1B, 0x45, 0x00); // Negrito OFF
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
  addLine(`Data/Hora: ${dateStr}`);
  addLine(`Status: ${(order.status || '').toUpperCase()}`);

  // Motoboy / Entregador
  const driverUser = order.motoristaId && allUsers ? allUsers[order.motoristaId] : null;
  const driverName = order.motoristaNome || driverUser?.name || (order.motoristaId ? `Motoboy #${order.motoristaId.substring(0, 5)}` : null);
  const driverPhone = driverUser?.telefone || (driverUser as any)?.phone || '';
  let driverLabel = 'Aguardando aceite';
  if (driverName) {
    driverLabel = driverPhone ? `${driverName} (${driverPhone})` : driverName;
  }
  addLine(`Motoboy: ${driverLabel}`);

  if (order.distancia) {
    addLine(`Distancia Estimada: ${order.distancia.toFixed(1)} km`);
  }

  addLine(divider('-', width));

  // --- DADOS DO CLIENTE & ENTREGA ---
  const isB2B = order.type === 'B2B';
  const buyerUser = clientUser 
    || (allUsers && (order as any).buyerId ? allUsers[(order as any).buyerId] : undefined)
    || (allUsers && isB2B && order.lojaId ? allUsers[order.lojaId] : undefined)
    || (allUsers && order.clienteId ? allUsers[order.clienteId] : undefined) 
    || (allUsers && order.destinoId ? allUsers[order.destinoId] : undefined) 
    || (allUsers && order.criadoPor ? allUsers[order.criadoPor] : undefined);

  const buyerName = order.clienteNome 
    || buyerUser?.name 
    || (isB2B ? (order.lojaNome || 'Loja/Batedeira') : 'Cliente AcaiFood');

  const buyerPhone = order.clienteTelefone 
    || buyerUser?.telefone 
    || (buyerUser as any)?.phone 
    || buyerUser?.email 
    || 'Nao Informado';

  const buyerAddress = order.deliveryAddress 
    || buyerUser?.endereco 
    || (buyerUser?.bairro ? `${buyerUser.bairro}, ${buyerUser.cidade || 'Belem'}` : '') 
    || 'Retirada no Balcao / Local';

  const deliveryRef = order.deliveryReference || (buyerUser as any)?.referencia || '';

  addBytes(0x1B, 0x45, 0x01); // Negrito ON
  addLine('--- DADOS DO CLIENTE ---');
  addLine(`CLIENTE: ${buyerName}`);
  addLine(`TEL: ${buyerPhone}`);
  addBytes(0x1B, 0x45, 0x00); // Negrito OFF
  addLine(`END: ${buyerAddress}`);
  if (deliveryRef) {
    addLine(`REF: ${deliveryRef}`);
  }

  addLine(divider('-', width));

  // --- ITENS DO PEDIDO ---
  addBytes(0x1B, 0x45, 0x01); // Negrito ON
  addLine('--- ITENS DO PEDIDO ---');
  addLine(formatCols2('QTD ITEM', 'VALOR', width));
  addBytes(0x1B, 0x45, 0x00); // Negrito OFF
  addLine(divider('-', width));

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

  let itemsSubtotal = 0;
  rawItems.forEach(it => {
    const itemTotal = it.price * it.quantity;
    itemsSubtotal += itemTotal;
    const itemLine = `${it.quantity}x ${it.name}`;
    const priceLine = `R$ ${itemTotal.toFixed(2)}`;
    addLine(formatCols2(itemLine, priceLine, width));
  });

  if (itemsSubtotal === 0 && (order as any).products_subtotal) {
    itemsSubtotal = Number((order as any).products_subtotal);
  }
  if (itemsSubtotal === 0 && order.valor) {
    itemsSubtotal = Number(order.valor);
  }

  const clientDeliveryFee = Number(order.taxas?.entregaCliente ?? order.taxas?.entregaTotal ?? 0);
  const totalFinal = order.totalValue !== undefined && Number(order.totalValue) > 0
    ? Number(order.totalValue)
    : Number((itemsSubtotal + clientDeliveryFee).toFixed(2));

  addLine(divider('-', width));

  // --- VALORES E PAGAMENTO ---
  addLine(formatCols2('Subtotal Itens:', `R$ ${itemsSubtotal.toFixed(2)}`, width));
  addLine(formatCols2('Taxa Entrega:', clientDeliveryFee > 0 ? `R$ ${clientDeliveryFee.toFixed(2)}` : 'Gratis', width));
  
  addBytes(0x1B, 0x45, 0x01); // Negrito ON
  addLine(divider('-', width));
  addLine(formatCols2('TOTAL DO PEDIDO:', `R$ ${totalFinal.toFixed(2)}`, width));
  addLine(divider('=', width));

  addBytes(0x1B, 0x45, 0x00); // Negrito OFF
  addLine('Pagamento: PIX (Confirmado)');
  addLine('Intermediacao: ASAAS IP S.A.');

  // --- PIN DE RETIRADA / BALCAO ---
  const pickupPin = order.pickupPin || (order as any).pickup_pin;
  if (pickupPin) {
    addLine('');
    addBytes(0x1B, 0x61, 0x01); // Centralizado
    addLine(divider('=', width));
    addBytes(0x1B, 0x45, 0x01); // Negrito ON
    addLine('*** PIN DE RETIRADA (BALCAO) ***');
    addBytes(0x1D, 0x21, 0x11); // Tamanho Duplo
    addLine(`  ${pickupPin}  `);
    addBytes(0x1D, 0x21, 0x00); // Tamanho Normal
    addLine('Informe ao entregador na retirada');
    addLine(divider('=', width));
    addBytes(0x1B, 0x61, 0x00); // Esquerda
  }

  // --- RODAPÉ OFICIAL ---
  addBytes(0x1B, 0x61, 0x01); // Centralizado
  addLine('');
  addLine('[ PAGAMENTO PROCESSADO VIA ASAAS ]');
  addLine('Asaas Gestao Financeira Inst. de Pagamento S.A.');
  addLine('--- AcaiFood Delivery Oficial ---');
  addLine('www.acaifood.app.br');

  // Linhas de avanço de papel
  for (let f = 0; f < feedCount; f++) {
    addBytes(0x0A);
  }

  // Comando de corte de papel (se tiver guilhotina ou modelo 80mm)
  if (hasCutter) {
    addBytes(0x1D, 0x56, 0x42, 0x00); // Partial cut (GS V 66 0)
  }

  return new Uint8Array(bytes);
}

/**
 * Imprime um pedido diretamente via Bluetooth ESC/POS
 */
export async function printOrderBluetooth(
  order: Order,
  storeName: string = 'Loja/Batedeira AçaíFood',
  paperWidth: '58mm' | '80mm' = '58mm',
  copies: 1 | 2 = 1,
  allUsers?: Record<string, User> | null,
  clientUser?: User | null,
  printType: 'PREPARO' | 'ENTREGA' | 'ENTREGA_ATUALIZADO' = 'PREPARO',
  options?: EscPosFormattingOptions
): Promise<BluetoothPrintResult> {
  if (!isBluetoothPrinterConnected()) {
    return {
      success: false,
      error: 'Impressora Bluetooth não está conectada.'
    };
  }

  try {
    for (let via = 1; via <= copies; via++) {
      const buffer = buildOrderEscPosBuffer(
        order,
        storeName,
        paperWidth,
        via,
        copies,
        allUsers,
        clientUser,
        printType,
        options
      );
      const res = await sendEscPosToBluetooth(buffer);
      if (!res.success) {
        return res;
      }
      if (via < copies) {
        await new Promise(resolve => setTimeout(resolve, 350));
      }
    }
    return { success: true, message: 'Pedido impresso com sucesso via Bluetooth!' };
  } catch (err: any) {
    console.error('Erro ao imprimir via Bluetooth:', err);
    return { success: false, error: err.message || 'Falha na impressão Bluetooth.' };
  }
}

/**
 * Imprime uma comanda de teste via Bluetooth
 */
export async function printTestTicketBluetooth(
  storeName: string = 'Loja/Batedeira AçaíFood',
  paperWidth: '58mm' | '80mm' = '58mm',
  copies: 1 | 2 = 1,
  options?: EscPosFormattingOptions
): Promise<BluetoothPrintResult> {
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
    pickupPin: '4829',
    deliveryPin: '4829',
    deliveryAddress: 'Av. Nazaré, 1050 - Apt 302, Belém/PA',
    deliveryReference: 'Próximo à Basílica de Nazaré',
    clienteNome: 'Gabriel (Teste Impressora Genérica)',
    clienteTelefone: '(91) 98877-6655',
    lojaNome: storeName
  };

  return printOrderBluetooth(testOrder, storeName, paperWidth, copies, null, null, 'PREPARO', options);
}
