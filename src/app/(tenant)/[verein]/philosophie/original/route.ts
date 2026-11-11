import { ladePhilosophien, originalLink } from "@/lib/philosophie/laden";
import { zugang } from "@/lib/verein";

export const dynamic = "force-dynamic";

/**
 * «Original ansehen»: prüft bei jedem Klick den Login und leitet auf einen 60 Sekunden
 * gültigen Link zum PDF weiter (Seite als Sprungmarke). So steht nie ein länger gültiger
 * PDF-Link in der Seite.
 */
export async function GET(request: Request, { params }: RouteContext<"/[verein]/philosophie/original">) {
  const { verein } = await params;
  const z = await zugang(verein); // ohne Login: Umleitung zur Login-Seite
  if (z.art !== "voll") return new Response("Kein Zugang", { status: 403 });

  const url = new URL(request.url);
  const seite = Math.max(1, Math.min(300, Number(url.searchParams.get("seite")) || 1));
  const entwurf = url.searchParams.get("fassung") === "entwurf" && z.verwalten;

  const fassungen = await ladePhilosophien(z.verein.id);
  const ph = entwurf ? fassungen.entwurf : fassungen.freigegeben;
  if (!ph) return new Response("Keine Philosophie", { status: 404 });

  const link = await originalLink(ph.datei, 60);
  if (!link) return new Response("PDF nicht verfügbar", { status: 404 });
  return new Response(null, {
    status: 302,
    headers: { location: `${link}#page=${seite}`, "cache-control": "private, no-store" },
  });
}
