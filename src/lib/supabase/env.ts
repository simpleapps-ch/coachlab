/** Öffentliche Supabase-Werte (dürfen in den Browser). */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

export function supabaseKonfiguriert(): boolean {
  return SUPABASE_URL !== "" && SUPABASE_PUBLISHABLE_KEY !== "";
}
