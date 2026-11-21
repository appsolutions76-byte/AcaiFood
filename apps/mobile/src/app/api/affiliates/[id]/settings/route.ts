import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { authorizeRequest, unauthorizedResponse } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: Props) {
  const auth = await authorizeRequest(request, ['admin']);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  try {
    const { id } = await params;
    const supabase = getSupabaseAdmin();

    const { data: affiliate, error } = await supabase
      .from('partner_affiliates')
      .select('*, users!partner_affiliates_user_id_fkey(id, name, email, phone)')
      .eq('id', id)
      .maybeSingle();

    if (error || !affiliate) {
      return NextResponse.json({ error: 'Afiliado não encontrado' }, { status: 404 });
    }

    return NextResponse.json({ success: true, affiliate });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: Props) {
  const auth = await authorizeRequest(request, ['admin']);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  try {
    const { id } = await params;
    const body = await request.json();
    const {
      bonus_per_store,
      bonus_per_client,
      commission_pct,
      commission_months,
      withdrawal_mode,
      status,
      notes,
      pix_key,
    } = body;

    const supabase = getSupabaseAdmin();

    const updatePayload: any = {};
    if (bonus_per_store !== undefined) updatePayload.bonus_per_store = Number(bonus_per_store);
    if (bonus_per_client !== undefined) updatePayload.bonus_per_client = Number(bonus_per_client);
    if (commission_pct !== undefined) updatePayload.commission_pct = Number(commission_pct);
    if (commission_months !== undefined) updatePayload.commission_months = Number(commission_months);
    if (withdrawal_mode !== undefined) updatePayload.withdrawal_mode = withdrawal_mode;
    if (status !== undefined) updatePayload.status = status;
    if (notes !== undefined) updatePayload.notes = notes;
    if (pix_key !== undefined) updatePayload.pix_key = pix_key;

    const { data: updated, error } = await supabase
      .from('partner_affiliates')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, affiliate: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
