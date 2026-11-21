import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { authorizeRequest, unauthorizedResponse } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

function sanitizeCodeBase(name: string): string {
  const clean = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z]/g, '')
    .toUpperCase();
  return clean.length >= 3 ? clean.slice(0, 10) : 'PARCEIRO';
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, ['admin']);
  if (!auth.authorized) {
    return unauthorizedResponse(auth.error);
  }

  try {
    const body = await request.json();
    const { name, contact, expiry_days } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Nome do parceiro é obrigatório' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // 1. Obter expiry_days padrão de platform_config / platform_settings
    let expiryDays = typeof expiry_days === 'number' && expiry_days > 0 ? expiry_days : 7;
    try {
      const { data: cfgRow } = await supabase
        .from('platform_config')
        .select('value')
        .eq('key', 'affiliate_settings')
        .maybeSingle();
      if (cfgRow?.value?.invite_expiry_days && !expiry_days) {
        expiryDays = Number(cfgRow.value.invite_expiry_days) || 7;
      }
    } catch (_e) {}

    // 2. Gerar invite_token
    const inviteToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString();

    // 3. Gerar referral_code sequencial (ex: JOAOSILVA01, JOAOSILVA02...)
    const base = sanitizeCodeBase(name.trim());
    let codeIndex = 1;
    let finalCode = `${base}${String(codeIndex).padStart(2, '0')}`;

    const { data: existingList } = await supabase
      .from('partner_affiliates')
      .select('referral_code')
      .like('referral_code', `${base}%`);

    const existingCodes = new Set((existingList || []).map((row: any) => String(row.referral_code || '').toUpperCase()));

    while (existingCodes.has(finalCode)) {
      codeIndex++;
      finalCode = `${base}${String(codeIndex).padStart(2, '0')}`;
    }

    // 4. Inserir em partner_affiliates com status 'pending'
    const adminUserId = auth.profile?.id || auth.user?.id || null;

    const { data: inserted, error: insertErr } = await supabase
      .from('partner_affiliates')
      .insert({
        name: name.trim(),
        contact: contact ? String(contact).trim() : null,
        referral_code: finalCode,
        invite_token: inviteToken,
        invite_expires_at: expiresAt,
        status: 'pending',
        invited_by: adminUserId,
      })
      .select('id, referral_code, invite_token, invite_expires_at')
      .single();

    if (insertErr || !inserted) {
      console.error('[Affiliates Invite] Erro ao criar convite:', insertErr);
      return NextResponse.json({ error: `Erro ao criar convite: ${insertErr?.message || 'Falha no banco'}` }, { status: 500 });
    }

    // 5. Construir invite_link
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || 'www.acaifood.app.br';
    const proto = request.headers.get('x-forwarded-proto') || 'https';
    const baseUrl = `${proto}://${host}`;
    const inviteLink = `${baseUrl}/parceiro/convite?token=${inviteToken}`;

    return NextResponse.json({
      success: true,
      invite_link: inviteLink,
      referral_code: finalCode,
      invite_token: inviteToken,
      expires_at: expiresAt,
    });
  } catch (error: any) {
    console.error('[Affiliates Invite] Exceção:', error);
    return NextResponse.json({ error: error.message || 'Erro interno ao gerar convite' }, { status: 500 });
  }
}
