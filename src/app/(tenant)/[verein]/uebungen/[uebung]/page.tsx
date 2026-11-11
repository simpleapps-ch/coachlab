import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AnimationsPlayer } from "@/components/animation/player";
import { Legende, Skizze } from "@/components/animation/spielfeld";
import { Etikett, spielerText } from "@/components/uebung-karte";
import { Hinweis, Karte, Knopf } from "@/components/ui";
import { SFV_ALTER, uebungsSlug, type Uebung } from "@/lib/uebung-schema";
import { ladeUebung } from "@/lib/uebungen";
import { vereinsBasis, zugang } from "@/lib/verein";
import { uebungAendern } from "../../admin/uebungen/actions";
import { DruckenKnopf } from "./drucken";

export async function generateMetadata({ params }: PageProps<"/[verein]/uebungen/[uebung]">): Promise<Metadata> {
  const { verein, uebung } = await params;
  const z = await zugang(verein);
  if (z.art !== "voll" || !uebungsSlug.safeParse(uebung).success) return { title: "Übung" };
  const d = await ladeUebung(z.verein.id, uebung);
  return { title: d?.karte.titel ?? "Übung" };
}

function Abschnitt({ titel, children }: { titel: string; children: React.ReactNode }) {
  return (
    <section className="break-inside-avoid">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">{titel}</h2>
      {children}
    </section>
  );
}

const Liste = ({ punkte, nummeriert = false }: { punkte: string[]; nummeriert?: boolean }) => {
  const Tag = nummeriert ? "ol" : "ul";
  return (
    <Tag className={`flex flex-col gap-1.5 pl-5 ${nummeriert ? "list-decimal" : "list-disc"} marker:text-neutral-400`}>
      {punkte.map((p, i) => (
        <li key={i}>{p}</li>
      ))}
    </Tag>
  );
};

