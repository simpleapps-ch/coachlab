import type { Metadata } from "next";
import { angabe, BETREIBER } from "@/lib/betreiber";

export const metadata: Metadata = { title: "Impressum · Coachlab" };

export default function Impressum() {
  const b = BETREIBER;
  return (
    <main className="prosa mx-auto w-full max-w-3xl px-5 py-14">
      <h1 className="titel text-5xl">Impressum</h1>
      <h2>Betreiberin</h2>
      <p>
        {b.firma}
        <br />
        {angabe(b.strasse, "Strasse")}
        <br />
        {angabe(b.ort, "PLZ und Ort")}
        <br />
        {b.land}
      </p>
      <p>
        UID: {angabe(b.uid, "UID-Nummer")}
        <br />
        Vertreten durch: {angabe(b.vertreten, "Geschäftsführung")}
        <br />
        E-Mail: {b.email ? <a href={`mailto:${b.email}`} className="underline">{b.email}</a> : angabe(null, "E-Mail")}
      </p>
      <h2>Haftung</h2>
      <p>
        Die Inhalte dieser Website werden mit Sorgfalt erstellt. Für Übungen und Inhalte, die Vereine in Coachlab
        erfassen, sind die jeweiligen Vereine verantwortlich.
      </p>
    </main>
  );
}
