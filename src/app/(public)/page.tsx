import type { Metadata } from "next";
import Link from "next/link";
import { AnimationsPlayer } from "@/components/animation/player";
import { DEMO } from "./demo";

export const metadata: Metadata = {
  title: "Coachlab: Jedes Team trainiert nach eurer Spielidee",
  description:
    "Coachlab macht aus dem Trainerhandbuch deiner Juniorenabteilung eine Bibliothek mit animierten Übungen. 14 Tage gratis, danach CHF 49.– pro Monat für den ganzen Verein.",
};

/*
 * Aufbau nach docs/positionierung.md: Wertversprechen -> heutige Alternativen ->
 * was Coachlab kann -> Weg zum Start (echte Abfolge) -> wer im Verein was davon hat -> Fragen.
 */

const HEUTE = [
  {
    titel: "Das Handbuch im Ordner",
    text: "Die Spielidee ist sauber aufgeschrieben. Am Dienstagabend um sechs schlägt sie trotzdem niemand auf.",
  },
  {
    titel: "Übungen aus dem Netz",
    text: "Jeder Trainer sucht selbst. Am Wochenende spielt jedes Team einen anderen Fussball.",
  },
  {
    titel: "Pfeile auf Papier",
    text: "Eine Skizze zeigt nicht, wer nach dem Ballverlust presst und wohin die anderen laufen.",
  },
];

const KANN = [
  {
    titel: "Eure Übungen, nicht irgendwelche",
    text: "Claude liest euer Trainerhandbuch und erfasst jede Übung im gleichen Format: Ziel, Aufbau, Ablauf, Coachingpunkte, Varianten. Was Claude ergänzt, ist markiert. Du prüfst und gibst frei.",
  },
  {
    titel: "Sehen statt lesen",
    text: "Jede Spielform läuft als Animation wie im Spiel: Dreiecke im Ballbesitz, Ballverlust, sofortiges Gegenpressing. Kein Pass geht durch einen Spieler.",
  },
  {
    titel: "Die passende Übung in Sekunden",
    text: "Filter nach SFV-Stufe von G bis A, Anzahl Spieler, Torhüter, Dauer und Spielphase. Für den Platz gibt es eine Druckversion mit Skizze.",
  },
];

const SCHRITTE = [
  {
    titel: "Verein registrieren",
    text: "Name und Adresse eures Vereins wählen. Die ersten 14 Tage sind gratis.",
  },
  {
    titel: "Übungen mit Claude erfassen",
    text: "Coachlab einmal mit Claude verbinden und das Handbuch hineingeben. Claude prüft Format und Animation, die Übungen landen als Entwurf bei dir.",
  },
  {
    titel: "Freigeben und Trainer einladen",
    text: "Ein Link für alle Trainer. Sie sehen nur, was du freigegeben hast, im Browser auf dem Handy, ohne App.",
  },
];

const ROLLEN = [
  {
    wer: "Technische Leitung und Juniorenobmann",
    was: "Deine Spielidee kommt in jedem Team an. Nichts ist sichtbar, bevor du es freigibst, und jede Änderung ist mit Datum und Person nachvollziehbar.",
  },
  {
    wer: "Trainerinnen und Trainer",
    was: "Fertige Übungen fürs nächste Training, passend zu Stufe und Anzahl Spieler. Ohne Claude-Konto, ohne Installation.",
  },
  {
    wer: "Vorstand und Kasse",
    was: "Ein Preis für den ganzen Verein, egal wie viele Trainer. Kündbar auf Ende der Periode, Rechnungen per E-Mail.",
  },
];

const FRAGEN = [
  {
    frage: "Brauchen alle Trainer ein Konto bei Claude?",
    antwort:
      "Nein. Nur wer Übungen erfasst, also meist die Technische Leitung, braucht ein Claude-Konto, das eigene Connectors erlaubt. Trainer melden sich nur bei Coachlab an.",
  },
  {
    frage: "Wir haben kein Handbuch. Geht das trotzdem?",
    antwort:
      "Ja. Claude erfasst Übungen auch aus Notizen, Fotos von Skizzen oder einfach im Gespräch. Das Format und die Prüfung der Animation sind dieselben.",
  },
  {
    frage: "Wo liegen unsere Daten?",
    antwort:
      "Die Datenbank liegt in der EU (Irland). Jeder Verein ist strikt von den anderen getrennt. Zahlungen laufen über Stripe; Kartendaten sehen wir nie.",
  },
  {
    frage: "Was passiert nach den 14 Tagen?",
    antwort:
      "Das Abo startet mit dem gewählten Plan. Kündigst du vorher im Kundenportal, zahlst du nichts. Später kündigst du jederzeit auf Ende der bezahlten Periode.",
  },
  {
    frage: "Funktioniert Coachlab auf dem Handy?",
    antwort: "Ja, im Browser, ohne App. Für den Platz gibt es ausserdem eine Druckversion jeder Übung.",
  },
];

