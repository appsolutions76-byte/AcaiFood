import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { authorizeRequest, unauthorizedResponse } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: Props) {
  const auth = await authorizeRequest(request, ['admin']);
  if (!auth.authorized) return unauthorizedResponse(auth.error);

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { pix_key_used, receipt_note } = body;

    const supabase = getSupabaseAdmin();

    const { data: updated, error } = await supabase
      .from('profit_sharing_payouts')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        pix_key_used: pix_key_used ? String(pix_key_used).trim() : null,
        receipt_note: receipt_note ? String(receipt_note).trim() : null,
      })
      .eq('id', id)
      .select('*, profit_sharing_partners(name, pix_key)')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, payout: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
