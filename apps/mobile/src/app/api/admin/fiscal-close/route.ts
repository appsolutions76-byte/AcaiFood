import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { authorizeRequest, unauthorizedResponse } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

/**
 * R43 — Fechamento mensal para notas fiscais (somente leitura).
 * Soma, por parceiro, o que cada um pagou à plataforma no mês (comissões), a partir dos
 * valores congelados em cada pedido no pagamento (pricing_snapshot / colunas *_amount).
 * Competência = data de conclusão do pedido (received_at), no fuso de Belém (UTC-3).
 * Só pedidos concluídos (RECEIVED / COMPLETED). Cancelados e estornados ficam fora.
 */

type PartnerRow = {
  partnerId: string;
  papel: 'VENDEDOR' | 'ENTREGADOR';
  tipo: string;
  nome: string;
  documento: string;
  email: string;
  telefone: string;
  cidade: string;
  pedidos: number;
  valorBase: number;          // vendas (vendedor) ou fretes (entregador)
  comissao: number;           // base sugerida para a nota: comissão bruta cobrada do parceiro
  tarifaAsaas: number;        // parte da tarifa Pix Asaas paga pelo parceiro
  freteSubsidiado: number;    // frete pago pela loja (vendedor)
  repasseLiquido: number;     // o que o parceiro recebeu
  pedidosEstimados: number;   // pedidos antigos sem valores gravados (estimativa)
};

const DONE_STATUSES = ['RECEIVED', 'COMPLETED'];
const num = (v: any) => (v === null || v === undefined || v === '' || isNaN(Number(v))) ? null : Number(v);
const r2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

function monthRange(month: string) {
  const [y, m] = month.split('-').map(Number);
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  // 00:00 em Belém (UTC-3) = 03:00 UTC
  return {
    start: `${y}-${String(m).padStart(2, '0')}-01T03:00:00.000Z`,
    end: `${ny}-${String(nm).padStart(2, '0')}-01T03:00:00.000Z`,
  };
}

