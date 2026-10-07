// Versão vigente dos textos legais (docs/legal/). Fonte única para cadastro,
// /api/terms/accept, /api/terms/status e /api/asaas/subaccount.
// Ao mudar qualquer texto em docs/legal/, atualize esta data: todos os usuários
// terão de aceitar de novo no próximo acesso.
export const CURRENT_TERMS_VERSION = '2026-10-06';

export const LEGAL_DOCUMENTS = [
  'acaifood_terms',
  'acaifood_privacy',
  'asaas_terms',
  'asaas_privacy',
  'subaccount_mandate',
  'pix_random_key_consent'
] as const;

export type LegalDocument = typeof LEGAL_DOCUMENTS[number];

// Cliente (pagador) e admin
export const CLIENT_REQUIRED_DOCS: LegalDocument[] = [
  'acaifood_terms',
  'acaifood_privacy',
  'asaas_terms',
  'asaas_privacy'
];

// Parceiros (loja/batedeira, fornecedor, motoboy, caminhão): cl. 8.2.4 do contrato BaaS
export const PARTNER_REQUIRED_DOCS: LegalDocument[] = [
  ...CLIENT_REQUIRED_DOCS,
  'subaccount_mandate',
  'pix_random_key_consent'
];

// Mínimo exigido para abrir a subconta Asaas
export const SUBACCOUNT_REQUIRED_DOCS: LegalDocument[] = [
  'asaas_terms',
  'subaccount_mandate',
  'pix_random_key_consent'
];

export function isPartnerDbRole(role: string | null | undefined): boolean {
  const r = String(role || '').toUpperCase();
  return ['PARTNER', 'SUPPLIER', 'COURIER', 'LOJA', 'BATEDEIRA', 'FORNECEDOR', 'MOTORISTA', 'MOTOBOY', 'CAMINHAO', 'DRIVER'].includes(r);
}
