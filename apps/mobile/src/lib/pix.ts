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

  let cleanKey = String(params.pixKey || '').trim();
  const digitsOnly = cleanKey.replace(/\D/g, '');

  if (cleanKey.includes('@')) {
    cleanKey = cleanKey.toLowerCase();
  } else if (digitsOnly.length === 11 || digitsOnly.length === 14) {
    cleanKey = digitsOnly; // CPF ou CNPJ no Pix BACEN deve conter apenas números
  } else if (digitsOnly.length >= 10 && digitsOnly.length <= 11) {
    cleanKey = cleanKey.startsWith('+') ? `+${digitsOnly}` : `+55${digitsOnly}`;
  } else {
    cleanKey = cleanKey.toLowerCase();
  }

  const name = (params.merchantName || 'ACAIFOOD TECNOLOGIA')
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .substring(0, 25)
    .trim()
    .toUpperCase() || 'ACAIFOOD TECNOLOGIA';

  const city = (params.merchantCity || 'BELEM')
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .substring(0, 15)
    .trim()
    .toUpperCase() || 'BELEM';

  // No padrão Pix BACEN, o txId no BR Code deve conter estritamente caracteres alfanuméricos [a-zA-Z0-9] (sem asteriscos nem especiais)
  let cleanTxId = String(params.txId || '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .substring(0, 25);
  if (!cleanTxId) {
    cleanTxId = 'ACAIFOOD';
  }

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
  const txIdSubField = formatField('05', cleanTxId);
  const additionalDataField = formatField('62', txIdSubField);

  // Payload base com o identificador do CRC no final (6304)
  const rawPayload = `000201${merchantAccountInfo}${mcc}${currency}${amountField}${country}${merchantNameField}${merchantCityField}${additionalDataField}6304`;

  // Calcular CRC16
  const crc = crc16ccitt(rawPayload);

  return `${rawPayload}${crc}`;
}

export function validateCpfCnpjDigits(val?: string | null): boolean {
  if (!val) return false;
  const str = String(val).replace(/\D/g, '');
  
  if (str.length === 11) {
    if (/^(\d)\1{10}$/.test(str)) return false;
    let sum = 0;
    let rev: number;
    for (let i = 1; i <= 9; i++) sum += parseInt(str.substring(i - 1, i)) * (11 - i);
    rev = (sum * 10) % 11;
    if (rev === 10 || rev === 11) rev = 0;
    if (rev !== parseInt(str.substring(9, 10))) return false;
    sum = 0;
    for (let i = 1; i <= 10; i++) sum += parseInt(str.substring(i - 1, i)) * (12 - i);
    rev = (sum * 10) % 11;
    if (rev === 10 || rev === 11) rev = 0;
    if (rev !== parseInt(str.substring(10, 11))) return false;
    return true;
  }
  
  if (str.length === 14) {
    if (/^(\d)\1{13}$/.test(str)) return false;
    let size = str.length - 2;
    let numbers = str.substring(0, size);
    const digits = str.substring(size);
    let sum = 0;
    let pos = size - 7;
    for (let i = size; i >= 1; i--) {
      sum += parseInt(numbers.charAt(size - i)) * pos--;
      if (pos < 2) pos = 9;
    }
    let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (result !== parseInt(digits.charAt(0))) return false;
    size = size + 1;
    numbers = str.substring(0, size);
    sum = 0;
    pos = size - 7;
    for (let i = size; i >= 1; i--) {
      sum += parseInt(numbers.charAt(size - i)) * pos--;
      if (pos < 2) pos = 9;
    }
    result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (result !== parseInt(digits.charAt(1))) return false;
    return true;
  }

  return false;
}
