"use client";

import { useActionState } from "react";
import { Feld, Hinweis, Knopf } from "@/components/ui";
import { oauthAnmelden, type AnmeldeZustand } from "./actions";

export function AnmeldeFormular({ autorisierungsId }: { autorisierungsId: string }) {
  const [zustand, aktion, laeuft] = useActionState<AnmeldeZustand, FormData>(oauthAnmelden, {});
  return (
    <form action={aktion} className="flex flex-col gap-4">
      <input type="hidden" name="authorization_id" value={autorisierungsId} />
      <Feld label="E-Mail" name="email" type="email" autoComplete="email" required defaultValue={zustand.email} />
      <Feld label="Passwort" name="passwort" type="password" autoComplete="current-password" required />
      {zustand.fehler ? <Hinweis art="fehler">{zustand.fehler}</Hinweis> : null}
      <Knopf type="submit" disabled={laeuft}>
        {laeuft ? "Anmelden …" : "Anmelden"}
      </Knopf>
    </form>
  );
}
