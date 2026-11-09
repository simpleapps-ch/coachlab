import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components bewusst aus: Fast jede Seite hängt vom Login und vom Verein ab
  // und wird pro Anfrage gerendert. Siehe CLAUDE.md.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
