import { NextResponse } from 'next/server';
import { getPlatformConfig, setPlatformConfig } from '@/lib/platformConfig';
import { logAdminAction } from '@/lib/adminAudit';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { authorizeRequest, unauthorizedResponse } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

export interface SupportConfig {
  mode: 'auto' | 'open' | 'closed'; // auto = pelo horário, open = forçar aberto, closed = forçar fechado
  channelEnabled: boolean; // se o canal/botão está ativo
  weekdayOpen: string; // ex: "08:00"
  weekdayClose: string; // ex: "22:00"
  weekendOpen: string; // ex: "09:00"
  weekendClose: string; // ex: "18:00"
  whatsappNumber: string;
  supportEmail: string;
  customNotice?: string;
}

export const DEFAULT_SUPPORT_CONFIG: SupportConfig = {
  mode: 'auto',
  channelEnabled: true,
  weekdayOpen: '08:00',
  weekdayClose: '22:00',
  weekendOpen: '09:00',
  weekendClose: '18:00',
  whatsappNumber: '5591981244876',
  supportEmail: 'appsolutions76@gmail.com',
  customNotice: ''
};

export interface SupportMessageItem {
  id: string;
  user_id: string;
  user_name: string;
  user_role: string;
  user_phone?: string;
  user_email?: string;
  category?: 'geral' | 'financeiro' | 'pedido' | 'parceria' | 'outro';
  content: string;
  sender: 'user' | 'admin';
  is_read: boolean;
  status: 'aberto' | 'em_atendimento' | 'resolvido';
  forwarded_to_asaas?: boolean;
  forwarded_to_asaas_at?: string;
  asaas_protocol?: string;
  is_merited?: boolean;
  first_responded_at?: string;
  resolved_at?: string;
  resolution_notes?: string;
  created_at: string;
  updated_at?: string;
}

// GET: Buscar histórico de mensagens de suporte ou configuração
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const all = searchParams.get('all') === 'true';
    const configOnly = searchParams.get('config') === 'true';

    const supabase = getSupabaseAdmin();

    const savedSupportConfig = await getPlatformConfig<Partial<SupportConfig>>('support');
    const supportConfig: SupportConfig = { ...DEFAULT_SUPPORT_CONFIG, ...(savedSupportConfig || {}) };
    // Mensagens ficam só em support_messages (não mais em JSON de platform_settings)
    const fallbackMessages: SupportMessageItem[] = [];

    if (configOnly) {
      return NextResponse.json({ success: true, config: supportConfig });
    }

    // Se for listagem geral do admin, requer autorização de admin
    let effectiveUserId: string | null = null;
    if (all) {
      const auth = await authorizeRequest(request, ['admin']);
      if (!auth.authorized) {
        return unauthorizedResponse(auth.error || 'Acesso restrito ao painel administrativo de suporte.');
      }
    } else {
      // Somente o próprio usuário logado lê as suas mensagens (o userId da URL não basta: auditoria C1)
      const auth = await authorizeRequest(request);
      if (!auth.authorized) {
        return NextResponse.json(
          { error: 'Faça login para acessar o canal de atendimento.', messages: [] },
          { status: 401 }
        );
      }
      const callerId = auth.user?.id || auth.profile?.id || null;
      effectiveUserId = callerId;
      if (userId && userId !== callerId) {
        // Ler o chamado de outra pessoa: só admin com MFA
        const adminAuth = await authorizeRequest(request, ['admin']);
        if (!adminAuth.authorized) {
          return NextResponse.json({ error: 'Você só pode ver as suas próprias mensagens.', messages: [] }, { status: 403 });
        }
        effectiveUserId = userId;
      }
      if (!effectiveUserId) {
        return NextResponse.json({ error: 'Usuário não identificado.', messages: [] }, { status: 401 });
      }
    }

    // 1. Tentar buscar direto na tabela support_messages
    try {
      let query = supabase.from('support_messages').select('*').order('created_at', { ascending: true });
      if (!all) {
        query = query.eq('user_id', effectiveUserId as string);
      }
      const { data, error } = await query;
      if (!error && data) {
        return NextResponse.json({ success: true, messages: data, config: supportConfig });
      }
    } catch (_err) {}

    // 2. Fallback via platform_settings
    let messages = fallbackMessages;
    if (!all) {
      messages = messages.filter(m => m.user_id === effectiveUserId);
    }

    return NextResponse.json({ success: true, messages, config: supportConfig });
  } catch (error: any) {
    console.error('Erro GET /api/support:', error);
    return NextResponse.json({ error: error.message || 'Erro ao carregar suporte' }, { status: 500 });
  }
}

