import type { Metadata } from "next";
import Link from "next/link";
import { Etikett, spielerText } from "@/components/uebung-karte";
import { Hinweis, Karte, Knopf } from "@/components/ui";
import { alleUebungen, type UebungsKarte } from "@/lib/uebungen";
import { nurVerwalter, vereinsBasis } from "@/lib/verein";
import { uebungAendern } from "./actions";

export const metadata: Metadata = { title: "Entwürfe & Freigabe" };

const datum = new Intl.DateTimeFormat("de-CH", {
  day: "numeric",
  month: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function Zeile({ u, slug, basis }: { u: UebungsKarte; slug: string; basis: string }) {
  const entwurf = u.status === "entwurf";
  return (
    <li className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <Link href={`${basis}/uebungen/${u.slug}`} className="font-medium hover:underline">
          {u.titel}
        </Link>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-neutral-500">
          {u.stufen.map((s) => (
            <Etikett key={s} betont>
              {s}
            </Etikett>
          ))}
          <span>{spielerText(u.spieler_min, u.spieler_max, u.mit_torhueter)}</span>
          <span>· {u.dauer_min} Min.</span>
          <span>
            · {entwurf ? "geändert" : "freigegeben"} {datum.format(new Date(entwurf ? u.geaendert_am : (u.freigegeben_am ?? u.geaendert_am)))}
          </span>
        </p>
      </div>
      <form action={uebungAendern} className="flex shrink-0 gap-2">
        <input type="hidden" name="verein" value={slug} />
        <input type="hidden" name="uebung" value={u.slug} />
        <Link
          href={`${basis}/uebungen/${u.slug}`}
          className="inline-flex items-center rounded-lg border border-neutral-300 px-2.5 py-1 text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          Vorschau
        </Link>
        {entwurf ? (
          <>
            <Knopf name="aktion" value="freigeben" klein>
              Freigeben
            </Knopf>
            <Knopf name="aktion" value="loeschen" art="gefahr" klein>
              Löschen
            </Knopf>
          </>
        ) : (
          <Knopf name="aktion" value="zurueckziehen" art="sekundaer" klein>
            Zurück auf Entwurf
          </Knopf>
        )}
      </form>
    </li>
  );
}

export default async function AdminUebungen({ params }: PageProps<"/[verein]/admin/uebungen">) {
  const { verein: slug } = await params;
  const z = await nurVerwalter(slug);
  const basis = await vereinsBasis(slug);
  const alle = await alleUebungen(z.verein.id);
  const entwuerfe = alle.filter((u) => u.status === "entwurf");
  const freigegeben = alle.filter((u) => u.status === "freigegeben");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`${basis}/`} className="text-sm text-neutral-500 hover:underline">
          ← {z.verein.name}
        </Link>
        <h1 className="text-2xl font-semibold">Entwürfe & Freigabe</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Neue Übungen erfasst du mit Claude; sie landen hier als Entwurf. Prüfe Übung und Animation in der
          Vorschau und gib sie dann frei.
        </p>
      </div>

      <Karte>
        <h2 className="mb-4 font-semibold">Entwürfe ({entwuerfe.length})</h2>
        {entwuerfe.length ? (
          <ul className="flex flex-col divide-y divide-neutral-200 dark:divide-neutral-800">
            {entwuerfe.map((u) => (
              <Zeile key={u.id} u={u} slug={slug} basis={basis} />
            ))}
          </ul>
        ) : (
          <Hinweis>Keine offenen Entwürfe.</Hinweis>
        )}
      </Karte>

      <Karte>
        <h2 className="mb-4 font-semibold">Freigegeben ({freigegeben.length})</h2>
        {freigegeben.length ? (
          <ul className="flex flex-col divide-y divide-neutral-200 dark:divide-neutral-800">
            {freigegeben.map((u) => (
              <Zeile key={u.id} u={u} slug={slug} basis={basis} />
            ))}
          </ul>
        ) : (
          <Hinweis>Noch nichts freigegeben.</Hinweis>
        )}
      </Karte>
    </div>
  );
}