function roleLabel(role: string, vehicle?: string | null) {
  const r = String(role || '').toUpperCase();
  if (r === 'PARTNER' || r === 'LOJA' || r === 'BATEDEIRA') return 'Batedeira';
  if (r === 'SUPPLIER' || r === 'FORNECEDOR') return 'Fornecedor';
  if (r === 'COURIER' || r === 'MOTORISTA' || r === 'MOTOBOY' || r === 'DRIVER' || r === 'CAMINHAO') {
    const v = String(vehicle || '').toUpperCase();
    if (v === 'TRUCK') return 'Caminhão';
    if (v === 'DUMP_TRUCK') return 'Caçamba';
    return 'Motoboy';
  }
  return 'Outro';
}

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, ['admin']);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'json';
    const month = searchParams.get('month') || new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 7);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      return NextResponse.json({ error: 'Mês no formato AAAA-MM' }, { status: 400 });
    }
    const { start, end } = monthRange(month);
    const supabase = getSupabaseAdmin();

    // 1. Pedidos concluídos na competência (paginado, sem limite de 200)
    const fields = 'id, order_type, status, created_at, received_at, products_subtotal, delivery_fee_amount, platform_fee_amount, seller_payout_amount, driver_payout_amount, asaas_fee_amount, pricing_snapshot, applied_platform_fee_percent, applied_delivery_platform_fee_percent, seller_storefront_id, buyer_id, driver_id';
    const orders: any[] = [];
    const pageSize = 1000;
    for (let from = 0; from < 50000; from += pageSize) {
      const { data, error } = await supabase
        .from('orders')
        .select(fields)
        .in('status', DONE_STATUSES)
        .or(`and(received_at.gte.${start},received_at.lt.${end}),and(received_at.is.null,created_at.gte.${start},created_at.lt.${end})`)
        .order('created_at', { ascending: true })
        .range(from, from + pageSize - 1);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      orders.push(...(data || []));
      if (!data || data.length < pageSize) break;
    }

    // 2. Dono de cada vitrine (vendedor)
    const sfIds = Array.from(new Set(orders.map(o => o.seller_storefront_id).filter(Boolean)));
    const sfMap: Record<string, { partner_id: string; store_name: string }> = {};
    for (let i = 0; i < sfIds.length; i += 200) {
      const { data } = await supabase.from('storefronts').select('id, partner_id, store_name').in('id', sfIds.slice(i, i + 200));
      (data || []).forEach((sf: any) => { sfMap[sf.id] = { partner_id: sf.partner_id, store_name: sf.store_name }; });
    }

    // 3. Agregação por parceiro
    const acc: Record<string, PartnerRow> = {};
    const ensure = (partnerId: string, papel: PartnerRow['papel']) => {
      const key = `${papel}:${partnerId}`;
      if (!acc[key]) {
        acc[key] = { partnerId, papel, tipo: '', nome: '', documento: '', email: '', telefone: '', cidade: '', pedidos: 0, valorBase: 0, comissao: 0, tarifaAsaas: 0, freteSubsidiado: 0, repasseLiquido: 0, pedidosEstimados: 0 };
      }
      return acc[key];
    };

    let totalComissaoVendas = 0, totalComissaoFrete = 0, totalAsaas = 0, totalAsaasPlataforma = 0, totalProdutos = 0, totalFretes = 0, pedidosEstimados = 0;

    for (const o of orders) {
      const type = String(o.order_type || 'B2C').toUpperCase();
      const ps = o.pricing_snapshot && typeof o.pricing_snapshot === 'object' ? o.pricing_snapshot : null;
      const hasSnap = !!ps && num(ps.netSellerPayout) !== null && num(ps.netDriverPayout) !== null;

      const produtos = num(o.products_subtotal) ?? 0;
      let frete: number, comVenda: number, comFrete: number, asaasSeller: number, asaasDriver: number, asaasPlat: number, freteLoja: number;
      if (hasSnap) {
        frete = num(ps.deliveryTotal) ?? num(o.delivery_fee_amount) ?? 0;
        comVenda = num(ps.platformSalesFee) ?? 0;
        comFrete = num(ps.platformDeliveryFee) ?? 0;
        asaasSeller = num(ps.asaasFeeSeller) ?? 0;
        asaasDriver = num(ps.asaasFeeDriver) ?? 0;
        asaasPlat = num(ps.asaasFeePlatform) ?? 0;
        freteLoja = num(ps.storeDeliveryFee) ?? 0;
      } else {
        // Pedido antigo sem snapshot: estimativa pelos percentuais gravados no pedido
        frete = num(o.delivery_fee_amount) ?? 0;
        comVenda = type === 'COLETA' ? 0 : r2(produtos * (num(o.applied_platform_fee_percent) ?? 0) / 100);
        comFrete = r2(frete * (num(o.applied_delivery_platform_fee_percent) ?? 0) / 100);
        asaasSeller = 0; asaasDriver = 0; asaasPlat = 0; freteLoja = 0;
        pedidosEstimados++;
      }
      const asaasTotal = num(o.asaas_fee_amount) ?? (hasSnap ? (num(ps.asaasPixFeeFixed) ?? 0) : 0);

      totalProdutos += type === 'COLETA' ? 0 : produtos;
      totalFretes += frete;
      totalComissaoVendas += comVenda;
      totalComissaoFrete += comFrete;
      totalAsaas += asaasTotal;
      totalAsaasPlataforma += asaasPlat;

      // Vendedor (loja na B2C, fornecedor na B2B)
      const sellerId = o.seller_storefront_id ? sfMap[o.seller_storefront_id]?.partner_id : null;
      if (sellerId && type !== 'COLETA') {
        const row = ensure(sellerId, 'VENDEDOR');
        row.pedidos++;
        row.valorBase += produtos;
        row.comissao += comVenda;
        row.tarifaAsaas += asaasSeller;
        row.freteSubsidiado += freteLoja;
        row.repasseLiquido += num(o.seller_payout_amount) ?? (hasSnap ? (num(ps.netSellerPayout) ?? 0) : r2(produtos - comVenda));
        if (!hasSnap) row.pedidosEstimados++;
        if (!row.nome && o.seller_storefront_id) row.nome = sfMap[o.seller_storefront_id]?.store_name || '';
      }

      // Entregador
      if (o.driver_id) {
        const row = ensure(o.driver_id, 'ENTREGADOR');
        row.pedidos++;
        row.valorBase += frete;
        row.comissao += comFrete;
        row.tarifaAsaas += asaasDriver;
        row.repasseLiquido += num(o.driver_payout_amount) ?? (hasSnap ? (num(ps.netDriverPayout) ?? 0) : r2(frete - comFrete));
        if (!hasSnap) row.pedidosEstimados++;
      }
    }

    // 4. Dados cadastrais dos parceiros (para a nota)
    const partnerIds = Array.from(new Set(Object.values(acc).map(r => r.partnerId)));
    for (let i = 0; i < partnerIds.length; i += 200) {
      const { data } = await supabase
        .from('users')
        .select('id, name, role, vehicle_type, cpf_cnpj, email, phone, telefone, cidade')
        .in('id', partnerIds.slice(i, i + 200));
      (data || []).forEach((u: any) => {
        Object.values(acc).filter(r => r.partnerId === u.id).forEach(r => {
          r.tipo = roleLabel(u.role, u.vehicle_type);
          r.nome = r.nome || u.name || '';
          r.documento = u.cpf_cnpj || '';
          r.email = u.email || '';
          r.telefone = u.telefone || u.phone || '';
          r.cidade = u.cidade || '';
        });
      });
    }

    const partners = Object.values(acc)
      .map(r => ({ ...r, valorBase: r2(r.valorBase), comissao: r2(r.comissao), tarifaAsaas: r2(r.tarifaAsaas), freteSubsidiado: r2(r.freteSubsidiado), repasseLiquido: r2(r.repasseLiquido), tipo: r.tipo || (r.papel === 'VENDEDOR' ? 'Batedeira' : 'Motoboy') }))
      .sort((a, b) => a.tipo.localeCompare(b.tipo) || b.comissao - a.comissao);

    const totals = {
      pedidos: orders.length,
      pedidosEstimados,
      produtos: r2(totalProdutos),
      fretes: r2(totalFretes),
      comissaoVendas: r2(totalComissaoVendas),
      comissaoFrete: r2(totalComissaoFrete),
      comissaoTotal: r2(totalComissaoVendas + totalComissaoFrete),
      tarifaAsaasTotal: r2(totalAsaas),
      tarifaAsaasPlataforma: r2(totalAsaasPlataforma),
      receitaLiquida: r2(totalComissaoVendas + totalComissaoFrete - totalAsaasPlataforma),
    };

    if (format === 'csv') {
      const money = (v: number) => v.toFixed(2).replace('.', ',');
      const esc = (s: string) => `"${String(s || '').replace(/"/g, '""')}"`;
      const lines: string[] = [];
      lines.push(`FECHAMENTO MENSAL AÇAÍFOOD — BASE PARA NOTAS FISCAIS;${month}`);
      lines.push('Competência: data de conclusão do pedido (horário de Belém). Só pedidos concluídos.');
      lines.push('');
      lines.push('TIPO;PAPEL;NOME;CPF/CNPJ;E-MAIL;TELEFONE;CIDADE;PEDIDOS;VENDAS OU FRETES (R$);VALOR DA NOTA (R$);TARIFA ASAAS PAGA PELO PARCEIRO (R$);FRETE PAGO PELA LOJA (R$);REPASSE LIQUIDO (R$);PEDIDOS ESTIMADOS');
      for (const p of partners) {
        lines.push([
          esc(p.tipo), esc(p.papel === 'VENDEDOR' ? 'Vendedor' : 'Entregador'), esc(p.nome), esc(p.documento), esc(p.email), esc(p.telefone), esc(p.cidade),
          String(p.pedidos), money(p.valorBase), money(p.comissao), money(p.tarifaAsaas), money(p.freteSubsidiado), money(p.repasseLiquido), String(p.pedidosEstimados)
        ].join(';'));
      }
      lines.push('');
      lines.push(`TOTAL PEDIDOS CONCLUIDOS;${totals.pedidos}`);
      lines.push(`COMISSAO DE VENDAS (R$);${money(totals.comissaoVendas)}`);
      lines.push(`COMISSAO DE FRETE (R$);${money(totals.comissaoFrete)}`);
      lines.push(`COMISSAO TOTAL (R$);${money(totals.comissaoTotal)}`);
      lines.push(`TARIFA ASAAS TOTAL (R$);${money(totals.tarifaAsaasTotal)}`);
      lines.push(`TARIFA ASAAS PAGA PELA PLATAFORMA (R$);${money(totals.tarifaAsaasPlataforma)}`);
      lines.push(`RECEITA LIQUIDA DA PLATAFORMA (R$);${money(totals.receitaLiquida)}`);
      return new Response('﻿' + lines.join('\r\n'), {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="fechamento_notas_fiscais_${month}.csv"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    return NextResponse.json({ success: true, month, partners, totals });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erro ao gerar o fechamento mensal' }, { status: 500 });
  }
}
