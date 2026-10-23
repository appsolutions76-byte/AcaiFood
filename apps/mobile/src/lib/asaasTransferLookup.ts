/**
 * Consulta de transferências no Asaas por externalReference (idempotência).
 *
 * A listagem GET /transfers do Asaas não garante filtro por externalReference,
 * então a busca pagina a lista (a partir da data informada) e compara a referência
 * exata no código. O resultado distingue "não encontrada" (ok=true, transfer=null)
 * de "não foi possível consultar" (ok=false): quem chama NUNCA deve enviar dinheiro
 * quando ok=false, porque uma tentativa anterior pode ter sido aceita.
 */

export const TRANSFER_DONE_STATUSES = ['DONE', 'COMPLETED', 'CONFIRMED'];
export const TRANSFER_FAILED_STATUSES = ['FAILED', 'CANCELLED', 'CANCELED', 'REJECTED', 'REFUSED', 'BLOCKED'];

export function isTransferDone(status?: string | null): boolean {
  return TRANSFER_DONE_STATUSES.includes(String(status || '').toUpperCase());
}

export function isTransferFailed(status?: string | null): boolean {
  return TRANSFER_FAILED_STATUSES.includes(String(status || '').toUpperCase());
}

export interface TransferLookupResult {
  ok: boolean;
  transfer: any | null;
  error?: string;
}

function toAsaasDate(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  // Margem de 1 dia para cobrir diferença de fuso entre o banco e o Asaas
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().split('T')[0];
}

/**
 * Procura uma transferência ativa (não falha/cancelada) com a externalReference exata.
 */
export async function findTransferByExternalRef(
  baseUrl: string,
  apiKey: string,
  externalRef: string,
  sinceIso?: string | null,
  maxPages = 5
): Promise<TransferLookupResult> {
  const since = toAsaasDate(sinceIso);
  const limit = 100;

  for (let page = 0; page < maxPages; page++) {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    params.set('offset', String(page * limit));
    params.set('externalReference', externalRef);
    if (since) params.set('dateCreated[ge]', since);

    let data: any = null;
    try {
      const res = await fetch(`${baseUrl}/transfers?${params.toString()}`, {
        headers: { access_token: apiKey, 'Content-Type': 'application/json' },
        cache: 'no-store'
      });
      if (!res.ok) {
        return { ok: false, transfer: null, error: `Asaas respondeu HTTP ${res.status} ao listar transferências` };
      }
      data = await res.json();
    } catch (err: any) {
      return { ok: false, transfer: null, error: err?.message || 'Falha de rede ao consultar transferências' };
    }

    const list: any[] = Array.isArray(data?.data) ? data.data : [];
    const match = list.find(
      (t: any) => String(t?.externalReference || '') === externalRef && !isTransferFailed(t?.status)
    );
    if (match) return { ok: true, transfer: match };

    if (!data?.hasMore || list.length < limit) {
      return { ok: true, transfer: null };
    }
  }

  // Lista longa demais para varrer: não dá para afirmar que não existe
  return { ok: false, transfer: null, error: 'Lista de transferências extensa demais para confirmar idempotência' };
}

/**
 * Lê uma transferência pelo id. ok=false quando a consulta falha.
 */
export async function getTransferById(
  baseUrl: string,
  apiKey: string,
  transferId: string
): Promise<TransferLookupResult> {
  try {
    const res = await fetch(`${baseUrl}/transfers/${encodeURIComponent(transferId)}`, {
      headers: { access_token: apiKey, 'Content-Type': 'application/json' },
      cache: 'no-store'
    });
    if (!res.ok) {
      return { ok: false, transfer: null, error: `Asaas respondeu HTTP ${res.status} ao consultar a transferência` };
    }
    const data = await res.json();
    return { ok: true, transfer: data };
  } catch (err: any) {
    return { ok: false, transfer: null, error: err?.message || 'Falha de rede ao consultar a transferência' };
  }
}

export function describeAsaasError(data: any, httpStatus: number): string {
  if (Array.isArray(data?.errors) && data.errors.length > 0) {
    return data.errors.map((e: any) => e?.description).filter(Boolean).join(', ') || `Erro HTTP ${httpStatus} no Asaas`;
  }
  return data?.message || `Erro HTTP ${httpStatus} no Asaas`;
}
