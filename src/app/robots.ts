import type { MetadataRoute } from "next";

const BASIS = process.env.URL ?? `https://${process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "coachlab.com"}`;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: ["/$", "/_next/", "/preise", "/registrieren", "/impressum", "/datenschutz"], disallow: "/" },
    sitemap: `${BASIS}/sitemap.xml`,
  };
}
