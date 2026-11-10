import localFont from "next/font/local";
import Link from "next/link";
import { BETREIBER } from "@/lib/betreiber";

const text = localFont({
  src: [
    { path: "../../fonts/barlow-latin-400-normal.woff2", weight: "400" },
    { path: "../../fonts/barlow-latin-500-normal.woff2", weight: "500" },
    { path: "../../fonts/barlow-latin-600-normal.woff2", weight: "600" },
  ],
  variable: "--font-text",
  display: "swap",
});

const titel = localFont({
  src: [
    { path: "../../fonts/barlow-condensed-latin-600-normal.woff2", weight: "600" },
    { path: "../../fonts/barlow-condensed-latin-700-normal.woff2", weight: "700" },
  ],
  variable: "--font-titel",
  display: "swap",
});

/** Öffentliche Website: Startseite, Preise, Registrierung, Impressum, Datenschutz. */
export default function WebsiteLayout({ children }: LayoutProps<"/">) {
  return (
    <div className={`website ${text.variable} ${titel.variable} flex min-h-full flex-1 flex-col`}>
      <header className="kopf">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <Link href="/" className="marke" aria-label="Coachlab, zur Startseite">
            <Marke />
            Coachlab
          </Link>
          <nav className="flex items-center gap-1 text-[15px]" aria-label="Hauptnavigation">
            <Link href="/preise" className="navlink">
              Preise
            </Link>
            <Link href="/registrieren" className="navlink navlink-stark">
              Gratis testen
            </Link>
          </nav>
        </div>
      </header>
      <div className="flex flex-1 flex-col">{children}</div>
      <footer className="fuss">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-10 sm:flex-row sm:justify-between">
          <div className="max-w-sm">
            <p className="marke">
              <Marke />
              Coachlab
            </p>
            <p className="mt-2 text-sm">
              Die Trainingsplattform für Juniorenabteilungen. Entwickelt und betrieben von der {BETREIBER.firma}.
            </p>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm" aria-label="Rechtliches">
            <Link href="/preise">Preise</Link>
            <Link href="/registrieren">Verein registrieren</Link>
            <Link href="/impressum">Impressum</Link>
            <Link href="/datenschutz">Datenschutz</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

/** Mittelkreis mit Mittelpunkt: Bildmarke aus der Spielfeldlinie. */
function Marke() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden className="shrink-0">
      <circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" strokeWidth="2.2" />
      <line x1="12" y1="0" x2="12" y2="24" stroke="currentColor" strokeWidth="2.2" />
      <circle cx="12" cy="12" r="2.6" fill="var(--leibchen)" />
    </svg>
  );
}
