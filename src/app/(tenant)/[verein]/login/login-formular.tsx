"use client";

import { useActionState } from "react";
import { Feld, Hinweis, Knopf } from "@/components/ui";
import { anmelden, type LoginZustand } from "./actions";

export function LoginFormular({ verein, weiter }: { verein: string; weiter?: string }) {
  const [zustand, aktion, laeuft] = useActionState<LoginZustand, FormData>(anmelden, {});

  return (
    <form action={aktion} className="flex flex-col gap-4">
      <input type="hidden" name="verein" value={verein} />
      {weiter ? <input type="hidden" name="weiter" value={weiter} /> : null}
      <Feld
        label="E-Mail"
        name="email"
        type="email"
        autoComplete="email"
        required
        defaultValue={zustand.email}
      />
      <Feld label="Passwort" name="passwort" type="password" autoComplete="current-password" required />
      {zustand.fehler ? <Hinweis art="fehler">{zustand.fehler}</Hinweis> : null}
      <Knopf type="submit" disabled={laeuft}>
        {laeuft ? "Anmelden …" : "Anmelden"}
      </Knopf>
    </form>
  );
}
