import { describe, expect, it } from "vitest";
import { sichererPfad } from "@/lib/pfad";

describe("sichererPfad", () => {
  it("lässt Pfade auf derselben Website durch", () => {
    expect(sichererPfad("/zug94")).toBe("/zug94");
    expect(sichererPfad("/zug94/einladung?code=abc")).toBe("/zug94/einladung?code=abc");
  });

  it("blockiert fremde Adressen", () => {
    expect(sichererPfad("https://boese.ch")).toBe("/");
    expect(sichererPfad("//boese.ch")).toBe("/");
    expect(sichererPfad("/\\boese.ch")).toBe("/");
    expect(sichererPfad("javascript:alert(1)")).toBe("/");
    expect(sichererPfad(null, "/zug94")).toBe("/zug94");
  });
});
