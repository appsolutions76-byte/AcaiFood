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

  // Repasse/saque SOMENTE para a subconta Asaas aprovada do parceiro (transferência entre
  // Contas Asaas por walletId — cl. 2.1, 6.3 e 6.4 do contrato BaaS). Chave Pix digitada,
  // CPF/CNPJ ou e-mail NUNCA são usados como destino.
  const rawWalletId = String(partnerUser.asaas_wallet_id || partnerUser.asaasWalletId || '').trim();
  const accountStatus = String(partnerUser.asaas_account_status || '').toUpperCase();
  const desc = descriptionStr || `Repasse AçaíFood - ${partnerUser.name || 'Parceiro'}`;

  if (accountStatus === 'APPROVED' && rawWalletId && rawWalletId.length >= 10) {
    return {
      value: Number(amount.toFixed(2)),
      walletId: rawWalletId,
      description: desc
    };
  }

  return null;
}

/**
 * Constrói payload de transferência Pix disparado a partir da subconta Asaas do parceiro
 * diretamente para a sua chave Pix bancária externa de mesma titularidade.
 */
export function buildSubaccountPixTransferPayload(
  partnerUser: any,
  netAmount: number,
  descriptionStr?: string
): { payload: any; formattedKey?: string; keyType?: string; error?: string } {
  if (!partnerUser || netAmount <= 0) {
    return { payload: null, error: 'Usuário parceiro ou valor líquido inválido.' };
  }

  // Chave Pix do parceiro (prioriza chave cadastrada ou CPF/CNPJ de mesma titularidade)
  const rawKey = String(partnerUser.pix_key || partnerUser.pixKey || partnerUser.cpf_cnpj || partnerUser.cpfCnpj || '').trim();
  if (!rawKey) {
    return { payload: null, error: 'Chave Pix não encontrada no cadastro do parceiro.' };
  }

  const validated = validateAndFormatPixKey(rawKey, partnerUser.pix_key_type || partnerUser.pixKeyType);
  if (!validated.valid || !validated.formattedKey) {
    return { payload: null, error: validated.error || 'Chave Pix do parceiro é inválida.' };
  }

  return {
    formattedKey: validated.formattedKey,
    keyType: validated.type,
    payload: {
      value: Number(netAmount.toFixed(2)),
      operationType: 'PIX',
      pixAddressKey: validated.formattedKey,
      pixAddressKeyType: validated.type,
      description: descriptionStr || `Saque AçaíFood Pix - ${partnerUser.name || 'Parceiro'}`
    }
  };
}


