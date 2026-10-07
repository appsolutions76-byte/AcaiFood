import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { authorizeRequest, unauthorizedResponse } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, ['admin']);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'json';
    const month = searchParams.get('month') || new Date().toISOString().slice(0, 7); // 'YYYY-MM'
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      return NextResponse.json({ error: 'Mês no formato AAAA-MM' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const startDate = `${month}-01T00:00:00.000Z`;
    const nextMonthYear = parseInt(month.split('-')[1]) === 12 ? parseInt(month.split('-')[0]) + 1 : parseInt(month.split('-')[0]);
    const nextMonthNum = parseInt(month.split('-')[1]) === 12 ? 1 : parseInt(month.split('-')[1]) + 1;
    const endDate = `${nextMonthYear}-${String(nextMonthNum).padStart(2, '0')}-01T00:00:00.000Z`;

    // 1. Buscar chamados de suporte do período
    const { data: tickets, error: ticketErr } = await supabase
      .from('support_messages')
      .select('*')
      .gte('created_at', startDate)
      .lt('created_at', endDate);

    if (ticketErr) {
      return NextResponse.json({ error: ticketErr.message }, { status: 500 });
    }

    const allTickets = tickets || [];
    const totalTickets = allTickets.length;
    const closedTickets = allTickets.filter(t => t.status === 'resolvido');
    const openTickets = allTickets.filter(t => t.status !== 'resolvido');
    const meritedTickets = allTickets.filter(t => t.is_merited === true);
    const forwardedToAsaas = allTickets.filter(t => t.forwarded_to_asaas === true || t.category === 'financeiro');

    // Calcular tempo médio de resposta e de resolução
    let totalFirstResponseMinutes = 0;
    let countedFirstResponse = 0;
    let totalResolutionMinutes = 0;
    let countedResolution = 0;

    for (const t of allTickets) {
      if (t.first_responded_at && t.created_at) {
        const diff = (new Date(t.first_responded_at).getTime() - new Date(t.created_at).getTime()) / (1000 * 60);
        if (diff >= 0) {
          totalFirstResponseMinutes += diff;
          countedFirstResponse++;
        }
      }
      if (t.resolved_at && t.created_at) {
        const diff = (new Date(t.resolved_at).getTime() - new Date(t.created_at).getTime()) / (1000 * 60);
        if (diff >= 0) {
          totalResolutionMinutes += diff;
          countedResolution++;
        }
      }
    }

    const avgFirstResponseHours = countedFirstResponse > 0 ? (totalFirstResponseMinutes / countedFirstResponse / 60).toFixed(1) : 'N/A';
    const avgResolutionHours = countedResolution > 0 ? (totalResolutionMinutes / countedResolution / 60).toFixed(1) : 'N/A';

    // 2. Disponibilidade medida (tabela monthly_sla, informada no admin). Sem valor: "não medido".
    let uptimeEstimate = 'não medido';
    try {
      const { data: slaRow } = await supabase
        .from('monthly_sla')
        .select('uptime_percent, source')
        .eq('month', String(month).slice(0, 7))
        .maybeSingle();
      if (slaRow && slaRow.uptime_percent !== null && slaRow.uptime_percent !== undefined) {
        uptimeEstimate = `${Number(slaRow.uptime_percent).toFixed(3).replace('.', ',')}% (fonte: ${slaRow.source})`;
      }
    } catch (_e) {}

    const reportData = {
      period: month,
      generatedAt: new Date().toISOString(),
      serviceProvider: 'Eletromecânica Baia Ltda (CNPJ 42.035.623/0001-40)',
      financialPartner: 'ASAAS GESTÃO FINANCEIRA INSTITUIÇÃO DE PAGAMENTO S.A. (CNPJ 19.540.550/0001-21)',
      metrics: {
        totalTickets,
        openTickets: openTickets.length,
        closedTickets: closedTickets.length,
        meritedTickets: meritedTickets.length,
        forwardedToAsaas: forwardedToAsaas.length,
        avgFirstResponseHours,
        avgResolutionHours,
        uptimeAvailability: uptimeEstimate
      },
      ticketsSummary: allTickets.map(t => ({
        id: t.id,
        user_name: t.user_name,
        user_role: t.user_role,
        category: t.category || 'geral',
        status: t.status,
        forwarded_to_asaas: Boolean(t.forwarded_to_asaas),
        asaas_protocol: t.asaas_protocol || null,
        is_merited: t.is_merited,
        created_at: t.created_at,
        resolved_at: t.resolved_at
      }))
    };

    if (format === 'csv') {
      const rows: string[] = [];
      rows.push('RELATÓRIO MENSAL DE ATENDIMENTO E CONFORMIDADE ASAAS BAAS (CLÁUSULA 11)');
      rows.push(`Mês de Referência;${month}`);
      rows.push(`Titular da Plataforma;Eletromecânica Baia Ltda (CNPJ 42.035.623/0001-40)`);
      rows.push(`Parceiro Financeiro;ASAAS GESTÃO FINANCEIRA S.A. (CNPJ 19.540.550/0001-21)`);
      rows.push(`Disponibilidade da API / Uptime;${uptimeEstimate}`);
      rows.push('');
      rows.push(`Total de Chamados Abertos;${totalTickets}`);
      rows.push(`Chamados Resolvidos;${closedTickets.length}`);
      rows.push(`Chamados Pendentes;${openTickets.length}`);
      rows.push(`Reclamações Procedentes;${meritedTickets.length}`);
      rows.push(`Encaminhados ao Asaas;${forwardedToAsaas.length}`);
      rows.push(`Tempo Médio 1ª Resposta (h);${avgFirstResponseHours}`);
      rows.push(`Tempo Médio de Solução (h);${avgResolutionHours}`);
      rows.push('');
      rows.push('ID_CHAMADO;NOME_USUARIO;PERFIL;CATEGORIA;STATUS;ENCAMINHADO_ASAAS;PROTOCOLO_ASAAS;PROCEDENTE;CRIADO_EM;RESOLVIDO_EM');

      for (const t of allTickets) {
        rows.push([
          `"${t.id}"`,
          `"${(t.user_name || '').replace(/"/g, '""')}"`,
          `"${t.user_role || ''}"`,
          `"${t.category || 'geral'}"`,
          `"${t.status}"`,
          `"${t.forwarded_to_asaas ? 'SIM' : 'NAO'}"`,
          `"${t.asaas_protocol || ''}"`,
          `"${t.is_merited === true ? 'SIM' : t.is_merited === false ? 'NAO' : 'EM_ANALISE'}"`,
          `"${t.created_at || ''}"`,
          `"${t.resolved_at || ''}"`
        ].join(';'));
      }

      const csvContent = '\uFEFF' + rows.join('\r\n');
      return new Response(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="relatorio_mensal_asaas_${month}.csv"`
        }
      });
    }

    return NextResponse.json({ success: true, report: reportData });

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao gerar relatório mensal' }, { status: 500 });
  }
}