export default function Startseite() {
  return (
    <main>
      {/* Einstieg: Wertversprechen und die echte Animation als Beweis */}
      <section className="rasen">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-5 pb-16 pt-12 md:grid-cols-[1.05fr_1fr] md:gap-14 md:pb-20 md:pt-16">
          <div>
            <h1 className="titel text-[2.9rem] sm:text-6xl lg:text-7xl">Jedes Team trainiert nach eurer Spielidee.</h1>
            <p className="mt-6 max-w-xl text-lg text-[color:var(--kreide)]/85 sm:text-xl">
              Coachlab macht aus dem Trainerhandbuch deiner Juniorenabteilung eine Bibliothek mit animierten Übungen. Die
              Technische Leitung erfasst sie mit Claude und gibt sie frei. Die Trainer öffnen sie am Platz auf dem Handy.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
              <Link href="/registrieren" className="knopf-leibchen">
                14 Tage gratis testen
              </Link>
              <Link href="/preise" className="underline decoration-[color:var(--leibchen)] decoration-2 underline-offset-4">
                Preise ansehen
              </Link>
            </div>
            <p className="mt-4 text-sm text-[color:var(--kreide)]/70">
              Danach CHF 49.– pro Monat für den ganzen Verein. Alle Trainer inklusive.
            </p>
          </div>

          <div className="rounded-2xl bg-[color:var(--kreide)] p-3 text-[color:var(--tinte)] dark:bg-neutral-900 dark:text-[color:var(--kreide)] shadow-[0_24px_60px_-28px_rgba(0,0,0,0.6)] sm:p-4">
            <AnimationsPlayer animation={DEMO.animation} titel={DEMO.titel} vorfuehrung />
            <p className="weich mt-1 px-1 text-xs">
              Beispiel: «{DEMO.titel}», so wie Trainer es in Coachlab sehen.
            </p>
          </div>
        </div>
      </section>

      {/* Heute: die Alternativen und warum sie nicht reichen */}
      <section className="mx-auto w-full max-w-6xl px-5 py-16 md:py-24">
        <h2 className="titel max-w-3xl text-4xl sm:text-5xl">Das Handbuch ist geschrieben. Gelesen wird es kaum.</h2>
        <div className="mt-10 grid gap-8 md:grid-cols-3 md:gap-10">
          {HEUTE.map((h) => (
            <div key={h.titel} className="border-t-2 border-[color:var(--text)] pt-4">
              <h3 className="text-lg font-semibold">{h.titel}</h3>
              <p className="weich mt-2">{h.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Was Coachlab kann */}
      <section className="border-y border-[color:var(--linie)]">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-16 md:grid-cols-[1fr_2fr] md:py-24">
          <h2 className="titel text-4xl sm:text-5xl">Aus eurem Handbuch wird ein Werkzeug für den Platz.</h2>
          <dl className="grid gap-8">
            {KANN.map((k) => (
              <div key={k.titel} className="grid gap-1 sm:grid-cols-[14rem_1fr] sm:gap-6">
                <dt className="text-lg font-semibold">{k.titel}</dt>
                <dd className="weich">{k.text}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Weg zum Start: echte Abfolge, darum nummeriert */}
      <section className="mx-auto w-full max-w-6xl px-5 py-16 md:py-24">
        <h2 className="titel text-4xl sm:text-5xl">In drei Schritten zur Vereinsbibliothek</h2>
        <ol className="mt-10 grid gap-10 md:grid-cols-3">
          {SCHRITTE.map((s, i) => (
            <li key={s.titel} className="flex gap-4">
              <span
                aria-hidden
                className="titel flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[color:var(--rasen)] text-2xl text-[color:var(--kreide)]"
              >
                {i + 1}
              </span>
              <div>
                <h3 className="text-lg font-semibold">{s.titel}</h3>
                <p className="weich mt-1">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="weich mt-12 max-w-2xl text-sm">
          Entwickelt zusammen mit einem Pilotverein aus dem Kanton Zug. Die ersten Übungen in Coachlab waren die
          Positionsspiele aus dessen Trainerhandbuch.
        </p>
      </section>

      {/* Für wen im Verein */}
      <section className="bg-[color:var(--rasen-tief)] text-[color:var(--kreide)]">
        <div className="mx-auto w-full max-w-6xl px-5 py-16 md:py-24">
          <h2 className="titel max-w-3xl text-4xl sm:text-5xl">Gemacht für alle, die im Verein mitreden</h2>
          <div className="mt-10 grid gap-10 md:grid-cols-3">
            {ROLLEN.map((r) => (
              <div key={r.wer}>
                <h3 className="text-lg font-semibold text-[color:var(--leibchen)]">{r.wer}</h3>
                <p className="mt-2 text-[color:var(--kreide)]/85">{r.was}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Fragen */}
      <section className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-16 md:grid-cols-[1fr_2fr] md:py-24">
        <h2 className="titel text-4xl sm:text-5xl">Häufige Fragen</h2>
        <div className="divide-y divide-[color:var(--linie)] border-y border-[color:var(--linie)]">
          {FRAGEN.map((f) => (
            <details key={f.frage} className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold">
                {f.frage}
                <span aria-hidden className="text-2xl leading-none transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="weich mt-2 max-w-[68ch]">{f.antwort}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Schluss */}
      <section className="rasen">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-6 px-5 py-16 md:flex-row md:items-center md:justify-between md:py-20">
          <div>
            <h2 className="titel text-4xl sm:text-5xl">Starte mit deinem Handbuch.</h2>
            <p className="mt-3 max-w-xl text-[color:var(--kreide)]/85">
              14 Tage gratis, dann CHF 49.– pro Monat oder CHF 490.– pro Jahr. Kündbar auf Ende der Periode.
            </p>
          </div>
          <Link href="/registrieren" className="knopf-leibchen shrink-0">
            14 Tage gratis testen
          </Link>
        </div>
      </section>
    </main>
  );
}
