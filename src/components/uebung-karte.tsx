import Link from "next/link";
import type { UebungsKarte as Karte } from "@/lib/uebungen";

export function Etikett({ children, betont = false }: { children: React.ReactNode; betont?: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium ${
        betont
          ? "bg-[var(--vereinsfarbe)]/10 text-[var(--vereinsfarbe)]"
          : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
      }`}
    >
      {children}
    </span>
  );
}

export function spielerText(min: number, max: number, mitTorhueter: boolean) {
  const bereich = min === max ? `${min}` : `${min}–${max}`;
  return `${bereich} Spieler${mitTorhueter ? " + TW" : ""}`;
}

export function UebungsKarte({ u, href }: { u: Karte; href: string }) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:border-[var(--vereinsfarbe)] dark:border-neutral-800 dark:bg-neutral-900"
    >
      <div className="flex flex-wrap gap-1">
        {u.stufen.map((s) => (
          <Etikett key={s} betont>
            {s}
          </Etikett>
        ))}
        {u.status === "entwurf" ? <Etikett>Entwurf</Etikett> : null}
      </div>
      <h3 className="font-semibold leading-snug group-hover:underline">{u.titel}</h3>
      <dl className="mt-auto grid grid-cols-2 gap-x-3 gap-y-1 text-sm text-neutral-500">
        <dt className="sr-only">Spieler</dt>
        <dd>👥 {spielerText(u.spieler_min, u.spieler_max, u.mit_torhueter)}</dd>
        <dt className="sr-only">Dauer</dt>
        <dd>⏱ {u.dauer_min} Min.</dd>
        <dt className="sr-only">Kategorie</dt>
        <dd>{u.kategorie}</dd>
        <dt className="sr-only">Spielphase</dt>
        <dd>{u.spielphase}</dd>
      </dl>
    </Link>
  );
}
