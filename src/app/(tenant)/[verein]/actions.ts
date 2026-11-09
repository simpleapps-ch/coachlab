"use server";

import { redirect } from "next/navigation";
import { slug as slugSchema } from "@/lib/schema";
import { createClient } from "@/lib/supabase/server";
import { vereinsBasis } from "@/lib/verein";

export async function abmelden(formData: FormData) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const slug = slugSchema.safeParse(formData.get("verein"));
  redirect(slug.success ? `${await vereinsBasis(slug.data)}/login` : "/");
}
