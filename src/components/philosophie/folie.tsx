"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Zeigt eine Seite des Original-PDFs gestochen scharf im Browser (pdf.js über unpdf).
 * Das PDF wird pro Datei nur einmal geladen und beim Blättern wiederverwendet.
 */

type Dokument = Awaited<ReturnType<(typeof import("unpdf"))["getDocumentProxy"]>>;

const geladen = new Map<string, Promise<Dokument>>();

function dokumentLaden(datei: string, url: string): Promise<Dokument> {
  let p = geladen.get(datei);
  if (!p) {
    p = (async () => {
      const antwort = await fetch(url);
      if (!antwort.ok) throw new Error(`PDF nicht erreichbar (${antwort.status})`);
      const { getDocumentProxy } = await import("unpdf");
      return getDocumentProxy(new Uint8Array(await antwort.arrayBuffer()));
    })();
    p.catch(() => geladen.delete(datei));
    geladen.set(datei, p);
  }
  return p;
}

export function Folie({ url, datei, seite, titel }: { url: string; datei: string; seite: number; titel: string }) {
  const rahmen = useRef<HTMLDivElement>(null);
  const leinwand = useRef<HTMLCanvasElement>(null);
  const [stand, setStand] = useState<"laedt" | "bereit" | "fehler">("laedt");
  const [format, setFormat] = useState(16 / 9);

  useEffect(() => {
    let abbruch = false;
    let aufgabe: { cancel: () => void } | null = null;

    async function zeichnen() {
      const box = rahmen.current;
      const canvas = leinwand.current;
      if (!box || !canvas) return;
      try {
        const pdf = await dokumentLaden(datei, url);
        const page = await pdf.getPage(Math.min(seite, pdf.numPages));
        if (abbruch) return;
        const basis = page.getViewport({ scale: 1 });
        setFormat(basis.width / basis.height);
        const pixel = Math.min(window.devicePixelRatio || 1, 3);
        const viewport = page.getViewport({ scale: (box.clientWidth / basis.width) * pixel });
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        aufgabe?.cancel();
        const task = page.render({ canvas, viewport });
        aufgabe = task;
        await task.promise;
        if (!abbruch) setStand("bereit");
      } catch (e) {
        if (abbruch || (e instanceof Error && e.name === "RenderingCancelledException")) return;
        console.error("[philosophie] Folie", e);
        setStand("fehler");
      }
    }

    void zeichnen();
    // Bei Grössenänderung (Drehen des Handys, Fenster) neu und scharf zeichnen
    let zeit: ReturnType<typeof setTimeout>;
    const beobachter = new ResizeObserver(() => {
      clearTimeout(zeit);
      zeit = setTimeout(() => void zeichnen(), 150);
    });
    if (rahmen.current) beobachter.observe(rahmen.current);
    return () => {
      abbruch = true;
      aufgabe?.cancel();
      beobachter.disconnect();
      clearTimeout(zeit);
    };
  }, [url, datei, seite]);

  return (
    <figure className="flex flex-col gap-2">
      <div
        ref={rahmen}
        className="relative w-full overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800"
        style={{ aspectRatio: format }}
      >
        <canvas
          ref={leinwand}
          role="img"
          aria-label={`Folie: ${titel}`}
          className={`h-full w-full transition-opacity duration-200 ${stand === "bereit" ? "opacity-100" : "opacity-0"}`}
        />
        {stand === "laedt" ? (
          <div className="absolute inset-0 animate-pulse bg-neutral-100 dark:bg-neutral-800" aria-hidden />
        ) : null}
        {stand === "fehler" ? (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-neutral-500">
            Die Folie konnte nicht geladen werden. Wechsle zur Textansicht oder öffne das Original.
          </div>
        ) : null}
      </div>
    </figure>
  );
}
