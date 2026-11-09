import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties } from "react";
import { abmelden } from "./actions";
import { aktuellerBenutzer, vereinOder404, vereinsBasis } from "@/lib/verein";

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
  const benutzer = await aktuellerBenutzer();
  const basis = await vereinsBasis(slug);

  const farbe = verein.farben?.primaer;
  const stil = (farbe ? { "--vereinsfarbe": farbe } : {}) as CSSProperties;

  return (
    <div style={stil} className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3">
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
          {benutzer ? (
            <form action={abmelden} className="flex items-center gap-3 text-sm">
              <span className="hidden text-neutral-500 sm:inline">{benutzer.email}</span>
              <input type="hidden" name="verein" value={slug} />
              <button className="rounded-lg px-2 py-1 text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800">
                Abmelden
              </button>
            </form>
          ) : null}
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-8">{children}</div>
      <footer className="py-6 text-center text-xs text-neutral-400">Coachlab</footer>
    </div>
  );
}
