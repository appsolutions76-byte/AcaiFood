import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { authorizeRequest, unauthorizedResponse } from '@/lib/apiAuth';
import { ORDER_FINANCE_FIELDS, orderFinance, r2, belemPeriodStart } from '@/lib/orderFinance';

export const dynamic = 'force-dynamic';

/**
 * R44 — Números da Visão Geral do admin calculados no servidor, com TODOS os pedidos do período
 * (a tela antes usava só os 200 pedidos mais recentes carregados no navegador).
 * Período pela data de criação do pedido, no horário de Belém. Valores financeiros só de concluídos.
 */

const ACCEPTED = ['PREPARING', 'READY', 'SEARCHING_OPERATOR', 'IN_TRANSIT', 'DELIVERING', 'DELIVERED', 'RECEIVED', 'COMPLETED'];
const IN_ROUTE = ['IN_TRANSIT', 'DELIVERING', 'DELIVERED'];
const DONE = ['RECEIVED', 'COMPLETED'];
const CANCELLED = ['CANCELLED', 'CANCELED', 'REFUND_REQUESTED', 'REFUNDED'];

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, ['admin']);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  try {
    const { searchParams } = new URL(request.url);
    const period = (searchParams.get('period') || 'historical') as 'historical' | 'monthly' | 'daily';
    if (!['historical', 'monthly', 'daily'].includes(period)) {
      return NextResponse.json({ error: 'Período inválido' }, { status: 400 });
    }
    const since = period === 'historical' ? null : belemPeriodStart(period);
    const supabase = getSupabaseAdmin();

    const countWhere = async (statuses?: string[]) => {
      let q = supabase.from('orders').select('id', { count: 'exact', head: true });
      if (since) q = q.gte('created_at', since);
      if (statuses) q = q.in('status', statuses);
      const { count, error } = await q;
      if (error) throw error;
      return count || 0;
    };

    const [total, aceitos, emRota, concluidos, cancelados] = await Promise.all([
      countWhere(), countWhere(ACCEPTED), countWhere(IN_ROUTE), countWhere(DONE), countWhere(CANCELLED),
    ]);

    // Valores: todos os concluídos do período (paginado)
    const done: any[] = [];
    for (let from = 0; from < 100000; from += 1000) {
      let q = supabase.from('orders').select(ORDER_FINANCE_FIELDS).in('status', DONE).order('created_at', { ascending: true }).range(from, from + 999);
      if (since) q = q.gte('created_at', since);
      const { data, error } = await q;
      if (error) throw error;
      done.push(...(data || []));
      if (!data || data.length < 1000) break;
    }

    // Tipo de veículo dos entregadores (moto x caminhão)
    const driverIds = Array.from(new Set(done.map(o => o.driver_id).filter(Boolean)));
    const vehicle: Record<string, string> = {};
    for (let i = 0; i < driverIds.length; i += 200) {
      const { data } = await supabase.from('users').select('id, vehicle_type').in('id', driverIds.slice(i, i + 200));
      (data || []).forEach((u: any) => { vehicle[u.id] = String(u.vehicle_type || '').toUpperCase(); });
    }

    let volume = 0, receitaLiquida = 0, comissaoBruta = 0, tarifaAsaas = 0, comissaoVendas = 0, comissaoFrete = 0, tarifaAsaasPlataforma = 0;
    let batBruto = 0, batLiq = 0, fornBruto = 0, fornLiq = 0, motBruto = 0, motLiq = 0, camBruto = 0, camLiq = 0;
    for (const o of done) {
      const f = orderFinance(o);
      volume += f.produtos + f.frete;
      receitaLiquida += f.receitaLiquida;
      comissaoBruta += f.comissaoVenda + f.comissaoFrete;
      comissaoVendas += f.comissaoVenda;
      comissaoFrete += f.comissaoFrete;
      tarifaAsaasPlataforma += f.asaasPlataforma;
      tarifaAsaas += f.asaasTotal;
      if (f.type === 'B2C') { batBruto += f.produtos; batLiq += f.repasseVendedor; }
      else if (f.type === 'B2B') { fornBruto += f.produtos; fornLiq += f.repasseVendedor; }
      if (o.driver_id) {
        const v = vehicle[o.driver_id] || '';
        if (v === 'TRUCK' || v === 'DUMP_TRUCK') { camBruto += f.frete; camLiq += f.repasseEntregador; }
        else { motBruto += f.frete; motLiq += f.repasseEntregador; }
      }
    }

    return NextResponse.json({
      success: true,
      period,
      since,
      stats: {
        ordersCount: total,
        aceitos,
        emRota,
        concluidosCount: concluidos,
        cancelados,
        volume: r2(volume),
        appRev: r2(receitaLiquida),
        comissaoBruta: r2(comissaoBruta),
        comissaoVendas: r2(comissaoVendas),
        comissaoFrete: r2(comissaoFrete),
        tarifaAsaasPlataforma: r2(tarifaAsaasPlataforma),
        tarifaAsaas: r2(tarifaAsaas),
        batBruto: r2(batBruto), batLiq: r2(batLiq),
        fornBruto: r2(fornBruto), fornLiq: r2(fornLiq),
        motBruto: r2(motBruto), motLiq: r2(motLiq),
        camBruto: r2(camBruto), camLiq: r2(camLiq),
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erro ao calcular a visão geral' }, { status: 500 });
  }
}
