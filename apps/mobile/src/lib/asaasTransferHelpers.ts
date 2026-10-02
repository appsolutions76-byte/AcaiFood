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

  const rawWalletId = String(partnerUser.asaas_wallet_id || partnerUser.asaasWalletId || '').trim();
  const accountStatus = String(partnerUser.asaas_account_status || '').toUpperCase();

  // Exclusivamente para walletId de subconta Asaas aprovada (Cláusula 6.4 e 2.1)
  if (rawWalletId && rawWalletId.length >= 10 && (accountStatus === 'APPROVED' || partnerUser.split_enabled === true)) {
    return {
      value: Number(amount.toFixed(2)),
      walletId: rawWalletId,
      description: descriptionStr || `Repasse AçaíFood - ${partnerUser.name || 'Parceiro'}`
    };
  }

  return null;
}

