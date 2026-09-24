import { validateCpfCnpjDigits } from '@/lib/pix';

export interface AsaasTransferPayload {
  value: number;
  pixAddressKey?: string;
  pixAddressKeyType?: 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'EVP';
  walletId?: string;
  description?: string;
}

/**
 * Sugestão de detecção de tipo de chave Pix para auxílio de UI.
 */
export function detectPixKeyType(keyStr: string): 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'EVP' {
  const clean = String(keyStr || '').trim();
  const digits = clean.replace(/\D/g, '');

  if (clean.includes('@')) return 'EMAIL';
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clean)) return 'EVP';
  if (digits.length === 11) return 'CPF';
  if (digits.length === 14) return 'CNPJ';
  if (digits.length >= 10 && digits.length <= 13) return 'PHONE';

  return 'EVP';
}

/**
 * Normaliza e valida rigorosamente a chave Pix de acordo com o tipo especificado.
 */
export function validateAndFormatPixKey(
  keyStr: string,
  keyType?: 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'EVP' | string
): { valid: boolean; formattedKey?: string; type?: 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'EVP'; error?: string } {
  const clean = String(keyStr || '').trim();
  if (!clean) return { valid: false, error: 'Chave Pix não fornecida.' };

  const resolvedType = (String(keyType || '').toUpperCase() as 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'EVP') || detectPixKeyType(clean);
  const digits = clean.replace(/\D/g, '');

  switch (resolvedType) {
    case 'CPF': {
      if (digits.length !== 11 || !validateCpfCnpjDigits(digits)) {
        return { valid: false, error: 'CPF inválido ou incompleto para chave Pix.' };
      }
      return { valid: true, formattedKey: digits, type: 'CPF' };
    }
    case 'CNPJ': {
      if (digits.length !== 14 || !validateCpfCnpjDigits(digits)) {
        return { valid: false, error: 'CNPJ inválido ou incompleto para chave Pix.' };
      }
      return { valid: true, formattedKey: digits, type: 'CNPJ' };
    }
    case 'EMAIL': {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(clean)) {
        return { valid: false, error: 'E-mail inválido para chave Pix.' };
      }
      return { valid: true, formattedKey: clean.toLowerCase(), type: 'EMAIL' };
    }
    case 'PHONE': {
      if (digits.length < 10 || digits.length > 13) {
        return { valid: false, error: 'Telefone inválido para chave Pix.' };
      }
      const rawDigits = digits.startsWith('55') && digits.length >= 12 ? digits.slice(2) : digits;
      if (rawDigits.length !== 10 && rawDigits.length !== 11) {
        return { valid: false, error: 'Telefone deve conter DDD + 8 ou 9 dígitos.' };
      }
      const phoneFormatted = `+55${rawDigits}`;
      return { valid: true, formattedKey: phoneFormatted, type: 'PHONE' };
    }
    case 'EVP': {
      const evpRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!evpRegex.test(clean)) {
        return { valid: false, error: 'Chave aleatória (EVP) deve estar no formato UUID válido.' };
      }
      return { valid: true, formattedKey: clean.toLowerCase(), type: 'EVP' };
    }
    default:
      return { valid: false, error: 'Tipo de chave Pix desconhecido.' };
  }
}

export function buildAsaasTransferPayload(
  partnerUser: any,
  amount: number,
  descriptionStr?: string
): AsaasTransferPayload | null {
  if (!partnerUser || amount <= 0) return null;

  const rawPixKey = String(partnerUser.pix_key || partnerUser.pixKey || '').trim();
  const rawPixKeyType = partnerUser.pix_key_type || partnerUser.pixKeyType;
  const rawCpfCnpj = String(partnerUser.cpf_cnpj || partnerUser.cpfCnpj || '').replace(/\D/g, '');
  const rawEmail = String(partnerUser.email || '').trim();
  const rawWalletId = String(partnerUser.asaas_wallet_id || partnerUser.asaasWalletId || '').trim();

  const desc = descriptionStr || `Repasse AçaíFood - ${partnerUser.name || 'Parceiro'}`;

  // 1. Se houver chave Pix cadastrada no perfil
  if (rawPixKey) {
    const valResult = validateAndFormatPixKey(rawPixKey, rawPixKeyType);
    if (valResult.valid && valResult.formattedKey && valResult.type) {
      return {
        value: Number(amount.toFixed(2)),
        pixAddressKey: valResult.formattedKey,
        pixAddressKeyType: valResult.type,
        description: desc
      };
    }
  }

  // 2. Se houver CPF/CNPJ válido cadastrado
  if (rawCpfCnpj && (rawCpfCnpj.length === 11 || rawCpfCnpj.length === 14) && validateCpfCnpjDigits(rawCpfCnpj)) {
    return {
      value: Number(amount.toFixed(2)),
      pixAddressKey: rawCpfCnpj,
      pixAddressKeyType: rawCpfCnpj.length === 11 ? 'CPF' : 'CNPJ',
      description: desc
    };
  }

  // 3. Se houver e-mail válido
  if (rawEmail && rawEmail.includes('@') && rawEmail.includes('.')) {
    return {
      value: Number(amount.toFixed(2)),
      pixAddressKey: rawEmail.toLowerCase(),
      pixAddressKeyType: 'EMAIL',
      description: desc
    };
  }

  // 4. Se houver WalletId do Asaas
  if (rawWalletId && rawWalletId.length >= 10) {
    return {
      value: Number(amount.toFixed(2)),
      walletId: rawWalletId,
      description: desc
    };
  }

  return null;
}

