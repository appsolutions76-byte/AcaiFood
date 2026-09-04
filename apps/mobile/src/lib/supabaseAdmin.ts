import { createClient, SupabaseClient } from "@supabase/supabase-js";

let adminClientInstance: SupabaseClient | null = null;

/**
 * Retorna uma instância singleton do Supabase Client com Service Role (Server-side only).
 * Evita a criação repetitiva de conexões e instâncias a cada requisição HTTP nas API Routes.
 * NUNCA usa a anon key como fallback — se a SERVICE_ROLE_KEY estiver ausente, lança erro.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (adminClientInstance) {
    return adminClientInstance;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  // Nunca usar NEXT_PUBLIC_SUPABASE_ANON_KEY como fallback — isso é um cliente sem privilégios
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY não configurada no servidor. Configure esta variável de ambiente na Vercel (sem prefixo NEXT_PUBLIC_)."
    );
  }

  adminClientInstance = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return adminClientInstance;
}
