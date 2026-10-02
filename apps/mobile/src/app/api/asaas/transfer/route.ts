import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(
    { error: 'Esta rota foi permanentemente desativada. As liquidações e saques são realizados exclusivamente via fluxo oficial com validação de subconta e PIN.' },
    { status: 410 }
  );
}

export async function POST() {
  return NextResponse.json(
    { error: 'Esta rota foi permanentemente desativada. As liquidações e saques são realizados exclusivamente via fluxo oficial com validação de subconta e PIN.' },
    { status: 410 }
  );
}
