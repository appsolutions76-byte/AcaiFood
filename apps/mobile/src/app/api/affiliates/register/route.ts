import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token, name, email, phone, how_will_promote, password, cidade, bairro, endereco } = body;

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: 'Token de convite não informado' }, { status: 400 });
    }

    if (!email || !password || !name) {
      return NextResponse.json({ error: 'Nome, e-mail e senha são obrigatórios' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'A senha deve ter no mínimo 6 caracteres' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // 1. Validar o token no partner_affiliates
    const nowIso = new Date().toISOString();
    const { data: affiliate, error: tokenErr } = await supabase
      .from('partner_affiliates')
      .select('*')
      .eq('invite_token', token.trim())
      .gt('invite_expires_at', nowIso)
      .eq('status', 'pending')
      .maybeSingle();

    if (tokenErr || !affiliate) {
      return NextResponse.json(
        { error: 'Convite inválido ou expirado. Solicite um novo convite ao administrador.' },
        { status: 400 }
      );
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanPhone = String(phone || affiliate.contact || '').trim();

    // 2. Criar ou vincular conta de usuário no Supabase Auth
    let authUserId: string | null = null;
    const { data: authCreated, error: authErr } = await supabase.auth.admin.createUser({
      email: cleanEmail,
      password: String(password),
      email_confirm: true,
      user_metadata: {
        name: name.trim(),
        role: 'afiliado',
      },
    });

    if (authErr) {
      // Se já existe no auth, tenta obter o id do usuário existente
      if (authErr.message?.toLowerCase().includes('already') || (authErr as any).code === 'email_exists') {
        const { data: userList } = await supabase.auth.admin.listUsers();
        const existing = userList?.users?.find(u => u.email?.toLowerCase() === cleanEmail);
        if (existing) {
          authUserId = existing.id;
        } else {
          return NextResponse.json({ error: `E-mail já cadastrado: ${authErr.message}` }, { status: 400 });
        }
      } else {
        console.error('[Affiliate Register] Auth error:', authErr);
        return NextResponse.json({ error: `Erro ao criar credenciais de acesso: ${authErr.message}` }, { status: 400 });
      }
    } else if (authCreated?.user) {
      authUserId = authCreated.user.id;
    }

    if (!authUserId) {
      return NextResponse.json({ error: 'Não foi possível gerar a identificação do usuário' }, { status: 500 });
    }

    // 3. Upsert em public.users (garante cidade, bairro e endereco não-nulos)
    const effectiveCidade = (cidade && String(cidade).trim()) || 'Belém';
    const effectiveBairro = (bairro && String(bairro).trim()) || 'Centro';
    const effectiveEndereco = (endereco && String(endereco).trim()) || effectiveCidade;

    const userPayload: any = {
      id: authUserId,
      name: name.trim(),
      email: cleanEmail,
      phone: cleanPhone,
      cidade: effectiveCidade,
      bairro: effectiveBairro,
      endereco: effectiveEndereco,
      role: 'CLIENT', // Respeita users_role_check ('CLIENT','PARTNER','COURIER','SUPPLIER','ADMIN')
      status: 'active',
      split_enabled: false,
    };

    let { error: userInsertErr } = await supabase
      .from('users')
      .upsert(userPayload, { onConflict: 'id' });

    // Fallback: se houver erro de role check para CLIENT, tenta com 'afiliado'
    if (userInsertErr && userInsertErr.message?.includes('users_role_check')) {
      userPayload.role = 'afiliado';
      const retry = await supabase.from('users').upsert(userPayload, { onConflict: 'id' });
      userInsertErr = retry.error;
    }

    if (userInsertErr) {
      console.error('[Affiliate Register] Erro ao salvar public.users:', userInsertErr);
      return NextResponse.json({ error: `Erro ao salvar perfil: ${userInsertErr.message}` }, { status: 500 });
    }

    // 4. Atualizar partner_affiliates: vincular user_id, zerar invite_token
    const { error: affUpdateErr } = await supabase
      .from('partner_affiliates')
      .update({
        user_id: authUserId,
        name: name.trim(),
        contact: cleanPhone,
        how_will_promote: how_will_promote ? String(how_will_promote).trim() : affiliate.how_will_promote,
        invite_token: null, // Queima o token
      })
      .eq('id', affiliate.id);

    if (affUpdateErr) {
      console.error('[Affiliate Register] Erro ao vincular parceiro afiliado:', affUpdateErr);
      return NextResponse.json({ error: `Erro ao vincular parceiro: ${affUpdateErr.message}` }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Cadastro de parceiro afiliado realizado com sucesso! Aguarde a aprovação do administrador para ativação das comissões.',
      userId: authUserId,
      affiliateId: affiliate.id,
      referralCode: affiliate.referral_code,
    });
  } catch (error: any) {
    console.error('[Affiliate Register] Exceção:', error);
    return NextResponse.json({ error: error.message || 'Erro inesperado no cadastro' }, { status: 500 });
  }
}
