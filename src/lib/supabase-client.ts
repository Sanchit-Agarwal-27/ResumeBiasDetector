import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Clean any potential trailing slash or /rest/v1 appended by accident
function cleanSupabaseUrl(url: string | undefined): string {
  if (!url) return "";
  let clean = url.trim();
  // Strip trailing slash
  clean = clean.replace(/\/+$/, "");
  // Strip /rest/v1 if included
  clean = clean.replace(/\/rest\/v1$/, "");
  return clean;
}

const rawUrl = import.meta.env.VITE_SUPABASE_URL;
const rawAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseUrl = cleanSupabaseUrl(rawUrl);
export const supabaseAnonKey = (rawAnonKey || "").trim();

export const isSupabaseConfigured = Boolean(
  supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith("http") && supabaseAnonKey.length > 20,
);

if (!isSupabaseConfigured && typeof window !== "undefined") {
  console.warn(
    "[BiasLens] Supabase environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY) are missing or incomplete. Operating in local guest fallback mode.",
  );
}

export const supabase: SupabaseClient = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-key",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: "biaslens-supabase-auth-token",
    },
  },
);
