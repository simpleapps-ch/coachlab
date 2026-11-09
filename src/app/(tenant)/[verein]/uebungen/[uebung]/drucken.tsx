"use client";

export function DruckenKnopf() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-50 print:hidden dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800"
    >
      🖨 Drucken / PDF
    </button>
  );
}
