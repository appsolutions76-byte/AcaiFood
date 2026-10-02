import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { authorizeRequest, unauthorizedResponse } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, ['admin']);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  try {
    const supabase = getSupabaseAdmin();

    const { data: users, error } = await supabase
      .from('users')
      .select('id, name, email, role, cpf_cnpj, telefone, endereco, bairro, cidade, created_at, asaas_wallet_id, asaas_account_id, birth_date, monthly_income, company_type, postal_code')
      .not('asaas_account_id', 'is', null)
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Filtrar subcontas que foram criadas antes de 02/10 ou que tenham dados legados
    const cutoffDate = new Date('2026-10-02T23:59:59Z');
    const legacyAccounts = (users || []).filter(u => {
      const createdAt = new Date(u.created_at || 0);
      const isLegacyDate = createdAt <= cutoffDate;
      const isDefaultData = u.birth_date === '1990-01-01' || u.monthly_income === 3000 || u.company_type === 'MEI';
      const isMissingKyc = !u.birth_date || !u.monthly_income || !u.postal_code;
      return isLegacyDate || isDefaultData || isMissingKyc;
    });

    const csvRows: string[] = [];
    csvRows.push('ID_USUARIO;NOME;EMAIL;ROLE;CPF_CNPJ;TELEFONE;ENDERECO;BAIRRO;CIDADE;CEP_REGULARIZAR;DATA_NASCIMENTO_REGULARIZAR;RENDA_FATURAMENTO_REGULARIZAR;TIPO_EMPRESA_REGULARIZAR;ASAAS_ACCOUNT_ID;ASAAS_WALLET_ID;DATA_CRIACAO;STATUS_REGULARIZACAO');

    for (const u of legacyAccounts) {
      const cleanCpfCnpj = String(u.cpf_cnpj || '').replace(/\D/g, '');
      const isCnpj = cleanCpfCnpj.length === 14;

      const birthDate = u.birth_date || '1990-01-01';
      const income = u.monthly_income || 3000;
      const companyType = isCnpj ? (u.company_type || 'MEI') : 'N/A_CPF';
      const cep = u.postal_code || '66000-000';
      const status = (!u.birth_date || !u.postal_code) ? 'REGULARIZACAO_PENDENTE_ASAAS' : 'REGULARIZADO_OU_PADRAO';

      const line = [
        `"${u.id}"`,
        `"${(u.name || '').replace(/"/g, '""')}"`,
        `"${(u.email || '').replace(/"/g, '""')}"`,
        `"${u.role || ''}"`,
        `"${cleanCpfCnpj}"`,
        `"${u.telefone || ''}"`,
        `"${(u.endereco || '').replace(/"/g, '""')}"`,
        `"${(u.bairro || '').replace(/"/g, '""')}"`,
        `"${(u.cidade || '').replace(/"/g, '""')}"`,
        `"${cep}"`,
        `"${birthDate}"`,
        `"${income}"`,
        `"${companyType}"`,
        `"${u.asaas_account_id || ''}"`,
        `"${u.asaas_wallet_id || ''}"`,
        `"${u.created_at || ''}"`,
        `"${status}"`
      ].join(';');

      csvRows.push(line);
    }

    const csvContent = '\uFEFF' + csvRows.join('\r\n');

    return new Response(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="relatorio_regularizacao_subcontas_asaas_${new Date().toISOString().slice(0, 10)}.csv"`
      }
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao gerar relatório de regularização' }, { status: 500 });
  }
}
