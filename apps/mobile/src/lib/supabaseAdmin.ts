import { createClient, SupabaseClient } from "@supabase/supabase-js";

let adminClientInstance: SupabaseClient | null = null;

const cleanEnvStr = (val?: string) => (val || "").replace(/^["']|["']$/g, "").trim();

/**
 * Retorna uma instância singleton do Supabase Client com Service Role (Server-side only).
 * Garante bypass total de RLS para operações administrativas (limpeza de pedidos, balanços, repasses).
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (adminClientInstance) {
    return adminClientInstance;
  }

  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const rawServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const rawAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const supabaseUrl = cleanEnvStr(rawUrl) || "https://placeholder.supabase.co";
  const serviceRoleKey = cleanEnvStr(rawServiceKey) || cleanEnvStr(rawAnonKey) || "placeholder-key";

  adminClientInstance = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return adminClientInstance;
}
