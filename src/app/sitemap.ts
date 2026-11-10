import type { MetadataRoute } from "next";

const BASIS = process.env.URL ?? `https://${process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "coachlab.com"}`;

/** Nur die öffentliche Website; Vereinsseiten sind nicht für Suchmaschinen. */
export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/preise", "/registrieren", "/impressum", "/datenschutz"].map((pfad) => ({
    url: `${BASIS}${pfad}`,
    changeFrequency: "monthly",
    priority: pfad === "" ? 1 : 0.6,
  }));
}
