import type { PhilosophieBlock, PhilosophieInhalt } from "@/lib/philosophie/schema";

/** Darstellung eines Abschnitts der Philosophie (Blöcke aus aufbereiten.ts). */

function InhaltTeil({ i }: { i: PhilosophieInhalt }) {
  switch (i.art) {
    case "text":
      return <p>{i.text}</p>;
    case "feld":
      return (
        <p>
          <span className="block text-xs font-medium text-neutral-500">{i.name}</span>
          {i.wert}
        </p>
      );
    case "liste":
      return (
        <ul className="flex flex-col gap-1.5">
          {i.punkte.map((p, n) => (
            <li key={n} className="flex gap-2.5">
              <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--vereinsfarbe)]" />
              <span>{p}</span>
            </li>
          ))}
        </ul>
      );
    case "zitat":
      return <blockquote className="border-l-4 border-[var(--vereinsfarbe)] pl-3 font-medium italic">«{i.text}»</blockquote>;
  }
}

function Block({ b }: { b: PhilosophieBlock }) {
  switch (b.art) {
    case "zwischentitel":
      return <h3 className="mt-2 text-lg font-semibold">{b.text}</h3>;
    case "label":
      return <p className="mt-2 text-sm font-semibold text-[var(--vereinsfarbe)]">{b.text}</p>;
    case "leitsatz":
      return <p className="text-xl font-semibold leading-snug sm:text-2xl">{b.text}</p>;
    case "karten":
      return (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {b.karten.map((k, n) => (
            <section key={n} className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
              {k.marke || k.titel ? (
                <h3 className="flex items-start gap-2.5 font-semibold">
                  {k.marke ? (
                    <span className="inline-flex min-w-7 shrink-0 items-center justify-center rounded-md bg-[var(--vereinsfarbe)] px-1.5 py-0.5 text-sm text-white">
                      {k.marke}
                    </span>
                  ) : null}
                  {k.titel ? <span className="pt-0.5">{k.titel}</span> : null}
                </h3>
              ) : null}
              <div className="flex flex-col gap-2 text-[15px] text-neutral-700 dark:text-neutral-300">
                {k.inhalt.map((i, m) => (
                  <InhaltTeil key={m} i={i} />
                ))}
              </div>
            </section>
          ))}
        </div>
      );
    case "nummern":
      return (
        <ol className="flex flex-col divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white dark:divide-neutral-800 dark:border-neutral-800 dark:bg-neutral-900">
          {b.punkte.map((p, n) => (
            <li key={n} className="flex gap-3 p-4">
              <span className="inline-flex h-7 min-w-7 shrink-0 items-center justify-center rounded-md bg-[var(--vereinsfarbe)] text-sm font-semibold text-white">
                {p.nr}
              </span>
              <div>
                <p className="font-semibold">{p.titel}</p>
                {p.text ? <p className="mt-0.5 text-[15px] text-neutral-700 dark:text-neutral-300">{p.text}</p> : null}
              </div>
            </li>
          ))}
        </ol>
      );
    case "tabelle":
      return (
        <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
          <table className="w-full text-left text-[15px]">
            <tbody>
              {b.zeilen.map((z, n) => (
                <tr key={n} className="border-b border-neutral-200 last:border-0 dark:border-neutral-800">
                  {z.map((zelle, m) => (
                    <td key={m} className={`p-3 align-top ${m === 0 ? "font-semibold" : ""}`}>
                      {zelle}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    default:
      return <InhaltTeil i={b} />;
  }
}

export function AbschnittInhalt({ bloecke }: { bloecke: PhilosophieBlock[] }) {
  return (
    <div className="flex flex-col gap-4 leading-relaxed">
      {bloecke.map((b, n) => (
        <Block key={n} b={b} />
      ))}
    </div>
  );
}
