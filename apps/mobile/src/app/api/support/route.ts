import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

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

// GET: Buscar histórico de mensagens de suporte
// Se passar ?userId=..., retorna as mensagens daquele usuário
// Se for admin (?all=true), retorna todos os tickets agrupados
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const all = searchParams.get('all') === 'true';

    const supabase = getSupabaseAdmin();

    // 1. Tentar buscar direto na tabela support_messages
    try {
      let query = supabase.from('support_messages').select('*').order('created_at', { ascending: true });
      if (userId && !all) {
        query = query.eq('user_id', userId);
      }
      const { data, error } = await query;
      if (!error && data) {
        return NextResponse.json({ success: true, messages: data });
      }
    } catch (_err) {}

    // 2. Fallback via platform_settings caso a tabela ainda não tenha sido criada
    const { data: row } = await supabase
      .from('platform_settings')
      .select('asaas_platform_wallet_id')
      .limit(1)
      .maybeSingle();

    let allMessages: SupportMessageItem[] = [];
    if (row?.asaas_platform_wallet_id) {
      try {
        const parsed = JSON.parse(row.asaas_platform_wallet_id);
        if (parsed?.support_messages && Array.isArray(parsed.support_messages)) {
          allMessages = parsed.support_messages;
        }
      } catch (_e) {}
    }

    if (userId && !all) {
      allMessages = allMessages.filter(m => m.user_id === userId);
    }

    return NextResponse.json({ success: true, messages: allMessages });
  } catch (error: any) {
    console.error('Erro GET /api/support:', error);
    return NextResponse.json({ error: error.message || 'Erro ao carregar mensagens' }, { status: 500 });
  }
}

// POST: Enviar nova mensagem ou atualizar status de chamado
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action = 'send', message, userId, status } = body;

    const supabase = getSupabaseAdmin();

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

      // Mantém os últimos 500 registros para evitar payload gigante
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

    if (action === 'resolve' && userId) {
      // 1. Tentar atualizar na tabela
      try {
        await supabase
          .from('support_messages')
          .update({ status: status || 'resolvido', is_read: true, updated_at: new Date().toISOString() })
          .eq('user_id', userId);
      } catch (_err) {}

      // 2. Fallback platform_settings
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
    return NextResponse.json({ error: error.message || 'Erro ao processar mensagem' }, { status: 500 });
  }
}
