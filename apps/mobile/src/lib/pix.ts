/**
 * Utilitário para geração de payload Pix no padrão EMV-Co do Banco Central do Brasil (BACEN)
 * com cálculo dinâmico do checksum CRC16-CCITT.
 */
function crc16ccitt(str: string): string {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
      } else {
        crc = (crc << 1) & 0xFFFF;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function generateValidPixPayload(params: {
  pixKey: string;
  merchantName?: string;
  merchantCity?: string;
  amount?: number;
  txId?: string;
}): string {
  const formatField = (id: string, value: string) => {
    const len = value.length.toString().padStart(2, '0');
    return `${id}${len}${value}`;
  };

  const cleanKey = params.pixKey.trim();
  const name = (params.merchantName || 'ACAIFOOD TECNOLOGIA')
    .substring(0, 25)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
  const city = (params.merchantCity || 'BELEM')
    .substring(0, 15)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
  const txId = (params.txId || '***').replace(/[^a-zA-Z0-9]/g, '').substring(0, 25) || '***';

  // 26 = Merchant Account Info (GUI + Key)
  const gui = formatField('00', 'BR.GOV.BCB.PIX');
  const keyField = formatField('01', cleanKey);
  const merchantAccountInfo = formatField('26', `${gui}${keyField}`);

  // 52 = Merchant Category Code (0000 = Geral)
  const mcc = formatField('52', '0000');
  // 53 = Currency (986 = Real BRL)
  const currency = formatField('53', '986');
  
  // 54 = Amount (opcional)
  let amountField = '';
  if (params.amount && params.amount > 0) {
    amountField = formatField('54', params.amount.toFixed(2));
  }

  // 58 = Country Code (BR)
  const country = formatField('58', 'BR');
  // 59 = Merchant Name
  const merchantNameField = formatField('59', name);
  // 60 = Merchant City
  const merchantCityField = formatField('60', city);

  // 62 = Additional Data Field Template (TXID)
  const txIdSubField = formatField('05', txId);
  const additionalDataField = formatField('62', txIdSubField);

  // Payload base com o identificador do CRC no final (6304)
  const rawPayload = `000201${merchantAccountInfo}${mcc}${currency}${amountField}${country}${merchantNameField}${merchantCityField}${additionalDataField}6304`;

  // Calcular CRC16
  const crc = crc16ccitt(rawPayload);

  return `${rawPayload}${crc}`;
}
