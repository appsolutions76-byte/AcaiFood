import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export interface AdminAuditParams {
  actorId?: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  beforeState?: any;
  afterState?: any;
  request?: Request;
}

export async function logAdminAction(params: AdminAuditParams): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    let ipAddress = '127.0.0.1';
    let userAgent = 'Server';

    if (params.request) {
      ipAddress = params.request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                  params.request.headers.get('x-real-ip') ||
                  '127.0.0.1';
      userAgent = params.request.headers.get('user-agent') || 'Server';
    }

    await supabase.from('admin_audit_log').insert({
      actor_id: params.actorId || null,
      action: params.action,
      target_type: params.targetType || null,
      target_id: params.targetId || null,
      before_state: params.beforeState || null,
      after_state: params.afterState || null,
      ip_address: ipAddress,
      user_agent: userAgent
    });
  } catch (err) {
    console.warn('[logAdminAction] Falha ao registrar log de auditoria:', err);
  }
}
