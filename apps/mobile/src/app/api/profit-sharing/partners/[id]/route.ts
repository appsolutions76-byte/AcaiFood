import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { authorizeRequest, unauthorizedResponse } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: Props) {
  const auth = await authorizeRequest(request, ['admin']);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  try {
    const { id } = await params;
    const body = await request.json();
    const { name, pix_key, pix_key_type, share_pct, start_date, notes, active } = body;

    const supabase = getSupabaseAdmin();

    // Se estiver ativando, checar limite de 3 ativos
    if (active === true) {
      const { count } = await supabase
        .from('profit_sharing_partners')
        .select('id', { count: 'exact', head: true })
        .eq('active', true)
        .neq('id', id);

      if (count !== null && count >= 3) {
        return NextResponse.json(
          { error: 'Limite de 3 sócios investidores ativos atingido.' },
          { status: 400 }
        );
      }
    }

    const updatePayload: any = {};
    if (name !== undefined) updatePayload.name = name.trim();
    if (pix_key !== undefined) updatePayload.pix_key = pix_key.trim();
    if (pix_key_type !== undefined) updatePayload.pix_key_type = pix_key_type;
    if (share_pct !== undefined) updatePayload.share_pct = Number(share_pct);
    if (start_date !== undefined) updatePayload.start_date = start_date;
    if (notes !== undefined) updatePayload.notes = notes;
    if (active !== undefined) updatePayload.active = Boolean(active);

    const { data: updated, error } = await supabase
      .from('profit_sharing_partners')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, partner: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: Props) {
  const auth = await authorizeRequest(request, ['admin']);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  try {
    const { id } = await params;
    const supabase = getSupabaseAdmin();

    // Desativação lógica segura
    const { error } = await supabase
      .from('profit_sharing_partners')
      .update({ active: false })
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Sócio desativado com sucesso.' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
