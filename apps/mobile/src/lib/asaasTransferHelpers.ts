export interface AsaasTransferPayload {
  value: number;
  pixAddressKey?: string;
  pixAddressKeyType?: 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'EVP';
  walletId?: string;
  description?: string;
}

export function detectPixKeyType(keyStr: string): 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'EVP' {
  const clean = String(keyStr || '').trim();
  const digits = clean.replace(/\D/g, '');

  if (clean.includes('@')) return 'EMAIL';
  if (digits.length === 11) return 'CPF';
  if (digits.length === 14) return 'CNPJ';
  if (digits.length >= 10 && digits.length <= 13 && clean.startsWith('+')) return 'PHONE';
  if (digits.length >= 10 && digits.length <= 11) return 'PHONE';

  return 'EVP';
}

export function buildAsaasTransferPayload(
  partnerUser: any,
  amount: number,
  descriptionStr?: string
): AsaasTransferPayload | null {
  if (!partnerUser || amount <= 0) return null;

  const rawPixKey = String(partnerUser.pix_key || partnerUser.pixKey || '').trim();
  const rawCpfCnpj = String(partnerUser.cpf_cnpj || partnerUser.cpfCnpj || '').replace(/\D/g, '');
  const rawEmail = String(partnerUser.email || '').trim();
  const rawWalletId = String(partnerUser.asaas_wallet_id || partnerUser.asaasWalletId || '').trim();

  const desc = descriptionStr || `Repasse AçaíFood - ${partnerUser.name || 'Parceiro'}`;

  // 1. Se houver chave Pix explícita
  if (rawPixKey && rawPixKey.length >= 5) {
    const keyType = detectPixKeyType(rawPixKey);
    const pixVal = (keyType === 'CPF' || keyType === 'CNPJ') ? rawPixKey.replace(/\D/g, '') : rawPixKey;
    return {
      value: amount,
      pixAddressKey: pixVal,
      pixAddressKeyType: keyType,
      description: desc
    };
  }

  // 2. Se houver CPF/CNPJ válido cadastrado
  if (rawCpfCnpj.length === 11 || rawCpfCnpj.length === 14) {
    return {
      value: amount,
      pixAddressKey: rawCpfCnpj,
      pixAddressKeyType: rawCpfCnpj.length === 11 ? 'CPF' : 'CNPJ',
      description: desc
    };
  }

  // 3. Se houver e-mail
  if (rawEmail && rawEmail.includes('@')) {
    return {
      value: amount,
      pixAddressKey: rawEmail,
      pixAddressKeyType: 'EMAIL',
      description: desc
    };
  }

  // 4. Se houver WalletId do Asaas
  if (rawWalletId && rawWalletId.length >= 10) {
    return {
      value: amount,
      walletId: rawWalletId,
      description: desc
    };
  }

  return null;
}
