import type { ComponentProps, ReactNode } from "react";

/** Kleine, einheitliche Bausteine für Formulare und Hinweise. */

export function Karte({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={`rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 ${className}`}
    >
      {children}
    </section>
  );
}

export function Feld({
  label,
  hinweis,
  ...props
}: ComponentProps<"input"> & { label: string; hinweis?: string }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium">{label}</span>
      <input
        {...props}
        className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-base outline-none focus:border-[var(--vereinsfarbe)] focus:ring-2 focus:ring-[var(--vereinsfarbe)]/20 dark:border-neutral-700 dark:bg-neutral-950"
      />
      {hinweis ? <span className="text-neutral-500">{hinweis}</span> : null}
    </label>
  );
}

export function Auswahl({
  label,
  children,
  ...props
}: ComponentProps<"select"> & { label?: string }) {
  const select = (
    <select
      {...props}
      className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
    >
      {children}
    </select>
  );
  if (!label) return select;
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium">{label}</span>
      {select}
    </label>
  );
}

const knopfStile = {
  primaer:
    "bg-[var(--vereinsfarbe)] text-white hover:opacity-90 disabled:opacity-50",
  sekundaer:
    "border border-neutral-300 bg-white hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800",
  gefahr: "border border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950",
} as const;

export function Knopf({
  art = "primaer",
  klein = false,
  className = "",
  ...props
}: ComponentProps<"button"> & { art?: keyof typeof knopfStile; klein?: boolean }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center rounded-lg font-medium transition ${
        klein ? "px-2.5 py-1 text-sm" : "px-4 py-2"
      } ${knopfStile[art]} ${className}`}
    />
  );
}

export function Hinweis({
  art = "info",
  children,
}: {
  art?: "info" | "fehler" | "erfolg";
  children: ReactNode;
}) {
  const stil = {
    info: "border-neutral-200 bg-neutral-50 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300",
    fehler: "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300",
    erfolg: "border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-300",
  }[art];
  return (
    <p role={art === "fehler" ? "alert" : undefined} className={`rounded-lg border px-3 py-2 text-sm ${stil}`}>
      {children}
    </p>
  );
}
