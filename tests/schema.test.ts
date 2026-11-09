import { describe, expect, it } from "vitest";
import { einladungErstellen, profilAendern, slug, vereinsdatenAendern } from "@/lib/schema";

describe("Zod-Schemas", () => {
  it("Slug: Format und reservierte Namen", () => {
    expect(slug.safeParse("fc-beispiel").success).toBe(true);
    expect(slug.safeParse("FC-Beispiel").success).toBe(false);
    expect(slug.safeParse("api").success).toBe(false);
  });

  it("Vereinsdaten: nur Name, Logo, Farben", () => {
    const r = vereinsdatenAendern.safeParse({ name: "FC Test", abo_status: "active" });
    expect(r.success).toBe(true);
    expect(r.data).toEqual({ name: "FC Test" });
    expect(vereinsdatenAendern.safeParse({ farben: { primaer: "rot" } }).success).toBe(false);
  });

  it("Einladung: Owner kann nicht eingeladen werden", () => {
    const id = "aaaaaaaa-0000-4000-8000-000000000001";
    expect(einladungErstellen.parse({ tenant_id: id }).rolle).toBe("trainer");
    expect(einladungErstellen.safeParse({ tenant_id: id, rolle: "owner" }).success).toBe(false);
  });

  it("Profil: nur SFV-Stufen", () => {
    expect(profilAendern.safeParse({ team_stufe: "D", team_spieler: 14 }).success).toBe(true);
    expect(profilAendern.safeParse({ team_stufe: "U13" }).success).toBe(false);
  });
});
