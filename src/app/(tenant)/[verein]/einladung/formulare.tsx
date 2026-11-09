"use client";

import { useActionState } from "react";
import { Feld, Hinweis, Knopf } from "@/components/ui";
import { einladungAnnehmen, registrieren, type EinladungZustand } from "./actions";

export function AnnehmenFormular({ verein, code }: { verein: string; code: string }) {
  const [zustand, aktion, laeuft] = useActionState<EinladungZustand, FormData>(
    einladungAnnehmen,
    {},
  );
  return (
    <form action={aktion} className="flex flex-col gap-4">
      <input type="hidden" name="verein" value={verein} />
      <input type="hidden" name="code" value={code} />
      {zustand.fehler ? <Hinweis art="fehler">{zustand.fehler}</Hinweis> : null}
      <Knopf type="submit" disabled={laeuft}>
        {laeuft ? "Wird angenommen …" : "Einladung annehmen"}
      </Knopf>
    </form>
  );
}

export function RegistrierenFormular({ verein, code }: { verein: string; code: string }) {
  const [zustand, aktion, laeuft] = useActionState<EinladungZustand, FormData>(registrieren, {});

  if (zustand.bestaetigen) {
    return (
      <Hinweis art="erfolg">
        Fast geschafft: Wir haben dir einen Bestätigungslink an {zustand.bestaetigen} geschickt.
        Klick darauf, dann bist du dabei.
      </Hinweis>
    );
  }

  return (
    <form action={aktion} className="flex flex-col gap-4">
      <input type="hidden" name="verein" value={verein} />
      <input type="hidden" name="code" value={code} />
      <Feld label="Vor- und Nachname" name="name" autoComplete="name" required defaultValue={zustand.name} />
      <Feld
        label="E-Mail"
        name="email"
        type="email"
        autoComplete="email"
        required
        defaultValue={zustand.email}
      />
      <Feld
        label="Passwort"
        name="passwort"
        type="password"
        autoComplete="new-password"
        minLength={10}
        required
        hinweis="Mindestens 10 Zeichen."
      />
      {zustand.fehler ? <Hinweis art="fehler">{zustand.fehler}</Hinweis> : null}
      <Knopf type="submit" disabled={laeuft}>
        {laeuft ? "Konto wird erstellt …" : "Konto erstellen"}
      </Knopf>
    </form>
  );
}