function Steckbrief({ u }: { u: Uebung }) {
  const zeilen: [string, string][] = [
    ["Spieler", spielerText(u.spieler.min, u.spieler.max, u.spieler.mit_torhueter)],
    ["Feld", `${u.feld.replace("x", " × ")} m`],
    ["Dauer", `${u.dauer_min} Minuten`],
    ...(u.belastung ? ([["Belastung", u.belastung]] as [string, string][]) : []),
    ["Intensität", u.intensitaet.charAt(0).toUpperCase() + u.intensitaet.slice(1)],
    ["Kategorie", u.kategorie],
    ["Spielphase", u.spielphase],
  ];
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
      {zeilen.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-neutral-500">{k}</dt>
          <dd className="font-medium">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export default async function UebungsDetail({ params }: PageProps<"/[verein]/uebungen/[uebung]">) {
  const { verein: slug, uebung: uebungRoh } = await params;
  const z = await zugang(slug);
  const basis = await vereinsBasis(slug);
  if (z.art !== "voll") notFound();
  if (!uebungsSlug.safeParse(uebungRoh).success) notFound();

  const d = await ladeUebung(z.verein.id, uebungRoh);
  if (!d) notFound();

  const zurueck = (
    <Link href={`${basis}/uebungen`} className="text-sm text-neutral-500 hover:underline print:hidden">
      ← Alle Übungen
    </Link>
  );

  if (!d.ok) {
    return (
      <div className="flex flex-col gap-4">
        {zurueck}
        <h1 className="text-2xl font-semibold">{d.karte.titel}</h1>
        <Hinweis art="fehler">
          Diese Übung entspricht nicht dem Pflichtformat und kann nicht angezeigt werden.
          {z.verwalten ? ` Fehler: ${d.fehler.slice(0, 5).join("; ")}` : ""}
        </Hinweis>
      </div>
    );
  }

  const u = d.uebung;
  const entwurf = d.karte.status === "entwurf";

  return (
    <article className="flex flex-col gap-6 print:gap-4 print:text-[11pt]">
      {zurueck}

      {z.verwalten ? (
        <div
          className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 print:hidden ${
            entwurf
              ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
              : "border-neutral-200 bg-neutral-50 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300"
          }`}
        >
          <p className="text-sm">
            {entwurf
              ? "Vorschau: Diese Übung ist ein Entwurf. Trainer sehen sie erst nach der Freigabe."
              : "Freigegeben: Alle Trainer des Vereins sehen diese Übung."}
          </p>
          <form action={uebungAendern} className="flex flex-wrap gap-2">
            <input type="hidden" name="verein" value={slug} />
            <input type="hidden" name="uebung" value={u.id} />
            <Link
              href={`${basis}/admin/uebungen/${u.id}/animation`}
              className="inline-flex items-center rounded-lg border border-neutral-300 bg-white px-2.5 py-1 text-sm font-medium text-neutral-800 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
            >
              Animation bearbeiten
            </Link>
            {entwurf ? (
              <Knopf name="aktion" value="freigeben" klein>
                Freigeben
              </Knopf>
            ) : (
              <Knopf name="aktion" value="zurueckziehen" art="sekundaer" klein>
                Zurück auf Entwurf
              </Knopf>
            )}
          </form>
        </div>
      ) : null}

      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold sm:text-3xl print:text-2xl">{u.titel}</h1>
          <DruckenKnopf />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {u.stufen.map((s) => (
            <Etikett key={s} betont>
              {s === "Aktive" ? s : `${s} · ${SFV_ALTER[s]}`}
            </Etikett>
          ))}
          <Etikett>{u.kategorie}</Etikett>
          <Etikett>{u.spielphase}</Etikett>
        </div>
        <p className="text-lg text-neutral-700 dark:text-neutral-300">{u.ziel}</p>
        {u.leitsatz ? (
          <blockquote className="border-l-4 border-[var(--vereinsfarbe)] pl-3 font-medium text-neutral-800 dark:text-neutral-200">
            {u.leitsatz}
          </blockquote>
        ) : null}
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] print:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] print:gap-4">
        <div className="print:hidden">
          <AnimationsPlayer animation={u.animation} titel={u.titel} />
        </div>
        <div className="hidden print:block">
          <Skizze animation={u.animation} titel={u.titel} />
          <ol className="mt-2 list-decimal pl-5 text-sm">
            {u.animation.schritte.map((s, i) => (
              <li key={i}>{s.text}</li>
            ))}
          </ol>
          <div className="mt-2">
            <Legende animation={u.animation} />
          </div>
        </div>

        <Karte className="h-fit print:border-0 print:p-0 print:shadow-none">
          <div className="flex flex-col gap-5">
            <Steckbrief u={u} />
            {u.spieler.skalierung ? (
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                <span className="font-medium">Skalierung:</span> {u.spieler.skalierung}
              </p>
            ) : null}
            <Abschnitt titel="Material">
              <Liste punkte={u.material} />
            </Abschnitt>
          </div>
        </Karte>
      </div>

      <div className="grid gap-6 md:grid-cols-2 print:grid-cols-2 print:gap-4">
        <Abschnitt titel="Aufbau">
          <Liste punkte={u.aufbau} nummeriert />
        </Abschnitt>
        <Abschnitt titel="Ablauf">
          <Liste punkte={u.ablauf} nummeriert />
        </Abschnitt>
        {u.regeln.length ? (
          <Abschnitt titel="Regeln & Punkte">
            <Liste punkte={u.regeln} />
          </Abschnitt>
        ) : null}
        <Abschnitt titel="Coachingpunkte">
          <Liste punkte={u.coachingpunkte} />
        </Abschnitt>
        {u.fehlerbilder.length ? (
          <Abschnitt titel="Typische Fehler">
            <Liste punkte={u.fehlerbilder} />
          </Abschnitt>
        ) : null}
        <Abschnitt titel="Varianten">
          <div className="flex flex-col gap-3">
            <div>
              <p className="mb-1 text-sm font-medium">Leichter</p>
              <Liste punkte={u.varianten.leichter} />
            </div>
            <div>
              <p className="mb-1 text-sm font-medium">Schwerer</p>
              <Liste punkte={u.varianten.schwerer} />
            </div>
          </div>
        </Abschnitt>
      </div>

      {u.prinzipien.length ? (
        <Abschnitt titel="Prinzipien">
          <div className="flex flex-wrap gap-1.5">
            {u.prinzipien.map((p) => (
              <Etikett key={p}>{p.replaceAll("-", " ")}</Etikett>
            ))}
          </div>
        </Abschnitt>
      ) : null}

      {z.verwalten && (u.quelle || u.zu_pruefen.length) ? (
        <Karte className="print:hidden">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">Nur für Admins</h2>
          {u.quelle ? <p className="text-sm">Quelle: {u.quelle}</p> : null}
          {u.zu_pruefen.length ? (
            <div className="mt-2 text-sm">
              <p className="font-medium text-amber-700 dark:text-amber-400">Zu prüfen (von Claude ergänzt):</p>
              <Liste punkte={u.zu_pruefen} />
            </div>
          ) : null}
        </Karte>
      ) : null}
    </article>
  );
}
