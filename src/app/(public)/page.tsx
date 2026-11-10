import Link from "next/link";

export default function Startseite() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-4 px-4 py-16">
      <h1 className="text-4xl font-semibold tracking-tight">Coachlab</h1>
      <p className="text-lg text-neutral-600 dark:text-neutral-300">
        Die Trainingsplattform für Fussballvereine: Philosophie, Übungen mit
        Animation, Videos und Webinare – für jeden Verein getrennt.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/registrieren"
          className="rounded-lg bg-[var(--vereinsfarbe)] px-4 py-2 font-medium text-white hover:opacity-90"
        >
          Verein registrieren
        </Link>
        <span className="text-sm text-neutral-500">14 Tage gratis, danach CHF 49.– pro Monat oder CHF 490.– pro Jahr</span>
      </div>
      <p className="text-sm text-neutral-500">
        Ein Abo pro Verein, alle Trainer inklusive. Kündigung jederzeit auf Ende der Periode.
      </p>
    </main>
  );
}