// POST: Enviar nova mensagem, atualizar status ou salvar configurações de horário
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action = 'send', message, userId, status, config } = body;

    // Proteção de segurança: Modificações de configuração do suporte e resolução de chamados requerem autorização
    let adminActorId: string | null = null;
    if (action === 'save_config' || action === 'resolve' || action === 'forward_asaas') {
      const auth = await authorizeRequest(request, ['admin']);
      if (!auth.authorized) {
        return unauthorizedResponse(auth.error || 'Apenas administradores podem alterar configurações do canal de suporte.');
      }
      adminActorId = auth.user?.id || auth.profile?.id || null;
    }

    const supabase = getSupabaseAdmin();

    // AÇÃO 1: SALVAR CONFIGURAÇÕES DE HORÁRIO / CHAVE LIGA-DESLIGA
    if (action === 'save_config' && config) {
      const newSupportConfig = { ...DEFAULT_SUPPORT_CONFIG, ...config };
      const saved = await setPlatformConfig('support', newSupportConfig);
      if (!saved.ok) {
        return NextResponse.json({ error: saved.error }, { status: 500 });
      }
      await logAdminAction({
        actorId: adminActorId,
        action: 'SUPPORT_CONFIG_UPDATED',
        targetType: 'PLATFORM_CONFIG',
        targetId: 'support',
        afterState: newSupportConfig,
        request
      });
      return NextResponse.json({ success: true, config: newSupportConfig });
    }

    // AÇÃO 2: ENVIAR MENSAGEM (SOMENTE USUÁRIOS CADASTRADOS)
    if (action === 'send' && message) {
      const sendAuth = await authorizeRequest(request);
      if (!sendAuth.authorized) {
        return unauthorizedResponse(sendAuth.error || 'Faça login para falar com o suporte.');
      }
      const senderIsAdmin = String(sendAuth.profile?.role || '').toLowerCase() === 'admin' || sendAuth.profile?.is_admin === true;
      const wantsAdminSender = String(message.sender || '').toLowerCase() === 'admin';
      if (wantsAdminSender) {
        // Responder como suporte exige admin com MFA
        const adminAuth = await authorizeRequest(request, ['admin']);
        if (!adminAuth.authorized) {
          return unauthorizedResponse(adminAuth.error || 'Apenas o suporte pode responder como atendente.');
        }
      }
      const callerUserId = sendAuth.user?.id || sendAuth.profile?.id || '';
      // Usuário comum só envia em nome próprio; admin escolhe o chamado
      const targetUserId = (wantsAdminSender && senderIsAdmin) ? (message.user_id || userId) : callerUserId;

      // Restrição: visitantes sem conta NÃO TÊM ACESSO
      if (!targetUserId || targetUserId.startsWith('guest-') || targetUserId === 'anon') {
        return NextResponse.json(
          { error: 'Acesso restrito: somente usuários cadastrados têm permissão para enviar mensagens ao canal de atendimento. Por favor, faça login ou cadastre-se.' },
          { status: 403 }
        );
      }

      // Validar existência da conta cadastrada no banco de dados
      const { data: userRecord } = await supabase
        .from('users')
        .select('id, name, role, phone, telefone, email')
        .eq('id', targetUserId)
        .maybeSingle();

      if (!userRecord) {
        return NextResponse.json(
          { error: 'Conta não encontrada. Cadastre-se ou entre na sua conta para falar com o suporte.' },
          { status: 403 }
        );
      }

      const msgItem: SupportMessageItem = {
        id: message.id || `sup-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        user_id: userRecord.id,
        user_name: userRecord.name || message.user_name || 'Usuário Cadastrado',
        user_role: userRecord.role || message.user_role || 'cliente',
        user_phone: userRecord.phone || userRecord.telefone || message.user_phone || '',
        user_email: userRecord.email || message.user_email || '',
        category: message.category || 'geral',
        content: message.content || '',
        sender: wantsAdminSender && senderIsAdmin ? 'admin' : 'user',
        is_read: false,
        status: message.status || 'aberto',
        created_at: new Date().toISOString()
      };

      // 1. Tentar salvar na tabela support_messages
      try {
        const { error } = await supabase.from('support_messages').insert([msgItem]);
        if (!error) {
          // Se o admin respondeu, marcar first_responded_at se nulo
          if (msgItem.sender === 'admin') {
            await supabase
              .from('support_messages')
              .update({ first_responded_at: new Date().toISOString() })
              .eq('user_id', userRecord.id)
              .is('first_responded_at', null);
          }
          return NextResponse.json({ success: true, message: msgItem });
        }
      } catch (_err) {}

      // Sem gravação de mensagens em JSON de platform_settings (dados pessoais fora da tabela própria)
      return NextResponse.json({ error: 'Não foi possível registrar a mensagem agora. Tente novamente.' }, { status: 500 });
    }

    // AÇÃO 3: ENCAMINHAR AO ASAAS (CLÁUSULA 7.1)
    if (action === 'forward_asaas' && userId) {
      const auth = await authorizeRequest(request, ['admin']);
      if (!auth.authorized) {
        return unauthorizedResponse(auth.error || 'Apenas administradores podem encaminhar chamados ao Asaas.');
      }

      const protocol = body.protocol || `ASAAS-${Date.now()}`;
      const nowIso = new Date().toISOString();

      try {
        await supabase
          .from('support_messages')
          .update({
            forwarded_to_asaas: true,
            forwarded_to_asaas_at: nowIso,
            asaas_protocol: protocol,
            updated_at: nowIso
          })
          .eq('user_id', userId);
      } catch (_err) {}

      await logAdminAction({
        actorId: adminActorId,
        action: 'SUPPORT_FORWARDED_TO_ASAAS',
        targetType: 'SUPPORT_TICKET',
        targetId: String(userId),
        afterState: { asaas_protocol: protocol, forwarded_at: nowIso },
        request
      });

      return NextResponse.json({
        success: true,
        forwarded: true,
        asaas_protocol: protocol,
        forwarded_at: nowIso
      });
    }

    // AÇÃO 4: RESOLVER TICKET (COM INDICAÇÃO DE PROCEDÊNCIA)
    if (action === 'resolve' && userId) {
      const isMerited = body.is_merited !== undefined ? Boolean(body.is_merited) : true;
      const notes = body.notes || '';
      const nowIso = new Date().toISOString();

      try {
        await supabase
          .from('support_messages')
          .update({
            status: status || 'resolvido',
            is_read: true,
            is_merited: isMerited,
            resolved_at: nowIso,
            resolution_notes: notes,
            updated_at: nowIso
          })
          .eq('user_id', userId);
      } catch (_err) {}

      await logAdminAction({
        actorId: adminActorId,
        action: 'SUPPORT_TICKET_RESOLVED',
        targetType: 'SUPPORT_TICKET',
        targetId: String(userId),
        afterState: { status: status || 'resolvido', is_merited: isMerited, resolved_at: nowIso },
        request
      });

      return NextResponse.json({ success: true, resolved_at: nowIso, is_merited: isMerited });
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
  } catch (error: any) {
    console.error('Erro POST /api/support:', error);
    return NextResponse.json({ error: error.message || 'Erro ao processar requisição de suporte' }, { status: 500 });
  }
}
