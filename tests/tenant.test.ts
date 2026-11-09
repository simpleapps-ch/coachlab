import { describe, expect, it } from "vitest";
import { istGueltigerSlug, slugAusHost } from "@/lib/tenant";

describe("slugAusHost", () => {
  const root = "coachlab.com";

  it("erkennt den Verein aus der Subdomain", () => {
    expect(slugAusHost("fc-beispiel.coachlab.com", root)).toBe("fc-beispiel");
    expect(slugAusHost("FC-Beispiel.coachlab.com:443", root)).toBe("fc-beispiel");
  });

  it("liefert null für die Hauptdomain und reservierte Subdomains", () => {
    expect(slugAusHost("coachlab.com", root)).toBeNull();
    expect(slugAusHost("www.coachlab.com", root)).toBeNull();
    expect(slugAusHost("api.coachlab.com", root)).toBeNull();
  });

  it("ignoriert fremde Domains und tiefere Ebenen", () => {
    expect(slugAusHost("fc-beispiel.example.com", root)).toBeNull();
    expect(slugAusHost("a.fc-beispiel.coachlab.com", root)).toBeNull();
    expect(slugAusHost(null, root)).toBeNull();
  });

  it("funktioniert lokal mit coachlab.localhost", () => {
    expect(slugAusHost("fc-test.coachlab.localhost:3000", "coachlab.localhost:3000")).toBe(
      "fc-test",
    );
  });
});

describe("istGueltigerSlug", () => {
  it("prüft Format und reservierte Namen", () => {
    expect(istGueltigerSlug("fc-beispiel")).toBe(true);
    expect(istGueltigerSlug("ab")).toBe(false);
    expect(istGueltigerSlug("-fc")).toBe(false);
    expect(istGueltigerSlug("fc_beispiel")).toBe(false);
    expect(istGueltigerSlug("admin")).toBe(false);
  });
});
