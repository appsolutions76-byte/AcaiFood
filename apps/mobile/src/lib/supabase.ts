import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

if (!supabaseUrl || !supabaseAnonKey) {
  if (typeof window !== "undefined") {
    console.warn("Missing Supabase environment variables (NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY)");
    setTimeout(() => {
       alert("🚨 ERRO DE CONFIGURAÇÃO: As chaves do Supabase não foram encontradas. Verifique as variáveis de ambiente na Vercel (Production e Preview) e faça um Redeploy.");
    }, 1000);
  }
}

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);
