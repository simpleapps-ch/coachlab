import { describe, expect, it } from "vitest";
import { supabaseProbleme } from "@/lib/supabase/env";

describe("supabaseProbleme", () => {
  it("akzeptiert gültige Werte", () => {
    expect(supabaseProbleme("https://abc.supabase.co", "sb_publishable_xyz")).toEqual([]);
    expect(supabaseProbleme("http://127.0.0.1:54321", "eyJhbGciOi")).toEqual([]);
  });

  it("nennt fehlende und falsche Werte", () => {
    expect(supabaseProbleme("", "")).toHaveLength(2);
    expect(supabaseProbleme("abc.supabase.co", "sb_publishable_x")[0]).toMatch(/keine gültige Adresse/);
    expect(supabaseProbleme("http://abc.supabase.co", "sb_publishable_x")[0]).toMatch(/https/);
    expect(supabaseProbleme("https://abc.supabase.co", "sb_secret_x")[0]).toMatch(/Secret Key/);
  });
});
