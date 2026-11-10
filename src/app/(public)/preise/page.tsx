import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Preise · Coachlab",
  description: "Ein Preis für den ganzen Verein: CHF 49.– pro Monat oder CHF 490.– pro Jahr, alle Trainer inklusive, 14 Tage gratis.",
};

const INKLUSIVE = [
  "Übungsbibliothek mit Animation für jede Spielform",
  "Filter nach SFV-Stufe, Spielerzahl, Torhüter, Dauer und Spielphase",
  "Druckversion jeder Übung mit Skizze",
  "Übungen mit Claude erfassen (Coachlab-Connector)",
  "Entwürfe, Freigabe und Versionsverlauf",
  "Alle Trainerinnen und Trainer des Vereins, ohne Begrenzung",
  "Daten in der EU, jeder Verein strikt getrennt",
];

const PLAENE = [
  { name: "Monatlich", preis: "49.–", einheit: "pro Monat", hinweis: "Kündbar auf Ende jedes Monats" },
  { name: "Jährlich", preis: "490.–", einheit: "pro Jahr", hinweis: "Zwei Monate gratis gegenüber monatlich" },
];

export default function Preise() {
  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-14 md:py-20">
      <h1 className="titel max-w-3xl text-5xl sm:text-6xl">Ein Preis für den ganzen Verein</h1>
      <p className="weich mt-5 max-w-2xl text-lg">
        Keine Preise pro Trainer oder pro Team. Die ersten 14 Tage sind gratis; du hinterlegst ein Zahlungsmittel und
        kannst vorher jederzeit kündigen. Preise in Schweizer Franken.
      </p>

      <div className="mt-12 grid gap-6 md:grid-cols-2">
        {PLAENE.map((p) => (
          <div key={p.name} className="rounded-2xl border-2 border-[color:var(--text)] p-7">
            <h2 className="text-lg font-semibold">{p.name}</h2>
            <p className="mt-3 flex items-baseline gap-2">
              <span className="text-lg">CHF</span>
              <span className="titel text-6xl">{p.preis}</span>
              <span className="weich">{p.einheit}</span>
            </p>
            <p className="weich mt-2 text-sm">{p.hinweis}</p>
            <Link href="/registrieren" className="knopf-leibchen mt-6 w-full">
              14 Tage gratis testen
            </Link>
          </div>
        ))}
      </div>

      <div className="mt-14 grid gap-10 md:grid-cols-[1fr_2fr]">
        <h2 className="titel text-3xl sm:text-4xl">Immer dabei</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {INKLUSIVE.map((i) => (
            <li key={i} className="flex gap-3">
              <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden className="mt-1 shrink-0 text-[color:var(--rasen)] dark:text-[color:var(--leibchen)]">
                <path d="M4 10.5l4 4 8-9" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {i}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-14 grid gap-10 border-t border-[color:var(--linie)] pt-10 md:grid-cols-[1fr_2fr]">
        <h2 className="titel text-3xl sm:text-4xl">In Arbeit</h2>
        <p className="weich max-w-[68ch]">
          Als Nächstes kommen die Vereinsphilosophie als eigene Seiten, Videos zu den Übungen und Webinare für eure
          Trainer. Sie werden Teil des Abos, ohne Aufpreis für bestehende Vereine.
        </p>
      </div>

      <div className="mt-14 grid gap-10 border-t border-[color:var(--linie)] pt-10 md:grid-cols-[1fr_2fr]">
        <h2 className="titel text-3xl sm:text-4xl">Zahlung und Rechnung</h2>
        <div className="weich grid max-w-[68ch] gap-3">
          <p>Bezahlt wird sicher über Stripe mit Karte oder den Zahlungsarten, die Stripe für die Schweiz anbietet. Rechnungen und Quittungen kommen per E-Mail und liegen im Kundenportal.</p>
          <p>Zwischen monatlich und jährlich wechselst du im Kundenportal. Die Preise verstehen sich inklusive allfälliger Mehrwertsteuer.</p>
        </div>
      </div>
    </main>
  );
}
