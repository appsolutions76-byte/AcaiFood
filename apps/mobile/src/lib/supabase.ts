import { createClient } from "@supabase/supabase-js";

// Usando variáveis de ambiente do Next.js
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// Só lança erro se estiver no cliente e as variáveis estiverem ausentes para não quebrar a build estática
if (!supabaseUrl || !supabaseAnonKey) {
  if (typeof window !== "undefined") {
    console.warn("Faltam variáveis de ambiente do Supabase (NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY)");
    // Alert the user on the screen if they try to use it without keys
    setTimeout(() => {
       alert("🚨 ERRO GRAVE: As chaves do Supabase não foram encontradas na Vercel! Verifique se você adicionou as variáveis de ambiente na Vercel para os ambientes de 'Preview' e 'Production' e fez o Redeploy.");
    }, 1000);
  }
}

export const supabase = createClient(
  supabaseUrl || "https://vfsenzzuoisgcvppfbbz.supabase.co", 
  supabaseAnonKey || "sb_publishable_eqyQYjFtuSNJUExRiU9R3Q_WAgo_6eX"
);
