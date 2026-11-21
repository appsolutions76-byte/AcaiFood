import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { authorizeRequest, unauthorizedResponse } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, ['admin']);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  try {
    const supabase = getSupabaseAdmin();
    const { data: partners, error } = await supabase
      .from('profit_sharing_partners')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const activeCount = (partners || []).filter((p: any) => p.active).length;

    return NextResponse.json({
      success: true,
      partners: partners || [],
      active_count: activeCount,
      can_add_more: activeCount < 3,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, ['admin']);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  try {
    const body = await request.json();
    const { name, pix_key, pix_key_type, share_pct, start_date, notes } = body;

    if (!name || !pix_key || !pix_key_type || share_pct === undefined || !start_date) {
      return NextResponse.json({ error: 'Preencha todos os campos obrigatórios' }, { status: 400 });
    }

    const validKeyTypes = ['cpf', 'cnpj', 'email', 'telefone', 'aleatoria'];
    const cleanKeyType = String(pix_key_type).toLowerCase();
    if (!validKeyTypes.includes(cleanKeyType)) {
      return NextResponse.json({ error: 'Tipo de chave Pix inválido' }, { status: 400 });
    }

    const sharePctNum = Number(share_pct);
    if (isNaN(sharePctNum) || sharePctNum <= 0 || sharePctNum > 1) {
      return NextResponse.json({ error: 'Percentual inválido. Deve ser maior que 0 e até 1.0 (ex: 0.05 para 5%)' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // 1. Verificar limite de 3 sócios ativos
    const { count } = await supabase
      .from('profit_sharing_partners')
      .select('id', { count: 'exact', head: true })
      .eq('active', true);

    if (count !== null && count >= 3) {
      return NextResponse.json(
        { error: 'Limite de 3 sócios investidores ativos atingido.' },
        { status: 400 }
      );
    }

    // 2. Inserir sócio
    const adminUserId = auth.profile?.id || auth.user?.id || null;

    const { data: partner, error: insertErr } = await supabase
      .from('profit_sharing_partners')
      .insert({
        name: name.trim(),
        pix_key: pix_key.trim(),
        pix_key_type: cleanKeyType,
        share_pct: sharePctNum,
        start_date,
        notes: notes ? String(notes).trim() : null,
        active: true,
        created_by: adminUserId,
      })
      .select()
      .single();

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, partner });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
