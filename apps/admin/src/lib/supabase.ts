import { createClient } from '@supabase/supabase-js';

// Using the .env.local file that we just created
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

// Prevent crashing if user forgets to paste the keys
const isValidUrl = supabaseUrl && supabaseUrl.startsWith('http');

export const supabase = isValidUrl 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
