import type { Metadata } from "next";
import { angabe, BETREIBER } from "@/lib/betreiber";

export const metadata: Metadata = { title: "Datenschutz · Coachlab" };

/*
 * Entwurf nach dem Schweizer Datenschutzgesetz (DSG). Vor dem Go-live rechtlich prüfen lassen
 * (Checkliste im Betreiber-Handbuch). Dienstleister wie in docs/betreiber-handbuch.md.
 */
export default function Datenschutz() {
  const b = BETREIBER;
  return (
    <main className="prosa mx-auto w-full max-w-3xl px-5 py-14">
      <h1 className="titel text-5xl">Datenschutz</h1>
      <p className="weich">Stand: November 2026</p>

      <h2>Verantwortlich</h2>
      <p>
        {b.firma}, {angabe(b.strasse, "Strasse")}, {angabe(b.ort, "PLZ und Ort")}, {b.land}. Kontakt:{" "}
        {angabe(b.email, "E-Mail")}.
      </p>

      <h2>Welche Daten wir bearbeiten</h2>
      <ul>
        <li>Konto: Name, E-Mail-Adresse und Passwort (verschlüsselt gespeichert).</li>
        <li>Verein: Name, Adresse auf Coachlab, Mitglieder und ihre Rollen.</li>
        <li>Inhalte: Übungen und Animationen, die der Verein erfasst, mit Änderungsverlauf.</li>
        <li>Abo: Rechnungsadresse und Zahlungsstatus. Kartendaten bearbeitet nur Stripe, wir sehen sie nie.</li>
        <li>Technisch: Anmelde-Cookies, damit du angemeldet bleibst. Keine Werbe- oder Tracking-Cookies.</li>
      </ul>

      <h2>Wozu</h2>
      <p>
        Um Coachlab bereitzustellen, Vereine voneinander getrennt zu halten, Abos abzurechnen und dir wichtige
        Mitteilungen zu deinem Konto zu senden. Wir verkaufen keine Daten und zeigen keine Werbung.
      </p>

      <h2>Dienstleister</h2>
      <ul>
        <li>Supabase: Datenbank, Anmeldung und Dateien, Rechenzentrum in der EU (Irland).</li>
        <li>Netlify: Auslieferung der Website.</li>
        <li>Stripe: Zahlungen, Rechnungen und Kundenportal.</li>
        <li>
          Anthropic (Claude): Nur wenn eine Person ihr eigenes Claude-Konto mit Coachlab verbindet. Claude greift dann
          mit den Rechten dieser Person auf die Übungen ihres Vereins zu.
        </li>
      </ul>
      <p>
        Einige Dienstleister bearbeiten Daten auch ausserhalb der Schweiz, zum Beispiel in den USA. Wir stützen uns dabei
        auf die anerkannten Garantien des Datenschutzrechts, etwa Standardvertragsklauseln.
      </p>

      <h2>Wie lange</h2>
      <p>
        Solange dein Konto oder das Abo deines Vereins besteht. Rechnungsdaten bewahren wir so lange auf, wie es das
        Gesetz verlangt (in der Regel zehn Jahre).
      </p>

      <h2>Deine Rechte</h2>
      <p>
        Du kannst Auskunft über deine Daten verlangen, sie berichtigen oder löschen lassen. Schreib uns dafür an{" "}
        {angabe(b.email, "E-Mail")}.
      </p>
    </main>
  );
}
