"use client";

import { useActionState, useEffect, useState } from "react";
import { Feld, Hinweis, Knopf } from "@/components/ui";
import { anmelden, kontoAnlegen, slugPruefen, vereinAnlegen, type Zustand } from "./actions";

export function KontoFormular() {
  const [z, aktion, laeuft] = useActionState<Zustand, FormData>(kontoAnlegen, {});
  if (z.bestaetigen) {
    return (
      <Hinweis art="erfolg">
        Fast geschafft: Wir haben dir an {z.bestaetigen} einen Link geschickt. Klicke darauf, dann geht es hier mit deinem
        Verein weiter.
      </Hinweis>
    );
  }
  return (
    <form action={aktion} className="flex flex-col gap-4">
      <Feld label="Dein Name" name="name" autoComplete="name" required defaultValue={z.werte?.name} />
      <Feld label="E-Mail" name="email" type="email" autoComplete="email" required defaultValue={z.werte?.email} />
      <Feld label="Passwort" name="passwort" type="password" autoComplete="new-password" minLength={10} required hinweis="Mindestens 10 Zeichen" />
      {z.fehler ? <Hinweis art="fehler">{z.fehler}</Hinweis> : null}
      <Knopf type="submit" disabled={laeuft}>{laeuft ? "Konto wird angelegt …" : "Konto anlegen"}</Knopf>
    </form>
  );
}

export function AnmeldeFormular() {
  const [z, aktion, laeuft] = useActionState<Zustand, FormData>(anmelden, {});
  return (
    <form action={aktion} className="flex flex-col gap-4">
      <Feld label="E-Mail" name="email" type="email" autoComplete="email" required defaultValue={z.werte?.email} />
      <Feld label="Passwort" name="passwort" type="password" autoComplete="current-password" required />
      {z.fehler ? <Hinweis art="fehler">{z.fehler}</Hinweis> : null}
      <Knopf type="submit" art="sekundaer" disabled={laeuft}>{laeuft ? "Anmelden …" : "Anmelden"}</Knopf>
    </form>
  );
}

/** Vorschlag für die Adresse aus dem Vereinsnamen: «FC Zug 94» -> «fc-zug-94». */
export function slugVorschlag(name: string): string {
  return name
    .toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}

export function VereinFormular({ vorgabe, muster }: { vorgabe?: { name: string; slug: string }; muster: string }) {
  const [z, aktion, laeuft] = useActionState<Zustand, FormData>(vereinAnlegen, {});
  const [name, setName] = useState(z.werte?.name ?? vorgabe?.name ?? "");
  const [slug, setSlug] = useState(z.werte?.slug ?? vorgabe?.slug ?? "");
  const [selbst, setSelbst] = useState(Boolean(vorgabe?.slug));
  const [frei, setFrei] = useState<"frei" | "vergeben" | "ungueltig" | null>(null);

  useEffect(() => {
    if (!slug) return;
    const t = setTimeout(() => slugPruefen(slug).then(setFrei), 400);
    return () => clearTimeout(t);
  }, [slug]);

  return (
    <form action={aktion} className="flex flex-col gap-4">
      <Feld
        label="Name des Vereins"
        name="name"
        required
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          if (!selbst) setSlug(slugVorschlag(e.target.value));
        }}
      />
      <Feld
        label="Adresse"
        name="slug"
        required
        value={slug}
        onChange={(e) => {
          setSelbst(true);
          setSlug(e.target.value.toLowerCase());
        }}
        hinweis={
          frei === "vergeben" && slug !== vorgabe?.slug
            ? "Diese Adresse ist schon vergeben."
            : frei === "ungueltig"
              ? "3–40 Zeichen: Kleinbuchstaben, Ziffern und Bindestriche."
              : muster.replace("{slug}", slug || "dein-verein")
        }
      />
      <fieldset className="flex flex-col gap-2 text-sm">
        <legend className="mb-1 font-medium">Abo</legend>
        <label className="flex items-center gap-2">
          <input type="radio" name="plan" value="monat" defaultChecked={(z.werte?.plan ?? "monat") === "monat"} /> CHF 49.– pro Monat
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="plan" value="jahr" defaultChecked={z.werte?.plan === "jahr"} /> CHF 490.– pro Jahr (2 Monate gratis)
        </label>
      </fieldset>
      {z.fehler ? <Hinweis art="fehler">{z.fehler}</Hinweis> : null}
      <Knopf type="submit" disabled={laeuft}>{laeuft ? "Weiter zu Stripe …" : "14 Tage gratis testen"}</Knopf>
      <p className="text-xs text-neutral-500">
        Im nächsten Schritt hinterlegst du bei Stripe ein Zahlungsmittel. Belastet wird erst nach 14 Tagen; kündigen kannst du
        jederzeit vorher.
      </p>
    </form>
  );
}
