import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST() {
  return NextResponse.json(
    { error: 'Endpoint desativado por segurança. Utilize a rota autorizada de pagamento de parceiro /api/admin/payout/pay-partner.' },
    { status: 410 }
  );
}
