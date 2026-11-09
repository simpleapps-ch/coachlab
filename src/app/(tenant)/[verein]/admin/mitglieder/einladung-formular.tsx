"use client";

import { useActionState, useState } from "react";
import { Auswahl, Feld, Hinweis, Knopf } from "@/components/ui";
import { einladungErstellen, type AdminZustand } from "./actions";

export function EinladungFormular({ verein }: { verein: string }) {
  const [zustand, aktion, laeuft] = useActionState<AdminZustand, FormData>(einladungErstellen, {});

  return (
    <div className="flex flex-col gap-4">
      <form action={aktion} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <input type="hidden" name="verein" value={verein} />
        <input type="hidden" name="art" value="persoenlich" />
        <div className="flex-1">
          <Feld label="E-Mail der Person" name="email" type="email" required placeholder="trainer@beispiel.ch" />
        </div>
        <Auswahl label="Rolle" name="rolle" defaultValue="trainer">
          <option value="trainer">Trainer</option>
          <option value="admin">Admin (Stellvertretung)</option>
        </Auswahl>
        <Knopf type="submit" disabled={laeuft}>
          Einladen
        </Knopf>
      </form>

      <form action={aktion} className="flex flex-wrap items-center gap-3 text-sm">
        <input type="hidden" name="verein" value={verein} />
        <input type="hidden" name="art" value="vereinscode" />
        <span className="text-neutral-500">
          Oder ein Vereinscode für alle Trainer (90 Tage gültig, Freischaltung nötig):
        </span>
        <Knopf type="submit" art="sekundaer" klein disabled={laeuft}>
          Vereinscode erstellen
        </Knopf>
      </form>

      {zustand.fehler ? <Hinweis art="fehler">{zustand.fehler}</Hinweis> : null}
      {zustand.ok ? <Hinweis art="erfolg">{zustand.ok}</Hinweis> : null}
    </div>
  );
}

export function LinkKopieren({ link }: { link: string }) {
  const [kopiert, setKopiert] = useState(false);
  return (
    <div className="flex min-w-0 items-center gap-2">
      <code className="min-w-0 flex-1 truncate rounded bg-neutral-100 px-2 py-1 text-xs dark:bg-neutral-800">
        {link}
      </code>
      <Knopf
        type="button"
        art="sekundaer"
        klein
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(link);
            setKopiert(true);
            setTimeout(() => setKopiert(false), 2000);
          } catch {
            /* Zwischenablage nicht verfügbar: Link bleibt sichtbar zum Markieren */
          }
        }}
      >
        {kopiert ? "Kopiert ✓" : "Kopieren"}
      </Knopf>
    </div>
  );
}
