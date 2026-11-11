import { describe, expect, it } from "vitest";
import { alsSitzungsCookie } from "@/lib/supabase/sitzungs-cookie";

describe("Anmelde-Cookies bis zum Schliessen des Browsers", () => {
  it("entfernt die Lebensdauer (400 Tage von @supabase/ssr)", () => {
    const o = alsSitzungsCookie({ path: "/", sameSite: "lax" as const, httpOnly: false, maxAge: 400 * 24 * 3600 });
    expect(o).toEqual({ path: "/", sameSite: "lax", httpOnly: false });
    expect(alsSitzungsCookie({ path: "/", expires: new Date(Date.now() + 86400000) })).toEqual({ path: "/" });
  });

  it("Löschen bleibt Löschen", () => {
    expect(alsSitzungsCookie({ path: "/", maxAge: 0 })).toEqual({ path: "/", maxAge: 0 });
    const vorbei = new Date(0);
    expect(alsSitzungsCookie({ path: "/", expires: vorbei })).toEqual({ path: "/", expires: vorbei });
  });

  it("ohne Optionen nichts tun", () => {
    expect(alsSitzungsCookie(undefined)).toBeUndefined();
  });
});
