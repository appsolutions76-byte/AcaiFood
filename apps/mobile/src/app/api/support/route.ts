import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

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
  content: string;
  sender: 'user' | 'admin';
  is_read: boolean;
  status: 'aberto' | 'em_atendimento' | 'resolvido';
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

    const { data: row } = await supabase
      .from('platform_settings')
      .select('asaas_platform_wallet_id')
      .limit(1)
      .maybeSingle();

    let supportConfig: SupportConfig = DEFAULT_SUPPORT_CONFIG;
    let fallbackMessages: SupportMessageItem[] = [];

    if (row?.asaas_platform_wallet_id) {
      try {
        const parsed = JSON.parse(row.asaas_platform_wallet_id);
        if (parsed?.support_config) {
          supportConfig = { ...DEFAULT_SUPPORT_CONFIG, ...parsed.support_config };
        }
        if (parsed?.support_messages && Array.isArray(parsed.support_messages)) {
          fallbackMessages = parsed.support_messages;
        }
      } catch (_e) {}
    }

    if (configOnly) {
      return NextResponse.json({ success: true, config: supportConfig });
    }

    // 1. Tentar buscar direto na tabela support_messages
    try {
      let query = supabase.from('support_messages').select('*').order('created_at', { ascending: true });
      if (userId && !all) {
        query = query.eq('user_id', userId);
      }
      const { data, error } = await query;
      if (!error && data) {
        return NextResponse.json({ success: true, messages: data, config: supportConfig });
      }
    } catch (_err) {}

    // 2. Fallback via platform_settings
    let messages = fallbackMessages;
    if (userId && !all) {
      messages = messages.filter(m => m.user_id === userId);
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

    const supabase = getSupabaseAdmin();

    // AÇÃO 1: SALVAR CONFIGURAÇÕES DE HORÁRIO / CHAVE LIGA-DESLIGA
    if (action === 'save_config' && config) {
      const { data: firstRow } = await supabase
        .from('platform_settings')
        .select('id, asaas_platform_wallet_id')
        .limit(1)
        .maybeSingle();

      let currentCfg: any = {};
      if (firstRow?.asaas_platform_wallet_id) {
        try {
          currentCfg = JSON.parse(firstRow.asaas_platform_wallet_id) || {};
        } catch (_e) {}
      }

      currentCfg.support_config = {
        ...DEFAULT_SUPPORT_CONFIG,
        ...config
      };

      if (firstRow?.id) {
        await supabase
          .from('platform_settings')
          .update({ asaas_platform_wallet_id: JSON.stringify(currentCfg) })
          .eq('id', firstRow.id);
      }

      return NextResponse.json({ success: true, config: currentCfg.support_config });
    }

    // AÇÃO 2: ENVIAR MENSAGEM
    if (action === 'send' && message) {
      const msgItem: SupportMessageItem = {
        id: message.id || `sup-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        user_id: message.user_id || userId || 'anon',
        user_name: message.user_name || 'Usuário',
        user_role: message.user_role || 'cliente',
        user_phone: message.user_phone || '',
        user_email: message.user_email || '',
        content: message.content || '',
        sender: message.sender || 'user',
        is_read: false,
        status: message.status || 'aberto',
        created_at: new Date().toISOString()
      };

      // 1. Tentar salvar na tabela support_messages
      try {
        const { error } = await supabase.from('support_messages').insert([msgItem]);
        if (!error) {
          return NextResponse.json({ success: true, message: msgItem });
        }
      } catch (_err) {}

      // 2. Fallback via platform_settings
      const { data: firstRow } = await supabase
        .from('platform_settings')
        .select('id, asaas_platform_wallet_id')
        .limit(1)
        .maybeSingle();

      let currentCfg: any = {};
      if (firstRow?.asaas_platform_wallet_id) {
        try {
          currentCfg = JSON.parse(firstRow.asaas_platform_wallet_id) || {};
        } catch (_e) {}
      }

      const existingMessages: SupportMessageItem[] = Array.isArray(currentCfg.support_messages) ? currentCfg.support_messages : [];
      const updatedMessages = [...existingMessages, msgItem];

      // Mantém os últimos 500 registros
      const trimmed = updatedMessages.slice(-500);
      currentCfg.support_messages = trimmed;

      if (firstRow?.id) {
        await supabase
          .from('platform_settings')
          .update({ asaas_platform_wallet_id: JSON.stringify(currentCfg) })
          .eq('id', firstRow.id);
      }

      return NextResponse.json({ success: true, message: msgItem });
    }

    // AÇÃO 3: RESOLVER TICKET
    if (action === 'resolve' && userId) {
      try {
        await supabase
          .from('support_messages')
          .update({ status: status || 'resolvido', is_read: true, updated_at: new Date().toISOString() })
          .eq('user_id', userId);
      } catch (_err) {}

      const { data: firstRow } = await supabase
        .from('platform_settings')
        .select('id, asaas_platform_wallet_id')
        .limit(1)
        .maybeSingle();

      if (firstRow?.asaas_platform_wallet_id) {
        try {
          const currentCfg = JSON.parse(firstRow.asaas_platform_wallet_id) || {};
          if (Array.isArray(currentCfg.support_messages)) {
            currentCfg.support_messages = currentCfg.support_messages.map((m: SupportMessageItem) => 
              m.user_id === userId ? { ...m, status: status || 'resolvido', is_read: true } : m
            );
            await supabase
              .from('platform_settings')
              .update({ asaas_platform_wallet_id: JSON.stringify(currentCfg) })
              .eq('id', firstRow.id);
          }
        } catch (_e) {}
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
  } catch (error: any) {
    console.error('Erro POST /api/support:', error);
    return NextResponse.json({ error: error.message || 'Erro ao processar requisição de suporte' }, { status: 500 });
  }
}
