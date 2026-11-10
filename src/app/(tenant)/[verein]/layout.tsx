import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties } from "react";
import { abmelden } from "./actions";
import { vereinOder404, vereinsBasis, zugangOhneUmleitung } from "@/lib/verein";

export async function generateMetadata({
  params,
}: LayoutProps<"/[verein]">): Promise<Metadata> {
  const { verein: slug } = await params;
  const verein = await vereinOder404(slug);
  return { title: { default: `${verein.name} · Coachlab`, template: `%s · ${verein.name}` } };
}

export default async function VereinsLayout({ children, params }: LayoutProps<"/[verein]">) {
  const { verein: slug } = await params;
  const verein = await vereinOder404(slug);
  const z = await zugangOhneUmleitung(slug);
  const basis = await vereinsBasis(slug);

  const farbe = verein.farben?.primaer;
  const stil = (farbe ? { "--vereinsfarbe": farbe } : {}) as CSSProperties;
  const voll = z?.art === "voll";
  const navLink =
    "rounded-lg px-2.5 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800";

  return (
    <div style={stil} className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-neutral-200 bg-white print:hidden dark:border-neutral-800 dark:bg-neutral-950">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
          <Link href={`${basis}/`} className="flex items-center gap-3">
            {verein.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={verein.logo_url} alt="" className="h-8 w-8 rounded object-contain" />
            ) : (
              <span
                aria-hidden
                className="flex h-8 w-8 items-center justify-center rounded bg-[var(--vereinsfarbe)] text-sm font-bold text-white"
              >
                {verein.name.slice(0, 1)}
              </span>
            )}
            <span className="font-semibold">{verein.name}</span>
          </Link>

          {voll ? (
            <nav className="order-last flex w-full gap-1 sm:order-none sm:w-auto" aria-label="Hauptnavigation">
              <Link href={`${basis}/uebungen`} className={navLink}>
                Übungen
              </Link>
              {z.verwalten ? (
                <>
                  <Link href={`${basis}/admin/uebungen`} className={navLink}>
                    Entwürfe & Freigabe
                  </Link>
                  <Link href={`${basis}/admin/mitglieder`} className={navLink}>
                    Mitglieder
                  </Link>
                  <Link href={`${basis}/admin/abo`} className={navLink}>
                    Abo
                  </Link>
                </>
              ) : null}
            </nav>
          ) : null}

          {z ? (
            <form action={abmelden} className="flex items-center gap-3 text-sm">
              <span className="hidden text-neutral-500 md:inline">{z.benutzer.email}</span>
              <input type="hidden" name="verein" value={slug} />
              <button className="rounded-lg px-2 py-1 text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800">
                Abmelden
              </button>
            </form>
          ) : null}
        </div>
      </header>
      {voll && z.verwalten && !z.aboOk ? (
        <div className="border-b border-amber-200 bg-amber-50 text-sm text-amber-900 print:hidden dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <div className="mx-auto w-full max-w-5xl px-4 py-2">
            Kein aktives Abo: Deine Trainer sehen im Moment keine Inhalte.{" "}
            <Link href={`${basis}/admin/abo`} className="font-medium underline">
              Abo abschliessen
            </Link>
          </div>
        </div>
      ) : null}
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-8 print:max-w-none print:p-0">{children}</div>
      <footer className="py-6 text-center text-xs text-neutral-400 print:hidden">Coachlab</footer>
    </div>
  );
}
