import { describe, expect, it } from "vitest";
import { fehlendeAngaben } from "@/lib/betreiber";
import { RESERVIERTE_SUBDOMAINS } from "@/lib/tenant";

describe("Öffentliche Website", () => {
  it("Impressum ist vollständig (Impressumspflicht)", () => {
    expect(fehlendeAngaben(), "Angaben in src/lib/betreiber.ts ergänzen").toEqual([]);
  });

  it("alle Website-Pfade sind als Vereinsadresse gesperrt", () => {
    for (const p of ["preise", "registrieren", "impressum", "datenschutz"]) expect(RESERVIERTE_SUBDOMAINS.has(p)).toBe(true);
  });
});
